"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { Btn, Rail, SectionTitle, shortAddress } from "./ui";

export function People({ s }: { s: Snapshot }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="pt-8">
      <SectionTitle hint="What works in each person's country comes from a checked list, not the AI">Your people</SectionTitle>
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
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
