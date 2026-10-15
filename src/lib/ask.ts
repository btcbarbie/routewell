import { prisma } from "./prisma";
import { interpretAsk, type AskResult } from "./ai";
import { allowedMethods } from "./countries";
import { dollars, toCents } from "./money";
import { draftRun, isoDay, todayFor } from "./payrun";
import { log } from "./workspace";

export async function ask(workspaceId: string, instruction: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { workers: true, schedules: true } });
  const run = await draftRun(workspaceId);
  const envelopes = await prisma.envelope.findMany({ where: { payRunId: run.id, status: "DRAFT" } });
  const name = (id: string | null) => ws.workers.find((w) => w.id === id)?.name ?? "unknown";
  const result = await interpretAsk({
    today: isoDay(todayFor(ws)),
    instruction,
    context: {
      thisMonthsEnvelopes: envelopes.map((e) => ({ envelopeId: e.id, person: name(e.workerId), amount: dollars(e.amountCents), description: e.description, method: e.method })),
      people: ws.workers.map((w) => ({ workerId: w.id, name: w.name, rate: w.rateNote, payoutMethods: allowedMethods(w.country) })),
      schedules: ws.schedules.map((s) => ({ scheduleId: s.id, person: name(s.workerId), amount: dollars(s.amountCents), dayOfMonth: s.dayOfMonth, note: s.note, active: s.active })),
    },
  });
  return result;
}

type Action = AskResult["actions"][number];

export async function applyActions(workspaceId: string, instruction: string, actions: Action[]) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { workers: true, schedules: true } });
  const run = await draftRun(workspaceId);
  const worker = (id: string | null) => {
    const w = ws.workers.find((x) => x.id === id);
    if (!w) throw new Error("That person isn't in your team.");
    return w;
  };
  const envelope = async (id: string | null) => {
    const e = await prisma.envelope.findFirst({ where: { id: id ?? "", payRunId: run.id, status: "DRAFT" } });
    if (!e) throw new Error("That envelope isn't in this month's pay any more.");
    return e;
  };
  const amount = (usd: number | null) => {
    const cents = toCents(Number(usd));
    if (!Number.isFinite(cents) || cents <= 0 || cents > 10_000_00) throw new Error("Amounts need to be between $0.01 and $10,000.");
    return cents;
  };

  for (const a of actions) {
    switch (a.type) {
      case "SET_AMOUNT": {
        const e = await envelope(a.envelopeId);
        const cents = amount(a.amountUsd);
        await prisma.envelope.update({ where: { id: e.id }, data: { amountCents: cents, ownerDecision: e.stamp === "LOOK_AGAIN" ? "PAY_ANYWAY" : e.ownerDecision } });
        break;
      }
      case "ADD_PAYMENT": {
        const w = worker(a.workerId);
        const cents = amount(a.amountUsd);
        await prisma.envelope.create({
          data: {
            payRunId: run.id, workerId: w.id, nameAsWritten: w.name, kind: "BONUS", amountCents: cents,
            description: a.description ?? "Extra payment", method: w.payoutMethod, stamp: "CHECKED",
            aiNote: `Added because you asked: "${instruction}".`, sourceQuote: instruction,
          },
        });
        break;
      }
      case "REMOVE_ENVELOPE": {
        const e = await envelope(a.envelopeId);
        await prisma.envelope.delete({ where: { id: e.id } });
        break;
      }
      case "SET_METHOD": {
        const e = await envelope(a.envelopeId);
        const w = worker(e.workerId);
        if (!a.method || !allowedMethods(w.country).includes(a.method)) throw new Error("That payout method isn't available for them.");
        await prisma.envelope.update({ where: { id: e.id }, data: { method: a.method } });
        break;
      }
      case "CREATE_SCHEDULE": {
        const w = worker(a.workerId);
        const cents = amount(a.amountUsd);
        const day = Number(a.dayOfMonth);
        if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error("Paydays can be on day 1 to 28 of the month.");
        await prisma.schedule.create({ data: { workspaceId, workerId: w.id, amountCents: cents, dayOfMonth: day, note: a.description ?? "Scheduled payment", createdFrom: instruction } });
        break;
      }
      case "PAUSE_SCHEDULE":
      case "RESUME_SCHEDULE": {
        const s = ws.schedules.find((x) => x.id === a.scheduleId);
        if (!s) throw new Error("That scheduled payday doesn't exist.");
        await prisma.schedule.update({ where: { id: s.id }, data: { active: a.type === "RESUME_SCHEDULE" } });
        break;
      }
    }
    await log(workspaceId, "YOU", `Approved: ${a.label}`);
  }
}
