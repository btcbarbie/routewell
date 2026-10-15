import { handle } from "@/lib/http";
import { applyActions } from "@/lib/ask";
import type { AskResult } from "@/lib/ai";
import { snapshot } from "@/lib/state";
import { workspaceId } from "@/lib/workspace";

export async function POST(req: Request) {
  return handle(async () => {
    const { instruction, actions } = (await req.json()) as { instruction: string; actions: AskResult["actions"] };
    if (!Array.isArray(actions) || !actions.length) throw new Error("Nothing to apply.");
    const ws = await workspaceId();
    await applyActions(ws, String(instruction).slice(0, 500), actions.slice(0, 10));
    return snapshot(ws);
  });
}
