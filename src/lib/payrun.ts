import { createHash } from "node:crypto";
import type { Envelope, Worker } from "@prisma/client";
import { prisma } from "./prisma";
import { readIntake, readReceipt, reviewEnvelopes, summarizeResults } from "./ai";
import { allowedMethods } from "./countries";
import { dollars, monthLabel, toCents } from "./money";
import { getBatch, sendBatch, envelopeStatusFor, PAYPAL_ERRORS } from "./paypal";
import { isValidAddress, sendPyusd, treasuryBalance } from "./solana";
import { log } from "./workspace";

export function todayFor(ws: { pretendToday: string | null }): Date {
  return ws.pretendToday ? new Date(`${ws.pretendToday}T12:00:00Z`) : new Date();
}

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** This month's draft pay run, created on first use. */
export async function draftRun(workspaceId: string) {
  const existing = await prisma.payRun.findFirst({ where: { workspaceId, status: "DRAFT", kind: "MANUAL" }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;
  return prisma.payRun.create({ data: { workspaceId, label: monthLabel(new Date()), kind: "MANUAL" } });
}

/** Problems a person's payout details would cause, checked by code rather than the AI. */
export function payoutDetailIssues(worker: Worker, method: string): string[] {
  const issues: string[] = [];
  if (!allowedMethods(worker.country).includes(method as "PAYPAL" | "PYUSD")) {
    issues.push(method === "PAYPAL" ? "PayPal can't pay people in their country." : "PYUSD isn't an option in their country.");
  }
  if (method === "PAYPAL" && !worker.paypalEmail) issues.push("No PayPal email on file.");
  if (method === "PYUSD" && (!worker.walletAddress || !isValidAddress(worker.walletAddress))) issues.push("No valid wallet address on file.");
  return issues;
}

// ---------- Intake ----------

export async function processIntake(
  workspaceId: string,
  input: { text: string; sheets: { fileName: string; text: string }[]; receipts: { fileName: string; data: Buffer; mimeType: string; personId: string | null }[] },
) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { workers: true, rules: true, schedules: { where: { active: true } } } });
  const run = await draftRun(workspaceId);
  const today = isoDay(todayFor(ws));
  const workersById = new Map(ws.workers.map((w) => [w.id, w]));
  const summaries: string[] = [];

  const receiptJobs = input.receipts.map((r) => processReceipt(workspaceId, run.id, r, ws.rules.map((x) => x.text), ws.workers, today));

  if (input.text.trim() || input.sheets.length) {
    const lastRun = await prisma.payRun.findFirst({
      where: { workspaceId, status: "SENT", kind: "MANUAL", NOT: { label: { startsWith: "Expenses" } } },
      orderBy: { sentAt: "desc" },
      include: { envelopes: true },
    });
    const result = await readIntake({
      today,
      messageText: input.text,
      sheets: input.sheets,
      people: ws.workers.map((w) => ({ id: w.id, name: w.name, role: w.role, work: w.work, rate: w.rateNote, usualAmount: w.usualCents ? dollars(w.usualCents) : null, country: w.country })),
      lastPaid: (lastRun?.envelopes ?? []).map((e) => ({ person: workersById.get(e.workerId ?? "")?.name, description: e.description, amount: dollars(e.amountCents) })),
      schedules: ws.schedules.map((s) => ({ person: workersById.get(s.workerId)?.name, amount: dollars(s.amountCents), day: s.dayOfMonth, note: s.note })),
    });
    summaries.push(result.summary);
    if (result.notUnderstood.length) summaries.push(`Couldn't use: ${result.notUnderstood.join("; ")}`);

    const existing = await prisma.envelope.findMany({ where: { payRunId: run.id } });
    for (const e of result.envelopes) {
      const worker = e.workerId ? workersById.get(e.workerId) : undefined;
      const extra: string[] = [];
      if (!worker) extra.push("Not one of your people yet, so there's nowhere to send this.");
      const cents = toCents(e.amountUsd);
      if (cents <= 0) extra.push("The amount isn't above zero.");
      if (worker && existing.some((x) => x.workerId === worker.id && x.amountCents === cents && x.kind === e.kind)) {
        extra.push("An envelope with the same amount is already in this month's pay.");
      }
      const method = worker?.payoutMethod ?? "PAYPAL";
      if (worker) extra.push(...payoutDetailIssues(worker, method));
      const issues = [...e.issues, ...extra];
      await prisma.envelope.create({
        data: {
          payRunId: run.id,
          workerId: worker?.id ?? null,
          nameAsWritten: e.nameAsWritten,
          kind: e.kind,
          amountCents: cents,
          description: e.description,
          calculation: e.calculation,
          sourceQuote: e.sourceQuote,
          method,
          stamp: issues.length ? "LOOK_AGAIN" : "CHECKED",
          aiNote: e.note, // code-found problems are listed with the AI's issues; the note stays the AI's words
          issues: JSON.stringify(issues),
        },
      });
    }
  }

  const receiptResults = await Promise.allSettled(receiptJobs);
  const failed = receiptResults.flatMap((r, i) => (r.status === "rejected" ? [`${input.receipts[i].fileName}: ${(r.reason as Error).message}`] : []));
  if (failed.length) summaries.push(`Couldn't read ${failed.join("; ")}`);

  const receiptLine = input.receipts.length ? `Read ${input.receipts.length} receipt${input.receipts.length === 1 ? "" : "s"}.` : "";
  const intakeSummary = await summarizeDraft(run.id, [...summaries, receiptLine]);
  await log(workspaceId, "AI", intakeSummary || "Read the new pay details.");
  return { runId: run.id, summary: intakeSummary };
}

/** The line shown under the intake: what the AI read, plus how many envelopes are ready and need a look. */
async function summarizeDraft(runId: string, lines: string[]) {
  const all = await prisma.envelope.findMany({ where: { payRunId: runId, status: "DRAFT" } });
  const flagged = all.filter((e) => e.stamp === "LOOK_AGAIN" && !e.ownerDecision).length;
  const countLine = `${all.length} envelope${all.length === 1 ? "" : "s"} ready, ${flagged} need${flagged === 1 ? "s" : ""} a look.`;
  const summary = [...lines, countLine].filter(Boolean).join(" ");
  await prisma.payRun.update({ where: { id: runId }, data: { intakeSummary: summary } });
  return summary;
}

// ---------- Direct ways in: everyone's usual amount, or one envelope at a time ----------

/** One envelope per person with a usual amount, skipping people paid on a schedule or already in this pay run. */
export async function addUsual(workspaceId: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { workers: true, schedules: { where: { active: true } } } });
  const run = await draftRun(workspaceId);
  const existing = await prisma.envelope.findMany({ where: { payRunId: run.id, status: "DRAFT" } });
  const scheduled = new Set(ws.schedules.map((s) => s.workerId));
  const skipped: string[] = [];
  const created: string[] = [];
  for (const w of ws.workers) {
    if (scheduled.has(w.id)) {
      skipped.push(`${w.name} (paid on a schedule)`);
      continue;
    }
    if (!w.usualCents) {
      if (w.role !== "STAFF") skipped.push(`${w.name} (no usual amount)`);
      continue;
    }
    if (existing.some((e) => e.workerId === w.id && e.kind === "WORK")) {
      skipped.push(`${w.name} (already in this pay run)`);
      continue;
    }
    const e = await prisma.envelope.create({
      data: {
        payRunId: run.id, workerId: w.id, nameAsWritten: w.name, kind: "WORK", amountCents: w.usualCents,
        description: `Usual pay${w.work ? `, ${w.work.toLowerCase()}` : ""}`, calculation: `Usual amount (${w.rateNote})`,
        sourceQuote: "Pay everyone their usual", method: w.payoutMethod, stamp: "CHECKED", aiNote: "Checking…",
      },
    });
    created.push(e.id);
  }
  if (!created.length) throw new Error(skipped.length ? `Nobody to add: ${skipped.join(", ")}.` : "Add people with a usual amount first.");
  await reviewDraftEnvelopes(workspaceId, run.id, created);
  const summary = await summarizeDraft(run.id, [`Made envelopes from everyone's usual amount.`, skipped.length ? `Skipped ${skipped.join(", ")}.` : ""]);
  await log(workspaceId, "YOU", `Paid everyone their usual: ${created.length} envelope${created.length === 1 ? "" : "s"}.`);
  await log(workspaceId, "AI", summary);
}

/** One envelope the owner typed in. */
export async function addOne(workspaceId: string, input: { workerId: string; amountUsd: number; description: string }) {
  const w = await prisma.worker.findFirst({ where: { id: input.workerId, workspaceId } });
  if (!w) throw new Error("Pick who to pay.");
  const cents = toCents(Number(input.amountUsd));
  if (!Number.isFinite(cents) || cents <= 0 || cents > 10_000_00) throw new Error("Enter an amount between $0.01 and $10,000.");
  const description = String(input.description ?? "").trim().slice(0, 120) || "Payment";
  const run = await draftRun(workspaceId);
  const e = await prisma.envelope.create({
    data: {
      payRunId: run.id, workerId: w.id, nameAsWritten: w.name, kind: "WORK", amountCents: cents, description,
      sourceQuote: "Added by you", method: w.payoutMethod, stamp: "CHECKED", aiNote: "Checking…",
    },
  });
  await reviewDraftEnvelopes(workspaceId, run.id, [e.id]);
  await summarizeDraft(run.id, [`Added ${w.name}, ${dollars(cents)}.`]);
  await log(workspaceId, "YOU", `Added ${w.name}: ${dollars(cents)} for ${description}.`);
}

/** The AI checks envelopes the owner made directly, alongside the same code checks the other ways get. */
async function reviewDraftEnvelopes(workspaceId: string, runId: string, ids: string[]) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const envelopes = await prisma.envelope.findMany({ where: { payRunId: runId, status: "DRAFT" }, include: { worker: true } });
  const lastRun = await prisma.payRun.findFirst({
    where: { workspaceId, status: "SENT", kind: "MANUAL", NOT: { label: { startsWith: "Expenses" } } },
    orderBy: { sentAt: "desc" },
    include: { envelopes: true },
  });
  const lastFor = (workerId: string | null) =>
    (lastRun?.envelopes ?? []).filter((e) => e.workerId === workerId).map((e) => `${dollars(e.amountCents)} for ${e.description}`);
  const toCheck = envelopes.filter((e) => ids.includes(e.id));
  const others = envelopes.filter((e) => !ids.includes(e.id));

  let reviews: Record<string, { note: string; issues: string[] }> = {};
  try {
    const out = await reviewEnvelopes({
      today: isoDay(todayFor(ws)),
      toCheck: toCheck.map((e) => ({
        envelopeId: e.id, person: e.worker?.name, amount: dollars(e.amountCents), whatFor: e.description, via: e.method,
        usualAmount: e.worker?.usualCents ? dollars(e.worker.usualCents) : null, rate: e.worker?.rateNote, paidLastMonth: lastFor(e.workerId),
      })),
      alsoInThisPayRun: others.map((e) => ({ person: e.worker?.name ?? e.nameAsWritten, amount: dollars(e.amountCents), whatFor: e.description })),
    });
    reviews = Object.fromEntries(out.reviews.map((r) => [r.envelopeId, { note: r.note, issues: r.issues }]));
  } catch (err) {
    // If the AI can't answer, the code checks below still run and the note says so.
    console.error("AI review failed:", err);
  }
  for (const e of toCheck) {
    const ai = reviews[e.id];
    const issues = [...(ai?.issues ?? []), ...(e.worker ? payoutDetailIssues(e.worker, e.method) : ["Not one of your people."])];
    await prisma.envelope.update({
      where: { id: e.id },
      data: {
        aiNote: ai?.note ?? "The AI couldn't check this one. Look it over before sending.",
        issues: JSON.stringify(ai ? issues : [...issues, "Not checked by the AI."]),
        stamp: issues.length || !ai ? "LOOK_AGAIN" : "CHECKED",
      },
    });
  }
}

async function processReceipt(
  workspaceId: string,
  runId: string,
  file: { fileName: string; data: Buffer; mimeType: string; personId: string | null },
  rules: string[],
  workers: Worker[],
  today: string,
) {
  const mime = file.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)) {
    throw new Error(`${file.fileName}: receipts need to be photos (PNG, JPG, WEBP or GIF).`);
  }
  const hash = createHash("sha256").update(file.data).digest("hex");
  const chosen = file.personId ? workers.find((w) => w.id === file.personId) : undefined;
  const ai = await readReceipt({ today, imageBase64: file.data.toString("base64"), mimeType: mime, rules, forPerson: chosen?.name ?? null });

  const byName = ai.nameOnReceipt ? workers.find((w) => w.name.toLowerCase() === ai.nameOnReceipt!.toLowerCase() || w.name.split(" ")[0].toLowerCase() === ai.nameOnReceipt!.split(" ")[0].toLowerCase()) : undefined;
  const worker = chosen ?? byName ?? workers.find((w) => w.role === "STAFF");

  const extra: string[] = [];
  // Exact same photo seen before?
  const sameImage = await prisma.receipt.findFirst({ where: { workspaceId, imageHash: hash }, include: { envelope: { include: { payRun: true } } } });
  if (sameImage?.envelope?.status === "PAID") {
    const when = sameImage.envelope.payRun.sentAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    extra.push(`This exact receipt was already paid back${when ? ` on ${when}` : ""}.`);
  } else if (sameImage) {
    extra.push("This exact receipt was already uploaded.");
  }
  // Same shop, date and amount as an earlier receipt?
  const cents = ai.totalUsd !== null ? toCents(ai.totalUsd) : null;
  if (!sameImage && ai.vendor && ai.date && cents !== null) {
    const twin = await prisma.receipt.findFirst({ where: { workspaceId, vendor: ai.vendor, receiptDate: ai.date, amountCents: cents } });
    if (twin) extra.push("A receipt from the same place, on the same day, for the same amount was already sent in.");
  }
  if (ai.totalUsd === null) extra.push("Couldn't read a dollar total.");
  if (!worker) extra.push("Couldn't tell whose receipt this is.");
  if (worker) extra.push(...payoutDetailIssues(worker, worker.payoutMethod));

  const receipt = await prisma.receipt.create({
    data: {
      workspaceId,
      workerId: worker?.id ?? null,
      imageData: new Uint8Array(file.data),
      mimeType: mime,
      imageHash: hash,
      vendor: ai.vendor,
      receiptDate: ai.date,
      amountCents: cents,
      currency: ai.currency,
      category: ai.category,
      details: ai.lineItems.map((l) => `${l.text}${l.amountUsd !== null ? ` ${dollars(toCents(l.amountUsd))}` : ""}`).join("; "),
    },
  });

  const payCents = ai.allowedUsd !== null ? toCents(ai.allowedUsd) : cents ?? 0;
  const issues = [...ai.issues, ...extra];
  await prisma.envelope.create({
    data: {
      payRunId: runId,
      workerId: worker?.id ?? null,
      nameAsWritten: worker?.name ?? ai.nameOnReceipt ?? file.fileName,
      kind: "EXPENSE",
      amountCents: payCents,
      description: `${ai.category}${ai.vendor ? `, ${ai.vendor}` : ""}${ai.date ? `, ${new Date(`${ai.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}`,
      calculation: cents !== null && payCents !== cents ? `${dollars(payCents)} of ${dollars(cents)}${ai.working ? `: ${ai.working}` : ""}` : null,
      sourceQuote: file.fileName,
      method: worker?.payoutMethod ?? "PAYPAL",
      stamp: issues.length ? "LOOK_AGAIN" : "CHECKED",
      aiNote: ai.note,
      issues: JSON.stringify(issues),
      receiptId: receipt.id,
    },
  });
}

// ---------- Sending ----------

export function readyToSend(e: Envelope) {
  return e.status === "DRAFT" && (e.stamp !== "LOOK_AGAIN" || e.ownerDecision === "PAY_ANYWAY") && !!e.workerId && e.amountCents > 0;
}

/** Pay a set of envelopes: PayPal ones in one batch, PYUSD ones one by one from the company's test wallet. */
export async function payEnvelopes(workspaceId: string, runId: string, label: string) {
  const envelopes = await prisma.envelope.findMany({ where: { payRunId: runId }, include: { worker: true } });
  const ready = envelopes.filter(readyToSend);
  if (!ready.length) throw new Error("Nothing is ready to send.");

  const paypal = ready.filter((e) => e.method === "PAYPAL");
  const pyusd = ready.filter((e) => e.method === "PYUSD");

  await prisma.payRun.update({ where: { id: runId }, data: { status: "SENT", sentAt: new Date() } });
  await prisma.envelope.updateMany({ where: { payRunId: runId, status: "DRAFT", id: { notIn: ready.map((e) => e.id) } }, data: { status: "HELD", statusDetail: "Held back from this pay run." } });

  if (paypal.length) {
    try {
      const batch = await sendBatch(
        `rw-${runId}`,
        `You've been paid by Brightside Studio (${label})`,
        paypal.map((e) => ({ envelopeId: e.id, email: e.worker!.paypalEmail!, cents: e.amountCents, note: e.description })),
      );
      await prisma.payRun.update({ where: { id: runId }, data: { paypalBatchId: batch.payoutBatchId, paypalBatchStatus: batch.status } });
      await prisma.envelope.updateMany({ where: { id: { in: paypal.map((e) => e.id) } }, data: { status: "PENDING", statusDetail: "Sent to PayPal. Waiting for PayPal to finish." } });
      await log(workspaceId, "PAYPAL", `PayPal accepted a batch of ${paypal.length} payment${paypal.length === 1 ? "" : "s"} (${dollars(paypal.reduce((s, e) => s + e.amountCents, 0))}).`);
    } catch (err) {
      await prisma.envelope.updateMany({ where: { id: { in: paypal.map((e) => e.id) } }, data: { status: "FAILED", statusDetail: (err as Error).message } });
      await log(workspaceId, "PAYPAL", `PayPal didn't accept the batch: ${(err as Error).message}`);
    }
  }

  if (pyusd.length) {
    let balance: number | null = null;
    try {
      balance = (await treasuryBalance()).pyusdCents;
    } catch {
      balance = null;
    }
    for (const e of pyusd) {
      if (balance !== null && balance < e.amountCents) {
        await prisma.envelope.update({ where: { id: e.id }, data: { status: "FAILED", statusDetail: `The company's PYUSD wallet only has ${dollars(balance)}.` } });
        continue;
      }
      try {
        const sig = await sendPyusd(e.worker!.walletAddress!, e.amountCents);
        if (balance !== null) balance -= e.amountCents;
        await prisma.envelope.update({ where: { id: e.id }, data: { status: "PAID", txSignature: sig, statusDetail: "Arrived in their wallet on Solana devnet." } });
        await log(workspaceId, "SOLANA", `${e.worker!.name} received ${dollars(e.amountCents)} in PYUSD.`);
      } catch (err) {
        await prisma.envelope.update({ where: { id: e.id }, data: { status: "FAILED", statusDetail: `The PYUSD transfer didn't go through: ${(err as Error).message.split("\n")[0]}` } });
      }
    }
  }

  await refreshRun(workspaceId, runId);
}

/** Ask PayPal how the batch is doing and update each envelope. Writes the AI summary once everything has settled. */
export async function refreshRun(workspaceId: string, runId: string) {
  const run = await prisma.payRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.paypalBatchId) {
    const batch = await getBatch(run.paypalBatchId);
    await prisma.payRun.update({ where: { id: runId }, data: { paypalBatchStatus: batch.status } });
    for (const item of batch.items) {
      if (!item.envelopeId) continue;
      const status = envelopeStatusFor(item.status);
      const detail = item.errorName
        ? PAYPAL_ERRORS[item.errorName] ?? item.errorMessage ?? item.errorName
        : status === "PAID"
          ? "PayPal says it's paid."
          : status === "PENDING"
            ? "PayPal is still processing it."
            : `PayPal status: ${item.status}`;
      const before = await prisma.envelope.findUnique({ where: { id: item.envelopeId }, include: { worker: true } });
      if (!before || before.payRunId !== runId) continue;
      if (before.status !== status) {
        await prisma.envelope.update({ where: { id: item.envelopeId }, data: { status, statusDetail: detail, payoutItemId: item.payoutItemId } });
        if (status !== "PENDING") await log(workspaceId, "PAYPAL", `${before.worker?.name ?? "Someone"}: ${status === "PAID" ? "paid" : status.toLowerCase()}${item.errorName ? ` (${detail})` : ""}.`);
      }
    }
  }

  const envelopes = await prisma.envelope.findMany({ where: { payRunId: runId }, include: { worker: true } });
  const settled = envelopes.every((e) => e.status !== "PENDING");
  if (settled && !run.resultSummary) {
    const results = envelopes
      .filter((e) => e.status !== "DRAFT")
      .map((e) => ({ person: e.worker?.name ?? e.nameAsWritten, amount: dollars(e.amountCents), via: e.method, status: e.status, detail: e.statusDetail }));
    let summary: string;
    try {
      summary = await summarizeResults({ results, context: `Pay run: ${run.label}.` });
    } catch {
      const paid = results.filter((r) => r.status === "PAID").length;
      summary = `${paid} of ${results.length} paid.`;
    }
    await prisma.payRun.update({ where: { id: runId }, data: { resultSummary: summary } });
    await log(workspaceId, "AI", summary);
  }
}
