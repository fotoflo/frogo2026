"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import PairScreen from "./PairScreen";
import RemoteShell from "./RemoteShell";

function PairContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") ?? "";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [desktopSessionId, setDesktopSessionId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [log, setLog] = useState<string[]>([]);
  const addLog = useRef((msg: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  }).current;

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
      setDesktopSessionId(data.desktopSessionId ?? null);
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
      .subscribe((st) => {
        if (st === "SUBSCRIBED") setConnected(true);
      });
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Auto-pair from QR code
  useEffect(() => {
    if (initialCode && initialCode.length === 4) {
      doPair(initialCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!paired || !sessionId) {
    return (
      <PairScreen
        onPair={doPair}
        initialCode={initialCode}
        loading={loading}
        error={error}
        status={status}
        log={log}
      />
    );
  }

  return (
    <RemoteShell
      sessionId={sessionId}
      desktopSessionId={desktopSessionId}
      connected={connected}
      onUnpair={() => {
        setPaired(false);
        setSessionId(null);
        setDesktopSessionId(null);
        setConnected(false);
        setStatus("Ready");
        setLog([]);
      }}
    />
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
