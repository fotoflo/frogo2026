"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";
import MiniQR from "@/components/MiniQR";
import OnScreenRemote from "@/components/OnScreenRemote";
import { whatsOnNow } from "@/lib/schedule";
import { getInitialAutoplayState, autoplayTransition } from "@/lib/autoplay";
import { supabase } from "@/lib/supabase";

interface Video {
  id: string;
  youtube_id: string;
  title: string;
  description?: string;
  duration_seconds: number;
  thumbnail_url?: string;
}

interface ChannelData {
  id: string;
  slug: string;
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

  // Current channel (client-side state — no navigation)
  const [channelIdx, setChannelIdx] = useState(initialChannelIndex);
  const channel = channels[channelIdx];
  const videos = channel.videos;

  // Pairing state
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const lastCommandAtRef = useRef<string | null>(null);

  // Mouse / remote overlay
  const [showRemote, setShowRemote] = useState(false);
  const [mouseActive, setMouseActive] = useState(false);
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
    const durations = videos.map((v) => v.duration_seconds);
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
    const newDurations = channel.videos.map((v) => v.duration_seconds);
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

  // Mouse movement shows on-screen remote, hides 450ms after stop
  useEffect(() => {
    function onMouseMove() {
      setMouseActive(true);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
      mouseTimeoutRef.current = setTimeout(() => setMouseActive(false), 450);
    }
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    };
  }, []);

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

  // Video ended -> next in playlist
  const handleEnded = useCallback(() => {
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
    setStartSeconds(0);
  }, [videos.length]);

  // Video error (unavailable at runtime) -> skip to next
  const handleError = useCallback(() => {
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
    setStartSeconds(0);
  }, [videos.length]);

  // DEBUG: track player state
  const [debugInfo, setDebugInfo] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReady = useCallback((player: any) => {
    playerRef.current = player;
    setDebugInfo(`ready, state=${player.getPlayerState()}, vid=${player.getVideoData()?.video_id}`);
    setAutoplay((s) => autoplayTransition(s, { type: "PLAYER_READY" }));
  }, []);

  // Channel switching — just state changes, no navigation
  const switchToChannel = useCallback(
    (idx: number) => {
      const wrapped = ((idx % channels.length) + channels.length) % channels.length;
      setChannelIdx(wrapped);
      // Update URL without navigation for bookmarkability
      window.history.replaceState(null, "", `/watch/${channels[wrapped].slug}`);
    },
    [channels]
  );

  const switchChannelBySlug = useCallback(
    (slug: string) => {
      const idx = channels.findIndex((c) => c.slug === slug);
      if (idx >= 0) switchToChannel(idx);
    },
    [channels, switchToChannel]
  );

  const nextChannel = useCallback(() => {
    switchToChannel(channelIdx + 1);
  }, [channelIdx, switchToChannel]);

  const prevChannel = useCallback(() => {
    switchToChannel(channelIdx - 1);
  }, [channelIdx, switchToChannel]);

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
            switchToChannel(num - 1);
          } else if (command.startsWith("navigate_")) {
            const slug = command.replace("navigate_", "");
            switchChannelBySlug(slug);
          }
      }
    },
    [nextChannel, prevChannel, switchToChannel, switchChannelBySlug]
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
            switchToChannel(num - 1);
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
  }, [channelNumber, switchToChannel, nextChannel, prevChannel]);

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
  function handleScreenClick() {
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
  }

  return (
    <div className="fixed inset-0 bg-black" onClick={handleScreenClick}>
      {/* Fullscreen video */}
      {scheduleReady && activeVideo && (
        <div className="absolute inset-0">
          <YouTubePlayer
            videoId={activeVideo.youtube_id}
            startSeconds={startSeconds}
            onReady={handleReady}
            onEnded={handleEnded}
            onError={handleError}
          />
        </div>
      )}

      {/* Muted indicator — tap anywhere to unmute */}
      {autoplay.showMutedIndicator && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 text-white/80 text-sm flex items-center gap-2 animate-pulse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            Tap to unmute
          </div>
        </div>
      )}

      {/* DEBUG overlay — click to copy */}
      {debugInfo && (
        <div
          className="absolute top-20 left-4 z-50 bg-red-900/80 text-white text-xs font-mono px-3 py-2 rounded cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            const text = `${debugInfo} | vid=${activeVideo?.youtube_id} | ch=${channel.name}`;
            navigator.clipboard.writeText(text);
          }}
        >
          {debugInfo} | vid={activeVideo?.youtube_id} | ch={channel.name}
        </div>
      )}

      {/* Mini QR code — top right, only when unpaired */}
      {!paired && pairingCode && sessionId && showQR && (
        <div className="absolute top-4 right-4 z-50 pointer-events-none">
          <MiniQR code={pairingCode} />
        </div>
      )}

      {/* Paired indicator */}
      {paired && (
        <div className="absolute top-4 right-4 z-50 pointer-events-none">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
        </div>
      )}

      {/* Channel number input overlay */}
      {channelNumber && (
        <div className="absolute top-8 left-8 z-50 bg-black/80 text-white text-5xl font-mono px-6 py-3 rounded-lg pointer-events-none">
          {channelNumber}
        </div>
      )}

      {/* Channel banner — shows briefly */}
      {showBanner && (
        <div className="absolute top-6 left-6 z-40 pointer-events-none animate-fade-up">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
            <span className="text-accent font-mono mr-2">{channelIdx + 1}</span>
            <span className="text-lg">{channel.icon} {channel.name}</span>
            {activeVideo && (
              <div className="text-sm text-white/60 mt-0.5">{activeVideo.title}</div>
            )}
          </div>
        </div>
      )}

      {/* Now playing info — bottom left, shows on mouse move or banner */}
      {(mouseActive || showBanner) && activeVideo && (
        <div className="absolute bottom-6 left-6 z-30 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-5 py-3 text-white max-w-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-accent font-mono text-sm">{channelIdx + 1}</span>
              <span className="text-xl">{channel.icon}</span>
              <span className="font-semibold">{channel.name}</span>
            </div>
            <div className="text-sm text-white/80 line-clamp-1">{activeVideo.title}</div>
            {activeVideo.description && (
              <div className="text-xs text-white/40 mt-0.5 line-clamp-1">{activeVideo.description}</div>
            )}
          </div>
        </div>
      )}

      {/* Network bug — frogo logo watermark, bottom-right */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none opacity-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/frogo/logo.png" alt="frogo.tv" className="h-6" />
      </div>

      {/* On-screen remote — visible when mouse is moving or when clicked open */}
      {(mouseActive || showRemote) && (
        <div
          className="absolute inset-0 z-40"
          onClick={(e) => e.stopPropagation()}
        >
          <OnScreenRemote
            channel={channel}
            channelIdx={channelIdx}
            allChannels={channels}
            activeVideo={activeVideo}
            onSwitchChannel={(slug) => {
              switchChannelBySlug(slug);
              setShowRemote(false);
            }}
            onPrevChannel={prevChannel}
            onNextChannel={nextChannel}
            onTogglePlay={handleScreenClick}
            onClose={() => setShowRemote(false)}
            expanded={showRemote}
          />
        </div>
      )}
    </div>
  );
}
