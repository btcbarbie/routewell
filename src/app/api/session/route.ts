import { connection } from "next/server";
import { handle } from "@/lib/http";
import { checkLimit, clientIp } from "@/lib/limits";
import { openDemo, openMine, session, startOwn } from "@/lib/workspace";

export async function GET() {
  await connection();
  return handle(session);
}

/** Pick which company to look at: the demo, your own, or set up a new one. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as { open: "demo" | "mine" } | { start: string };
    if ("start" in body) {
      checkLimit("reset", clientIp(req));
      const name = String(body.start).trim().slice(0, 80);
      if (name.length < 2) throw new Error("Enter your company's name.");
      await startOwn(name);
    } else if (body.open === "mine") {
      if (!(await openMine())) throw new Error("You haven't set up your own company yet.");
    } else {
      await openDemo();
    }
    return { ok: true };
  });
}
