#!/usr/bin/env node
/**
 * Backfill made_for_kids + mfk_checked_at for all existing videos.
 *
 * Uses the YouTube Data API `videos.list?part=status` endpoint, batched at
 * 50 IDs per call (1 quota unit per call, ~10k quota/day).
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-mfk.mjs
 *
 * Optional flags:
 *   --dry-run   Print what would change without writing to the database.
 *   --channel=<slug>   Limit to a single channel (for incremental runs).
 */
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const CHANNEL_FILTER = process.argv.find((a) => a.startsWith("--channel="))?.split("=")[1];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}
if (!YOUTUBE_API_KEY) {
  console.error("Missing YOUTUBE_API_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const API_BASE = "https://www.googleapis.com/youtube/v3";

// ─── Fetch videos from Supabase ────────────────────────────────────────────

let query = supabase
  .from("videos")
  .select("id, youtube_id, made_for_kids, mfk_checked_at, channels!videos_channel_id_fkey(slug)")
  .order("created_at");

if (CHANNEL_FILTER) {
  query = query.eq("channels!videos_channel_id_fkey.slug", CHANNEL_FILTER);
}

const { data: videos, error: fetchErr } = await query;
if (fetchErr) {
  console.error("Failed to fetch videos:", fetchErr.message);
  process.exit(1);
}

const unchecked = videos.filter((v) => v.mfk_checked_at === null);
const total = videos.length;
console.log(`Found ${total} video(s) total, ${unchecked.length} without mfk_checked_at.`);
if (CHANNEL_FILTER) console.log(`  (filtered to channel: ${CHANNEL_FILTER})`);
if (DRY_RUN) console.log("  --dry-run: no writes will happen");

if (unchecked.length === 0) {
  console.log("Nothing to backfill. Done.");
  process.exit(0);
}

// ─── Batch-fetch MFK status from YouTube ──────────────────────────────────

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchMfkBatch(ids) {
  const url = `${API_BASE}/videos?part=status&id=${ids.join(",")}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const out = new Map();
  for (const item of data.items ?? []) {
    if (item.id && typeof item.status?.madeForKids === "boolean") {
      out.set(item.id, item.status.madeForKids);
    }
  }
  return out;
}

// ─── Process in batches of 50 ─────────────────────────────────────────────

const ids = unchecked.map((v) => v.youtube_id);
const batches = chunk(ids, 50);

let updated = 0;
let noData = 0;
let errors = 0;
const mfkMap = new Map(); // youtube_id → madeForKids

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  console.log(`Batch ${i + 1}/${batches.length}: fetching ${batch.length} IDs from YouTube...`);
  try {
    const result = await fetchMfkBatch(batch);
    for (const [id, mfk] of result) mfkMap.set(id, mfk);
    const missing = batch.filter((id) => !result.has(id));
    if (missing.length > 0) {
      console.log(`  ${missing.length} IDs not returned by API (deleted/private): ${missing.join(", ")}`);
      noData += missing.length;
    }
  } catch (err) {
    console.error(`  Batch ${i + 1} failed:`, err.message);
    errors += batch.length;
  }
  // Brief pause between batches to avoid hitting rate limits.
  if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 250));
}

// ─── Write results to Supabase ─────────────────────────────────────────────

const checkedAt = new Date().toISOString();

for (const video of unchecked) {
  const mfk = mfkMap.get(video.youtube_id);
  if (typeof mfk !== "boolean") continue; // already counted as noData/error

  const channel = video.channels?.slug ?? "?";
  if (DRY_RUN) {
    console.log(`  [dry-run] ${channel} / ${video.youtube_id}: made_for_kids=${mfk}`);
    updated++;
    continue;
  }

  const { error: upErr } = await supabase
    .from("videos")
    .update({ made_for_kids: mfk, mfk_checked_at: checkedAt })
    .eq("id", video.id);

  if (upErr) {
    console.error(`  Failed to update ${video.youtube_id}:`, upErr.message);
    errors++;
  } else {
    updated++;
    if (mfk) console.log(`  [MFK=true] ${channel} / ${video.youtube_id}`);
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────

console.log("\n--- Backfill complete ---");
console.log(`  Updated : ${updated}`);
console.log(`  No API data : ${noData}`);
console.log(`  Errors  : ${errors}`);
if (errors > 0) process.exit(1);
