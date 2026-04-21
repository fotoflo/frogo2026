"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";
import OnScreenRemote from "@/components/OnScreenRemote";
import ClassicHUD from "@/components/ClassicHUD";
import { FEATURES } from "@/lib/settings";
import { useInteractions } from "@/lib/useInteractions";
import { useViewerPresence } from "@/lib/useViewerPresence";
import { usePairing } from "@/lib/usePairing";
import { usePairingSync } from "@/lib/usePairingSync";
import { useReactions } from "@/lib/useReactions";
import { useChatMessages } from "@/lib/useChatMessages";
import ReactionOverlay from "@/components/ReactionOverlay";
import ChatOverlay from "@/components/ChatOverlay";
import { useChromeVisibility } from "@/lib/useChromeVisibility";
import { useTVKeyboard } from "@/lib/useTVKeyboard";
import { useAutoplay } from "@/lib/useAutoplay";
import { useChannelNav } from "@/lib/useChannelNav";
import { readInitialResume, useWatchProgress } from "@/lib/useWatchProgress";
import { useWatchHistory } from "@/lib/useWatchHistory";
import TVOverlays from "./TVOverlays";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import type { ChannelData } from "./types";

interface TVClientProps {
  channels: ChannelData[];
  initialChannelIndex: number;
}

export default function TVClient({ channels, initialChannelIndex }: TVClientProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const { vote, trackEvent } = useInteractions();

  const { mouseActive, showBanner, showQR, pingBanner } = useChromeVisibility();
  const [showRemote, setShowRemote] = useState(false);
  const [hudHovered, setHudHovered] = useState(false);
  const [qrDismissed, setQrDismissed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const nav = useChannelNav({
    channels,
    initialChannelIndex,
    onChannelChange: (target) => {
      pingBanner();
      trackEvent("channel_switch", { slug: target.slug });
    },
  });
  const { channel, channelIdx, siblings, ancestors, siblingIdx } = nav;
  const videos = channel.videos;
  const { seenIds, markSeen } = useWatchHistory(channel.id);

  // Resume on mount / channel change: URL > localStorage > first video
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [startSeconds, setStartSeconds] = useState(0);
  const [playbackReady, setPlaybackReady] = useState(false);
  const activeVideo = videos[currentVideoIndex] || videos[0];

  useEffect(() => {
    const resume = readInitialResume(channel.id, videos);
    let idx = 0;
    if (resume.videoId) {
      const match = videos.findIndex(
        (v) => v.id === resume.videoId || v.youtube_id === resume.videoId
      );
      if (match >= 0) idx = match;
    }
    queueMicrotask(() => {
      setCurrentVideoIndex(idx);
      setStartSeconds(resume.videoId ? resume.positionSeconds : 0);
      setPlaybackReady(true);
    });
  }, [channel.id, videos]);

  const { viewers, myLocation, viewerCount } = useViewerPresence(channel.slug);
  const [showViewersMap, setShowViewersMap] = useState(false);
  const viewersMapTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const prevViewerCountRef = useRef(0);

  const { autoplay, onPlayerReady, handleScreenClick } = useAutoplay(playerRef);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReady = useCallback((player: any) => {
    playerRef.current = player;
    onPlayerReady();
  }, [onPlayerReady]);

  const basePath = useMemo(() => `/${channel.path.join("/")}`, [channel.path]);
  const { commitSeen, commitSkip } = useWatchProgress({
    channelId: channel.id,
    videoId: activeVideo?.id ?? null,
    videoTitle: activeVideo?.title ?? "",
    basePath,
    playerRef,
  });

  const advanceBy = useCallback(
    (delta: number, commit: () => void) => {
      commit();
      setCurrentVideoIndex((prev) => (prev + delta + videos.length) % videos.length);
      setStartSeconds(0);
    },
    [videos.length]
  );

  const handleEnded = useCallback(() => {
    if (activeVideo) markSeen(activeVideo.id);
    advanceBy(1, commitSeen);
  }, [advanceBy, commitSeen, activeVideo, markSeen]);
  const handleNextVideo = useCallback(() => advanceBy(1, commitSkip), [advanceBy, commitSkip]);
  const handlePrevVideo = useCallback(() => advanceBy(-1, commitSkip), [advanceBy, commitSkip]);

  const handleError = useCallback(() => {
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
    setStartSeconds(0);
  }, [videos.length]);

  const handleJumpToVideo = useCallback(
    (index: number) => {
      commitSkip();
      setCurrentVideoIndex(index);
      setStartSeconds(0);
    },
    [commitSkip]
  );

  const handleCommand = useCallback((command: string) => {
    const p = playerRef.current;
    switch (command) {
      case "next": nav.nextChannel(); break;
      case "prev": nav.prevChannel(); break;
      case "play_pause": handleScreenClick(); break;
      case "video_next": handleNextVideo(); break;
      case "video_prev": handlePrevVideo(); break;
      case "volume_up": if (p) { if (p.isMuted?.()) p.unMute?.(); p.setVolume?.(Math.min(100, (p.getVolume?.() ?? 50) + 10)); } break;
      case "volume_down": if (p) p.setVolume?.(Math.max(0, (p.getVolume?.() ?? 50) - 10)); break;
      case "mute_toggle": if (p) { p.isMuted?.() ? (p.unMute?.(), p.setVolume?.(100)) : p.mute?.(); } break;
      default:
        if (command.startsWith("channel_")) nav.switchToSiblingIdx(parseInt(command.split("_")[1], 10) - 1);
        else if (command.startsWith("navigate_")) nav.switchChannelById(command.replace("navigate_", ""));
    }
  }, [nav, handleScreenClick, handleNextVideo, handlePrevVideo, playerRef]);

  const { pairingCode, sessionId, paired } = usePairing(handleCommand, activeVideo?.id);
  usePairingSync({ sessionId, playerRef, channelId: channel.id, videoId: activeVideo?.id ?? null, isPlaying });
  const { reactions } = useReactions(sessionId ? sessionId : null);
  const chatMessages = useChatMessages(sessionId);
  const { channelNumber } = useTVKeyboard({
    onNumber: (n) => nav.switchToSiblingIdx(n - 1),
    onPrevChannel: nav.prevChannel,
    onNextChannel: nav.nextChannel,
    onTogglePlay: handleScreenClick,
    onEscape: () => setShowRemote(false),
    onToggleMute: () => {
      const p = playerRef.current;
      if (!p) return;
      if (p.isMuted?.()) {
        p.unMute?.();
        p.setVolume?.(100);
      } else {
        p.mute?.();
      }
    },
    onChannelNumberInput: (buf) => {
      if (buf) pingBanner();
    },
  });

  useEffect(() => {
    if (viewerCount >= 2 && viewerCount > prevViewerCountRef.current) {
      queueMicrotask(() => {
        setShowViewersMap(true);
      });
      if (viewersMapTimeoutRef.current) clearTimeout(viewersMapTimeoutRef.current);
      viewersMapTimeoutRef.current = setTimeout(() => setShowViewersMap(false), 15000);
    }
    prevViewerCountRef.current = viewerCount;
  }, [viewerCount]);

  // While unpaired, re-show the QR + banner every few minutes so latecomers
  // always have a window to grab their phone.
  useEffect(() => {
    if (paired) return;
    const id = setInterval(() => {
      setQrDismissed(false);
      pingBanner();
    }, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [paired, pingBanner]);

  const dismissViewersMap = useCallback(() => {
    setShowViewersMap(false);
    if (viewersMapTimeoutRef.current) clearTimeout(viewersMapTimeoutRef.current);
  }, []);

  return (
    <div className="fixed inset-0 bg-black" onClick={handleScreenClick}>
      {playbackReady && activeVideo && (
        <div className="absolute inset-0">
          <YouTubePlayer
            videoId={activeVideo.youtube_id}
            startSeconds={(activeVideo.start_seconds ?? 0) + startSeconds}
            endSeconds={activeVideo.end_seconds}
            madeForKids={activeVideo.made_for_kids}
            onReady={handleReady}
            onStateChange={(state) => setIsPlaying(state === 1)}
            onEnded={handleEnded}
            onError={handleError}
          />
        </div>
      )}

      <ReactionOverlay reactions={reactions} />
      <ChatOverlay messages={chatMessages} />

      <TVOverlays
        showMutedIndicator={autoplay.showMutedIndicator}
        pairingCode={pairingCode}
        sessionId={sessionId}
        paired={paired}
        showQR={showQR}
        qrDismissed={qrDismissed}
        onDismissQR={() => setQrDismissed(true)}
        channelNumber={channelNumber}
        showBanner={showBanner}
        bannerChannelName={channel.name}
        bannerChannelIcon={channel.icon}
        bannerVideoTitle={activeVideo?.title}
        showViewersMap={showViewersMap}
        viewers={viewers}
        myLocation={myLocation}
        onDismissViewersMap={dismissViewersMap}
      />

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
              onSwitchChannel={(id) => { nav.switchChannelById(id); setShowRemote(false); }}
              onNavigateToScope={(id) => { nav.navigateToScope(id); setShowRemote(false); }}
              onPrevChannel={nav.prevChannel}
              onNextChannel={nav.nextChannel}
              onNextVideo={handleNextVideo}
              onPrevVideo={handlePrevVideo}
              onVote={(upvote: boolean) => activeVideo && vote(activeVideo.id, upvote)}
              onTogglePlay={handleScreenClick}
              isPlaying={isPlaying}
              onJumpToVideo={handleJumpToVideo}
              seenVideoIds={seenIds}
              showQRButton={!paired && !!pairingCode && qrDismissed}
              onShowQR={() => setQrDismissed(false)}
            />
          </div>
        </div>
      ) : (
        (mouseActive || showRemote) && (
          <div className="absolute inset-0 z-40" onClick={(e) => e.stopPropagation()}>
            <OnScreenRemote
              channel={channel}
              channelIdx={channelIdx}
              allChannels={channels}
              activeVideo={activeVideo}
              onSwitchChannel={(id) => { nav.switchChannelById(id); setShowRemote(false); }}
              onPrevChannel={nav.prevChannel}
              onNextChannel={nav.nextChannel}
              onTogglePlay={handleScreenClick}
              onClose={() => setShowRemote(false)}
              expanded={showRemote}
            />
          </div>
        )
      )}

      <OnboardingOverlay channels={channels} />
    </div>
  );
}
