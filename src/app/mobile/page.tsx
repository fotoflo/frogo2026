import Link from "next/link";
import { createServiceClient } from "@/lib/supabase";
import { mobileChannelHref } from "@/lib/channel-paths";

interface MobileChannelListItem {
  id: string;
  slug: string;
  parent_id: string | null;
  name: string;
  description: string;
  icon: string;
  videos?: { count: number }[] | null;
}

async function getChannels(): Promise<MobileChannelListItem[]> {
  const supabase = createServiceClient();
  const { data: channels } = await supabase
    .from("channels")
    .select(
      "id, slug, parent_id, name, description, icon, videos!videos_channel_id_fkey(count)"
    )
    .order("position", { ascending: true, nullsFirst: false })
    .order("name");
  return (channels as MobileChannelListItem[] | null) ?? [];
}

export default async function MobileBrowse() {
  const channels = await getChannels();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Channels</h1>
      <p className="text-sm text-muted mb-6">
        Watch here or pair with your TV
      </p>

      <div className="space-y-3">
        {channels.map((channel) => (
          <Link
            key={channel.id}
            href={mobileChannelHref(channel, channels)}
            className="flex items-center gap-4 rounded-xl border border-card-border bg-card-bg p-4 active:bg-accent/5 transition-colors"
          >
            <span className="text-3xl">{channel.icon}</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold">{channel.name}</h2>
              <p className="text-xs text-muted truncate">{channel.description}</p>
            </div>
            <span className="text-xs text-muted shrink-0">
              {channel.videos?.[0]?.count ?? 0}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/pair"
        className="block mt-8 text-center rounded-xl bg-accent hover:bg-accent-hover text-white font-medium py-4 transition-colors"
      >
        Pair with TV
      </Link>
    </div>
  );
}
