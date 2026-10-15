"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CountryFacts } from "@/lib/countries";
import { Btn, Rail } from "@/components/ui";

type View = {
  name: string;
  company: string;
  city: string;
  country: CountryFacts | null;
  allowed: ("PAYPAL" | "PYUSD")[];
  method: "PAYPAL" | "PYUSD";
  paypalEmail: string | null;
  walletAddress: string | null;
  updatedAt: string | null;
};

export function WorkerChoice() {
  const { token } = useParams<{ token: string }>();
  const [v, setV] = useState<View | null>(null);
  const [method, setMethod] = useState<"PAYPAL" | "PYUSD">("PAYPAL");
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/worker/${token}`)
      .then((r) => r.json())
      .then((json: View & { error?: string }) => {
        if (json.error) return setError(json.error);
        setV(json);
        setMethod(json.method);
        setEmail(json.paypalEmail ?? "");
        setWallet(json.walletAddress ?? "");
      })
      .catch(() => setError("Couldn't load this page. Try again."));
  }, [token]);

  if (!v) {
    return <main className="mx-auto max-w-xl px-4 py-16">{error ? <p className="text-[#b42318]">{error}</p> : <p className="font-hand text-2xl">Opening your envelope…</p>}</main>;
  }

  const first = v.name.split(" ")[0];
  const options = v.allowed;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <header className="flex items-center justify-between border-b-2 border-ink py-4">
        <div className="flex items-center gap-2.5 font-display text-xl font-black">
          <span className="grid size-7 place-items-center rounded-full bg-orange font-mono text-[13px] font-semibold text-paper-hi" aria-hidden>
            R
          </span>
          Routewell
        </div>
        <span className="rounded-[3px] border-[1.5px] border-ink px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider">TEST MODE</span>
      </header>

      <h1 className="mt-8 font-display text-[44px] font-black leading-[0.95] tracking-tight">
        Hi {first}.
        <br />
        How should we <em className="not-italic text-orange">pay</em> you?
      </h1>
      <p className="mt-3 text-ink-soft">
        {v.company} pays you through Routewell. Pick what works best in {v.city}
        {v.country ? `, ${v.country.name}` : ""}.
      </p>

      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          setSaved(false);
          const res = await fetch(`/api/worker/${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method, paypalEmail: email, walletAddress: wallet }),
          });
          const json = await res.json();
          setBusy(false);
          if (json.error) return setError(json.error);
          setV(json);
          setSaved(true);
        }}
      >
        {(["PAYPAL", "PYUSD"] as const).map((m) => {
          const available = options.includes(m);
          const note = m === "PAYPAL" ? v.country?.paypal.note : v.country?.pyusd.note;
          return (
            <label
              key={m}
              className={`block rounded-[4px] border-2 bg-paper-hi p-4 ${method === m ? "border-ink" : "border-paper-line"} ${available ? "cursor-pointer" : "opacity-70"}`}
            >
              <div className="flex items-center gap-2.5">
                <input type="radio" name="method" value={m} checked={method === m} disabled={!available} onChange={() => setMethod(m)} className="accent-[#ff5a1f]" />
                <Rail method={m} />
                <span className="font-semibold">{m === "PAYPAL" ? "PayPal" : "Digital dollars (PYUSD) to your own wallet"}</span>
              </div>
              {note && <p className="mt-1.5 pl-6 text-[13px] text-ink-soft">{available ? note : `Not available: ${note}`}</p>}
              {method === m && m === "PAYPAL" && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-3 w-full rounded-[3px] border-[1.5px] border-ink bg-paper px-3 py-2"
                  aria-label="Your PayPal email"
                />
              )}
              {method === m && m === "PYUSD" && (
                <input
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder="Your Solana wallet address"
                  className="mt-3 w-full rounded-[3px] border-[1.5px] border-ink bg-paper px-3 py-2 font-mono text-sm"
                  aria-label="Your Solana wallet address"
                />
              )}
            </label>
          );
        })}

        {error && <p className="text-sm text-[#b42318]">{error}</p>}
        {saved && <p className="font-hand text-[21px]">Saved. Your next payment goes this way.</p>}

        <Btn type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save my choice"}
        </Btn>
      </form>

      {v.country && (
        <p className="mt-8 text-xs text-ink-soft">
          About {v.country.name}:{" "}
          {v.country.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ", "}
              <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {s.label}
              </a>
            </span>
          ))}
          . This is a demo on test networks: no real money moves.
        </p>
      )}
    </main>
  );
}
