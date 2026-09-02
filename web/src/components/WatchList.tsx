import React, { useState } from "react";
import type { Quote } from "../types";

export function WatchList({
  watchlist,
  quotes,
  selected,
  onSelect,
  onRemove,
}: {
  watchlist: string[];
  quotes: Record<string, Quote>;
  selected: string;
  onSelect: (sym: string) => void;
  onRemove: (sym: string) => void;
}) {
  const [sortBy, setSortBy] = useState<"custom" | "change">("custom");

  const items = sortBy === "change"
    ? [...watchlist].sort((a, b) => (quotes[b]?.changePercent ?? 0) - (quotes[a]?.changePercent ?? 0))
    : watchlist;

  return (
    <aside className="watchlist card">
      <div className="wl-head">
        <h2>Watchlist</h2>
        <button
          className="link-btn small"
          onClick={() => setSortBy(sortBy === "custom" ? "change" : "custom")}
          title="Toggle sort"
        >
          {sortBy === "custom" ? "⇅ sort" : "⇅ %chg"}
        </button>
      </div>
      <ul>
        {items.map((sym) => {
          const q = quotes[sym];
          const up = (q?.changePercent ?? 0) >= 0;
          return (
            <li
              key={sym}
              className={sym === selected ? "selected" : ""}
              onClick={() => onSelect(sym)}
            >
              <div className="wl-left">
                <b>{sym}</b>
                <span className="muted wl-name">{q?.name ?? "…"}</span>
              </div>
              <div className="wl-right">
                <span>{q ? q.price.toFixed(2) : "—"}</span>
                <span className={`chip ${up ? "up" : "down"}`}>
                  {q ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                </span>
              </div>
              <button
                className="wl-remove"
                title={`Remove ${sym}`}
                onClick={(e) => { e.stopPropagation(); onRemove(sym); }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {!watchlist.length && <p className="muted pad">Search above to add symbols.</p>}
    </aside>
  );
}
