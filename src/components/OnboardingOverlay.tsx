"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { hasChildren } from "@/lib/channel-paths";

interface OnboardingChannel {
  id: string;
  slug: string;
  parent_id: string | null;
  path: string[];
  name: string;
  icon: string;
  description: string;
}

interface OnboardingOverlayProps {
  channels: OnboardingChannel[];
}

const STORAGE_KEY = "frogo_onboarded";

export default function OnboardingOverlay({ channels }: OnboardingOverlayProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  // Guard against SSR: only read localStorage client-side. Use a microtask
  // so we don't setState synchronously inside an effect (react-hooks/set-
  // state-in-effect) — same pattern as TVClient's resume logic.
  useEffect(() => {
    let cancelled = false;
    let shouldShow = true;
    try {
      shouldShow = localStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      // localStorage blocked — show once per session.
      shouldShow = true;
    }
    queueMicrotask(() => {
      if (!cancelled && shouldShow) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — still hide the overlay.
    }
    setVisible(false);
  }, []);

  const goTo = useCallback(
    (channel: OnboardingChannel) => {
      dismiss();
      router.push(`/${channel.path.join("/")}`);
    },
    [dismiss, router]
  );

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  // Top-level channels only. "Folders" = have children, "standalones" = don't.
  const topLevel = channels.filter((c) => c.parent_id === null);
  const folders = topLevel.filter((c) => hasChildren(c.id, channels));
  const standalones = topLevel.filter((c) => !hasChildren(c.id, channels));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="min-h-full flex flex-col">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-14 md:py-16 flex-1">
          {/* Hero */}
          <header className="text-center mb-10 md:mb-14 animate-fade-up">
            <div className="text-xs tracking-[0.2em] uppercase text-accent/90 mb-3">
              Frogo.tv
            </div>
            <h1
              id="onboarding-title"
              className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground tracking-tight"
            >
              Curated channels. Always on.
            </h1>
            <p className="mt-3 text-sm sm:text-base md:text-lg text-muted max-w-2xl mx-auto">
              Hand-picked folders, looping around the clock. No junk.
            </p>
          </header>

          {/* Folders */}
          {folders.length > 0 && (
            <section className="mb-10 md:mb-12 animate-fade-up delay-1">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-muted">
                  Folders
                </h2>
                <span className="text-xs text-muted/70">
                  Curated collections
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4">
                {folders.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => goTo(ch)}
                    className="group text-left rounded-xl bg-card-bg border border-card-border hover:border-accent/60 hover:bg-card-bg/80 transition-all p-4 md:p-5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black"
                    aria-label={`Open ${ch.name}`}
                  >
                    <div className="text-3xl md:text-4xl mb-2 md:mb-3 transition-transform group-hover:scale-110 origin-left">
                      {ch.icon}
                    </div>
                    <div className="text-base md:text-lg font-medium text-foreground mb-1 group-hover:text-accent transition-colors">
                      {ch.name}
                    </div>
                    {ch.description && (
                      <div className="text-xs md:text-sm text-muted line-clamp-2 leading-snug">
                        {ch.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Standalones */}
          {standalones.length > 0 && (
            <section className="mb-10 md:mb-12 animate-fade-up delay-2">
              <h2 className="text-sm font-semibold tracking-wider uppercase text-muted mb-4">
                More channels
              </h2>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {standalones.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => goTo(ch)}
                    className="flex items-center gap-2 rounded-full bg-card-bg border border-card-border hover:border-accent/60 hover:bg-card-bg/80 px-3 md:px-4 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black"
                    aria-label={`Open ${ch.name}`}
                  >
                    <span className="text-lg md:text-xl">{ch.icon}</span>
                    <span className="text-sm md:text-base text-foreground group-hover:text-accent">
                      {ch.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-white/5 animate-fade-up delay-3">
            <div className="text-xs md:text-sm text-muted flex items-center gap-2">
              <span aria-hidden="true" className="text-accent">↗</span>
              <span>
                Pair your phone using the QR code in the upper-right — use it as
                a remote.
              </span>
            </div>
            <button
              onClick={dismiss}
              className="self-end sm:self-auto rounded-lg bg-accent hover:bg-accent-hover text-white font-medium px-5 md:px-6 py-2.5 md:py-3 text-sm md:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black"
              autoFocus
            >
              Just watch
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
