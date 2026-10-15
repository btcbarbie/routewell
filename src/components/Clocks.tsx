"use client";

import { useEffect, useState } from "react";
import type { Worker } from "./ui";

/** A live clock for each city where your people are. */
export function Clocks({ workers }: { workers: Worker[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const places = new Map<string, { city: string; tz: string; count: number }>();
  for (const w of workers) {
    const key = `${w.city}|${w.timezone}`;
    const p = places.get(key) ?? { city: w.city, tz: w.timezone, count: 0 };
    p.count += 1;
    places.set(key, p);
  }

  return (
    <div className="flex overflow-x-auto border-b-2 border-ink">
      {[...places.values()].map((p) => (
        <div key={p.city} className="min-w-[118px] flex-1 border-r border-paper-line px-3.5 py-2.5 last:border-r-0">
          <div className="font-mono text-xl font-semibold tracking-tight" suppressHydrationWarning>
            {now ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: p.tz }).format(now) : "--:--"}
          </div>
          <div className="flex flex-wrap justify-between gap-x-2 text-xs text-ink-soft">
            <span>{p.city}</span>
            <span className="whitespace-nowrap font-mono text-[11px] font-semibold text-ink">
              {p.count} {p.count === 1 ? "person" : "people"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
