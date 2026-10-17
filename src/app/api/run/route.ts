import { handle } from "@/lib/http";
import { checkLimit, clientIp } from "@/lib/limits";
import { addOne, addUsual } from "@/lib/payrun";
import { snapshot } from "@/lib/state";
import { workspaceId } from "@/lib/workspace";

type Body = { action: "USUAL" } | { action: "ADD"; workerId: string; amountUsd: number; description: string };

/** Start or add to this month's pay run directly: everyone's usual amount, or one envelope at a time. */
export async function POST(req: Request) {
  return handle(async () => {
    checkLimit("ai", clientIp(req));
    const ws = await workspaceId();
    const body = (await req.json()) as Body;
    if (body.action === "USUAL") await addUsual(ws);
    else if (body.action === "ADD") await addOne(ws, body);
    else throw new Error("Unknown action.");
    return snapshot(ws);
  });
}
