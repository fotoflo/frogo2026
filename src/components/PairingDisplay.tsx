"use client";

import { useEffect, useState } from "react";
import { QRCode } from "react-qrcode-logo";

interface PairingDisplayProps {
  sessionId: string;
  code: string;
}

export default function PairingDisplay({ sessionId, code }: PairingDisplayProps) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const pairUrl = origin ? `${origin}/pair?code=${code}` : "";

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center">
      <h3 className="text-sm font-medium text-muted mb-4">
        Pair Your Phone as Remote
      </h3>

      {pairUrl && (
        <div className="inline-block rounded-lg bg-white p-2 mb-4">
          <QRCode
            value={pairUrl}
            size={140}
            bgColor="#ffffff"
            fgColor="#000000"
            qrStyle="dots"
            eyeRadius={8}
          />
        </div>
      )}

      <div className="mb-2">
        <span className="text-xs text-muted">or enter code</span>
      </div>
      <div className="font-mono text-3xl font-bold tracking-[0.3em] text-accent">
        {code}
      </div>
      <p className="text-xs text-muted mt-3">
        Scan QR or visit <span className="font-mono">/pair</span> on your phone
      </p>
    </div>
  );
}
