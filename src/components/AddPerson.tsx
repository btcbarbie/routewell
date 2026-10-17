"use client";

import { useState } from "react";
import type { Snapshot } from "@/lib/state";
import { Btn } from "./ui";

type Countries = Snapshot["countries"];

export function AddPerson({ countries, add, onDone }: { countries: Countries; add: (body: object) => Promise<boolean>; onDone: () => void }) {
  const codes = Object.keys(countries);
  const [f, setF] = useState({
    name: "",
    role: "CONTRACTOR" as "CONTRACTOR" | "STAFF",
    work: "",
    rateNote: "",
    usualAmountUsd: "",
    country: codes[0],
    city: "",
    payoutMethod: "PAYPAL" as "PAYPAL" | "PYUSD",
    paypalEmail: "",
    walletAddress: "",
  });
  const [busy, setBusy] = useState(false);
  const c = countries[f.country];
  const allowed = (["PAYPAL", "PYUSD"] as const).filter((m) => (m === "PAYPAL" ? c.paypal.canReceive : c.pyusd.allowed));
  const method = allowed.includes(f.payoutMethod) ? f.payoutMethod : allowed[0];
  const set = (patch: Partial<typeof f>) => setF((cur) => ({ ...cur, ...patch }));
  const input = "mt-1 w-full rounded-[3px] border-[1.5px] border-ink bg-paper px-2.5 py-2 focus:outline-none";

  return (
    <form
      className="mb-6 rounded-[4px] border-2 border-ink bg-paper-hi p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await add({ ...f, payoutMethod: method });
        setBusy(false);
        if (ok) onDone();
      }}
    >
      <h3 className="font-display text-lg font-bold">Add a person</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Name
          <input className={input} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Amina Bello" autoFocus />
        </label>
        <fieldset className="text-sm font-semibold">
          They are
          <div className="mt-2 flex gap-4 font-normal">
            {(["CONTRACTOR", "STAFF"] as const).map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" checked={f.role === r} onChange={() => set({ role: r })} className="accent-[#ff5a1f]" />
                {r === "CONTRACTOR" ? "A contractor" : "Staff (expenses only)"}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold">
          Country
          <select className={`${input} cursor-pointer`} value={f.country} onChange={(e) => set({ country: e.target.value })}>
            {codes.map((code) => (
              <option key={code} value={code}>
                {countries[code].name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          City
          <input className={input} value={f.city} onChange={(e) => set({ city: e.target.value })} placeholder="Abuja" />
        </label>
        <label className="block text-sm font-semibold">
          What they do <span className="font-normal text-ink-soft">(optional)</span>
          <input className={input} value={f.work} onChange={(e) => set({ work: e.target.value })} placeholder="Illustration" />
        </label>
        <label className="block text-sm font-semibold">
          Their rate <span className="font-normal text-ink-soft">(optional)</span>
          <input className={input} value={f.rateNote} onChange={(e) => set({ rateNote: e.target.value })} placeholder="$20 per hour" />
        </label>
        <label className="block text-sm font-semibold">
          Usual pay each month <span className="font-normal text-ink-soft">(optional)</span>
          <input className={`${input} font-mono`} inputMode="decimal" value={f.usualAmountUsd} onChange={(e) => set({ usualAmountUsd: e.target.value })} placeholder="800.00" />
          <span className="mt-1 block font-normal text-ink-soft">Used by &ldquo;Pay everyone their usual&rdquo;.</span>
        </label>
      </div>

      <fieldset className="mt-4 text-sm font-semibold">
        Pay them through
        <div className="mt-2 flex flex-wrap gap-4 font-normal">
          {allowed.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" checked={method === m} onChange={() => set({ payoutMethod: m })} className="accent-[#ff5a1f]" />
              {m === "PAYPAL" ? "PayPal" : "PYUSD to their own wallet"}
            </label>
          ))}
        </div>
        <p className="mt-1 font-normal text-ink-soft">{method === "PAYPAL" ? c.paypal.note : c.pyusd.note}</p>
        {!c.paypal.canReceive && <p className="mt-1 font-normal text-ink-soft">PayPal isn&apos;t an option: {c.paypal.note}</p>}
      </fieldset>
      {method === "PAYPAL" ? (
        <label className="mt-3 block text-sm font-semibold">
          Their PayPal email
          <input className={input} type="email" value={f.paypalEmail} onChange={(e) => set({ paypalEmail: e.target.value })} placeholder="amina@example.com" />
          <span className="mt-1 block font-normal text-ink-soft">In this test version, money only arrives at PayPal sandbox accounts.</span>
        </label>
      ) : (
        <label className="mt-3 block text-sm font-semibold">
          Their Solana wallet address
          <input className={`${input} font-mono text-sm`} value={f.walletAddress} onChange={(e) => set({ walletAddress: e.target.value })} placeholder="From their wallet app" />
          <span className="mt-1 block font-normal text-ink-soft">They can change it later from their own payout link.</span>
        </label>
      )}

      <div className="mt-4 flex gap-2">
        <Btn type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add them"}
        </Btn>
        <Btn variant="ghost" onClick={onDone}>
          Cancel
        </Btn>
      </div>
    </form>
  );
}
