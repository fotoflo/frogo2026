/**
 * create_channel — create a new owned channel, optionally nested under a
 * parent (resolved by id or URL path).
 */
import { defineTool } from "../lib/tool";
import { jsonContent, ownedChannels, slugify } from "../lib/shared";
import {
  buildChannelPath,
  findChannelByPath,
  type ChannelLike,
} from "@/lib/channel-paths";
import { isReservedSlug } from "@/lib/reserved-slugs";

interface Args {
  name?: string;
  description?: string;
  icon?: string;
  slug?: string;
  parent_id?: string;
  parent_path?: string;
}

export const createChannel = defineTool<Args>({
  definition: {
    name: "create_channel",
    description:
      "Create a new channel owned by the authenticated user. Optionally nest it under a parent channel by id or URL path. Slug is derived from the name if not provided.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Display name of the channel" },
        description: { type: "string", description: "Short description" },
        icon: {
          type: "string",
          description: "Single emoji or short icon string (defaults to 📺)",
        },
        slug: {
          type: "string",
          description:
            "URL slug override. If omitted, derived from the name. Lowercased, a-z0-9 and hyphens only.",
        },
        parent_id: {
          type: "string",
          description: "Parent channel uuid (mutually exclusive with parent_path)",
        },
        parent_path: {
          type: "string",
          description:
            "Parent channel URL path like 'business' or 'business/startups' (mutually exclusive with parent_id)",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    const name = (args.name ?? "").trim();
    if (!name) throw new Error("`name` is required");
    if (args.parent_id && args.parent_path) {
      throw new Error("Provide either `parent_id` or `parent_path`, not both");
    }

    // Resolve parent (must also be owned by the user).
    let parentId: string | null = null;
    if (args.parent_id || args.parent_path) {
      const owned = await ownedChannels(service, auth.userId);
      if (args.parent_id) {
        const hit = owned.find((c) => c.id === args.parent_id);
        if (!hit) throw new Error("Parent channel not found or not owned by you");
        parentId = hit.id;
      } else if (args.parent_path) {
        const segments = args.parent_path.split("/").filter(Boolean);
        const resolved = findChannelByPath(
          segments,
          owned as unknown as ChannelLike[]
        );
        if (!resolved) {
          throw new Error(`Parent path '${args.parent_path}' not found`);
        }
        parentId = resolved.id;
      }
    }

    const slug = args.slug ? slugify(args.slug) : slugify(name);
    if (!slug) throw new Error("Could not derive a valid slug from the name");
    if (isReservedSlug(slug)) {
      throw new Error(`Slug "${slug}" is reserved`);
    }

    const icon = (args.icon ?? "").trim() || "📺";
    const description = (args.description ?? "").trim();

    const { data, error } = await service
      .from("channels")
      .insert({
        name,
        slug,
        description,
        icon,
        parent_id: parentId,
        owner_id: auth.userId,
      })
      .select("id, name, slug, description, icon, parent_id, position")
      .single();

    if (error) {
      // 23505 = unique_violation (slug collision under the same parent)
      if ((error as { code?: string }).code === "23505") {
        throw new Error(
          `A channel with slug '${slug}' already exists under that parent`
        );
      }
      throw new Error(error.message);
    }

    // Build the path for the response so the caller can immediately link to it.
    const allOwned = await ownedChannels(service, auth.userId);
    const path = buildChannelPath(
      data as ChannelLike,
      allOwned as unknown as ChannelLike[]
    ).join("/");

    return jsonContent({
      id: data.id,
      name: data.name,
      slug: data.slug,
      path,
      description: data.description,
      icon: data.icon,
      parent_id: data.parent_id,
    });
  },
});
