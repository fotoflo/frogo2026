# OG Image Generation & Caching

OpenGraph images are generated per channel so shared links on social platforms show a branded preview.

## Key Files

- `src/app/watch/[slug]/opengraph-image.tsx` -- generates and caches OG images (file-based metadata convention)
- `src/app/api/og-warm/route.ts` -- pre-warm endpoint to trigger generation ahead of time

## Image Layout (1200x630 JPEG)

- Full-bleed first-video thumbnail as background
- Dark gradient overlay (heavier at bottom for readability)
- Centered play button (white circle with triangle)
- Bottom bar: Frogo logo (120px) + channel name (56px bold white)
- 4px purple accent line at the very bottom

## Compression

The `next/og` `ImageResponse` produces a PNG (~300-350KB). Before serving or caching, the image is compressed to JPEG (~75KB) using `sharp` with mozjpeg at quality 80. The response `contentType` is `image/jpeg`.

## Caching Pipeline

Two layers of caching keep OG image generation fast:

### 1. Supabase Storage Cache

Generated JPEGs are uploaded to the `og-images` Supabase Storage bucket. The cache key is `{slug}/{firstVideoId}.jpg`, so the cache invalidates automatically when a channel's first video changes (playlist reorder, new video added, etc.).

On each request:
1. Generate the cache key from the channel slug + first video ID
2. Try to fetch a signed URL for the cached file from Supabase Storage
3. If the cached file exists and is fetchable, return it directly with 24-hour `Cache-Control`
4. Otherwise, generate the image, compress it, upload to Storage (fire-and-forget), and return the compressed JPEG

### 2. Next.js Revalidation

`revalidate = 300` (5 minutes). Next.js will serve the cached response and re-run the handler in the background after 5 minutes. Since the Supabase Storage check is fast, most revalidation hits resolve from the storage cache.

## Thumbnail Validation

The `checkImage()` helper validates YouTube thumbnails via HTTP HEAD before rendering:
1. Tries `maxresdefault.jpg` first (highest quality)
2. Falls back to `hqdefault.jpg` if maxres fails
3. Rejects non-`image/*` content-type responses
4. Rejects tiny responses (<2KB) -- YouTube returns small placeholders for missing thumbnails
5. 3-second timeout per request

## Pre-Warming Endpoint

`POST /api/og-warm` triggers OG image generation before social crawlers arrive.

- `POST /api/og-warm { slug: "philosophy" }` -- warm a single channel
- `POST /api/og-warm` (no body) -- warm all channels

The endpoint fetches each channel's `/watch/{slug}/opengraph-image` route in parallel with a 30-second timeout per request. Returns a JSON array of `{ slug, ok }` results.

## Important Patterns

- Uses `runtime = "nodejs"` (not Edge) -- required for `sharp` and full Node.js fetch
- Service client (`createServiceClient()`) for server-side Supabase access
- `AbortSignal.timeout(3000)` prevents slow thumbnail checks from blocking generation
- Async `params` (Next.js 15+ pattern): `params: Promise<{ slug: string }>`
- `sharp` added as a direct dependency in `package.json`
