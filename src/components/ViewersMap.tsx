"use client";

import { Map, Overlay } from "pigeon-maps";
import { useMemo } from "react";

interface ViewerPin {
  lat: number;
  lng: number;
  city: string;
  isYou?: boolean;
}

interface ViewersMapProps {
  viewers: ViewerPin[];
  myLocation: ViewerPin | null;
  onDismiss: () => void;
}

function positronProvider(x: number, y: number, z: number, dpr?: number) {
  return `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${z}/${x}/${y}${dpr && dpr >= 2 ? "@2x" : ""}.png`;
}

export default function ViewersMap({ viewers, myLocation, onDismiss }: ViewersMapProps) {
  // Calculate center and zoom to fit all pins
  const { center, zoom } = useMemo(() => {
    const allPins = [...viewers];
    if (allPins.length === 0 && myLocation) {
      return { center: [myLocation.lat, myLocation.lng] as [number, number], zoom: 10 };
    }
    if (allPins.length === 0) {
      return { center: [40.7128, -74.006] as [number, number], zoom: 3 };
    }
    if (allPins.length === 1) {
      return { center: [allPins[0].lat, allPins[0].lng] as [number, number], zoom: 10 };
    }

    const lats = allPins.map((p) => p.lat);
    const lngs = allPins.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const span = Math.max(latSpan, lngSpan);

    let z = 10;
    if (span > 100) z = 2;
    else if (span > 40) z = 3;
    else if (span > 20) z = 4;
    else if (span > 10) z = 5;
    else if (span > 5) z = 6;
    else if (span > 2) z = 7;
    else if (span > 1) z = 8;
    else if (span > 0.5) z = 9;

    return { center: [centerLat, centerLng] as [number, number], zoom: z };
  }, [viewers, myLocation]);

  const viewerCount = viewers.length;

  return (
    <div
      className="relative w-[220px] h-[200px] rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.6)] border border-white/10 bg-black/80"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-1.5 bg-black/70 backdrop-blur-sm">
        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
          {viewerCount} viewer{viewerCount !== 1 ? "s" : ""} watching
        </span>
        <button
          onClick={onDismiss}
          className="text-white/50 hover:text-white/90 transition-colors"
          aria-label="Dismiss viewers map"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </button>
      </div>

      {/* Map with dark mode inversion */}
      <div className="absolute inset-0 pt-7 filter invert-[.95] hue-rotate-[180deg] saturate-150 brightness-[1.05] contrast-[1.1] opacity-90">
        <Map
          provider={positronProvider}
          center={center}
          zoom={zoom}
          animate={true}
          animateMaxScreens={8}
          mouseEvents={false}
          touchEvents={false}
          attribution={false}
          attributionPrefix={false}
        >
          {viewers.map((viewer, i) => {
            const isMe =
              myLocation &&
              Math.abs(viewer.lat - myLocation.lat) < 0.001 &&
              Math.abs(viewer.lng - myLocation.lng) < 0.001;

            return (
              <Overlay
                key={`${viewer.lat}-${viewer.lng}-${i}`}
                anchor={[viewer.lat, viewer.lng]}
                offset={[12, 12]}
              >
                <div className="flex items-center gap-1.5 -translate-y-1/2 -translate-x-1/2">
                  <div
                    className={`rounded-full transition-transform duration-500 ease-out ${
                      isMe
                        ? "w-3 h-3 bg-[#7c5cfc] shadow-[0_0_16px_rgba(124,92,252,0.9)] animate-pulse"
                        : "w-2 h-2 bg-[#7c5cfc] shadow-[0_0_10px_rgba(124,92,252,0.7)] animate-pulse"
                    }`}
                    style={{ animation: `fill-in 0.5s ease-out ${i * 0.08}s both` }}
                  />
                  {isMe && (
                    <span className="text-white text-[8px] font-bold tracking-[0.1em] uppercase bg-black/60 px-1 py-0.5 rounded backdrop-blur-md border border-white/10 whitespace-nowrap">
                      You
                    </span>
                  )}
                </div>
              </Overlay>
            );
          })}
        </Map>
      </div>

      {/* Keyframe animation for pin entrance */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fill-in {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </div>
  );
}
