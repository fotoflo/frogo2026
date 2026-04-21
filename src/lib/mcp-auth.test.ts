/**
 * Unit tests for the MCP OAuth auth helpers.
 *
 * Pure-ish — `resolveBearerToken` takes an injected Supabase client so we
 * can hand it a minimal builder mock instead of reaching for vi.mock.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  generateToken,
  hashToken,
  base64url,
  verifyPkce,
  timingSafeEqualStrings,
  resolveBearerToken,
  getIssuer,
} from "./mcp-auth";

// RFC 7636 Appendix B — canonical PKCE S256 test vector.
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("generateToken", () => {
  it("returns 64 hex chars by default (32 bytes)", () => {
    expect(generateToken()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("respects a custom byte length", () => {
    expect(generateToken(16)).toMatch(/^[a-f0-9]{32}$/);
    expect(generateToken(24)).toMatch(/^[a-f0-9]{48}$/);
  });

  it("produces unique values across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateToken());
    expect(seen.size).toBe(100);
  });
});

describe("hashToken", () => {
  it("returns a stable sha256 hex digest", () => {
    // Known sha256("hello") — if this changes, something is very wrong.
    expect(hashToken("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("is deterministic for the same input", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("returns 64 hex chars", () => {
    expect(hashToken("anything")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("base64url", () => {
  it("strips padding", () => {
    expect(base64url(Buffer.from("any"))).not.toContain("=");
  });

  it("replaces + and / with - and _", () => {
    // Bytes 0xfb 0xff 0xfe encode to "+//+" range in standard base64.
    const encoded = base64url(Buffer.from([0xfb, 0xff, 0xfe]));
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });

  it("round-trips with node's base64url for the RFC verifier", () => {
    // sha256 of the RFC 7636 verifier, encoded via our function,
    // should match the RFC challenge.
    const hash = crypto.createHash("sha256").update(RFC_VERIFIER).digest();
    expect(base64url(hash)).toBe(RFC_CHALLENGE);
  });
});

describe("verifyPkce", () => {
  it("accepts the RFC 7636 reference vector", () => {
    expect(verifyPkce(RFC_VERIFIER, RFC_CHALLENGE, "S256")).toBe(true);
  });

  it("rejects `plain` method (forbidden by OAuth 2.1)", () => {
    expect(verifyPkce(RFC_VERIFIER, RFC_VERIFIER, "plain")).toBe(false);
  });

  it("rejects unknown methods", () => {
    expect(verifyPkce(RFC_VERIFIER, RFC_CHALLENGE, "MD5")).toBe(false);
  });

  it("rejects verifier shorter than 43 chars", () => {
    expect(verifyPkce("a".repeat(42), RFC_CHALLENGE, "S256")).toBe(false);
  });

  it("rejects verifier longer than 128 chars", () => {
    expect(verifyPkce("a".repeat(129), RFC_CHALLENGE, "S256")).toBe(false);
  });

  it("accepts a verifier at the minimum length (43)", () => {
    const v = "a".repeat(43);
    const c = base64url(crypto.createHash("sha256").update(v).digest());
    expect(verifyPkce(v, c, "S256")).toBe(true);
  });

  it("accepts a verifier at the maximum length (128)", () => {
    const v = "a".repeat(128);
    const c = base64url(crypto.createHash("sha256").update(v).digest());
    expect(verifyPkce(v, c, "S256")).toBe(true);
  });

  it("rejects a mismatched challenge of the same length", () => {
    // Swap one char at the end — still 43 chars but wrong hash.
    const wrong = RFC_CHALLENGE.slice(0, -1) + (RFC_CHALLENGE.endsWith("M") ? "N" : "M");
    expect(verifyPkce(RFC_VERIFIER, wrong, "S256")).toBe(false);
  });

  it("rejects a mismatched challenge of different length", () => {
    expect(verifyPkce(RFC_VERIFIER, "short", "S256")).toBe(false);
  });
});

describe("timingSafeEqualStrings", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqualStrings("hello", "hello")).toBe(true);
  });

  it("returns false for same-length unequal strings", () => {
    expect(timingSafeEqualStrings("hello", "world")).toBe(false);
  });

  it("returns false for different-length strings without throwing", () => {
    // crypto.timingSafeEqual throws on length mismatch — wrapper must short-circuit.
    expect(() => timingSafeEqualStrings("a", "aa")).not.toThrow();
    expect(timingSafeEqualStrings("a", "aa")).toBe(false);
  });

  it("handles empty strings", () => {
    expect(timingSafeEqualStrings("", "")).toBe(true);
  });
});

describe("resolveBearerToken", () => {
  /**
   * Minimal Supabase client that always returns the same fixed response
   * for select chains. Update chains are no-ops (fire-and-forget in the
   * real code path).
   */
  function makeSupabase(response: { data: unknown; error?: unknown }) {
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: () => builder,
      update: () => builder,
      maybeSingle: () => Promise.resolve(response),
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve({}).then(onFulfilled),
    });
    return { from: vi.fn(() => builder) };
  }

  it("returns null for null auth header", async () => {
    const s = makeSupabase({ data: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveBearerToken(s as any, null)).toBeNull();
    expect(s.from).not.toHaveBeenCalled();
  });

  it("returns null for non-Bearer scheme", async () => {
    const s = makeSupabase({ data: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveBearerToken(s as any, "Basic dXNlcjpwYXNz")).toBeNull();
  });

  it("returns null for empty token value", async () => {
    const s = makeSupabase({ data: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveBearerToken(s as any, "Bearer ")).toBeNull();
  });

  it("returns null when token is not in the DB", async () => {
    const s = makeSupabase({ data: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveBearerToken(s as any, "Bearer unknown")).toBeNull();
  });

  it("returns null for revoked tokens", async () => {
    const s = makeSupabase({
      data: {
        user_id: "u1",
        client_id: "c1",
        scope: "frogo:curate",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        revoked_at: new Date().toISOString(),
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveBearerToken(s as any, "Bearer tok")).toBeNull();
  });

  it("returns null for expired tokens", async () => {
    const s = makeSupabase({
      data: {
        user_id: "u1",
        client_id: "c1",
        scope: "frogo:curate",
        expires_at: new Date(Date.now() - 1000).toISOString(),
        revoked_at: null,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveBearerToken(s as any, "Bearer tok")).toBeNull();
  });

  it("returns resolved user for a valid bearer", async () => {
    const s = makeSupabase({
      data: {
        user_id: "u1",
        client_id: "c1",
        scope: "frogo:curate",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        revoked_at: null,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveBearerToken(s as any, "Bearer plainToken");
    expect(result).toMatchObject({
      userId: "u1",
      clientId: "c1",
      scope: "frogo:curate",
    });
    // Must hash before DB lookup — never store/compare plaintext.
    expect(result?.tokenHash).toBe(hashToken("plainToken"));
  });
});

describe("getIssuer", () => {
  const origEnv = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (origEnv === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = origEnv;
  });

  function req(url: string, headers: Record<string, string> = {}) {
    return new Request(url, { headers });
  }

  it("prefers NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://frogo.tv";
    expect(getIssuer(req("http://internal:3000/api/mcp"))).toBe("https://frogo.tv");
  });

  it("strips a trailing slash from NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://frogo.tv/";
    expect(getIssuer(req("http://internal:3000"))).toBe("https://frogo.tv");
  });

  it("falls back to x-forwarded-host + x-forwarded-proto when env is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const r = req("http://localhost:5555/api/mcp", {
      "x-forwarded-host": "abc.ngrok-free.app",
      "x-forwarded-proto": "https",
    });
    expect(getIssuer(r)).toBe("https://abc.ngrok-free.app");
  });

  it("defaults x-forwarded-proto to https when only host is present", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const r = req("http://internal/api/mcp", {
      "x-forwarded-host": "preview.frogo.tv",
    });
    expect(getIssuer(r)).toBe("https://preview.frogo.tv");
  });

  it("falls back to request URL origin when nothing else is set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getIssuer(req("https://frogo.tv/api/mcp"))).toBe("https://frogo.tv");
  });
});
