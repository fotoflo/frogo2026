"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shows TV chrome (HUD / lower-third / QR) on mouse movement, fades it
 * after inactivity. The QR "lingers" for qrLingerMs after chrome disappears,
 * so viewers always have a window to pair their phone.
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
  qrLingerMs = 30_000
): ChromeVisibility {
  const [mouseActive, setMouseActive] = useState(false);
  // Banner is on by default for the first `bannerMs` so viewers see the
  // network bug + channel card on initial load without an extra effect.
  const [showBanner, setShowBanner] = useState(true);
  const [qrHidden, setQrHidden] = useState(false);

  const mouseTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const mouseActiveRef = useRef(false);
  const showBannerRef = useRef(true);

  // Reconcile QR visibility whenever either chrome input changes. Cancels a
  // pending hide if chrome is visible, schedules one if chrome just went
  // away. Called from event handlers and timeout callbacks — never from an
  // effect body — so setState stays out of the render path.
  const reconcileQr = useCallback(() => {
    const visible = mouseActiveRef.current || showBannerRef.current;
    if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    if (visible) {
      setQrHidden(false);
      return;
    }
    qrTimeoutRef.current = setTimeout(() => setQrHidden(true), qrLingerMs);
  }, [qrLingerMs]);

  const pingBanner = useCallback(() => {
    showBannerRef.current = true;
    setShowBanner(true);
    reconcileQr();
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => {
      showBannerRef.current = false;
      setShowBanner(false);
      reconcileQr();
    }, bannerMs);
  }, [bannerMs, reconcileQr]);

  useEffect(() => {
    function keepAlive() {
      mouseActiveRef.current = true;
      setMouseActive(true);
      reconcileQr();
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
      mouseTimeoutRef.current = setTimeout(() => {
        mouseActiveRef.current = false;
        setMouseActive(false);
        reconcileQr();
      }, mouseInactiveMs);
    }
    // Touch devices never fire mousemove — tapping or dragging must also
    // keep chrome alive, otherwise iPad users can't summon the HUD back.
    window.addEventListener("mousemove", keepAlive);
    window.addEventListener("touchstart", keepAlive, { passive: true });
    window.addEventListener("touchmove", keepAlive, { passive: true });
    return () => {
      window.removeEventListener("mousemove", keepAlive);
      window.removeEventListener("touchstart", keepAlive);
      window.removeEventListener("touchmove", keepAlive);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    };
  }, [mouseInactiveMs, reconcileQr]);

  // Initial banner auto-hides after bannerMs. Timeout callback runs async —
  // not in the effect body — so setState here is fine.
  useEffect(() => {
    const t = setTimeout(() => {
      showBannerRef.current = false;
      setShowBanner(false);
      reconcileQr();
    }, bannerMs);
    return () => {
      clearTimeout(t);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    };
  }, [bannerMs, reconcileQr]);

  return { mouseActive, showBanner, showQR: !qrHidden, pingBanner };
}
