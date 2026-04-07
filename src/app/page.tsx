import Link from "next/link";
import Image from "next/image";
import { createServiceClient } from "@/lib/supabase";

async function getChannelsWithFirstVideo() {
  const supabase = createServiceClient();
  const { data: channels } = await supabase
    .from("channels")
    .select("*, videos(count)")
    .order("name");

  if (!channels) return [];

  // Get first video per channel for thumbnails
  const enriched = await Promise.all(
    channels.map(async (ch: any) => {
      const { data: firstVideo } = await supabase
        .from("videos")
        .select("id, youtube_id, title, thumbnail_url")
        .eq("channel_id", ch.id)
        .order("position")
        .limit(1)
        .single();
      return { ...ch, firstVideo };
    })
  );

  return enriched;
}

export default async function Home() {
  const channels = await getChannelsWithFirstVideo();

  // Pick a featured video from the first channel that has one
  const featured = channels.find((c: any) => c.firstVideo)?.firstVideo;
  const featuredChannel = channels.find((c: any) => c.firstVideo);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Hero */}
      <div className="mb-12 animate-fade-up">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          frogo.tv
        </h1>
        <p className="text-lg text-muted max-w-xl mb-8">
          Curated video channels for learning and fun. Pair your phone as a
          remote and watch on the big screen.
        </p>

        {featured && featuredChannel && (
          <Link
            href={`/watch/${featuredChannel.slug}/${featured.id}`}
            className="group block rounded-xl overflow-hidden border border-card-border hover:border-accent/50 transition-all"
          >
            <div className="relative aspect-video max-h-80">
              <Image
                src={featured.thumbnail_url}
                alt={featured.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 900px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-xs text-accent font-medium uppercase tracking-wider">
                  {featuredChannel.icon} {featuredChannel.name}
                </span>
                <h2 className="text-xl font-bold mt-1 group-hover:text-accent transition-colors">
                  {featured.title}
                </h2>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 rounded-full bg-accent/90 flex items-center justify-center">
                  <span className="text-white text-2xl ml-1">▶</span>
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Channel Grid */}
      <h2 className="text-xl font-semibold mb-4">Channels</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel: any, i: number) => (
          <Link
            key={channel.id}
            href={`/channel/${channel.slug}`}
            className={`group rounded-xl border border-card-border bg-card-bg overflow-hidden hover:border-accent/50 hover:bg-accent/5 transition-all animate-fade-up delay-${Math.min(i + 1, 5)}`}
          >
            {channel.firstVideo && (
              <div className="relative h-32 bg-black">
                <Image
                  src={channel.firstVideo.thumbnail_url}
                  alt={channel.name}
                  fill
                  className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{channel.icon}</span>
                <h3 className="font-semibold group-hover:text-accent transition-colors">
                  {channel.name}
                </h3>
              </div>
              <p className="text-xs text-muted line-clamp-2 mb-2">
                {channel.description}
              </p>
              <span className="text-xs text-muted">
                {channel.videos?.[0]?.count ?? 0} videos
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-12 text-center py-8 border-t border-card-border">
        <p className="text-muted mb-4">
          Have a TV nearby? Pair your phone as a remote.
        </p>
        <Link
          href="/pair"
          className="inline-block rounded-xl bg-accent hover:bg-accent-hover text-white font-medium px-8 py-3 transition-colors"
        >
          Pair Remote
        </Link>
      </div>
    </div>
  );
}
