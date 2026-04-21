import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMobileRequest } from "@/lib/mobile-detect";
import { getAllChannelData } from "@/lib/channel-data";
import { firstLeafDescendant } from "@/lib/channel-paths";
import TVClient from "@/app/[...slug]/TVClient";

export const metadata: Metadata = {
  title: "Frogo.tv — Curated channels, always on",
  description:
    "Hand-picked channels looping around the clock. Pair your phone as a remote.",
  openGraph: {
    title: "Frogo.tv — Curated channels, always on",
    description:
      "Hand-picked channels looping around the clock. Pair your phone as a remote.",
    siteName: "Frogo.tv",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frogo.tv — Curated channels, always on",
    description:
      "Hand-picked channels looping around the clock. Pair your phone as a remote.",
  },
};

export default async function Home() {
  if (await isMobileRequest()) {
    redirect("/mobile");
  }

  const data = await getAllChannelData([]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen text-muted">
        No channels yet.
      </div>
    );
  }

  const initial = data.channels[data.initialIndex];
  const leaf = firstLeafDescendant(initial, data.channels);
  if (leaf.id !== initial.id) {
    redirect(`/${leaf.path.join("/")}`);
  }

  return (
    <TVClient
      channels={data.channels}
      initialChannelIndex={data.initialIndex}
    />
  );
}
