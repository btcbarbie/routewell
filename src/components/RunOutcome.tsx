"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { AgentTrail } from "./AgentTrail";
import { AiNote, Stamp, dollars } from "./ui";

type Run = Snapshot["runs"][number];

/** What happened to each payment in a sent pay run, and what the agent did about anything that wasn't paid. */
export function RunOutcome({ s, run }: { s: Snapshot; run: Run }) {
  const agent = s.agentRuns.find((a) => a.trigger === "RESULTS" && a.payRunId === run.id);
  const pending = run.envelopes.some((e) => e.status === "PENDING");
  const name = (e: Run["envelopes"][number]) => s.workers.find((w) => w.id === e.workerId)?.name ?? e.nameAsWritten;

  return (
    <div>
      <ul className="mt-2 divide-y divide-paper-line">
        {run.envelopes.map((e) => (
          <li key={e.id} className="py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <b className="font-semibold">{name(e)}</b> <span className="text-ink-soft">· {e.description}</span>
                {e.status !== "PAID" && e.statusDetail && <span className="block text-[13px] text-ink-soft">{e.statusDetail}</span>}
              </span>
              <span className="flex items-center gap-3">
                {e.txUrl && (
                  <a href={e.txUrl} target="_blank" rel="noreferrer" className="text-[13px] underline underline-offset-2">
                    On chain
                  </a>
                )}
                <span className="font-mono">{dollars(e.amountCents)}</span>
                <Stamp kind={e.status} />
              </span>
            </div>
            {e.followUpKind === "CARRIED" && <p className="mt-1 font-hand text-[18px] leading-tight">→ {e.followUp}</p>}
            {e.followUpKind === "REMINDER" && e.followUp && <Reminder to={name(e)} text={e.followUp} />}
          </li>
        ))}
      </ul>
      {agent ? (
        <div className="mt-3">
          <AgentTrail run={agent} />
        </div>
      ) : run.resultSummary ? (
        <AiNote text={run.resultSummary} label="AFTER PAYDAY" />
      ) : (
        <p className="mt-2 font-hand text-[19px]">
          {pending ? "Waiting for PayPal to finish. This page checks again by itself." : "The agent is looking at what wasn't paid…"}
        </p>
      )}
    </div>
  );
}

function Reminder({ to, text }: { to: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1.5 rounded-[2px] border-[1.5px] border-dashed border-ink px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-wide">REMINDER FOR {to.toUpperCase()}, READY TO SEND</span>
        <button
          type="button"
          className="cursor-pointer text-[13px] underline underline-offset-2"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 font-hand text-[18px] leading-tight">{text}</p>
    </div>
  );
}
