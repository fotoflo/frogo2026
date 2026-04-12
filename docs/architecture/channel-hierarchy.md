# Channel Hierarchy & Directory Navigation

Channels form a tree via the `parent_id` column. A channel with `parent_id = null` sits at the root; a channel whose `parent_id` points to another channel is nested underneath it. The TV player scopes navigation (up/down arrows, number keys, phone remote) to siblings within the viewer's current directory level, and a breadcrumb trail lets the viewer jump between levels.

## Key Files

- `src/lib/channel-paths.ts` — pure functions over an in-memory channel list. Builds URL paths, resolves paths back to channels, and provides tree queries (`getSiblingsAt`, `getAncestors`, `hasChildren`, `descendantIds`).
- `src/lib/channel-paths.test.ts` — unit tests for the tree helpers.
- `src/app/watch/[...slug]/page.tsx` — server component. The `[...slug]` catch-all resolves multi-segment paths (e.g. `/watch/business/startups`) by walking the tree via `findChannelByPath`. Computes `path` (root-to-leaf slug array) for every channel before passing them to the client.
- `src/app/watch/[...slug]/TVClient.tsx` — client component. Maintains `scopeId` state that tracks which directory the viewer is browsing. Derives `siblings`, `ancestors`, and `siblingIdx` via the channel-paths helpers.
- `src/components/ClassicHUD.tsx` — renders the breadcrumb trail, directory navigator (left panel), and scoped channel grid (right panel) when the HUD is expanded.

## Data Model

```
channels
  id          uuid PK
  slug        text          -- unique among siblings (same parent_id)
  parent_id   uuid FK → channels(id) ON DELETE SET NULL
  owner_id    uuid FK → auth.users(id)
  name        text
  icon        text
  position    int           -- sort order among siblings
```

A channel's full URL path is built by walking `parent_id` up to the root and collecting slugs in order: `["business", "startups"]` becomes `/watch/business/startups`.

There is no separate "folder" entity. A channel that has children acts as a folder in the HUD directory navigator, but it can also have its own playlist. When the viewer tunes to a channel that has children, the scope enters that channel (the grid shows its children). When tuning to a leaf channel, the scope stays at its parent.

## Data Flow

### Server Side (page load)

1. The `[...slug]` server component fetches all channels via the service client.
2. It calls `findChannelByPath(slugSegments, allChannels)` to resolve the URL to a specific channel.
3. For each channel, it computes `path: string[]` via `buildChannelPath` and attaches it to the channel data.
4. The full channel list (with paths) is passed to `TVClient` as a prop.

### Client Side (navigation)

1. `TVClient` initializes `scopeId` based on the landing channel: if it has children, `scopeId = channel.id`; otherwise `scopeId = channel.parent_id`.
2. `siblings` is derived via `getSiblingsAt(scopeId, channels)` — all channels sharing that parent.
3. `ancestors` is derived via `getAncestors(scopeId, channels)` — the root-to-scope chain for breadcrumbs.
4. `siblingIdx` is the current channel's index within `siblings` — drives the channel number display and wrap-around navigation.

### Scope transitions

| Action | Scope change |
|---|---|
| Up/Down arrow or phone `next`/`prev` | Cycles within `siblings` at the current scope. Wraps around. |
| Number key (1-9) or phone `channel_N` | Jumps to the Nth sibling at the current scope. |
| Click a channel tile in the HUD grid | `switchChannelById(id)` — scope follows target: if target has children, scope = target; otherwise scope = target's parent. |
| Click a breadcrumb or directory entry | `onNavigateToScope(channelId)` — scope changes to the clicked ancestor; the grid redraws to show that level's children. |
| Click "Home" breadcrumb | `onNavigateToScope(null)` — scope = root. |
| `navigate_{id}` remote command | Same as clicking a tile: `switchChannelById(id)`. |

### URL bookmarkability

`switchChannelById` calls `window.history.replaceState` to update the URL to `/watch/{path segments}` without triggering a navigation. This keeps the URL shareable while channel switching stays client-side.

## Important Patterns

- **Pure functions over full channel list.** All tree helpers in `channel-paths.ts` take the complete `allChannels` array and return results without side effects. No global state, no DB calls. The server component passes the full list; the client memoizes derived values.
- **Cycle safety.** `buildChannelPath` and `getAncestors` cap their parent-walks at 32 hops and track visited IDs. A corrupted `parent_id` cycle won't cause an infinite loop.
- **`descendantIds` for reparenting safety.** Used by the MCP `update_channel` tool to prevent a channel from being moved under one of its own descendants (which would create a cycle in the tree).
- **Slug uniqueness is per-parent.** Two channels can share the same slug if they have different parents. The `findChannelByPath` resolver walks segment-by-segment, matching `slug + parent_id` at each level.
- **No separate folder type.** Whether a channel "is a folder" is determined dynamically by `hasChildren(id, allChannels)`. The HUD shows a folder icon on tiles that have sub-channels, and the directory navigator lists them as expandable entries.
- **Scope follows the target.** When a viewer jumps to a channel, the scope automatically adjusts so that Up/Down and number keys always operate within the new channel's sibling set. This prevents the disorienting situation where the viewer lands on a deeply nested channel but the number keys still control the root level.
