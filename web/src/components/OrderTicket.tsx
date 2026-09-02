import React, { useEffect, useState } from "react";
import { placeOrder, useAccount } from "../store";
import { loadSettings } from "../pages/Settings";
import type { OrderType } from "../store";
import type { Quote } from "../types";

export function OrderTicket({ quote }: { quote: Quote | null }) {
  const account = useAccount();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<OrderType>("market");
  const [qty, setQty] = useState("10");
  const [trigger, setTrigger] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<null | { qty: number; trigger?: number }>(null);

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
  const tp = parseFloat(trigger);
  const effPrice = type === "market" ? quote.price : Number.isFinite(tp) ? tp : quote.price;
  const cost = Number.isFinite(n) && n > 0 ? n * effPrice : 0;
  const pos = account.positions.find((p) => p.symbol === quote.symbol);

  const doPlace = (orderQty: number, orderTrigger?: number) => {
    const r = placeOrder(quote.symbol, side, orderQty, quote.price, type, orderTrigger);
    setMsg({ ok: r.ok, text: r.ok ? `${type.toUpperCase()} ${side} ${orderQty} ${quote.symbol} placed` : r.error ?? "Rejected" });
    if (r.ok) setTimeout(() => setMsg(null), 3500);
  };

  const submit = () => {
    if (!Number.isFinite(n) || n <= 0) return;
    const t = type === "market" ? undefined : Number.isFinite(tp) ? tp : undefined;
    if (type !== "market" && t == null) {
      setMsg({ ok: false, text: "Enter a trigger price" });
      return;
    }
    if (loadSettings().confirmOrders) setConfirming({ qty: n, trigger: t });
    else doPlace(n, t);
  };

  return (
    <div className="rail-card">
      <div className="ticket-sides">
        <button className={`side-btn buy ${side === "BUY" ? "active" : ""}`} onClick={() => setSide("BUY")}>Buy</button>
        <button className={`side-btn sell ${side === "SELL" ? "active" : ""}`} onClick={() => setSide("SELL")}>Sell</button>
      </div>
      <div className="ticket-row">
        <label>Order type</label>
        <div className="seg">
          {(["market", "limit", "stop"] as const).map((t) => (
            <button key={t} className={type === t ? "active" : ""} onClick={() => setType(t)}>
              {t === "market" ? "MKT" : t === "limit" ? "LMT" : "STP"}
            </button>
          ))}
        </div>
      </div>
      <div className="ticket-row">
        <label>Symbol</label>
        <b>{quote.symbol}</b>
      </div>
      <div className="ticket-row">
        <label>Mkt price</label>
        <b>{quote.price.toFixed(2)}</b>
      </div>
      {type !== "market" && (
        <div className="ticket-row">
          <label>{type === "limit" ? "Limit" : "Stop"} price</label>
          <input className="qty-input" type="number" step="0.01" value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder={quote.price.toFixed(2)} />
        </div>
      )}
      <div className="ticket-row">
        <label>Qty</label>
        <input className="qty-input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantity" />
      </div>
      <div className="ticket-row">
        <label>Est. {type === "market" ? "cost" : "notional"}</label>
        <b>${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
      </div>
      {pos && (
        <div className="ticket-row muted small">
          <label>Holding</label>
          <span>{pos.qty} @ {pos.avgPrice.toFixed(2)}</span>
        </div>
      )}
      <button className={`submit-btn ${side.toLowerCase()}`} onClick={submit} disabled={!Number.isFinite(n) || n <= 0}>
        {side} {Number.isFinite(n) ? n : ""} {quote.symbol} · {type.toUpperCase()}
      </button>
      {msg && <div className={`ticket-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      <div className="ticket-foot muted small">Shortcuts: B buy · S sell · / search · ? help</div>

      {confirming && (
        <div className="modal-backdrop" onClick={() => setConfirming(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm order</h3>
            <p>
              <b>{side} {confirming.qty} {quote.symbol}</b><br />
              {type.toUpperCase()}{confirming.trigger != null ? ` @ ${confirming.trigger.toFixed(2)}` : ` @ market ${quote.price.toFixed(2)}`}
            </p>
            <div className="modal-actions">
              <button className="side-btn" onClick={() => setConfirming(null)}>Cancel</button>
              <button
                className={`submit-btn ${side.toLowerCase()}`}
                style={{ width: "auto", margin: 0, padding: "9px 18px" }}
                onClick={() => { doPlace(confirming.qty, confirming.trigger); setConfirming(null); }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
