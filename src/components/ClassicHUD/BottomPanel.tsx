"use client";

import { useState } from "react";
import type { Channel, Video } from "./types";
import { formatTime, type ProgressState } from "./useProgress";

interface Props {
  activeVideo: Video | null;
  channel: Channel;
  localChannelNumber: number;
  progress: ProgressState;
  onPrevVideo: () => void;
  onNextVideo: () => void;
  onTogglePlay: () => void;
  isPlaying?: boolean;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  onVote?: (upvote: boolean) => void;
}

const CTRL_BTN =
  "hud-ctrl-btn w-[30px] h-[30px] rounded-lg pointer-coarse:w-11 pointer-coarse:h-11 pointer-coarse:rounded-[10px] min-[1600px]:w-10 min-[1600px]:h-10 min-[1600px]:rounded-[10px] min-[2000px]:w-12 min-[2000px]:h-12 min-[2000px]:rounded-xl active:bg-white/10";
const CTRL_SVG =
  "w-3.5 h-3.5 pointer-coarse:w-5 pointer-coarse:h-5 min-[1600px]:w-5 min-[1600px]:h-5 min-[2000px]:w-6 min-[2000px]:h-6";
const CTRL_SVG_SM =
  "w-3 h-3 pointer-coarse:w-4 pointer-coarse:h-4 min-[1600px]:w-4 min-[1600px]:h-4 min-[2000px]:w-5 min-[2000px]:h-5";
const CTRL_SVG_LG =
  "w-4 h-4 pointer-coarse:w-6 pointer-coarse:h-6 min-[1600px]:w-[22px] min-[1600px]:h-[22px] min-[2000px]:w-[26px] min-[2000px]:h-[26px]";
const DIVIDER =
  "w-px h-5 bg-white/10 mx-1 pointer-coarse:h-7 min-[1600px]:h-6 min-[2000px]:h-7";

export default function BottomPanel({
  activeVideo,
  channel,
  localChannelNumber,
  progress,
  onPrevVideo,
  onNextVideo,
  onTogglePlay,
  isPlaying,
  onPrevChannel,
  onNextChannel,
  onVote,
}: Props) {
  const { barRef, progress: pct, currentTime, duration, handleScrubStart, handleTouchScrubStart } = progress;
  const [copied, setCopied] = useState(false);

  return (
    <div className="hud-bottom-panel h-[52px] px-3 py-1.5 gap-3 pointer-coarse:h-[72px] pointer-coarse:px-4 pointer-coarse:gap-4 min-[1600px]:h-[68px] min-[1600px]:px-[18px] min-[1600px]:py-2 min-[1600px]:gap-4 min-[2000px]:h-20 min-[2000px]:px-6 min-[2000px]:py-2.5 min-[2000px]:gap-5">
      <div
        ref={barRef}
        className="hud-progress-bar hud-progress-bar-interactive h-1 hover:h-2 pointer-coarse:h-[6px] pointer-coarse:active:h-2.5 min-[1600px]:h-1.5 min-[1600px]:hover:h-2.5 touch-none"
        role="slider"
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        tabIndex={0}
        onMouseDown={handleScrubStart}
        onTouchStart={handleTouchScrubStart}
      >
        <div className="hud-progress-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
        <div
          className="hud-progress-handle w-3 h-3 -ml-1.5 -mt-1.5 pointer-coarse:w-5 pointer-coarse:h-5 pointer-coarse:-ml-2.5 pointer-coarse:-mt-2.5 min-[1600px]:w-4 min-[1600px]:h-4 min-[1600px]:-ml-2 min-[1600px]:-mt-2"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        />
      </div>

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
              className="w-10 h-[30px] rounded border border-white/10 object-cover shrink-0 min-[1600px]:w-14 min-[1600px]:h-10 min-[2000px]:w-16 min-[2000px]:h-12"
            />
            <div className="min-w-0">
              <div className="text-[11px] text-white/70 truncate leading-tight min-[1600px]:text-sm min-[2000px]:text-base">
                {activeVideo.title}
              </div>
              <div className="text-[10px] text-white/30 truncate min-[1600px]:text-xs min-[2000px]:text-sm">
                {channel.icon} {channel.name}
              </div>
            </div>
          </>
        )}
      </div>

      <span className="text-[10px] font-mono text-white/40 shrink-0 min-[1600px]:text-xs min-[2000px]:text-sm">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {onVote && (
        <div className="flex items-center gap-1" role="group" aria-label="Vote">
          <button onClick={() => onVote(true)} className={CTRL_BTN} title="Upvote" aria-label="Upvote">
            <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG} aria-hidden="true">
              <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66a4.8 4.8 0 0 0-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84A2.34 2.34 0 0 0 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z"/>
            </svg>
          </button>
          <button onClick={() => onVote(false)} className={CTRL_BTN} title="Downvote" aria-label="Downvote">
            <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG} aria-hidden="true">
              <path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h5.5l-.92 4.65c-.05.22-.02.46.08.66.23.45.52.86.88 1.22L10 22l6.41-6.41c.38-.38.59-.89.59-1.42V6.34A2.34 2.34 0 0 0 14.66 4H6.56c-.71 0-1.37.37-1.73.97L2.17 11.12z"/>
            </svg>
          </button>
          <div className={DIVIDER} aria-hidden="true" />
        </div>
      )}

      <div className="flex items-center gap-1" role="group" aria-label="Player controls">
        <button onClick={onPrevVideo} className={CTRL_BTN} title="Previous Video" aria-label="Previous video">
          <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG} aria-hidden="true">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>
        <button
          onClick={onTogglePlay}
          className={`${CTRL_BTN} hud-ctrl-btn-primary`}
          title={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG_LG} aria-hidden="true">
            {isPlaying ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /> : <path d="M8 5v14l11-7z" />}
          </svg>
        </button>
        <button onClick={onNextVideo} className={CTRL_BTN} title="Next Video" aria-label="Next video">
          <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG} aria-hidden="true">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
        <div className={DIVIDER} aria-hidden="true" />
        <button onClick={onPrevChannel} className={CTRL_BTN} title="Previous Channel" aria-label="Previous channel">
          <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG_SM} aria-hidden="true">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>
        <span
          className="text-xs font-mono text-accent/80 w-6 text-center min-[1600px]:text-sm min-[1600px]:w-8 min-[2000px]:text-base min-[2000px]:w-10"
          aria-label={`Channel ${localChannelNumber}`}
        >
          {localChannelNumber}
        </span>
        <button onClick={onNextChannel} className={CTRL_BTN} title="Next Channel" aria-label="Next channel">
          <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG_SM} aria-hidden="true">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
        <div className={DIVIDER} aria-hidden="true" />
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className={CTRL_BTN}
          title={copied ? "Copied!" : "Copy link"}
          aria-label="Copy shareable link"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG} aria-hidden="true">
            {copied
              ? <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              : <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />}
          </svg>
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen?.();
            }
          }}
          className={CTRL_BTN}
          title="Fullscreen"
          aria-label="Toggle fullscreen"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG} aria-hidden="true">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
