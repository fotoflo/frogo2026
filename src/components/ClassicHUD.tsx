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
  parent_id?: string | null;
  /** Root-to-leaf slug segments. Used for display + href building. */
  path?: string[];
  name: string;
  icon: string;
  videos: Video[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTPlayer = any;

interface ClassicHUDProps {
  channel: Channel;
  /** Index of `channel` within `siblings` (i.e. the local channel number). */
  siblingIdx: number;
  allChannels: Channel[];
  /** Channels at the current directory scope — drives the grid + channel #. */
  siblings: Channel[];
  /** Root→scope ancestor chain, empty at root. Renders as breadcrumbs. */
  ancestors: Channel[];
  activeVideo: Video | null;
  currentVideoIndex: number;
  playerRef: React.RefObject<YTPlayer | null>;
  onSwitchChannel: (channelId: string) => void;
  /** Jump to an ancestor scope from a breadcrumb. `null` = Home (root). */
  onNavigateToScope: (channelId: string | null) => void;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  onNextVideo: () => void;
  onPrevVideo: () => void;
  onTogglePlay: () => void;
  onJumpToVideo: (index: number) => void;
  showQRButton?: boolean;
  onShowQR?: () => void;
  onVote?: (upvote: boolean) => void;
}

type HUDState = "expanded" | "collapsed" | "minimized";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ClassicHUD({
  channel,
  siblingIdx,
  allChannels,
  siblings,
  ancestors,
  activeVideo,
  currentVideoIndex,
  playerRef,
  onSwitchChannel,
  onNavigateToScope,
  onPrevChannel,
  onNextChannel,
  onNextVideo,
  onPrevVideo,
  onTogglePlay,
  onJumpToVideo,
  showQRButton,
  onShowQR,
  onVote,
}: ClassicHUDProps) {
  const [hudState, setHUDState] = useState<HUDState>("minimized");
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

  const playlistVideos = channel.videos;
  /** Local channel number within the current scope (1-indexed). */
  const localChannelNumber = (siblingIdx < 0 ? 0 : siblingIdx) + 1;

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
          {/* Breadcrumbs — Home › Kids › Maruko */}
          <nav
            className="flex items-center gap-1 text-sm text-white/60 truncate min-w-0"
            aria-label="Channel breadcrumbs"
          >
            <button
              onClick={() => onNavigateToScope(null)}
              className="text-white/40 hover:text-white/80 transition-colors shrink-0"
              aria-label="Go to home"
            >
              Home
            </button>
            {ancestors.map((a) => {
              const isCurrent = a.id === channel.id;
              return (
                <span key={a.id} className="flex items-center gap-1 min-w-0">
                  <span className="text-white/25" aria-hidden="true">›</span>
                  {isCurrent ? (
                    <span className="text-white/80 truncate" aria-current="page">
                      <span className="text-accent font-mono mr-1">
                        {localChannelNumber}
                      </span>
                      {a.icon} {a.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => onNavigateToScope(a.id)}
                      className="text-white/40 hover:text-white/80 transition-colors truncate"
                    >
                      {a.icon} {a.name}
                    </button>
                  )}
                </span>
              );
            })}
            {/* Show the current channel when it's not already in the ancestor
                chain (leaf case — ancestors ends at the scope folder, not at
                the leaf channel). */}
            {!ancestors.some((a) => a.id === channel.id) && (
              <span className="flex items-center gap-1 min-w-0">
                <span className="text-white/25" aria-hidden="true">›</span>
                <span className="text-white/80 truncate" aria-current="page">
                  <span className="text-accent font-mono mr-1">
                    {localChannelNumber}
                  </span>
                  {channel.icon} {channel.name}
                </span>
              </span>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          {showQRButton && onShowQR && (
            <button
              onClick={onShowQR}
              className="hud-ctrl-btn"
              title="Show pairing QR code"
              aria-label="Show pairing QR code"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 11h2V9H3v2zm0-4h2V3h4V1H3v6zm8-6v2h4V1h-4zm4 18h4v-2h-2v-2h-2v4zm-4 0h2v-4h-2v4zm-8-4h2v-2H3v2zm0-4h2v-2H3v2zm16-4V3h-4v2h2v2h2zm0 4h2V7h-2v4zm0 4h2v-2h-2v2zM7 13h4v-2H7v2zm-4 6h4v-4H3v4zm2-2v-2h2v2H5zM3 3v4h4V3H3zm2 2v2H5V5h2zm14 0v4h-4V3h4zm-2 2v2h-2V5h2zm-4 8h-2v2h2v2h2v-2h-2v-2zm-4 0H7v4h4v-2H9v-2z"/>
              </svg>
            </button>
          )}
          <button
            onClick={toggleHUD}
            aria-expanded={hudState === "expanded"}
            aria-label={hudState === "expanded" ? "Close channel guide" : "Browse channels"}
            className="text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-1"
          >
            {hudState === "expanded" ? "Close" : "Browse"}
          </button>
        </div>
      </div>

      {/* ─── Middle Content (only when expanded) ─── */}
      {hudState === "expanded" && (
        <div className="hud-content">
          {/* Left Panel — directory navigator */}
          <div className="hud-left-panel">
            <h3 className="text-[10px] font-semibold text-white/40 px-3 pt-2.5 pb-1.5 tracking-[0.12em] uppercase">
              Directory
            </h3>
            <div
              className="hud-scroll flex-1 overflow-y-auto pb-2"
              role="group"
              aria-label="Directory navigation"
            >
              <button
                onClick={() => onNavigateToScope(null)}
                aria-pressed={ancestors.length === 0}
                className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-1.5 transition-colors ${
                  ancestors.length === 0
                    ? "text-accent font-bold bg-white/[0.04]"
                    : "text-white/55 hover:text-white/90 hover:bg-white/[0.03]"
                }`}
              >
                <span aria-hidden="true">🏠</span>
                <span className="truncate">Home</span>
              </button>
              {ancestors.map((a, i) => {
                const isDeepest = i === ancestors.length - 1;
                return (
                  <button
                    key={a.id}
                    onClick={() => onNavigateToScope(a.id)}
                    aria-pressed={isDeepest}
                    className={`w-full text-left py-1.5 text-[13px] flex items-center gap-1.5 truncate transition-colors ${
                      isDeepest
                        ? "text-accent font-bold bg-white/[0.04]"
                        : "text-white/55 hover:text-white/90 hover:bg-white/[0.03]"
                    }`}
                    style={{
                      paddingLeft: `${12 + (i + 1) * 10}px`,
                      paddingRight: "12px",
                    }}
                  >
                    <span aria-hidden="true">{a.icon}</span>
                    <span className="truncate">{a.name}</span>
                  </button>
                );
              })}
              {/* Sub-folders at the current scope — quick-jump shortcuts. */}
              {siblings
                .filter((s) => allChannels.some((c) => c.parent_id === s.id))
                .map((f) => {
                  const depth = ancestors.length + 1;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onSwitchChannel(f.id)}
                      className="w-full text-left py-1.5 text-[13px] flex items-center gap-1.5 truncate text-white/45 hover:text-white/90 hover:bg-white/[0.03] transition-colors"
                      style={{
                        paddingLeft: `${12 + depth * 10}px`,
                        paddingRight: "12px",
                      }}
                    >
                      <span aria-hidden="true">📁</span>
                      <span className="truncate">{f.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Right Panel — Channel Grid, scoped to siblings at current level */}
          <div className="hud-right-panel">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-3 p-3">
              {siblings.map((ch, i) => {
                const isPlaying = ch.id === channel.id;
                const firstVideo = ch.videos[0];
                const thumbUrl = firstVideo?.thumbnail_url ||
                  `https://img.youtube.com/vi/${firstVideo?.youtube_id}/mqdefault.jpg`;
                const isFolder = allChannels.some((c) => c.parent_id === ch.id);
                return (
                  <button
                    key={ch.id}
                    onClick={() => onSwitchChannel(ch.id)}
                    aria-label={`Switch to ${ch.name}${isPlaying ? " (currently playing)" : ""}${isFolder ? " (contains sub-channels)" : ""}`}
                    aria-current={isPlaying ? "true" : undefined}
                    className="hud-channel-tile group flex flex-col"
                  >
                    <div
                      className={`hud-channel-thumb aspect-video bg-black/50 relative rounded-md overflow-hidden ${
                        isPlaying ? "ring-2 ring-accent" : "ring-1 ring-white/5"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbUrl} alt="" aria-hidden="true" className="w-full h-full object-cover" />
                      {isPlaying && (
                        <>
                          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 text-black text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider" aria-hidden="true">
                            PLAYING
                          </div>
                        </>
                      )}
                      <div className="absolute top-1 left-1 text-[10px] font-mono text-white/80 bg-black/60 px-1 rounded" aria-hidden="true">
                        {i + 1}
                      </div>
                      {isFolder && (
                        <div
                          className="absolute top-1 right-1 text-[10px] text-white/80 bg-black/60 px-1 rounded"
                          aria-hidden="true"
                          title="Contains sub-channels"
                        >
                          📁
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 px-0.5">
                      <div
                        className={`text-[12px] leading-tight line-clamp-2 ${
                          isPlaying ? "text-accent font-semibold" : "text-white/80"
                        }`}
                      >
                        {ch.icon} {ch.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Current Playlist Strip (visible when collapsed/minimized) ─── */}
      {hudState !== "expanded" && (
        <div className="hud-playlist-strip" aria-label="Playlist" role="group">
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
                  aria-label={`Play: ${v.title}${isActive ? " (now playing)" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`shrink-0 w-[80px] h-[45px] rounded overflow-hidden relative cursor-pointer ${
                    isActive ? "ring-1 ring-accent" : "opacity-60 hover:opacity-100"
                  } transition-opacity`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    onLoad={(e) => handleThumbLoad(v.youtube_id, e)}
                    onError={() => handleThumbError(v.youtube_id)}
                  />
                  {isActive && (
                    <>
                      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-white/90 tracking-wider" aria-hidden="true">
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
          role="slider"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          tabIndex={0}
          onMouseDown={handleScrubStart}
        >
          <div className="hud-progress-fill" style={{ width: `${progress}%` }} aria-hidden="true" />
          <div
            className="hud-progress-handle"
            style={{ left: `${progress}%` }}
            aria-hidden="true"
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

        {/* Vote buttons */}
        {onVote && (
          <div className="flex items-center gap-1" role="group" aria-label="Vote">
            <button onClick={() => onVote(true)} className="hud-ctrl-btn" title="Upvote" aria-label="Upvote">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66a4.8 4.8 0 0 0-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84A2.34 2.34 0 0 0 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z"/>
              </svg>
            </button>
            <button onClick={() => onVote(false)} className="hud-ctrl-btn" title="Downvote" aria-label="Downvote">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h5.5l-.92 4.65c-.05.22-.02.46.08.66.23.45.52.86.88 1.22L10 22l6.41-6.41c.38-.38.59-.89.59-1.42V6.34A2.34 2.34 0 0 0 14.66 4H6.56c-.71 0-1.37.37-1.73.97L2.17 11.12z"/>
              </svg>
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" aria-hidden="true" />
          </div>
        )}

        {/* Controller buttons */}
        <div className="flex items-center gap-1" role="group" aria-label="Player controls">
          <button onClick={onPrevVideo} className="hud-ctrl-btn" title="Previous Video" aria-label="Previous video">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button onClick={onTogglePlay} className="hud-ctrl-btn hud-ctrl-btn-primary" title="Play/Pause" aria-label="Play or pause">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <button onClick={onNextVideo} className="hud-ctrl-btn" title="Next Video" aria-label="Next video">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" aria-hidden="true" />
          <button onClick={onPrevChannel} className="hud-ctrl-btn" title="Previous Channel" aria-label="Previous channel">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>
          <span
            className="text-xs font-mono text-accent/80 w-6 text-center"
            aria-label={`Channel ${localChannelNumber}`}
          >
            {localChannelNumber}
          </span>
          <button onClick={onNextChannel} className="hud-ctrl-btn" title="Next Channel" aria-label="Next channel">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" aria-hidden="true" />
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
            aria-label="Toggle fullscreen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
