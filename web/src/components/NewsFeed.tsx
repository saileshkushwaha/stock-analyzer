import React, { useEffect, useState } from "react";
import { fetchNews } from "../api";
import type { NewsItem } from "../types";

export function NewsFeed({ symbol }: { symbol: string | null }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchNews(symbol ?? undefined).then((n) => {
      if (!alive) return;
      setNews(n);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [symbol]);

  if (loading) return <div className="rail-card muted">loading news…</div>;
  if (!news.length) return <div className="rail-card muted">No news found.</div>;

  return (
    <ul className="news-list rail-card">
      {news.map((n, i) => (
        <li key={i}>
          <a href={n.link} target="_blank" rel="noreferrer">
            <span className="news-title">{n.title}</span>
            <span className="muted small">
              {n.publisher} · {n.ts ? new Date(n.ts).toLocaleString() : "recent"}
              {n.relatedSymbols.length > 0 && ` · ${n.relatedSymbols.join(", ")}`}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
