/**
 * Supabase browser client for authenticated client components.
 *
 * Uses @supabase/ssr to keep sessions in sync with cookies written by the
 * server client and proxy. Use this from "use client" components that need
 * to read the logged-in user.
 *
 * Legacy non-authed usages (Realtime pairing, etc.) still use the plain
 * client from `@/lib/supabase`. Don't replace those — they use the anon key
 * without any session concept.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
