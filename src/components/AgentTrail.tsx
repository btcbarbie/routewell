"use client";

import type { Snapshot } from "@/lib/state";
import { AiMark } from "./ui";

export type AgentRun = Snapshot["agentRuns"][number];

const MARK: Record<string, { sign: string; cls: string; label: string }> = {
  LOOK: { sign: "○", cls: "text-ink-soft", label: "Looked" },
  ACT: { sign: "●", cls: "text-ink", label: "Did" },
  BLOCKED: { sign: "✕", cls: "text-orange", label: "Stopped" },
};

const TITLE: Record<string, string> = {
  ASK: "You asked",
  RESULTS: "After PayPal finished",
  PAYDAY: "Before payday",
};

/** What the agent did, step by step. Every line is a real tool call saved by the server. */
export function AgentTrail({ run, showGoal = true }: { run: AgentRun; showGoal?: boolean }) {
  return (
    <div className="rounded-[2px] border-[1.5px] border-ink bg-acid px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <AiMark>AGENT</AiMark>
        <span className="font-mono text-[11px] font-semibold tracking-wide text-ink">
          {TITLE[run.trigger] ?? run.trigger}
          {run.status === "RUNNING" ? " · WORKING" : run.status === "FAILED" ? " · DIDN'T FINISH" : ""}
        </span>
      </div>
      {showGoal && run.trigger === "ASK" && <p className="mt-1 text-[13px] italic text-ink">&ldquo;{run.goal}&rdquo;</p>}
      {run.reply && <p className="mt-1 font-hand text-[21px] leading-tight text-ink">{run.reply}</p>}
      {run.steps.length > 0 && (
        <ol className="mt-2 space-y-0.5 border-t border-dashed border-ink/40 pt-2">
          {run.steps.map((st) => {
            const m = MARK[st.kind] ?? MARK.LOOK;
            return (
              <li key={st.id} className={`flex gap-2 text-[13px] leading-snug ${m.cls}`}>
                <span aria-label={m.label} className="w-3 shrink-0 text-center">
                  {m.sign}
                </span>
                <span>{st.text}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
