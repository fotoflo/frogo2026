/**
 * Shared types + helper for defining MCP tools.
 *
 * Each tool module exports a `Tool<TArgs>` (built via `defineTool`) which
 * pairs a JSON-Schema-described `definition` with a strongly-typed `handler`.
 * The registry assembles all tools into a single dispatcher.
 */
import type { createServiceClient } from "@/lib/supabase";
import type { ResolvedToken } from "@/lib/mcp-auth";

export type Service = ReturnType<typeof createServiceClient>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface Tool<TArgs = Record<string, unknown>> {
  definition: ToolDefinition;
  handler: (
    service: Service,
    auth: ResolvedToken,
    args: TArgs
  ) => Promise<ToolResult>;
}

export function defineTool<TArgs>(t: Tool<TArgs>): Tool<TArgs> {
  return t;
}
