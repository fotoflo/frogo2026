import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Program a Channel — Frogo.tv",
  description:
    "Program your own Frogo.tv channel just by chatting with Claude. Step-by-step guide to connecting the frogotv MCP tool in Claude.ai.",
};

const MCP_URL = "https://frogo.tv/api/mcp";
const CLAUDE_CONNECTORS_URL = "https://claude.ai/customize/connectors";

export default function CuratePage() {
  return (
    <div className="min-h-screen">
      {/* ─── Nav ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-6 pt-8">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors inline-block"
        >
          &larr; Back to Frogo.tv
        </Link>
      </div>

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg px-4 py-1.5 text-xs text-muted mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          Open to new curators
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
          Program your own{" "}
          <span className="bg-gradient-to-r from-accent to-pink-400 bg-clip-text text-transparent">
            TV channel
          </span>
          <br />
          by chatting with Claude.
        </h1>
        <p className="text-lg text-muted max-w-xl mx-auto">
          Frogo.tv channels are curated YouTube playlists that loop on a
          half-hour broadcast. With the frogotv connector, you can create
          channels, add videos, and reorder them — all from inside Claude,
          in plain English.
        </p>
      </section>

      {/* ─── What you get ─────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="rounded-3xl border border-card-border bg-gradient-to-br from-card-bg to-[#0f0a1f] p-8 sm:p-10">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl mb-3">📺</div>
              <div className="font-semibold mb-1">Your own channel</div>
              <div className="text-sm text-muted">
                A named spot on Frogo.tv that anyone can tune into.
              </div>
            </div>
            <div>
              <div className="text-4xl mb-3">🎬</div>
              <div className="font-semibold mb-1">Curated playlists</div>
              <div className="text-sm text-muted">
                Pick the videos. Set the order. Claude does the typing.
              </div>
            </div>
            <div>
              <div className="text-4xl mb-3">🌐</div>
              <div className="font-semibold mb-1">Always broadcasting</div>
              <div className="text-sm text-muted">
                Loops every half hour. Viewers join mid-show, like real TV.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Setup walkthrough ───────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-widest text-accent font-semibold mb-2">
            Setup · takes about 2 minutes
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            How to connect Claude to Frogo.tv
          </h2>
          <p className="text-muted mt-4 max-w-lg mx-auto">
            You only do this once. After that, Claude remembers the
            connection and you can program your channels in any chat.
          </p>
        </div>

        {/* Step 1 */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white font-bold">
              1
            </div>
            <h3 className="text-xl font-semibold">
              Open your Claude connectors page
            </h3>
          </div>
          <p className="text-muted mb-5 pl-13">
            Sign in to Claude.ai and go to the{" "}
            <a
              href={CLAUDE_CONNECTORS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline font-medium"
            >
              Customize → Connectors
            </a>{" "}
            page. This is where you manage every app and service Claude can
            talk to.
          </p>
          <a
            href={CLAUDE_CONNECTORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-card-bg border border-card-border px-4 py-2 text-sm hover:border-accent transition-colors"
          >
            <span className="font-mono text-xs text-muted">
              {CLAUDE_CONNECTORS_URL}
            </span>
            <span aria-hidden>&rarr;</span>
          </a>
        </div>

        {/* Step 2 */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white font-bold">
              2
            </div>
            <h3 className="text-xl font-semibold">
              Add a custom connector
            </h3>
          </div>
          <p className="text-muted mb-5">
            Click <strong className="text-foreground">Browse connectors</strong>
            {" "}(top right), then scroll down to{" "}
            <strong className="text-foreground">Add custom connector</strong>.
            Fill it in:
          </p>
          <div className="space-y-3 mb-6">
            <div className="rounded-xl border border-card-border bg-card-bg p-4 flex items-center gap-4">
              <div className="text-xs uppercase tracking-wider text-muted w-20 flex-shrink-0">
                Name
              </div>
              <div className="font-mono text-sm">FrogoTV</div>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-4 flex items-start sm:items-center gap-4 flex-col sm:flex-row">
              <div className="text-xs uppercase tracking-wider text-muted w-20 flex-shrink-0">
                URL
              </div>
              <div className="font-mono text-sm break-all select-all bg-[#0a0a0a] rounded-lg px-3 py-2 border border-card-border flex-1">
                {MCP_URL}
              </div>
            </div>
          </div>
          <p className="text-muted mb-5">
            Click <strong className="text-foreground">Add</strong>. You&apos;ll
            see FrogoTV appear in your connectors list, like this:
          </p>
          <div className="rounded-2xl border border-card-border overflow-hidden">
            <Image
              src="/images/curate/connectors-list.png"
              alt="Screenshot: FrogoTV added to the Claude connectors list, showing https://frogo.tv/api/mcp"
              width={1704}
              height={908}
              className="w-full h-auto"
            />
          </div>
          <p className="text-xs text-muted mt-3 text-center italic">
            FrogoTV added alongside Google Drive, Gmail, and Calendar.
          </p>
        </div>

        {/* Step 3 */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white font-bold">
              3
            </div>
            <h3 className="text-xl font-semibold">Sign in with Google</h3>
          </div>
          <p className="text-muted mb-5">
            When you click <strong className="text-foreground">Configure</strong>{" "}
            (or first use a FrogoTV tool in a chat), Claude will pop open
            a window asking you to sign in. It walks you through Google
            OAuth and then shows a Frogo.tv authorization screen —{" "}
            <strong className="text-foreground">
              click Authorize
            </strong>
            . That&apos;s what links your Google account to Claude&apos;s
            access to your channels.
          </p>
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
            <strong className="text-foreground">Heads up:</strong>{" "}
            <span className="text-muted">
              Frogo.tv only lets you manage channels you own. Claude can&apos;t
              see anyone else&apos;s channels, and it can&apos;t touch
              anything outside the tools listed in step 4.
            </span>
          </div>
        </div>

        {/* Step 4 */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white font-bold">
              4
            </div>
            <h3 className="text-xl font-semibold">
              Review the tool permissions
            </h3>
          </div>
          <p className="text-muted mb-5">
            Once connected, Claude shows you exactly which tools it has
            access to. The frogotv connector exposes six tools — all
            scoped to your own channels:
          </p>
          <div className="rounded-2xl border border-card-border overflow-hidden">
            <Image
              src="/images/curate/tool-permissions.png"
              alt="Screenshot: the six FrogoTV tool permissions — add_video, create_channel, delete_video, get_channel, list_channels, reorder_videos"
              width={2000}
              height={1065}
              className="w-full h-auto"
            />
          </div>
          <p className="text-xs text-muted mt-3 text-center italic">
            Set every tool to &ldquo;Needs approval&rdquo; if you want to
            review each action Claude takes, or &ldquo;Auto-approve&rdquo;
            to let it work uninterrupted.
          </p>
        </div>

        {/* Step 5 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white font-bold">
              5
            </div>
            <h3 className="text-xl font-semibold">
              Start a chat and build your channel
            </h3>
          </div>
          <p className="text-muted">
            Open a fresh chat in Claude and try one of these prompts:
          </p>
        </div>

        {/* Example prompts */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-card-border bg-card-bg p-5 text-sm">
            <div className="text-xs text-muted mb-2">Try:</div>
            &ldquo;Make me a channel called{" "}
            <strong>Lo-fi Jazz</strong> and add 10 good late-night study
            tracks.&rdquo;
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5 text-sm">
            <div className="text-xs text-muted mb-2">Try:</div>
            &ldquo;Under my <strong>Kids</strong> channel, create a
            sub-channel for Chibi Maruko-chan and fill it with the first
            season.&rdquo;
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5 text-sm">
            <div className="text-xs text-muted mb-2">Try:</div>
            &ldquo;List my channels and tell me which one has the fewest
            videos.&rdquo;
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5 text-sm">
            <div className="text-xs text-muted mb-2">Try:</div>
            &ldquo;Reorder my <strong>startups</strong> channel so the YC
            interviews come first.&rdquo;
          </div>
        </div>
      </section>

      {/* ─── Broadcasting explainer ──────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="rounded-3xl border border-card-border bg-gradient-to-br from-[#1a0f2e] to-card-bg p-8 sm:p-10 text-center">
          <div className="text-4xl mb-4">📡</div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            It&apos;s a broadcast, not a library.
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            Every channel loops its playlist on the half hour. Whoever
            tunes in lands at exactly the same spot as everyone else
            watching. Aim for{" "}
            <strong className="text-foreground">15–30 minutes</strong>{" "}
            of tight, curated programming — think MTV block, not Netflix
            queue.
          </p>
        </div>
      </section>

      {/* ─── Troubleshooting ─────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="text-xl font-semibold mb-4">Something not working?</h2>
        <div className="space-y-4">
          <details className="rounded-xl border border-card-border bg-card-bg p-5 text-sm">
            <summary className="cursor-pointer font-medium">
              Claude says it can&apos;t fetch YouTube metadata.
            </summary>
            <p className="text-muted mt-3">
              This is a known issue — YouTube occasionally blocks our
              server-side fetch from datacenter IPs. Ask Claude to retry
              with the title and duration passed in explicitly; the{" "}
              <span className="font-mono text-xs bg-[#0a0a0a] px-1.5 py-0.5 rounded border border-card-border">
                add_video
              </span>{" "}
              tool accepts both as optional arguments.
            </p>
          </details>
          <details className="rounded-xl border border-card-border bg-card-bg p-5 text-sm">
            <summary className="cursor-pointer font-medium">
              The authorization screen is stuck or returned an error.
            </summary>
            <p className="text-muted mt-3">
              Disconnect FrogoTV from the Claude connectors page, then
              add it again. The OAuth session codes are short-lived
              (10 minutes), so if you got distracted mid-flow you&apos;ll
              need to restart.
            </p>
          </details>
          <details className="rounded-xl border border-card-border bg-card-bg p-5 text-sm">
            <summary className="cursor-pointer font-medium">
              Claude can&apos;t find a channel I know exists.
            </summary>
            <p className="text-muted mt-3">
              Claude can only see channels you own (your Google account
              must be the owner). If someone else set up the channel,
              you won&apos;t see it in <code>list_channels</code> even
              if you can watch it on frogo.tv.
            </p>
          </details>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <div className="inline-block mb-6">
          <Image
            src="/images/frogo/frogo-icon.png"
            alt="Frogo"
            width={56}
            height={56}
            className="rounded-2xl"
          />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
          Ready to go on air?
        </h2>
        <a
          href={CLAUDE_CONNECTORS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Open Claude connectors
          <span aria-hidden>&rarr;</span>
        </a>
        <div className="mt-6 text-xs text-muted">
          Free · Sign in with Google · Only manages channels you own
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="mx-auto max-w-4xl px-6 py-10 border-t border-card-border text-center text-xs text-muted">
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
