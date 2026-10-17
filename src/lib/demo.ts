import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Keypair } from "@solana/web3.js";
import { prisma } from "./prisma";
import { monthLabel } from "./money";

// A made-up studio with people in five countries. PayPal workers all receive at the
// sandbox personal account from .env, because sandbox payouts must go to sandbox accounts.

export const DEMO_RULES = [
  "Meals: up to $50 per person. No alcohol.",
  "Taxis and rides: up to $80 per trip.",
  "Receipts must be from the last 60 days.",
  "Equipment over $200 needs approval before buying.",
];

export async function createDemoWorkspace() {
  const sandboxEmail = process.env.PAYPAL_TEST_RECEIVER_EMAIL ?? "sandbox-personal@example.com";
  const adaezeWallet = process.env.TEST_WORKER_ADDRESS ?? Keypair.generate().publicKey.toBase58();
  const aliWallet = Keypair.generate().publicKey.toBase58();

  const now = new Date();
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 28, 15));
  const sixth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 6, 15));

  const ws = await prisma.workspace.create({
    data: {
      companyName: "Brightside Studio",
      rules: { create: DEMO_RULES.map((text) => ({ text })) },
    },
  });

  const w = async (data: {
    name: string; role: string; work: string; rateNote: string; usualCents?: number; country: string; city: string; timezone: string;
    payoutMethod: string; paypalEmail?: string; walletAddress?: string;
  }) => prisma.worker.create({ data: { ...data, workspaceId: ws.id } });

  const adaeze = await w({ name: "Adaeze Okafor", role: "CONTRACTOR", work: "Icon design", rateNote: "$12 per icon", usualCents: 2400, country: "NG", city: "Lagos", timezone: "Africa/Lagos", payoutMethod: "PYUSD", walletAddress: adaezeWallet });
  const ali = await w({ name: "Ali Raza", role: "CONTRACTOR", work: "Web fixes", rateNote: "$20 per bug fix", usualCents: 2000, country: "PK", city: "Lahore", timezone: "Asia/Karachi", payoutMethod: "PYUSD", walletAddress: aliWallet });
  const rohan = await w({ name: "Rohan Mehta", role: "CONTRACTOR", work: "QA testing", rateNote: "$18 per hour", usualCents: 36000, country: "IN", city: "Pune", timezone: "Asia/Kolkata", payoutMethod: "PAYPAL", paypalEmail: sandboxEmail });
  const maria = await w({ name: "Maria Santos", role: "CONTRACTOR", work: "Design production", rateNote: "$25 per hour", usualCents: 80000, country: "PH", city: "Manila", timezone: "Asia/Manila", payoutMethod: "PAYPAL", paypalEmail: sandboxEmail });
  const jordan = await w({ name: "Jordan Lee", role: "CONTRACTOR", work: "Brand strategy", rateNote: "$1,500 monthly retainer", usualCents: 150000, country: "US", city: "Austin", timezone: "America/Chicago", payoutMethod: "PAYPAL", paypalEmail: sandboxEmail });
  const sam = await w({ name: "Sam Carter", role: "STAFF", work: "Account manager", rateNote: "Staff: expenses paid back", country: "US", city: "Austin", timezone: "America/Chicago", payoutMethod: "PAYPAL", paypalEmail: sandboxEmail });

  // Last month's pay run, already paid. Gives the AI a history to compare against.
  await prisma.payRun.create({
    data: {
      workspaceId: ws.id,
      label: monthLabel(lastMonth),
      status: "SENT",
      sentAt: lastMonth,
      createdAt: lastMonth,
      resultSummary: "Everyone was paid.",
      envelopes: {
        create: [
          { workerId: maria.id, nameAsWritten: "Maria", kind: "WORK", amountCents: 80000, description: "32 hours of design production", calculation: "32 hours × $25", method: "PAYPAL", stamp: "CHECKED", aiNote: "Matches her sheet.", status: "PAID", createdAt: lastMonth },
          { workerId: rohan.id, nameAsWritten: "Rohan", kind: "WORK", amountCents: 36000, description: "20 hours of QA testing", calculation: "20 hours × $18", method: "PAYPAL", stamp: "CHECKED", aiNote: "Matches his hours.", status: "PAID", createdAt: lastMonth },
          { workerId: adaeze.id, nameAsWritten: "Adaeze", kind: "WORK", amountCents: 2400, description: "2 icons", calculation: "2 icons × $12", method: "PYUSD", stamp: "CHECKED", aiNote: "Same rate as always.", status: "PAID", createdAt: lastMonth },
          { workerId: ali.id, nameAsWritten: "Ali", kind: "WORK", amountCents: 2000, description: "1 bug fix", calculation: "1 fix × $20", method: "PYUSD", stamp: "CHECKED", aiNote: "Same rate as always.", status: "PAID", createdAt: lastMonth },
          { workerId: jordan.id, nameAsWritten: "Jordan", kind: "RETAINER", amountCents: 150000, description: "Monthly retainer", method: "PAYPAL", stamp: "SCHEDULED", aiNote: "Scheduled retainer.", status: "PAID", createdAt: lastMonth },
        ],
      },
    },
  });

  // Early this month: Sam's taxi receipt was already paid back. Uploading the same receipt again should be caught.
  const taxi = await readFile(path.join(process.cwd(), "public/samples/taxi-receipt.png"));
  const taxiReceipt = await prisma.receipt.create({
    data: {
      workspaceId: ws.id,
      workerId: sam.id,
      imageData: taxi,
      mimeType: "image/png",
      imageHash: createHash("sha256").update(taxi).digest("hex"),
      vendor: "CityRide",
      receiptDate: "2026-10-03",
      amountCents: 4820,
      currency: "USD",
      category: "Taxi",
      details: "Ride from 1100 Congress Ave to 2400 Lamar Blvd, Austin",
      createdAt: sixth,
    },
  });
  await prisma.payRun.create({
    data: {
      workspaceId: ws.id,
      label: `Expenses, ${sixth.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`,
      status: "SENT",
      sentAt: sixth,
      createdAt: sixth,
      resultSummary: "Sam was paid back.",
      envelopes: {
        create: [
          { workerId: sam.id, nameAsWritten: "Sam", kind: "EXPENSE", amountCents: 4820, description: "CityRide taxi, Oct 3", method: "PAYPAL", stamp: "CHECKED", aiNote: "Within the $80 taxi limit.", status: "PAID", receiptId: taxiReceipt.id, createdAt: sixth },
        ],
      },
    },
  });

  await prisma.schedule.create({
    data: {
      workspaceId: ws.id,
      workerId: jordan.id,
      amountCents: 150000,
      dayOfMonth: 28,
      note: "Monthly retainer",
      createdFrom: "Pay Jordan $1,500 every 28th",
      lastPaidPeriod: `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, "0")}`,
    },
  });

  await prisma.activity.createMany({
    data: [
      { workspaceId: ws.id, actor: "PAYPAL", text: `${monthLabel(lastMonth)} pay run: everyone paid.`, at: lastMonth },
      { workspaceId: ws.id, actor: "PAYPAL", text: "Sam paid back $48.20 for a CityRide taxi.", at: sixth },
    ],
  });

  return ws;
}

// Demo copies made before usual amounts existed get them filled in, matched by name.
const DEMO_USUAL: Record<string, number> = { "Adaeze Okafor": 2400, "Ali Raza": 2000, "Rohan Mehta": 36000, "Maria Santos": 80000, "Jordan Lee": 150000 };

export async function backfillDemoUsual(workspaceId: string) {
  const workers = await prisma.worker.findMany({ where: { workspaceId }, select: { id: true, name: true, usualCents: true } });
  if (workers.some((w) => w.usualCents !== null)) return;
  for (const w of workers) {
    if (DEMO_USUAL[w.name]) await prisma.worker.update({ where: { id: w.id }, data: { usualCents: DEMO_USUAL[w.name] } });
  }
}
