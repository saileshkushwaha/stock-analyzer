import { useEffect, useState } from "react";
import type { Quote } from "./types";

/** Paper-trading account (market/limit/stop orders), alerts, toasts, watchlists. */

export interface Position {
  symbol: string;
  qty: number; // positive = long
  avgPrice: number;
  openedAt: number;
}

export type OrderType = "market" | "limit" | "stop";
export type OrderStatus = "filled" | "pending" | "cancelled";

export interface Order {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number; // fill price (0 while pending)
  type: OrderType;
  triggerPrice?: number; // limit/stop level
  status: OrderStatus;
  ts: number;
  filledAt?: number;
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

export interface Toast {
  id: string;
  kind: "info" | "success" | "error";
  text: string;
  ts: number;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

const ACCOUNT_KEY = "sa.account.v1";
const ALERTS_KEY = "sa.alerts.v1";
const LISTS_KEY = "sa.watchlists.v2";
const EQUITY_KEY = "sa.equity.v1";
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
let toasts: Toast[] = [];
let lists: Watchlist[] = load(LISTS_KEY, [
  { id: "tech", name: "Tech", symbols: ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"] },
]);
let activeListId: string = load(LISTS_KEY, lists)[0]?.id ?? lists[0]?.id ?? "tech";
let equityCurve: { t: number; v: number }[] = load(EQUITY_KEY, []);

const accountSubs = new Set<() => void>();
const alertSubs = new Set<() => void>();
const toastSubs = new Set<() => void>();
const listSubs = new Set<() => void>();

function emit(subs: Set<() => void>) {
  for (const fn of subs) fn();
}

function notify(kind: Toast["kind"], text: string) {
  toasts = [...toasts, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, text, ts: Date.now() }].slice(-6);
  emit(toastSubs);
  setTimeout(() => {
    toasts = toasts.filter((t) => t.ts + 5000 > Date.now());
    emit(toastSubs);
  }, 5200);
}

// ---------- trading ----------

export function getAccount(): Account {
  return account;
}

function fill(symbol: string, side: "BUY" | "SELL", qty: number, price: number, _type?: OrderType): { ok: boolean; error?: string } {
  const positions = [...account.positions];
  let cash = account.cash;
  let realized = account.realizedPnl;

  if (side === "BUY") {
    const cost = qty * price;
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
    if (idx < 0 || positions[idx].qty <= 0) return { ok: false, error: `No position in ${symbol}` };
    const p = positions[idx];
    const closeQty = Math.min(qty, p.qty);
    realized += (price - p.avgPrice) * closeQty;
    cash += closeQty * price;
    const remaining = p.qty - closeQty;
    if (remaining > 0) positions[idx] = { ...p, qty: remaining };
    else if (qty > p.qty) {
      const flipQty = qty - p.qty;
      cash -= flipQty * price;
      positions[idx] = { symbol, qty: flipQty, avgPrice: price, openedAt: Date.now() };
    } else {
      positions.splice(idx, 1);
    }
  }

  account = { cash, realizedPnl: realized, positions, orders: account.orders };
  return { ok: true };
}

export function placeOrder(
  symbol: string,
  side: "BUY" | "SELL",
  qty: number,
  marketPrice: number,
  type: OrderType = "market",
  triggerPrice?: number
): { ok: boolean; error?: string } {
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Invalid quantity" };
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) return { ok: false, error: "Invalid price" };
  if (type !== "market" && (!triggerPrice || !Number.isFinite(triggerPrice) || triggerPrice <= 0))
    return { ok: false, error: "Invalid trigger price" };

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (type === "market") {
    const r = fill(symbol, side, qty, marketPrice, type);
    if (!r.ok) return r;
    const order: Order = { id, symbol, side, qty, price: marketPrice, type, status: "filled", ts: Date.now(), filledAt: Date.now() };
    account = { ...account, orders: [order, ...account.orders].slice(0, 200) };
    save(ACCOUNT_KEY, account);
    emit(accountSubs);
    notify("success", `${side} ${qty} ${symbol} filled @ ${marketPrice.toFixed(2)}`);
    return { ok: true };
  }

  // pending order
  const order: Order = { id, symbol, side, qty, price: 0, type, triggerPrice, status: "pending", ts: Date.now() };
  account = { ...account, orders: [order, ...account.orders].slice(0, 200) };
  save(ACCOUNT_KEY, account);
  emit(accountSubs);
  notify("info", `${type.toUpperCase()} ${side} ${qty} ${symbol} @ ${triggerPrice?.toFixed(2)} placed`);
  return { ok: true };
}

/** Check pending limit/stop orders against fresh quotes; fill triggered ones. */
export function processPendingOrders(quotes: Record<string, Quote>) {
  const pending = account.orders.filter((o) => o.status === "pending");
  if (!pending.length) return;

  for (const o of pending) {
    const q = quotes[o.symbol];
    if (!q) continue;
    const tp = o.triggerPrice!;
    const hit =
      o.type === "limit"
        ? o.side === "BUY" ? q.price <= tp : q.price >= tp
        : o.side === "BUY" ? q.price >= tp : q.price <= tp;
    if (!hit) continue;

    const r = fill(o.symbol, o.side, o.qty, q.price, o.type);
    const filled: Order = { ...o, status: r.ok ? "filled" : "cancelled", price: r.ok ? q.price : 0, filledAt: Date.now() };
    account = { ...account, orders: account.orders.map((x) => (x.id === o.id ? filled : x)) };
    if (r.ok) notify("success", `${o.type.toUpperCase()} ${o.side} ${o.qty} ${o.symbol} filled @ ${q.price.toFixed(2)}`);
    else notify("error", `${o.type.toUpperCase()} ${o.side} ${o.qty} ${o.symbol} cancelled: ${r.error}`);
  }
  save(ACCOUNT_KEY, account);
  emit(accountSubs);
}

export function cancelOrder(id: string) {
  account = { ...account, orders: account.orders.map((o) => (o.id === id && o.status === "pending" ? { ...o, status: "cancelled" } : o)) };
  save(ACCOUNT_KEY, account);
  emit(accountSubs);
  notify("info", "Order cancelled");
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
      notify("info", `Alert: ${f.symbol} ${f.op === ">" ? "≥" : "≤"} ${f.price}`);
      try {
        new Notification(`${f.symbol} alert`, {
          body: `Price ${f.op === ">" ? "crossed above" : "dropped below"} ${f.price}`,
        });
      } catch { /* notifications not permitted */ }
    }
  }
  return fired;
}

// ---------- watchlists ----------

export function getLists(): Watchlist[] {
  return lists;
}

export function getActiveList(): Watchlist {
  return lists.find((l) => l.id === activeListId) ?? lists[0];
}

export function setActiveList(id: string) {
  activeListId = id;
  save(LISTS_KEY, { ...lists, activeId: id });
  emit(listSubs);
}

export function createList(name: string) {
  const id = `${Date.now().toString(36)}`;
  lists = [...lists, { id, name: name.trim() || `List ${lists.length + 1}`, symbols: [] }];
  activeListId = id;
  save(LISTS_KEY, lists);
  emit(listSubs);
}

export function deleteList(id: string) {
  if (lists.length <= 1) return;
  lists = lists.filter((l) => l.id !== id);
  if (activeListId === id) activeListId = lists[0].id;
  save(LISTS_KEY, lists);
  emit(listSubs);
}

export function addToList(id: string, symbol: string) {
  lists = lists.map((l) => (l.id === id && !l.symbols.includes(symbol) ? { ...l, symbols: [...l.symbols, symbol] } : l));
  save(LISTS_KEY, lists);
  emit(listSubs);
}

export function removeFromList(id: string, symbol: string) {
  lists = lists.map((l) => (l.id === id ? { ...l, symbols: l.symbols.filter((s) => s !== symbol) } : l));
  save(LISTS_KEY, lists);
  emit(listSubs);
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

export function useToasts(): Toast[] {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    toastSubs.add(fn);
    return () => { toastSubs.delete(fn); };
  }, []);
  return toasts;
}

export function useWatchlists(): { lists: Watchlist[]; active: Watchlist } {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listSubs.add(fn);
    return () => { listSubs.delete(fn); };
  }, []);
  return { lists, active: getActiveList() };
}

// ---------- account reset + equity curve ----------

export function resetAccount() {
  account = { cash: STARTING_CASH, realizedPnl: 0, positions: [], orders: [] };
  save(ACCOUNT_KEY, account);
  equityCurve = [];
  save(EQUITY_KEY, equityCurve);
  emit(accountSubs);
  notify("info", "Paper account reset");
}

let lastEquityWrite = 0;

/** Track account equity over time (throttled to one point per 10s, capped at 720). */
export function recordEquity(value: number) {
  const now = Date.now();
  if (now - lastEquityWrite < 10_000) return;
  lastEquityWrite = now;
  equityCurve = [...equityCurve, { t: now, v: Number(value.toFixed(2)) }].slice(-720);
  save(EQUITY_KEY, equityCurve);
}

export function getEquityCurve(): { t: number; v: number }[] {
  return equityCurve;
}
