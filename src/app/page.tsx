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

export default async function Home() {
  const channels = await getChannels();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-12 animate-fade-up">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Watch Together
        </h1>
        <p className="text-lg text-muted max-w-xl">
          Curated video channels for learning and fun. Pair your phone as a
          remote and watch on the big screen.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel: any, i: number) => (
          <Link
            key={channel.id}
            href={`/channel/${channel.slug}`}
            className={`group rounded-xl border border-card-border bg-card-bg p-6 hover:border-accent/50 hover:bg-accent/5 transition-all animate-fade-up delay-${i + 1}`}
          >
            <div className="text-3xl mb-3">{channel.icon}</div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-accent transition-colors">
              {channel.name}
            </h2>
            <p className="text-sm text-muted line-clamp-2 mb-3">
              {channel.description}
            </p>
            <span className="text-xs text-muted">
              {channel.videos?.[0]?.count ?? 0} videos
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
