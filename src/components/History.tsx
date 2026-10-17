"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import type { Snapshot } from "@/lib/state";
import { paperTheme } from "./ReviewGrid";
import { RunOutcome } from "./RunOutcome";
import { Btn, SectionTitle, Stamp, dollars } from "./ui";

type Row = { date: string; run: string; person: string; what: string; amount: number; via: string; status: string; detail: string; link: string | null };

const STATUS_TEXT: Record<string, string> = {
  PAID: "Paid",
  PENDING: "With PayPal",
  UNCLAIMED: "Not claimed yet",
  FAILED: "Not paid",
  RETURNED: "Returned",
  HELD: "Held back",
};

const ACTOR: Record<string, string> = { YOU: "You", AI: "AI", PAYPAL: "PayPal", SOLANA: "Solana", WORKER: "Worker" };

export function History({ s, refresh, busy }: { s: Snapshot; refresh: (runId: string) => Promise<void>; busy: string | null }) {
  const rows: Row[] = useMemo(
    () =>
      s.runs.flatMap((r) =>
        r.envelopes.map((e) => ({
          date: r.sentAt ? new Date(r.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
          run: r.label,
          person: s.workers.find((w) => w.id === e.workerId)?.name ?? e.nameAsWritten,
          what: e.description,
          amount: e.amountCents / 100,
          via: e.method === "PYUSD" ? "PYUSD" : "PayPal",
          status: STATUS_TEXT[e.status] ?? e.status,
          detail: e.statusDetail ?? "",
          link: e.txUrl,
        })),
      ),
    [s.runs, s.workers],
  );

  const cols: ColDef<Row>[] = useMemo(
    () => [
      { field: "date", headerName: "Sent", minWidth: 120 },
      { field: "person", headerName: "Person", minWidth: 140 },
      { field: "what", headerName: "What for", flex: 1, minWidth: 180 },
      { field: "amount", headerName: "Amount", cellDataType: "number", valueFormatter: (p) => dollars(Math.round((p.value ?? 0) * 100)), cellClass: "font-mono", minWidth: 110 },
      { field: "via", headerName: "Via", minWidth: 90 },
      { field: "status", headerName: "Status", minWidth: 130 },
      { field: "detail", headerName: "Details", flex: 1.4, minWidth: 240, wrapText: true, autoHeight: true },
    ],
    [],
  );

  return (
    <div className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <SectionTitle hint="Every payment, sortable and filterable">All payments</SectionTitle>
        <div className="h-[420px] w-full">
          <AgGridReact<Row> theme={paperTheme} rowData={rows} columnDefs={cols} defaultColDef={{ sortable: true, filter: true, resizable: true }} />
        </div>

        <SectionTitle>Pay runs</SectionTitle>
        <div className="space-y-4">
          {s.runs.map((r) => {
            const pending = r.envelopes.some((e) => e.status === "PENDING");
            return (
              <section key={r.id} className="rounded-[4px] border-2 border-ink bg-paper-hi p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-bold">
                    {r.label}
                    {r.kind === "SCHEDULED" && <span className="ml-2 align-middle"><Stamp kind="SCHEDULED" /></span>}
                  </h3>
                  <span className="text-[13px] text-ink-soft">
                    {r.sentAt && new Date(r.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {r.paypalBatchId && <> · PayPal batch <span className="font-mono">{r.paypalBatchId}</span></>}
                  </span>
                </div>
                <RunOutcome s={s} run={r} />
                {pending && r.paypalBatchId && (
                  <Btn className="mt-3" onClick={() => refresh(r.id)} disabled={busy === "refreshing"}>
                    {busy === "refreshing" ? "Asking PayPal…" : "Ask PayPal again"}
                  </Btn>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <aside>
        <SectionTitle>What happened</SectionTitle>
        <ol className="space-y-2.5">
          {s.activity.map((a) => (
            <li key={a.id} className="border-l-2 border-ink pl-3 text-sm">
              <div className="font-mono text-[11px] font-semibold text-ink-soft">
                {ACTOR[a.actor] ?? a.actor} · {new Date(a.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
              <div className={a.actor === "AI" ? "font-hand text-[18px] leading-tight" : ""}>{a.text}</div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
