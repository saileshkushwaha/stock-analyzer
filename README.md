# Stock Analyzer 📈

Realtime stock market analyzer with an end-to-end trading workflow.

- **Frontend** — React 17 + TypeScript + Vite, modern dark glass UI, live SVG charts, analyzer dashboard
- **Backend** — Node (Bun-compatible) + Express + WebSocket streaming
- **Data** — Yahoo Finance live quotes/history (no API key needed), with a built-in simulated feed fallback so the app always runs
- **StockAnalyzer engine** — RSI, SMA(20/50), EMA, MACD, Bollinger bands, volatility, momentum → composite score and STRONG_BUY → STRONG_SELL signal

## Run it

```bash
bun install            # or: npm install
bun run dev            # starts API on :4000 and web on :5173
```

Open http://localhost:5173. Search any ticker (e.g. `AAPL`, `NVDA`, `RELIANCE.NS`), add to watchlist, and watch prices + signals stream live.

## Architecture

```
web/   React 17 TS SPA ── REST /api/* ──► server/  ──► Yahoo Finance (live)
   ▲                              │                    (simulated fallback)
   └──────── WS /ws ◄─────────────┘
              │  every 5s: quotes → analyzer → broadcast ticks + signals
```
