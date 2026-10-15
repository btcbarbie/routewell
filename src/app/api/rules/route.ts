import { handle } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { snapshot } from "@/lib/state";
import { workspaceId, log } from "@/lib/workspace";

export async function POST(req: Request) {
  return handle(async () => {
    const ws = await workspaceId();
    const body = (await req.json()) as { add?: string; remove?: string };
    if (body.add !== undefined) {
      const text = String(body.add).trim().slice(0, 200);
      if (!text) throw new Error("Write the rule first.");
      await prisma.spendingRule.create({ data: { workspaceId: ws, text } });
      await log(ws, "YOU", `Added a spending rule: ${text}`);
    } else if (body.remove) {
      const rule = await prisma.spendingRule.findFirst({ where: { id: body.remove, workspaceId: ws } });
      if (!rule) throw new Error("Rule not found.");
      await prisma.spendingRule.delete({ where: { id: rule.id } });
      await log(ws, "YOU", `Removed a spending rule: ${rule.text}`);
    }
    return snapshot(ws);
  });
}
