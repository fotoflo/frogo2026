"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2000);
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
    showToast(error ? `ERR: ${error.message}` : `sent: ${command}`);
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

  // Pairing screen
  if (!paired) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-6">📱</div>
          <h1 className="text-2xl font-bold text-white mb-2">Pair as Remote</h1>
          <p className="text-sm text-white/50 mb-8">
            Enter the code shown on your TV
          </p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full text-center text-4xl font-mono font-bold tracking-[0.4em] bg-zinc-900 border border-white/10 rounded-xl px-4 py-6 text-white focus:outline-none focus:border-accent"
            placeholder="0000"
            autoFocus
          />

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <p className="text-white/30 text-xs mt-2">{status}</p>
          {log.length > 0 && (
            <div className="mt-4 text-left bg-zinc-900 rounded-lg p-3 max-h-40 overflow-y-auto">
              {log.map((l, i) => (
                <div key={i} className="text-[10px] text-green-400 font-mono">{l}</div>
              ))}
            </div>
          )}

          <button
            onClick={() => doPair(code)}
            onTouchEnd={(e) => { e.preventDefault(); doPair(code); }}
            disabled={code.length !== 4 || loading}
            className="w-full mt-6 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-4 text-lg transition-colors touch-manipulation"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    );
  }

  // Remote control
  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* Debug toast */}
      {toast && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-white/10 text-white text-xs font-mono px-3 py-1.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-white/60">
            Connected{connected ? " - live" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="text-sm text-accent"
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
            className="text-sm text-red-400"
          >
            Unpair
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="px-4 py-3 border-b border-white/10">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos..."
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((v: SearchResult) => (
                <button
                  key={v.id}
                  onClick={() => {
                    const ch = v.channels;
                    if (ch?.slug) sendCommand(`navigate_${ch.slug}`);
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className="w-full text-left flex gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{v.title}</div>
                    <div className="text-[10px] text-white/40">
                      {v.channels?.icon} {v.channels?.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Channel Up/Down */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <button
          onClick={() => sendCommand("prev")}
          className="w-full max-w-xs py-12 rounded-2xl bg-zinc-900 border border-white/10 active:bg-white/10 transition-colors flex flex-col items-center"
        >
          <span className="text-3xl">▲</span>
          <span className="text-sm text-white/40 mt-1">CH+</span>
        </button>

        <button
          onClick={() => sendCommand("next")}
          className="w-full max-w-xs py-12 rounded-2xl bg-zinc-900 border border-white/10 active:bg-white/10 transition-colors flex flex-col items-center"
        >
          <span className="text-3xl">▼</span>
          <span className="text-sm text-white/40 mt-1">CH-</span>
        </button>
      </div>

      {/* Number pad */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => sendCommand(`channel_${n}`)}
              className="py-4 rounded-xl bg-zinc-900 border border-white/10 text-xl font-mono active:bg-white/10 transition-colors"
            >
              {n}
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
        <div className="flex items-center justify-center min-h-screen bg-black text-white/50">
          Loading...
        </div>
      }
    >
      <PairContent />
    </Suspense>
  );
}
