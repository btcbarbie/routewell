import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { workspaceId } from "@/lib/workspace";

export async function GET(_req: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  await connection();
  const ws = await workspaceId();
  const { id } = await ctx.params;
  const r = await prisma.receipt.findFirst({ where: { id, workspaceId: ws }, select: { imageData: true, mimeType: true } });
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(r.imageData), { headers: { "Content-Type": r.mimeType, "Cache-Control": "private, max-age=3600" } });
}
