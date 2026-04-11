import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become a Curator — Frogo.tv",
  description:
    "Curate a Frogo.tv channel from Claude. Connect the frogotv MCP tool and build your own broadcast playlist in natural language.",
};

const MCP_URL = "https://frogo.tv/api/mcp";

const tools = [
  {
    name: "list_channels",
    blurb: "See every channel you own, with video counts.",
  },
  {
    name: "get_channel",
    blurb: "Inspect one channel's full playlist.",
  },
  {
    name: "create_channel",
    blurb: "Spin up a new channel, optionally nested under a parent.",
  },
  {
    name: "add_video",
    blurb: "Append a YouTube video to a channel's playlist.",
  },
  {
    name: "delete_video",
    blurb: "Remove a video from a playlist.",
  },
  {
    name: "reorder_videos",
    blurb: "Set the playlist order.",
  },
];

const examplePrompts = [
  "Create a channel called 'Lo-fi Jazz' with description 'Late-night study beats' and add the top 10 lofi jazz videos on YouTube.",
  "Under my /kids channel, make a sub-channel called 'Maruko' and fill it with the first season of Chibi Maruko-chan.",
  "Reorder the videos in my /business/startups channel so the YC interviews come first, then the a16z talks.",
];

export default function CuratePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted hover:text-foreground transition-colors mb-8 inline-block"
      >
        &larr; Back
      </Link>

      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Become a Frogo.tv Curator
      </h1>
      <p className="text-muted mb-8 max-w-lg">
        Frogo.tv channels are curated YouTube playlists that loop on a
        half-hour broadcast schedule. You can build and tune your own channels
        from inside Claude — no admin panel required. We expose a small set of
        tools over the Model Context Protocol so Claude can list, create, fill,
        and reorder your channels on your behalf.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">
          1. Connect frogotv to Claude
        </h2>
        <p className="text-sm text-muted mb-4">
          Add Frogo.tv as a remote MCP connector in Claude. This is a
          one-time setup — Claude will sign you in with Google and remember
          the connection.
        </p>
        <ol className="space-y-3 text-sm list-decimal pl-5 marker:text-muted">
          <li>
            Open Claude at{" "}
            <a
              href="https://claude.ai/settings/connectors"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              claude.ai/settings/connectors
            </a>
            .
          </li>
          <li>
            Click <strong>Add custom connector</strong>.
          </li>
          <li>
            Name it <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-card-bg border border-card-border">frogotv</code> and paste this
            URL:
            <div className="mt-2 rounded-lg border border-card-border bg-card-bg px-3 py-2 font-mono text-xs break-all select-all">
              {MCP_URL}
            </div>
          </li>
          <li>
            Click <strong>Connect</strong>. You&apos;ll be redirected to
            Google sign-in, then an authorization screen. Approve it.
          </li>
          <li>
            That&apos;s it — Claude can now manage your Frogo.tv channels.
          </li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">2. Try it out</h2>
        <p className="text-sm text-muted mb-4">
          Start a new chat in Claude and ask it to do something with your
          channels. A few prompts to try:
        </p>
        <div className="space-y-3">
          {examplePrompts.map((p) => (
            <div
              key={p}
              className="rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm"
            >
              &ldquo;{p}&rdquo;
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">What Claude can do</h2>
        <p className="text-sm text-muted mb-4">
          The frogotv connector exposes six tools, all scoped to channels you
          own. Nothing else is touched — Claude can&apos;t see anyone
          else&apos;s channels, their OAuth tokens, or the rest of the
          database.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {tools.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-card-border bg-card-bg p-4"
            >
              <div className="font-mono text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted mt-1">{t.blurb}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">How broadcasting works</h2>
        <p className="text-sm text-muted">
          Frogo.tv is a broadcast, not an on-demand player. Every channel
          loops its playlist on half-hour boundaries (:00 and :30), so
          whoever tunes in joins mid-show at exactly the same spot as
          everyone else watching. A good channel is <strong>15-30 minutes
          of curated content</strong> per loop — think of it like
          programming an MTV block, not uploading to a library.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Requirements</h2>
        <ul className="text-sm text-muted space-y-2 list-disc pl-5 marker:text-muted">
          <li>A Google account to sign in with.</li>
          <li>A Claude.ai account with access to custom connectors.</li>
          <li>Videos must be public YouTube videos (no age-gated or
            region-blocked content — the broadcast loop skips unavailable
            videos).</li>
        </ul>
      </section>

      <section className="mt-12 pt-8 border-t border-card-border">
        <h2 className="text-xl font-semibold mb-3">Something not working?</h2>
        <p className="text-sm text-muted">
          If Claude says it can&apos;t fetch YouTube metadata for a video,
          that&apos;s a known issue — YouTube occasionally blocks our
          server-side fetch from datacenter IPs. Ask Claude to retry with
          the title and duration passed in explicitly; the{" "}
          <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-card-bg border border-card-border">add_video</code> tool accepts
          both as optional arguments so Claude can supply them from its own
          YouTube lookup.
        </p>
        <p className="text-sm text-muted mt-4">
          Questions or ideas? Find us on{" "}
          <a
            href="https://github.com/fotoflo/frogo2026"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            GitHub
          </a>
          .
        </p>
      </section>

      <div className="mt-12 pt-8 border-t border-card-border flex gap-4 flex-wrap">
        <Link
          href="/"
          className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Watch Frogo.tv
        </Link>
        <Link
          href="/about"
          className="inline-block rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-bg transition-colors"
        >
          About the project
        </Link>
      </div>
    </div>
  );
}
