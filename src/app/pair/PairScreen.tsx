"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

interface PairScreenProps {
  onPair: (code: string) => Promise<void>;
  initialCode: string;
  loading: boolean;
  error: string | null;
  status: string;
  log: string[];
}

export default function PairScreen({ onPair, initialCode, loading, error, status, log }: PairScreenProps) {
  const [code, setCode] = useState(initialCode);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      onPair(joined);
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="min-h-screen remote-body remote-noise flex flex-col items-center justify-center px-6 relative overflow-hidden">
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
          <p className="text-sm text-white/40 mb-4">Enter the code on your TV</p>
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
            onClick={() => onPair(code)}
            onTouchEnd={(e) => { e.preventDefault(); onPair(code); }}
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

        <p className="text-white/20 text-xs mt-4" role="status" aria-live="polite">{status}</p>

        {log.length > 0 && (
          <details className="mt-4 text-left">
            <summary className="text-[10px] text-white/20 cursor-pointer hover:text-white/40">Debug log</summary>
            <div className="mt-2 bg-black/40 rounded-lg p-3 max-h-32 overflow-y-auto border border-white/5">
              {log.map((l, i) => (
                <div key={i} className="text-[10px] text-green-400/70 font-mono">{l}</div>
              ))}
            </div>
          </details>
        )}

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
