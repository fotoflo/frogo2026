import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  buildChannelPath,
  descendantIds,
  findChannelByPath,
  type ChannelLike,
} from "@/lib/channel-paths";
import { requireAdmin } from "@/lib/admin-auth";
import ChannelEditor, { type ParentOption } from "./ChannelEditor";

export const dynamic = "force-dynamic";

export default async function EditChannelPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug: segments } = await params;
  const { supabase, user, profile } = await requireAdmin();

  // Pull every visible channel (all for god_mode, owned otherwise) so we can
  // resolve the path AND build the parent picker options in one round-trip.
  let visibleQuery = supabase
    .from("channels")
    .select("id, name, slug, description, icon, parent_id, owner_id");
  if (!profile.god_mode) {
    visibleQuery = visibleQuery.eq("owner_id", user.id);
  }
  const { data: visibleChannels } = await visibleQuery;

  const all = (visibleChannels ?? []) as ChannelLike[];
  const resolved = findChannelByPath(segments, all);
  if (!resolved) notFound();

  const channel = (visibleChannels ?? []).find((c) => c.id === resolved.id);
  if (!channel) notFound();
  if (!profile.god_mode && channel.owner_id !== user.id) redirect("/admin");

  const { data: videos } = await supabase
    .from("videos")
    .select(
      "id, channel_id, youtube_id, title, thumbnail_url, duration_seconds, start_seconds, end_seconds, position"
    )
    .eq("channel_id", channel.id)
    .order("position");

  // Parent candidates = all visible channels except the channel itself and
  // its descendants (those would create a cycle).
  const forbidden = descendantIds(channel.id, all);
  const parentOptions: ParentOption[] = (visibleChannels ?? [])
    .filter((c) => !forbidden.has(c.id))
    .map((c) => ({
      id: c.id,
      label: buildChannelPath(c as ChannelLike, all).join(" / "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-neutral-400 hover:text-white"
        >
          ← All channels
        </Link>
      </div>

      <ChannelEditor
        channel={channel}
        initialVideos={videos ?? []}
        parentOptions={parentOptions}
      />
    </div>
  );
}
