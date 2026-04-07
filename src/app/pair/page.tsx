"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PairContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") ?? "";

  const [code, setCode] = useState(initialCode);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  async function handlePair() {
    setError(null);
    const res = await fetch("/api/pair/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      return;
    }
    setSessionId(data.sessionId);
    setPaired(true);
  }

  async function sendCommand(command: string) {
    if (!sessionId) return;
    await fetch("/api/pair/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, command }),
    });
    if (command === "play") setIsPlaying(true);
    if (command === "pause") setIsPlaying(false);
  }

  // Auto-pair if code came from QR
  if (initialCode && !paired && !sessionId && !error) {
    handlePair();
  }

  if (!paired) {
    return (
      <div className="mx-auto max-w-sm px-6 py-16 text-center">
        <div className="text-5xl mb-6">📱</div>
        <h1 className="text-2xl font-bold mb-2">Pair as Remote</h1>
        <p className="text-sm text-muted mb-8">
          Enter the 4-digit code shown on your TV screen
        </p>

        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full text-center text-4xl font-mono font-bold tracking-[0.4em] bg-card-bg border border-card-border rounded-xl px-4 py-6 focus:outline-none focus:border-accent"
          placeholder="0000"
          autoFocus
        />

        {error && (
          <p className="text-red-400 text-sm mt-3">{error}</p>
        )}

        <button
          onClick={handlePair}
          disabled={code.length !== 4}
          className="w-full mt-6 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-4 text-lg transition-colors"
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 border border-green-500/30 px-4 py-2 text-green-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Connected to TV
        </div>
      </div>

      <div className="space-y-4">
        {/* Play/Pause */}
        <button
          onClick={() => sendCommand(isPlaying ? "pause" : "play")}
          className="w-full rounded-2xl bg-accent hover:bg-accent-hover text-white font-bold py-8 text-2xl transition-colors active:scale-95"
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>

        {/* Prev / Next */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => sendCommand("prev")}
            className="rounded-xl border border-card-border bg-card-bg hover:bg-white/5 text-foreground font-medium py-6 text-lg transition-colors active:scale-95"
          >
            ⏮ Prev
          </button>
          <button
            onClick={() => sendCommand("next")}
            className="rounded-xl border border-card-border bg-card-bg hover:bg-white/5 text-foreground font-medium py-6 text-lg transition-colors active:scale-95"
          >
            Next ⏭
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-muted mt-8">
        Code: <span className="font-mono">{code}</span>
      </p>
    </div>
  );
}

export default function PairPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32 text-muted">
          Loading...
        </div>
      }
    >
      <PairContent />
    </Suspense>
  );
}
