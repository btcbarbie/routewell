"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type CellValueChangedEvent, type RowClassParams } from "ag-grid-community";
import { dollars, stampFor, type Envelope, type Worker } from "./ui";

ModuleRegistry.registerModules([AllCommunityModule]);

export const paperTheme = themeQuartz.withParams({
  backgroundColor: "#fffaf0",
  foregroundColor: "#1b2a4a",
  borderColor: "#1b2a4a",
  headerBackgroundColor: "#f3ebdd",
  headerTextColor: "#1b2a4a",
  headerFontWeight: 600,
  oddRowBackgroundColor: "#fffaf0",
  rowHoverColor: "#f3ebdd",
  accentColor: "#ff5a1f",
  selectedRowBackgroundColor: "#f2ff4d55",
  fontFamily: "var(--nf-ui), system-ui, sans-serif",
  cellFontFamily: "var(--nf-ui), system-ui, sans-serif",
  wrapperBorderRadius: 4,
  borderRadius: 3,
  rowBorder: { color: "#cbbfa8", width: 1 },
  wrapperBorder: { color: "#1b2a4a", width: 2 },
  fontSize: 14,
});

type Row = {
  id: string;
  person: string;
  where: string;
  what: string;
  amount: number;
  method: string;
  methods: string[];
  stamp: string;
  note: string;
  issues: string;
  needsLook: boolean;
};

const STAMP_TEXT: Record<string, string> = {
  CHECKED: "Checked",
  LOOK_AGAIN: "Look again",
  OK_BY_YOU: "OK by you",
  SCHEDULED: "Scheduled",
};

/** The same envelopes as a spreadsheet: sort, filter, and edit amounts or payout method in place. */
export function ReviewGrid({
  envelopes,
  workers,
  act,
}: {
  envelopes: Envelope[];
  workers: Worker[];
  act: (id: string, body: object) => Promise<void>;
}) {
  const rows: Row[] = useMemo(
    () =>
      envelopes.map((e) => {
        const w = workers.find((x) => x.id === e.workerId);
        return {
          id: e.id,
          person: w?.name ?? e.nameAsWritten,
          where: w ? `${w.city}, ${w.countryName}` : "Unknown",
          what: e.description,
          amount: e.amountCents / 100,
          method: e.method,
          methods: w?.allowedMethods ?? [e.method],
          stamp: stampFor(e),
          note: e.aiNote,
          issues: e.issues.join(" · "),
          needsLook: e.stamp === "LOOK_AGAIN" && !e.ownerDecision,
        };
      }),
    [envelopes, workers],
  );

  const cols: ColDef<Row>[] = useMemo(
    () => [
      { field: "person", headerName: "Person", pinned: "left", minWidth: 150 },
      { field: "where", headerName: "Where", minWidth: 150 },
      { field: "what", headerName: "What for", minWidth: 200, flex: 1 },
      {
        field: "amount",
        headerName: "Amount",
        editable: true,
        cellDataType: "number",
        valueFormatter: (p) => dollars(Math.round((p.value ?? 0) * 100)),
        cellClass: "font-mono",
        minWidth: 120,
      },
      {
        field: "method",
        headerName: "Paid via",
        editable: (p) => (p.data?.methods.length ?? 0) > 1,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: (p: { data: Row }) => ({ values: p.data.methods }),
        valueFormatter: (p) => (p.value === "PYUSD" ? "PYUSD" : "PayPal"),
        minWidth: 110,
      },
      { field: "stamp", headerName: "Check", valueFormatter: (p) => STAMP_TEXT[p.value] ?? p.value, minWidth: 120, filter: true },
      { field: "issues", headerName: "Needs a look because", minWidth: 260, flex: 1, wrapText: true, autoHeight: true },
      { field: "note", headerName: "AI note", minWidth: 280, flex: 1.4, wrapText: true, autoHeight: true, cellClass: "font-hand text-[17px] leading-snug" },
    ],
    [],
  );

  return (
    <div className="h-[520px] w-full">
      <AgGridReact<Row>
        theme={paperTheme}
        rowData={rows}
        columnDefs={cols}
        defaultColDef={{ sortable: true, resizable: true, filter: true }}
        getRowId={(p) => p.data.id}
        getRowStyle={(p: RowClassParams<Row>) => (p.data?.needsLook ? { background: "#f2ff4d" } : undefined)}
        stopEditingWhenCellsLoseFocus
        onCellValueChanged={(ev: CellValueChangedEvent<Row>) => {
          if (!ev.data) return;
          if (ev.colDef.field === "amount") void act(ev.data.id, { action: "SET_AMOUNT", amountUsd: Number(ev.newValue) });
          if (ev.colDef.field === "method") void act(ev.data.id, { action: "SET_METHOD", method: ev.newValue });
        }}
      />
    </div>
  );
}
