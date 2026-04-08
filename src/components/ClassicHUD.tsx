"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Video {
  id: string;
  youtube_id: string;
  title: string;
  description?: string;
  duration_seconds: number;
  thumbnail_url?: string;
}

interface Channel {
  id: string;
  slug: string;
  name: string;
  icon: string;
  videos: Video[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTPlayer = any;

interface ClassicHUDProps {
  channel: Channel;
  channelIdx: number;
  allChannels: Channel[];
  activeVideo: Video | null;
  currentVideoIndex: number;
  playerRef: React.RefObject<YTPlayer | null>;
  onSwitchChannel: (slug: string) => void;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  onNextVideo: () => void;
  onPrevVideo: () => void;
  onTogglePlay: () => void;
  onJumpToVideo: (index: number) => void;
}

type HUDState = "expanded" | "collapsed" | "minimized";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ClassicHUD({
  channel,
  channelIdx,
  allChannels,
  activeVideo,
  currentVideoIndex,
  playerRef,
  onSwitchChannel,
  onPrevChannel,
  onNextChannel,
  onNextVideo,
  onPrevVideo,
  onTogglePlay,
  onJumpToVideo,
}: ClassicHUDProps) {
  const [hudState, setHUDState] = useState<HUDState>("minimized");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [badThumbs, setBadThumbs] = useState<Set<string>>(new Set());

  // Progress bar state
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Poll player for progress
  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime || isScrubbing) return;
      const t = player.getCurrentTime() ?? 0;
      const d = player.getDuration() ?? 0;
      setCurrentTime(t);
      setDuration(d);
      setProgress(d > 0 ? (t / d) * 100 : 0);
    }, 500);
    return () => clearInterval(interval);
  }, [playerRef, isScrubbing]);

  // Scrub handlers
  function scrubFromEvent(e: React.MouseEvent | MouseEvent) {
    const bar = progressBarRef.current;
    const player = playerRef.current;
    if (!bar || !player?.seekTo || !player?.getDuration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const d = player.getDuration() ?? 0;
    setProgress(pct * 100);
    setCurrentTime(pct * d);
    player.seekTo(pct * d, true);
  }

  function handleScrubStart(e: React.MouseEvent) {
    e.preventDefault();
    setIsScrubbing(true);
    scrubFromEvent(e);

    function onMove(ev: MouseEvent) { scrubFromEvent(ev); }
    function onUp() {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Detect unavailable YouTube videos via thumbnail probe.
  function handleThumbLoad(videoId: string, e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth === 120 && img.naturalHeight === 90) {
      setBadThumbs((prev) => new Set(prev).add(videoId));
    }
  }

  function handleThumbError(videoId: string) {
    setBadThumbs((prev) => new Set(prev).add(videoId));
  }

  // Auto-collapse after idle
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (hudState === "expanded") {
      idleTimerRef.current = setTimeout(() => {
        setHUDState("collapsed");
        setTimeout(() => setHUDState("minimized"), 2000);
      }, 15000);
    }
  }, [hudState]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  function toggleHUD() {
    if (hudState === "expanded") {
      setHUDState("minimized");
    } else {
      setHUDState("expanded");
    }
  }

  function handleMouseEnter() {
    if (hudState === "minimized" || hudState === "collapsed") {
      setHUDState("collapsed");
    }
  }

  const categories = Array.from(new Set(allChannels.map((c) => c.icon)));
  const filteredChannels = selectedCategory
    ? allChannels.filter((c) => c.icon === selectedCategory)
    : allChannels;
  const playlistVideos = channel.videos;

  return (
    <div
      className={`classic-hud ${hudState}`}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={handleMouseEnter}
      onMouseMove={resetIdleTimer}
    >
      {/* ─── Top Panel ─── */}
      <div className="hud-top-panel">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/frogo/logo.png" alt="frogo.tv" className="h-7 opacity-70 shrink-0" />
          <span className="text-sm text-white/60 truncate">
            <span className="text-accent font-mono mr-1">{channelIdx + 1}</span>
            {channel.icon} {channel.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleHUD}
            className="text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-1"
          >
            {hudState === "expanded" ? "Close" : "Browse"}
          </button>
        </div>
      </div>

      {/* ─── Middle Content (only when expanded) ─── */}
      {hudState === "expanded" && (
        <div className="hud-content">
          {/* Left Panel — Categories */}
          <div className="hud-left-panel">
            <h3 className="text-sm font-bold text-accent px-3 py-2 tracking-wider uppercase">
              Channels
            </h3>
            <div className="space-y-0.5 overflow-y-auto flex-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-right px-3 py-1.5 text-sm transition-colors ${
                  !selectedCategory ? "text-accent font-bold" : "text-white/50 hover:text-white/80"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-right px-3 py-1.5 text-sm transition-colors ${
                    selectedCategory === cat
                      ? "text-accent font-bold text-base"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel — Channel Grid */}
          <div className="hud-right-panel">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 p-2">
              {filteredChannels.map((ch, i) => {
                const isPlaying = ch.id === channel.id;
                const firstVideo = ch.videos[0];
                const thumbUrl = firstVideo?.thumbnail_url ||
                  `https://img.youtube.com/vi/${firstVideo?.youtube_id}/mqdefault.jpg`;
                return (
                  <button
                    key={ch.id}
                    onClick={() => onSwitchChannel(ch.slug)}
                    className={`hud-channel-tile group relative rounded-lg overflow-hidden ${
                      isPlaying ? "ring-2 ring-accent" : ""
                    }`}
                  >
                    <div className="aspect-video bg-black/50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbUrl} alt={ch.name} className="w-full h-full object-cover" />
                    </div>
                    {isPlaying && (
                      <>
                        <div className="absolute inset-0 bg-black/50" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 text-black text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider">
                          PLAYING
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-1.5 translate-y-full group-hover:translate-y-0 transition-transform">
                      <span className="text-[11px] text-white/80 line-clamp-1">
                        <span className="text-white/40 font-mono mr-1">{allChannels.indexOf(ch) + 1}</span>
                        {ch.icon} {ch.name}
                      </span>
                    </div>
                    {!isPlaying && (
                      <div className="absolute top-1 left-1 text-[10px] font-mono text-white/40 bg-black/40 px-1 rounded">
                        {i + 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Current Playlist Strip (visible when collapsed/minimized) ─── */}
      {hudState !== "expanded" && (
        <div className="hud-playlist-strip">
          <div className="flex gap-1.5 overflow-x-auto px-2 py-1.5 scrollbar-hide">
            {playlistVideos.map((v, i) => {
              if (badThumbs.has(v.youtube_id)) return null;
              const isActive = i === currentVideoIndex;
              const thumbUrl = v.thumbnail_url ||
                `https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`;
              return (
                <button
                  key={v.id}
                  onClick={() => onJumpToVideo(i)}
                  className={`shrink-0 w-[80px] h-[45px] rounded overflow-hidden relative cursor-pointer ${
                    isActive ? "ring-1 ring-accent" : "opacity-60 hover:opacity-100"
                  } transition-opacity`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl}
                    alt={v.title}
                    className="w-full h-full object-cover"
                    onLoad={(e) => handleThumbLoad(v.youtube_id, e)}
                    onError={() => handleThumbError(v.youtube_id)}
                  />
                  {isActive && (
                    <>
                      <div className="absolute inset-0 bg-black/40" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-white/90 tracking-wider">
                        NOW
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Bottom Panel — Player Controls ─── */}
      <div className="hud-bottom-panel">
        {/* Scrub bar */}
        <div
          ref={progressBarRef}
          className="hud-progress-bar hud-progress-bar-interactive"
          onMouseDown={handleScrubStart}
        >
          <div className="hud-progress-fill" style={{ width: `${progress}%` }} />
          <div
            className="hud-progress-handle"
            style={{ left: `${progress}%` }}
          />
        </div>

        {/* Now playing info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {activeVideo && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  activeVideo.thumbnail_url ||
                  `https://img.youtube.com/vi/${activeVideo.youtube_id}/mqdefault.jpg`
                }
                alt=""
                className="w-10 h-[30px] rounded border border-white/10 object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="text-[11px] text-white/70 truncate leading-tight">
                  {activeVideo.title}
                </div>
                <div className="text-[10px] text-white/30 truncate">
                  {channel.icon} {channel.name}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Time display */}
        <span className="text-[10px] font-mono text-white/40 shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Controller buttons */}
        <div className="flex items-center gap-1">
          <button onClick={onPrevVideo} className="hud-ctrl-btn" title="Previous Video">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button onClick={onTogglePlay} className="hud-ctrl-btn hud-ctrl-btn-primary" title="Play/Pause">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <button onClick={onNextVideo} className="hud-ctrl-btn" title="Next Video">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button onClick={onPrevChannel} className="hud-ctrl-btn" title="Previous Channel">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>
          <span className="text-xs font-mono text-accent/80 w-6 text-center">{channelIdx + 1}</span>
          <button onClick={onNextChannel} className="hud-ctrl-btn" title="Next Channel">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen?.();
              }
            }}
            className="hud-ctrl-btn"
            title="Fullscreen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
