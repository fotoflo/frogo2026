/**
 * Tests for POST /api/oauth/register — RFC 7591 Dynamic Client Registration.
 *
 * Mocks the service client so we can assert the insert payload and branch
 * on the DB error path without touching Supabase.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));

import { POST } from "./route";
import { createServiceClient } from "@/lib/supabase";

type InsertResult = { error: { message: string } | null };

/**
 * Minimal service-client mock. Records the last insert payload so tests can
 * assert against it, and lets each test pick the DB response.
 */
function makeService(insertResult: InsertResult = { error: null }) {
  const calls: { table: string; payload: unknown }[] = [];
  const from = vi.fn((table: string) => ({
    insert: (payload: unknown) => {
      calls.push({ table, payload });
      return Promise.resolve(insertResult);
    },
  }));
  return { from, calls };
}

function jsonRequest(body: unknown) {
  return new Request("https://frogo.tv/api/oauth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/oauth/register", () => {
  it("rejects a non-JSON body with 400 invalid_request", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const req = new Request("https://frogo.tv/api/oauth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
    // Must short-circuit before touching the DB.
    expect(svc.from).not.toHaveBeenCalled();
  });

  it("rejects empty redirect_uris with 400 invalid_redirect_uri", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(jsonRequest({ client_name: "Test" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_redirect_uri");
    expect(svc.from).not.toHaveBeenCalled();
  });

  it("rejects a non-http/https redirect_uri", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      jsonRequest({
        client_name: "Test",
        redirect_uris: ["ftp://example.com/cb"],
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_redirect_uri");
  });

  it("rejects http:// for non-localhost hosts", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      jsonRequest({
        client_name: "Test",
        redirect_uris: ["http://evil.example.com/cb"],
      })
    );
    expect(res.status).toBe(400);
  });

  it("allows http:// localhost (Claude Desktop callback)", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      jsonRequest({
        client_name: "Claude Desktop",
        redirect_uris: ["http://localhost:33418/cb"],
      })
    );
    expect(res.status).toBe(201);
  });

  it("allows http:// 127.0.0.1", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      jsonRequest({
        client_name: "Claude Desktop",
        redirect_uris: ["http://127.0.0.1:5173/cb"],
      })
    );
    expect(res.status).toBe(201);
  });

  it("rejects a malformed URL string", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      jsonRequest({
        client_name: "Test",
        redirect_uris: ["not a url at all"],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 + RFC 7591 shape on success", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const before = Math.floor(Date.now() / 1000);
    const res = await POST(
      jsonRequest({
        client_name: "Claude Code",
        redirect_uris: ["https://claude.ai/api/mcp/callback"],
      })
    );
    const after = Math.floor(Date.now() / 1000);

    expect(res.status).toBe(201);
    const body = await res.json();

    // RFC 7591 §3.2.1 required-ish fields
    expect(body.client_id).toMatch(/^mcp_[a-f0-9]{32}$/);
    expect(body.client_id_issued_at).toBeGreaterThanOrEqual(before);
    expect(body.client_id_issued_at).toBeLessThanOrEqual(after);
    // Public clients: conventional "0" sentinel
    expect(body.client_secret_expires_at).toBe(0);

    expect(body.client_name).toBe("Claude Code");
    expect(body.redirect_uris).toEqual(["https://claude.ai/api/mcp/callback"]);
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body.grant_types).toEqual(["authorization_code"]);
    expect(body.response_types).toEqual(["code"]);

    // Should have a client_secret-less response.
    expect(body.client_secret).toBeUndefined();
  });

  it("defaults missing client_name to 'Unnamed MCP Client'", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      jsonRequest({
        redirect_uris: ["https://example.com/cb"],
      })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).client_name).toBe("Unnamed MCP Client");
  });

  it("persists the client record to mcp_clients", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    await POST(
      jsonRequest({
        client_name: "Test",
        redirect_uris: ["https://example.com/cb"],
      })
    );
    expect(svc.calls).toHaveLength(1);
    expect(svc.calls[0].table).toBe("mcp_clients");
    const payload = svc.calls[0].payload as {
      client_id: string;
      client_name: string;
      redirect_uris: string[];
    };
    expect(payload.client_id).toMatch(/^mcp_[a-f0-9]{32}$/);
    expect(payload.client_name).toBe("Test");
    expect(payload.redirect_uris).toEqual(["https://example.com/cb"]);
  });

  it("returns 500 server_error when the insert fails", async () => {
    const svc = makeService({ error: { message: "boom" } });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      jsonRequest({
        client_name: "Test",
        redirect_uris: ["https://example.com/cb"],
      })
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("server_error");
  });

  it("accepts multiple redirect_uris", async () => {
    const svc = makeService();
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const uris = [
      "https://claude.ai/api/mcp/callback",
      "http://localhost:33418/cb",
    ];
    const res = await POST(
      jsonRequest({ client_name: "Test", redirect_uris: uris })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).redirect_uris).toEqual(uris);
  });
});
