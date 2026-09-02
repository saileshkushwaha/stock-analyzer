import { useEffect, useState } from "react";

/** Minimal hash router — no deps. Routes: #/dashboard, #/markets, #/portfolio, #/tools, #/settings */

export const ROUTES = ["dashboard", "markets", "portfolio", "tools", "settings"] as const;
export type Route = (typeof ROUTES)[number];

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, "").split("?")[0];
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : "dashboard";
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const fn = () => setRoute(parse());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const go = (r: Route) => { location.hash = `#/${r}`; };
  return [route, go];
}
