import { buildChannelPath, findChannelByPath } from "@/lib/channel-paths";
import { getChannelTree, type ChannelNode } from "@/lib/channel-tree";
import { getChannelVideos, type CachedVideo } from "@/lib/channel-videos";

export interface ChannelWithVideos {
  id: string;
  slug: string;
  parent_id: string | null;
  path: string[];
  name: string;
  icon: string;
  description: string;
  videos: CachedVideo[];
}

function toChannelWithVideos(
  node: ChannelNode,
  tree: ChannelNode[],
  videos: CachedVideo[]
): ChannelWithVideos {
  return {
    id: node.id,
    slug: node.slug,
    parent_id: node.parent_id,
    path: buildChannelPath(node, tree),
    name: node.name,
    icon: node.icon,
    description: node.description,
    videos,
  };
}

// Reads the cached tree, resolves the target channel, then fetches videos for
// every channel in parallel — but each per-channel fetch hits unstable_cache,
// so warm channels return in ~10ms and only the first render of each one pays
// the oEmbed cost.
export async function getAllChannelData(pathSegments: string[]) {
  const tree = await getChannelTree();
  if (!tree.length) return null;

  const initialChannel =
    pathSegments.length === 0
      ? tree.find((c) => c.parent_id === null)
      : findChannelByPath(pathSegments, tree);

  if (!initialChannel) return null;

  const channelsWithVideos = await Promise.all(
    tree.map(async (node) => {
      const videos = await getChannelVideos(node.id);
      return toChannelWithVideos(node, tree, videos);
    })
  );

  const initialIndex = channelsWithVideos.findIndex(
    (c) => c.id === initialChannel.id
  );

  return { channels: channelsWithVideos, initialIndex };
}
