"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { AgentTrail } from "./AgentTrail";
import { Btn, Stamp, dollars } from "./ui";

// Bryntum runs in the browser only.
const PaydayCalendar = dynamic(() => import("./PaydayCalendar").then((m) => m.PaydayCalendar), {
  ssr: false,
  loading: () => <div className="grid h-[560px] place-items-center rounded-[4px] border-2 border-ink font-hand text-xl">Opening the calendar…</div>,
});

type Act = (body: object) => Promise<(Snapshot & { message?: string }) | null>;

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** One person's paydays, shown on their card in People, with a way to set one up. */
export function PersonPayday({ s, workerId, act }: { s: Snapshot; workerId: string; act: Act }) {
  const [adding, setAdding] = useState(false);
  const mine = s.schedules.filter((x) => x.workerId === workerId);
  return (
    <div className="mt-3 border-t-[1.5px] border-dashed border-paper-line pt-2.5">
      {mine.map((sch) => (
        <div key={sch.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>
            <b className="font-semibold">Payday:</b> <span className="font-mono font-semibold">{dollars(sch.amountCents)}</span> on the {ordinal(sch.dayOfMonth)} of every month
            <span className="text-ink-soft"> · {sch.note}</span>
          </span>
          {sch.active ? <Stamp kind="SCHEDULED" /> : <span className="font-mono text-[11px] font-semibold tracking-wider text-ink-soft">PAUSED</span>}
          <span className="flex gap-3">
            <Btn variant="ghost" className="!px-0" onClick={() => act({ action: "TOGGLE_SCHEDULE", scheduleId: sch.id, active: !sch.active })}>
              {sch.active ? "Pause" : "Resume"}
            </Btn>
            <Btn variant="ghost" className="!px-0 text-ink-soft" onClick={() => act({ action: "REMOVE_SCHEDULE", scheduleId: sch.id })}>
              Remove
            </Btn>
          </span>
        </div>
      ))}
      {adding ? (
        <AddPayday s={s} workerId={workerId} act={act} onDone={() => setAdding(false)} />
      ) : (
        <Btn variant="ghost" className="!px-0" onClick={() => setAdding(true)}>
          {mine.length ? "Add another payday" : "Set up a payday"}
        </Btn>
      )}
    </div>
  );
}

/** The payday settings and demo control, shown under the people. */
export function PaydaySettings({ s, act, busy, openMonth }: { s: Snapshot; act: Act; busy: string | null; openMonth: () => void }) {
  return (
    <section className="mt-10 border-t-2 border-ink pt-6">
      <h2 className="font-display text-[22px] font-bold">Paydays</h2>
      <p className="mt-1 max-w-2xl text-[15px]">
        A payday is a payment that repeats: the same amount, on the same day every month. Set one up on a person&apos;s card above, and Routewell remembers it.
      </p>
      <Settings s={s} act={act} />
      {s.isDemo && s.schedules.length > 0 && <DemoControl s={s} act={act} busy={busy} openMonth={openMonth} />}
    </section>
  );
}

/** The paydays as a calendar. Drag an upcoming one to move it. */
export function PaydayCalendarSection({ s, act }: { s: Snapshot; act: Act }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">Paydays on the calendar</h3>
        <span className="text-[13px] text-ink-soft">Drag an upcoming payday to move it</span>
      </div>
      <PaydayCalendar s={s} move={async (scheduleId, day) => !!(await act({ action: "MOVE_SCHEDULE", scheduleId, dayOfMonth: day }))} />
      <p className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-orange align-middle" />Upcoming payday</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-green align-middle" />Paid on a payday</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-ink align-middle" />Pay runs you sent</span>
      </p>
    </section>
  );
}

function AddPayday({ s, workerId, act, onDone }: { s: Snapshot; workerId: string; act: Act; onDone: () => void }) {
  const person = s.workers.find((w) => w.id === workerId);
  const [amount, setAmount] = useState(person?.usualCents ? (person.usualCents / 100).toFixed(2) : "");
  const [day, setDay] = useState("28");
  const [note, setNote] = useState("Monthly retainer");
  const input = "mt-1 w-full rounded-[3px] border-[1.5px] border-ink bg-paper px-2 py-1.5 focus:outline-none";

  return (
    <form
      className="mt-2 grid gap-2 sm:grid-cols-[0.9fr_0.8fr_1.3fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await act({ action: "CREATE_SCHEDULE", workerId, amountUsd: Number(amount), dayOfMonth: Number(day), note })) onDone();
      }}
    >
      <label className="block text-[13px] font-semibold">
        Amount ($)
        <input className={`${input} font-mono`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1500.00" autoFocus />
      </label>
      <label className="block text-[13px] font-semibold">
        Every month on the
        <select className={`${input} cursor-pointer font-mono`} value={day} onChange={(e) => setDay(e.target.value)}>
          {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
            <option key={d} value={d}>
              {ordinal(Number(d))}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[13px] font-semibold">
        What for
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Monthly retainer" />
      </label>
      <div className="flex gap-2">
        <Btn type="submit" className="!py-1.5">
          Save
        </Btn>
        <Btn variant="ghost" onClick={onDone}>
          Cancel
        </Btn>
      </div>
    </form>
  );
}

function Settings({ s, act }: { s: Snapshot; act: Act }) {
  const [budget, setBudget] = useState((s.paydayBudgetCents / 100).toFixed(0));
  return (
    <section className="mt-4 rounded-[4px] border-2 border-ink bg-paper-hi p-4">
      <h3 className="font-display text-lg font-bold">When a payday comes round</h3>
      <fieldset className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        {(
          [
            ["ASK", "Ask me first", "A few days before, the agent adds the payment to this month's envelopes, checks it, and waits for you to press Seal and send."],
            ["AUTO", "Pay automatically", "On the day, Routewell pays the amount you set, as long as it's within your monthly budget. Anything that looks off is held back."],
          ] as const
        ).map(([mode, title, body]) => (
          <label key={mode} className={`block cursor-pointer rounded-[4px] border-2 p-2.5 ${s.paydayMode === mode ? "border-ink" : "border-paper-line"}`}>
            <span className="flex items-center gap-2 font-semibold">
              <input type="radio" name="paydayMode" checked={s.paydayMode === mode} onChange={() => act({ action: "SET_MODE", mode })} className="accent-[#ff5a1f]" />
              {title}
            </span>
            <span className="mt-0.5 block pl-5 text-[13px] text-ink-soft">{body}</span>
          </label>
        ))}
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <form
          className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await act({ action: "SET_BUDGET", amountUsd: Number(budget) });
          }}
        >
          <label className="text-sm font-semibold" htmlFor="budget">
            Most paydays can pay in a month
          </label>
          <span className="font-mono">$</span>
          <input id="budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-24 rounded-[3px] border-[1.5px] border-ink bg-paper px-2 py-1 font-mono" />
          <Btn type="submit" className="!py-1">
            Save
          </Btn>
        </form>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={s.autopilotPaused} onChange={(e) => act({ action: "SET_PAUSED", paused: e.target.checked })} className="size-4 accent-[#ff5a1f]" />
          Pause all paydays
        </label>
      </div>
      {s.autopilotPaused && <p className="mt-2 text-[13px] font-semibold text-orange">All paydays are paused. None will be prepared or paid until you untick this.</p>}
    </section>
  );
}

function DemoControl({ s, act, busy, openMonth }: { s: Snapshot; act: Act; busy: string | null; openMonth: () => void }) {
  const latestPrep = s.agentRuns[0]?.trigger === "PAYDAY" ? s.agentRuns[0] : undefined;
  const [pretend, setPretend] = useState(defaultPretend(s));
  const [lastMode, setLastMode] = useState(s.paydayMode);
  const [message, setMessage] = useState<string | null>(null);
  if (lastMode !== s.paydayMode) {
    setLastMode(s.paydayMode);
    setPretend(defaultPretend(s));
  }
  return (
    <section className="mt-6 rounded-[4px] border-2 border-dashed border-ink p-4">
      <p className="font-mono text-[11px] font-semibold tracking-wider">DEMO ONLY: SEE A PAYDAY NOW</p>
      <p className="mt-1 text-sm">
        {s.paydayMode === "AUTO"
          ? "Paydays happen on their date. To see one without waiting, pretend it's payday."
          : "The agent prepares a payday a few days before. To see it without waiting, pretend it's a couple of days before."}
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
        {s.pretendToday && (
          <span className="text-[13px]">
            Pretending today is <b>{s.pretendToday}</b>.{" "}
            <Btn variant="ghost" className="!p-0" onClick={() => act({ action: "BACK_TO_TODAY" })}>
              Back to today
            </Btn>
          </span>
        )}
      </div>
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
