import { connection } from "next/server";
import { handle } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { COUNTRIES, allowedMethods } from "@/lib/countries";
import { isValidAddress } from "@/lib/solana";
import { log } from "@/lib/workspace";

// A worker's own page, reached by their private link. Shows only their details, never anyone else's.

async function load(token: string) {
  const w = await prisma.worker.findUnique({ where: { choiceToken: token }, include: { workspace: { select: { companyName: true } } } });
  if (!w) throw new Error("This link isn't valid any more. Ask for a new one.");
  return w;
}

function view(w: Awaited<ReturnType<typeof load>>) {
  return {
    name: w.name,
    company: w.workspace.companyName,
    city: w.city,
    country: COUNTRIES[w.country] ?? null,
    allowed: allowedMethods(w.country),
    method: w.payoutMethod,
    paypalEmail: w.paypalEmail,
    walletAddress: w.walletAddress,
    updatedAt: w.choiceUpdatedAt?.toISOString() ?? null,
  };
}

export async function GET(_req: Request, ctx: RouteContext<"/api/worker/[token]">) {
  await connection();
  return handle(async () => view(await load((await ctx.params).token)));
}

export async function POST(req: Request, ctx: RouteContext<"/api/worker/[token]">) {
  return handle(async () => {
    const w = await load((await ctx.params).token);
    const body = (await req.json()) as { method: "PAYPAL" | "PYUSD"; paypalEmail?: string; walletAddress?: string };
    if (!allowedMethods(w.country).includes(body.method)) throw new Error("That option isn't available in your country.");
    const data: { payoutMethod: string; paypalEmail?: string; walletAddress?: string; choiceUpdatedAt: Date } = { payoutMethod: body.method, choiceUpdatedAt: new Date() };
    if (body.method === "PAYPAL") {
      const email = String(body.paypalEmail ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter the email address of your PayPal account.");
      data.paypalEmail = email;
    } else {
      const address = String(body.walletAddress ?? "").trim();
      if (!isValidAddress(address)) throw new Error("That doesn't look like a Solana wallet address. Copy it from your wallet app.");
      data.walletAddress = address;
    }
    const updated = await prisma.worker.update({ where: { id: w.id }, data, include: { workspace: { select: { companyName: true } } } });
    await log(w.workspaceId, "WORKER", `${w.name} chose to be paid ${body.method === "PYUSD" ? "in PYUSD to their own wallet" : "through PayPal"}.`);
    return view(updated);
  });
}
