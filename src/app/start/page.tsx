"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn } from "@/components/ui";

export default function Start() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <header className="flex items-center justify-between border-b-2 border-ink py-4">
        <Link href="/" className="flex items-center gap-2.5 font-display text-[22px] font-black tracking-tight">
          <span className="grid size-7 place-items-center rounded-full bg-orange font-mono text-[13px] font-semibold text-paper-hi" aria-hidden>
            R
          </span>
          Routewell
        </Link>
        <span className="rounded-[3px] border-[1.5px] border-ink px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider">TEST MONEY ONLY</span>
      </header>

      <h1 className="mt-10 font-display text-[44px] font-black leading-[0.95] tracking-tight">
        Set up your <em className="not-italic text-orange">Routewell</em>
      </h1>
      <p className="mt-3 text-ink-soft">Name your company. Next, you&apos;ll add the people you pay.</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: name }) });
          const json = await res.json();
          if (json.error) {
            setBusy(false);
            return setError(json.error);
          }
          router.push("/app#people");
        }}
      >
        <label className="block">
          <span className="text-sm font-semibold">Company name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Design Co."
            className="mt-1 w-full rounded-[4px] border-2 border-ink bg-paper-hi px-3 py-2.5 text-lg focus:outline-none"
          />
        </label>
        {error && <p className="text-sm text-[#b42318]">{error}</p>}
        <Btn type="submit" variant="primary" disabled={busy}>
          {busy ? "Setting up…" : "Continue"}
        </Btn>
      </form>

      <p className="mt-10 text-[13px] text-ink-soft">
        This is a test version. Payments use PayPal&apos;s sandbox and Solana&apos;s test network, so no real money moves. PayPal payments only arrive at PayPal sandbox accounts.
      </p>
    </main>
  );
}
