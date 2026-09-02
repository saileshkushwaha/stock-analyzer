import React, { useEffect, useState } from "react";
import { placeOrder, useAccount } from "../store";
import type { Quote } from "../types";

export function OrderTicket({ quote }: { quote: Quote | null }) {
  const account = useAccount();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("10");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "b") setSide("BUY");
      if (e.key === "s") setSide("SELL");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!quote) return <div className="rail-card muted">Load a symbol to trade.</div>;

  const n = parseInt(qty, 10);
  const cost = Number.isFinite(n) && n > 0 ? n * quote.price : 0;
  const pos = account.positions.find((p) => p.symbol === quote.symbol);

  const submit = () => {
    const r = placeOrder(quote.symbol, side, n, quote.price);
    setMsg({ ok: r.ok, text: r.ok ? `${side} ${n} ${quote.symbol} @ ${quote.price.toFixed(2)}` : r.error ?? "Rejected" });
    if (r.ok) setTimeout(() => setMsg(null), 3500);
  };

  return (
    <div className="rail-card">
      <div className="ticket-sides">
        <button className={`side-btn buy ${side === "BUY" ? "active" : ""}`} onClick={() => setSide("BUY")}>Buy</button>
        <button className={`side-btn sell ${side === "SELL" ? "active" : ""}`} onClick={() => setSide("SELL")}>Sell</button>
      </div>
      <div className="ticket-row">
        <label>Symbol</label>
        <b>{quote.symbol}</b>
      </div>
      <div className="ticket-row">
        <label>Mkt price</label>
        <b>{quote.price.toFixed(2)}</b>
      </div>
      <div className="ticket-row">
        <label>Qty</label>
        <input
          className="qty-input"
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Quantity"
        />
      </div>
      <div className="ticket-row">
        <label>Est. {side === "BUY" ? "cost" : "proceeds"}</label>
        <b>${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
      </div>
      {pos && (
        <div className="ticket-row muted small">
          <label>Holding</label>
          <span>{pos.qty} @ {pos.avgPrice.toFixed(2)}</span>
        </div>
      )}
      <button className={`submit-btn ${side.toLowerCase()}`} onClick={submit} disabled={!Number.isFinite(n) || n <= 0}>
        {side} {Number.isFinite(n) ? n : ""} {quote.symbol} · Market
      </button>
      {msg && <div className={`ticket-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      <div className="ticket-foot muted small">Shortcuts: B buy · S sell · / search</div>
    </div>
  );
}
