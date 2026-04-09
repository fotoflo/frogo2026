/**
 * End-to-end pairing flow test.
 *
 * Tests the full lifecycle: session creation → phone join → command delivery
 * via Supabase Realtime. Requires a live Supabase instance (uses env vars).
 *
 * Run: npx vitest run src/lib/pairing.e2e.test.ts
 */

import { readFileSync } from "fs";
import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Load .env.local without dotenv dependency
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq > 0) process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function makeAnonClient() {
  return createClient(SUPABASE_URL, ANON_KEY);
}

function makeServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Track sessions to clean up after tests
const createdSessionIds: string[] = [];

afterEach(async () => {
  if (createdSessionIds.length === 0) return;
  const svc = makeServiceClient();
  await svc
    .from("pairing_sessions")
    .delete()
    .in("id", createdSessionIds);
  createdSessionIds.length = 0;
});

describe("pairing e2e", () => {
  it("creates a pairing session", async () => {
    const svc = makeServiceClient();
    const code = generateCode();

    const { data, error } = await svc
      .from("pairing_sessions")
      .insert({
        code,
        desktop_session_id: crypto.randomUUID(),
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.code).toBe(code);
    expect(data!.paired).toBe(false);
    createdSessionIds.push(data!.id);
  });

  it("phone joins session by code and marks paired", async () => {
    const svc = makeServiceClient();
    const code = generateCode();

    // TV creates session
    const { data: session } = await svc
      .from("pairing_sessions")
      .insert({
        code,
        desktop_session_id: crypto.randomUUID(),
      })
      .select()
      .single();
    createdSessionIds.push(session!.id);

    // Phone looks up session by code (anon client, like the real flow)
    const anon = makeAnonClient();
    const { data: found, error: findErr } = await anon
      .from("pairing_sessions")
      .select("*")
      .eq("code", code)
      .single();

    expect(findErr).toBeNull();
    expect(found!.id).toBe(session!.id);

    // Phone marks session as paired
    const { error: updateErr } = await anon
      .from("pairing_sessions")
      .update({ paired: true, mobile_session_id: crypto.randomUUID() })
      .eq("id", session!.id);

    expect(updateErr).toBeNull();

    // Verify paired state
    const { data: updated } = await svc
      .from("pairing_sessions")
      .select("paired, mobile_session_id")
      .eq("id", session!.id)
      .single();

    expect(updated!.paired).toBe(true);
    expect(updated!.mobile_session_id).toBeTruthy();
  });

  it("command flows from phone to TV via Realtime", async () => {
    const svc = makeServiceClient();
    const anon = makeAnonClient();
    const code = generateCode();

    // TV creates session
    const { data: session } = await svc
      .from("pairing_sessions")
      .insert({
        code,
        desktop_session_id: crypto.randomUUID(),
        paired: true,
      })
      .select()
      .single();
    createdSessionIds.push(session!.id);

    // TV subscribes to Realtime (same pattern as TVClient.tsx)
    const receivedCommands: string[] = [];

    const channel = anon
      .channel(`pairing:${session!.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pairing_sessions",
          filter: `id=eq.${session!.id}`,
        },
        (payload) => {
          const row = payload.new as { last_command?: string };
          if (row.last_command) {
            receivedCommands.push(row.last_command);
          }
        }
      );

    const subscribed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 8000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });

    expect(subscribed).toBe(true);

    // Brief settle time for Realtime to fully establish
    await new Promise((r) => setTimeout(r, 1000));

    // Phone sends a command (direct DB write, same as pair/page.tsx)
    const { error: cmdErr } = await anon
      .from("pairing_sessions")
      .update({
        last_command: "next",
        last_command_at: new Date().toISOString(),
      })
      .eq("id", session!.id);

    expect(cmdErr).toBeNull();

    // Wait for Realtime delivery
    await new Promise((r) => setTimeout(r, 4000));

    expect(receivedCommands).toContain("next");

    // Cleanup subscription
    anon.removeChannel(channel);
  }, 20000);

  it("sends multiple commands in sequence", async () => {
    const svc = makeServiceClient();
    const anon = makeAnonClient();
    const code = generateCode();

    // Create paired session
    const { data: session } = await svc
      .from("pairing_sessions")
      .insert({
        code,
        desktop_session_id: crypto.randomUUID(),
        paired: true,
      })
      .select()
      .single();
    createdSessionIds.push(session!.id);

    // TV subscribes
    const receivedCommands: string[] = [];
    const channel = anon
      .channel(`pairing:${session!.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pairing_sessions",
          filter: `id=eq.${session!.id}`,
        },
        (payload) => {
          const row = payload.new as { last_command?: string };
          if (row.last_command) receivedCommands.push(row.last_command);
        }
      );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Subscribe timeout")), 8000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(); }
      });
    });

    // Brief settle time for Realtime to fully establish
    await new Promise((r) => setTimeout(r, 1000));

    // Phone sends three commands with small delays
    const commands = ["next", "prev", "channel_3"];
    for (const cmd of commands) {
      await anon
        .from("pairing_sessions")
        .update({
          last_command: cmd,
          last_command_at: new Date().toISOString(),
        })
        .eq("id", session!.id);
      await new Promise((r) => setTimeout(r, 500));
    }

    // Wait for delivery
    await new Promise((r) => setTimeout(r, 2000));

    expect(receivedCommands).toContain("next");
    expect(receivedCommands).toContain("prev");
    expect(receivedCommands).toContain("channel_3");

    anon.removeChannel(channel);
  }, 20000);

  it("expired session rejects join", async () => {
    const svc = makeServiceClient();
    const anon = makeAnonClient();
    const code = generateCode();

    // Create already-expired session
    const { data: session } = await svc
      .from("pairing_sessions")
      .insert({
        code,
        desktop_session_id: crypto.randomUUID(),
        expires_at: new Date(Date.now() - 60000).toISOString(),
      })
      .select()
      .single();
    createdSessionIds.push(session!.id);

    // Phone tries to find session by code with expiry check
    const { data: found } = await anon
      .from("pairing_sessions")
      .select("*")
      .eq("code", code)
      .gt("expires_at", new Date().toISOString())
      .single();

    expect(found).toBeNull();
  });
});
