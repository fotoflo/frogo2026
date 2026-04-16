/**
 * Tool registry — single source of truth for the set of MCP tools exposed
 * by /api/mcp. Each tool module exports a `Tool` (definition + handler);
 * this file aggregates them, exposes the schema list for `tools/list`, and
 * dispatches `tools/call` to the right handler.
 */
import type { ResolvedToken } from "@/lib/mcp-auth";
import type { Service, Tool } from "./lib/tool";

import { listChannels } from "./tools/list-channels";
import { getChannel } from "./tools/get-channel";
import { createChannel } from "./tools/create-channel";
import { updateChannel } from "./tools/update-channel";
import { deleteChannel } from "./tools/delete-channel";
import { searchChannels } from "./tools/search-channels";
import { addVideo } from "./tools/add-video";
import { addVideosBulk } from "./tools/add-videos-bulk";
import { importYoutubePlaylist } from "./tools/import-youtube-playlist";
import { importYoutubeChannel } from "./tools/import-youtube-channel";
import { listVideos } from "./tools/list-videos";
import { deleteVideo } from "./tools/delete-video";
import { updateVideo } from "./tools/update-video";
import { refreshVideoMetadata } from "./tools/refresh-video-metadata";
import { reorderVideos } from "./tools/reorder-videos";
import { searchVideos } from "./tools/search-videos";
import { searchYoutubeTool } from "./tools/search-youtube";

const ALL: Tool<never>[] = [
  listChannels,
  getChannel,
  createChannel,
  updateChannel,
  deleteChannel,
  searchChannels,
  addVideo,
  addVideosBulk,
  importYoutubePlaylist,
  importYoutubeChannel,
  listVideos,
  deleteVideo,
  updateVideo,
  refreshVideoMetadata,
  reorderVideos,
  searchVideos,
  searchYoutubeTool,
] as unknown as Tool<never>[];

export const TOOLS = ALL.map((t) => t.definition);

export async function callTool(
  service: Service,
  auth: ResolvedToken,
  name: string,
  rawArgs: unknown
) {
  const tool = ALL.find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const args = (rawArgs ?? {}) as never;
  return tool.handler(service, auth, args);
}
