"use client";

import { useEffect, useRef, useState } from "react";

interface Options {
  onNumber: (n: number) => void;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  onTogglePlay: () => void;
  onEscape?: () => void;
  onToggleMute?: () => void;
  /** Called whenever the user starts typing a multi-digit channel number. */
  onChannelNumberInput?: (buffer: string) => void;
}

/**
 * TV-style keyboard: 0–9 buffers a multi-digit channel number and flushes
 * after 1s of no input; arrows flip channels; space toggles play; `f`
 * toggles fullscreen; Escape bubbles up to `onEscape`.
 *
 * Returns the current in-progress number buffer for overlay display.
 */
export function useTVKeyboard(opts: Options) {
  const [channelNumber, setChannelNumber] = useState("");
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setChannelNumber((prev) => {
          const next = prev + e.key;
          optsRef.current.onChannelNumberInput?.(next);
          if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = setTimeout(() => {
            const num = parseInt(next, 10);
            if (num >= 1) optsRef.current.onNumber(num);
            setChannelNumber("");
            optsRef.current.onChannelNumberInput?.("");
          }, 1000);
          return next;
        });
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          optsRef.current.onPrevChannel();
          break;
        case "ArrowDown":
          e.preventDefault();
          optsRef.current.onNextChannel();
          break;
        case " ":
          e.preventDefault();
          optsRef.current.onTogglePlay();
          break;
        case "f":
          document.documentElement.requestFullscreen?.();
          break;
        case "m":
          optsRef.current.onToggleMute?.();
          break;
        case "Escape":
          optsRef.current.onEscape?.();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, []);

  return { channelNumber };
}
