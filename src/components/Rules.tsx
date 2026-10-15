"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { Btn, SectionTitle } from "./ui";

export function Rules({ s, change }: { s: Snapshot; change: (body: object) => Promise<boolean> }) {
  const [text, setText] = useState("");
  return (
    <div className="max-w-2xl pt-8">
      <SectionTitle hint="The AI checks every receipt against these">Spending rules</SectionTitle>
      <ul className="divide-y divide-paper-line rounded-[4px] border-2 border-ink bg-paper-hi">
        {s.rules.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span>{r.text}</span>
            <Btn variant="ghost" onClick={() => change({ remove: r.id })}>
              Remove
            </Btn>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await change({ add: text })) setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hotels: up to $180 a night"
          className="min-w-0 flex-1 rounded-[4px] border-2 border-ink bg-paper-hi px-3 py-2 focus:outline-none"
          aria-label="New spending rule"
        />
        <Btn type="submit">Add rule</Btn>
      </form>
    </div>
  );
}
