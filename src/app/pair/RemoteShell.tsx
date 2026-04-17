"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import NowPlayingHero from "./NowPlayingHero";
import DPad from "./DPad";
import BentoGrid from "./BentoGrid";
import BottomNav from "./BottomNav";
import ChannelGuide from "./ChannelGuide";
import ChannelBrowser from "./ChannelBrowser";
import FavoritesList from "./FavoritesList";
import RecentChannels from "./RecentChannels";
import SearchPanel from "./SearchPanel";
import ReactionBar from "./ReactionBar";
import ChatInput from "./ChatInput";
import { useRemoteState } from "./useRemoteState";
import { useFavorites } from "./useFavorites";
import { useSwipeGestures } from "./useSwipeGestures";

interface SearchResult {
  id: string;
  title: string;
  channels?: { id?: string; slug?: string; icon?: string; name?: string };
}

interface RemoteShellProps {
  sessionId: string;
  desktopSessionId: string | null;
  connected: boolean;
  onUnpair: () => void;
}

export default function RemoteShell({ sessionId, desktopSessionId, connected, onUnpair }: RemoteShellProps) {
  const remoteState = useRemoteState(sessionId);
  const { favorites, loading: favsLoading, isFavorite, toggleFavorite } = useFavorites();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [activeTab, setActiveTab] = useState<"remote" | "guide" | "chat">("remote");
  const [activePanel, setActivePanel] = useState<"browse" | "favorites" | "recent" | "search" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const swipeRef = useRef<HTMLDivElement>(null);
  const swipeCallbacks = useMemo(() => ({
    onSwipeUp: () => sendCommand("prev"),
    onSwipeDown: () => sendCommand("next"),
    onSwipeLeft: () => sendCommand("video_prev"),
    onSwipeRight: () => sendCommand("video_next"),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useSwipeGestures(swipeRef, swipeCallbacks);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 1500);
  }

  async function sendCommand(command: string) {
    if (!sessionId) return;
    const { error } = await supabase
      .from("pairing_sessions")
      .update({ last_command: command, last_command_at: new Date().toISOString() })
      .eq("id", sessionId);
    showToast(error ? `ERR: ${error.message}` : command);
  }

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results);
    }, 300);
  }, [searchQuery]);

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden"
      style={{ background: "#0e0e0e", fontFamily: "Manrope, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
          <div className="px-4 py-2 rounded-full text-xs font-mono shadow-lg"
            style={{ background: "rgba(203,255,114,0.15)", border: "1px solid rgba(203,255,114,0.3)", color: "#cbff72" }}>
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-[100] flex justify-between items-center px-6 py-4"
        style={{ background: "linear-gradient(to bottom, #1a1a1a, #0e0e0e)", boxShadow: "0 0 40px rgba(203,255,114,0.06)" }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-[0.2em] uppercase" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#cbff72" }}>
            FROGO
          </h1>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-yellow-500"} animate-pulse`} />
            <span className="text-[10px] text-neutral-500">{connected ? "LIVE" : "..."}</span>
          </div>
        </div>
        <button onClick={onUnpair} className="text-neutral-500 hover:text-neutral-300 text-xs tracking-wider uppercase">
          Unpair
        </button>
      </header>

      <main className="flex-1 px-6 pt-4 pb-32 max-w-lg mx-auto w-full space-y-8">
        {/* Now Playing */}
        <NowPlayingHero
          state={remoteState}
          isFavorite={remoteState.channel ? isFavorite(remoteState.channel.id) : false}
          onToggleFavorite={() => {
            if (remoteState.channel) toggleFavorite(remoteState.channel.id, remoteState.channel);
          }}
        />

        {/* Tab content */}
        {activeTab === "remote" && (
          <>
            {/* D-Pad + Rockers */}
            <div ref={swipeRef}>
              <DPad sendCommand={sendCommand} isPlaying={remoteState.playbackState === "playing"} />
            </div>

            {/* Bento Nav Grid */}
            <BentoGrid
              activePanel={activePanel}
              onTogglePanel={(p) => setActivePanel(activePanel === p ? null : p)}
            />

            {/* Expandable panels */}
            {activePanel === "search" && (
              <SearchPanel searchQuery={searchQuery} onSearchChange={setSearchQuery}
                searchResults={searchResults} sendCommand={sendCommand}
                onClose={() => { setActivePanel(null); setSearchQuery(""); }} />
            )}
            {activePanel === "browse" && (
              <ChannelBrowser sendCommand={sendCommand} onClose={() => setActivePanel(null)} />
            )}
            {activePanel === "favorites" && (
              <FavoritesList favorites={favorites} loading={favsLoading}
                sendCommand={sendCommand} onClose={() => setActivePanel(null)} />
            )}
            {activePanel === "recent" && (
              <RecentChannels sendCommand={sendCommand} onClose={() => setActivePanel(null)} />
            )}

            {/* Transport */}
            <TransportSection sendCommand={sendCommand} />

            {/* Reactions */}
            <ReactionBar desktopSessionId={desktopSessionId} />
          </>
        )}

        {activeTab === "guide" && (
          <ChannelGuide
            currentChannelId={remoteState.channel?.id ?? null}
            sendCommand={sendCommand}
            onClose={() => setActiveTab("remote")}
          />
        )}

        {activeTab === "chat" && (
          <div className="space-y-4">
            <ChatInput sessionId={sessionId} />
            <p className="text-center text-neutral-600 text-xs">Messages appear on the TV screen</p>
          </div>
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

/** Skip-back / skip-forward transport strip */
function TransportSection({ sendCommand }: { sendCommand: (cmd: string) => void }) {
  const btn = "w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/5 active:scale-95 transition-all";

  return (
    <div className="flex justify-between items-end">
      <div className="space-y-1">
        <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-neutral-500">Transport</span>
      </div>
      <div className="flex gap-3">
        <button onClick={() => sendCommand("video_prev")} className={btn}
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <span className="material-symbols-outlined text-xl">skip_previous</span>
        </button>
        <button onClick={() => sendCommand("video_next")} className={btn}
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <span className="material-symbols-outlined text-xl">skip_next</span>
        </button>
      </div>
    </div>
  );
}
