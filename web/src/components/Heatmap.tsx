import React from "react";
import type { Quote } from "../types";

/** Compact watchlist heatmap: tiles colored by % change, sized by |change|. */
export function Heatmap({ quotes, onSelect }: { quotes: Record<string, Quote>; onSelect: (sym: string) => void }) {
  const entries = Object.values(quotes).filter((q) => q.changePercent !== undefined);
  if (!entries.length) return <div className="rail-card muted">waiting for quotes…</div>;

  const maxAbs = Math.max(...entries.map((q) => Math.abs(q.changePercent)), 0.5);

  return (
    <div className="rail-card">
      <div className="heatmap">
        {entries.map((q) => {
          const intensity = Math.min(1, Math.abs(q.changePercent) / maxAbs);
          const positive = q.changePercent >= 0;
          const alpha = 0.15 + intensity * 0.7;
          return (
            <button
              key={q.symbol}
              className="hm-tile"
              style={{
                background: positive
                  ? `rgba(34,197,139,${alpha})`
                  : `rgba(244,83,110,${alpha})`,
                flexGrow: 1 + intensity * 2,
              }}
              onClick={() => onSelect(q.symbol)}
              title={`${q.symbol} ${q.changePercent.toFixed(2)}%`}
            >
              <b>{q.symbol}</b>
              <span>{q.changePercent > 0 ? "+" : ""}{q.changePercent.toFixed(2)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
