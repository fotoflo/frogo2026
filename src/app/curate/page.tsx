import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Program a Channel — Frogo.tv",
  description:
    "Program your own Frogo.tv channel just by chatting with Claude. No admin panels, no spreadsheets — just tell Claude what you want on air.",
};

const MCP_URL = "https://frogo.tv/api/mcp";

export default function CuratePage() {
  return (
    <div className="min-h-screen">
      {/* ─── Nav ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors inline-block"
        >
          &larr; Back to Frogo.tv
        </Link>
      </div>

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg px-4 py-1.5 text-xs text-muted mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          Now open to new curators
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
          Program your own
          <br />
          <span className="bg-gradient-to-r from-accent to-pink-400 bg-clip-text text-transparent">
            TV channel
          </span>{" "}
          by chatting
          <br />
          with Claude.
        </h1>
        <p className="text-lg text-muted max-w-xl mx-auto mb-10">
          Tell Claude what you want to broadcast. It builds the playlist,
          picks the order, and puts it on air — live on Frogo.tv for
          everyone to tune into.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a
            href="https://claude.ai/settings/connectors"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Connect Claude
            <span aria-hidden>&rarr;</span>
          </a>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-card-border bg-card-bg px-6 py-3 text-base font-medium hover:bg-card-border transition-colors"
          >
            Watch live
          </Link>
        </div>
      </section>

      {/* ─── What you get ─────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-3xl border border-card-border bg-gradient-to-br from-card-bg to-[#0f0a1f] p-8 sm:p-12">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl mb-3">📺</div>
              <div className="font-semibold mb-1">Your own channel</div>
              <div className="text-sm text-muted">
                A named spot on Frogo.tv that anyone can tune into.
              </div>
            </div>
            <div>
              <div className="text-5xl mb-3">🎬</div>
              <div className="font-semibold mb-1">Curated playlists</div>
              <div className="text-sm text-muted">
                Pick the videos. Set the order. Claude does the typing.
              </div>
            </div>
            <div>
              <div className="text-5xl mb-3">🌐</div>
              <div className="font-semibold mb-1">Always broadcasting</div>
              <div className="text-sm text-muted">
                Loops every half hour. Viewers join mid-show, like real TV.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How to connect ──────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-widest text-accent font-semibold mb-2">
            Setup
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Three clicks. One sign-in.
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-card-border bg-card-bg p-6">
            <div className="text-4xl mb-4">1️⃣</div>
            <div className="font-semibold mb-2">Open Claude settings</div>
            <div className="text-sm text-muted mb-4">
              Go to Connectors in your Claude.ai settings.
            </div>
            <a
              href="https://claude.ai/settings/connectors"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              claude.ai/settings/connectors &rarr;
            </a>
          </div>

          <div className="rounded-2xl border border-card-border bg-card-bg p-6">
            <div className="text-4xl mb-4">2️⃣</div>
            <div className="font-semibold mb-2">Add a custom connector</div>
            <div className="text-sm text-muted mb-4">
              Name it <span className="font-mono">frogotv</span> and paste
              this URL:
            </div>
            <div className="rounded-lg bg-[#0a0a0a] border border-card-border px-3 py-2 font-mono text-xs break-all select-all">
              {MCP_URL}
            </div>
          </div>

          <div className="rounded-2xl border border-card-border bg-card-bg p-6">
            <div className="text-4xl mb-4">3️⃣</div>
            <div className="font-semibold mb-2">Sign in with Google</div>
            <div className="text-sm text-muted">
              Approve the authorization screen. Done — Claude can now
              program your channel.
            </div>
          </div>
        </div>
      </section>

      {/* ─── Example chat ────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest text-accent font-semibold mb-2">
            What it feels like
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Just tell Claude what you want on air.
          </h2>
        </div>

        <div className="rounded-2xl border border-card-border bg-card-bg p-6 sm:p-8 space-y-5">
          {/* User bubble */}
          <div className="flex justify-end">
            <div className="max-w-sm rounded-2xl rounded-tr-sm bg-accent px-5 py-3 text-sm">
              Hey Claude, make me a chill lo-fi jazz channel and put 10 good
              late-night study tracks on it.
            </div>
          </div>
          {/* Claude bubble */}
          <div className="flex justify-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent to-pink-400 flex items-center justify-center text-xs">
              ✦
            </div>
            <div className="max-w-md rounded-2xl rounded-tl-sm border border-card-border bg-[#0a0a0a] px-5 py-3 text-sm text-foreground/90">
              Created <strong>Lo-fi Jazz</strong> at{" "}
              <span className="font-mono text-xs">frogo.tv/watch/lo-fi-jazz</span>{" "}
              and added 10 tracks. It&apos;s on air now — the loop resets
              at the next half-hour mark.
            </div>
          </div>
          {/* User bubble */}
          <div className="flex justify-end">
            <div className="max-w-sm rounded-2xl rounded-tr-sm bg-accent px-5 py-3 text-sm">
              Move the Nujabes track to the top.
            </div>
          </div>
          {/* Claude bubble */}
          <div className="flex justify-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent to-pink-400 flex items-center justify-center text-xs">
              ✦
            </div>
            <div className="max-w-md rounded-2xl rounded-tl-sm border border-card-border bg-[#0a0a0a] px-5 py-3 text-sm text-foreground/90">
              Done. Reordered 10 videos — Nujabes is now first.
            </div>
          </div>
        </div>
      </section>

      {/* ─── What Claude can do ──────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest text-accent font-semibold mb-2">
            Powers
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            What Claude can do for you.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Power
            emoji="✨"
            title="Create channels"
            blurb="Spin up a new channel with a name, description, and icon."
          />
          <Power
            emoji="➕"
            title="Add videos"
            blurb="Drop any YouTube URL into a channel and it's on air."
          />
          <Power
            emoji="🔀"
            title="Reorder the loop"
            blurb="Ask Claude to shuffle, sort, or put a specific video first."
          />
          <Power
            emoji="🗑️"
            title="Remove videos"
            blurb="Prune anything that's not working. No undo needed — just ask again."
          />
          <Power
            emoji="📂"
            title="Nest into categories"
            blurb="Organize channels under parents like /kids or /music."
          />
          <Power
            emoji="📋"
            title="Review what's on air"
            blurb="Ask Claude to list your channels and their current playlists."
          />
        </div>
      </section>

      {/* ─── Broadcasting explainer ──────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-3xl border border-card-border bg-gradient-to-br from-[#1a0f2e] to-card-bg p-8 sm:p-12 text-center">
          <div className="text-5xl mb-4">📡</div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            It&apos;s a broadcast, not a library.
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            Every channel loops its playlist on the half hour. Whoever
            tunes in lands at exactly the same spot as everyone else
            watching. Aim for <strong className="text-foreground">15–30
            minutes</strong> of tight, curated programming — think MTV
            block, not Netflix queue.
          </p>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24 text-center">
        <div className="inline-block mb-8">
          <Image
            src="/images/frogo/frogo-icon.png"
            alt="Frogo"
            width={64}
            height={64}
            className="rounded-2xl"
          />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Ready to go on air?
        </h2>
        <p className="text-muted mb-8 max-w-md mx-auto">
          Connect Claude in three clicks. Start programming your channel
          in the next five minutes.
        </p>
        <a
          href="https://claude.ai/settings/connectors"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Connect Claude to Frogo.tv
          <span aria-hidden>&rarr;</span>
        </a>
        <div className="mt-6 text-xs text-muted">
          Free. Owned channels only. Sign in with Google.
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="mx-auto max-w-5xl px-6 py-10 border-t border-card-border text-center text-xs text-muted">
        <div className="flex gap-6 justify-center mb-3">
          <Link href="/" className="hover:text-foreground transition-colors">
            Watch
          </Link>
          <Link href="/about" className="hover:text-foreground transition-colors">
            About
          </Link>
          <a
            href="https://github.com/fotoflo/frogo2026"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
        <div>Frogo.tv · 2026</div>
      </footer>
    </div>
  );
}

function Power({
  emoji,
  title,
  blurb,
}: {
  emoji: string;
  title: string;
  blurb: string;
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-5 hover:border-accent/50 transition-colors">
      <div className="text-3xl mb-3">{emoji}</div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-muted">{blurb}</div>
    </div>
  );
}
