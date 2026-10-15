import { connection } from "next/server";
import { handle } from "@/lib/http";
import { snapshot } from "@/lib/state";
import { workspaceId } from "@/lib/workspace";

export async function GET() {
  await connection(); // always live, per visitor
  return handle(async () => snapshot(await workspaceId()));
}
