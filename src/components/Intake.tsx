"use client";

import { useRef, useState } from "react";
import { Btn, type Worker } from "./ui";

const SAMPLE_INSTRUCTION = "Pay everyone for October. Add a $50 bonus for Maria for the launch.";

const SAMPLE_NOTES = `Maria: Hi! October was 38 hrs at $25 🙏 (sheet attached)
Adaeze: 3 icons delivered this month
Ali: fixed 2 bugs on the booking page
Rohan: 22 hours of testing
Sam: taxi to the client + client lunch, receipts attached`;

const SAMPLE_FILES = [
  { url: "/samples/october-hours.csv", name: "october-hours.csv", type: "text/csv" },
  { url: "/samples/taxi-receipt.png", name: "taxi-receipt.png", type: "image/png" },
  { url: "/samples/lunch-receipt.png", name: "lunch-receipt.png", type: "image/png" },
];

/** "Tell the AI" (an instruction) or "Upload" (spreadsheets and receipt photos, with optional notes). */
export function Intake({
  mode,
  workers,
  isDemo,
  onSubmit,
  busy,
}: {
  mode: "tell" | "upload";
  workers: Worker[];
  isDemo: boolean;
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
    if (mode === "tell") return setText(SAMPLE_INSTRUCTION);
    setText(SAMPLE_NOTES);
    const loaded = await Promise.all(SAMPLE_FILES.map(async (s) => new File([await (await fetch(s.url)).blob()], s.name, { type: s.type })));
    setFiles(loaded);
  }

  async function submit() {
    const form = new FormData();
    form.set("text", text);
    for (const f of files) {
      form.append("files", f);
      if (owners[f.name]) form.set(`person:${f.name}`, owners[f.name]);
    }
    if (await onSubmit(form)) {
      setText("");
      setFiles([]);
      setOwners({});
    }
  }

  const textarea = (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      rows={mode === "tell" ? 3 : 4}
      placeholder={
        mode === "tell"
          ? "Pay everyone for October. Add a $50 bonus for Maria."
          : "Optional: paste messages from your people, like\nMaria: October was 36 hours"
      }
      className="w-full resize-y rounded-[3px] border-[1.5px] border-paper-line bg-paper px-3 py-2.5 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none"
      aria-label={mode === "tell" ? "What should be paid" : "Notes about this month's pay"}
    />
  );

  return (
    <div>
      {mode === "tell" ? (
        textarea
      ) : (
        <div className="grid gap-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
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
            <button type="button" onClick={() => input.current?.click()} className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[3px] px-2 py-4 text-center text-[13px] text-ink-soft hover:bg-paper">
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
          {textarea}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn variant="primary" onClick={submit} disabled={busy} className="!py-2.5 !text-base">
          {busy ? "Reading…" : mode === "tell" ? "Make the envelopes" : "Read it"}
        </Btn>
        {isDemo && (
          <Btn variant="ghost" onClick={useSamples} disabled={busy}>
            {mode === "tell" ? "Try an example" : "Try the sample sheet and receipts"}
          </Btn>
        )}
      </div>
    </div>
  );
}
