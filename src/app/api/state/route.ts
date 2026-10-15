import { handle } from "@/lib/http";
import { snapshot } from "@/lib/state";
import { workspaceId } from "@/lib/workspace";

export async function GET() {
  return handle(async () => snapshot(await workspaceId()));
}
