import { handle } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkAndFollowUp } from "@/lib/followup";
import { snapshot } from "@/lib/state";
import { workspaceId } from "@/lib/workspace";

export async function POST(_req: Request, ctx: RouteContext<"/api/runs/[id]/refresh">) {
  return handle(async () => {
    const ws = await workspaceId();
    const { id } = await ctx.params;
    const run = await prisma.payRun.findFirst({ where: { id, workspaceId: ws } });
    if (!run) throw new Error("Pay run not found.");
    await checkAndFollowUp(ws, run.id);
    return snapshot(ws);
  });
}
