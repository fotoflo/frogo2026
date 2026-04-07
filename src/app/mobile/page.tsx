import Link from "next/link";
import { createServiceClient } from "@/lib/supabase";

async function getChannels() {
  const supabase = createServiceClient();
  const { data: channels } = await supabase
    .from("channels")
    .select("*, videos(count)")
    .order("name");
  return channels ?? [];
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
        {channels.map((channel: any) => (
          <Link
            key={channel.id}
            href={`/mobile/channel/${channel.slug}`}
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
