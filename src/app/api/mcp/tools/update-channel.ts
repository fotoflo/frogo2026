/**
 * update_channel — partial update of an owned channel. Supports renaming,
 * slug edits, and reparenting (with cycle protection).
 */
import { defineTool } from "../lib/tool";
import { jsonContent, ownedChannels, slugify } from "../lib/shared";
import {
  buildChannelPath,
  descendantIds,
  findChannelByPath,
  type ChannelLike,
} from "@/lib/channel-paths";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { invalidateChannelData } from "@/lib/channel-cache";

interface Args {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  parent_id?: string | null;
  parent_path?: string;
}

export const updateChannel = defineTool<Args>({
  definition: {
    name: "update_channel",
    description:
      "Update an existing owned channel. Any omitted field is left unchanged. Passing `parent_id: null` (or `parent_path: ''`) moves the channel back to the root. Reparenting is validated against the tree — a channel can't become a descendant of itself.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Channel uuid to update" },
        name: { type: "string", description: "New display name" },
        slug: {
          type: "string",
          description:
            "New URL slug. Lowercased, a-z0-9 and hyphens only. Must be unique among siblings.",
        },
        description: { type: "string", description: "New description" },
        icon: { type: "string", description: "New icon (emoji or short string)" },
        parent_id: {
          type: ["string", "null"],
          description:
            "New parent channel uuid. Pass `null` to move to the root. Mutually exclusive with parent_path.",
        },
        parent_path: {
          type: "string",
          description:
            "New parent channel URL path like 'business/startups'. Pass an empty string to move to the root. Mutually exclusive with parent_id.",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    if (!args.id) throw new Error("`id` is required");
    if (args.parent_id !== undefined && args.parent_path !== undefined) {
      throw new Error("Provide either `parent_id` or `parent_path`, not both");
    }

    const owned = await ownedChannels(service, auth.userId);
    const all = owned as unknown as ChannelLike[];
    const target = owned.find((c) => c.id === args.id);
    if (!target) throw new Error("Channel not found or not owned by you");

    // Build the update payload from only the fields the caller supplied.
    const update: Record<string, unknown> = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("`name` cannot be empty");
      update.name = name;
    }

    if (args.slug !== undefined) {
      const slug = slugify(args.slug);
      if (!slug) throw new Error("Could not derive a valid slug");
      if (isReservedSlug(slug)) {
        throw new Error(`Slug "${slug}" is reserved`);
      }
      update.slug = slug;
    }

    if (args.description !== undefined) {
      update.description = args.description.trim();
    }

    if (args.icon !== undefined) {
      const icon = args.icon.trim();
      update.icon = icon || "📺";
    }

    // Resolve new parent (if the caller is reparenting).
    let newParentId: string | null | undefined;
    if (args.parent_id !== undefined) {
      if (args.parent_id === null) {
        newParentId = null;
      } else {
        const hit = owned.find((c) => c.id === args.parent_id);
        if (!hit) throw new Error("Parent channel not found or not owned by you");
        newParentId = hit.id;
      }
    } else if (args.parent_path !== undefined) {
      const segments = args.parent_path.split("/").filter(Boolean);
      if (segments.length === 0) {
        newParentId = null;
      } else {
        const resolved = findChannelByPath(segments, all);
        if (!resolved) {
          throw new Error(`Parent path '${args.parent_path}' not found`);
        }
        newParentId = resolved.id;
      }
    }

    if (newParentId !== undefined) {
      // Reject cycles: a channel can't be reparented under itself or any of
      // its descendants. `descendantIds` walks the subtree from target down.
      if (newParentId !== null) {
        const forbidden = descendantIds(target.id, all);
        if (forbidden.has(newParentId)) {
          throw new Error(
            "Cannot move a channel under itself or one of its descendants"
          );
        }
      }
      update.parent_id = newParentId;
    }

    if (Object.keys(update).length === 0) {
      throw new Error("No fields to update — provide at least one of name, slug, description, icon, parent_id, parent_path");
    }

    const { data, error } = await service
      .from("channels")
      .update(update)
      .eq("id", target.id)
      .eq("owner_id", auth.userId)
      .select("id, name, slug, description, icon, parent_id, position")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Error(
          `A channel with that slug already exists under the target parent`
        );
      }
      throw new Error(error.message);
    }

    // Rebuild path using the post-update tree.
    const afterOwned = await ownedChannels(service, auth.userId);
    const path = buildChannelPath(
      data as ChannelLike,
      afterOwned as unknown as ChannelLike[]
    ).join("/");

    invalidateChannelData();

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
