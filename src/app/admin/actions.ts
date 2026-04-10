"use server";

/**
 * Server actions for the admin editor. All mutations go through here so we
 * can enforce auth + RLS in one place.
 *
 * RLS policies (see migration 20260409000000) already gate writes on
 * owner_id = auth.uid(), so these actions can use the authed user's own
 * session client — no service role needed.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { fetchVideoMeta } from "@/lib/youtube-meta";
import {
  buildChannelPath,
  descendantIds,
  type ChannelLike,
} from "@/lib/channel-paths";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/api/auth/signin?next=/admin");
  return { supabase, user };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

// ─── Channels ──────────────────────────────────────────────────────────────

export async function createChannel(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const icon = String(formData.get("icon") ?? "📺").trim() || "📺";
  const slugInput = String(formData.get("slug") ?? "").trim();
  const parentIdInput = String(formData.get("parent_id") ?? "").trim();
  const parent_id = parentIdInput || null;

  if (!name) throw new Error("Name is required");

  const slug = slugInput ? slugify(slugInput) : slugify(name);

  const { data: created, error } = await supabase
    .from("channels")
    .insert({ name, slug, description, icon, parent_id, owner_id: user.id })
    .select("id, slug, parent_id")
    .single();

  if (error) throw new Error(error.message);

  // Build the full URL path for redirect
  const { data: allChannels } = await supabase
    .from("channels")
    .select("id, slug, parent_id");
  const path = buildChannelPath(
    created as ChannelLike,
    (allChannels ?? []) as ChannelLike[]
  ).join("/");

  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin/channels/${path}/edit`);
}

export async function updateChannel(
  channelId: string,
  patch: {
    name?: string;
    description?: string;
    icon?: string;
    slug?: string;
    parent_id?: string | null;
  }
) {
  const { supabase, user } = await requireUser();

  const clean: Record<string, string | null> = {};
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.description !== undefined)
    clean.description = patch.description.trim();
  if (patch.icon !== undefined) clean.icon = patch.icon.trim() || "📺";
  if (patch.slug !== undefined) clean.slug = slugify(patch.slug);

  if (patch.parent_id !== undefined) {
    const nextParent = patch.parent_id || null;
    if (nextParent) {
      // Cycle guard — can't set a parent that is the channel itself or a
      // descendant of it.
      const { data: allChannels } = await supabase
        .from("channels")
        .select("id, parent_id")
        .eq("owner_id", user.id);
      const forbidden = descendantIds(
        channelId,
        (allChannels ?? []) as unknown as ChannelLike[]
      );
      if (forbidden.has(nextParent)) {
        throw new Error("Cannot move channel under itself or a descendant");
      }
    }
    clean.parent_id = nextParent;
  }

  const { data, error } = await supabase
    .from("channels")
    .update(clean)
    .eq("id", channelId)
    .select("id, slug, parent_id")
    .single();

  if (error) throw new Error(error.message);

  // Compute the new full path so the client can navigate after a slug or
  // parent move.
  const { data: allChannels } = await supabase
    .from("channels")
    .select("id, slug, parent_id");
  const path = buildChannelPath(
    data as ChannelLike,
    (allChannels ?? []) as ChannelLike[]
  ).join("/");

  revalidatePath("/admin");
  revalidatePath(`/admin/channels/${path}/edit`);
  revalidatePath("/");
  return { slug: data.slug as string, path };
}

export async function deleteChannel(channelId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("channels")
    .delete()
    .eq("id", channelId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function reorderChannels(orderedIds: string[]) {
  const { supabase, user } = await requireUser();

  // RLS enforces owner, but the .eq("owner_id", user.id) guards against a
  // client sending another owner's channel id mixed into the list.
  const updates = orderedIds.map((id, idx) =>
    supabase
      .from("channels")
      .update({ position: idx + 1 })
      .eq("id", id)
      .eq("owner_id", user.id)
  );
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  revalidatePath("/admin");
  revalidatePath("/");
}

// ─── Videos ────────────────────────────────────────────────────────────────

export async function addVideoByUrl(channelId: string, url: string) {
  const { supabase } = await requireUser();

  const meta = await fetchVideoMeta(url);
  if (!meta) throw new Error("Could not fetch YouTube metadata for that URL");

  // Next position = max + 1
  const { data: last } = await supabase
    .from("videos")
    .select("position")
    .eq("channel_id", channelId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? 0) + 1;

  const { error } = await supabase.from("videos").insert({
    channel_id: channelId,
    youtube_id: meta.youtubeId,
    title: meta.title,
    description: "",
    thumbnail_url: `https://img.youtube.com/vi/${meta.youtubeId}/mqdefault.jpg`,
    duration_seconds: meta.durationSeconds,
    position: nextPosition,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/channels`);
}

export async function updateVideoTrim(
  videoId: string,
  start: number | null,
  end: number | null
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("videos")
    .update({ start_seconds: start, end_seconds: end })
    .eq("id", videoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/channels`);
}

export async function deleteVideo(videoId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("videos").delete().eq("id", videoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/channels`);
}

export async function reorderVideos(
  channelId: string,
  orderedIds: string[]
) {
  const { supabase } = await requireUser();

  // Update each row's position in parallel. RLS enforces ownership.
  const updates = orderedIds.map((id, idx) =>
    supabase
      .from("videos")
      .update({ position: idx + 1 })
      .eq("id", id)
      .eq("channel_id", channelId)
  );
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  revalidatePath(`/admin/channels`);
}
