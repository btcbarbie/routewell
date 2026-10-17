import { prisma } from "./prisma";
import { COUNTRIES, allowedMethods } from "./countries";
import { usdRates } from "./fx";
import { treasuryBalance, explorerUrl } from "./solana";
import { todayFor, isoDay } from "./payrun";

let treasuryCache: { at: number; data: Awaited<ReturnType<typeof treasuryBalance>> | null } = { at: 0, data: null };

async function cachedTreasury(force = false) {
  if (!force && treasuryCache.data && Date.now() - treasuryCache.at < 20_000) return treasuryCache.data;
  try {
    treasuryCache = { at: Date.now(), data: await treasuryBalance() };
  } catch {
    // keep the last known value
  }
  return treasuryCache.data;
}

export function forgetTreasury() {
  treasuryCache = { at: 0, data: null };
}

/** Everything the app screen needs, in one JSON-friendly object. */
export async function snapshot(workspaceId: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      workers: { orderBy: { createdAt: "asc" } },
      rules: { orderBy: { createdAt: "asc" } },
      schedules: { orderBy: { createdAt: "asc" } },
      activity: { orderBy: { at: "desc" }, take: 30 },
      agentRuns: { orderBy: { createdAt: "desc" }, take: 8, include: { steps: { orderBy: { at: "asc" } } } },
      payRuns: { orderBy: { createdAt: "desc" }, include: { envelopes: { orderBy: { createdAt: "asc" }, include: { receipt: { select: { id: true, vendor: true, receiptDate: true } } } } } },
    },
  });
  const [fx, treasury] = await Promise.all([usdRates(), cachedTreasury()]);
  const today = todayFor(ws);

  const envelopeOut = (e: (typeof ws.payRuns)[number]["envelopes"][number]) => ({
    id: e.id,
    workerId: e.workerId,
    nameAsWritten: e.nameAsWritten,
    kind: e.kind,
    amountCents: e.amountCents,
    description: e.description,
    calculation: e.calculation,
    sourceQuote: e.sourceQuote,
    method: e.method,
    stamp: e.stamp,
    aiNote: e.aiNote,
    issues: JSON.parse(e.issues) as string[],
    ownerDecision: e.ownerDecision,
    status: e.status,
    statusDetail: e.statusDetail,
    txUrl: e.txSignature ? explorerUrl(e.txSignature) : null,
    receipt: e.receipt ? { id: e.receipt.id, vendor: e.receipt.vendor, date: e.receipt.receiptDate } : null,
    scheduleId: e.scheduleId,
    followUp: e.followUp,
    followUpKind: e.followUpKind,
  });

  const draft = ws.payRuns.find((r) => r.status === "DRAFT" && r.kind === "MANUAL") ?? null;

  return {
    company: ws.companyName,
    isDemo: ws.isDemo,
    today: isoDay(today),
    pretendToday: ws.pretendToday,
    paydayBudgetCents: ws.paydayBudgetCents,
    autopilotPaused: ws.autopilotPaused,
    treasury,
    fx,
    workers: ws.workers.map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role,
      work: w.work,
      rateNote: w.rateNote,
      usualCents: w.usualCents,
      country: w.country,
      countryName: COUNTRIES[w.country]?.name ?? w.country,
      currency: COUNTRIES[w.country]?.currency ?? "USD",
      currencySymbol: COUNTRIES[w.country]?.currencySymbol ?? "$",
      city: w.city,
      timezone: w.timezone,
      payoutMethod: w.payoutMethod,
      paypalEmail: w.paypalEmail,
      walletAddress: w.walletAddress,
      allowedMethods: allowedMethods(w.country),
      choiceToken: w.choiceToken,
      choiceUpdatedAt: w.choiceUpdatedAt?.toISOString() ?? null,
    })),
    draft: draft ? { id: draft.id, label: draft.label, intakeSummary: draft.intakeSummary, envelopes: draft.envelopes.map(envelopeOut) } : null,
    runs: ws.payRuns
      .filter((r) => r.status === "SENT")
      .map((r) => ({
        id: r.id,
        label: r.label,
        kind: r.kind,
        sentAt: r.sentAt?.toISOString() ?? null,
        payday: (r.kind === "SCHEDULED" ? r.createdAt : r.sentAt ?? r.createdAt).toISOString(),
        resultSummary: r.resultSummary,
        paypalBatchId: r.paypalBatchId,
        paypalBatchStatus: r.paypalBatchStatus,
        envelopes: r.envelopes.map(envelopeOut),
      })),
    schedules: ws.schedules.map((s) => ({
      id: s.id,
      workerId: s.workerId,
      amountCents: s.amountCents,
      dayOfMonth: s.dayOfMonth,
      note: s.note,
      createdFrom: s.createdFrom,
      active: s.active,
      lastPaidPeriod: s.lastPaidPeriod,
    })),
    rules: ws.rules.map((r) => ({ id: r.id, text: r.text, example: r.example })),
    activity: ws.activity.map((a) => ({ id: a.id, at: a.at.toISOString(), actor: a.actor, text: a.text })),
    agentRuns: ws.agentRuns.map((r) => ({
      id: r.id,
      trigger: r.trigger,
      goal: r.goal,
      status: r.status,
      reply: r.reply,
      payRunId: r.payRunId,
      at: r.createdAt.toISOString(),
      steps: r.steps.map((st) => ({ id: st.id, kind: st.kind, text: st.text })),
    })),
    countries: COUNTRIES,
  };
}

export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
