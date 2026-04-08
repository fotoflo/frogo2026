import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { isMobileRequest } from "@/lib/mobile-detect";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data: channel } = await supabase
    .from("channels")
    .select("name, icon, description")
    .eq("slug", slug)
    .single();

  if (!channel) return {};

  const title = `${channel.icon} ${channel.name} — Frogo.tv`;
  const description = channel.description || `${channel.name} channel on Frogo.tv`;

  return {
    title,
    description,
    openGraph: { title, description, siteName: "Frogo.tv" },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function getChannel(slug: string) {
  const supabase = createServiceClient();
  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!channel) return null;

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channel.id)
    .order("position");

  return { ...channel, videos: videos ?? [] };
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (await isMobileRequest()) {
    redirect(`/mobile/channel/${slug}`);
  }
  const channel = await getChannel(slug);
  if (!channel) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted hover:text-foreground transition-colors mb-6 inline-block"
      >
        &larr; All Channels
      </Link>

      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{channel.icon}</span>
          <h1 className="text-3xl font-bold tracking-tight">{channel.name}</h1>
        </div>
        <p className="text-muted max-w-xl mb-4">{channel.description}</p>
        {channel.videos.length > 0 && (
          <Link
            href={`/watch/${channel.slug}/${channel.videos[0].id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium px-6 py-3 transition-colors"
          >
            <span>▶</span> Play All
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {channel.videos.map((video: any, i: number) => (
          <Link
            key={video.id}
            href={`/watch/${channel.slug}/${video.id}`}
            className={`group flex gap-4 rounded-lg border border-card-border bg-card-bg p-3 hover:border-accent/50 hover:bg-accent/5 transition-all animate-fade-up delay-${Math.min(i + 1, 5)}`}
          >
            <div className="relative shrink-0 w-40 h-24 rounded-md overflow-hidden bg-black">
              <Image
                src={video.thumbnail_url}
                alt={video.title}
                fill
                className="object-cover"
                sizes="160px"
              />
              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                {formatDuration(video.duration_seconds)}
              </span>
            </div>
            <div className="flex-1 min-w-0 py-1">
              <h3 className="font-medium text-sm group-hover:text-accent transition-colors line-clamp-2">
                {video.title}
              </h3>
              <p className="text-xs text-muted mt-1 line-clamp-2">
                {video.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
