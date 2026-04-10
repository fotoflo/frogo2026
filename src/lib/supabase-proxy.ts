/**
 * Session-refresh helper called from the root proxy.ts.
 *
 * Creates a server client, calls auth.getUser() to trigger any token refresh
 * (Supabase writes new cookies via setAll), and returns the augmented response.
 *
 * IMPORTANT: Do not run code between createServerClient and getUser() — any
 * side effect there can corrupt the refresh and randomly log users out.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // DO NOT REMOVE — triggers token refresh and writes new cookies via setAll.
  await supabase.auth.getUser();

  // IMPORTANT: return supabaseResponse unchanged so the refreshed cookies
  // flow back to the client. If you build a new NextResponse, copy cookies:
  //   myResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  return supabaseResponse;
}
