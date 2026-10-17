import { handle } from "@/lib/http";
import { runAgent } from "@/lib/agent";
import { checkLimit, clientIp } from "@/lib/limits";
import { snapshot } from "@/lib/state";
import { workspaceId } from "@/lib/workspace";

/** The Ask bar: the Routewell agent takes the owner's instruction or question and works on it with its tools. */
export async function POST(req: Request) {
  return handle(async () => {
    checkLimit("ai", clientIp(req));
    const { text } = (await req.json()) as { text?: string };
    const instruction = String(text ?? "").trim().slice(0, 600);
    if (!instruction) throw new Error("Type what you'd like done, or a question.");
    const ws = await workspaceId();
    const { agentRunId } = await runAgent(ws, "ASK", instruction);
    return { ...(await snapshot(ws)), agentRunId };
  });
}
