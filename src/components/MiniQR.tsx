"use client";

import { useEffect, useState } from "react";
import { QRCode } from "react-qrcode-logo";

interface MiniQRProps {
  code: string;
}

export default function MiniQR({ code }: MiniQRProps) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const pairUrl = origin ? `${origin}/pair?code=${code}` : "";

  if (!pairUrl) return null;

  return (
    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg p-2">
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
      <div className="text-right">
        <div className="font-mono text-sm font-bold text-white tracking-widest">{code}</div>
        <div className="text-[9px] text-white/50">scan to pair</div>
      </div>
    </div>
  );
}
