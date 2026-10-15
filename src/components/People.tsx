"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { AddPerson } from "./AddPerson";
import { Btn, Rail, SectionTitle, shortAddress } from "./ui";

export function People({ s, change }: { s: Snapshot; change: (body: object) => Promise<boolean> }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState(s.workers.length === 0);
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
      <div className="grid gap-3.5 md:grid-cols-2">
        {s.workers.map((w) => {
          const facts = s.countries[w.country];
          return (
            <article key={w.id} className="rounded-[4px] border-2 border-ink bg-paper-hi p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-[19px] font-bold">{w.name}</h3>
                  <p className="text-[13px] text-ink-soft">
                    {w.city}, {w.countryName} · {w.role === "STAFF" ? "Staff" : "Contractor"} · {w.work}
                  </p>
                  <p className="font-mono text-xs text-ink-soft">{w.rateNote}</p>
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
        })}
      </div>
    </div>
  );
}
