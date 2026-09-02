import React from "react";
import { closePosition, useAccount, STARTING_CASH } from "../store";
import type { Quote } from "../types";

export function Positions({ quotes }: { quotes: Record<string, Quote> }) {
  const account = useAccount();

  const marketValue = account.positions.reduce(
    (sum, p) => sum + p.qty * (quotes[p.symbol]?.price ?? p.avgPrice),
    0
  );
  const unrealized = account.positions.reduce(
    (sum, p) => sum + p.qty * ((quotes[p.symbol]?.price ?? p.avgPrice) - p.avgPrice),
    0
  );
  const equity = account.cash + marketValue;

  return (
    <div className="rail-card">
      <div className="acct-grid">
        <Stat label="Equity" value={`$${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label="Cash" value={`$${account.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat
          label="Unrealized"
          value={`${unrealized >= 0 ? "+" : ""}$${unrealized.toFixed(0)}`}
          className={unrealized >= 0 ? "up" : "down"}
        />
        <Stat
          label="Realized"
          value={`${account.realizedPnl >= 0 ? "+" : ""}$${account.realizedPnl.toFixed(0)}`}
          className={account.realizedPnl >= 0 ? "up" : "down"}
        />
      </div>
      {account.realizedPnl !== 0 && (
        <div className="muted small" style={{ marginTop: 6 }}>
          Total return: {(((equity - STARTING_CASH) / STARTING_CASH) * 100).toFixed(2)}% vs ${STARTING_CASH.toLocaleString()} start
        </div>
      )}

      {account.positions.length > 0 ? (
        <table className="mini-table">
          <thead>
            <tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>P&L</th><th /></tr>
          </thead>
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
                  <td>
                    <button className="link-btn" onClick={() => closePosition(p.symbol, last)}>Close</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="muted small" style={{ marginTop: 8 }}>No open positions. Use the ticket to paper-trade.</p>
      )}

      {account.orders.length > 0 && (
        <details className="orders-history">
          <summary className="muted small">Order history ({account.orders.length})</summary>
          <table className="mini-table">
            <thead><tr><th>Time</th><th>Side</th><th>Symbol</th><th>Qty</th><th>Fill</th></tr></thead>
            <tbody>
              {account.orders.slice(0, 15).map((o) => (
                <tr key={o.id}>
                  <td>{new Date(o.ts).toLocaleTimeString()}</td>
                  <td className={o.side === "BUY" ? "up" : "down"}>{o.side}</td>
                  <td>{o.symbol}</td>
                  <td>{o.qty}</td>
                  <td>{o.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="acct-stat">
      <span className="muted small">{label}</span>
      <b className={className ?? ""}>{value}</b>
    </div>
  );
}
