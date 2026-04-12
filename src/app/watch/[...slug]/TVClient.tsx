"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";
import MiniQR from "@/components/MiniQR";
import OnScreenRemote from "@/components/OnScreenRemote";
import ClassicHUD from "@/components/ClassicHUD";
import { whatsOnNow } from "@/lib/schedule";
import { getInitialAutoplayState, autoplayTransition } from "@/lib/autoplay";
import { supabase } from "@/lib/supabase";
import { FEATURES } from "@/lib/settings";
import { useInteractions } from "@/lib/useInteractions";
import { useViewerPresence } from "@/lib/useViewerPresence";
import ViewersMap from "@/components/ViewersMap";
import {
  getAncestors,
  getSiblingsAt,
  hasChildren,
} from "@/lib/channel-paths";

interface Video {
  id: string;
  youtube_id: string;
  title: string;
  description?: string;
  duration_seconds: number;
  /** Optional trim window — when set, playback seeks to start and stops at end. */
  start_seconds?: number | null;
  end_seconds?: number | null;
  thumbnail_url?: string;
}

/**
 * Effective playback duration = (end_seconds ?? duration_seconds) - (start_seconds ?? 0).
 * This is what the broadcast schedule uses — how long the viewer experiences
 * the clip, not the full native YouTube length.
 */
function effectiveDuration(v: Video): number {
  const end = v.end_seconds ?? v.duration_seconds;
  const start = v.start_seconds ?? 0;
  return Math.max(0, end - start);
}

interface ChannelData {
  id: string;
  slug: string;
  /** Parent in the channel tree (null = top level). */
  parent_id: string | null;
  /** Root-to-leaf slug segments, e.g. ["business","startups"]. */
  path: string[];
  name: string;
  icon: string;
  videos: Video[];
}

interface TVClientProps {
  channels: ChannelData[];
  initialChannelIndex: number;
}

export default function TVClient({ channels, initialChannelIndex }: TVClientProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // Interaction tracking (watch history, votes, events)
  const { trackSeen, trackSkip, vote, trackEvent } = useInteractions();

  // Current channel (client-side state — no navigation)
  const [channelIdx, setChannelIdx] = useState(initialChannelIndex);
  const channel = channels[channelIdx];

  // ─── Directory scope ────────────────────────────────────────────────────
  // `scopeId` is the id of the "folder" the user is currently browsing.
  // null = root level. When the current channel has children it becomes the
  // scope itself (you're "inside" it); otherwise the scope is its parent.
  // Up/Down and number keys stay within siblings at this scope.
  const initialScopeId = useMemo(() => {
    const c = channels[initialChannelIndex];
    if (!c) return null;
    return hasChildren(c.id, channels) ? c.id : c.parent_id;
  }, [channels, initialChannelIndex]);
  const [scopeId, setScopeId] = useState<string | null>(initialScopeId);

  const siblings = useMemo(
    () => getSiblingsAt(scopeId, channels),
    [scopeId, channels]
  );
  const ancestors = useMemo(
    () => getAncestors(scopeId, channels),
    [scopeId, channels]
  );
  const siblingIdx = useMemo(
    () => siblings.findIndex((c) => c.id === channel.id),
    [siblings, channel.id]
  );

  // Viewer presence map
  const { viewers, myLocation, viewerCount } = useViewerPresence(channel.slug);
  const [showViewersMap, setShowViewersMap] = useState(false);
  const viewersMapTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const prevViewerCountRef = useRef(0);
  const videos = channel.videos;

  // Pairing state
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const lastCommandAtRef = useRef<string | null>(null);

  // Mouse / remote overlay
  const [showRemote, setShowRemote] = useState(false);
  const [mouseActive, setMouseActive] = useState(false);
  const [hudHovered, setHudHovered] = useState(false);
  const [qrDismissed, setQrDismissed] = useState(false);
  const mouseTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Channel number input
  const [channelNumber, setChannelNumber] = useState("");
  const channelNumberTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Channel banner
  const [showBanner, setShowBanner] = useState(false);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // QR lingers 10s after chrome fades
  const [qrHidden, setQrHidden] = useState(false);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Schedule state — initialized to safe defaults to avoid hydration mismatch
  // (whatsOnNow uses Date.now() which differs between server and client)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [startSeconds, setStartSeconds] = useState(0);
  const [scheduleReady, setScheduleReady] = useState(false);
  const activeVideo = videos[currentVideoIndex] || videos[0];

  // Calculate what's on now — client-side only
  useEffect(() => {
    const durations = videos.map(effectiveDuration);
    const schedule = whatsOnNow(durations);
    setCurrentVideoIndex(schedule.index);
    setStartSeconds(schedule.startSeconds);
    setScheduleReady(true);
    setShowBanner(true);
  }, [videos]);

  // When channel changes, recalculate schedule
  const prevChannelIdRef = useRef(channel.id);
  useEffect(() => {
    if (channel.id === prevChannelIdRef.current) return;
    prevChannelIdRef.current = channel.id;
    const newDurations = channel.videos.map(effectiveDuration);
    const newSchedule = whatsOnNow(newDurations);
    setCurrentVideoIndex(newSchedule.index);
    setStartSeconds(newSchedule.startSeconds);
    // Show channel banner on switch
    setShowBanner(true);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setShowBanner(false), 4000);
  }, [channel]);

  // Hide banner after 4 seconds on initial load
  useEffect(() => {
    bannerTimeoutRef.current = setTimeout(() => setShowBanner(false), 4000);
    return () => {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  // QR linger: hide QR 10s after chrome goes away, reset when chrome reappears
  const chromeVisible = mouseActive || showBanner;
  const prevChromeVisibleRef = useRef(chromeVisible);

  if (chromeVisible && !prevChromeVisibleRef.current && qrHidden) {
    setQrHidden(false);
  }
  prevChromeVisibleRef.current = chromeVisible;

  useEffect(() => {
    if (!chromeVisible) {
      qrTimeoutRef.current = setTimeout(() => setQrHidden(true), 10000);
    }
    return () => {
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    };
  }, [chromeVisible]);

  const showQR = !qrHidden;

  // Mouse movement shows on-screen remote, hides after timeout
  const keepMouseAlive = useCallback(() => {
    setMouseActive(true);
    if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    mouseTimeoutRef.current = setTimeout(() => setMouseActive(false), 2500);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", keepMouseAlive);
    return () => {
      window.removeEventListener("mousemove", keepMouseAlive);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    };
  }, [keepMouseAlive]);

  // Create pairing session (once, never torn down)
  useEffect(() => {
    fetch("/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: activeVideo?.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        setPairingCode(data.code);
        setSessionId(data.sessionId);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount — component never unmounts on channel switch

  // Video navigation
  const handleEnded = useCallback(() => {
    // Video finished naturally — record as "seen"
    if (activeVideo) trackSeen(activeVideo.id, channel.id);
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
    setStartSeconds(0);
  }, [videos.length, activeVideo, channel.id, trackSeen]);

  const handlePrevVideo = useCallback(() => {
    // Manual skip — record as "skip"
    if (activeVideo) trackSkip(activeVideo.id, channel.id);
    setCurrentVideoIndex((prev) => (prev - 1 + videos.length) % videos.length);
    setStartSeconds(0);
  }, [videos.length, activeVideo, channel.id, trackSkip]);

  // Manual next video (skip forward)
  const handleNextVideo = useCallback(() => {
    if (activeVideo) trackSkip(activeVideo.id, channel.id);
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
    setStartSeconds(0);
  }, [videos.length, activeVideo, channel.id, trackSkip]);

  // Video error (unavailable at runtime) -> skip to next
  const handleError = useCallback(() => {
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
    setStartSeconds(0);
  }, [videos.length]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReady = useCallback((player: any) => {
    playerRef.current = player;
    setAutoplay((s) => autoplayTransition(s, { type: "PLAYER_READY" }));
  }, []);

  // ─── Channel switching (scope-aware) ────────────────────────────────────
  // Switch to a channel by id. The scope follows the target: if the target
  // has children, the user is "entering" that folder (scope = target.id);
  // otherwise the scope is the target's parent. This keeps Up/Down cycling
  // within siblings even after an explicit jump from the breadcrumb or grid.
  const switchChannelById = useCallback(
    (id: string) => {
      const idx = channels.findIndex((c) => c.id === id);
      if (idx < 0) return;
      const target = channels[idx];
      const newScope = hasChildren(target.id, channels)
        ? target.id
        : target.parent_id;
      setScopeId(newScope);
      setChannelIdx(idx);
      trackEvent("channel_switch", { slug: target.slug, channelIdx: idx });
      // Update URL without navigation for bookmarkability
      window.history.replaceState(
        null,
        "",
        `/watch/${target.path.join("/")}`
      );
    },
    [channels, trackEvent]
  );

  // Cycle within the current scope's siblings (for Up/Down arrows and the
  // phone remote's prev/next). Wraps at the ends. If the current channel is
  // somehow not in the sibling list (shouldn't happen), treats index as 0.
  const switchToSiblingIdx = useCallback(
    (idx: number) => {
      if (siblings.length === 0) return;
      const wrapped = ((idx % siblings.length) + siblings.length) % siblings.length;
      const target = siblings[wrapped];
      switchChannelById(target.id);
    },
    [siblings, switchChannelById]
  );

  const nextChannel = useCallback(() => {
    switchToSiblingIdx((siblingIdx < 0 ? 0 : siblingIdx) + 1);
  }, [siblingIdx, switchToSiblingIdx]);

  const prevChannel = useCallback(() => {
    switchToSiblingIdx((siblingIdx < 0 ? 0 : siblingIdx) - 1);
  }, [siblingIdx, switchToSiblingIdx]);

  // Handle remote commands
  const handleCommand = useCallback(
    (command: string) => {
      switch (command) {
        case "next":
          nextChannel();
          break;
        case "prev":
          prevChannel();
          break;
        default:
          if (command.startsWith("channel_")) {
            const num = parseInt(command.split("_")[1], 10);
            switchToSiblingIdx(num - 1);
          } else if (command.startsWith("navigate_")) {
            const id = command.replace("navigate_", "");
            switchChannelById(id);
          }
      }
    },
    [nextChannel, prevChannel, switchToSiblingIdx, switchChannelById]
  );

  // Supabase Realtime for remote control (single persistent subscription)
  useEffect(() => {
    if (!sessionId) return;

    const ch = supabase
      .channel(`pairing:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pairing_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const newRow = payload.new as { paired?: boolean; last_command?: string; last_command_at?: string };
          if (newRow.paired && !paired) setPaired(true);
          if (
            newRow.last_command &&
            newRow.last_command_at &&
            newRow.last_command_at !== lastCommandAtRef.current
          ) {
            lastCommandAtRef.current = newRow.last_command_at;
            handleCommand(newRow.last_command);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, paired, handleCommand]);

  // Autoplay state machine — always starts muted, unmutes on user interaction
  const [autoplay, setAutoplay] = useState(getInitialAutoplayState);

  // When player is ready, try to unmute after a short delay
  useEffect(() => {
    if (autoplay.state !== "muted" || !autoplay.shouldAttemptUnmute) return;
    const player = playerRef.current;
    if (!player) return;

    const timer = setTimeout(() => {
      try {
        player.unMute();
        player.setVolume(100);
        // Check if unmute stuck — some browsers re-mute immediately
        setTimeout(() => {
          if (player.isMuted()) {
            setAutoplay((s) => autoplayTransition(s, { type: "UNMUTE_ATTEMPT_FAILED" }));
          } else {
            setAutoplay((s) => autoplayTransition(s, { type: "UNMUTE_ATTEMPT_SUCCEEDED" }));
          }
        }, 200);
      } catch {
        setAutoplay((s) => autoplayTransition(s, { type: "UNMUTE_ATTEMPT_FAILED" }));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoplay.state, autoplay.shouldAttemptUnmute]);

  // Click on video area — unmute if muted, otherwise toggle play/pause
  const handleScreenClick = useCallback(() => {
    const player = playerRef.current;

    // Always send user interaction to autoplay state machine
    if (autoplay.state === "muted") {
      setAutoplay((s) => autoplayTransition(s, { type: "USER_INTERACTION" }));
      if (player) {
        player.unMute();
        player.setVolume(100);
        // If player was paused (shouldn't happen with muted autoplay, but just in case)
        const state = player.getPlayerState?.();
        if (state !== 1 && state !== 3) {
          player.playVideo();
        }
      }
      return;
    }

    if (!player?.getPlayerState) return;
    const state = player.getPlayerState();
    if (state === 1) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [autoplay.state]);

  // Keyboard controls
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Number keys
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        const newNumber = channelNumber + e.key;
        setChannelNumber(newNumber);
        setShowBanner(true);

        if (channelNumberTimeoutRef.current) clearTimeout(channelNumberTimeoutRef.current);
        channelNumberTimeoutRef.current = setTimeout(() => {
          const num = parseInt(newNumber, 10);
          if (num >= 1) {
            switchToSiblingIdx(num - 1);
          }
          setChannelNumber("");
          setTimeout(() => setShowBanner(false), 3000);
        }, 1000);
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          prevChannel();
          break;
        case "ArrowDown":
          e.preventDefault();
          nextChannel();
          break;
        case " ":
          e.preventDefault();
          handleScreenClick();
          break;
        case "f":
          document.documentElement.requestFullscreen?.();
          break;
        case "Escape":
          setShowRemote(false);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [channelNumber, switchToSiblingIdx, nextChannel, prevChannel, handleScreenClick]);

  // Show viewers map when a new viewer joins (2+), auto-dismiss after 15s
  useEffect(() => {
    if (viewerCount >= 2 && viewerCount > prevViewerCountRef.current) {
      setShowViewersMap(true);
      if (viewersMapTimeoutRef.current) clearTimeout(viewersMapTimeoutRef.current);
      viewersMapTimeoutRef.current = setTimeout(() => setShowViewersMap(false), 15000);
    }
    prevViewerCountRef.current = viewerCount;
  }, [viewerCount]);

  return (
    <div className="fixed inset-0 bg-black" onClick={handleScreenClick}>
      {/* Fullscreen video */}
      {scheduleReady && activeVideo && (
        <div className="absolute inset-0">
          <YouTubePlayer
            videoId={activeVideo.youtube_id}
            startSeconds={(activeVideo.start_seconds ?? 0) + startSeconds}
            endSeconds={activeVideo.end_seconds}
            onReady={handleReady}
            onEnded={handleEnded}
            onError={handleError}
          />
        </div>
      )}

      {/* Muted indicator — tap anywhere to unmute */}
      {autoplay.showMutedIndicator && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none" role="status" aria-live="polite">
          <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 text-white/80 text-sm flex items-center gap-2 animate-pulse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            Tap to unmute
          </div>
        </div>
      )}


      {/* Mini QR code — top right, only when unpaired and not dismissed */}
      {!paired && pairingCode && sessionId && showQR && !qrDismissed && (
        <div className="absolute top-4 right-4 z-50">
          <div
            className="relative cursor-pointer group"
            role="button"
            tabIndex={0}
            aria-label="Dismiss pairing QR code"
            onClick={(e) => { e.stopPropagation(); setQrDismissed(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setQrDismissed(true); } }}
            title="Click to dismiss"
          >
            <MiniQR code={pairingCode} />
            {/* X overlay — appears on hover, visually inside the QR card */}
            <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l6 6M8 2l-6 6" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Paired indicator */}
      {paired && (
        <div className="absolute top-4 right-4 z-50 pointer-events-none" aria-label="Remote paired" role="status">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
        </div>
      )}

      {/* Channel number input overlay */}
      {channelNumber && (
        <div className="absolute top-8 left-8 z-50 bg-black/80 text-white text-5xl font-mono px-6 py-3 rounded-lg pointer-events-none" aria-live="polite" aria-label={`Channel ${channelNumber}`}>
          {channelNumber}
        </div>
      )}

      {/* Network bug — frogo logo, top-left */}
      {showBanner && (
        <div className="absolute top-4 left-4 z-40 pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/frogo/logo.png" alt="" aria-hidden="true" className="h-8 opacity-60" />
        </div>
      )}

      {/* Broadcast lower-third — shows on mouse move or banner, hidden when classic HUD is active */}
      {!FEATURES.CLASSIC_HUD && (mouseActive || showBanner) && activeVideo && (
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
          {/* Gradient fade from bottom */}
          <div className="h-32 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="bg-black/70 backdrop-blur-md px-0 pb-5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="lower-third flex items-stretch max-w-2xl ml-6">
              {/* Accent stripe */}
              <div className="lower-third-stripe w-1 rounded-full bg-accent mr-4 self-stretch" />

              {/* Info block */}
              <div className="flex-1 min-w-0 py-1">
                {/* Channel line */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-accent font-mono text-xs font-bold">{(siblingIdx < 0 ? 0 : siblingIdx) + 1}</span>
                  <span className="text-base">{channel.icon}</span>
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{channel.name}</span>
                </div>
                {/* Title */}
                <div className="text-sm font-medium text-white/90 line-clamp-1 leading-snug">
                  {activeVideo.title}
                </div>
                {/* Description */}
                {activeVideo.description && (
                  <div className="text-[11px] text-white/35 mt-0.5 line-clamp-1">{activeVideo.description}</div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 ml-5 mr-6">
                {/* Frogo — video page */}
                <a
                  href={`/v/${activeVideo.id}`}
                  className="lower-third-action"
                  title="Video page"
                  aria-label="Open video page"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/frogo/frogo-icon.png" alt="" aria-hidden="true" className="w-4 h-4 opacity-70" />
                </a>

                {/* YouTube — original video */}
                <a
                  href={`https://www.youtube.com/watch?v=${activeVideo.youtube_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lower-third-action"
                  title="Watch on YouTube"
                  aria-label="Watch on YouTube"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>

                {/* Next video */}
                <button
                  onClick={handleNextVideo}
                  className="lower-third-action"
                  title="Next video"
                  aria-label="Next video"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M4 5v14l12-7L4 5zm14 0v14h2V5h-2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewers map overlay — bottom-left */}
      {showViewersMap && (
        <div className="absolute bottom-14 left-4 z-30 transition-opacity duration-500 animate-in fade-in">
          <ViewersMap
            viewers={viewers}
            myLocation={myLocation}
            onDismiss={() => {
              setShowViewersMap(false);
              if (viewersMapTimeoutRef.current) clearTimeout(viewersMapTimeoutRef.current);
            }}
          />
        </div>
      )}

      {/* Network bug — frogo logo watermark, bottom-right */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none opacity-40" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/frogo/logo.png" alt="" className="h-6" />
      </div>

      {/* On-screen controls — Classic HUD or minimal remote */}
      {FEATURES.CLASSIC_HUD ? (
        <div
          className={`absolute inset-0 z-40 pointer-events-none transition-opacity duration-300 ${
            mouseActive || hudHovered || showRemote ? "opacity-100" : "opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="pointer-events-auto"
            onMouseEnter={() => setHudHovered(true)}
            onMouseLeave={() => setHudHovered(false)}
          >
            <ClassicHUD
              channel={channel}
              siblingIdx={siblingIdx}
              allChannels={channels}
              siblings={siblings}
              ancestors={ancestors}
              activeVideo={activeVideo}
              currentVideoIndex={currentVideoIndex}
              playerRef={playerRef}
              onSwitchChannel={(id) => {
                switchChannelById(id);
                setShowRemote(false);
              }}
              onNavigateToScope={(id) => {
                // Clicking a breadcrumb jumps to that ancestor channel,
                // which implicitly re-scopes to it (or its parent).
                if (id === null) {
                  // Home: clear scope and switch to first root channel.
                  const roots = getSiblingsAt(null, channels);
                  if (roots.length > 0) switchChannelById(roots[0].id);
                  setScopeId(null);
                } else {
                  switchChannelById(id);
                }
                setShowRemote(false);
              }}
              onPrevChannel={prevChannel}
              onNextChannel={nextChannel}
              onNextVideo={handleNextVideo}
              onPrevVideo={handlePrevVideo}
              onVote={(upvote: boolean) => activeVideo && vote(activeVideo.id, upvote)}
              onTogglePlay={handleScreenClick}
              onJumpToVideo={(index) => {
                setCurrentVideoIndex(index);
                setStartSeconds(0);
              }}
              showQRButton={!paired && !!pairingCode && qrDismissed}
              onShowQR={() => setQrDismissed(false)}
            />
          </div>
        </div>
      ) : (
        (mouseActive || showRemote) && (
          <div
            className="absolute inset-0 z-40"
            onClick={(e) => e.stopPropagation()}
          >
            <OnScreenRemote
              channel={channel}
              channelIdx={channelIdx}
              allChannels={channels}
              activeVideo={activeVideo}
              onSwitchChannel={(id) => {
                switchChannelById(id);
                setShowRemote(false);
              }}
              onPrevChannel={prevChannel}
              onNextChannel={nextChannel}
              onTogglePlay={handleScreenClick}
              onClose={() => setShowRemote(false)}
              expanded={showRemote}
            />
          </div>
        )
      )}
    </div>
  );
}
