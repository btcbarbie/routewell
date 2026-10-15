import { handle } from "@/lib/http";
import { checkLimit, clientIp } from "@/lib/limits";
import { snapshot } from "@/lib/state";
import { startFresh } from "@/lib/workspace";

export async function POST(req: Request) {
  return handle(async () => {
    checkLimit("reset", clientIp(req));
    return snapshot(await startFresh());
  });
}
