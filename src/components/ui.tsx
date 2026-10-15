"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Snapshot } from "@/lib/state";

export type Worker = Snapshot["workers"][number];
export type Envelope = NonNullable<Snapshot["draft"]>["envelopes"][number];
export type Run = Snapshot["runs"][number];

export function dollars(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "≈ ₹4,050" using today's rate. Display only. */
export function localApprox(cents: number, worker: Worker | undefined, fx: Snapshot["fx"]) {
  if (!worker || !fx || worker.currency === "USD") return null;
  const rate = fx.rates[worker.currency];
  if (!rate) return null;
  const amount = Math.round((cents / 100) * rate);
  return `≈ ${worker.currencySymbol}${amount.toLocaleString("en-US")}`;
}

export function AiMark({ children = "AI" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[3px] border-[1.5px] border-ink bg-acid px-1.5 py-px font-mono text-[11px] font-semibold tracking-wider text-ink">
      <span className="size-[7px] rounded-full bg-ink" aria-hidden />
      {children}
    </span>
  );
}

/** The AI's voice: acid yellow plus handwriting. Solid when something needs a look, dashed when all is fine. */
export function AiNote({ text, issues = [], loud = false, label = "AI NOTE" }: { text: string; issues?: string[]; loud?: boolean; label?: string }) {
  return (
    <div className={`mt-2.5 rounded-[2px] border-[1.5px] border-ink px-2.5 pb-2 pt-1.5 ${loud ? "-rotate-[0.5deg] bg-acid" : "border-dashed"}`}>
      <AiMark>{label}</AiMark>
      <p className="mt-1 font-hand text-[19px] leading-[1.25] text-ink">{text}</p>
      {issues.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {issues.map((i) => (
            <li key={i} className="font-hand text-[18px] leading-[1.2] text-ink">
              → {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STAMPS: Record<string, { text: string; cls: string; tilt: string }> = {
  CHECKED: { text: "CHECKED", cls: "text-green border-green", tilt: "rotate-[3deg]" },
  LOOK_AGAIN: { text: "LOOK AGAIN", cls: "text-orange border-orange", tilt: "-rotate-[4deg]" },
  SCHEDULED: { text: "SCHEDULED", cls: "text-ink border-ink", tilt: "-rotate-[2deg]" },
  OK_BY_YOU: { text: "OK BY YOU", cls: "text-green border-green", tilt: "-rotate-[3deg]" },
  PAID: { text: "PAID", cls: "text-green border-green", tilt: "rotate-[4deg]" },
  PENDING: { text: "SENDING", cls: "text-ink border-ink", tilt: "-rotate-[2deg]" },
  UNCLAIMED: { text: "NOT CLAIMED", cls: "text-orange border-orange", tilt: "rotate-[2deg]" },
  FAILED: { text: "NOT PAID", cls: "text-[#b42318] border-[#b42318]", tilt: "-rotate-[3deg]" },
  RETURNED: { text: "RETURNED", cls: "text-[#b42318] border-[#b42318]", tilt: "rotate-[2deg]" },
  HELD: { text: "HELD BACK", cls: "text-ink-soft border-ink-soft", tilt: "rotate-[2deg]" },
};

export function Stamp({ kind }: { kind: string }) {
  const s = STAMPS[kind] ?? { text: kind, cls: "text-ink border-ink", tilt: "" };
  return (
    <span className={`inline-block whitespace-nowrap rounded-[3px] border-[2.5px] px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.1em] ${s.cls} ${s.tilt}`}>
      {s.text}
    </span>
  );
}

/** The stamp an envelope shows: its payout status once sent, otherwise the check result. */
export function stampFor(e: Envelope) {
  if (e.status !== "DRAFT") return e.status;
  if (e.stamp === "LOOK_AGAIN" && e.ownerDecision === "PAY_ANYWAY") return "OK_BY_YOU";
  return e.stamp;
}

export function Rail({ method }: { method: string }) {
  return (
    <span className={`rounded-[3px] px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-paper-hi ${method === "PYUSD" ? "bg-orange" : "bg-ink"}`}>
      {method === "PYUSD" ? "PYUSD" : "PAYPAL"}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

export function Btn({ variant = "secondary", className = "", ...props }: BtnProps) {
  const styles = {
    primary:
      "bg-orange text-paper-hi border-2 border-ink shadow-[4px_4px_0_var(--ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--ink)] font-display font-bold text-[17px] px-5 py-3",
    secondary: "bg-paper-hi text-ink border-2 border-ink font-semibold text-sm px-3.5 py-2 hover:bg-paper",
    ghost: "text-ink underline decoration-paper-line underline-offset-4 hover:decoration-ink text-sm font-medium px-1 py-1",
  }[variant];
  return <button type="button" {...props} className={`cursor-pointer rounded-[4px] transition-colors disabled:cursor-wait disabled:opacity-60 ${styles} ${className}`} />;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3.5 mt-2 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-[22px] font-bold">{children}</h2>
      {hint && <span className="text-[13px] text-ink-soft">{hint}</span>}
    </div>
  );
}

export function shortAddress(a: string | null) {
  if (!a) return "";
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
