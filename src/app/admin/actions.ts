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
import { requireAdmin } from "@/lib/admin-auth";
import { extractYouTubeId, fetchVideoMetadata } from "@/lib/youtube-api";
import {
  buildChannelPath,
  descendantIds,
  type ChannelLike,
} from "@/lib/channel-paths";

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
  const { supabase, user } = await requireAdmin();

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
  redirect(`/admin/channels/edit/${path}`);
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
  const { supabase, user, profile } = await requireAdmin();

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
      // descendant of it. God-mode users can move any channel, so the
      // descendant check needs to see the full tree, not just their owned
      // subset.
      let cycleQuery = supabase.from("channels").select("id, parent_id");
      if (!profile.god_mode) {
        cycleQuery = cycleQuery.eq("owner_id", user.id);
      }
      const { data: allChannels } = await cycleQuery;
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
  revalidatePath(`/admin/channels/edit/${path}`);
  revalidatePath("/");
  return { slug: data.slug as string, path };
}

export async function deleteChannel(channelId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("channels")
    .delete()
    .eq("id", channelId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function reorderChannels(orderedIds: string[]) {
  const { supabase, user, profile } = await requireAdmin();

  // RLS enforces owner for regular users. The .eq("owner_id", user.id) guard
  // prevents a client from sneaking another owner's id into the list. For
  // god_mode we drop that guard so admins can reorder any channel.
  const updates = orderedIds.map((id, idx) => {
    let q = supabase
      .from("channels")
      .update({ position: idx + 1 })
      .eq("id", id);
    if (!profile.god_mode) {
      q = q.eq("owner_id", user.id);
    }
    return q;
  });
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  revalidatePath("/admin");
  revalidatePath("/");
}

// ─── Videos ────────────────────────────────────────────────────────────────

export async function addVideoByUrl(channelId: string, url: string) {
  const { supabase } = await requireAdmin();

  const youtubeId = extractYouTubeId(url);
  if (!youtubeId) throw new Error(`Could not extract a YouTube id from: ${url}`);
  const meta = await fetchVideoMetadata(youtubeId);
  if (!meta) throw new Error("Could not fetch YouTube metadata for that URL");
  if (meta.isLive || meta.durationSeconds <= 0) {
    throw new Error("Video is a live/upcoming stream with no duration");
  }

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
    thumbnail_url: meta.thumbnailUrl,
    duration_seconds: meta.durationSeconds,
    position: nextPosition,
    made_for_kids: meta.madeForKids,
    mfk_checked_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/channels`);
}

export async function updateVideoTrim(
  videoId: string,
  start: number | null,
  end: number | null
) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("videos")
    .update({ start_seconds: start, end_seconds: end })
    .eq("id", videoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/channels`);
}

export async function deleteVideo(videoId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("videos").delete().eq("id", videoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/channels`);
}

export async function reorderVideos(
  channelId: string,
  orderedIds: string[]
) {
  const { supabase } = await requireAdmin();

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
