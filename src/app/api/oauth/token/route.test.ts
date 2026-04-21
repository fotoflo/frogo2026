/**
 * Tests for POST /api/oauth/token — OAuth 2.1 authorization_code exchange.
 *
 * Key invariants under test:
 *   - PKCE S256 gate (bad verifier → invalid_grant, code is deleted anyway)
 *   - Single-use codes (delete-before-validate semantics)
 *   - Issued tokens are stored as SHA-256 hashes, never plaintext
 *   - Both form-encoded and JSON request bodies work
 *   - All error responses carry cache-control: no-store
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(),
}));

import { POST } from "./route";
import { createServiceClient } from "@/lib/supabase";
import { hashToken, base64url } from "@/lib/mcp-auth";

// RFC 7636 Appendix B — canonical PKCE S256 test vector.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

type AuthCodeRow = {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  expires_at: string;
};

/**
 * Service client mock with per-table behavior:
 *   mcp_auth_codes  — select().eq().maybeSingle() returns `authCode`
 *                     delete().eq() resolves (and records the call)
 *   mcp_access_tokens — insert() returns `{ error: insertError }` and
 *                       records the payload
 */
function makeService(opts: {
  authCode: AuthCodeRow | null;
  insertError?: { message: string } | null;
}) {
  const calls = {
    deletes: [] as unknown[],
    inserts: [] as unknown[],
  };

  const from = vi.fn((table: string) => {
    if (table === "mcp_auth_codes") {
      const builder: Record<string, unknown> = {};
      Object.assign(builder, {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: opts.authCode, error: null }),
        delete: () => ({
          eq: (_col: string, val: unknown) => {
            calls.deletes.push(val);
            return Promise.resolve({ error: null });
          },
        }),
      });
      return builder;
    }
    if (table === "mcp_access_tokens") {
      return {
        insert: (payload: unknown) => {
          calls.inserts.push(payload);
          return Promise.resolve({ error: opts.insertError ?? null });
        },
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { from, calls };
}

function validRow(overrides: Partial<AuthCodeRow> = {}): AuthCodeRow {
  return {
    code: "code-xyz",
    client_id: "mcp_client",
    user_id: "user-1",
    redirect_uri: "https://claude.ai/cb",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    scope: "frogo:curate",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

function formRequest(params: Record<string, string>) {
  const body = new URLSearchParams(params).toString();
  return new Request("https://frogo.tv/api/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

function jsonRequest(params: Record<string, string>) {
  return new Request("https://frogo.tv/api/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
}

const validParams = {
  grant_type: "authorization_code",
  code: "code-xyz",
  code_verifier: VERIFIER,
  client_id: "mcp_client",
  redirect_uri: "https://claude.ai/cb",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/oauth/token", () => {
  it("rejects unsupported grant types", async () => {
    const svc = makeService({ authCode: null });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest({ ...validParams, grant_type: "password" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unsupported_grant_type");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects missing required parameters", async () => {
    const svc = makeService({ authCode: null });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      formRequest({ grant_type: "authorization_code", code: "abc" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
  });

  it("returns invalid_grant when the code is unknown", async () => {
    const svc = makeService({ authCode: null });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest(validParams));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
    // Nothing to delete; nothing to insert.
    expect(svc.calls.inserts).toHaveLength(0);
  });

  it("deletes the code before running validations (single-use guarantee)", async () => {
    // Even with a bad PKCE verifier the row should be deleted.
    const svc = makeService({ authCode: validRow() });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(
      formRequest({ ...validParams, code_verifier: "wrong-verifier-string-must-be-43+chars-long!!!" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
    expect(svc.calls.deletes).toEqual(["code-xyz"]);
    expect(svc.calls.inserts).toHaveLength(0);
  });

  it("rejects an expired code", async () => {
    const svc = makeService({
      authCode: validRow({
        expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
    });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest(validParams));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
    expect(body.error_description).toMatch(/expired/);
  });

  it("rejects a client_id mismatch", async () => {
    const svc = makeService({
      authCode: validRow({ client_id: "different_client" }),
    });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest(validParams));
    expect(res.status).toBe(400);
    expect((await res.json()).error_description).toMatch(/client_id/);
  });

  it("rejects a redirect_uri mismatch", async () => {
    const svc = makeService({
      authCode: validRow({ redirect_uri: "https://evil.example.com/cb" }),
    });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest(validParams));
    expect(res.status).toBe(400);
    expect((await res.json()).error_description).toMatch(/redirect_uri/);
  });

  it("rejects `plain` PKCE method even if verifier matches (OAuth 2.1 forbids it)", async () => {
    const svc = makeService({
      authCode: validRow({
        code_challenge: VERIFIER,
        code_challenge_method: "plain",
      }),
    });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest(validParams));
    expect(res.status).toBe(400);
    expect((await res.json()).error_description).toMatch(/PKCE/);
  });

  it("mints and returns a valid bearer token on success (form body)", async () => {
    const svc = makeService({ authCode: validRow() });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest(validParams));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.token_type).toBe("Bearer");
    expect(body.scope).toBe("frogo:curate");
    expect(body.expires_in).toBe(30 * 24 * 60 * 60);
    expect(body.access_token).toMatch(/^[a-f0-9]{64}$/);

    // Cache-control MUST be no-store per RFC 6749 §5.1.
    expect(res.headers.get("cache-control")).toBe("no-store");

    // Code was deleted + token row was inserted once.
    expect(svc.calls.deletes).toEqual(["code-xyz"]);
    expect(svc.calls.inserts).toHaveLength(1);

    // Stored token is the SHA-256 hash of the plaintext — never the plaintext.
    const stored = svc.calls.inserts[0] as {
      token_hash: string;
      client_id: string;
      user_id: string;
      scope: string;
    };
    expect(stored.token_hash).toBe(hashToken(body.access_token));
    expect(stored.token_hash).not.toBe(body.access_token);
    expect(stored.client_id).toBe("mcp_client");
    expect(stored.user_id).toBe("user-1");
    expect(stored.scope).toBe("frogo:curate");
  });

  it("also accepts a JSON request body", async () => {
    const svc = makeService({ authCode: validRow() });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(jsonRequest(validParams));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts the generated PKCE challenge end-to-end (full round trip)", async () => {
    // Generate our own verifier/challenge pair — proves the code doesn't
    // special-case the RFC vector.
    const v = base64url(crypto.randomBytes(32));
    const c = base64url(crypto.createHash("sha256").update(v).digest());
    const svc = makeService({
      authCode: validRow({ code_challenge: c, code_challenge_method: "S256" }),
    });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest({ ...validParams, code_verifier: v }));
    expect(res.status).toBe(200);
  });

  it("returns 500 server_error when token insert fails", async () => {
    const svc = makeService({
      authCode: validRow(),
      insertError: { message: "db unreachable" },
    });
    vi.mocked(createServiceClient).mockReturnValue(
      svc as unknown as ReturnType<typeof createServiceClient>
    );
    const res = await POST(formRequest(validParams));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("server_error");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
