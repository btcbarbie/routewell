"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { Intake } from "./Intake";
import { AiMark, Btn, dollars } from "./ui";

type Way = "usual" | "tell" | "one" | "upload";

const WAYS: { id: Way; label: string }[] = [
  { id: "usual", label: "Pay everyone their usual" },
  { id: "tell", label: "Tell the AI" },
  { id: "one", label: "Add one by one" },
  { id: "upload", label: "Upload a sheet or receipts" },
];

/** The four ways to start this month's pay. Every way ends with the AI checking each envelope. */
export function StartRun({
  s,
  busy,
  read,
  run,
}: {
  s: Snapshot;
  busy: string | null;
  read: (form: FormData) => Promise<boolean>;
  run: (body: object) => Promise<boolean>;
}) {
  const [way, setWay] = useState<Way>("usual");
  const scheduled = new Set(s.schedules.filter((x) => x.active).map((x) => x.workerId));
  const inDraft = new Set((s.draft?.envelopes ?? []).filter((e) => e.status === "DRAFT" && e.kind === "WORK").map((e) => e.workerId));
  const usual = s.workers.filter((w) => w.usualCents && !scheduled.has(w.id) && !inDraft.has(w.id));
  const usualTotal = usual.reduce((sum, w) => sum + (w.usualCents ?? 0), 0);
  const notIncluded = s.workers.filter((w) => !usual.includes(w));
  const reading = busy === "reading";

  return (
    <section className="mb-7 rounded-[4px] border-2 border-ink bg-paper-hi">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b-[1.5px] border-dashed border-paper-line px-3.5 py-3">
        <h2 className="font-display text-xl font-bold">Start this month&apos;s pay</h2>
        <AiMark>AI CHECKS EVERY ENVELOPE</AiMark>
      </div>

      <div className="flex flex-wrap gap-1 border-b-[1.5px] border-dashed border-paper-line px-3.5 py-2.5" role="tablist">
        {WAYS.map((w) => (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={way === w.id}
            onClick={() => setWay(w.id)}
            className={`cursor-pointer rounded-[3px] border-[1.5px] px-2.5 py-1.5 text-[13px] font-semibold ${way === w.id ? "border-ink bg-ink text-paper-hi" : "border-paper-line text-ink hover:border-ink"}`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="p-3.5">
        {way === "usual" && (
          <div>
            {usual.length ? (
              <>
                <ul className="divide-y divide-paper-line rounded-[3px] border-[1.5px] border-paper-line">
                  {usual.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span>
                        <b className="font-semibold">{w.name}</b> <span className="text-ink-soft">· {w.city}</span>
                      </span>
                      <span className="font-mono">{dollars(w.usualCents ?? 0)}</span>
                    </li>
                  ))}
                </ul>
                {notIncluded.length > 0 && (
                  <p className="mt-2 text-[13px] text-ink-soft">
                    Not included:{" "}
                    {notIncluded
                      .map((w) => `${w.name} (${scheduled.has(w.id) ? "paid on a schedule" : inDraft.has(w.id) ? "already added" : w.role === "STAFF" && !w.usualCents ? "staff, expenses only" : "no usual amount"})`)
                      .join(", ")}
                    . Set usual amounts on People.
                  </p>
                )}
                <Btn variant="primary" className="mt-3 !py-2.5 !text-base" disabled={busy === "usual"} onClick={() => run({ action: "USUAL" })}>
                  {busy === "usual" ? "Making envelopes…" : `Make ${usual.length} envelope${usual.length === 1 ? "" : "s"} · ${dollars(usualTotal)}`}
                </Btn>
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                {s.workers.length ? "Nobody has a usual amount left to add. Set one on People, or use another way." : "Add the people you pay first, on People."}
              </p>
            )}
          </div>
        )}

        {way === "upload" && <p className="mb-3 text-[13px] text-ink-soft">Receipts are checked against your expense rules ({s.rules.length} set).</p>}
        {(way === "tell" || way === "upload") && <Intake key={way} mode={way} workers={s.workers} isDemo={s.isDemo} onSubmit={read} busy={reading} />}

        {way === "one" && <AddOne s={s} busy={busy === "one"} run={run} />}
      </div>

      {(reading || busy === "usual" || busy === "one" || s.draft?.intakeSummary) && (
        <div className="flex flex-wrap items-baseline gap-2.5 border-t-2 border-ink bg-acid px-3.5 py-3">
          <AiMark />
          <span className="font-hand text-[22px] leading-tight text-ink">
            {reading
              ? "Reading everything and checking each payment. This takes about half a minute."
              : busy === "usual" || busy === "one"
                ? "Checking each envelope against usual amounts and last month."
                : s.draft?.intakeSummary}
          </span>
        </div>
      )}
    </section>
  );
}

function AddOne({ s, busy, run }: { s: Snapshot; busy: boolean; run: (body: object) => Promise<boolean> }) {
  const [workerId, setWorkerId] = useState(s.workers[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const person = s.workers.find((w) => w.id === workerId);
  const input = "mt-1 w-full rounded-[3px] border-[1.5px] border-ink bg-paper px-2.5 py-2 focus:outline-none";

  if (!s.workers.length) return <p className="text-sm text-ink-soft">Add the people you pay first, on People.</p>;

  return (
    <form
      className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run({ action: "ADD", workerId, amountUsd: Number(amount), description: what })) {
          setAmount("");
          setWhat("");
        }
      }}
    >
      <label className="block text-sm font-semibold">
        Who
        <select className={`${input} cursor-pointer`} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          {s.workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Amount ($)
        <input className={`${input} font-mono`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={person?.usualCents ? (person.usualCents / 100).toFixed(2) : "100.00"} />
      </label>
      <label className="block text-sm font-semibold">
        What for
        <input className={input} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="October design work" />
      </label>
      <Btn type="submit" disabled={busy} className="!py-2.5">
        {busy ? "Adding…" : "Add envelope"}
      </Btn>
      {person && <p className="text-[13px] text-ink-soft sm:col-span-4">{person.rateNote}{person.usualCents ? ` · usually ${dollars(person.usualCents)}` : ""}</p>}
    </form>
  );
}
