import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { isMobileRequest } from "@/lib/mobile-detect";

export default async function Home() {
  if (await isMobileRequest()) {
    redirect("/mobile");
  }

  const supabase = createServiceClient();

  // Get the first channel
  const { data: channel } = await supabase
    .from("channels")
    .select("id, slug")
    .order("name")
    .limit(1)
    .single();

  if (channel) {
    redirect(`/watch/${channel.slug}`);
  }

  // Fallback if no channels exist
  return (
    <div className="flex items-center justify-center h-screen text-muted">
      No channels yet.
    </div>
  );
}
