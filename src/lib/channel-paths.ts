/**
 * Channel path helpers — channels form a tree via `parent_id`, and URL paths
 * are derived by walking that tree from a channel up to its root.
 *
 * These are pure functions over an in-memory list of channels. Callers
 * should pass the full list of visible channels (e.g. the service-client
 * result for the TV page), not a filtered subset, otherwise parent lookups
 * may fail mid-walk and the helper will return a partial path.
 */

export interface ChannelLike {
  id: string;
  slug: string;
  parent_id: string | null;
}

/**
 * Build a channel's URL path as an array of slug segments, root → leaf.
 * `buildChannelPath(startups, all)` → `["business", "startups"]`
 *
 * Cycle-safe: if the parent chain loops (shouldn't happen, but DB could be
 * corrupted), we stop after 32 hops.
 */
export function buildChannelPath<C extends ChannelLike>(
  channel: C,
  allChannels: readonly C[]
): string[] {
  const byId = new Map(allChannels.map((c) => [c.id, c]));
  const segments: string[] = [];
  let current: C | undefined = channel;
  const seen = new Set<string>();
  let hops = 0;

  while (current && hops < 32) {
    if (seen.has(current.id)) break; // cycle guard
    seen.add(current.id);
    segments.unshift(current.slug);
    if (!current.parent_id) break;
    current = byId.get(current.parent_id);
    hops += 1;
  }

  return segments;
}

/**
 * Resolve a URL path (e.g. from `[...slug]` route params) to a channel.
 * Walks down the tree segment-by-segment, requiring that each segment's
 * parent matches the previous hop. Returns null if the path is invalid.
 */
export function findChannelByPath<C extends ChannelLike>(
  segments: readonly string[],
  allChannels: readonly C[]
): C | null {
  if (segments.length === 0) return null;

  let parentId: string | null = null;
  let found: C | null = null;

  for (const seg of segments) {
    const match = allChannels.find(
      (c) => c.slug === seg && (c.parent_id ?? null) === parentId
    );
    if (!match) return null;
    found = match;
    parentId = match.id;
  }

  return found;
}

/**
 * Return the set of channel ids that are descendants of `channelId`
 * (including itself). Used by the admin parent picker to prevent cycles —
 * a channel can't become a descendant of itself.
 */
export function descendantIds<C extends ChannelLike>(
  channelId: string,
  allChannels: readonly C[]
): Set<string> {
  const result = new Set<string>([channelId]);
  let frontier = [channelId];
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const parentId of frontier) {
      for (const c of allChannels) {
        if (c.parent_id === parentId && !result.has(c.id)) {
          result.add(c.id);
          nextFrontier.push(c.id);
        }
      }
    }
    frontier = nextFrontier;
  }
  return result;
}

// ─── URL builders ──────────────────────────────────────────────────────────

function joinPath(segments: string[]): string {
  return segments.join("/");
}

export function watchHref<C extends ChannelLike>(
  channel: C,
  allChannels: readonly C[]
): string {
  return `/watch/${joinPath(buildChannelPath(channel, allChannels))}`;
}

export function channelHref<C extends ChannelLike>(
  channel: C,
  allChannels: readonly C[]
): string {
  return `/channel/${joinPath(buildChannelPath(channel, allChannels))}`;
}

export function mobileWatchHref<C extends ChannelLike>(
  channel: C,
  allChannels: readonly C[]
): string {
  return `/mobile/watch/${joinPath(buildChannelPath(channel, allChannels))}`;
}

export function mobileChannelHref<C extends ChannelLike>(
  channel: C,
  allChannels: readonly C[]
): string {
  return `/mobile/channel/${joinPath(buildChannelPath(channel, allChannels))}`;
}

export function adminEditHref<C extends ChannelLike>(
  channel: C,
  allChannels: readonly C[]
): string {
  return `/admin/channels/${joinPath(buildChannelPath(channel, allChannels))}/edit`;
}

/** Video page is now slug-independent: lookup is by video id. */
export function videoHref(videoId: string): string {
  return `/v/${videoId}`;
}

export function mobileVideoHref(videoId: string): string {
  return `/mobile/v/${videoId}`;
}
