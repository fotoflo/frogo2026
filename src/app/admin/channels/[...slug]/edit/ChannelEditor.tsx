"use client";

/**
 * Admin channel editor. Client component so we can:
 *  - drag-reorder videos optimistically (@dnd-kit/sortable)
 *  - inline-edit channel metadata
 *  - open a trim editor with a live YouTube player
 *
 * Mutations call server actions in `@/app/admin/actions`. RLS enforces owner.
 */
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addVideoByUrl,
  deleteChannel,
  deleteVideo,
  reorderVideos,
  updateChannel,
  updateVideoTrim,
} from "@/app/admin/actions";
import TrimEditor from "./TrimEditor";

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  parent_id: string | null;
  owner_id: string | null;
}

export interface ParentOption {
  id: string;
  label: string;
}

interface EditorVideo {
  id: string;
  channel_id: string;
  youtube_id: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
  start_seconds: number | null;
  end_seconds: number | null;
  position: number;
}

export default function ChannelEditor({
  channel,
  initialVideos,
  parentOptions,
}: {
  channel: Channel;
  initialVideos: EditorVideo[];
  parentOptions: ParentOption[];
}) {
  const router = useRouter();
  const [videos, setVideos] = useState(initialVideos);
  const [urlInput, setUrlInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [trimEditingId, setTrimEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Local editable channel metadata
  const [meta, setMeta] = useState({
    name: channel.name,
    slug: channel.slug,
    icon: channel.icon,
    description: channel.description,
    parent_id: channel.parent_id,
  });
  const [metaDirty, setMetaDirty] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const ids = useMemo(() => videos.map((v) => v.id), [videos]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = videos.findIndex((v) => v.id === active.id);
    const newIndex = videos.findIndex((v) => v.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(videos, oldIndex, newIndex);
    setVideos(next);

    startTransition(async () => {
      try {
        await reorderVideos(
          channel.id,
          next.map((v) => v.id)
        );
      } catch (err) {
        console.error("reorder failed", err);
        // Rollback on failure
        setVideos(videos);
      }
    });
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const url = urlInput.trim();
    if (!url) return;

    startTransition(async () => {
      try {
        await addVideoByUrl(channel.id, url);
        setUrlInput("");
        router.refresh();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Failed to add video");
      }
    });
  };

  const handleDeleteVideo = (videoId: string) => {
    if (!confirm("Delete this video from the channel?")) return;
    // Optimistic
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
    startTransition(async () => {
      try {
        await deleteVideo(videoId);
        router.refresh();
      } catch (err) {
        console.error("delete failed", err);
        router.refresh();
      }
    });
  };

  const handleSaveMeta = () => {
    if (!metaDirty || metaSaving) return;
    setMetaSaving(true);
    startTransition(async () => {
      try {
        const res = await updateChannel(channel.id, meta);
        setMetaDirty(false);
        // Slug or parent may have changed — navigate to the new edit URL
        if (
          res.slug !== channel.slug ||
          meta.parent_id !== channel.parent_id
        ) {
          router.push(`/admin/channels/${res.path}/edit`);
        } else {
          router.refresh();
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Save failed");
      } finally {
        setMetaSaving(false);
      }
    });
  };

  const handleDeleteChannel = () => {
    if (
      !confirm(
        `Delete channel "${channel.name}" and all ${videos.length} of its videos? This cannot be undone.`
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteChannel(channel.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const handleSaveTrim = useCallback(
    async (videoId: string, start: number | null, end: number | null) => {
      // Optimistic local update
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? { ...v, start_seconds: start, end_seconds: end }
            : v
        )
      );
      setTrimEditingId(null);
      try {
        await updateVideoTrim(videoId, start, end);
        router.refresh();
      } catch (err) {
        console.error("trim save failed", err);
        router.refresh();
      }
    },
    [router]
  );

  const updateMeta = <K extends keyof typeof meta>(
    key: K,
    value: (typeof meta)[K]
  ) => {
    setMeta((m) => ({ ...m, [key]: value }));
    setMetaDirty(true);
  };

  return (
    <div className="space-y-8">
      {/* Channel metadata */}
      <section className="rounded-lg border border-neutral-800 p-5 space-y-4">
        <h2 className="text-lg font-semibold">Channel details</h2>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Icon</label>
            <input
              type="text"
              value={meta.icon}
              onChange={(e) => updateMeta("icon", e.target.value)}
              maxLength={4}
              className="w-20 px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-center text-2xl"
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Name
              </label>
              <input
                type="text"
                value={meta.name}
                onChange={(e) => updateMeta("name", e.target.value)}
                className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Slug
              </label>
              <input
                type="text"
                value={meta.slug}
                onChange={(e) => updateMeta("slug", e.target.value)}
                className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Parent channel
              </label>
              <select
                value={meta.parent_id ?? ""}
                onChange={(e) =>
                  updateMeta("parent_id", e.target.value || null)
                }
                className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
              >
                <option value="">(no parent — top-level channel)</option>
                {parentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Changing the parent moves this channel in the URL tree.
              </p>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Description
              </label>
              <textarea
                value={meta.description}
                onChange={(e) => updateMeta("description", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700 resize-none"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleSaveMeta}
            disabled={!metaDirty || metaSaving}
            className="px-4 py-2 rounded bg-white text-black font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {metaSaving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleDeleteChannel}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Delete channel
          </button>
        </div>
      </section>

      {/* Add video */}
      <section className="rounded-lg border border-neutral-800 p-5 space-y-3">
        <h2 className="text-lg font-semibold">Add video</h2>
        <form onSubmit={handleAddVideo} className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="flex-1 px-3 py-2 rounded bg-neutral-900 border border-neutral-700 focus:border-neutral-500 outline-none"
          />
          <button
            type="submit"
            disabled={isPending || !urlInput.trim()}
            className="px-4 py-2 rounded bg-white text-black font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Add
          </button>
        </form>
        {addError ? (
          <p className="text-sm text-red-400">{addError}</p>
        ) : (
          <p className="text-xs text-neutral-500">
            Paste any YouTube URL or a bare video ID. Title and duration are
            fetched automatically.
          </p>
        )}
      </section>

      {/* Video list */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            Videos{" "}
            <span className="text-neutral-500 font-normal">
              ({videos.length})
            </span>
          </h2>
          {videos.length > 0 && (
            <p className="text-xs text-neutral-500">
              Drag to reorder • Click trim to edit start/end
            </p>
          )}
        </div>

        {videos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-neutral-500 text-sm">
            No videos yet. Add one above.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {videos.map((video) => (
                  <SortableVideoRow
                    key={video.id}
                    video={video}
                    isTrimOpen={trimEditingId === video.id}
                    onOpenTrim={() => setTrimEditingId(video.id)}
                    onCloseTrim={() => setTrimEditingId(null)}
                    onSaveTrim={handleSaveTrim}
                    onDelete={() => handleDeleteVideo(video.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}

// ─── Sortable row ──────────────────────────────────────────────────────────

function SortableVideoRow({
  video,
  isTrimOpen,
  onOpenTrim,
  onCloseTrim,
  onSaveTrim,
  onDelete,
}: {
  video: EditorVideo;
  isTrimOpen: boolean;
  onOpenTrim: () => void;
  onCloseTrim: () => void;
  onSaveTrim: (id: string, start: number | null, end: number | null) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasTrim =
    video.start_seconds != null || video.end_seconds != null;
  const effectiveDuration =
    (video.end_seconds ?? video.duration_seconds) - (video.start_seconds ?? 0);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-neutral-800 bg-neutral-900/30"
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-neutral-500 hover:text-neutral-300 px-1"
          aria-label="Drag to reorder"
        >
          ⋮⋮
        </button>

        {/* Thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail_url}
          alt=""
          className="w-24 h-14 object-cover rounded bg-neutral-800 flex-shrink-0"
        />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium">{video.title}</p>
          <p className="text-xs text-neutral-500 font-mono">
            {formatTime(effectiveDuration)}
            {hasTrim && (
              <span className="ml-2 text-amber-400">
                ✂ {formatTime(video.start_seconds ?? 0)}–
                {formatTime(video.end_seconds ?? video.duration_seconds)}
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={isTrimOpen ? onCloseTrim : onOpenTrim}
            className="px-3 py-1.5 text-sm rounded border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 transition"
          >
            {isTrimOpen ? "Close" : "Trim"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1.5 text-sm rounded text-neutral-500 hover:text-red-400"
            aria-label="Delete video"
          >
            ✕
          </button>
        </div>
      </div>

      {isTrimOpen && (
        <div className="border-t border-neutral-800 p-4">
          <TrimEditor
            youtubeId={video.youtube_id}
            durationSeconds={video.duration_seconds}
            initialStart={video.start_seconds}
            initialEnd={video.end_seconds}
            onSave={(start, end) => onSaveTrim(video.id, start, end)}
            onCancel={onCloseTrim}
          />
        </div>
      )}
    </li>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
