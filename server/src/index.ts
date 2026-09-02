import express from "express";
import cors from "cors";
import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { StockAnalyzer } from "./analyzer/StockAnalyzer.js";
import { getHistory, getQuote, searchSymbols } from "./providers/marketData.js";
import type { Candle, Quote } from "./types.js";

const PORT = process.env.PORT ?? 4000;
const POLL_MS = 5_000;

const app = express();
app.use(cors());
app.use(express.json());

const analyzer = new StockAnalyzer();

/** symbol -> candles (history), refreshed periodically */
const history = new Map<string, Candle[]>();
/** symbol -> last quote */
const latestQuotes = new Map<string, Quote>();

// ---------- REST ----------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, symbols: [...history.keys()], pollMs: POLL_MS });
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ quotes: [] });
  res.json({ quotes: await searchSymbols(q) });
});

app.get("/api/quote", async (req, res) => {
  const symbols = String(req.query.symbols ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);
  const quotes = await Promise.all(symbols.map((s) => getQuote(s)));
  res.json({ quotes });
});

app.get("/api/history", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").toUpperCase();
  const range = String(req.query.range ?? "1d");
  const interval = String(req.query.interval ?? "5m");
  if (!symbol) return res.status(400).json({ error: "symbol required" });
  const candles = await getHistory(symbol, range, interval);
  res.json({ symbol, candles });
});

app.get("/api/analyze/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const candles = history.get(symbol) ?? (await getHistory(symbol));
  history.set(symbol, candles);
  const result = analyzer.analyze(symbol, candles);
  if (!result) return res.status(422).json({ error: "not enough data" });
  res.json(result);
});

// ---------- WebSocket streaming ----------

const server = app.listen(PORT, () => {
  console.log(`▲ stock-analyzer API on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server, path: "/ws" });

/** symbol -> subscribed sockets */
const subs = new Map<string, Set<WebSocket>>();

wss.on("connection", (socket: WebSocket, _req: IncomingMessage) => {
  socket.on("message", async (raw: Buffer) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(socket, { type: "error", payload: { message: "bad json" } });
    }

    if (msg.action === "subscribe") {
      const symbols: string[] = (msg.symbols ?? [])
        .map((s: string) => String(s).toUpperCase())
        .filter(Boolean)
        .slice(0, 15);
      for (const sym of symbols) {
        if (!subs.has(sym)) subs.set(sym, new Set());
        subs.get(sym)!.add(socket);
        if (!history.has(sym)) {
          history.set(sym, await getHistory(sym));
        }
      }
      // prime the client immediately
      for (const sym of symbols) {
        const quote = latestQuotes.get(sym) ?? (await getQuote(sym));
        latestQuotes.set(sym, quote);
        send(socket, {
          type: "ticks",
          payload: { quote, analysis: analyzer.analyze(sym, history.get(sym) ?? []) },
        });
      }
      send(socket, { type: "subscribed", payload: { symbols } });
    }

    if (msg.action === "unsubscribe") {
      const symbols: string[] = msg.symbols ?? [];
      for (const sym of symbols.map((s: string) => s.toUpperCase())) {
        subs.get(sym)?.delete(socket);
        if (subs.get(sym)?.size === 0) {
          subs.delete(sym);
          history.delete(sym);
        }
      }
      send(socket, { type: "unsubscribed", payload: { symbols } });
    }
  });

  socket.on("close", () => {
    for (const set of subs.values()) set.delete(socket);
  });
});

function send(socket: WebSocket, data: unknown) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(data));
}

/** Poll every subscribed symbol and broadcast quote + analysis. */
setInterval(async () => {
  for (const [symbol, sockets] of subs) {
    if (!sockets.size) continue;
    try {
      const quote = await getQuote(symbol);
      latestQuotes.set(symbol, quote);
      const candles = history.get(symbol) ?? [];
      // append live price as the newest candle close
      if (candles.length) {
        const lastCandle = candles[candles.length - 1];
        if (Date.now() - lastCandle.t > POLL_MS) {
          candles.push({ t: Date.now(), o: quote.price, h: quote.price, l: quote.price, c: quote.price, v: 0 });
          if (candles.length > 500) candles.splice(0, candles.length - 500);
        } else {
          lastCandle.c = quote.price;
        }
      }
      const analysis = analyzer.analyze(symbol, candles, quote.price);
      const payload = JSON.stringify({
        type: "ticks",
        payload: { quote, analysis },
      });
      for (const sock of sockets) {
        if (sock.readyState === sock.OPEN) sock.send(payload);
      }
    } catch (err) {
      console.error(`poll ${symbol} failed:`, err);
    }
  }
}, POLL_MS);
