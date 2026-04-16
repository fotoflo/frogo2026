/**
 * Helpers shared across MCP tool implementations:
 *   - slugify          — derive a URL slug from arbitrary user input
 *   - textContent      — wrap a plain string as an MCP tool result
 *   - jsonContent      — wrap a JSON-serializable value as an MCP tool result
 *   - ownedChannels    — fetch the authenticated user's channels (sorted)
 *   - requireOwnership — assert the caller owns a given channel id
 */
import type { Service } from "./tool";

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function textContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function jsonContent(value: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(value, null, 2) },
    ],
  };
}

export async function ownedChannels(service: Service, userId: string) {
  const { data, error } = await service
    .from("channels")
    .select("id, name, slug, description, icon, parent_id, position")
    .eq("owner_id", userId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function requireOwnership(
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
