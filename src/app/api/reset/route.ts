import { handle } from "@/lib/http";
import { snapshot } from "@/lib/state";
import { startFresh } from "@/lib/workspace";

export async function POST() {
  return handle(async () => snapshot(await startFresh()));
}
