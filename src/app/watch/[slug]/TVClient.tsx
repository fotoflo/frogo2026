"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import YouTubePlayer from "@/components/YouTubePlayer";
import MiniQR from "@/components/MiniQR";
import OnScreenRemote from "@/components/OnScreenRemote";
import { whatsOnNow } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";

interface TVClientProps {
  channel: any;
  videos: any[];
  allChannels: any[];
}

export default function TVClient({ channel, videos, allChannels }: TVClientProps) {
  const router = useRouter();
  const playerRef = useRef<any>(null);

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
  const [showBanner, setShowBanner] = useState(true);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Calculate what's on now
  const durations = videos.map((v) => v.duration_seconds);
  const schedule = whatsOnNow(durations);

  const [currentIndex, setCurrentIndex] = useState(schedule.index);
  const [startSeconds, setStartSeconds] = useState(schedule.startSeconds);
  const activeVideo = videos[currentIndex] || videos[0];

  // Hide banner after 4 seconds
  useEffect(() => {
    bannerTimeoutRef.current = setTimeout(() => setShowBanner(false), 4000);
    return () => {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

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

  // Create pairing session
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
  }, []); // Only on mount

  // Video ended -> next in playlist
  const handleEnded = useCallback(() => {
    const nextIdx = (currentIndex + 1) % videos.length;
    setCurrentIndex(nextIdx);
    setStartSeconds(0);
  }, [currentIndex, videos.length]);

  const handleReady = useCallback((player: any) => {
    playerRef.current = player;
  }, []);

  // Channel switching
  const switchChannel = useCallback(
    (slug: string) => {
      router.push(`/watch/${slug}`);
    },
    [router]
  );

  const nextChannel = useCallback(() => {
    const idx = allChannels.findIndex((c: any) => c.id === channel.id);
    const next = allChannels[(idx + 1) % allChannels.length];
    switchChannel(next.slug);
  }, [allChannels, channel.id, switchChannel]);

  const prevChannel = useCallback(() => {
    const idx = allChannels.findIndex((c: any) => c.id === channel.id);
    const prev = allChannels[(idx - 1 + allChannels.length) % allChannels.length];
    switchChannel(prev.slug);
  }, [allChannels, channel.id, switchChannel]);

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
        case "channel_1":
        case "channel_2":
        case "channel_3":
        case "channel_4":
        case "channel_5":
        case "channel_6":
        case "channel_7":
        case "channel_8":
        case "channel_9": {
          const num = parseInt(command.split("_")[1], 10);
          if (num >= 1 && num <= allChannels.length) {
            switchChannel(allChannels[num - 1].slug);
          }
          break;
        }
      }
    },
    [nextChannel, prevChannel, allChannels, switchChannel]
  );

  // Supabase Realtime for remote control
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
          const newRow = payload.new as any;
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
          if (num >= 1 && num <= allChannels.length) {
            switchChannel(allChannels[num - 1].slug);
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
  }, [channelNumber, allChannels, switchChannel, nextChannel, prevChannel]);

  // Click on video area toggles remote overlay
  function handleScreenClick() {
    setShowRemote((s) => !s);
  }

  const channelIdx = allChannels.findIndex((c: any) => c.id === channel.id);

  return (
    <div className="fixed inset-0 bg-black" onClick={handleScreenClick}>
      {/* Fullscreen video */}
      {activeVideo && (
        <div className="absolute inset-0">
          <YouTubePlayer
            videoId={activeVideo.youtube_id}
            startSeconds={startSeconds}
            onReady={handleReady}
            onEnded={handleEnded}
          />
        </div>
      )}

      {/* Mini QR code — top right, only when unpaired */}
      {!paired && pairingCode && sessionId && (
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

      {/* On-screen remote — visible when mouse is moving or when clicked open */}
      {(mouseActive || showRemote) && (
        <div
          className="absolute inset-0 z-40"
          onClick={(e) => e.stopPropagation()}
        >
          <OnScreenRemote
            channel={channel}
            channelIdx={channelIdx}
            allChannels={allChannels}
            activeVideo={activeVideo}
            onSwitchChannel={(slug) => {
              switchChannel(slug);
              setShowRemote(false);
            }}
            onPrevChannel={prevChannel}
            onNextChannel={nextChannel}
            onClose={() => setShowRemote(false)}
            expanded={showRemote}
          />
        </div>
      )}
    </div>
  );
}
