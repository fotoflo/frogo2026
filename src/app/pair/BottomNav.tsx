"use client";

interface BottomNavProps {
  activeTab: "remote" | "guide" | "chat";
  onTabChange: (tab: "remote" | "guide" | "chat") => void;
}

const tabs: { id: "remote" | "guide" | "chat"; icon: string; label: string }[] = [
  { id: "remote", icon: "settings_remote", label: "Remote" },
  { id: "guide", icon: "tv_guide", label: "Guide" },
  { id: "chat", icon: "chat_bubble", label: "Chat" },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] flex justify-around items-center px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      style={{ background: "linear-gradient(to top, #0e0e0e 60%, transparent)", backdropFilter: "blur(20px)" }}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center gap-0.5 px-6 py-1 transition-colors touch-manipulation">
            <span className="material-symbols-outlined text-xl"
              style={{ color: active ? "#cbff72" : "rgba(255,255,255,0.3)" }}>
              {tab.icon}
            </span>
            <span className="text-[9px] font-bold tracking-[0.15em] uppercase"
              style={{ color: active ? "#cbff72" : "rgba(255,255,255,0.25)" }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
