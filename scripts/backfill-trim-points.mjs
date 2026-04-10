#!/usr/bin/env node
/**
 * Backfill videos.start_seconds / videos.end_seconds from the original
 * frogo.tv playlist data. The old import-to-frogo2026.js script had this
 * data but stored only `duration_seconds = endTime - startTime`, discarding
 * the actual trim points. This script updates existing rows (matched by
 * channel slug + youtube_id) without touching duration_seconds.
 *
 * Run with: node --env-file=.env.local scripts/backfill-trim-points.mjs
 */
import { createClient } from "@supabase/supabase-js";

const CHANNELS = [
  {
    slug: "jon-stewart",
    videos: [
      { code: "Im8WhG-8FGw", endTime: 336 },
      { code: "TjxYPMm4Ru4", endTime: 429 },
      { code: "vmj6JADOZ-8", endTime: 377 },
      { code: "AkHq_wueVMw", endTime: 622 },
    ],
  },
  {
    slug: "buddah",
    videos: [
      { code: "zFbjDcz_CbU", startTime: 720, endTime: 1195 },
      { code: "yFmCVQWRReM", endTime: 296 },
      { code: "B0d6wmMEhXg", endTime: 169 },
    ],
  },
  {
    slug: "cat-videos",
    videos: [
      { code: "uIbkLjjlMV8", endTime: 531 },
      { code: "zi8VTeDHjcM", endTime: 181 },
      { code: "0iXHim3ToQ4", endTime: 106 },
      { code: "vaif2uq_0Vc", endTime: 100 },
      { code: "2XID_W4neJo", endTime: 178 },
      { code: "mTTwcCVajAc", endTime: 152 },
      { code: "IytNBm8WA1c", endTime: 470 },
      { code: "ctJJrBw7e-c", endTime: 199 },
    ],
  },
  {
    slug: "dogs",
    videos: [
      { code: "CQzUsTFqtW0", endTime: 88 },
      { code: "mUCRZzhbHH0", endTime: 91 },
      { code: "HqbVbPvlDoM", endTime: 187 },
      { code: "H3xdcx2WUcU", endTime: 209 },
      { code: "nlJWis5wH54", endTime: 589 },
    ],
  },
  {
    slug: "another",
    videos: [
      { code: "9E-WasNzVpI", endTime: 254 },
      { code: "Qt2mbGP6vFI", endTime: 290 },
      { code: "Kl5WP__1uMw", endTime: 258 },
      { code: "KXewIR7Y7cc", endTime: 210 },
      { code: "Pav2f4b-1ZE", endTime: 239 },
    ],
  },
  {
    slug: "viral-classics",
    videos: [
      { code: "v-jiDEsfMRA", endTime: 75 },
      { code: "GrnGi-q6iWc", endTime: 131 },
      { code: "cUwzxVu6n08", endTime: 140 },
      { code: "zdW7PvGZ0uM", endTime: 111 },
      { code: "BmUL72dIbTA", endTime: 728 },
      { code: "nU_dBDccruI", endTime: 456 },
    ],
  },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let updated = 0;
let notFound = 0;
let skipped = 0;

for (const ch of CHANNELS) {
  const { data: channel, error: cerr } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", ch.slug)
    .maybeSingle();

  if (cerr) {
    console.error(`  Error fetching ${ch.slug}:`, cerr.message);
    skipped += ch.videos.length;
    continue;
  }
  if (!channel) {
    console.log(`  Channel not found: ${ch.slug}`);
    skipped += ch.videos.length;
    continue;
  }

  console.log(`\n${ch.slug}`);

  for (const v of ch.videos) {
    const start = v.startTime ?? null;
    const end = v.endTime;
    const { data, error } = await supabase
      .from("videos")
      .update({ start_seconds: start, end_seconds: end })
      .eq("channel_id", channel.id)
      .eq("youtube_id", v.code)
      .select("id, title");

    if (error) {
      console.error(`  ✗ error: ${v.code} — ${error.message}`);
      notFound++;
      continue;
    }
    if (!data || data.length === 0) {
      console.log(`  ✗ not in db: ${v.code}`);
      notFound++;
    } else {
      const trim = start !== null ? `${start}-${end}` : `0-${end}`;
      console.log(`  ✓ ${v.code} [${trim}s] ${data[0].title}`);
      updated++;
    }
  }
}

console.log(`\nDone: ${updated} updated, ${notFound} not in db, ${skipped} skipped`);
