"use client";

import type { Channel, HUDState } from "./types";

interface Props {
  channel: Channel;
  ancestors: Channel[];
  localChannelNumber: number;
  hudState: HUDState;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigateToScope: (channelId: string | null) => void;
  onToggleHUD: () => void;
  showQRButton?: boolean;
  onShowQR?: () => void;
}

const CTRL_BTN =
  "hud-ctrl-btn w-[30px] h-[30px] rounded-lg min-[1600px]:w-10 min-[1600px]:h-10 min-[2000px]:w-12 min-[2000px]:h-12";
const CTRL_SVG =
  "w-3.5 h-3.5 min-[1600px]:w-5 min-[1600px]:h-5 min-[2000px]:w-6 min-[2000px]:h-6";

export default function TopPanel({
  channel,
  ancestors,
  localChannelNumber,
  hudState,
  searchQuery,
  onSearchChange,
  onNavigateToScope,
  onToggleHUD,
  showQRButton,
  onShowQR,
}: Props) {
  const isCurrentInAncestors = ancestors.some((a) => a.id === channel.id);
  const isExpanded = hudState === "expanded";

  return (
    <div className="hud-top-panel h-9 px-3 min-[1600px]:h-12 min-[1600px]:px-[18px] min-[2000px]:h-14 min-[2000px]:px-[22px]">
      <div className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/frogo/logo.png"
          alt="frogo.tv"
          className="h-7 opacity-70 shrink-0 min-[1600px]:h-9 min-[2000px]:h-11"
        />
        <nav
          className="flex items-center gap-1 text-sm text-white/60 truncate min-w-0 min-[1600px]:text-base min-[2000px]:text-lg"
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
                    <span className="text-accent font-mono mr-1">{localChannelNumber}</span>
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
          {!isCurrentInAncestors && (
            <span className="flex items-center gap-1 min-w-0">
              <span className="text-white/25" aria-hidden="true">›</span>
              <span className="text-white/80 truncate" aria-current="page">
                <span className="text-accent font-mono mr-1">{localChannelNumber}</span>
                {channel.icon} {channel.name}
              </span>
            </span>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        {isExpanded && (
          <div className="relative shrink-0 min-w-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none min-[1600px]:w-4 min-[1600px]:h-4"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search channels"
              aria-label="Search channels"
              className="bg-white/[0.06] text-white placeholder:text-white/30 rounded-md pl-7 pr-7 py-1 text-xs w-[170px] border border-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/[0.09] transition-colors min-[1600px]:text-sm min-[1600px]:w-[220px] min-[1600px]:py-1.5 min-[1600px]:pl-8 min-[2000px]:text-base min-[2000px]:w-[280px]"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                aria-label="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 2l6 6M8 2l-6 6" />
                </svg>
              </button>
            )}
          </div>
        )}

        {showQRButton && onShowQR && (
          <button
            onClick={onShowQR}
            className={CTRL_BTN}
            title="Show pairing QR code"
            aria-label="Show pairing QR code"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className={CTRL_SVG} aria-hidden="true">
              <path d="M3 11h2V9H3v2zm0-4h2V3h4V1H3v6zm8-6v2h4V1h-4zm4 18h4v-2h-2v-2h-2v4zm-4 0h2v-4h-2v4zm-8-4h2v-2H3v2zm0-4h2v-2H3v2zm16-4V3h-4v2h2v2h2zm0 4h2V7h-2v4zm0 4h2v-2h-2v2zM7 13h4v-2H7v2zm-4 6h4v-4H3v4zm2-2v-2h2v2H5zM3 3v4h4V3H3zm2 2v2H5V5h2zm14 0v4h-4V3h4zm-2 2v2h-2V5h2zm-4 8h-2v2h2v2h2v-2h-2v-2zm-4 0H7v4h4v-2H9v-2z"/>
            </svg>
          </button>
        )}

        <button
          onClick={onToggleHUD}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Close channel guide" : "Browse channels"}
          className="text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-1 min-[1600px]:text-sm min-[1600px]:px-3 min-[1600px]:py-1.5 min-[2000px]:text-base min-[2000px]:px-4 min-[2000px]:py-2 flex items-center"
        >
          {isExpanded ? (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" className="w-3.5 h-3.5 min-[1600px]:w-4 min-[1600px]:h-4 min-[2000px]:w-5 min-[2000px]:h-5">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          ) : (
            "Browse"
          )}
        </button>
      </div>
    </div>
  );
}
