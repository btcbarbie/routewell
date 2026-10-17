"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { AgentTrail } from "./AgentTrail";
import { AiNote, Btn, Rail, SectionTitle, dollars } from "./ui";

// Bryntum runs in the browser only.
const PaydayCalendar = dynamic(() => import("./PaydayCalendar").then((m) => m.PaydayCalendar), {
  ssr: false,
  loading: () => <div className="grid h-[560px] place-items-center rounded-[4px] border-2 border-ink font-hand text-xl">Opening the calendar…</div>,
});

type Act = (body: object) => Promise<(Snapshot & { message?: string }) | null>;

export function Paydays({ s, act, busy, openMonth }: { s: Snapshot; act: Act; busy: string | null; openMonth: () => void }) {
  // The agent's most recent piece of work, if it was preparing a payday.
  const latestPrep = s.agentRuns[0]?.trigger === "PAYDAY" ? s.agentRuns[0] : undefined;
  const [budget, setBudget] = useState((s.paydayBudgetCents / 100).toFixed(0));
  const [pretend, setPretend] = useState(defaultPretend(s));
  const [lastMode, setLastMode] = useState(s.paydayMode);
  if (lastMode !== s.paydayMode) {
    setLastMode(s.paydayMode);
    setPretend(defaultPretend(s));
  }
  const [message, setMessage] = useState<string | null>(null);
  const name = (id: string) => s.workers.find((w) => w.id === id)?.name ?? "Someone";
  const latest = s.runs.find((r) => r.kind === "SCHEDULED");

  return (
    <div className="pt-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <SectionTitle hint="Drag an upcoming payday to move it">Paydays</SectionTitle>
          <PaydayCalendar s={s} move={async (scheduleId, day) => !!(await act({ action: "MOVE_SCHEDULE", scheduleId, dayOfMonth: day }))} />
          <p className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
            <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-orange align-middle" />Scheduled</span>
            <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-green align-middle" />Paid on schedule</span>
            <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-ink align-middle" />Pay runs you sent</span>
          </p>

          {latest && (
            <section className="mt-6 rounded-[4px] border-2 border-ink bg-paper-hi p-4">
              <h3 className="font-display text-lg font-bold">{latest.label}</h3>
              <ul className="mt-1 divide-y divide-paper-line">
                {latest.envelopes.map((e) => (
                  <li key={e.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b className="font-semibold">{name(e.workerId ?? "")}</b> <span className="text-ink-soft">· {e.description}</span>
                      </span>
                      <span className="font-mono">{dollars(e.amountCents)}</span>
                    </div>
                    <AiNote text={e.aiNote} issues={e.issues} loud={e.issues.length > 0} />
                    {e.statusDetail && <p className="mt-1 text-[13px] text-ink-soft">{e.statusDetail}</p>}
                  </li>
                ))}
              </ul>
              {latest.resultSummary && <AiNote text={latest.resultSummary} label="AFTER PAYDAY" />}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section>
            <SectionTitle>How paydays work</SectionTitle>
            <p className="text-sm">Some people are paid the same amount on the same day every month. Set it once and Routewell remembers.</p>
            <fieldset className="mt-3 space-y-2 text-sm">
              {(
                [
                  ["ASK", "Ask me first", "A few days before, the agent puts the payment in this month's envelopes, checks it, and waits for you to press Seal and send."],
                  ["AUTO", "Pay automatically", "On the day, Routewell pays the amount you approved, as long as it's within your monthly budget. Anything off is held back."],
                ] as const
              ).map(([mode, title, body]) => (
                <label key={mode} className={`block cursor-pointer rounded-[4px] border-2 p-2.5 ${s.paydayMode === mode ? "border-ink bg-paper-hi" : "border-paper-line"}`}>
                  <span className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="paydayMode" checked={s.paydayMode === mode} onChange={() => act({ action: "SET_MODE", mode })} className="accent-[#ff5a1f]" />
                    {title}
                  </span>
                  <span className="mt-0.5 block pl-5 text-[13px] text-ink-soft">{body}</span>
                </label>
              ))}
            </fieldset>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await act({ action: "SET_BUDGET", amountUsd: Number(budget) });
              }}
            >
              <label className="text-sm font-semibold" htmlFor="budget">
                Budget
              </label>
              <span className="font-mono">$</span>
              <input id="budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-24 rounded-[3px] border-[1.5px] border-ink bg-paper-hi px-2 py-1 font-mono" />
              <span className="text-sm text-ink-soft">a month</span>
              <Btn type="submit" className="!py-1">
                Save
              </Btn>
            </form>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={s.autopilotPaused} onChange={(e) => act({ action: "SET_PAUSED", paused: e.target.checked })} className="size-4 accent-[#ff5a1f]" />
              Pause all scheduled paydays
            </label>
          </section>

          <section>
            <SectionTitle>Scheduled</SectionTitle>
            <ul className="space-y-2.5">
              {s.schedules.map((sch) => {
                const w = s.workers.find((x) => x.id === sch.workerId);
                return (
                  <li key={sch.id} className="rounded-[4px] border-2 border-ink bg-paper-hi p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <b className="font-display text-base">{w?.name}</b>
                      {w && <Rail method={w.payoutMethod} />}
                    </div>
                    <div className="font-mono">
                      {dollars(sch.amountCents)} on day {sch.dayOfMonth}
                    </div>
                    <div className="text-[13px] text-ink-soft">From your words: &ldquo;{sch.createdFrom}&rdquo;</div>
                    <Btn variant="ghost" className="!px-0" onClick={() => act({ action: "TOGGLE_SCHEDULE", scheduleId: sch.id, active: !sch.active })}>
                      {sch.active ? "Pause" : "Resume"}
                    </Btn>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[13px] text-ink-soft">Add one from This month&apos;s ask bar, like &ldquo;Pay Ali $30 on the 15th of every month&rdquo;.</p>
          </section>

          <section className="rounded-[4px] border-2 border-dashed border-ink p-3">
            <p className="font-mono text-[11px] font-semibold tracking-wider">DEMO CONTROL</p>
            <p className="mt-1 text-sm">
              {s.paydayMode === "AUTO"
                ? "Paydays run on their date. To see one now, pretend it's payday."
                : "The agent prepares a payday a few days before. To see it now, pretend it's a couple of days before payday."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="date" value={pretend} onChange={(e) => setPretend(e.target.value)} className="rounded-[3px] border-[1.5px] border-ink bg-paper-hi px-2 py-1 font-mono text-sm" aria-label="Pretend today is" />
              <Btn
                disabled={busy === "payday"}
                onClick={async () => {
                  setMessage(null);
                  const out = await act({ action: "PRETEND_AND_RUN", date: pretend });
                  if (out?.message) setMessage(out.message);
                }}
              >
                {busy === "payday" ? "Running…" : "Pretend it's this day"}
              </Btn>
            </div>
            {s.pretendToday && (
              <p className="mt-2 text-[13px]">
                Pretending today is <b>{s.pretendToday}</b>.{" "}
                <Btn variant="ghost" className="!p-0" onClick={() => act({ action: "BACK_TO_TODAY" })}>
                  Back to today
                </Btn>
              </p>
            )}
            {message && !latestPrep && <p className="mt-2 font-hand text-[19px] leading-tight">{message}</p>}
            {latestPrep && (
              <div className="mt-3">
                <AgentTrail run={latestPrep} />
                <Btn className="mt-2" onClick={openMonth}>
                  Review it in This month
                </Btn>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function defaultPretend(s: Snapshot) {
  const today = new Date(`${s.today}T12:00:00Z`);
  const due = s.schedules.find((x) => x.active);
  const day = (due ? due.dayOfMonth : 28) - (s.paydayMode === "AUTO" ? 0 : 2);
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), Math.max(1, day), 12));
  if (d < today) d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
