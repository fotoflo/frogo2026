"use client";

import { useEffect, useState } from "react";
import { QRCode } from "react-qrcode-logo";

interface MiniQRProps {
  code: string;
}

export default function MiniQR({ code }: MiniQRProps) {
  const [pairUrl, setPairUrl] = useState("");

  useEffect(() => {
    // Use the network-accessible URL so phones on the same WiFi can reach it.
    // Check for tunnel URL first, then try network IP, fallback to origin.
    fetch("/api/tunnel-url")
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          setPairUrl(`${data.url}/pair?code=${code}`);
        } else {
          // Use hostname — if accessed via localhost, swap to network IP
          const origin = window.location.origin;
          if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
            // Fetch the network IP from the server
            fetch("/api/network-ip")
              .then((r) => r.json())
              .then((d) => {
                if (d.ip) {
                  setPairUrl(`http://${d.ip}:${window.location.port}/pair?code=${code}`);
                } else {
                  setPairUrl(`${origin}/pair?code=${code}`);
                }
              });
          } else {
            setPairUrl(`${origin}/pair?code=${code}`);
          }
        }
      })
      .catch(() => {
        setPairUrl(`${window.location.origin}/pair?code=${code}`);
      });
  }, [code]);

  if (!pairUrl) return null;

  return (
    <div className="flex flex-col items-center bg-black/60 backdrop-blur-sm rounded-lg p-2">
      <div className="rounded bg-white p-1">
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
      <div className="font-mono text-sm font-bold text-white tracking-widest mt-1">{code}</div>
      <div className="text-[9px] text-white/50">scan to pair</div>
    </div>
  );
}
