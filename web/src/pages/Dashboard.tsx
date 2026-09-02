import React, { useMemo } from "react";
import { useAccount, getEquityCurve } from "../store";
import type { Quote } from "../types";

export function Dashboard({
  quotes,
  watchlist,
  onGo,
}: {
  quotes: Record<string, Quote>;
  watchlist: string[];
  onGo: (route: string, symbol?: string) => void;
}) {
  const account = useAccount();
  const curve = getEquityCurve();

  const marketValue = account.positions.reduce(
    (s, p) => s + p.qty * (quotes[p.symbol]?.price ?? p.avgPrice), 0
  );
  const unrealized = account.positions.reduce(
    (s, p) => s + p.qty * ((quotes[p.symbol]?.price ?? p.avgPrice) - p.avgPrice), 0
  );
  const equity = account.cash + marketValue;
  const totalReturn = ((equity - 100_000) / 100_000) * 100;

  const movers = useMemo(
    () => Object.values(quotes).slice().sort((a, b) => b.changePercent - a.changePercent),
    [JSON.stringify(Object.values(quotes).map((q) => [q.symbol, q.changePercent]))]
  );
  const gainers = movers.slice(0, 4);
  const losers = movers.slice(-4).reverse();

  return (
    <div className="page">
      <header className="page-head">
        <h1>Dashboard</h1>
        <p className="muted">Portfolio health, market movers and signals at a glance.</p>
      </header>

      <div className="stat-cards">
        <div className="stat-card card">
          <span className="muted small">Account equity</span>
          <b className="big">${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>
          <span className={totalReturn >= 0 ? "up small" : "down small"}>
            {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}% all-time
          </span>
        </div>
        <div className="stat-card card">
          <span className="muted small">Unrealized P&L</span>
          <b className={`big ${unrealized >= 0 ? "up" : "down"}`}>
            {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(0)}
          </b>
          <span className="muted small">{account.positions.length} open position{account.positions.length === 1 ? "" : "s"}</span>
        </div>
        <div className="stat-card card">
          <span className="muted small">Realized P&L</span>
          <b className={`big ${account.realizedPnl >= 0 ? "up" : "down"}`}>
            {account.realizedPnl >= 0 ? "+" : ""}${account.realizedPnl.toFixed(0)}
          </b>
          <span className="muted small">{account.orders.length} orders filled</span>
        </div>
        <div className="stat-card card">
          <span className="muted small">Buying power</span>
          <b className="big">${account.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>
          <span className="muted small">cash available</span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card pad-card">
          <h3>Equity curve</h3>
          {curve.length > 1 ? <EquityCurve curve={curve} /> : <p className="muted small">Trades you make and the curve will draw itself here.</p>}
        </div>

        <div className="card pad-card">
          <h3>Top movers</h3>
          <MoverList title="Gainers" rows={gainers} onPick={(s) => onGo("markets", s)} />
          <MoverList title="Losers" rows={losers} onPick={(s) => onGo("markets", s)} />
        </div>

        <div className="card pad-card">
          <h3>Open positions</h3>
          {account.positions.length ? (
            <table className="mini-table">
              <thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>P&L</th></tr></thead>
              <tbody>
                {account.positions.map((p) => {
                  const last = quotes[p.symbol]?.price ?? p.avgPrice;
                  const pnl = (last - p.avgPrice) * p.qty;
                  return (
                    <tr key={p.symbol}>
                      <td><b>{p.symbol}</b></td>
                      <td>{p.qty}</td>
                      <td>{p.avgPrice.toFixed(2)}</td>
                      <td>{last.toFixed(2)}</td>
                      <td className={pnl >= 0 ? "up" : "down"}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="muted small">Nothing open. Head to <a href="#/markets">Markets</a> to trade.</p>}
        </div>

        <div className="card pad-card">
          <h3>Watchlist signals</h3>
          <table className="mini-table">
            <thead><tr><th>Symbol</th><th>Chg %</th><th>Signal</th></tr></thead>
            <tbody>
              {watchlist.map((s) => {
                const q = quotes[s];
                return (
                  <tr key={s} onClick={() => onGo("markets", s)} style={{ cursor: "pointer" }}>
                    <td><b>{s}</b></td>
                    <td className={(q?.changePercent ?? 0) >= 0 ? "up" : "down"}>
                      {q ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                    </td>
                    <td><span className="muted small">view in Markets</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MoverList({ title, rows, onPick }: { title: string; rows: Quote[]; onPick: (s: string) => void }) {
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <span className="muted small">{title}</span>
      {rows.map((q) => (
        <div key={q.symbol} className="mover-row" onClick={() => onPick(q.symbol)}>
          <b>{q.symbol}</b>
          <span>{q.price.toFixed(2)}</span>
          <span className={q.changePercent >= 0 ? "up" : "down"}>
            {q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function EquityCurve({ curve }: { curve: { t: number; v: number }[] }) {
  const W = 460, H = 120;
  const vals = curve.map((p) => p.v);
  const min = Math.min(...vals, 100_000), max = Math.max(...vals, 100_000);
  const span = max - min || 1;
  const x = (i: number) => (i / (curve.length - 1)) * W;
  const y = (v: number) => 8 + (1 - (v - min) / span) * (H - 16);
  const path = `M${curve.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("L")}`;
  const up = vals[vals.length - 1] >= 100_000;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="equity-svg">
      <line x1={0} x2={W} y1={y(100_000)} y2={y(100_000)} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 4" />
      <path d={path} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="2" />
    </svg>
  );
}
