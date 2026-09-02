import React, { useState } from "react";
import { fetchHistory } from "../api";
import { sma } from "../analyzer/indicators";
import type { Candle } from "../types";

/** Simple SMA-crossover backtester over daily history. */
export function Backtest() {
  const [symbol, setSymbol] = useState("AAPL");
  const [fast, setFast] = useState("20");
  const [slow, setSlow] = useState("50");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const f = parseInt(fast, 10), s = parseInt(slow, 10);
    if (!Number.isFinite(f) || !Number.isFinite(s) || f <= 0 || s <= f) {
      setError("Fast SMA must be > 0 and smaller than slow SMA");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const candles = await fetchHistory(symbol.toUpperCase(), "1y", "1d");
      setResult(backtest(candles, f, s));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card pad-card">
      <h3>Strategy backtester — SMA crossover</h3>
      <p className="muted small">Long when fast SMA is above slow SMA, flat otherwise. 1y of daily data.</p>
      <div className="calc-grid">
        <label className="field"><span>Symbol</span>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
        </label>
        <label className="field"><span>Fast SMA</span>
          <input type="number" value={fast} onChange={(e) => setFast(e.target.value)} />
        </label>
        <label className="field"><span>Slow SMA</span>
          <input type="number" value={slow} onChange={(e) => setSlow(e.target.value)} />
        </label>
      </div>
      <button className="submit-btn small" style={{ marginTop: 10 }} onClick={run} disabled={running}>
        {running ? "Running…" : "Run backtest"}
      </button>
      {error && <div className="ticket-msg err">{error}</div>}
      {result && <Result r={result} />}
    </div>
  );
}

interface BacktestResult {
  strategyPct: number;
  buyHoldPct: number;
  trades: number;
  daysInMarket: number;
  curve: number[];
  buyHoldCurve: number[];
}

function backtest(candles: Candle[], fast: number, slow: number): BacktestResult | any {
  if (candles.length < slow + 2) return { error: "Not enough history" };
  const closes = candles.map((c) => c.c);
  let pos = 0; // 0 flat, 1 long
  let cash = 10000;
  let entry = 0;
  let trades = 0;
  let daysInMarket = 0;
  const curve: number[] = [];
  const buyHoldCurve: number[] = [];

  for (let i = slow; i < closes.length; i++) {
    const f = sma(closes.slice(0, i + 1), fast)!;
    const s = sma(closes.slice(0, i + 1), slow)!;
    if (pos === 0 && f > s) { pos = 1; entry = closes[i]; cash = entry > 0 ? cash : cash; trades++; }
    if (pos === 1 && f <= s) {
      cash *= closes[i] / entry; // compound strategy return while long
      pos = 0; trades++;
    }
    if (pos === 1) daysInMarket++;
    curve.push(cash * (pos === 1 ? closes[i] / entry : 1));
    buyHoldCurve.push((closes[i] / closes[slow]) * 10000);
  }
  if (pos === 1) cash *= closes[closes.length - 1] / entry;
  curve.push(cash);
  buyHoldCurve.push((closes[closes.length - 1] / closes[slow]) * 10000);

  return {
    strategyPct: (cash / 10000 - 1) * 100,
    buyHoldPct: (closes[closes.length - 1] / closes[slow] - 1) * 100,
    trades,
    daysInMarket,
    curve,
    buyHoldCurve,
  };
}

function Result({ r }: { r: any }) {
  if (r.error) return <div className="ticket-msg err">{r.error}</div>;
  const W = 460, H = 110;
  const all = r.curve.concat(r.buyHoldCurve);
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const mk = (arr: number[]) =>
    `M${arr.map((v, i) => `${((i / (arr.length - 1)) * W).toFixed(1)},${(8 + (1 - (v - min) / span) * (H - 16)).toFixed(1)}`).join("L")}`;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="acct-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="acct-stat"><span className="muted small">Strategy</span>
          <b className={r.strategyPct >= 0 ? "up" : "down"}>{r.strategyPct >= 0 ? "+" : ""}{r.strategyPct.toFixed(1)}%</b></div>
        <div className="acct-stat"><span className="muted small">Buy & hold</span>
          <b className={r.buyHoldPct >= 0 ? "up" : "down"}>{r.buyHoldPct >= 0 ? "+" : ""}{r.buyHoldPct.toFixed(1)}%</b></div>
        <div className="acct-stat"><span className="muted small">Trades</span><b>{r.trades}</b></div>
        <div className="acct-stat"><span className="muted small">Days long</span><b>{r.daysInMarket}</b></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="equity-svg" style={{ marginTop: 8 }}>
        <path d={mk(r.curve)} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <path d={mk(r.buyHoldCurve)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
      <div className="muted small">— strategy (accent) vs buy &amp; hold (dashed)</div>
    </div>
  );
}
