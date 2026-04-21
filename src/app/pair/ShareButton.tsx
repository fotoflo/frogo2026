"use client";

import type { RemoteState } from "./useRemoteState";

interface ShareButtonProps {
  state: RemoteState;
}

export default function ShareButton({ state }: ShareButtonProps) {
  const { video, channel, playbackPosition } = state;

  if (!video || !channel) return null;

  async function handleShare() {
    const seconds = Math.floor(playbackPosition);
    const url = `${window.location.origin}/${channel!.slug}?v=${video!.youtube_id}&t=${seconds}`;
    const text = `${video!.title} on ${channel!.icon} ${channel!.name}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        // User cancelled or not supported, fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      // Would show toast but we don't have access here - parent handles
    } catch {
      // Fallback: do nothing
    }
  }

  return (
    <button
      onClick={handleShare}
      className="shrink-0 text-white/30 hover:text-white/60 transition-colors touch-manipulation"
      aria-label="Share this moment"
      title="Share"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    </button>
  );
}
