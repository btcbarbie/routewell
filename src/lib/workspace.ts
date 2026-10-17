import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { backfillDemoUsual, createDemoWorkspace, DEMO_RULES, upgradeOldRules } from "./demo";

// Cookies: which workspace you're looking at now, your copy of the demo studio, and the company you set up yourself.
const CURRENT = "rw_ws";
const DEMO = "rw_demo";
const MINE = "rw_mine";
const AGE = 60 * 60 * 24 * 90;

async function exists(id: string | undefined) {
  if (!id) return null;
  return prisma.workspace.findUnique({ where: { id }, select: { id: true, companyName: true, isDemo: true } });
}

async function setCookie(name: string, value: string) {
  const jar = await cookies();
  jar.set(name, value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: AGE });
}

/** The workspace you're looking at. Opens the demo studio if you haven't picked one. Route handlers only. */
export async function workspaceId(): Promise<string> {
  const jar = await cookies();
  const current = await exists(jar.get(CURRENT)?.value);
  if (current) {
    await tidyOldCopy(current.id, current.isDemo);
    return current.id;
  }
  return openDemo();
}

/** Bring older copies up to date (usual amounts, plain-worded rules). Never blocks the page if it fails. */
async function tidyOldCopy(id: string, isDemo: boolean) {
  try {
    if (isDemo) await backfillDemoUsual(id);
    await upgradeOldRules(id);
  } catch (err) {
    console.error("Couldn't update an older copy:", err);
  }
}

/** Your copy of the demo studio (made on first visit). */
export async function openDemo(): Promise<string> {
  const jar = await cookies();
  const demo = await exists(jar.get(DEMO)?.value);
  const id = demo?.id ?? (await createDemoWorkspace()).id;
  if (demo) await tidyOldCopy(id, true);
  await setCookie(DEMO, id);
  await setCookie(CURRENT, id);
  return id;
}

/** A fresh copy of the demo studio. */
export async function startFresh(): Promise<string> {
  const id = (await createDemoWorkspace()).id;
  await setCookie(DEMO, id);
  await setCookie(CURRENT, id);
  return id;
}

/** Set up your own company: empty, with starter spending rules you can change. */
export async function startOwn(companyName: string): Promise<string> {
  const ws = await prisma.workspace.create({
    data: { companyName, isDemo: false, rules: { create: DEMO_RULES } },
  });
  await setCookie(MINE, ws.id);
  await setCookie(CURRENT, ws.id);
  await log(ws.id, "YOU", `Set up ${companyName} on Routewell.`);
  return ws.id;
}

/** Go back to the company you set up, if there is one. */
export async function openMine(): Promise<string | null> {
  const jar = await cookies();
  const mine = await exists(jar.get(MINE)?.value);
  if (!mine) return null;
  await setCookie(CURRENT, mine.id);
  return mine.id;
}

/** What the homepage needs to know: is there a demo or own company to go back to. */
export async function session() {
  const jar = await cookies();
  const [demo, mine] = await Promise.all([exists(jar.get(DEMO)?.value), exists(jar.get(MINE)?.value)]);
  return { demo: demo ? { name: demo.companyName } : null, mine: mine ? { name: mine.companyName } : null };
}

export async function log(workspaceId: string, actor: string, text: string) {
  await prisma.activity.create({ data: { workspaceId, actor, text } });
}
