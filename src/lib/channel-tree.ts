import { unstable_cache, revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase";

export interface ChannelNode {
  id: string;
  slug: string;
  parent_id: string | null;
  name: string;
  icon: string;
  description: string;
  position: number | null;
}

export const CHANNELS_TAG = "channels";

// Lightweight channel metadata only — no videos. A few KB for the whole tree,
// shared across every page render until a mutation busts the tag.
export const getChannelTree = unstable_cache(
  async (): Promise<ChannelNode[]> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("channels")
      .select("id, slug, parent_id, name, icon, description, position")
      .order("position", { ascending: true, nullsFirst: false })
      .order("name");
    return (data ?? []) as ChannelNode[];
  },
  ["channel-tree"],
  { tags: [CHANNELS_TAG] }
);

// Call from any mutation route after a successful channels-table write.
export function invalidateChannelTree() {
  revalidateTag(CHANNELS_TAG, "default");
}
