import React, { useMemo } from "react";
import type { Quote } from "../types";

/** Synthetic depth-of-market ladder derived from the last price. */
export function DepthPanel({ quote }: { quote: Quote | null }) {
  const levels = useMemo(() => {
    if (!quote) return null;
    const px = quote.price;
    const tick = Math.max(0.01, px * 0.0005);
    const mk = (i: number, side: "bid" | "ask") => {
      const price = side === "bid" ? px - tick * i : px + tick * i;
      const size = Math.round((40 + Math.sin(i * 2.7 + px) * 25 + Math.random() * 30) * 10) * 10;
      return { price, size };
    };
    return {
      bids: Array.from({ length: 6 }, (_, i) => mk(i + 1, "bid")).reverse(),
      asks: Array.from({ length: 6 }, (_, i) => mk(i + 1, "ask")),
    };
  }, [quote?.price, quote?.symbol]);

  if (!levels || !quote) return <div className="rail-card muted">Load a symbol to see depth.</div>;

  const maxSize = Math.max(...levels.bids.concat(levels.asks).map((l) => l.size));

  return (
    <div className="rail-card">
      <div className="dom">
        <div className="dom-side">
          {levels.bids.map((l, i) => (
            <div key={i} className="dom-row bid">
              <div className="dom-bar" style={{ width: `${(l.size / maxSize) * 100}%` }} />
              <span>{l.price.toFixed(2)}</span>
              <b>{l.size.toLocaleString()}</b>
            </div>
          ))}
        </div>
        <div className="dom-mid">
          <span className={quote.change >= 0 ? "up" : "down"}>{quote.price.toFixed(2)}</span>
          <span className="muted small">spread {((levels.asks[0].price - levels.bids[levels.bids.length - 1].price)).toFixed(2)}</span>
        </div>
        <div className="dom-side">
          {levels.asks.map((l, i) => (
            <div key={i} className="dom-row ask">
              <div className="dom-bar" style={{ width: `${(l.size / maxSize) * 100}%` }} />
              <span>{l.price.toFixed(2)}</span>
              <b>{l.size.toLocaleString()}</b>
            </div>
          ))}
        </div>
      </div>
      <p className="muted small">Synthetic depth — indicative ladder for UI demo.</p>
    </div>
  );
}
