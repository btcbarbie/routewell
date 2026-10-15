import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { createDemoWorkspace } from "./demo";

const COOKIE = "rw_ws";

/** Each visitor gets their own demo workspace, remembered in a cookie. Route handlers only. */
export async function workspaceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) {
    const found = await prisma.workspace.findUnique({ where: { id: existing }, select: { id: true } });
    if (found) return found.id;
  }
  return startFresh();
}

export async function startFresh(): Promise<string> {
  const ws = await createDemoWorkspace();
  const jar = await cookies();
  jar.set(COOKIE, ws.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return ws.id;
}

export async function log(workspaceId: string, actor: string, text: string) {
  await prisma.activity.create({ data: { workspaceId, actor, text } });
}
