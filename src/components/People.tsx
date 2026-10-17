"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { AddPerson } from "./AddPerson";
import { PaydayCalendarSection, PaydaySettings, PersonPayday } from "./Paydays";
import { Btn, Rail, SectionTitle, dollars, shortAddress, type Worker } from "./ui";

type Group = "PAYDAY" | "MONTH" | "STAFF";

// How each person gets paid decides which group they're in.
const GROUPS: { id: Group; title: string; body: string }[] = [
  { id: "PAYDAY", title: "On a payday", body: "The same amount on the same day every month. Routewell prepares it for you, so you don't add it to This month." },
  { id: "MONTH", title: "Paid in This month", body: "The amount depends on the work, like hours or pieces done. Add them to this month's pay each month." },
  { id: "STAFF", title: "Staff: expenses paid back", body: "Paid back for work costs, only when they send receipts. Add the receipts in This month." },
];

function groupOf(s: Snapshot, w: Worker): Group {
  if (s.schedules.some((x) => x.workerId === w.id)) return "PAYDAY";
  return w.role === "STAFF" ? "STAFF" : "MONTH";
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** One line at the top of each card saying how this person gets paid. */
function HowPaid({ s, w }: { s: Snapshot; w: Worker }) {
  const group = groupOf(s, w);
  const sch = s.schedules.filter((x) => x.workerId === w.id);
  const text =
    group === "PAYDAY"
      ? sch.map((x) => `${dollars(x.amountCents)} on the ${ordinal(x.dayOfMonth)} of every month${x.active ? "" : " (paused)"}`).join(", ")
      : group === "STAFF"
        ? "When they send receipts"
        : `Depends on the work · ${w.rateNote}`;
  const label = group === "PAYDAY" ? "ON A PAYDAY" : group === "STAFF" ? "EXPENSES PAID BACK" : "PAID IN THIS MONTH";
  return (
    <div className={`-mx-4 -mt-4 mb-3 flex flex-wrap items-baseline gap-x-2 rounded-t-[2px] px-4 py-2 text-[13px] ${group === "PAYDAY" ? "bg-ink text-paper-hi" : "border-b-[1.5px] border-dashed border-paper-line"}`}>
      <span className="font-mono text-[11px] font-semibold tracking-wider">{label}</span>
      <span className={group === "PAYDAY" ? "" : "text-ink-soft"}>{text}</span>
    </div>
  );
}

type PaydayAct = (body: object) => Promise<(Snapshot & { message?: string }) | null>;

export function People({
  s,
  change,
  paydays,
  busy,
  openMonth,
}: {
  s: Snapshot;
  change: (body: object) => Promise<boolean>;
  paydays: PaydayAct;
  busy: string | null;
  openMonth: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState(s.workers.length === 0);

  function renderCard(w: Worker) {
          const facts = s.countries[w.country];
    return (
            <article key={w.id} className="rounded-[4px] border-2 border-ink bg-paper-hi p-4">
              <HowPaid s={s} w={w} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-[19px] font-bold">{w.name}</h3>
                  <p className="text-[13px] text-ink-soft">
                    {w.city}, {w.countryName} · {w.role === "STAFF" ? "Staff" : "Contractor"} · {w.work}
                  </p>
                  <p className="font-mono text-xs text-ink-soft">{w.rateNote}</p>
                  <UsualPay w={w} change={change} />
                </div>
                <Rail method={w.payoutMethod} />
              </div>
              <p className="mt-2 text-[13px]">
                {w.payoutMethod === "PYUSD" ? (
                  <>
                    Wallet <span className="font-mono">{shortAddress(w.walletAddress)}</span>
                  </>
                ) : (
                  <>
                    PayPal <span className="font-mono">{w.paypalEmail}</span> <span className="text-ink-soft">(sandbox test account)</span>
                  </>
                )}
              </p>
              {facts && (
                <div className="mt-3 space-y-1.5 border-t-[1.5px] border-dashed border-paper-line pt-2.5 text-[13px]">
                  <p>
                    <b className="font-semibold">PayPal in {facts.name}:</b> {facts.paypal.note}
                  </p>
                  <p>
                    <b className="font-semibold">PYUSD:</b> {facts.pyusd.note}
                  </p>
                  <p className="text-xs text-ink-soft">
                    Sources:{" "}
                    {facts.sources.map((src, i) => (
                      <span key={src.url}>
                        {i > 0 && ", "}
                        <a href={src.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                          {src.label}
                        </a>
                      </span>
                    ))}
                  </p>
                </div>
              )}
              <PersonPayday s={s} workerId={w.id} act={paydays} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Btn
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/w/${w.choiceToken}`);
                    setCopied(w.id);
                    setTimeout(() => setCopied(null), 2000);
                  }}
                >
                  {copied === w.id ? "Link copied" : "Copy their payout choice link"}
                </Btn>
                <a href={`/w/${w.choiceToken}`} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
                  Open it
                </a>
                {w.choiceUpdatedAt && <span className="text-xs text-ink-soft">Updated by them {new Date(w.choiceUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                <Btn variant="ghost" className="ml-auto text-ink-soft" onClick={() => change({ remove: w.id })}>
                  Remove
                </Btn>
              </div>
            </article>
          );
  }

  return (
    <div className="pt-8">
      <SectionTitle
        hint={
          !adding && (
            <Btn onClick={() => setAdding(true)} className="!py-1.5">
              Add a person
            </Btn>
          )
        }
      >
        Your people
      </SectionTitle>
      {adding && <AddPerson countries={s.countries} add={change} onDone={() => setAdding(false)} />}
      {s.workers.length > 0 && <p className="-mt-1 mb-3 text-[13px] text-ink-soft">What works in each person&apos;s country comes from a checked list with sources, not from the AI.</p>}
      {GROUPS.map((g) => {
        const people = s.workers.filter((w) => groupOf(s, w) === g.id);
        if (!people.length) return null;
        return (
          <section key={g.id} className="mb-7">
            <h3 className="font-display text-lg font-bold">{g.title}</h3>
            <p className="mb-3 text-[14px] text-ink-soft">{g.body}</p>
            <div className="grid gap-3.5 md:grid-cols-2">{people.map((w) => renderCard(w))}</div>
          </section>
        );
      })}
      {s.workers.length > 0 && (
        <>
          <PaydaySettings s={s} act={paydays} busy={busy} openMonth={openMonth} />
          <PaydayCalendarSection s={s} act={paydays} />
        </>
      )}
    </div>
  );
}

function UsualPay({ w, change }: { w: Worker; change: (body: object) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(w.usualCents ? (w.usualCents / 100).toFixed(2) : "");
  if (editing) {
    return (
      <form
        className="mt-1.5 flex items-center gap-1.5 text-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await change({ setUsual: w.id, amountUsd: amount.trim() === "" ? null : Number(amount) })) setEditing(false);
        }}
      >
        <span>Usual pay $</span>
        <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="none" className="w-24 rounded-[3px] border-[1.5px] border-ink bg-paper px-1.5 py-0.5 font-mono" aria-label={`${w.name}'s usual pay`} />
        <Btn type="submit" className="!px-2 !py-0.5 text-xs">
          Save
        </Btn>
      </form>
    );
  }
  return (
    <p className="mt-1.5 text-sm">
      Usual pay: <b className="font-mono font-semibold">{w.usualCents ? dollars(w.usualCents) : "not set"}</b>{" "}
      <button type="button" onClick={() => setEditing(true)} className="cursor-pointer text-[13px] underline underline-offset-2">
        Change
      </button>
    </p>
  );
}
