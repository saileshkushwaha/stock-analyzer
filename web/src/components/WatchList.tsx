import React, { useState } from "react";
import { createList, deleteList, setActiveList, useWatchlists } from "../store";
import type { Quote } from "../types";

export function WatchList({
  quotes,
  selected,
  onSelect,
}: {
  quotes: Record<string, Quote>;
  selected: string;
  onSelect: (sym: string) => void;
}) {
  const { lists, active } = useWatchlists();
  const [sortBy] = useState<"custom" | "change">("custom");
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState("");

  const symbols = active.symbols;
  const items = sortBy === "change"
    ? [...symbols].sort((a, b) => (quotes[b]?.changePercent ?? 0) - (quotes[a]?.changePercent ?? 0))
    : symbols;

  return (
    <aside className="watchlist card">
      <div className="wl-head">
        <h2>Watchlists</h2>
        <button className="link-btn small" onClick={() => setManaging(!managing)}>{managing ? "done" : "⇄ manage"}</button>
      </div>

      {managing ? (
        <div className="list-manager">
          <div className="list-rows">
            {lists.map((l) => (
              <div key={l.id} className="list-row">
                <button className={l.id === active.id ? "list-pick active" : "list-pick"} onClick={() => setActiveList(l.id)}>
                  {l.name} <span className="muted small">({l.symbols.length})</span>
                </button>
                {lists.length > 1 && (
                  <button className="link-btn" onClick={() => deleteList(l.id)}>×</button>
                )}
              </div>
            ))}
          </div>
          <div className="alert-controls">
            <input
              className="qty-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New list name"
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { createList(newName); setNewName(""); } }}
            />
            <button
              className="side-btn mini buy active"
              onClick={() => { if (newName.trim()) { createList(newName); setNewName(""); } }}
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <div className="wl-tabs">
          {lists.map((l) => (
            <button
              key={l.id}
              className={l.id === active.id ? "wl-tab active" : "wl-tab"}
              onClick={() => setActiveList(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      <ul>
        {items.map((sym) => {
          const q = quotes[sym];
          const up = (q?.changePercent ?? 0) >= 0;
          return (
            <li key={sym} className={sym === selected ? "selected" : ""} onClick={() => onSelect(sym)}>
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
                onClick={(e) => { e.stopPropagation(); removeFromActive(sym); }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {!symbols.length && <p className="muted pad">Search above to add symbols to {active.name}.</p>}
    </aside>
  );
}

import { removeFromList } from "../store";
import { getActiveList } from "../store";
function removeFromActive(symbol: string) {
  removeFromList(getActiveList().id, symbol);
}
