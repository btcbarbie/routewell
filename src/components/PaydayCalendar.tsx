"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Calendar, EventModelConfig } from "@bryntum/calendar";
import type { Snapshot } from "@/lib/state";
import { dollars } from "./ui";

// Bryntum Calendar is loaded straight into the browser from public/vendor (copied there at install time),
// so the production build doesn't have to process its 5 MB module.
const BASE = "/vendor/bryntum";
type BryntumModule = typeof import("@bryntum/calendar");
let loading: Promise<BryntumModule> | null = null;

function loadBryntum(): Promise<BryntumModule> {
  if (!loading) {
    for (const href of [`${BASE}/calendar.css`, `${BASE}/stockholm-light.css`, `${BASE}/fontawesome/css/fontawesome.css`, `${BASE}/fontawesome/css/solid.css`]) {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    }
    const url = `${BASE}/calendar.module.js`;
    loading = import(/* webpackIgnore: true */ url) as Promise<BryntumModule>;
  }
  return loading;
}

const ORANGE = "#ff5a1f";
const GREEN = "#2f6b4f";
const INK = "#1b2a4a";

/** Scheduled paydays for this month and the next two, plus paydays already paid. Drag an upcoming payday to move it. */
export function PaydayCalendar({ s, move }: { s: Snapshot; move: (scheduleId: string, day: number) => Promise<boolean> }) {
  const host = useRef<HTMLDivElement>(null);
  const cal = useRef<Calendar | null>(null);
  const moveRef = useRef(move);
  const [failed, setFailed] = useState(false);
  const today = useMemo(() => new Date(`${s.today}T12:00:00Z`), [s.today]);

  useEffect(() => {
    moveRef.current = move;
  }, [move]);

  const events: EventModelConfig[] = useMemo(() => {
    const out: EventModelConfig[] = [];
    const name = (id: string) => s.workers.find((w) => w.id === id)?.name ?? "Someone";
    for (const sch of s.schedules) {
      for (let m = 0; m < 3; m++) {
        const d = new Date(today.getUTCFullYear(), today.getUTCMonth() + m, sch.dayOfMonth, 9);
        const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (sch.lastPaidPeriod === period) continue;
        out.push({
          id: `${sch.id}|${period}`,
          name: `${name(sch.workerId)} · ${dollars(sch.amountCents)}${sch.active ? "" : " (paused)"}`,
          startDate: d,
          endDate: new Date(d.getTime() + 60 * 60 * 1000),
          allDay: true,
          eventColor: sch.active ? ORANGE : "#9aa1ad",
          eventStyle: "colored",
          draggable: sch.active,
          resizable: false,
        });
      }
    }
    for (const run of s.runs) {
      const d = new Date(run.payday);
      const paid = run.envelopes.filter((e) => e.status === "PAID").length;
      const pending = run.envelopes.filter((e) => e.status === "PENDING").length;
      const status = pending ? `${pending} sending` : `${paid} of ${run.envelopes.length} paid`;
      out.push({
        id: `run|${run.id}`,
        name: `${run.kind === "SCHEDULED" ? "Payday" : run.label} · ${status}`,
        startDate: d,
        endDate: new Date(d.getTime() + 60 * 60 * 1000),
        allDay: true,
        eventColor: run.kind === "SCHEDULED" ? GREEN : INK,
        eventStyle: "colored",
        draggable: false,
        resizable: false,
        readOnly: true,
      });
    }
    return out;
  }, [s.schedules, s.runs, s.workers, today]);

  // Create the calendar once, with whatever data is current when Bryntum finishes loading.
  const latest = useRef({ events, today });
  useEffect(() => {
    latest.current = { events, today };
    if (cal.current) cal.current.eventStore.data = events;
  }, [events, today]);

  useEffect(() => {
    let disposed = false;
    loadBryntum()
      .then(({ Calendar }) => {
        if (disposed || !host.current) return;
        cal.current = new Calendar({
          appendTo: host.current,
          date: latest.current.today,
          mode: "month",
          modes: { day: null, week: null, year: null, agenda: null },
          sidebar: false,
          events: latest.current.events,
          features: {
            eventEdit: false,
            eventMenu: false,
            scheduleMenu: false,
            eventCopyPaste: false,
            drag: { creatable: false },
          },
          listeners: {
            beforeDragMoveEnd({ eventRecord, newStartDate }: { eventRecord: { id: string | number }; newStartDate: Date }) {
              const [scheduleId] = String(eventRecord.id).split("|");
              const day = newStartDate.getDate();
              if (day <= 28) void moveRef.current(scheduleId, day);
              return false; // the calendar redraws from the saved schedule
            },
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      cal.current?.destroy();
      cal.current = null;
    };
  }, []);

  return (
    <div className="routewell-calendar relative h-[560px] overflow-hidden rounded-[4px] border-2 border-ink bg-paper-hi">
      {failed && <p className="p-4 text-sm">The calendar couldn&apos;t load. Refresh the page to try again.</p>}
      <div ref={host} className="h-full" />
    </div>
  );
}
