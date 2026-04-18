"use client";

import MiniQR from "@/components/MiniQR";
import ViewersMap from "@/components/ViewersMap";

interface ViewerPin {
  lat: number;
  lng: number;
  city: string;
  isYou?: boolean;
}

interface Props {
  showMutedIndicator: boolean;
  pairingCode: string | null;
  sessionId: string | null;
  paired: boolean;
  showQR: boolean;
  qrDismissed: boolean;
  onDismissQR: () => void;
  channelNumber: string;
  showBanner: boolean;
  bannerChannelName?: string;
  bannerChannelIcon?: string;
  bannerVideoTitle?: string;
  showViewersMap: boolean;
  viewers: ViewerPin[];
  myLocation: ViewerPin | null;
  onDismissViewersMap: () => void;
}

/**
 * Non-interactive / lightly-interactive TV overlays stacked on top of
 * the video: muted hint, QR code, paired dot, channel-number input,
 * network-bug logo, viewers-joined map, watermark logo.
 */
export default function TVOverlays({
  showMutedIndicator,
  pairingCode,
  sessionId,
  paired,
  showQR,
  qrDismissed,
  onDismissQR,
  channelNumber,
  showBanner,
  bannerChannelName,
  bannerChannelIcon,
  bannerVideoTitle,
  showViewersMap,
  viewers,
  myLocation,
  onDismissViewersMap,
}: Props) {
  return (
    <>
      {showMutedIndicator && (
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

      {!paired && pairingCode && sessionId && showQR && !qrDismissed && (
        <div className="absolute top-4 right-4 z-50">
          <div
            className="relative cursor-pointer group"
            role="button"
            tabIndex={0}
            aria-label="Dismiss pairing QR code"
            onClick={(e) => { e.stopPropagation(); onDismissQR(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDismissQR(); } }}
            title="Click to dismiss"
          >
            <MiniQR code={pairingCode} />
            <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/50 group-active:bg-black/50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 group-active:opacity-100" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l6 6M8 2l-6 6" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {paired && (
        <div className="absolute top-4 right-4 z-50 pointer-events-none" aria-label="Remote paired" role="status">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
        </div>
      )}

      {channelNumber && (
        <div className="absolute top-8 left-8 z-50 bg-black/80 text-white text-5xl font-mono px-6 py-3 rounded-lg pointer-events-none" aria-live="polite" aria-label={`Channel ${channelNumber}`}>
          {channelNumber}
        </div>
      )}

      {showBanner && (
        <div className="absolute top-4 left-4 z-40 pointer-events-none flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/frogo/logo.png" alt="" aria-hidden="true" className="h-8 opacity-60" />
          {bannerChannelName && (
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 min-[1600px]:px-4 min-[1600px]:py-2">
              <div className="text-white/90 text-sm font-medium min-[1600px]:text-base">
                {bannerChannelIcon} {bannerChannelName}
              </div>
              {bannerVideoTitle && (
                <div className="text-white/50 text-xs truncate max-w-[300px] min-[1600px]:text-sm min-[1600px]:max-w-[400px]">
                  {bannerVideoTitle}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showViewersMap && (
        <div className="absolute bottom-14 left-4 z-30 transition-opacity duration-500 animate-in fade-in">
          <ViewersMap
            viewers={viewers}
            myLocation={myLocation}
            onDismiss={onDismissViewersMap}
          />
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-20 pointer-events-none opacity-40" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/frogo/logo.png" alt="" className="h-6" />
      </div>
    </>
  );
}
