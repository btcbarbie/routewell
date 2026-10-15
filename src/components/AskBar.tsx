"use client";

import { useState } from "react";
import type { AskResult } from "@/lib/ai";
import { AiMark, Btn } from "./ui";

type Proposal = AskResult & { instruction: string };

export function AskBar({
  propose,
  apply,
  placeholder = 'Tell it what to change: "Add a $50 bonus for Maria"',
}: {
  propose: (text: string) => Promise<Proposal | null>;
  apply: (p: Proposal) => Promise<boolean>;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  return (
    <div className="mt-6">
      {proposal && (
        <div className="mb-2 rounded-[2px] border-[1.5px] border-ink bg-acid px-3 py-2.5">
          <AiMark />
          <p className="mt-1 font-hand text-[21px] leading-tight">{proposal.reply}</p>
          {proposal.actions.length > 0 && (
            <>
              <ul className="mt-1.5 space-y-0.5">
                {proposal.actions.map((a, i) => (
                  <li key={i} className="font-hand text-[19px] leading-tight">
                    → {a.label}
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex gap-2">
                <Btn
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await apply(proposal);
                    setBusy(false);
                    if (ok) setProposal(null);
                  }}
                >
                  {busy ? "Doing it…" : "Do it"}
                </Btn>
                <Btn variant="ghost" onClick={() => setProposal(null)}>
                  Cancel
                </Btn>
              </div>
            </>
          )}
        </div>
      )}
      <form
        className="flex rounded-[4px] border-2 border-ink bg-paper-hi"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          const p = await propose(text);
          setBusy(false);
          if (p) {
            setProposal(p);
            setText("");
          }
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-3">
          <AiMark />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-ink-soft focus:outline-none"
            aria-label="Tell the AI what to change"
          />
        </label>
        <button type="submit" disabled={busy} className="cursor-pointer border-l-2 border-ink bg-ink px-4 font-display text-[15px] font-bold text-paper-hi disabled:cursor-wait">
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
