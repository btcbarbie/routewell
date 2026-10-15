import { handle } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { COUNTRIES, allowedMethods } from "@/lib/countries";
import { isValidAddress } from "@/lib/solana";
import { snapshot } from "@/lib/state";
import { workspaceId, log } from "@/lib/workspace";

type AddBody = {
  name: string;
  role: "CONTRACTOR" | "STAFF";
  work: string;
  rateNote: string;
  country: string;
  city: string;
  payoutMethod: "PAYPAL" | "PYUSD";
  paypalEmail?: string;
  walletAddress?: string;
};

export async function POST(req: Request) {
  return handle(async () => {
    const ws = await workspaceId();
    const body = (await req.json()) as AddBody | { remove: string };

    if ("remove" in body) {
      const w = await prisma.worker.findFirst({ where: { id: body.remove, workspaceId: ws }, include: { _count: { select: { envelopes: true } } } });
      if (!w) throw new Error("Person not found.");
      if (w._count.envelopes > 0) throw new Error(`${w.name} has payments on record, so they can't be removed.`);
      await prisma.worker.delete({ where: { id: w.id } });
      await log(ws, "YOU", `Removed ${w.name}.`);
      return snapshot(ws);
    }

    const name = String(body.name ?? "").trim().slice(0, 80);
    if (name.length < 2) throw new Error("Enter their name.");
    const country = COUNTRIES[body.country];
    if (!country) throw new Error("Pick their country.");
    const city = String(body.city ?? "").trim().slice(0, 60);
    if (!city) throw new Error("Enter their city.");
    if (!allowedMethods(country.code).includes(body.payoutMethod)) throw new Error(`That payout option isn't available in ${country.name}.`);
    let paypalEmail: string | null = null;
    let walletAddress: string | null = null;
    if (body.payoutMethod === "PAYPAL") {
      paypalEmail = String(body.paypalEmail ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) throw new Error("Enter their PayPal email.");
    } else {
      walletAddress = String(body.walletAddress ?? "").trim();
      if (!isValidAddress(walletAddress)) throw new Error("Enter their Solana wallet address.");
    }
    const role = body.role === "STAFF" ? "STAFF" : "CONTRACTOR";
    await prisma.worker.create({
      data: {
        workspaceId: ws,
        name,
        role,
        work: String(body.work ?? "").trim().slice(0, 80) || (role === "STAFF" ? "Staff" : "Contractor"),
        rateNote: String(body.rateNote ?? "").trim().slice(0, 80) || (role === "STAFF" ? "Staff: expenses paid back" : "Rate not set"),
        country: country.code,
        city,
        timezone: country.timezone,
        payoutMethod: body.payoutMethod,
        paypalEmail,
        walletAddress,
      },
    });
    await log(ws, "YOU", `Added ${name} (${city}, ${country.name}).`);
    return snapshot(ws);
  });
}
