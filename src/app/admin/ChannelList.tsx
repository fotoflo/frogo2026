"use client";

/**
 * Sortable channel list for the admin home page. Drag-reorders set each
 * channel's `position`, which drives channel numbers on the TV (1–9 keyboard
 * shortcut, phone remote, channel index order).
 */
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { reorderChannels } from "./actions";

export interface ChannelListItem {
  id: string;
  name: string;
  slug: string;
  /** Full path from root, joined with "/" — e.g. "business/startups" */
  path: string;
  description: string;
  icon: string;
  videoCount: number;
}

export default function ChannelList({
  initialChannels,
}: {
  initialChannels: ChannelListItem[];
}) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const ids = useMemo(() => channels.map((c) => c.id), [channels]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = channels.findIndex((c) => c.id === active.id);
    const newIndex = channels.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const prev = channels;
    const next = arrayMove(channels, oldIndex, newIndex);
    setChannels(next);

    startTransition(async () => {
      try {
        await reorderChannels(next.map((c) => c.id));
        router.refresh();
      } catch (err) {
        console.error("channel reorder failed", err);
        setChannels(prev);
      }
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {channels.map((ch, idx) => (
            <SortableChannelRow
              key={ch.id}
              channel={ch}
              channelNumber={idx + 1}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableChannelRow({
  channel,
  channelNumber,
}: {
  channel: ChannelListItem;
  channelNumber: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: channel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 transition"
    >
      <div className="flex items-center gap-3 p-4">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-neutral-500 hover:text-neutral-300 px-1"
          aria-label="Drag to reorder channel"
        >
          ⋮⋮
        </button>

        {/* Channel number */}
        <div className="w-10 text-center text-2xl font-mono font-bold text-neutral-400 tabular-nums flex-shrink-0">
          {channelNumber}
        </div>

        {/* Icon */}
        <span className="text-3xl flex-shrink-0" aria-hidden="true">
          {channel.icon}
        </span>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{channel.name}</h2>
          <p className="text-xs text-neutral-500 font-mono truncate mt-0.5">
            /{channel.path}
          </p>
          <p className="text-sm text-neutral-400 line-clamp-1 mt-0.5">
            {channel.description || "No description"}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {channel.videoCount} video{channel.videoCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Edit link */}
        <Link
          href={`/admin/channels/${channel.path}/edit`}
          className="px-3 py-1.5 text-sm rounded border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 transition flex-shrink-0"
        >
          Edit
        </Link>
      </div>
    </li>
  );
}
