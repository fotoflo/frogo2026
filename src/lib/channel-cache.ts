import { revalidateTag } from "next/cache";
import { CHANNELS_TAG } from "@/lib/channel-tree";
import { VIDEOS_TAG } from "@/lib/channel-videos";

// Single entry point for mutation routes. Busts both cached layers so the
// next read rebuilds from Postgres. Cheap — it's just marking entries stale.
export function invalidateChannelData() {
  revalidateTag(CHANNELS_TAG, "default");
  revalidateTag(VIDEOS_TAG, "default");
}
