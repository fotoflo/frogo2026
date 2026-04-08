"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

interface SearchResultChannel {
  slug?: string;
  icon?: string;
  name?: string;
}

interface SearchResult {
  id: string;
  title: string;
  thumbnail_url: string;
  channels?: SearchResultChannel;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    if (newQuery.length < 2) {
      setResults([]);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(newQuery)}`);
      const data = await res.json();
      setResults(data.results);
      setOpen(true);
    }, 300);
  }, []);

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
      <label htmlFor="global-search" className="sr-only">Search videos</label>
      <input
        id="global-search"
        type="search"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search videos..."
        className="w-44 sm:w-56 bg-card-bg border border-card-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
      />

      {open && results.length > 0 && (
        <ul className="absolute top-full mt-1 right-0 w-80 max-h-96 overflow-y-auto bg-card-bg border border-card-border rounded-xl shadow-xl z-50" role="listbox" aria-label="Search results">
          {results.map((v: SearchResult) => {
            const ch = v.channels;
            return (
              <li key={v.id} role="option" aria-selected={false}>
                <Link
                  href={`/watch/${ch?.slug}/${v.id}`}
                  onClick={() => { setOpen(false); setQuery(""); }}
                  className="flex gap-2 p-2 hover:bg-white/5 transition-colors"
                >
                  <div className="relative shrink-0 w-16 h-10 rounded overflow-hidden bg-black">
                    <Image
                      src={v.thumbnail_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium line-clamp-1">{v.title}</div>
                    <div className="text-[10px] text-muted">
                      <span aria-hidden="true">{ch?.icon}</span> {ch?.name}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
