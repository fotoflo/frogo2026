/**
 * MCP Streamable HTTP endpoint.
 *
 *   POST /api/mcp        — JSON-RPC 2.0 requests from MCP clients
 *   GET  /api/mcp        — optional SSE channel (not used; we return 405)
 *
 * Protocol: https://spec.modelcontextprotocol.io (2025-06-18 revision).
 * Auth:     Bearer token minted by /api/oauth/token. On 401 we return the
 *           WWW-Authenticate header required by the MCP auth spec so clients
 *           can discover the OAuth AS.
 *
 * Tools exposed (scope `frogo:curate`):
 *   list_channels       — user's owned channels with path + video count
 *   get_channel         — one channel + its playlist
 *   add_video           — append a YouTube URL to a channel's playlist
 *   delete_video        — remove a video from a playlist
 *   reorder_videos      — set a channel's playlist order
 *
 * All tool calls are scoped to the authenticated user via owner_id. The
 * service client is used because token lookup needs bypass RLS, but tool
 * mutations still filter by user_id.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveBearerToken, getIssuer, type ResolvedToken } from "@/lib/mcp-auth";
import { fetchVideoMeta } from "@/lib/youtube-meta";
import { buildChannelPath, type ChannelLike } from "@/lib/channel-paths";

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

// ─── Tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_channels",
    description:
      "List all channels owned by the authenticated user, with full URL path and video counts.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_channel",
    description:
      "Get one owned channel by id, slug, or URL path (e.g. 'business/startups'), including its ordered playlist.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Channel uuid" },
        path: {
          type: "string",
          description: "URL path like 'business/startups' or just 'jazz'",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "add_video",
    description:
      "Append a YouTube video to a channel's playlist. Accepts any YouTube URL or bare video id. Title + duration are fetched automatically.",
    inputSchema: {
      type: "object",
      required: ["channel_id", "url"],
      properties: {
        channel_id: { type: "string", description: "Target channel uuid" },
        url: { type: "string", description: "YouTube URL or video id" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "delete_video",
    description: "Remove a video from its channel's playlist.",
    inputSchema: {
      type: "object",
      required: ["video_id"],
      properties: {
        video_id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "reorder_videos",
    description:
      "Set the playlist order of a channel. Pass the channel id and an ordered array of video ids. Any videos not in the list are left at the end in their current order.",
    inputSchema: {
      type: "object",
      required: ["channel_id", "ordered_video_ids"],
      properties: {
        channel_id: { type: "string" },
        ordered_video_ids: {
          type: "array",
          items: { type: "string" },
        },
      },
      additionalProperties: false,
    },
  },
] as const;

// ─── Tool implementations ──────────────────────────────────────────────────

type Service = ReturnType<typeof createServiceClient>;

function textContent(text: string) {
  return { content: [{ type: "text", text }] };
}

function jsonContent(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

async function ownedChannels(service: Service, userId: string) {
  const { data, error } = await service
    .from("channels")
    .select("id, name, slug, description, icon, parent_id, position")
    .eq("owner_id", userId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function toolListChannels(service: Service, auth: ResolvedToken) {
  const channels = await ownedChannels(service, auth.userId);
  const all = channels as unknown as ChannelLike[];

  // Pull video counts in one query.
  const { data: counts, error: countErr } = await service
    .from("videos")
    .select("channel_id")
    .in(
      "channel_id",
      channels.map((c) => c.id)
    );
  if (countErr) throw new Error(countErr.message);

  const countByChannel = new Map<string, number>();
  for (const row of counts ?? []) {
    countByChannel.set(row.channel_id, (countByChannel.get(row.channel_id) ?? 0) + 1);
  }

  const result = channels.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    path: buildChannelPath(c as ChannelLike, all).join("/"),
    description: c.description,
    icon: c.icon,
    parent_id: c.parent_id,
    position: c.position,
    video_count: countByChannel.get(c.id) ?? 0,
  }));

  return jsonContent(result);
}

async function toolGetChannel(
  service: Service,
  auth: ResolvedToken,
  args: { id?: string; path?: string }
) {
  if (!args.id && !args.path) {
    throw new Error("Must provide either `id` or `path`");
  }
  const channels = await ownedChannels(service, auth.userId);
  const all = channels as unknown as ChannelLike[];

  let channel: (typeof channels)[number] | undefined;
  if (args.id) {
    channel = channels.find((c) => c.id === args.id);
  } else if (args.path) {
    const segments = args.path.split("/").filter(Boolean);
    const { findChannelByPath } = await import("@/lib/channel-paths");
    const resolved = findChannelByPath(segments, all);
    if (resolved) channel = channels.find((c) => c.id === resolved.id);
  }
  if (!channel) throw new Error("Channel not found or not owned by you");

  const { data: videos, error: vErr } = await service
    .from("videos")
    .select(
      "id, youtube_id, title, thumbnail_url, duration_seconds, start_seconds, end_seconds, position"
    )
    .eq("channel_id", channel.id)
    .order("position");
  if (vErr) throw new Error(vErr.message);

  return jsonContent({
    id: channel.id,
    name: channel.name,
    slug: channel.slug,
    path: buildChannelPath(channel as ChannelLike, all).join("/"),
    description: channel.description,
    icon: channel.icon,
    parent_id: channel.parent_id,
    videos: videos ?? [],
  });
}

async function requireOwnership(
  service: Service,
  userId: string,
  channelId: string
) {
  const { data, error } = await service
    .from("channels")
    .select("id")
    .eq("id", channelId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Channel not found or not owned by you");
}

async function toolAddVideo(
  service: Service,
  auth: ResolvedToken,
  args: { channel_id: string; url: string }
) {
  await requireOwnership(service, auth.userId, args.channel_id);

  const meta = await fetchVideoMeta(args.url);
  if (!meta) throw new Error("Could not fetch YouTube metadata for that URL");

  const { data: last } = await service
    .from("videos")
    .select("position")
    .eq("channel_id", args.channel_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (last?.position ?? 0) + 1;

  const { data, error } = await service
    .from("videos")
    .insert({
      channel_id: args.channel_id,
      youtube_id: meta.youtubeId,
      title: meta.title,
      description: "",
      thumbnail_url: `https://img.youtube.com/vi/${meta.youtubeId}/mqdefault.jpg`,
      duration_seconds: meta.durationSeconds,
      position: nextPosition,
    })
    .select("id, title, position")
    .single();
  if (error) throw new Error(error.message);

  return textContent(
    `Added "${data.title}" at position ${data.position} (video id ${data.id}).`
  );
}

async function toolDeleteVideo(
  service: Service,
  auth: ResolvedToken,
  args: { video_id: string }
) {
  const { data: video, error } = await service
    .from("videos")
    .select("id, channel_id, title")
    .eq("id", args.video_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!video) throw new Error("Video not found");
  await requireOwnership(service, auth.userId, video.channel_id);

  const { error: delErr } = await service
    .from("videos")
    .delete()
    .eq("id", args.video_id);
  if (delErr) throw new Error(delErr.message);

  return textContent(`Deleted "${video.title}".`);
}

async function toolReorderVideos(
  service: Service,
  auth: ResolvedToken,
  args: { channel_id: string; ordered_video_ids: string[] }
) {
  await requireOwnership(service, auth.userId, args.channel_id);

  const { data: existing, error } = await service
    .from("videos")
    .select("id")
    .eq("channel_id", args.channel_id);
  if (error) throw new Error(error.message);

  const existingIds = new Set((existing ?? []).map((v) => v.id));
  const seen = new Set<string>();
  const finalOrder: string[] = [];

  for (const id of args.ordered_video_ids) {
    if (!existingIds.has(id)) {
      throw new Error(`Video ${id} does not belong to this channel`);
    }
    if (!seen.has(id)) {
      seen.add(id);
      finalOrder.push(id);
    }
  }
  // Append any videos not mentioned in the list, in their current order.
  for (const v of existing ?? []) {
    if (!seen.has(v.id)) finalOrder.push(v.id);
  }

  const updates = finalOrder.map((id, idx) =>
    service
      .from("videos")
      .update({ position: idx + 1 })
      .eq("id", id)
      .eq("channel_id", args.channel_id)
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r.error)?.error;
  if (firstErr) throw new Error(firstErr.message);

  return textContent(
    `Reordered ${finalOrder.length} video${finalOrder.length === 1 ? "" : "s"}.`
  );
}

// ─── Tool dispatcher ───────────────────────────────────────────────────────

async function callTool(
  service: Service,
  auth: ResolvedToken,
  name: string,
  rawArgs: unknown
) {
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  switch (name) {
    case "list_channels":
      return toolListChannels(service, auth);
    case "get_channel":
      return toolGetChannel(service, auth, args as { id?: string; path?: string });
    case "add_video":
      return toolAddVideo(service, auth, args as { channel_id: string; url: string });
    case "delete_video":
      return toolDeleteVideo(service, auth, args as { video_id: string });
    case "reorder_videos":
      return toolReorderVideos(
        service,
        auth,
        args as { channel_id: string; ordered_video_ids: string[] }
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Request handler ───────────────────────────────────────────────────────

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
            capabilities: { tools: { listChanged: false } },
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
  // stream: auth-gated like POST, sends a single SSE comment to establish
  // the connection, then stays silent — we have no notifications to push.
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
