/**
 * Tests for POST /api/mcp — Streamable HTTP JSON-RPC 2.0 endpoint.
 *
 * Scope: JSON-RPC framing + auth gate + method dispatcher. We don't exercise
 * the tool implementations here (they hit the DB for real curation work);
 * those would go in a separate integration-style test file.
 *
 * Strategy:
 *   - Mock `resolveBearerToken` so we can toggle auth state per test
 *   - Mock `createServiceClient` with a no-op — dispatched methods in this
 *     file (initialize, ping, tools/list, notifications, unknown method,
 *     tools/call with missing/unknown name) never touch the DB
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createServiceClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/mcp-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mcp-auth")>(
    "@/lib/mcp-auth"
  );
  return {
    ...actual,
    resolveBearerToken: vi.fn(),
  };
});

import { POST, DELETE, GET } from "./route";
import { resolveBearerToken } from "@/lib/mcp-auth";

const validAuth = {
  tokenHash: "hash",
  userId: "user-1",
  clientId: "mcp_client",
  scope: "frogo:curate",
};

function rpcRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://frogo.tv/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer valid-token",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveBearerToken).mockResolvedValue(validAuth);
});

describe("POST /api/mcp — auth", () => {
  it("returns 401 + WWW-Authenticate when bearer is missing/invalid", async () => {
    vi.mocked(resolveBearerToken).mockResolvedValue(null);
    const res = await POST(rpcRequest({ jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.status).toBe(401);
    const header = res.headers.get("www-authenticate");
    expect(header).toContain('Bearer realm="mcp"');
    expect(header).toContain('resource_metadata="');
    expect(header).toContain("/.well-known/oauth-protected-resource");
  });

  it("returns 401 when the token scope is wrong", async () => {
    vi.mocked(resolveBearerToken).mockResolvedValue({
      ...validAuth,
      scope: "frogo:read",
    });
    const res = await POST(rpcRequest({ jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata");
  });

  it("uses getIssuer for the resource_metadata URL (honors x-forwarded-host)", async () => {
    vi.mocked(resolveBearerToken).mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost:5555/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-host": "abc.ngrok-free.app",
          "x-forwarded-proto": "https",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      })
    );
    expect(res.headers.get("www-authenticate")).toContain(
      "https://abc.ngrok-free.app/.well-known/oauth-protected-resource"
    );
  });
});

describe("POST /api/mcp — JSON-RPC framing", () => {
  it("returns -32700 Parse error for malformed JSON", async () => {
    const res = await POST(rpcRequest("not json at all {"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBeNull();
    expect(body.error.code).toBe(-32700);
  });

  it("returns -32600 Invalid Request for wrong jsonrpc version", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "1.0", id: 5, method: "ping" })
    );
    const body = await res.json();
    expect(body.error.code).toBe(-32600);
    expect(body.id).toBe(5);
  });

  it("returns -32600 Invalid Request when method is missing", async () => {
    const res = await POST(rpcRequest({ jsonrpc: "2.0", id: 7 }));
    const body = await res.json();
    expect(body.error.code).toBe(-32600);
  });

  it("returns -32601 Method not found for unknown methods", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", id: 9, method: "unknown/method" })
    );
    const body = await res.json();
    expect(body.error.code).toBe(-32601);
    expect(body.error.message).toMatch(/unknown\/method/);
  });
});

describe("POST /api/mcp — standard methods", () => {
  it("initialize returns protocolVersion + tools capability + serverInfo", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", id: 1, method: "initialize" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(1);
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe("frogo-mcp");
  });

  it("notifications/initialized returns 202 with no body", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", method: "notifications/initialized" })
    );
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("notifications/cancelled returns 202", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", method: "notifications/cancelled" })
    );
    expect(res.status).toBe(202);
  });

  it("ping returns an empty result", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", id: 2, method: "ping" })
    );
    const body = await res.json();
    expect(body.result).toEqual({});
    expect(body.id).toBe(2);
  });

  it("tools/list returns the full curation tool set", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", id: 3, method: "tools/list" })
    );
    const body = await res.json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      "list_channels",
      "get_channel",
      "create_channel",
      "update_channel",
      "delete_channel",
      "add_video",
      "delete_video",
      "reorder_videos",
    ]);
    // Each tool must have a JSON Schema input definition.
    for (const tool of body.result.tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description).toBeTruthy();
    }
  });

  it("tools/list update_channel schema supports reparenting and slug edits", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", id: 30, method: "tools/list" })
    );
    const body = await res.json();
    const update = body.result.tools.find(
      (t: { name: string }) => t.name === "update_channel"
    );
    expect(update.inputSchema.required).toEqual(["id"]);
    expect(update.inputSchema.properties.slug).toBeDefined();
    expect(update.inputSchema.properties.parent_id).toBeDefined();
    expect(update.inputSchema.properties.parent_path).toBeDefined();
  });

  it("tools/list delete_channel requires id and accepts a force flag", async () => {
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", id: 31, method: "tools/list" })
    );
    const body = await res.json();
    const del = body.result.tools.find(
      (t: { name: string }) => t.name === "delete_channel"
    );
    expect(del.inputSchema.required).toEqual(["id"]);
    expect(del.inputSchema.properties.force.type).toBe("boolean");
  });

  it("tools/list add_video schema includes the title + duration_seconds overrides", async () => {
    // These overrides are the escape hatch when YouTube's consent wall
    // blocks the server-side metadata scrape — the doc calls this out as a
    // deliberate load-bearing feature.
    const res = await POST(
      rpcRequest({ jsonrpc: "2.0", id: 4, method: "tools/list" })
    );
    const body = await res.json();
    const addVideo = body.result.tools.find(
      (t: { name: string }) => t.name === "add_video"
    );
    expect(addVideo.inputSchema.properties.title).toBeDefined();
    expect(addVideo.inputSchema.properties.duration_seconds).toBeDefined();
    expect(addVideo.inputSchema.properties.duration_seconds.minimum).toBe(1);
  });
});

describe("POST /api/mcp — tools/call", () => {
  it("returns -32602 when tools/call has no name", async () => {
    const res = await POST(
      rpcRequest({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { arguments: {} },
      })
    );
    const body = await res.json();
    expect(body.error.code).toBe(-32602);
  });

  it("returns an in-band error result for unknown tool names", async () => {
    // Per MCP spec, tool errors come back as a normal result with
    // `isError: true` — not as a JSON-RPC error. This keeps transport
    // errors distinct from tool execution errors.
    const res = await POST(
      rpcRequest({
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: { name: "no_such_tool", arguments: {} },
      })
    );
    const body = await res.json();
    expect(body.error).toBeUndefined();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].type).toBe("text");
    expect(body.result.content[0].text).toMatch(/Unknown tool: no_such_tool/);
  });
});

describe("DELETE /api/mcp", () => {
  it("returns 204 (Claude.ai connector chokes on 405)", async () => {
    const res = await DELETE();
    expect(res.status).toBe(204);
  });
});

describe("GET /api/mcp", () => {
  it("requires a valid bearer", async () => {
    vi.mocked(resolveBearerToken).mockResolvedValue(null);
    const controller = new AbortController();
    const res = await GET(
      new Request("https://frogo.tv/api/mcp", {
        headers: { authorization: "Bearer bad" },
        signal: controller.signal,
      })
    );
    expect(res.status).toBe(401);
    controller.abort();
  });

  it("returns an SSE stream for valid bearers", async () => {
    const controller = new AbortController();
    const res = await GET(
      new Request("https://frogo.tv/api/mcp", {
        headers: { authorization: "Bearer valid" },
        signal: controller.signal,
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    // Cancel the stream so the heartbeat interval gets cleaned up.
    controller.abort();
    await res.body?.cancel().catch(() => {});
  });
});
