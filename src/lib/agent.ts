import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { prisma } from "./prisma";
import { client, MODEL, VOICE, AiError } from "./ai";
import { COUNTRIES, allowedMethods } from "./countries";
import { dollars, toCents } from "./money";
import { addOne, addUsual, draftRun, isoDay, payoutDetailIssues, todayFor } from "./payrun";
import { treasuryBalance } from "./solana";
import { log } from "./workspace";

// The Routewell agent: Claude with tools, working in steps. Every tool call is saved as a step,
// which is what the app shows as the agent's trail.
//
// What it can never do, whatever it's asked: send money, change anyone's payout details, or change the rules.
// It works on this month's draft (reversible), scheduled paydays, and follow-ups after paying.
// Money only moves when the owner presses Seal and send, or on a scheduled payday the owner set to pay automatically.

type Trigger = "ASK" | "RESULTS" | "PAYDAY";

type Ctx = { workspaceId: string; agentRunId: string; trigger: Trigger; payRunId?: string };

async function step(ctx: Ctx, kind: "LOOK" | "ACT" | "BLOCKED", text: string) {
  await prisma.agentStep.create({ data: { agentRunId: ctx.agentRunId, kind, text } });
  if (kind !== "LOOK") await log(ctx.workspaceId, "AI", text);
}

/** Run a tool body; a thrown error becomes a BLOCKED step and a plain message back to the model. */
async function guarded(ctx: Ctx, fn: () => Promise<string>): Promise<string> {
  try {
    return await fn();
  } catch (err) {
    const message = (err as Error).message;
    await step(ctx, "BLOCKED", message);
    return `Not done: ${message}`;
  }
}

const name = async (workerId: string | null) => (workerId ? (await prisma.worker.findUnique({ where: { id: workerId }, select: { name: true } }))?.name : null) ?? "someone";

async function draftEnvelope(ctx: Ctx, envelopeId: string) {
  const run = await draftRun(ctx.workspaceId);
  const e = await prisma.envelope.findFirst({ where: { id: envelopeId, payRunId: run.id }, include: { worker: true } });
  if (!e) throw new Error("That envelope isn't in this month's draft.");
  return e;
}

function amountCents(usd: number) {
  const cents = toCents(Number(usd));
  if (!Number.isFinite(cents) || cents <= 0 || cents > 10_000_00) throw new Error("Amounts need to be between $0.01 and $10,000.");
  return cents;
}

function tools(ctx: Ctx) {
  const lookPeople = betaZodTool({
    name: "look_up_people",
    description: "List everyone this business pays: id, name, country, role, rate, usual pay, payout method, whether their payout details are complete, and any scheduled payday.",
    inputSchema: z.object({}),
    run: () =>
      guarded(ctx, async () => {
        const workers = await prisma.worker.findMany({ where: { workspaceId: ctx.workspaceId }, include: { schedules: true } });
        await step(ctx, "LOOK", `Looked at your ${workers.length} people.`);
        return JSON.stringify(
          workers.map((w) => ({
            workerId: w.id,
            name: w.name,
            country: COUNTRIES[w.country]?.name ?? w.country,
            role: w.role,
            rate: w.rateNote,
            usualPay: w.usualCents ? dollars(w.usualCents) : null,
            payoutMethod: w.payoutMethod,
            payoutMethodsAllowedInTheirCountry: allowedMethods(w.country),
            payoutDetailProblems: payoutDetailIssues(w, w.payoutMethod),
            scheduledPaydays: w.schedules.map((s) => ({ scheduleId: s.id, amount: dollars(s.amountCents), dayOfMonth: s.dayOfMonth, active: s.active })),
          })),
        );
      }),
  });

  const lookThisMonth = betaZodTool({
    name: "look_up_this_month",
    description: "List this month's draft pay run: every envelope with its id, person, amount, what it's for, payout method, check result, problems found, and whether it's held back.",
    inputSchema: z.object({}),
    run: () =>
      guarded(ctx, async () => {
        const run = await draftRun(ctx.workspaceId);
        const envelopes = await prisma.envelope.findMany({ where: { payRunId: run.id }, include: { worker: true } });
        await step(ctx, "LOOK", `Looked at this month's ${envelopes.length} envelope${envelopes.length === 1 ? "" : "s"}.`);
        return JSON.stringify(
          envelopes.map((e) => ({
            envelopeId: e.id,
            person: e.worker?.name ?? e.nameAsWritten,
            amount: dollars(e.amountCents),
            whatFor: e.description,
            via: e.method,
            check: e.stamp === "LOOK_AGAIN" && !e.ownerDecision ? "needs a look" : "ok",
            problems: JSON.parse(e.issues),
            heldBack: e.status === "HELD",
            heldBecause: e.status === "HELD" ? e.statusDetail : null,
          })),
        );
      }),
  });

  const lookHistory = betaZodTool({
    name: "look_up_payment_history",
    description: "Payments already sent, newest first, with date, person, amount, method and outcome (PAID, PENDING, UNCLAIMED, FAILED, RETURNED, HELD). Optionally filter by person name or month (YYYY-MM).",
    inputSchema: z.object({ personName: z.string().optional(), month: z.string().optional().describe("YYYY-MM") }),
    run: ({ personName, month }) =>
      guarded(ctx, async () => {
        const envelopes = await prisma.envelope.findMany({
          where: { payRun: { workspaceId: ctx.workspaceId, status: "SENT" } },
          include: { worker: true, payRun: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
        const rows = envelopes
          .filter((e) => !personName || (e.worker?.name ?? e.nameAsWritten).toLowerCase().includes(personName.toLowerCase()))
          .filter((e) => !month || (e.payRun.sentAt?.toISOString().slice(0, 7) ?? "") === month)
          .map((e) => ({
            date: e.payRun.sentAt?.toISOString().slice(0, 10),
            payRun: e.payRun.label,
            person: e.worker?.name ?? e.nameAsWritten,
            amount: dollars(e.amountCents),
            whatFor: e.description,
            via: e.method,
            outcome: e.status,
            detail: e.statusDetail,
          }));
        await step(ctx, "LOOK", `Looked through ${rows.length} past payment${rows.length === 1 ? "" : "s"}${personName ? ` for ${personName}` : ""}${month ? ` in ${month}` : ""}.`);
        return JSON.stringify(rows);
      }),
  });

  const lookCountry = betaZodTool({
    name: "look_up_country_rules",
    description: "The checked facts for a country: whether PayPal Payouts can pay people there, whether PYUSD is allowed, with sources. Use the 2-letter country code (US, NG, IN, PH, PK).",
    inputSchema: z.object({ country: z.string() }),
    run: ({ country }) =>
      guarded(ctx, async () => {
        const facts = COUNTRIES[country.toUpperCase()];
        if (!facts) throw new Error(`Routewell has no checked facts for ${country} yet.`);
        await step(ctx, "LOOK", `Checked what works in ${facts.name}.`);
        return JSON.stringify({ name: facts.name, paypal: facts.paypal, pyusd: facts.pyusd });
      }),
  });

  const lookWallet = betaZodTool({
    name: "look_up_pyusd_wallet",
    description: "How much test PYUSD the company's wallet holds, for paying people in PYUSD.",
    inputSchema: z.object({}),
    run: () =>
      guarded(ctx, async () => {
        const b = await treasuryBalance();
        await step(ctx, "LOOK", `Checked the company's PYUSD wallet: ${dollars(b.pyusdCents)}.`);
        return JSON.stringify({ pyusd: dollars(b.pyusdCents) });
      }),
  });

  const payUsual = betaZodTool({
    name: "pay_everyone_their_usual",
    description: "Add an envelope for everyone with a usual pay amount to this month's draft, skipping people on a scheduled payday or already in the draft. Each new envelope is checked.",
    inputSchema: z.object({}),
    run: () =>
      guarded(ctx, async () => {
        await addUsual(ctx.workspaceId);
        await step(ctx, "ACT", "Added everyone's usual pay to this month's envelopes.");
        return "Done. Use look_up_this_month to see the envelopes and their checks.";
      }),
  });

  const addEnvelope = betaZodTool({
    name: "add_envelope",
    description: "Add one payment to this month's draft for a person (a bonus, extra work, an invoice). It gets checked like any other envelope.",
    inputSchema: z.object({ workerId: z.string(), amountUsd: z.number(), description: z.string() }),
    run: ({ workerId, amountUsd, description }) =>
      guarded(ctx, async () => {
        await addOne(ctx.workspaceId, { workerId, amountUsd, description });
        await step(ctx, "ACT", `Added ${dollars(amountCents(amountUsd))} for ${await name(workerId)}: ${description}.`);
        return "Added and checked.";
      }),
  });

  const changeAmount = betaZodTool({
    name: "change_amount",
    description: "Change the amount of an envelope in this month's draft.",
    inputSchema: z.object({ envelopeId: z.string(), amountUsd: z.number(), reason: z.string() }),
    run: ({ envelopeId, amountUsd, reason }) =>
      guarded(ctx, async () => {
        const e = await draftEnvelope(ctx, envelopeId);
        if (e.status !== "DRAFT") throw new Error("Put it back before changing it.");
        const cents = amountCents(amountUsd);
        await prisma.envelope.update({ where: { id: e.id }, data: { amountCents: cents } });
        await step(ctx, "ACT", `Changed ${e.worker?.name ?? e.nameAsWritten}'s envelope from ${dollars(e.amountCents)} to ${dollars(cents)}: ${reason}`);
        return "Changed.";
      }),
  });

  const hold = betaZodTool({
    name: "hold_back",
    description: "Hold an envelope back so it isn't paid when the owner presses Seal and send. Use for anything that shouldn't be paid yet, with the reason.",
    inputSchema: z.object({ envelopeId: z.string(), reason: z.string() }),
    run: ({ envelopeId, reason }) =>
      guarded(ctx, async () => {
        const e = await draftEnvelope(ctx, envelopeId);
        await prisma.envelope.update({ where: { id: e.id }, data: { status: "HELD", statusDetail: reason } });
        await step(ctx, "ACT", `Held back ${e.worker?.name ?? e.nameAsWritten}'s ${dollars(e.amountCents)}: ${reason}`);
        return "Held back.";
      }),
  });

  const putBack = betaZodTool({
    name: "put_back",
    description: "Put a held-back envelope back into this month's pay.",
    inputSchema: z.object({ envelopeId: z.string() }),
    run: ({ envelopeId }) =>
      guarded(ctx, async () => {
        const e = await draftEnvelope(ctx, envelopeId);
        await prisma.envelope.update({ where: { id: e.id }, data: { status: "DRAFT", statusDetail: null } });
        await step(ctx, "ACT", `Put ${e.worker?.name ?? e.nameAsWritten}'s envelope back in.`);
        return "Put back.";
      }),
  });

  const remove = betaZodTool({
    name: "take_out",
    description: "Remove an envelope from this month's draft entirely.",
    inputSchema: z.object({ envelopeId: z.string(), reason: z.string() }),
    run: ({ envelopeId, reason }) =>
      guarded(ctx, async () => {
        const e = await draftEnvelope(ctx, envelopeId);
        await prisma.envelope.delete({ where: { id: e.id } });
        await step(ctx, "ACT", `Took out ${e.worker?.name ?? e.nameAsWritten}'s ${dollars(e.amountCents)}: ${reason}`);
        return "Taken out.";
      }),
  });

  const switchMethod = betaZodTool({
    name: "switch_payout_method",
    description: "Switch how one envelope is paid (PAYPAL or PYUSD). Only works if that method is allowed in the person's country and they have the details on file.",
    inputSchema: z.object({ envelopeId: z.string(), method: z.enum(["PAYPAL", "PYUSD"]), reason: z.string() }),
    run: ({ envelopeId, method, reason }) =>
      guarded(ctx, async () => {
        const e = await draftEnvelope(ctx, envelopeId);
        if (!e.worker) throw new Error("That envelope isn't for one of your people.");
        const problems = payoutDetailIssues(e.worker, method);
        if (problems.length) throw new Error(`Can't pay ${e.worker.name} by ${method}: ${problems.join(" ")}`);
        await prisma.envelope.update({ where: { id: e.id }, data: { method } });
        await step(ctx, "ACT", `Switched ${e.worker.name} to ${method === "PYUSD" ? "PYUSD" : "PayPal"}: ${reason}`);
        return "Switched.";
      }),
  });

  const schedule = betaZodTool({
    name: "create_scheduled_payday",
    description: "Set up a payment that repeats every month on a given day (1 to 28).",
    inputSchema: z.object({ workerId: z.string(), amountUsd: z.number(), dayOfMonth: z.number(), description: z.string(), ownerWords: z.string().describe("The owner's own words asking for this.") }),
    run: ({ workerId, amountUsd, dayOfMonth, description, ownerWords }) =>
      guarded(ctx, async () => {
        const w = await prisma.worker.findFirst({ where: { id: workerId, workspaceId: ctx.workspaceId } });
        if (!w) throw new Error("That person isn't in this business.");
        const day = Math.round(dayOfMonth);
        if (day < 1 || day > 28) throw new Error("Paydays can be on day 1 to 28.");
        const cents = amountCents(amountUsd);
        await prisma.schedule.create({ data: { workspaceId: ctx.workspaceId, workerId: w.id, amountCents: cents, dayOfMonth: day, note: description, createdFrom: ownerWords } });
        await step(ctx, "ACT", `Set up ${dollars(cents)} for ${w.name} on day ${day} of every month.`);
        return "Scheduled.";
      }),
  });

  const pauseSchedule = betaZodTool({
    name: "pause_or_resume_scheduled_payday",
    description: "Pause or resume one scheduled payday.",
    inputSchema: z.object({ scheduleId: z.string(), paused: z.boolean() }),
    run: ({ scheduleId, paused }) =>
      guarded(ctx, async () => {
        const s = await prisma.schedule.findFirst({ where: { id: scheduleId, workspaceId: ctx.workspaceId }, include: { worker: true } });
        if (!s) throw new Error("That scheduled payday doesn't exist.");
        await prisma.schedule.update({ where: { id: s.id }, data: { active: !paused } });
        await step(ctx, "ACT", `${paused ? "Paused" : "Resumed"} ${s.worker.name}'s scheduled payday.`);
        return paused ? "Paused." : "Resumed.";
      }),
  });

  // ----- After paying -----

  const lookResults = betaZodTool({
    name: "look_up_pay_run_results",
    description: "The outcome of every payment in the pay run that just finished: person, amount, method, status, PayPal's reason if any, and what's allowed in their country.",
    inputSchema: z.object({}),
    run: () =>
      guarded(ctx, async () => {
        if (!ctx.payRunId) throw new Error("No pay run to look at.");
        const envelopes = await prisma.envelope.findMany({ where: { payRunId: ctx.payRunId }, include: { worker: true } });
        await step(ctx, "LOOK", `Looked at the results of ${envelopes.length} payment${envelopes.length === 1 ? "" : "s"}.`);
        return JSON.stringify(
          envelopes.map((e) => ({
            envelopeId: e.id,
            person: e.worker?.name ?? e.nameAsWritten,
            amount: dollars(e.amountCents),
            via: e.method,
            status: e.status,
            reason: e.statusDetail,
            alreadyFollowedUp: !!e.followUpKind,
            country: e.worker ? COUNTRIES[e.worker.country]?.name : null,
            methodsAllowedInTheirCountry: e.worker ? allowedMethods(e.worker.country) : [],
            pyusdWalletOnFile: !!e.worker?.walletAddress,
            paypalEmailOnFile: !!e.worker?.paypalEmail,
          })),
        );
      }),
  });

  const carry = betaZodTool({
    name: "carry_to_next_pay_run",
    description:
      "For a payment that FAILED, was RETURNED, or was HELD back: put it into next month's draft so the owner can approve it again, optionally switching the payout method. Never use for UNCLAIMED or PENDING payments: their money may still arrive.",
    inputSchema: z.object({ envelopeId: z.string(), switchTo: z.enum(["PAYPAL", "PYUSD"]).optional(), reason: z.string() }),
    run: ({ envelopeId, switchTo, reason }) =>
      guarded(ctx, async () => {
        const e = await prisma.envelope.findFirst({ where: { id: envelopeId, payRunId: ctx.payRunId }, include: { worker: true, payRun: true } });
        if (!e) throw new Error("That payment isn't in this pay run.");
        if (!["FAILED", "RETURNED", "HELD"].includes(e.status)) {
          throw new Error(`Didn't re-send ${e.worker?.name ?? e.nameAsWritten}'s payment: it's ${e.status.toLowerCase()}, so the money may still arrive. Sending again could pay them twice.`);
        }
        if (e.followUpKind) throw new Error("This payment has already been followed up.");
        if (!e.worker) throw new Error("That payment isn't for one of your people.");
        const method = switchTo ?? e.method;
        const problems = payoutDetailIssues(e.worker, method);
        const next = await draftRun(ctx.workspaceId);
        await prisma.envelope.create({
          data: {
            payRunId: next.id, workerId: e.worker.id, nameAsWritten: e.worker.name, kind: e.kind, amountCents: e.amountCents,
            description: e.description, calculation: e.calculation, sourceQuote: `Carried over from ${e.payRun.label}`, method,
            stamp: "LOOK_AGAIN", aiNote: reason,
            issues: JSON.stringify([`Carried over from ${e.payRun.label}: ${e.statusDetail ?? e.status.toLowerCase()}.`, ...problems]),
          },
        });
        const what = `Carried to the next pay run${method !== e.method ? `, switched to ${method === "PYUSD" ? "PYUSD" : "PayPal"}` : ""}. Waiting for your OK.`;
        await prisma.envelope.update({ where: { id: e.id }, data: { followUp: what, followUpKind: "CARRIED" } });
        await step(ctx, "ACT", `${e.worker.name}'s ${dollars(e.amountCents)}: ${what}`);
        return "Carried over; the owner approves it in the next pay run.";
      }),
  });

  const remind = betaZodTool({
    name: "draft_reminder",
    description: "For an UNCLAIMED payment: write a short, friendly message the owner can send the person, explaining how to claim it. Don't re-send the money.",
    inputSchema: z.object({ envelopeId: z.string(), message: z.string() }),
    run: ({ envelopeId, message }) =>
      guarded(ctx, async () => {
        const e = await prisma.envelope.findFirst({ where: { id: envelopeId, payRunId: ctx.payRunId }, include: { worker: true } });
        if (!e) throw new Error("That payment isn't in this pay run.");
        if (e.followUpKind) throw new Error("This payment has already been followed up.");
        await prisma.envelope.update({ where: { id: e.id }, data: { followUp: message.slice(0, 600), followUpKind: "REMINDER" } });
        await step(ctx, "ACT", `Wrote a reminder for ${e.worker?.name ?? e.nameAsWritten} to claim their ${dollars(e.amountCents)}.`);
        return "Reminder saved for the owner to send.";
      }),
  });

  const lookups = [lookPeople, lookThisMonth, lookHistory, lookCountry, lookWallet];
  const draftEdits = [payUsual, addEnvelope, changeAmount, hold, putBack, remove, switchMethod];
  if (ctx.trigger === "ASK") return [...lookups, ...draftEdits, schedule, pauseSchedule];
  if (ctx.trigger === "RESULTS") return [lookResults, lookPeople, lookCountry, lookWallet, carry, remind];
  return [...lookups, ...draftEdits];
}

const LIMITS = `Write plain text only: no markdown, no bold, no bullet lists. Keep replies short.
You can never send money, change anyone's payout details (people change their own through their payout link), or change the expense rules. If asked to, say so plainly.
Money only moves when the owner presses "Seal and send". Never say a payment was made unless the records say PAID.`;

const SYSTEMS: Record<Trigger, string> = {
  ASK: `You are the Routewell agent for a small business that pays contractors and staff in several countries.
The owner gives you an instruction or a question. Look things up with your tools before acting; never guess ids.
Do what they ask on this month's draft pay run (adding, changing, holding back, taking out, switching payout method) and set up or pause scheduled paydays.
If they ask a question about past payments, answer from the records with exact numbers.
${LIMITS}
When you're done, reply in two or three short sentences: what you did and anything that still needs the owner. ${VOICE}`,
  RESULTS: `You are the Routewell agent. A pay run has just finished at PayPal and on Solana devnet. Work through every payment that wasn't PAID:
- FAILED, RETURNED or HELD: carry it to the next pay run for the owner to approve. If its method can't work for the person but another allowed method has details on file, switch to it.
- UNCLAIMED: never re-send (the money may still be claimed and they'd be paid twice). Write a short reminder the owner can send them.
- PENDING: leave it; it's still processing.
${LIMITS}
When you're done, reply in at most three sentences: who was paid, what you did about the rest, and what the owner needs to do. ${VOICE}`,
  PAYDAY: `You are the Routewell agent. A scheduled payday is coming up, and the owner asked to approve paydays before they're paid.
The scheduled payments are already in this month's draft. Look them over with your tools: compare with past payments, check payout details and the PYUSD wallet,
and hold back anything that shouldn't be paid, with the reason. Don't add new payments.
${LIMITS}
When you're done, reply in two short sentences: what's ready and what you held back. ${VOICE}`,
};

/** Run the agent on a goal. Returns its reply; every step is saved for the trail. */
export async function runAgent(workspaceId: string, trigger: Trigger, goal: string, payRunId?: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const run = await prisma.agentRun.create({ data: { workspaceId, trigger, goal, payRunId } });
  const ctx: Ctx = { workspaceId, agentRunId: run.id, trigger, payRunId };
  try {
    const final = await client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 16000,
      max_iterations: 16,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: `${SYSTEMS[trigger]}\n\nToday is ${isoDay(todayFor(ws))}. The business is ${ws.companyName}.`,
      tools: tools(ctx),
      messages: [{ role: "user", content: goal }],
    });
    if (final.stop_reason === "refusal") throw new AiError("The AI declined this request.");
    const reply = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim() || "Done.";
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "DONE", reply, finishedAt: new Date() } });
    return { agentRunId: run.id, reply };
  } catch (err) {
    const message =
      err instanceof AiError ? err.message : err instanceof Anthropic.RateLimitError ? "The AI is busy right now. Try again in a minute." : "The agent couldn't finish. Anything it did is listed below.";
    console.error("Agent failed:", err);
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", reply: message, finishedAt: new Date() } });
    return { agentRunId: run.id, reply: message };
  }
}
