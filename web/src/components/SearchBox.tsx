import React from "react";

import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "../types";

export function SearchBox({
  onPick,
  search,
}: {
  onPick: (hit: SearchHit) => void;
  search: (q: string) => Promise<SearchHit[]>;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 1) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await search(q.trim());
      setHits(res);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="search" ref={boxRef}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="Search ticker… (AAPL, RELIANCE.NS, BTC-USD)"
      />
      {open && hits.length > 0 && (
        <ul className="search-results">
          {hits.map((h) => (
            <li
              key={`${h.exchange}:${h.symbol}`}
              onClick={() => { onPick(h); setQ(""); setOpen(false); }}
            >
              <b>{h.symbol}</b>
              <span>{h.name}</span>
              <em>{h.exchange}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
