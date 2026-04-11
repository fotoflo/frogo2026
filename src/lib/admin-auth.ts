/**
 * Admin auth helper — returns the authed user plus their profile (role,
 * god_mode). Used by admin pages + server actions so each call site can
 * branch on god_mode to bypass owner_id scoping.
 *
 * Redirects unauthed requests into the OAuth flow.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";

export interface AdminProfile {
  role: "user" | "admin";
  god_mode: boolean;
}

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  // Use the service client for the profile lookup so it bypasses the
  // profiles_self_select RLS policy and can't mis-report god_mode.
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role, god_mode")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    profile: (profile ?? { role: "user", god_mode: false }) as AdminProfile,
  };
}
