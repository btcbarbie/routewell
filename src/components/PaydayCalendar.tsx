"use client";

import { useMemo } from "react";
import { BryntumCalendar } from "@bryntum/calendar-react";
import type { EventModelConfig } from "@bryntum/calendar";
import "@bryntum/calendar/calendar.css";
import "@bryntum/calendar/stockholm-light.css";
import "@bryntum/calendar/fontawesome/css/fontawesome.css";
import "@bryntum/calendar/fontawesome/css/solid.css";
import type { Snapshot } from "@/lib/state";
import { dollars } from "./ui";

const ORANGE = "#ff5a1f";
const GREEN = "#2f6b4f";
const INK = "#1b2a4a";

/** Scheduled paydays for this month and the next two, plus paydays already paid. Drag an upcoming payday to move it. */
export function PaydayCalendar({ s, move }: { s: Snapshot; move: (scheduleId: string, day: number) => Promise<boolean> }) {
  const today = useMemo(() => new Date(`${s.today}T12:00:00Z`), [s.today]);

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

  return (
    <div className="routewell-calendar h-[560px] overflow-hidden rounded-[4px] border-2 border-ink">
      <BryntumCalendar
        date={today}
        mode="month"
        modes={{ day: null, week: null, year: null, agenda: null }}
        sidebar={false}
        events={events}
        eventEditFeature={false}
        eventMenuFeature={false}
        scheduleMenuFeature={false}
        eventCopyPasteFeature={false}
        dragFeature={{ creatable: false }}
        onBeforeDragMoveEnd={({ eventRecord, newStartDate }) => {
          const [scheduleId] = String(eventRecord.id).split("|");
          const day = newStartDate.getDate();
          if (day > 28) return false;
          void move(scheduleId, day);
          return false; // the calendar redraws from the saved schedule
        }}
      />
    </div>
  );
}
