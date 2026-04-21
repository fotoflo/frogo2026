/**
 * Reserved slugs that cannot be used as channel names.
 * These are routed to pages, API endpoints, or special handling.
 */

// Reserved for per-folder child-slug convention (e.g., /channel/xxx)
const RESERVED = [
  "about",
  "admin",
  "api",
  "channel",
  "curate",
  "login",
  "mobile",
  "pair",
  "v",
  "watch",
  "_next",
  "favicon.ico",
  "sitemap.xml",
  "robots.txt",
  "manifest.json",
  "images",
  "sitemap",
  "robots",
] as const;

export const RESERVED_SLUGS: ReadonlySet<string> = new Set(
  RESERVED.map((slug) => slug.toLowerCase())
);

/**
 * Check if a slug is reserved (case-insensitive).
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
