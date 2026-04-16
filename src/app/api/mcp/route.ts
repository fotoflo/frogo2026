/**
 * MCP Streamable HTTP endpoint.
 *
 *   POST /api/mcp        — JSON-RPC 2.0 requests from MCP clients
 *   GET  /api/mcp        — optional SSE channel (kept open as a no-op)
 *
 * Protocol: https://spec.modelcontextprotocol.io (2025-06-18 revision).
 * Auth:     Bearer token minted by /api/oauth/token. On 401 we return the
 *           WWW-Authenticate header required by the MCP auth spec so clients
 *           can discover the OAuth AS.
 *
 * Tools exposed (scope `frogo:curate`) — implementations live in `./tools/`,
 * wired up via `./registry`:
 *   list_channels             — user's owned channels with path + video count
 *   get_channel               — one channel + its playlist
 *   create_channel            — create a new channel (optionally nested)
 *   update_channel            — edit an existing channel
 *   delete_channel            — delete a channel (force=true to detach children)
 *   search_channels           — find owned channels by name/slug/description
 *   add_video                 — append a YouTube URL to a channel's playlist
 *   add_videos_bulk           — add many YouTube URLs at once with per-item status
 *   import_youtube_playlist   — pull a YouTube playlist into a channel
 *   import_youtube_channel    — pull a YouTube channel's recent videos in
 *   list_videos               — list a channel's playlist (id/title/youtube_id)
 *   delete_video              — remove a video from a playlist
 *   update_video              — override title/thumbnail/description
 *   refresh_video_metadata    — re-fetch title + duration from YouTube
 *   reorder_videos            — set a channel's playlist order
 *   search_videos             — find owned videos by title (optionally per channel)
 *   search_youtube            — search YouTube (with min_length_seconds filter)
 *
 * All tool calls are scoped to the authenticated user via owner_id. The
 * service client is used because token lookup needs to bypass RLS, but tool
 * mutations still filter by user_id.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveBearerToken, getIssuer } from "@/lib/mcp-auth";
import { TOOLS, callTool } from "./registry";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "frogo-mcp", version: "0.1.0" };

// ─── JSON-RPC helpers ──────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

function rpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  data?: unknown
) {
  return {
    jsonrpc: "2.0" as const,
    id: id ?? null,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

// ─── Auth ──────────────────────────────────────────────────────────────────

function unauthorized(request: Request) {
  // Use getIssuer so the resource_metadata URL honors x-forwarded-host
  // — critical on ngrok-fronted dev and any proxied prod setup.
  const resourceMetadata = `${getIssuer(request)}/.well-known/oauth-protected-resource`;
  return new NextResponse(
    JSON.stringify({ error: "invalid_token" }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer realm="mcp", resource_metadata="${resourceMetadata}"`,
      },
    }
  );
}

// ─── Request handlers ──────────────────────────────────────────────────────

export async function POST(request: Request) {
  console.log("[mcp] POST", {
    ua: request.headers.get("user-agent"),
    hasAuth: !!request.headers.get("authorization"),
    session: request.headers.get("mcp-session-id"),
  });
  const service = createServiceClient();
  const auth = await resolveBearerToken(
    service,
    request.headers.get("authorization")
  );
  if (!auth) {
    console.log("[mcp] POST 401 — no/invalid bearer");
    return unauthorized(request);
  }
  if (auth.scope !== "frogo:curate") {
    console.log("[mcp] POST 401 — wrong scope:", auth.scope);
    return unauthorized(request);
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), {
      status: 400,
    });
  }

  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return NextResponse.json(rpcError(body.id, -32600, "Invalid Request"));
  }

  try {
    switch (body.method) {
      case "initialize":
        return NextResponse.json(
          rpcResult(body.id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: true } },
            serverInfo: SERVER_INFO,
          })
        );

      case "notifications/initialized":
      case "notifications/cancelled":
        // Notifications have no response.
        return new NextResponse(null, { status: 202 });

      case "ping":
        return NextResponse.json(rpcResult(body.id, {}));

      case "tools/list":
        return NextResponse.json(rpcResult(body.id, { tools: TOOLS }));

      case "tools/call": {
        const params = (body.params ?? {}) as {
          name?: string;
          arguments?: unknown;
        };
        if (!params.name) {
          return NextResponse.json(
            rpcError(body.id, -32602, "Missing tool name")
          );
        }
        try {
          const result = await callTool(
            service,
            auth,
            params.name,
            params.arguments
          );
          return NextResponse.json(rpcResult(body.id, result));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return NextResponse.json(
            rpcResult(body.id, {
              isError: true,
              content: [{ type: "text", text: message }],
            })
          );
        }
      }

      default:
        return NextResponse.json(
          rpcError(body.id, -32601, `Method not found: ${body.method}`)
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(rpcError(body.id, -32603, message));
  }
}

// MCP Streamable HTTP lets the client DELETE the endpoint with an
// Mcp-Session-Id to explicitly terminate a session. The spec says the
// server MAY respond 405, but Claude.ai's connector client chokes on
// 405 (same failure mode as GET — wraps it in an Anthropic error
// envelope). We're stateless (no Mcp-Session-Id tracking), so DELETE
// is always a no-op — return 204 to keep the client happy.
export async function DELETE() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: Request) {
  // MCP Streamable HTTP allows an optional server-push SSE stream. The spec
  // says a server MAY return 405, but the Claude.ai connector client chokes
  // on it (surfaces as an "invalid_request_error: Method Not Allowed"
  // wrapped in Anthropic's error envelope). So we open an empty event
  // stream: auth-gated like POST, sends a single SSE comment + a tools
  // list_changed notification, then stays open with heartbeats.
  const service = createServiceClient();
  const auth = await resolveBearerToken(
    service,
    request.headers.get("authorization")
  );
  if (!auth) return unauthorized(request);
  if (auth.scope !== "frogo:curate") return unauthorized(request);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // SSE comment line — a valid "hello" that doesn't trigger any event
      // handler on the client but does flush headers and open the stream.
      controller.enqueue(encoder.encode(": connected\n\n"));
      // Push a tools/list_changed notification on every connect. Vercel
      // cycles function instances on deploy, which kills SSE streams; when
      // the client reconnects, this notification tells it to re-fetch
      // tools/list and pick up any newly registered tools without the user
      // having to manually disconnect/reconnect the connector.
      const notification = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/tools/list_changed",
      });
      controller.enqueue(encoder.encode(`data: ${notification}\n\n`));
      // Heartbeat every 15s so intermediaries (Vercel's edge, load balancers)
      // don't idle-close the connection. Cleanup when client disconnects.
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(interval);
        }
      }, 15_000);
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
