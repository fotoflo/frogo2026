"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel, HUDState, Video, YTPlayer } from "./types";
import { useProgress } from "./useProgress";
import TopPanel from "./TopPanel";
import Directory from "./Directory";
import ChannelGrid from "./ChannelGrid";
import PlaylistStrip from "./PlaylistStrip";
import BottomPanel from "./BottomPanel";

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
  const progress = useProgress(playerRef);
  const localChannelNumber = (siblingIdx < 0 ? 0 : siblingIdx) + 1;

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
    setHUDState(hudState === "expanded" ? "minimized" : "expanded");
  }

  function handleMouseEnter() {
    if (hudState === "minimized" || hudState === "collapsed") {
      setHUDState("collapsed");
    }
  }

  return (
    <div
      className={`classic-hud ${hudState}`}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={handleMouseEnter}
      onMouseMove={resetIdleTimer}
    >
      <TopPanel
        channel={channel}
        ancestors={ancestors}
        localChannelNumber={localChannelNumber}
        hudState={hudState}
        onNavigateToScope={onNavigateToScope}
        onToggleHUD={toggleHUD}
        showQRButton={showQRButton}
        onShowQR={onShowQR}
      />

      {hudState === "expanded" && (
        <div className="hud-content">
          <Directory
            ancestors={ancestors}
            siblings={siblings}
            allChannels={allChannels}
            onNavigateToScope={onNavigateToScope}
            onSwitchChannel={onSwitchChannel}
          />
          <ChannelGrid
            channel={channel}
            siblings={siblings}
            allChannels={allChannels}
            onSwitchChannel={onSwitchChannel}
          />
        </div>
      )}

      {hudState !== "expanded" && (
        <PlaylistStrip
          videos={channel.videos}
          currentVideoIndex={currentVideoIndex}
          onJumpToVideo={onJumpToVideo}
        />
      )}

      <BottomPanel
        activeVideo={activeVideo}
        channel={channel}
        localChannelNumber={localChannelNumber}
        progress={progress}
        onPrevVideo={onPrevVideo}
        onNextVideo={onNextVideo}
        onTogglePlay={onTogglePlay}
        onPrevChannel={onPrevChannel}
        onNextChannel={onNextChannel}
        onVote={onVote}
      />
    </div>
  );
}
