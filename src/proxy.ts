/**
 * Next.js 16 proxy — runs before every matched request.
 *
 * Calls Supabase session refresh so server components see fresh auth cookies.
 * Unlike typical proxies, this one does NOT gate /admin or redirect — the
 * admin route group handles its own auth with a server-side redirect. Keeping
 * the proxy passive means public pages (/, /watch, /pair) stay unaffected.
 */
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Match everything except static assets and API routes that don't need auth
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
