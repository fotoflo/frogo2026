"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface SearchResultChannel {
  slug?: string;
  icon?: string;
  name?: string;
}

interface SearchResult {
  id: string;
  title: string;
  channels?: SearchResultChannel;
}

function PairContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") ?? "";

  const [code, setCode] = useState(initialCode);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [log, setLog] = useState<string[]>([]);
  function addLog(msg: string) {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  }

  async function doPair(pairCode: string) {
    addLog(`doPair called with "${pairCode}"`);
    if (pairCode.length !== 4) {
      addLog("Code not 4 digits, aborting");
      return;
    }
    setError(null);
    setLoading(true);
    setStatus("Connecting...");
    addLog("Fetching /api/pair/join...");
    try {
      const res = await fetch("/api/pair/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pairCode.trim() }),
      });
      addLog(`Response: ${res.status}`);
      const data = await res.json();
      addLog(`Data: ${JSON.stringify(data)}`);
      if (data.error) {
        setError(data.error);
        setStatus("Error: " + data.error);
        return;
      }
      setSessionId(data.sessionId);
      setPaired(true);
      setStatus("Paired!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`Catch: ${message}`);
      setError(message);
      setStatus("Fetch failed: " + message);
    } finally {
      setLoading(false);
    }
  }

  // Debug toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 1500);
  }

  // Send a command
  async function sendCommand(command: string) {
    if (!sessionId) return;
    const { error } = await supabase
      .from("pairing_sessions")
      .update({
        last_command: command,
        last_command_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    showToast(error ? `ERR: ${error.message}` : command);
  }

  // Search videos
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results);
    }, 300);
  }, [searchQuery]);

  // Subscribe to Realtime
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`remote:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pairing_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => {}
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Auto-pair from QR code
  useEffect(() => {
    if (initialCode && initialCode.length === 4) {
      doPair(initialCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only once on mount

  // Handle individual digit inputs
  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = code.split("");
    newCode[index] = digit;
    const joined = newCode.join("").replace(/undefined/g, "");
    setCode(joined);
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (joined.length === 4) {
      doPair(joined);
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  // ─── Pairing Screen ───
  if (!paired) {
    return (
      <div className="min-h-screen remote-body remote-noise flex flex-col items-center justify-center px-6 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-accent/8 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm text-center relative z-10">
          {/* Logo */}
          <div className="animate-slide-up mb-8">
            <Image
              src="/images/frogo/frogo-logo-200.png"
              alt="Frogo"
              width={80}
              height={80}
              className="mx-auto drop-shadow-[0_0_20px_rgba(124,92,252,0.3)]"
            />
            <h1 className="text-lg font-medium text-white/70 mt-3 tracking-wide">
              frogo<span className="text-accent">.tv</span>
            </h1>
            <p className="text-xs text-white/30 mt-1">Phone Remote</p>
          </div>

          {/* Code entry */}
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <p className="text-sm text-white/40 mb-4">
              Enter the code on your TV
            </p>

            <div className="flex gap-3 justify-center mb-4" role="group" aria-label="Pairing code digits">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  suppressHydrationWarning
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={code[i] ?? ""}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(i, e)}
                  aria-label={`Digit ${i + 1} of 4`}
                  className="w-16 h-20 text-center text-3xl font-mono font-bold bg-[#12122a] border-2 border-white/8 rounded-xl text-white focus:outline-none focus:border-accent/60 focus:shadow-[0_0_20px_rgba(124,92,252,0.15)] transition-all"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && (
              <p className="text-red-400/80 text-sm mt-3 animate-slide-up">{error}</p>
            )}
          </div>

          {/* Connect button */}
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <button
              onClick={() => doPair(code)}
              onTouchEnd={(e) => { e.preventDefault(); doPair(code); }}
              disabled={code.length !== 4 || loading}
              aria-busy={loading}
              className="w-full mt-4 rounded-xl bg-accent/90 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium py-4 text-base transition-all active:scale-[0.98] touch-manipulation shadow-[0_4px_20px_rgba(124,92,252,0.25)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  Connecting...
                </span>
              ) : (
                "Connect"
              )}
            </button>
          </div>

          {/* Status text */}
          <p className="text-white/20 text-xs mt-4" role="status" aria-live="polite">{status}</p>

          {/* Debug log (collapsed by default) */}
          {log.length > 0 && (
            <details className="mt-4 text-left">
              <summary className="text-[10px] text-white/20 cursor-pointer hover:text-white/40">
                Debug log
              </summary>
              <div className="mt-2 bg-black/40 rounded-lg p-3 max-h-32 overflow-y-auto border border-white/5">
                {log.map((l, i) => (
                  <div key={i} className="text-[10px] text-green-400/70 font-mono">{l}</div>
                ))}
              </div>
            </details>
          )}

          {/* Watch on phone link */}
          <Link
            href="/mobile"
            className="inline-block mt-6 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Or just watch on this device &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // ─── Remote Control ───
  return (
    <div className="min-h-screen remote-body remote-noise text-white flex flex-col relative overflow-hidden">
      {/* Subtle scan line effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div className="w-full h-px bg-white" style={{ animation: "scan-line 8s linear infinite" }} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 animate-slide-up" role="status" aria-live="polite">
          <div className="bg-accent/20 backdrop-blur-md border border-accent/30 text-accent text-xs font-mono px-4 py-2 rounded-full shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <Image
            src="/images/frogo/frogo-logo-200.png"
            alt="Frogo"
            width={28}
            height={28}
            className="opacity-80"
          />
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-yellow-500"} animate-pulse`} />
            <span className="text-xs text-white/40">
              {connected ? "Live" : "Connecting"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/mobile"
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            Watch
          </Link>
          <button
            onClick={() => setShowSearch(!showSearch)}
            aria-expanded={showSearch}
            aria-controls="search-panel"
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            {showSearch ? "Close" : "Search"}
          </button>
          <button
            onClick={() => {
              setPaired(false);
              setSessionId(null);
              setCode("");
              setConnected(false);
              setStatus("Ready");
              setLog([]);
            }}
            className="px-3 py-1.5 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            Unpair
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div id="search-panel" className="px-5 pb-3 animate-slide-up relative z-10">
          <div className="relative">
            <label htmlFor="remote-search" className="sr-only">Search videos</label>
            <input
              id="remote-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos..."
              className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/40 transition-all"
              autoFocus
            />
          </div>
          {searchResults.length > 0 && (
            <ul className="mt-2 max-h-52 overflow-y-auto space-y-0.5 rounded-xl bg-black/40 border border-white/5 p-1" role="listbox" aria-label="Search results">
              {searchResults.map((v: SearchResult) => (
                <li key={v.id} role="option" aria-selected={false}>
                  <button
                    onClick={() => {
                      const ch = v.channels;
                      if (ch?.slug) sendCommand(`navigate_${ch.slug}`);
                      setShowSearch(false);
                      setSearchQuery("");
                    }}
                    className="w-full text-left flex gap-3 p-3 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate text-white/80">{v.title}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">
                        {v.channels?.icon} {v.channels?.name}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Channel Rocker */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 relative z-10" role="group" aria-label="Channel rocker">
        {/* Ambient glow behind rocker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-accent/5 blur-[80px] pointer-events-none" aria-hidden="true" />

        <button
          onClick={() => sendCommand("prev")}
          onTouchEnd={(e) => { e.preventDefault(); sendCommand("prev"); }}
          aria-label="Previous channel"
          className="rocker-btn w-full max-w-[280px] py-10 rounded-t-[28px] rounded-b-xl flex flex-col items-center gap-1 touch-manipulation"
        >
          <svg width="28" height="16" viewBox="0 0 28 16" fill="none" className="text-white/60" aria-hidden="true">
            <path d="M14 2L26 14H2L14 2Z" fill="currentColor" />
          </svg>
          <span className="text-[11px] font-medium text-white/30 tracking-widest uppercase mt-1" aria-hidden="true">CH +</span>
        </button>

        {/* Center divider with label */}
        <div className="w-full max-w-[280px] flex items-center gap-4 py-1" aria-hidden="true">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[10px] text-white/20 font-mono tracking-wider">CHANNEL</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        <button
          onClick={() => sendCommand("next")}
          onTouchEnd={(e) => { e.preventDefault(); sendCommand("next"); }}
          aria-label="Next channel"
          className="rocker-btn w-full max-w-[280px] py-10 rounded-b-[28px] rounded-t-xl flex flex-col items-center gap-1 touch-manipulation"
        >
          <span className="text-[11px] font-medium text-white/30 tracking-widest uppercase mb-1" aria-hidden="true">CH -</span>
          <svg width="28" height="16" viewBox="0 0 28 16" fill="none" className="text-white/60" aria-hidden="true">
            <path d="M14 14L2 2H26L14 14Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Number Pad */}
      <div className="px-6 pb-8 pt-4 relative z-10" role="group" aria-label="Direct tune">
        <div className="flex items-center gap-4 mb-4 px-2" aria-hidden="true">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[10px] text-white/15 font-mono tracking-wider">DIRECT TUNE</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
        <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => sendCommand(`channel_${n}`)}
              onTouchEnd={(e) => { e.preventDefault(); sendCommand(`channel_${n}`); }}
              aria-label={`Channel ${n}`}
              className="remote-btn py-5 rounded-2xl text-xl font-mono text-white/70 touch-manipulation relative overflow-hidden group"
            >
              <span className="relative z-10" aria-hidden="true">{n}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PairPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen remote-body text-white/30">
          <Image
            src="/images/frogo/frogo-logo-200.png"
            alt="Loading"
            width={48}
            height={48}
            className="opacity-30 animate-pulse"
          />
        </div>
      }
    >
      <PairContent />
    </Suspense>
  );
}
