"use client";

import { useRef, useEffect, type RefObject } from "react";

interface SwipeCallbacks {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const MIN_DISTANCE = 50;
const MAX_TIME = 500;

/**
 * Detects swipe gestures on a ref'd element.
 * Minimum 50px distance within 500ms to trigger.
 */
export function useSwipeGestures(ref: RefObject<HTMLElement | null>, callbacks: SwipeCallbacks) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    }

    function onTouchEnd(e: TouchEvent) {
      if (!startRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      const dt = Date.now() - startRef.current.t;
      startRef.current = null;

      if (dt > MAX_TIME) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > absDy && absDx > MIN_DISTANCE) {
        if (dx > 0) callbacks.onSwipeRight?.();
        else callbacks.onSwipeLeft?.();
      } else if (absDy > absDx && absDy > MIN_DISTANCE) {
        if (dy > 0) callbacks.onSwipeDown?.();
        else callbacks.onSwipeUp?.();
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, callbacks]);
}
