import React from "react";

import { useMemo } from "react";

/** Responsive SVG area chart with grid + last-price marker. */
export function StockChart({
  series,
  up,
}: {
  series: { t: number; c: number }[];
  up: boolean;
}) {
  const W = 800;
  const H = 300;
  const PAD = 8;

  const { path, area, min, max, last } = useMemo(() => {
    if (series.length < 2) return { path: "", area: "", min: 0, max: 0, last: 0 };
    const closes = series.map((s) => s.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const x = (i: number) => PAD + (i / (series.length - 1)) * (W - PAD * 2);
    const y = (c: number) => PAD + (1 - (c - min) / span) * (H - PAD * 2);
    const pts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.c).toFixed(1)}`);
    return {
      path: `M${pts.join("L")}`,
      area: `M${x(0)},${H}L${pts.join("L")}L${x(series.length - 1)},${H}Z`,
      min,
      max,
      last: closes[closes.length - 1],
    };
  }, [series]);

  if (series.length < 2) {
    return <div className="chart empty muted">loading chart…</div>;
  }

  const stroke = up ? "var(--up)" : "var(--down)";
  const gid = up ? "g-up" : "g-down";

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="g-up" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--up)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--up)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="g-down" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--down)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--down)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className="grid" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-axis muted">
        <span>{min.toFixed(2)}</span>
        <span className="last">{last.toFixed(2)}</span>
        <span>{max.toFixed(2)}</span>
      </div>
    </div>
  );
}
