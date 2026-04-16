"use client";

import { useCallback, useMemo, useState } from "react";
import {
  getAncestors,
  getSiblingsAt,
  hasChildren,
} from "@/lib/channel-paths";

interface ChannelLike {
  id: string;
  slug: string;
  parent_id: string | null;
}

interface Options<C extends ChannelLike> {
  channels: C[];
  initialChannelIndex: number;
  onChannelChange?: (channel: C) => void;
}

/**
 * Holds the "current channel" + "directory scope" state and all the
 * navigation helpers for the TV view. Scope follows the target: entering
 * a folder-channel scopes to it; entering a leaf scopes to its parent.
 */
export function useChannelNav<C extends ChannelLike>({
  channels,
  initialChannelIndex,
  onChannelChange,
}: Options<C>) {
  const [channelIdx, setChannelIdx] = useState(initialChannelIndex);
  const channel = channels[channelIdx];

  const initialScopeId = useMemo(() => {
    const c = channels[initialChannelIndex];
    if (!c) return null;
    return hasChildren(c.id, channels) ? c.id : c.parent_id;
  }, [channels, initialChannelIndex]);
  const [scopeId, setScopeId] = useState<string | null>(initialScopeId);

  const siblings = useMemo(
    () => getSiblingsAt(scopeId, channels),
    [scopeId, channels]
  );
  const ancestors = useMemo(
    () => getAncestors(scopeId, channels),
    [scopeId, channels]
  );
  const siblingIdx = useMemo(
    () => siblings.findIndex((c) => c.id === channel.id),
    [siblings, channel.id]
  );

  const switchChannelById = useCallback(
    (id: string) => {
      const idx = channels.findIndex((c) => c.id === id);
      if (idx < 0) return;
      const target = channels[idx];
      setScopeId(hasChildren(target.id, channels) ? target.id : target.parent_id);
      setChannelIdx(idx);
      onChannelChange?.(target);
    },
    [channels, onChannelChange]
  );

  const switchToSiblingIdx = useCallback(
    (idx: number) => {
      if (siblings.length === 0) return;
      const wrapped = ((idx % siblings.length) + siblings.length) % siblings.length;
      switchChannelById(siblings[wrapped].id);
    },
    [siblings, switchChannelById]
  );

  const nextChannel = useCallback(
    () => switchToSiblingIdx((siblingIdx < 0 ? 0 : siblingIdx) + 1),
    [siblingIdx, switchToSiblingIdx]
  );
  const prevChannel = useCallback(
    () => switchToSiblingIdx((siblingIdx < 0 ? 0 : siblingIdx) - 1),
    [siblingIdx, switchToSiblingIdx]
  );

  /** Breadcrumb jump: `null` = Home (first root), otherwise an ancestor id. */
  const navigateToScope = useCallback(
    (id: string | null) => {
      if (id === null) {
        const roots = getSiblingsAt(null, channels);
        if (roots.length > 0) switchChannelById(roots[0].id);
        setScopeId(null);
      } else {
        switchChannelById(id);
      }
    },
    [channels, switchChannelById]
  );

  return {
    channel,
    channelIdx,
    scopeId,
    siblings,
    ancestors,
    siblingIdx,
    switchChannelById,
    switchToSiblingIdx,
    nextChannel,
    prevChannel,
    navigateToScope,
  };
}
