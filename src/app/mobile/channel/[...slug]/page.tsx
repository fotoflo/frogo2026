import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { findChannelByPath, mobileVideoHref } from "@/lib/channel-paths";

interface MobileVideo {
  id: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
}

async function getChannel(segments: string[]) {
  const supabase = createServiceClient();
  const { data: allChannels } = await supabase.from("channels").select("*");
  if (!allChannels) return null;
  const channel = findChannelByPath(segments, allChannels);
  if (!channel) return null;

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channel.id)
    .order("position");

  return { channel, videos: (videos ?? []) as MobileVideo[] };
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function MobileChannelPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const result = await getChannel(slug);
  if (!result) notFound();
  const { channel, videos } = result;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Link
        href="/mobile"
        className="text-sm text-muted mb-4 inline-block"
      >
        &larr; Channels
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{channel.icon}</span>
        <div>
          <h1 className="text-xl font-bold">{channel.name}</h1>
          <p className="text-xs text-muted">{channel.description}</p>
        </div>
      </div>

      <div className="space-y-2">
        {videos.map((video) => (
          <Link
            key={video.id}
            href={mobileVideoHref(video.id)}
            className="flex gap-3 rounded-lg border border-card-border bg-card-bg p-2 active:bg-accent/5 transition-colors"
          >
            <div className="relative shrink-0 w-28 h-16 rounded overflow-hidden bg-black">
              <Image
                src={video.thumbnail_url}
                alt={video.title}
                fill
                className="object-cover"
                sizes="112px"
              />
              <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-mono">
                {formatDuration(video.duration_seconds)}
              </span>
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <h3 className="text-sm font-medium line-clamp-2">{video.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
