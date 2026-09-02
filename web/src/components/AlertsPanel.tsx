import React, { useState } from "react";
import { addAlert, removeAlert, useAlerts } from "../store";
import type { Quote } from "../types";

export function AlertsPanel({ quote }: { quote: Quote | null }) {
  const alerts = useAlerts();
  const [op, setOp] = useState<">" | "<">(">");
  const [price, setPrice] = useState("");

  const submit = () => {
    const p = parseFloat(price);
    if (!quote || !Number.isFinite(p) || p <= 0) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    addAlert(quote.symbol, op, p);
    setPrice("");
  };

  return (
    <div className="rail-card">
      {quote && (
        <div className="alert-form">
          <span>Notify when <b>{quote.symbol}</b> is</span>
          <div className="alert-controls">
            <button className={`side-btn mini ${op === ">" ? "buy active" : ""}`} onClick={() => setOp(">")}>&ge;</button>
            <button className={`side-btn mini ${op === "<" ? "sell active" : ""}`} onClick={() => setOp("<")}>&le;</button>
            <input
              className="qty-input"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={quote.price.toFixed(2)}
            />
            <button className="submit-btn small" onClick={submit} disabled={!Number.isFinite(parseFloat(price))}>Set</button>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <p className="muted small">No alerts yet. Alerts persist in this browser.</p>
      ) : (
        <ul className="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className={a.triggeredAt ? "triggered" : ""}>
              <b>{a.symbol}</b>
              <span>{a.op === ">" ? "≥" : "≤"} {a.price}</span>
              <span className="muted small">
                {a.triggeredAt ? `fired ${new Date(a.triggeredAt).toLocaleTimeString()}` : "watching"}
              </span>
              <button className="link-btn" onClick={() => removeAlert(a.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
