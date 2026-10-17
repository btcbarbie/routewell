"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clocks } from "./Clocks";
import { AiNote, Btn, Rail, Stamp, type Worker } from "./ui";

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
      {busy === "mine" ? "Opening…" : `Open ${session.mine.name}`}
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
            Routewell pays the people who work for you, in any country. AI checks every payment first. Then everyone is paid at once: through PayPal, or in digital dollars (PYUSD) where PayPal can&apos;t reach.
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
            name="Sam Carter"
            place="Austin, United States · Lunch receipt"
            amount="$50.80"
            method="PAYPAL"
            stamp="LOOK_AGAIN"
            note="The receipt is $81.28 but includes $24 of wine. Your rules say no alcohol, so I took it out."
            loud
          />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t-2 border-ink py-10">
        <h2 className="font-display text-3xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Add this month's pay", "Pay everyone their usual amount in one click, tell the AI what's different, add people one by one, or drop in a spreadsheet or receipts."],
            ["AI checks every envelope", "Each person gets an envelope stamped CHECKED or LOOK AGAIN, with a short note saying why."],
            ["Seal and send", "You approve, and everyone is paid at once. Then you see who got it, who hasn't claimed it, and why."],
          ].map(([title, body], i) => (
            <li key={title} className="rounded-[4px] border-2 border-ink bg-paper-hi p-4">
              <span className="font-mono text-sm font-semibold text-orange">0{i + 1}</span>
              <h3 className="mt-1 font-display text-xl font-bold">{title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-soft">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Countries */}
      <section className="border-t-2 border-ink py-10">
        <h2 className="max-w-2xl font-display text-3xl font-bold">When PayPal can&apos;t reach someone, PYUSD often can.</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">Each person only sees the payout options that work where they live, and where they&apos;re legal.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Nigeria", "For nearly 20 years, Nigerian PayPal accounts could only send money. Nigeria still isn't on PayPal's list of countries that can receive Payouts."],
            ["Pakistan", "PayPal doesn't operate in Pakistan. Freelancers there can't open an account to get paid."],
            ["India", "PayPal converts every payment to rupees. With PYUSD, people can keep their pay in dollars."],
          ].map(([country, body]) => (
            <div key={country} className="rounded-[4px] border-2 border-dashed border-ink p-4">
              <h3 className="font-display text-lg font-bold">{country}</h3>
              <p className="mt-1 text-[15px] text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Paydays */}
      <section className="grid gap-6 border-t-2 border-ink py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        <div>
          <h2 className="font-display text-3xl font-bold">Paydays that don&apos;t get forgotten</h2>
          <p className="mt-2 text-ink-soft">
            Say it once: &ldquo;Pay Jordan $1,500 every 28th.&rdquo; On the day, Routewell checks it&apos;s the amount you approved and within your monthly budget, then pays. Anything that looks off waits for you.
          </p>
        </div>
        <div className="rounded-[4px] border-2 border-ink bg-paper-hi p-4">
          <div className="flex items-center justify-between">
            <b className="font-display text-lg">Jordan Lee</b>
            <Stamp kind="SCHEDULED" />
          </div>
          <p className="font-mono text-sm">$1,500.00 on the 28th, every month</p>
          <AiNote text="Same amount you approved. Within this month's $3,000 payday budget. Paying through PayPal." />
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
