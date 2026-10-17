import { prisma } from "./prisma";
import { explainPayday } from "./ai";
import { allowedMethods } from "./countries";
import { dollars } from "./money";
import { payEnvelopes } from "./payrun";
import { checkAndFollowUp } from "./followup";
import { isValidAddress, treasuryBalance } from "./solana";
import { log } from "./workspace";

function period(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Run the scheduled paydays that are due on `today`. Code decides what may be paid:
 * only the owner-approved amount, never over the monthly payday budget, and only to valid payout details.
 * The AI explains the checks; it never changes a decision.
 */
export async function runPaydays(workspaceId: string, today: Date) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { schedules: { where: { active: true }, include: { worker: true } } } });
  const now = period(today);
  const due = ws.schedules.filter((s) => s.dayOfMonth <= today.getUTCDate() && s.lastPaidPeriod !== now);
  if (!due.length) return { ran: false, message: "Nothing is due on this date." };
  if (ws.autopilotPaused) {
    await log(workspaceId, "AI", `${due.length} scheduled payment${due.length === 1 ? " was" : "s were"} due, but scheduled paydays are paused.`);
    return { ran: false, message: "Scheduled paydays are paused." };
  }

  // Budget: scheduled payments already made this month count against it.
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const paidThisMonth = await prisma.envelope.aggregate({
    _sum: { amountCents: true },
    where: { payRun: { workspaceId, kind: "SCHEDULED", sentAt: { gte: monthStart } }, status: { in: ["PAID", "PENDING", "UNCLAIMED"] } },
  });
  let spent = paidThisMonth._sum.amountCents ?? 0;
  let pyusdLeft: number | null = null;
  try {
    pyusdLeft = (await treasuryBalance()).pyusdCents;
  } catch {
    pyusdLeft = null;
  }

  const checked = due.map((s) => {
    const problems: string[] = [];
    const w = s.worker;
    if (!allowedMethods(w.country).includes(w.payoutMethod as "PAYPAL" | "PYUSD")) problems.push("Their payout method isn't available in their country.");
    if (w.payoutMethod === "PAYPAL" && !w.paypalEmail) problems.push("No PayPal email on file.");
    if (w.payoutMethod === "PYUSD" && (!w.walletAddress || !isValidAddress(w.walletAddress))) problems.push("No valid wallet address on file.");
    if (spent + s.amountCents > ws.paydayBudgetCents) problems.push(`Would go over this month's payday budget of ${dollars(ws.paydayBudgetCents)}.`);
    if (w.payoutMethod === "PYUSD" && pyusdLeft !== null && pyusdLeft < s.amountCents) problems.push(`The company's PYUSD wallet only has ${dollars(pyusdLeft)}.`);
    if (!problems.length) {
      spent += s.amountCents;
      if (w.payoutMethod === "PYUSD" && pyusdLeft !== null) pyusdLeft -= s.amountCents;
    }
    return { s, problems };
  });

  const dateLabel = today.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  let notes: Record<string, string> = {};
  let summary = "";
  try {
    const out = await explainPayday({
      date: today.toISOString().slice(0, 10),
      budget: dollars(ws.paydayBudgetCents),
      items: checked.map(({ s, problems }) => ({
        scheduleId: s.id,
        person: s.worker.name,
        approvedAmount: dollars(s.amountCents),
        approvedBecause: s.createdFrom,
        via: s.worker.payoutMethod,
        result: problems.length ? "HELD, not paid" : "PAY",
        problems,
      })),
    });
    notes = Object.fromEntries(out.notes.map((n) => [n.scheduleId, n.note]));
    summary = out.summary;
  } catch {
    summary = `${checked.filter((c) => !c.problems.length).length} of ${checked.length} scheduled payments passed the checks.`;
  }

  const run = await prisma.payRun.create({
    data: {
      workspaceId,
      label: `Payday, ${dateLabel}`,
      kind: "SCHEDULED",
      createdAt: today, // the payday this run belongs to (may be a pretend date in the demo)
      intakeSummary: summary,
      envelopes: {
        create: checked.map(({ s, problems }) => ({
          workerId: s.workerId,
          nameAsWritten: s.worker.name,
          kind: "RETAINER",
          amountCents: s.amountCents,
          description: s.note,
          calculation: `Approved: "${s.createdFrom}"`,
          sourceQuote: s.createdFrom,
          method: s.worker.payoutMethod,
          stamp: problems.length ? "LOOK_AGAIN" : "SCHEDULED",
          aiNote: notes[s.id] ?? (problems.length ? "Held back. See why below." : "Same amount you approved. Within budget."),
          issues: JSON.stringify(problems),
          scheduleId: s.id,
        })),
      },
    },
  });
  await log(workspaceId, "AI", summary);

  const payable = checked.filter((c) => !c.problems.length);
  if (payable.length) {
    await payEnvelopes(workspaceId, run.id, run.label);
    await checkAndFollowUp(workspaceId, run.id);
    await prisma.schedule.updateMany({ where: { id: { in: payable.map((c) => c.s.id) } }, data: { lastPaidPeriod: now } });
  } else {
    await prisma.payRun.update({ where: { id: run.id }, data: { status: "SENT", sentAt: new Date() } });
    await prisma.envelope.updateMany({ where: { payRunId: run.id }, data: { status: "HELD", statusDetail: "Held back by the payday checks." } });
  }
  return { ran: true, message: summary };
}
