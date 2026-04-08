#!/usr/bin/env node

/**
 * FrogoTV dev server — starts Next.js on port 5555 with ngrok tunnel
 * so phone pairing works over the network.
 */

import { spawn } from "child_process";
import { execSync } from "child_process";

const PORT = 5555;

// Kill anything on our port
try {
  execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`);
} catch {}

// Delete .next build cache
try {
  execSync("rm -rf .next");
} catch {}

// Start vitest in watch mode
const vitest = spawn("npx", ["vitest", "watch", "--reporter=dot"], {
  stdio: "inherit",
  env: { ...process.env },
});

// Start Next.js
const next = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  stdio: "inherit",
  env: { ...process.env },
});

// Start ngrok tunnel
async function startTunnel() {
  try {
    // Load NGROK_AUTHTOKEN from .env.local if not already in env
    if (!process.env.NGROK_AUTHTOKEN) {
      const { readFileSync } = await import("fs");
      try {
        const envFile = readFileSync(".env.local", "utf8");
        const match = envFile.match(/^NGROK_AUTHTOKEN=(.+)$/m);
        if (match) process.env.NGROK_AUTHTOKEN = match[1].trim();
      } catch {}
    }
    const ngrok = await import("@ngrok/ngrok");
    const listener = await ngrok.forward({
      addr: PORT,
      authtoken_from_env: true,
    });
    const url = listener.url();
    console.log(`\n🐸 FrogoTV tunnel: ${url}\n`);
    console.log(`   QR codes will use this URL for pairing.\n`);

    // Write the tunnel URL to a file so the app can read it
    const { writeFileSync } = await import("fs");
    writeFileSync(".ngrok-url", url);
  } catch {
    console.log("\n⚠️  ngrok not available — pairing QR will use localhost");
    console.log("   Install: npm i -D @ngrok/ngrok");
    console.log("   Set NGROK_AUTHTOKEN in .env.local\n");
  }
}

startTunnel();

next.on("exit", (code) => {
  vitest.kill();
  process.exit(code ?? 0);
});
process.on("SIGINT", () => {
  next.kill();
  vitest.kill();
  process.exit(0);
});
