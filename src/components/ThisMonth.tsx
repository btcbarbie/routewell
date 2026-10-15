"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import type { AskResult } from "@/lib/ai";
import { AskBar } from "./AskBar";
import { EnvelopeCard } from "./EnvelopeCard";
import { Intake } from "./Intake";
import { ReviewGrid } from "./ReviewGrid";
import { AiNote, Btn, SectionTitle, dollars } from "./ui";

type Proposal = AskResult & { instruction: string };

export function ThisMonth({
  s,
  busy,
  read,
  act,
  send,
  propose,
  apply,
  openHistory,
}: {
  s: Snapshot;
  busy: string | null;
  read: (form: FormData) => Promise<boolean>;
  act: (id: string, body: object) => Promise<void>;
  send: () => Promise<void>;
  propose: (text: string) => Promise<Proposal | null>;
  apply: (p: Proposal) => Promise<boolean>;
  openHistory: () => void;
}) {
  const [view, setView] = useState<"envelopes" | "table">("envelopes");
  const envelopes = (s.draft?.envelopes.filter((e) => e.status === "DRAFT") ?? []).sort(
    (a, b) => Number(b.stamp === "LOOK_AGAIN" && !b.ownerDecision) - Number(a.stamp === "LOOK_AGAIN" && !a.ownerDecision),
  );
  const needsLook = envelopes.filter((e) => e.stamp === "LOOK_AGAIN" && !e.ownerDecision);
  const total = envelopes.reduce((sum, e) => sum + e.amountCents, 0);
  const pyusd = envelopes.filter((e) => e.method === "PYUSD");
  const pyusdTotal = pyusd.reduce((sum, e) => sum + e.amountCents, 0);
  const countries = new Set(s.workers.map((w) => w.country)).size;
  const nextPayday = nextScheduled(s);
  const lastRun = s.runs[0];
  const justSent = lastRun && lastRun.kind === "MANUAL" && lastRun.sentAt?.slice(0, 10) === s.today;
  const workerById = (id: string | null) => s.workers.find((w) => w.id === id);
  const month = s.draft?.label ?? new Date(`${s.today}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <section className="grid items-end gap-6 pb-7 pt-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <h1 className="font-display text-[clamp(52px,9vw,76px)] font-black leading-[0.92] tracking-[-0.035em]">
            Everyone
            <br />
            gets <em className="not-italic text-orange">paid.</em>
          </h1>
          <p className="mt-3 text-base font-medium text-ink-soft">
            <b className="font-semibold text-ink">{month.split(" ")[0]}</b> · {s.workers.length} people · {countries} countries
            {nextPayday && <> · next payday {nextPayday}</>}
          </p>
        </div>
        <div className="grid grid-cols-3 border-2 border-ink bg-paper-hi">
          <div className="border-r-2 border-ink p-3.5">
            <div className="font-mono text-[clamp(20px,3vw,30px)] font-semibold tracking-tight">{dollars(total).replace(/\.00$/, "")}</div>
            <div className="text-xs font-semibold">this month</div>
          </div>
          <div className="border-r-2 border-ink bg-acid p-3.5">
            <div className="font-mono text-[clamp(20px,3vw,30px)] font-semibold">{needsLook.length}</div>
            <div className="text-xs font-semibold">to check</div>
          </div>
          <div className="bg-orange p-3.5 text-paper-hi">
            <div className="font-mono text-[clamp(20px,3vw,30px)] font-semibold">{pyusd.length}</div>
            <div className="text-xs font-semibold">in PYUSD</div>
          </div>
        </div>
      </section>

      {justSent && !envelopes.length && (
        <section className="mb-7 rounded-[4px] border-2 border-ink bg-paper-hi p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold">Sent: {lastRun.label}</h2>
            <Btn variant="ghost" onClick={openHistory}>
              See every payment
            </Btn>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {lastRun.envelopes.filter((e) => e.status === "PAID").length} paid · {lastRun.envelopes.filter((e) => e.status === "PENDING").length} still with PayPal ·{" "}
            {lastRun.envelopes.filter((e) => ["UNCLAIMED", "FAILED", "RETURNED"].includes(e.status)).length} need attention
          </p>
          {lastRun.resultSummary ? (
            <AiNote text={lastRun.resultSummary} label="AFTER PAYDAY" />
          ) : (
            <p className="mt-2 font-hand text-[19px]">Waiting for PayPal to finish. This page checks again by itself.</p>
          )}
        </section>
      )}

      <Intake workers={s.workers} summary={s.draft?.intakeSummary ?? null} onSubmit={read} busy={busy === "reading"} />

      {envelopes.length > 0 && (
        <>
          <SectionTitle
            hint={
              <span className="inline-flex overflow-hidden rounded-[3px] border-[1.5px] border-ink text-[13px]">
                {(["envelopes", "table"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`cursor-pointer px-2.5 py-1 font-medium ${view === v ? "bg-ink text-paper-hi" : "text-ink"}`}
                  >
                    {v === "envelopes" ? "Envelopes" : "Table"}
                  </button>
                ))}
              </span>
            }
          >
            This month&apos;s envelopes
          </SectionTitle>

          {view === "envelopes" ? (
            <div className="grid gap-3.5 md:grid-cols-2">
              {envelopes.map((e) => (
                <EnvelopeCard key={e.id} e={e} worker={workerById(e.workerId)} fx={s.fx} editable act={act} />
              ))}
            </div>
          ) : (
            <ReviewGrid envelopes={envelopes} workers={s.workers} act={act} />
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink pt-4">
            <div className="text-sm text-ink-soft">
              {needsLook.length ? (
                <>
                  <b className="text-ink">
                    {needsLook.length} envelope{needsLook.length === 1 ? " needs" : "s need"} a look
                  </b>{" "}
                  before sending.
                </>
              ) : (
                <>
                  <b className="text-ink">{dollars(total - pyusdTotal)}</b> through PayPal
                  {pyusd.length > 0 && (
                    <>
                      {" "}
                      · <b className="text-ink">{dollars(pyusdTotal)}</b> in PYUSD
                      {s.treasury && <> (wallet has {dollars(s.treasury.pyusdCents)})</>}
                    </>
                  )}
                </>
              )}
            </div>
            <Btn
              variant="primary"
              disabled={busy === "sending"}
              onClick={() => {
                if (needsLook.length) {
                  document.getElementById(`env-${needsLook[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  return;
                }
                void send();
              }}
            >
              {busy === "sending" ? "Sending…" : needsLook.length ? "Check the flagged envelopes" : `Seal and send ${envelopes.length} envelope${envelopes.length === 1 ? "" : "s"}`}
            </Btn>
          </div>
        </>
      )}

      <AskBar propose={propose} apply={apply} />
    </>
  );
}

function nextScheduled(s: Snapshot) {
  const active = s.schedules.filter((x) => x.active);
  if (!active.length) return null;
  const today = new Date(`${s.today}T12:00:00Z`);
  const dates = active.map((x) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), x.dayOfMonth, 12));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (d < today || x.lastPaidPeriod === period) d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  });
  dates.sort((a, b) => a.getTime() - b.getTime());
  return dates[0].toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
