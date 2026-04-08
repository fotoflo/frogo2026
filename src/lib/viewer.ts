import { createServiceClient } from "@/lib/supabase";
import { cookies } from "next/headers";

const VIEWER_COOKIE = "frogo_viewer";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

/**
 * Get or create an anonymous viewer from the cookie token.
 * Call from server components or API routes.
 */
export async function getOrCreateViewer(): Promise<{ id: string; token: string }> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(VIEWER_COOKIE)?.value;

  const supabase = createServiceClient();

  // Try to find existing viewer
  if (existingToken) {
    const { data } = await supabase
      .from("viewers")
      .select("id, token")
      .eq("token", existingToken)
      .single();

    if (data) return data;
  }

  // Create new viewer
  const { data, error } = await supabase
    .from("viewers")
    .insert({})
    .select("id, token")
    .single();

  if (error || !data) throw new Error("Failed to create viewer");

  // Set cookie (will be applied on the response)
  cookieStore.set(VIEWER_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return data;
}
