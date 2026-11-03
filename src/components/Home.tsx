"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { Clocks } from "./Clocks";
import { AiNote, Btn, Rail, Stamp, type Worker } from "./ui";

// The gaps in PayPal Payouts that Routewell fills. Every claim here is backed by PayPal's own docs or Routewell's code.
const GAPS = [
  {
    title: "It can't reach them",
    payouts: "Nigeria and Pakistan aren't on PayPal's list of countries that can receive Payouts.",
    routewell: "Pays them in PYUSD, digital dollars, to their own wallet, where that's legal.",
  },
  {
    title: "They can't keep dollars",
    payouts: "In India, PayPal accounts can't hold dollars: payments are converted to rupees and sent to the bank.",
    routewell: "Lets each person choose PYUSD instead, so their pay stays in dollars.",
  },
  {
    title: "It doesn't check the amount",
    payouts: "Sends whatever list of amounts you give it.",
    routewell: "AI checks every payment first: hours that don't match, a receipt already paid back, an amount far above usual.",
  },
  {
    title: "It stops at \u201cfailed\u201d",
    payouts: "Tells you a payment failed or hasn't been claimed, and leaves the rest to you.",
    routewell: "The agent follows up: carries failures to the next pay run for your OK, writes reminders, and never pays anyone twice.",
  },
];

const GAP_COUNTRIES = Object.values(COUNTRIES)
  .filter((c) => !c.paypal.canReceive && c.pyusd.allowed)
  .map((c) => c.name)
  .join(", ");

const STEPS: [string, string][] = [
  ["Prepare", "Pay everyone their usual, tell the AI what's different, add people one by one, or drop in a spreadsheet and receipts."],
  ["Check", "AI checks every payment against their rate, last month and your expense rules, and says why anything looks off."],
  ["Approve", "You fix, hold back or OK each flagged payment. Nothing moves until you press Seal and send."],
  ["Send", "PayPal pays the people it reaches, in one batch. PYUSD goes to everyone else's own wallet."],
  ["Follow up", "The agent works through anything that wasn't paid, without ever paying anyone twice."],
];

const CONTROL: [string, string][] = [
  ["Nothing moves without your OK", "The AI prepares and checks. Payments go out when you press Seal and send, and the server refuses if anything changed since you looked. A payday only pays by itself if you turn that on, within your budget."],
  ["A status on every payment", "Paid, still processing, not claimed yet, or not paid, from PayPal's own results and the blockchain."],
  ["Every decision recorded", "What you changed, what the AI flagged and why, and each step the agent took."],
  ["Nobody paid twice", "The same receipt or amount is caught before sending, and a payment that might still arrive is never sent again."],
];

const PYUSD_FACTS: [string, string][] = [
  ["Their own wallet", "PYUSD, PayPal's digital dollar, goes straight to the person's own wallet on Solana. They need a wallet app that holds Solana tokens."],
  ["Stays in dollars", "It holds its dollar value, so they can keep it or convert it when they choose."],
  ["Cashing out", "They change it into local money through an exchange or app available where they live. That step is outside Routewell."],
  ["Only where it's allowed", "Routewell offers PYUSD only in countries where we've checked that holding crypto is legal, with sources shown. In this demo it runs on Solana's test network with test coins."],
];

type Session = { demo: { name: string } | null; mine: { name: string } | null };

// Only city and time zone are used, for the clock strip.
const CITIES = [
  ["Austin", "America/Chicago"],
  ["Lagos", "Africa/Lagos"],
  ["Lahore", "Asia/Karachi"],
  ["Pune", "Asia/Kolkata"],
  ["Manila", "Asia/Manila"],
].map(([city, timezone]) => ({ city, timezone }) as unknown as Worker);

export function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState<"demo" | "mine" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((json) => !json.error && setSession(json))
      .catch(() => undefined);
  }, []);

  async function open(which: "demo" | "mine") {
    setBusy(which);
    setError(null);
    const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ open: which }) });
    const json = await res.json();
    if (json.error) {
      setBusy(null);
      return setError(json.error);
    }
    router.push("/app");
  }

  const demoButton = (
    <Btn variant="secondary" onClick={() => open("demo")} disabled={busy !== null} className="!px-5 !py-3 !text-base">
      {busy === "demo" ? "Opening…" : "See the demo company"}
    </Btn>
  );
  const ownButton = session?.mine ? (
    <Btn variant="primary" onClick={() => open("mine")} disabled={busy !== null}>
      {busy === "mine" ? "Opening…" : "Open your company"}
    </Btn>
  ) : (
    <Link href="/start" className="inline-block rounded-[4px] border-2 border-ink bg-orange px-5 py-3 font-display text-[17px] font-bold text-paper-hi shadow-[4px_4px_0_var(--ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--ink)]">
      Start your own
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between gap-3 border-b-2 border-ink py-4">
        <div className="flex items-center gap-2.5 font-display text-[22px] font-black tracking-tight">
          <span className="grid size-7 place-items-center rounded-full bg-orange font-mono text-[13px] font-semibold text-paper-hi" aria-hidden>
            R
          </span>
          Routewell
        </div>
        <span className="rounded-[3px] border-[1.5px] border-ink px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider">TEST MONEY ONLY</span>
      </header>
      <Clocks workers={CITIES} hideCounts />

      {/* Hero */}
      <section className="grid items-center gap-10 py-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:py-14">
        <div>
          <h1 className="font-display text-[clamp(52px,9vw,80px)] font-black leading-[0.92] tracking-[-0.035em]">
            Everyone
            <br />
            gets <em className="not-italic text-orange">paid.</em>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Pay the people who work for you, anywhere: through <span className="text-paypal">PayPal</span> where it reaches, and <span className="text-pyusd">PYUSD</span> where it doesn&apos;t.
          </p>
          <p className="mt-3 font-display text-xl font-bold">
            AI checks. You decide. <span className="text-paypal">PayPal</span> and <span className="text-pyusd">PYUSD</span> deliver.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {ownButton}
            {demoButton}
          </div>
          {error && <p className="mt-3 text-sm text-[#b42318]">{error}</p>}
        </div>

        {/* Two sample envelopes */}
        <div className="space-y-4" aria-label="Example pay envelopes">
          <SampleEnvelope name="Adaeze Okafor" place="Lagos, Nigeria · 3 icons" amount="$36.00" method="PYUSD" stamp="CHECKED" note="3 icons × $12, same rate as last month. She's paid in PYUSD, so it stays in dollars." />
          <SampleEnvelope
            name="Maria Santos"
            place="Manila, Philippines · 36 hours"
            amount="$900.00"
            method="PAYPAL"
            stamp="LOOK_AGAIN"
            note="Her message says 38 hours, but the sheet says 36. I used the sheet. Check the $50 difference before paying."
            loud
          />
        </div>
      </section>

      {/* The gaps */}
      <section className="border-t-2 border-ink py-10">
        <h2 className="max-w-2xl font-display text-3xl font-bold">Where PayPal Payouts stops, Routewell starts</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">Routewell is built on PayPal Payouts. It adds what Payouts leaves to you.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {GAPS.map((g) => (
            <div key={g.title} className="rounded-[4px] border-2 border-ink bg-paper-hi p-4">
              <h3 className="font-display text-xl font-bold">{g.title}</h3>
              <p className="mt-2 text-[15px] text-ink-soft">
                <span className="mr-1.5 font-mono text-[11px] font-semibold tracking-wider text-ink-soft">PAYPAL PAYOUTS</span>
                {g.payouts}
              </p>
              <p className="mt-1.5 text-[15px]">
                <span className="mr-1.5 font-mono text-[11px] font-semibold tracking-wider text-orange">ROUTEWELL</span>
                {g.routewell}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-ink-soft">
          Countries PayPal Payouts can&apos;t reach, where Routewell pays in PYUSD: {GAP_COUNTRIES}.{" "}
          <a href="https://developer.paypal.com/payouts/supported-features" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            PayPal&apos;s Payouts country list
          </a>
        </p>
      </section>

      {/* How it works */}
      <section className="border-t-2 border-ink py-10">
        <h2 className="font-display text-3xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-[4px] border-2 border-ink bg-paper-hi p-4">
              <span className="font-mono text-sm font-semibold text-orange">0{i + 1}</span>
              <h3 className="mt-1 font-display text-lg font-bold">{title}</h3>
              <p className="mt-1 text-[14px] text-ink-soft">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[14px] text-ink-soft">
          Someone paid the same amount every month? Give them a payday: the agent prepares it a few days ahead and waits for your OK.
        </p>
      </section>

      {/* Control */}
      <section className="border-t-2 border-ink py-10">
        <h2 className="font-display text-3xl font-bold">You stay in control</h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {CONTROL.map(([title, body]) => (
            <li key={title} className="flex gap-3 rounded-[4px] border-2 border-ink bg-paper-hi p-4">
              <span className="font-display text-xl text-orange" aria-hidden>
                ✓
              </span>
              <span>
                <b className="font-display text-lg">{title}</b>
                <span className="block text-[14px] text-ink-soft">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* PYUSD */}
      <section className="border-t-2 border-ink py-10">
        <h2 className="max-w-2xl font-display text-3xl font-bold">How PYUSD reaches people</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {PYUSD_FACTS.map(([title, body]) => (
            <div key={title} className="rounded-[4px] border-2 border-dashed border-ink p-4">
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="mt-1 text-[14px] text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two doors */}
      <section className="border-t-2 border-ink py-10">
        <h2 className="font-display text-3xl font-bold">Try it</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-[4px] border-2 border-ink bg-paper-hi p-5">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-ink-soft">DEMO COMPANY</span>
            <h3 className="mt-1 font-display text-2xl font-bold">Brightside Studio</h3>
            <p className="mt-1.5 flex-1 text-[15px] text-ink-soft">
              A made-up design studio paying 6 people in Nigeria, Pakistan, India, the Philippines and the US. Everything is set up, with sample messages and receipts to try.
            </p>
            <div className="mt-4">{demoButton}</div>
          </div>
          <div className="flex flex-col rounded-[4px] border-2 border-ink bg-paper-hi p-5">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-ink-soft">YOUR COMPANY</span>
            <h3 className="mt-1 font-display text-2xl font-bold">{session?.mine?.name ?? "Your own Routewell"}</h3>
            <p className="mt-1.5 flex-1 text-[15px] text-ink-soft">
              {session?.mine ? "Pick up where you left off." : "Name your company, add the people you pay, and pay them. It starts empty."}
            </p>
            <div className="mt-4">{ownButton}</div>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-ink pt-4 text-[13px] text-ink-soft">
        <p>
          This is a test version for the PayPal AI Hackathon. PayPal payments use PayPal&apos;s sandbox. PYUSD payments are sent on Solana&apos;s test network from Routewell&apos;s own test wallet, not
          through PayPal. No real money moves.
        </p>
        <p className="mt-1">
          <a href="https://github.com/btcbarbie/routewell" className="underline underline-offset-2" target="_blank" rel="noreferrer">
            Source code
          </a>
        </p>
      </footer>
    </main>
  );
}

function SampleEnvelope({ name, place, amount, method, stamp, note, loud = false }: { name: string; place: string; amount: string; method: string; stamp: string; note: string; loud?: boolean }) {
  return (
    <div className={`relative rounded-[4px] border-2 bg-paper-hi px-4 pb-3.5 pt-4 ${loud ? "border-orange md:-rotate-1" : "border-ink md:rotate-1"}`}>
      <div className="pointer-events-none absolute inset-x-3 top-2 border-t-[1.5px] border-dashed border-paper-line" aria-hidden />
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-[19px] font-bold">{name}</div>
          <div className="text-[13px] text-ink-soft">{place}</div>
        </div>
        <div className="font-mono text-[21px] font-semibold">{amount}</div>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <Rail method={method} />
        <Stamp kind={stamp} />
      </div>
      <AiNote text={note} loud={loud} />
    </div>
  );
}
