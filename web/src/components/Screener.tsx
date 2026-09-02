import React, { useEffect, useMemo, useState } from "react";
import { runScreener } from "../api";
import type { ScreenerRow } from "../types";

type SortKey = "symbol" | "score" | "changePercent" | "rsi" | "momentum5" | "volatilityPct";

export function Screener({ symbols }: { symbols: string[] }) {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    runScreener(symbols).then((r) => {
      if (!alive) return;
      setRows(r);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [symbols.join(",")]);

  const sorted = useMemo(() => {
    const s = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return s;
  }, [rows, sortKey, asc]);

  const head = (key: SortKey, label: string) => (
    <th
      className={sortKey === key ? "sorted" : ""}
      onClick={() => { if (sortKey === key) setAsc(!asc); else { setSortKey(key); setAsc(false); } }}
    >
      {label}{sortKey === key ? (asc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="rail-card">
      {loading ? (
        <p className="muted small">scanning {symbols.length} symbols…</p>
      ) : (
        <table className="mini-table screener-table">
          <thead>
            <tr>
              {head("symbol", "Symbol")}
              {head("changePercent", "Chg %")}
              {head("score", "Score")}
              <th>Signal</th>
              {head("rsi", "RSI")}
              {head("momentum5", "Mom 5")}
              {head("volatilityPct", "Vol")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.symbol}>
                <td><b>{r.symbol}</b></td>
                <td className={r.changePercent >= 0 ? "up" : "down"}>{r.changePercent.toFixed(2)}%</td>
                <td>{r.score > 0 ? "+" : ""}{r.score}</td>
                <td><span className={`chip ${signalClass(r.signal)}`}>{r.signal.replace("_", " ")}</span></td>
                <td>{r.rsi?.toFixed(0) ?? "—"}</td>
                <td>{r.momentum5 != null ? `${r.momentum5 > 0 ? "+" : ""}${r.momentum5.toFixed(1)}%` : "—"}</td>
                <td>{r.volatilityPct?.toFixed(1) ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function signalClass(signal: string): string {
  switch (signal) {
    case "STRONG_BUY": return "sig-strong-buy";
    case "BUY": return "sig-buy";
    case "SELL": return "sig-sell";
    case "STRONG_SELL": return "sig-strong-sell";
    default: return "sig-hold";
  }
}
