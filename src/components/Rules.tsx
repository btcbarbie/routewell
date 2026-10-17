"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { AiMark, Btn } from "./ui";

export function Rules({ s, change }: { s: Snapshot; change: (body: object) => Promise<boolean> }) {
  const [text, setText] = useState("");
  return (
    <div className="max-w-2xl pt-8">
      <h2 className="font-display text-[22px] font-bold">Expense rules</h2>
      <p className="mt-2 text-[15px] leading-relaxed">
        When your staff pay for something for work with their own money, like a taxi to a client or a client lunch, they send you the receipt and you pay them back.
        These rules say what you&apos;ll pay back.
      </p>
      <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-soft">
        <AiMark /> checks every receipt against these and flags anything that breaks one. You decide.
      </p>

      <ul className="mt-5 space-y-3">
        {s.rules.map((r) => (
          <li key={r.id} className="rounded-[4px] border-2 border-ink bg-paper-hi px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{r.text}</p>
              <Btn variant="ghost" className="shrink-0 text-ink-soft" onClick={() => change({ remove: r.id })}>
                Remove
              </Btn>
            </div>
            {r.example && (
              <p className="mt-1 text-[14px] text-ink-soft">
                <span className="font-semibold text-ink">For example:</span> {r.example}
              </p>
            )}
          </li>
        ))}
        {!s.rules.length && <li className="text-sm text-ink-soft">No rules yet. Receipts are still read and checked for duplicates.</li>}
      </ul>

      <form
        className="mt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await change({ add: text })) setText("");
        }}
      >
        <label className="text-sm font-semibold" htmlFor="new-rule">
          Add a rule, in your own words
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="new-rule"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Hotels for work trips: we pay back up to $180 a night."
            className="min-w-0 flex-1 rounded-[4px] border-2 border-ink bg-paper-hi px-3 py-2 focus:outline-none"
          />
          <Btn type="submit">Add rule</Btn>
        </div>
      </form>
    </div>
  );
}
