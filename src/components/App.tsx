"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/state";
import type { AskResult } from "@/lib/ai";
import { Clocks } from "./Clocks";
import { History } from "./History";
import { Paydays } from "./Paydays";
import { People } from "./People";
import { Rules } from "./Rules";
import { ThisMonth } from "./ThisMonth";
import { Btn } from "./ui";

type Tab = "month" | "paydays" | "people" | "history" | "rules";
type Proposal = AskResult & { instruction: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "paydays", label: "Paydays" },
  { id: "people", label: "People" },
  { id: "history", label: "History" },
  { id: "rules", label: "Rules" },
];

export function App() {
  const [s, setS] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polls = useRef(0);

  const call = useCallback(async (url: string, init?: RequestInit) => {
    setError(null);
    try {
      const res = await fetch(url, init);
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong.");
        return null;
      }
      if (json.company) setS(json as Snapshot);
      return json;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return null;
    }
  }, []);

  const post = useCallback((url: string, body?: object) => call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), [call]);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((json) => (json.error ? setError(json.error) : setS(json as Snapshot)))
      .catch(() => setError("Couldn't reach the server. Check your connection and try again."));
  }, []);

  // While PayPal is still processing the latest batch, ask again every few seconds (for up to two minutes).
  const pendingRun = s?.runs.find((r) => r.paypalBatchId && r.envelopes.some((e) => e.status === "PENDING"));
  useEffect(() => {
    if (!pendingRun) {
      polls.current = 0;
      return;
    }
    if (polls.current > 24) return;
    const t = setTimeout(() => {
      polls.current += 1;
      void post(`/api/runs/${pendingRun.id}/refresh`);
    }, 5000);
    return () => clearTimeout(t);
  }, [pendingRun, s, post]);

  if (!s) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16">
        {error ? <p className="text-[#b42318]">{error}</p> : <p className="font-hand text-2xl">Setting out your desk…</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink py-4">
        <div className="flex items-center gap-2.5 font-display text-[22px] font-black tracking-tight">
          <span className="grid size-7 place-items-center rounded-full bg-orange font-mono text-[13px] font-semibold text-paper-hi" aria-hidden>
            R
          </span>
          Routewell
          <span className="ml-1 hidden font-sans text-sm font-medium text-ink-soft sm:inline">for {s.company}</span>
        </div>
        <span className="rounded-[3px] border-[1.5px] border-ink px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider">PAYPAL SANDBOX · TEST MONEY</span>
      </header>

      <Clocks workers={s.workers} />

      <nav className="mt-4 flex flex-wrap gap-1" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`cursor-pointer rounded-[3px] px-3 py-1.5 text-sm font-semibold ${tab === t.id ? "bg-ink text-paper-hi" : "text-ink hover:bg-paper-hi"}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-[4px] border-2 border-[#b42318] bg-paper-hi px-3.5 py-2.5 text-sm text-[#b42318]">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="cursor-pointer font-semibold" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {tab === "month" && (
        <ThisMonth
          s={s}
          busy={busy}
          read={async (form) => {
            setBusy("reading");
            const out = await call("/api/intake", { method: "POST", body: form });
            setBusy(null);
            return !!out;
          }}
          act={async (id, body) => {
            await post(`/api/envelopes/${id}`, body);
          }}
          send={async () => {
            setBusy("sending");
            await post("/api/send");
            setBusy(null);
          }}
          propose={async (text) => (await post("/api/ask", { text })) as Proposal | null}
          apply={async (p) => !!(await post("/api/ask/apply", { instruction: p.instruction, actions: p.actions }))}
          openHistory={() => setTab("history")}
        />
      )}
      {tab === "paydays" && (
        <Paydays
          s={s}
          busy={busy}
          act={async (body) => {
            const running = (body as { action?: string }).action === "PRETEND_AND_RUN";
            if (running) setBusy("payday");
            const out = await post("/api/paydays", body);
            if (running) setBusy(null);
            return out;
          }}
        />
      )}
      {tab === "people" && <People s={s} />}
      {tab === "history" && (
        <History
          s={s}
          busy={busy}
          refresh={async (id) => {
            setBusy("refreshing");
            await post(`/api/runs/${id}/refresh`);
            setBusy(null);
          }}
        />
      )}
      {tab === "rules" && <Rules s={s} change={async (body) => !!(await post("/api/rules", body))} />}

      <footer className="mt-14 border-t-2 border-ink pt-4 text-[13px] text-ink-soft">
        <p>
          Runs on PayPal&apos;s sandbox and Solana devnet with test money only. PayPal payouts go through PayPal Payouts. PYUSD payouts are sent from
          Routewell&apos;s own test wallet on Solana devnet, not through PayPal.
          {s.treasury && (
            <>
              {" "}
              Company PYUSD wallet: {(s.treasury.pyusdCents / 100).toFixed(2)} test PYUSD.
            </>
          )}
        </p>
        <Btn
          variant="ghost"
          className="mt-2 !px-0"
          onClick={async () => {
            if (!confirm("Start over with a fresh copy of the demo studio? Your changes here will be gone.")) return;
            setTab("month");
            await post("/api/reset");
          }}
        >
          Start the demo over
        </Btn>
      </footer>
    </main>
  );
}
