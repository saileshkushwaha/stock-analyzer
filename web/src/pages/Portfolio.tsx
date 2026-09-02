import React from "react";
import { useAccount } from "../store";
import type { Quote } from "../types";

export function Portfolio({ quotes }: { quotes: Record<string, Quote> }) {
  const account = useAccount();

  const rows = account.positions.map((p) => {
    const last = quotes[p.symbol]?.price ?? p.avgPrice;
    const value = p.qty * last;
    const pnl = (last - p.avgPrice) * p.qty;
    return { ...p, last, value, pnl, pnlPct: ((last - p.avgPrice) / p.avgPrice) * 100 };
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const equity = account.cash + totalValue;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Portfolio</h1>
        <p className="muted">Holdings, allocation and full order history.</p>
      </header>

      <div className="stat-cards">
        <div className="stat-card card">
          <span className="muted small">Equity</span>
          <b className="big">${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>
        </div>
        <div className="stat-card card">
          <span className="muted small">Invested</span>
          <b className="big">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>
          <span className="muted small">{rows.length} position{rows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="stat-card card">
          <span className="muted small">Cash</span>
          <b className="big">${account.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>
        </div>
        <div className="stat-card card">
          <span className="muted small">Total P&L</span>
          <b className={`big ${account.realizedPnl + rows.reduce((s, r) => s + r.pnl, 0) >= 0 ? "up" : "down"}`}>
            {(account.realizedPnl + rows.reduce((s, r) => s + r.pnl, 0)) >= 0 ? "+" : ""}$
            {(account.realizedPnl + rows.reduce((s, r) => s + r.pnl, 0)).toFixed(0)}
          </b>
        </div>
      </div>

      <div className="dash-grid two">
        <div className="card pad-card">
          <h3>Holdings</h3>
          {rows.length ? (
            <table className="mini-table">
              <thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>Value</th><th>P&L</th><th>%</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol}>
                    <td><b>{r.symbol}</b></td>
                    <td>{r.qty}</td>
                    <td>{r.avgPrice.toFixed(2)}</td>
                    <td>{r.last.toFixed(2)}</td>
                    <td>${r.value.toFixed(0)}</td>
                    <td className={r.pnl >= 0 ? "up" : "down"}>{r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(0)}</td>
                    <td className={r.pnlPct >= 0 ? "up" : "down"}>{r.pnlPct >= 0 ? "+" : ""}{r.pnlPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted small">No holdings yet.</p>}

          {rows.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Allocation</h3>
              <div className="alloc">
                {rows.map((r) => (
                  <div key={r.symbol} className="alloc-row">
                    <span className="alloc-label"><b>{r.symbol}</b> <span className="muted small">{((r.value / (totalValue || 1)) * 100).toFixed(0)}%</span></span>
                    <div className="alloc-bar">
                      <div
                        className={r.pnl >= 0 ? "alloc-fill up" : "alloc-fill down"}
                        style={{ width: `${(r.value / (totalValue || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card pad-card">
          <h3>Order history</h3>
          {account.orders.length ? (
            <table className="mini-table">
              <thead><tr><th>Time</th><th>Side</th><th>Symbol</th><th>Qty</th><th>Fill</th><th>Value</th></tr></thead>
              <tbody>
                {account.orders.map((o) => (
                  <tr key={o.id}>
                    <td>{new Date(o.ts).toLocaleString()}</td>
                    <td className={o.side === "BUY" ? "up" : "down"}>{o.side}</td>
                    <td>{o.symbol}</td>
                    <td>{o.qty}</td>
                    <td>{o.price.toFixed(2)}</td>
                    <td>${(o.qty * o.price).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted small">No orders yet.</p>}
        </div>
      </div>
    </div>
  );
}
