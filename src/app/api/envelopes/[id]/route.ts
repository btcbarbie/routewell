import { handle } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { allowedMethods } from "@/lib/countries";
import { dollars, toCents } from "@/lib/money";
import { snapshot } from "@/lib/state";
import { workspaceId, log } from "@/lib/workspace";

type Body =
  | { action: "PAY_ANYWAY" }
  | { action: "UNDO_DECISION" }
  | { action: "REMOVE" }
  | { action: "SET_AMOUNT"; amountUsd: number }
  | { action: "SET_METHOD"; method: "PAYPAL" | "PYUSD" };

export async function POST(req: Request, ctx: RouteContext<"/api/envelopes/[id]">) {
  return handle(async () => {
    const ws = await workspaceId();
    const { id } = await ctx.params;
    const body = (await req.json()) as Body;
    const env = await prisma.envelope.findFirst({ where: { id, payRun: { workspaceId: ws } }, include: { payRun: true, worker: true } });
    if (!env) throw new Error("Envelope not found.");
    if (env.payRun.status !== "DRAFT" || env.status !== "DRAFT") throw new Error("This envelope has already been sent.");
    const who = env.worker?.name ?? env.nameAsWritten;

    switch (body.action) {
      case "PAY_ANYWAY":
        if (!env.workerId) throw new Error("This isn't one of your people, so there's nowhere to send it.");
        await prisma.envelope.update({ where: { id }, data: { ownerDecision: "PAY_ANYWAY" } });
        await log(ws, "YOU", `Checked ${who}'s envelope and chose to pay it.`);
        break;
      case "UNDO_DECISION":
        await prisma.envelope.update({ where: { id }, data: { ownerDecision: null } });
        break;
      case "REMOVE":
        await prisma.envelope.delete({ where: { id } });
        if (env.receiptId) await prisma.receipt.delete({ where: { id: env.receiptId } });
        await log(ws, "YOU", `Took ${who}'s envelope (${dollars(env.amountCents)}) out of this month.`);
        break;
      case "SET_AMOUNT": {
        const cents = toCents(Number(body.amountUsd));
        if (!Number.isFinite(cents) || cents <= 0 || cents > 10_000_00) throw new Error("Enter an amount between $0.01 and $10,000.");
        await prisma.envelope.update({ where: { id }, data: { amountCents: cents, ownerDecision: env.stamp === "LOOK_AGAIN" ? "PAY_ANYWAY" : env.ownerDecision } });
        await log(ws, "YOU", `Changed ${who}'s envelope from ${dollars(env.amountCents)} to ${dollars(cents)}.`);
        break;
      }
      case "SET_METHOD": {
        if (!env.worker) throw new Error("This isn't one of your people.");
        if (!allowedMethods(env.worker.country).includes(body.method)) throw new Error("That payout method isn't available in their country.");
        if (body.method === "PAYPAL" && !env.worker.paypalEmail) throw new Error(`${who} has no PayPal email on file.`);
        if (body.method === "PYUSD" && !env.worker.walletAddress) throw new Error(`${who} has no wallet address on file.`);
        await prisma.envelope.update({ where: { id }, data: { method: body.method } });
        break;
      }
      default:
        throw new Error("Unknown action.");
    }
    return snapshot(ws);
  });
}
