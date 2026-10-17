"use client";

import { useState } from "react";
import { AgentTrail, type AgentRun } from "./AgentTrail";
import { AiMark } from "./ui";

const EXAMPLES = ["Pay everyone their usual, but hold Ali until he confirms his wallet", "Who wasn't paid last month?", "Add a $50 bonus for Maria for the launch"];

/** Tell the Routewell agent what to do, or ask it about your records. It works in steps and shows each one. */
export function AskBar({ runs, ask }: { runs: AgentRun[]; ask: (text: string) => Promise<string | null> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const run = runs.find((r) => r.id === shown);

  async function go(instruction: string) {
    if (!instruction.trim()) return;
    setBusy(instruction);
    const id = await ask(instruction);
    setBusy(null);
    if (id) {
      setShown(id);
      setText("");
    }
  }

  return (
    <section className="mt-6">
      {busy && (
        <div className="mb-2 rounded-[2px] border-[1.5px] border-ink bg-acid px-3 py-2.5">
          <AiMark>AGENT</AiMark>
          <p className="mt-1 text-[13px] italic">&ldquo;{busy}&rdquo;</p>
          <p className="mt-1 font-hand text-[21px] leading-tight">Working on it: looking things up, then acting. Every step will be listed here.</p>
        </div>
      )}
      {!busy && run && (
        <div className="mb-2">
          <AgentTrail run={run} />
        </div>
      )}
      <form
        className="flex rounded-[4px] border-2 border-ink bg-paper-hi"
        onSubmit={(e) => {
          e.preventDefault();
          void go(text);
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-3">
          <AiMark>AGENT</AiMark>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell the agent what to do, or ask about your payments"
            className="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-ink-soft focus:outline-none"
            aria-label="Tell the agent what to do"
            disabled={!!busy}
          />
        </label>
        <button type="submit" disabled={!!busy} className="cursor-pointer border-l-2 border-ink bg-ink px-4 font-display text-[15px] font-bold text-paper-hi disabled:cursor-wait">
          {busy ? "…" : "Go"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-soft">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" disabled={!!busy} onClick={() => go(ex)} className="cursor-pointer text-left underline decoration-paper-line underline-offset-4 hover:text-ink hover:decoration-ink">
            {ex}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[12px] text-ink-soft">The agent can change this month&apos;s envelopes and scheduled paydays. It can&apos;t send money: that&apos;s always your Seal and send.</p>
    </section>
  );
}
