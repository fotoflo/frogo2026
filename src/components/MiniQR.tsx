"use client";

import { useEffect, useState } from "react";
import { QRCode } from "react-qrcode-logo";

interface MiniQRProps {
  code: string;
}

export default function MiniQR({ code }: MiniQRProps) {
  const [pairUrl, setPairUrl] = useState("");

  useEffect(() => {
    const origin = window.location.origin;
    const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");

    if (!isLocal) {
      // Production / public URL — use it directly
      setPairUrl(`${origin}/pair?code=${code}`);
      return;
    }

    // Local dev: check for ngrok tunnel, then network IP, then fallback
    fetch("/api/tunnel-url")
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          setPairUrl(`${data.url}/pair?code=${code}`);
        } else {
          fetch("/api/network-ip")
            .then((r) => r.json())
            .then((d) => {
              if (d.ip) {
                setPairUrl(`http://${d.ip}:${window.location.port}/pair?code=${code}`);
              } else {
                setPairUrl(`${origin}/pair?code=${code}`);
              }
            });
        }
      })
      .catch(() => {
        setPairUrl(`${origin}/pair?code=${code}`);
      });
  }, [code]);

  if (!pairUrl) return null;

  return (
    <div className="flex flex-col items-center bg-black/60 backdrop-blur-sm rounded-lg p-2" aria-label={`Scan QR code or enter code ${code} to pair your phone`}>
      <div className="rounded bg-white p-1" aria-hidden="true">
        <QRCode
          value={pairUrl}
          size={56}
          bgColor="#ffffff"
          fgColor="#000000"
          qrStyle="dots"
          eyeRadius={4}
          quietZone={0}
        />
      </div>
      <div className="font-mono text-sm font-bold text-white tracking-widest mt-1" aria-label={`Pairing code: ${code}`}>{code}</div>
      <div className="text-[9px] text-white/50" aria-hidden="true">scan to pair</div>
    </div>
  );
}
