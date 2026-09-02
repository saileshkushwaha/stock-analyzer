import React, { useMemo, useRef, useState } from "react";
import type { Candle } from "../types";
import { bollinger, macd, rsi, sma } from "../analyzer/indicators";

export type ChartType = "candles" | "line";
export interface Overlays {
  sma: boolean;
  bb: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
}

export const TIMEFRAMES: { label: string; range: string; interval: string }[] = [
  { label: "1D", range: "1d", interval: "5m" },
  { label: "5D", range: "5d", interval: "15m" },
  { label: "1M", range: "1mo", interval: "1h" },
  { label: "6M", range: "6mo", interval: "1d" },
  { label: "1Y", range: "1y", interval: "1wk" },
];

function linePath(pts: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let pen = false;
  pts.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

export function CandleChart({
  candles,
  chartType,
  overlays,
  up,
  symbol,
}: {
  candles: Candle[];
  chartType: ChartType;
  overlays: Overlays;
  up: boolean;
  symbol: string;
}) {
  const W = 980;
  const PRICE_H = 380;
  const VOL_H = overlays.volume ? 60 : 0;
  const RSI_H = overlays.rsi ? 90 : 0;
  const MACD_H = overlays.macd ? 90 : 0;
  const GAP = 18;
  const PAD_L = 8;
  const PAD_R = 64;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const calc = useMemo(() => {
    if (candles.length < 2) return null;
    const closes = candles.map((c) => c.c);
    const highs = candles.map((c) => c.h);
    const lows = candles.map((c) => c.l);
    const vols = candles.map((c) => c.v);

    const sma20 = closes.map((_, i) => sma(closes.slice(0, i + 1), 20));
    const sma50 = closes.map((_, i) => sma(closes.slice(0, i + 1), 50));
    const bbUpper: (number | null)[] = [];
    const bbLower: (number | null)[] = [];
    for (let i = 0; i < closes.length; i++) {
      const b = bollinger(closes.slice(0, i + 1), 20, 2);
      bbUpper.push(b.upper);
      bbLower.push(b.lower);
    }
    const rsiVals = candles.map((_, i) => rsi(closes.slice(0, i + 1), 14));
    const macdHist: (number | null)[] = [];
    const macdLine: (number | null)[] = [];
    for (let i = 0; i < closes.length; i++) {
      const m = macd(closes.slice(0, i + 1));
      macdLine.push(m.macd);
      macdHist.push(m.hist);
    }

    let min = Math.min(...lows);
    let max = Math.max(...highs);
    if (overlays.bb) {
      const vals = [...bbUpper, ...bbLower].filter((v): v is number => v != null);
      if (vals.length) { min = Math.min(min, ...vals); max = Math.max(max, ...vals); }
    }
    const span = max - min || 1;
    const maxVol = Math.max(...vols, 1);
    const maxMacd = Math.max(...macdHist.concat(macdLine).map((v) => Math.abs(v ?? 0)), 1e-6);
    const maxRsiDev = Math.max(...rsiVals.filter((v): v is number => v != null).map((v) => Math.abs(v - 50)), 1);

    return { closes, sma20, sma50, bbUpper, bbLower, rsiVals, macdHist, macdLine, min, max, span, maxVol, maxMacd, maxRsiDev, vols };
  }, [candles, overlays.bb]);

  if (!calc) return <div className="chart empty muted">loading chart…</div>;

  const priceY = (v: number) => 8 + (1 - (v - calc.min) / calc.span) * (PRICE_H - 16);
  const x = (i: number) => PAD_L + (i / (candles.length - 1)) * (W - PAD_L - PAD_R);
  const cw = Math.max(1.5, (W - PAD_L - PAD_R) / candles.length * 0.66);

  const volY0 = PRICE_H + GAP;
  const rsiY0 = volY0 + VOL_H + (overlays.volume ? GAP : 0);
  const macdY0 = rsiY0 + RSI_H + (overlays.rsi ? GAP : 0);
  const H = macdY0 + MACD_H + (overlays.macd ? GAP : 0) + 24;

  const hoverCandle = hover ? candles[hover.i] : null;
  const gridLines = [0.1, 0.3, 0.5, 0.7, 0.9];

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD_L) / (W - PAD_L - PAD_R)) * (candles.length - 1));
          if (i >= 0 && i < candles.length) setHover({ i, x: x(i), y: ((e.clientY - rect.top) / rect.height) * H });
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="cc-up" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--up)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--up)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((f) => (
          <line key={f} x1={0} x2={W - PAD_R} y1={PRICE_H * f} y2={PRICE_H * f} className="grid" />
        ))}

        {/* price series */}
        {chartType === "line" ? (
          <>
            <path
              d={`M${candles.map((c, i) => `${x(i).toFixed(1)},${priceY(c.c).toFixed(1)}`).join("L")}L${x(candles.length - 1)},${PRICE_H}L${x(0)},${PRICE_H}Z`}
              fill="url(#cc-up)"
            />
            <path
              d={`M${candles.map((c, i) => `${x(i).toFixed(1)},${priceY(c.c).toFixed(1)}`).join("L")}`}
              fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="2" vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          candles.map((c, i) => {
            const bull = c.c >= c.o;
            const col = bull ? "var(--up)" : "var(--down)";
            const yO = priceY(c.o), yC = priceY(c.c);
            const top = Math.min(yO, yC), bot = Math.max(yO, yC);
            return (
              <g key={i} stroke={col} fill={col} strokeWidth="1">
                <line x1={x(i)} x2={x(i)} y1={priceY(c.h)} y2={priceY(c.l)} />
                <rect x={x(i) - cw / 2} y={top} width={cw} height={Math.max(1, bot - top)} stroke="none" opacity={bull ? 0.9 : 1} />
              </g>
            );
          })
        )}

        {/* overlays */}
        {overlays.bb && (
          <>
            <path d={linePath(calc.bbUpper, x, priceY)} fill="none" stroke="rgba(108,140,255,0.5)" strokeWidth="1" strokeDasharray="3 3" />
            <path d={linePath(calc.bbLower, x, priceY)} fill="none" stroke="rgba(108,140,255,0.5)" strokeWidth="1" strokeDasharray="3 3" />
          </>
        )}
        {overlays.sma && (
          <>
            <path d={linePath(calc.sma20, x, priceY)} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            <path d={linePath(calc.sma50, x, priceY)} fill="none" stroke="#e2a13b" strokeWidth="1.5" />
          </>
        )}

        {/* last price marker */}
        <g>
          <line x1={0} x2={W - PAD_R} y1={priceY(calc.closes[calc.closes.length - 1])} y2={priceY(calc.closes[calc.closes.length - 1])} stroke="var(--text)" strokeOpacity="0.3" strokeDasharray="2 4" />
          <rect x={W - PAD_R + 2} y={priceY(calc.closes[calc.closes.length - 1]) - 9} width={PAD_R - 4} height={18} rx="4" fill={up ? "var(--up)" : "var(--down)"} />
          <text x={W - PAD_R + 6} y={priceY(calc.closes[calc.closes.length - 1]) + 4} fontSize="11" fill="#0a0e17" fontWeight="700">
            {calc.closes[calc.closes.length - 1].toFixed(2)}
          </text>
        </g>

        {/* right price axis */}
        {gridLines.map((f) => (
          <text key={f} x={W - PAD_R + 6} y={PRICE_H * f + 4} fontSize="10" fill="var(--muted)">
            {(calc.max - (calc.max - calc.min) * f).toFixed(1)}
          </text>
        ))}

        {/* volume */}
        {overlays.volume && calc.vols.some((v) => v > 0) && (
          <g>
            {calc.vols.map((v, i) =>
              v > 0 ? (
                <rect
                  key={i}
                  x={x(i) - cw / 2}
                  width={cw}
                  y={volY0 + VOL_H - (v / calc.maxVol) * VOL_H}
                  height={(v / calc.maxVol) * VOL_H}
                  fill={candles[i].c >= candles[i].o ? "var(--up)" : "var(--down)"}
                  opacity="0.45"
                />
              ) : null
            )}
            <text x={4} y={volY0 + 10} fontSize="10" fill="var(--muted)">VOL {calc.maxVol.toLocaleString()}</text>
          </g>
        )}

        {/* RSI subpanel */}
        {overlays.rsi && (
          <g>
            <rect x={0} y={rsiY0} width={W - PAD_R} height={RSI_H} fill="rgba(255,255,255,0.02)" />
            {[30, 50, 70].map((lvl) => {
              const y = rsiY0 + RSI_H - (lvl / 100) * RSI_H;
              return <line key={lvl} x1={0} x2={W - PAD_R} y1={y} y2={y} stroke={lvl === 50 ? "rgba(255,255,255,0.08)" : "rgba(226,185,59,0.25)"} strokeDasharray="2 4" />;
            })}
            <path d={linePath(calc.rsiVals, x, (v) => rsiY0 + RSI_H - (v / 100) * RSI_H)} fill="none" stroke="#b476e8" strokeWidth="1.5" />
            <text x={4} y={rsiY0 + 12} fontSize="10" fill="var(--muted)">RSI 14</text>
          </g>
        )}

        {/* MACD subpanel */}
        {overlays.macd && (
          <g>
            <rect x={0} y={macdY0} width={W - PAD_R} height={MACD_H} fill="rgba(255,255,255,0.02)" />
            <line x1={0} x2={W - PAD_R} y1={macdY0 + MACD_H / 2} y2={macdY0 + MACD_H / 2} stroke="rgba(255,255,255,0.08)" />
            {calc.macdHist.map((v, i) =>
              v == null ? null : (
                <rect
                  key={i}
                  x={x(i) - cw / 2}
                  width={cw}
                  y={v >= 0 ? macdY0 + MACD_H / 2 - (v / calc.maxMacd) * (MACD_H / 2) : macdY0 + MACD_H / 2}
                  height={Math.max(0.5, (Math.abs(v) / calc.maxMacd) * (MACD_H / 2))}
                  fill={v >= 0 ? "var(--up)" : "var(--down)"}
                  opacity="0.6"
                />
              )
            )}
            <path d={linePath(calc.macdLine, x, (v) => macdY0 + MACD_H / 2 - ((v ?? 0) / calc.maxMacd) * (MACD_H / 2))} fill="none" stroke="var(--accent)" strokeWidth="1.2" />
            <text x={4} y={macdY0 + 12} fontSize="10" fill="var(--muted)">MACD 12/26/9</text>
          </g>
        )}

        {/* crosshair */}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={0} y2={H - 24} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
            <line x1={0} x2={W - PAD_R} y1={hover.y} y2={hover.y} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          </g>
        )}

        {/* time axis */}
        {candles.length > 10 &&
          [0, 0.25, 0.5, 0.75, 1].map((f) => {
            const i = Math.min(candles.length - 1, Math.floor(f * (candles.length - 1)));
            const d = new Date(candles[i].t);
            return (
              <text key={f} x={x(i)} y={H - 8} fontSize="10" fill="var(--muted)" textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}>
                {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </text>
            );
          })}
      </svg>

      {hoverCandle && hover && (
        <div className="chart-tip" style={{ left: `${(hover.x / W) * 100}%` }}>
          <b>{symbol}</b> {new Date(hoverCandle.t).toLocaleString()}
          <span>O {hoverCandle.o.toFixed(2)} · H {hoverCandle.h.toFixed(2)} · L {hoverCandle.l.toFixed(2)} · C {hoverCandle.c.toFixed(2)}</span>
          {overlays.volume && <span>Vol {hoverCandle.v.toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
}
