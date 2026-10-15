import { handle } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { toCents } from "@/lib/money";
import { runPaydays } from "@/lib/paydays";
import { forgetTreasury, snapshot } from "@/lib/state";
import { workspaceId, log } from "@/lib/workspace";

type Body =
  | { action: "PRETEND_AND_RUN"; date: string }
  | { action: "BACK_TO_TODAY" }
  | { action: "SET_BUDGET"; amountUsd: number }
  | { action: "SET_PAUSED"; paused: boolean }
  | { action: "TOGGLE_SCHEDULE"; scheduleId: string; active: boolean }
  | { action: "MOVE_SCHEDULE"; scheduleId: string; dayOfMonth: number };

export async function POST(req: Request) {
  return handle(async () => {
    const ws = await workspaceId();
    const body = (await req.json()) as Body;
    let message: string | undefined;
    switch (body.action) {
      case "PRETEND_AND_RUN": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new Error("Pick a date.");
        const date = new Date(`${body.date}T12:00:00Z`);
        if (Number.isNaN(date.getTime())) throw new Error("Pick a valid date.");
        await prisma.workspace.update({ where: { id: ws }, data: { pretendToday: body.date } });
        await log(ws, "YOU", `Demo: pretended today is ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.`);
        message = (await runPaydays(ws, date)).message;
        forgetTreasury();
        break;
      }
      case "BACK_TO_TODAY":
        await prisma.workspace.update({ where: { id: ws }, data: { pretendToday: null } });
        break;
      case "SET_BUDGET": {
        const cents = toCents(Number(body.amountUsd));
        if (!Number.isFinite(cents) || cents < 0 || cents > 100_000_00) throw new Error("Enter a budget between $0 and $100,000.");
        await prisma.workspace.update({ where: { id: ws }, data: { paydayBudgetCents: cents } });
        await log(ws, "YOU", `Set the monthly payday budget to $${(cents / 100).toFixed(2)}.`);
        break;
      }
      case "SET_PAUSED":
        await prisma.workspace.update({ where: { id: ws }, data: { autopilotPaused: !!body.paused } });
        await log(ws, "YOU", body.paused ? "Paused all scheduled paydays." : "Turned scheduled paydays back on.");
        break;
      case "TOGGLE_SCHEDULE": {
        const s = await prisma.schedule.findFirst({ where: { id: body.scheduleId, workspaceId: ws }, include: { worker: true } });
        if (!s) throw new Error("Scheduled payday not found.");
        await prisma.schedule.update({ where: { id: s.id }, data: { active: !!body.active } });
        await log(ws, "YOU", `${body.active ? "Resumed" : "Paused"} ${s.worker.name}'s scheduled payday.`);
        break;
      }
      case "MOVE_SCHEDULE": {
        const s = await prisma.schedule.findFirst({ where: { id: body.scheduleId, workspaceId: ws }, include: { worker: true } });
        if (!s) throw new Error("Scheduled payday not found.");
        const day = Number(body.dayOfMonth);
        if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error("Paydays can be on day 1 to 28.");
        await prisma.schedule.update({ where: { id: s.id }, data: { dayOfMonth: day } });
        await log(ws, "YOU", `Moved ${s.worker.name}'s payday to the ${day}${day === 1 || day === 21 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th"}.`);
        break;
      }
      default:
        throw new Error("Unknown action.");
    }
    return { ...(await snapshot(ws)), message };
  });
}
