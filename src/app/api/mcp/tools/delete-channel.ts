/**
 * delete_channel — delete an owned channel + its videos. If the channel
 * has sub-channels, requires `force: true`; sub-channels are then promoted
 * to the root via the FK's ON DELETE SET NULL behavior.
 */
import { defineTool } from "../lib/tool";
import { ownedChannels, textContent } from "../lib/shared";

interface Args {
  id?: string;
  force?: boolean;
}

export const deleteChannel = defineTool<Args>({
  definition: {
    name: "delete_channel",
    description:
      "Delete an owned channel and all of its videos. If the channel has sub-channels, the call is rejected unless `force: true` is passed — in which case the sub-channels are promoted to top-level (their parent_id becomes null). Use `list_channels` first to see what you're about to affect.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Channel uuid to delete" },
        force: {
          type: "boolean",
          description:
            "Required when the channel has sub-channels. Sub-channels are then detached (parent_id → null), not deleted.",
        },
      },
      additionalProperties: false,
    },
  },
  async handler(service, auth, args) {
    if (!args.id) throw new Error("`id` is required");

    const owned = await ownedChannels(service, auth.userId);
    const target = owned.find((c) => c.id === args.id);
    if (!target) throw new Error("Channel not found or not owned by you");

    const children = owned.filter((c) => c.parent_id === target.id);
    if (children.length > 0 && !args.force) {
      throw new Error(
        `Channel '${target.name}' has ${children.length} sub-channel${children.length === 1 ? "" : "s"}. ` +
          `Pass \`force: true\` to delete it — sub-channels will be promoted to the root (their parent_id is set to null).`
      );
    }

    // The ON DELETE SET NULL FK on channels.parent_id handles the promotion
    // automatically when we delete the row. Videos cascade via ON DELETE
    // CASCADE, so we don't need to delete them separately.
    const { error } = await service
      .from("channels")
      .delete()
      .eq("id", target.id)
      .eq("owner_id", auth.userId);
    if (error) throw new Error(error.message);

    const promoted = children.length;
    return textContent(
      promoted > 0
        ? `Deleted '${target.name}'. Promoted ${promoted} sub-channel${promoted === 1 ? "" : "s"} to the root.`
        : `Deleted '${target.name}'.`
    );
  },
});
