import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { buildChannelPath, type ChannelLike } from "@/lib/channel-paths";
import ChannelList, { type ChannelListItem } from "./ChannelList";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout guarantees user, but TS doesn't know that.
  if (!user) return null;

  const { data: channels } = await supabase
    .from("channels")
    .select(
      "id, name, slug, parent_id, description, icon, position, videos(count)"
    )
    .eq("owner_id", user.id)
    .order("position", { ascending: true, nullsFirst: false })
    .order("name");

  const all = (channels ?? []) as unknown as ChannelLike[];

  const items: ChannelListItem[] = (channels ?? []).map((ch) => ({
    id: ch.id,
    name: ch.name,
    slug: ch.slug,
    path: buildChannelPath(ch as unknown as ChannelLike, all).join("/"),
    description: ch.description,
    icon: ch.icon,
    videoCount:
      (ch.videos as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your channels</h1>
          {items.length > 0 && (
            <p className="text-sm text-neutral-500 mt-1">
              Drag to reorder — the number is the channel number viewers press
              on the remote
            </p>
          )}
        </div>
        <Link
          href="/admin/channels/new"
          className="px-4 py-2 rounded bg-white text-black font-medium hover:bg-white/90 transition"
        >
          + New channel
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-800 p-12 text-center text-neutral-400">
          <p>You don&apos;t own any channels yet.</p>
          <p className="text-sm mt-1">
            Create one above, or ask an admin to transfer ownership of an
            existing channel.
          </p>
        </div>
      ) : (
        <ChannelList initialChannels={items} />
      )}
    </div>
  );
}
