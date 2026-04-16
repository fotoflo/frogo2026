"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { QRCode } from "react-qrcode-logo";

interface MiniQRProps {
  code: string;
}

function subscribe() {
  return () => {};
}

export default function MiniQR({ code }: MiniQRProps) {
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => ""
  );
  const port = useSyncExternalStore(
    subscribe,
    () => window.location.port,
    () => ""
  );
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const [tunnelBase, setTunnelBase] = useState<string | null>(null);

  useEffect(() => {
    if (!origin || !isLocal) return;
    let cancelled = false;
    fetch("/api/tunnel-url")
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        if (data.url) {
          setTunnelBase(data.url);
          return;
        }
        const d = await fetch("/api/network-ip").then((r) => r.json());
        if (cancelled) return;
        if (d.ip) setTunnelBase(`http://${d.ip}:${port}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [origin, isLocal, port]);

  if (!origin) return null;

  const base = isLocal && tunnelBase ? tunnelBase : origin;
  const pairUrl = `${base}/pair?code=${code}`;

  return (
    <div className="flex flex-col items-center bg-black/60 backdrop-blur-sm rounded-lg p-3 min-[1600px]:p-4" aria-label={`Scan QR code or enter code ${code} to pair your remote`}>
      <div className="rounded bg-white p-1.5 min-[1600px]:p-2" aria-hidden="true">
        <QRCode
          value={pairUrl}
          size={112}
          bgColor="#ffffff"
          fgColor="#000000"
          qrStyle="dots"
          eyeRadius={6}
          quietZone={0}
        />
      </div>
      <div className="font-mono text-lg font-bold text-white tracking-widest mt-2 min-[1600px]:text-xl" aria-label={`Pairing code: ${code}`}>{code}</div>
      <div className="text-[11px] text-white/60 uppercase tracking-wider mt-0.5 min-[1600px]:text-xs" aria-hidden="true">pair remote</div>
    </div>
  );
}
