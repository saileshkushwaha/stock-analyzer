import { useEffect, useState } from "react";

import type { Quote } from "./types";
/** Paper-trading account + price alerts, persisted to localStorage. */

export interface Position {
  symbol: string;
  qty: number; // positive = long
  avgPrice: number;
  openedAt: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  ts: number;
}

export interface Account {
  cash: number;
  realizedPnl: number;
  positions: Position[];
  orders: Order[];
}

export interface PriceAlert {
  id: string;
  symbol: string;
  op: ">" | "<";
  price: number;
  createdAt: number;
  triggeredAt: number | null;
}

const ACCOUNT_KEY = "sa.account.v1";
const ALERTS_KEY = "sa.alerts.v1";
export const STARTING_CASH = 100_000;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

let account: Account = load(ACCOUNT_KEY, {
  cash: STARTING_CASH,
  realizedPnl: 0,
  positions: [],
  orders: [],
});
let alerts: PriceAlert[] = load(ALERTS_KEY, []);

const accountSubs = new Set<() => void>();
const alertSubs = new Set<() => void>();

function emit(subs: Set<() => void>) {
  for (const fn of subs) fn();
}

// ---------- trading ----------

export function getAccount(): Account {
  return account;
}

export function placeOrder(symbol: string, side: "BUY" | "SELL", qty: number, price: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Invalid quantity" };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Invalid price" };

  const cost = qty * price;
  const positions = [...account.positions];
  let cash = account.cash;
  let realized = account.realizedPnl;

  if (side === "BUY") {
    if (cost > cash) return { ok: false, error: `Insufficient cash (need $${cost.toFixed(2)})` };
    cash -= cost;
    const idx = positions.findIndex((p) => p.symbol === symbol);
    if (idx >= 0) {
      const p = positions[idx];
      const newQty = p.qty + qty;
      positions[idx] = { ...p, qty: newQty, avgPrice: (p.avgPrice * p.qty + price * qty) / newQty };
    } else {
      positions.push({ symbol, qty, avgPrice: price, openedAt: Date.now() });
    }
  } else {
    const idx = positions.findIndex((p) => p.symbol === symbol);
    if (idx < 0 || positions[idx].qty === 0) return { ok: false, error: `No position in ${symbol}` };
    const p = positions[idx];
    const closeQty = Math.min(qty, p.qty);
    realized += (price - p.avgPrice) * closeQty;
    cash += closeQty * price;
    const remaining = p.qty - closeQty;
    // allow flipping to short with leftover qty at fill price
    if (remaining > 0) positions[idx] = { ...p, qty: remaining };
    else if (qty > p.qty) {
      const flipQty = qty - p.qty;
      cash -= flipQty * price;
      positions[idx] = { symbol, qty: flipQty, avgPrice: price, openedAt: Date.now() };
    } else {
      positions.splice(idx, 1);
    }
  }

  const order: Order = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, symbol, side, qty, price, ts: Date.now() };
  account = { cash, realizedPnl: realized, positions, orders: [order, ...account.orders].slice(0, 100) };
  save(ACCOUNT_KEY, account);
  emit(accountSubs);
  return { ok: true };
}

export function closePosition(symbol: string, price: number) {
  const p = account.positions.find((x) => x.symbol === symbol);
  if (p && p.qty > 0) placeOrder(symbol, "SELL", p.qty, price);
}

// ---------- alerts ----------

export function getAlerts(): PriceAlert[] {
  return alerts;
}

export function addAlert(symbol: string, op: ">" | "<", price: number) {
  alerts = [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, symbol, op, price, createdAt: Date.now(), triggeredAt: null },
    ...alerts,
  ].slice(0, 50);
  save(ALERTS_KEY, alerts);
  emit(alertSubs);
}

export function removeAlert(id: string) {
  alerts = alerts.filter((a) => a.id !== id);
  save(ALERTS_KEY, alerts);
  emit(alertSubs);
}

/** Evaluate alerts against a fresh quote; fires browser notifications. */
export function checkAlerts(quote: Quote): PriceAlert[] {
  const fired: PriceAlert[] = [];
  let changed = false;
  alerts = alerts.map((a) => {
    if (a.symbol !== quote.symbol || a.triggeredAt) return a;
    const hit = a.op === ">" ? quote.price >= a.price : quote.price <= a.price;
    if (!hit) return a;
    const triggered = { ...a, triggeredAt: Date.now() };
    fired.push(triggered);
    changed = true;
    return triggered;
  });
  if (changed) {
    save(ALERTS_KEY, alerts);
    emit(alertSubs);
    for (const f of fired) {
      try {
        new Notification(`${f.symbol} alert`, {
          body: `Price ${f.op === ">" ? "crossed above" : "dropped below"} ${f.price} (now ${quote.price.toFixed(2)})`,
        });
      } catch { /* notifications not permitted */ }
    }
  }
  return fired;
}

// ---------- react hooks ----------

export function useAccount(): Account {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    accountSubs.add(fn);
    return () => { accountSubs.delete(fn); };
  }, []);
  return account;
}

export function useAlerts(): PriceAlert[] {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    alertSubs.add(fn);
    return () => { alertSubs.delete(fn); };
  }, []);
  return alerts;
}
