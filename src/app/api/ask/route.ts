import { handle } from "@/lib/http";
import { ask } from "@/lib/ask";
import { workspaceId } from "@/lib/workspace";

export async function POST(req: Request) {
  return handle(async () => {
    const { text } = (await req.json()) as { text?: string };
    const instruction = String(text ?? "").trim().slice(0, 500);
    if (!instruction) throw new Error("Type what you'd like to change.");
    return { instruction, ...(await ask(await workspaceId(), instruction)) };
  });
}
