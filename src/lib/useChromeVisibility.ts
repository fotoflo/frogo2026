"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shows TV chrome (HUD / lower-third / QR) on mouse movement, fades it
 * after inactivity. The QR "lingers" for 10s after chrome disappears, so
 * viewers always have a window to pair their phone.
 *
 * `showBanner` fires briefly on channel change or initial load — the
 * network-bug logo + big channel card. Driven externally via the
 * returned `pingBanner` helper.
 */
export interface ChromeVisibility {
  mouseActive: boolean;
  showBanner: boolean;
  showQR: boolean;
  pingBanner: () => void;
}

export function useChromeVisibility(
  mouseInactiveMs = 2_500,
  bannerMs = 4_000,
  qrLingerMs = 10_000
): ChromeVisibility {
  const [mouseActive, setMouseActive] = useState(false);
  // Banner is on by default for the first `bannerMs` so viewers see the
  // network bug + channel card on initial load without an extra effect.
  const [showBanner, setShowBanner] = useState(true);
  const [qrHidden, setQrHidden] = useState(false);

  const mouseTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const prevChromeRef = useRef(false);

  const pingBanner = useCallback(() => {
    setShowBanner(true);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setShowBanner(false), bannerMs);
  }, [bannerMs]);

  // Mouse movement keeps chrome alive
  useEffect(() => {
    function keepAlive() {
      setMouseActive(true);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
      mouseTimeoutRef.current = setTimeout(
        () => setMouseActive(false),
        mouseInactiveMs
      );
    }
    window.addEventListener("mousemove", keepAlive);
    return () => {
      window.removeEventListener("mousemove", keepAlive);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    };
  }, [mouseInactiveMs]);

  // Initial banner — auto-hide after bannerMs. No setState-in-effect needed
  // since showBanner starts true.
  useEffect(() => {
    const t = setTimeout(() => setShowBanner(false), bannerMs);
    return () => {
      clearTimeout(t);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, [bannerMs]);

  // QR linger: hide qrLingerMs after chrome vanishes; show again the moment
  // chrome reappears. Single effect handles both transitions.
  const chromeVisible = mouseActive || showBanner;
  useEffect(() => {
    const wasVisible = prevChromeRef.current;
    prevChromeRef.current = chromeVisible;

    if (chromeVisible) {
      setQrHidden(false);
      return;
    }
    if (!wasVisible) return;
    qrTimeoutRef.current = setTimeout(() => setQrHidden(true), qrLingerMs);
    return () => {
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    };
  }, [chromeVisible, qrLingerMs]);

  return { mouseActive, showBanner, showQR: !qrHidden, pingBanner };
}
