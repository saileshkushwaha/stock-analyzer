import React from "react";

import type { AnalyzerResult, Signal } from "../types";

const SIGNAL_CLASS: Record<Signal, string> = {
  STRONG_BUY: "sig-strong-buy",
  BUY: "sig-buy",
  HOLD: "sig-hold",
  SELL: "sig-sell",
  STRONG_SELL: "sig-strong-sell",
};

export function AnalyzerPanel({ analysis }: { analysis: AnalyzerResult | null }) {
  if (!analysis) return <div className="analyzer card muted">analyzing…</div>;
  const ind = analysis.indicators;
  const pct = ((analysis.score + 100) / 200) * 100; // gauge fill 0..100

  return (
    <div className="analyzer card">
      <div className="analyzer-head">
        <h2>StockAnalyzer</h2>
        <span className={`chip ${SIGNAL_CLASS[analysis.signal]}`}>
          {analysis.signal.replace("_", " ")}
        </span>
      </div>

      <div className="gauge">
        <div className="gauge-fill" style={{ width: `${pct}%` }} />
        <div className="gauge-marker" style={{ left: `${pct}%` }} />
        <div className="gauge-labels muted">
          <span>STRONG SELL</span>
          <span>HOLD</span>
          <span>STRONG BUY</span>
        </div>
        <div className="gauge-score">score {analysis.score > 0 ? "+" : ""}{analysis.score}</div>
      </div>

      <div className="indicators">
        <Ind label="RSI (14)" value={ind.rsi?.toFixed(1)} hint={rsiHint(ind.rsi)} />
        <Ind label="SMA 20" value={ind.sma20?.toFixed(2)} />
        <Ind label="SMA 50" value={ind.sma50?.toFixed(2)} />
        <Ind label="MACD hist" value={ind.macdHist?.toFixed(3)} hint={ind.macdHist != null ? (ind.macdHist > 0 ? "bullish" : "bearish") : undefined} />
        <Ind label="Volatility" value={ind.volatilityPct != null ? `${ind.volatilityPct.toFixed(2)}%` : undefined} />
        <Ind label="Momentum (5)" value={ind.momentum5 != null ? `${ind.momentum5 > 0 ? "+" : ""}${ind.momentum5.toFixed(2)}%` : undefined} />
      </div>

      {analysis.reasons.length > 0 && (
        <ul className="reasons">
          {analysis.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Ind({ label, value, hint }: { label: string; value?: string; hint?: string }) {
  return (
    <div className="ind">
      <span className="ind-label muted">{label}</span>
      <span className="ind-value">{value ?? "—"}</span>
      {hint && <span className="ind-hint muted">{hint}</span>}
    </div>
  );
}

function rsiHint(v: number | null): string | undefined {
  if (v == null) return undefined;
  if (v >= 70) return "overbought";
  if (v <= 30) return "oversold";
  return undefined;
}
