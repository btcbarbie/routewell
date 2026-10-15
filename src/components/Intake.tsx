"use client";

import { useRef, useState } from "react";
import { AiMark, Btn, type Worker } from "./ui";

const SAMPLE_TEXT = `Maria: Hi! October was 38 hrs at $25 🙏 (sheet attached)
Adaeze: 3 icons delivered this month
Ali: fixed 2 bugs on the booking page
Rohan: 22 hours of testing
Sam: taxi to the client + client lunch, receipts attached`;

const SAMPLE_FILES = [
  { url: "/samples/october-hours.csv", name: "october-hours.csv", type: "text/csv" },
  { url: "/samples/taxi-receipt.png", name: "taxi-receipt.png", type: "image/png" },
  { url: "/samples/lunch-receipt.png", name: "lunch-receipt.png", type: "image/png" },
];

export function Intake({
  workers,
  summary,
  onSubmit,
  busy,
}: {
  workers: Worker[];
  summary: string | null;
  onSubmit: (form: FormData) => Promise<boolean>;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function add(list: FileList | File[]) {
    const incoming = [...list];
    setFiles((cur) => [...cur.filter((f) => !incoming.some((n) => n.name === f.name)), ...incoming].slice(0, 10));
  }

  async function useSamples() {
    setText(SAMPLE_TEXT);
    const loaded = await Promise.all(
      SAMPLE_FILES.map(async (s) => new File([await (await fetch(s.url)).blob()], s.name, { type: s.type })),
    );
    setFiles(loaded);
  }

  async function submit() {
    const form = new FormData();
    form.set("text", text);
    for (const f of files) {
      form.append("files", f);
      if (owners[f.name]) form.set(`person:${f.name}`, owners[f.name]);
    }
    const ok = await onSubmit(form);
    if (ok) {
      setText("");
      setFiles([]);
      setOwners({});
    }
  }

  return (
    <section className="mb-7 rounded-[4px] border-2 border-ink bg-paper-hi">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b-[1.5px] border-dashed border-paper-line px-3.5 py-3">
        <h2 className="font-display text-xl font-bold">Drop in this month&apos;s pay</h2>
        <AiMark>AI READS IT</AiMark>
      </div>

      <div className="grid gap-3.5 p-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"Paste messages from your people, or write your own:\nMaria: October was 36 hours\nAdaeze: 3 icons this month"}
          className="min-h-[140px] w-full resize-y rounded-[3px] border-[1.5px] border-paper-line bg-paper px-3 py-2.5 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none"
          aria-label="Messages about this month's pay"
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(e.dataTransfer.files);
          }}
          className={`flex flex-col gap-2 rounded-[3px] border-[1.5px] border-dashed p-2.5 ${dragging ? "border-ink bg-acid/40" : "border-paper-line"}`}
        >
          {files.map((f) => (
            <div key={f.name} className="flex items-center justify-between gap-2 rounded-[3px] border-[1.5px] border-ink bg-paper-hi px-2.5 py-2 text-[13px]">
              <span className="min-w-0 truncate font-medium">{f.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {f.type.startsWith("image/") ? (
                  <select
                    value={owners[f.name] ?? ""}
                    onChange={(e) => setOwners((o) => ({ ...o, [f.name]: e.target.value }))}
                    className="max-w-[140px] cursor-pointer rounded-[3px] border border-paper-line bg-transparent text-xs"
                    aria-label={`Whose receipt is ${f.name}`}
                  >
                    <option value="">Whose? AI decides</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono text-[11px] font-semibold text-ink-soft">SHEET</span>
                )}
                <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x !== f))} className="cursor-pointer px-1 text-ink-soft hover:text-ink" aria-label={`Remove ${f.name}`}>
                  ×
                </button>
              </span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[3px] px-2 py-4 text-center text-[13px] text-ink-soft hover:bg-paper"
          >
            <span className="font-medium text-ink">Add spreadsheets or receipt photos</span>
            <span>.csv, .xlsx, or photos. Drop them here.</span>
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept=".csv,.xlsx,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3.5 pb-3.5">
        <Btn variant="primary" onClick={submit} disabled={busy} className="!text-base !py-2.5">
          {busy ? "Reading…" : "Read it"}
        </Btn>
        <Btn variant="ghost" onClick={useSamples} disabled={busy}>
          Try the sample messages and receipts
        </Btn>
      </div>

      {(busy || summary) && (
        <div className="flex flex-wrap items-baseline gap-2.5 border-t-2 border-ink bg-acid px-3.5 py-3">
          <AiMark />
          <span className="font-hand text-[22px] leading-tight text-ink">
            {busy ? "Reading everything and checking each payment. This takes about half a minute." : summary}
          </span>
        </div>
      )}
    </section>
  );
}
