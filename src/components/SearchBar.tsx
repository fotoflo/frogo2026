"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results);
      setOpen(true);
    }, 300);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search videos..."
        className="w-44 sm:w-56 bg-card-bg border border-card-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
      />

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 right-0 w-80 max-h-96 overflow-y-auto bg-card-bg border border-card-border rounded-xl shadow-xl z-50">
          {results.map((v: any) => {
            const ch = v.channels;
            return (
              <Link
                key={v.id}
                href={`/watch/${ch?.slug}/${v.id}`}
                onClick={() => { setOpen(false); setQuery(""); }}
                className="flex gap-2 p-2 hover:bg-white/5 transition-colors"
              >
                <div className="relative shrink-0 w-16 h-10 rounded overflow-hidden bg-black">
                  <Image
                    src={v.thumbnail_url}
                    alt={v.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium line-clamp-1">{v.title}</div>
                  <div className="text-[10px] text-muted">
                    {ch?.icon} {ch?.name}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
