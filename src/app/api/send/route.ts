import { handle } from "@/lib/http";
import { checkLimit, clientIp } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { payEnvelopes } from "@/lib/payrun";
import { forgetTreasury, snapshot } from "@/lib/state";
import { workspaceId, log } from "@/lib/workspace";

export async function POST(req: Request) {
  return handle(async () => {
    checkLimit("send", clientIp(req));
    const ws = await workspaceId();
    const run = await prisma.payRun.findFirst({ where: { workspaceId: ws, status: "DRAFT", kind: "MANUAL" }, include: { envelopes: true } });
    if (!run) throw new Error("There's no pay run to send.");
    const open = run.envelopes.filter((e) => e.status === "DRAFT" && e.stamp === "LOOK_AGAIN" && !e.ownerDecision);
    if (open.length) throw new Error(`${open.length} envelope${open.length === 1 ? " needs" : "s need"} a look first.`);
    await log(ws, "YOU", `Sealed and sent ${run.label}.`);
    await payEnvelopes(ws, run.id, run.label);
    forgetTreasury();
    return snapshot(ws);
  });
}
