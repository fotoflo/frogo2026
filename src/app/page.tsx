import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { isMobileRequest } from "@/lib/mobile-detect";
import { watchHref } from "@/lib/channel-paths";

export default async function Home() {
  if (await isMobileRequest()) {
    redirect("/mobile");
  }

  const supabase = createServiceClient();

  // Get top-level channels ordered by position, pick the first
  const { data: channels } = await supabase
    .from("channels")
    .select("id, slug, parent_id")
    .order("position", { ascending: true, nullsFirst: false })
    .order("name");

  const first = channels?.find((c) => c.parent_id === null) ?? channels?.[0];

  if (first && channels) {
    redirect(watchHref(first, channels));
  }

  // Fallback if no channels exist
  return (
    <div className="flex items-center justify-center h-screen text-muted">
      No channels yet.
    </div>
  );
}
