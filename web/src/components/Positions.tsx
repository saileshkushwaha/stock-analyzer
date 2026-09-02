import React from "react";
import { cancelOrder, closePosition, useAccount } from "../store";
import { exportOrdersCsv, exportPositionsCsv } from "../csv";
import type { Quote } from "../types";

export function Positions({ quotes }: { quotes: Record<string, Quote> }) {
  const account = useAccount();
  const pending = account.orders.filter((o) => o.status === "pending");

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

      {pending.length > 0 && (
        <>
          <h3 className="mini-h">Working orders</h3>
          <table className="mini-table">
            <thead><tr><th>Type</th><th>Side</th><th>Symbol</th><th>Qty</th><th>Trigger</th><th /></tr></thead>
            <tbody>
              {pending.map((o) => (
                <tr key={o.id}>
                  <td>{o.type.toUpperCase()}</td>
                  <td className={o.side === "BUY" ? "up" : "down"}>{o.side}</td>
                  <td>{o.symbol}</td>
                  <td>{o.qty}</td>
                  <td>{o.triggerPrice?.toFixed(2)}</td>
                  <td><button className="link-btn" onClick={() => cancelOrder(o.id)}>cancel</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {account.positions.length > 0 ? (
        <>
          <h3 className="mini-h">Positions</h3>
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
        </>
      ) : (
        <p className="muted small" style={{ marginTop: 8 }}>No open positions. Use the ticket to paper-trade.</p>
      )}

      <div className="export-row">
        <button className="link-btn" onClick={() => exportPositionsCsv(
          account.positions.map((p) => ({
            symbol: p.symbol, qty: p.qty, avgPrice: p.avgPrice,
            last: quotes[p.symbol]?.price ?? p.avgPrice,
            pnl: (quotes[p.symbol]?.price ?? p.avgPrice) - p.avgPrice,
          }))
        )}>⬇ positions.csv</button>
        <button className="link-btn" onClick={() => exportOrdersCsv(
          account.orders.map((o) => ({
            time: new Date(o.ts).toISOString(), side: o.side, symbol: o.symbol,
            qty: o.qty, type: o.type, trigger: o.triggerPrice ?? "", fill: o.price, status: o.status,
          }))
        )}>⬇ orders.csv</button>
      </div>

      {account.orders.length > 0 && (
        <details className="orders-history">
          <summary className="muted small">Order history ({account.orders.length})</summary>
          <table className="mini-table">
            <thead><tr><th>Time</th><th>Side</th><th>Symbol</th><th>Qty</th><th>Fill</th><th>Status</th></tr></thead>
            <tbody>
              {account.orders.slice(0, 15).map((o) => (
                <tr key={o.id}>
                  <td>{new Date(o.ts).toLocaleTimeString()}</td>
                  <td className={o.side === "BUY" ? "up" : "down"}>{o.side}</td>
                  <td>{o.symbol}</td>
                  <td>{o.qty}</td>
                  <td>{o.price ? o.price.toFixed(2) : "—"}</td>
                  <td className="muted small">{o.status}</td>
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
