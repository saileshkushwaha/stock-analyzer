import React from "react";

import type { Quote } from "../types";

export function TickerTape({ quotes }: { quotes: Quote[] }) {
  if (!quotes.length) return <div className="tape empty">connecting to market feed…</div>;
  return (
    <div className="tape">
      <div className="tape-track">
        {quotes.map((q) => (
          <span key={q.symbol} className="tape-item">
            <b>{q.symbol}</b>
            <span className={q.change >= 0 ? "up" : "down"}>
              {q.price.toFixed(2)} ({q.changePercent >= 0 ? "+" : ""}
              {q.changePercent.toFixed(2)}%)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
