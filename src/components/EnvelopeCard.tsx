"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { AiNote, Btn, Rail, Stamp, dollars, localApprox, stampFor, type Envelope, type Worker } from "./ui";

const METHOD_NOTE: Record<string, string> = {
  PAYPAL: "to their PayPal",
  PYUSD: "to their own wallet",
};

export function EnvelopeCard({
  e,
  worker,
  fx,
  editable,
  act,
}: {
  e: Envelope;
  worker: Worker | undefined;
  fx: Snapshot["fx"];
  editable: boolean;
  act: (id: string, body: object) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState((e.amountCents / 100).toFixed(2));
  const needsLook = e.stamp === "LOOK_AGAIN" && !e.ownerDecision && e.status === "DRAFT";
  const approx = localApprox(e.amountCents, worker, fx);
  const where = worker ? `${worker.city}, ${worker.countryName}` : "Not one of your people";

  return (
    <article
      id={`env-${e.id}`}
      className={`relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-[4px] border-2 bg-paper-hi px-4 pb-3.5 pt-4 ${needsLook ? "border-orange" : "border-ink"}`}
    >
      <div className="pointer-events-none absolute inset-x-3 top-2 border-t-[1.5px] border-dashed border-paper-line" aria-hidden />
      <div className="mt-1.5 min-w-0">
        <h3 className="truncate font-display text-[19px] font-bold">{worker?.name ?? e.nameAsWritten}</h3>
        <p className="text-[13px] text-ink-soft">
          {where} · {e.description}
        </p>
        {e.calculation && <p className="mt-0.5 font-mono text-[12px] text-ink-soft">{e.calculation}</p>}
      </div>
      <div className="mt-1.5 text-right">
        {editing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={async (ev) => {
              ev.preventDefault();
              await act(e.id, { action: "SET_AMOUNT", amountUsd: Number(amount) });
              setEditing(false);
            }}
          >
            <span className="font-mono">$</span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value)}
              className="w-24 rounded-[3px] border-[1.5px] border-ink bg-paper px-1.5 py-0.5 text-right font-mono text-base"
              aria-label="New amount in dollars"
            />
            <Btn type="submit" className="!px-2 !py-1 text-xs">
              Save
            </Btn>
          </form>
        ) : (
          <div className="font-mono text-[21px] font-semibold">{dollars(e.amountCents)}</div>
        )}
        {approx && <div className="font-mono text-xs text-ink-soft">{approx} today</div>}
      </div>

      <div className="col-span-2 mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <Rail method={e.method} />
          {editable && worker && worker.allowedMethods.length > 1 ? (
            <select
              value={e.method}
              onChange={(ev) => act(e.id, { action: "SET_METHOD", method: ev.target.value })}
              className="cursor-pointer rounded-[3px] border border-paper-line bg-transparent px-1 py-0.5 text-[13px] text-ink-soft"
              aria-label={`How ${worker.name} is paid`}
            >
              {worker.allowedMethods.map((m) => (
                <option key={m} value={m}>
                  {m === "PYUSD" ? "PYUSD to their wallet" : "PayPal"}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[13px] text-ink-soft">{METHOD_NOTE[e.method]}</span>
          )}
        </span>
        <Stamp kind={stampFor(e)} />
      </div>

      <div className="col-span-2">
        <AiNote text={e.aiNote} issues={e.status === "DRAFT" ? e.issues : []} loud={needsLook} />
      </div>

      {e.status !== "DRAFT" && e.statusDetail && (
        <p className="col-span-2 mt-2 text-[13px] text-ink-soft">
          {e.statusDetail}
          {e.txUrl && (
            <>
              {" "}
              <a href={e.txUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-2">
                See it on the blockchain
              </a>
            </>
          )}
        </p>
      )}

      {(e.receipt || (editable && e.status === "DRAFT")) && (
        <div className="col-span-2 mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {e.receipt && (
            <a href={`/api/receipts/${e.receipt.id}`} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-4">
              See receipt
            </a>
          )}
          {editable && e.status === "DRAFT" && (
            <>
              {needsLook && (
                <Btn variant="secondary" className="!py-1.5" onClick={() => act(e.id, { action: "PAY_ANYWAY" })} disabled={!e.workerId}>
                  It&apos;s fine, pay it
                </Btn>
              )}
              {e.ownerDecision === "PAY_ANYWAY" && (
                <Btn variant="ghost" onClick={() => act(e.id, { action: "UNDO_DECISION" })}>
                  Undo
                </Btn>
              )}
              {!editing && (
                <Btn variant="ghost" onClick={() => setEditing(true)}>
                  Change amount
                </Btn>
              )}
              <Btn variant="ghost" onClick={() => act(e.id, { action: "REMOVE" })}>
                Take it out
              </Btn>
            </>
          )}
        </div>
      )}
    </article>
  );
}
