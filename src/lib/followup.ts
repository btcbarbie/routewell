import { prisma } from "./prisma";
import { summarizeResults } from "./ai";
import { runAgent } from "./agent";
import { dollars } from "./money";
import { refreshRun } from "./payrun";
import { log } from "./workspace";

/**
 * Check PayPal for this pay run. Once nothing is still processing, follow up exactly once:
 * if everything was paid, the AI writes a short summary; if not, the Routewell agent works through
 * what wasn't paid (carrying failures over, writing reminders for unclaimed money) and reports back.
 */
export async function checkAndFollowUp(workspaceId: string, runId: string) {
  const settled = await refreshRun(workspaceId, runId);
  if (!settled) return;

  // Older pay runs already have their summary; nothing to follow up.
  const current = await prisma.payRun.findUniqueOrThrow({ where: { id: runId }, select: { resultSummary: true } });
  if (current.resultSummary) return;

  // Claim the follow-up so it never runs twice, even if several checks arrive at once.
  const claimed = await prisma.payRun.updateMany({ where: { id: runId, followUpState: null }, data: { followUpState: "RUNNING" } });
  if (claimed.count === 0) return;

  const run = await prisma.payRun.findUniqueOrThrow({ where: { id: runId }, include: { envelopes: { include: { worker: true } } } });
  const sent = run.envelopes.filter((e) => e.status !== "DRAFT");
  const notPaid = sent.filter((e) => e.status !== "PAID");
  const fallback = `${sent.length - notPaid.length} of ${sent.length} paid.`;
  let summary: string;
  try {
    if (notPaid.length) {
      const goal = `The pay run "${run.label}" has finished. ${sent.length - notPaid.length} of ${sent.length} payments were paid. Follow up on the rest.`;
      summary = (await runAgent(workspaceId, "RESULTS", goal, runId)).reply;
    } else {
      summary = await summarizeResults({
        results: sent.map((e) => ({ person: e.worker?.name ?? e.nameAsWritten, amount: dollars(e.amountCents), via: e.method, status: e.status })),
        context: `Pay run: ${run.label}.`,
      });
      await log(workspaceId, "AI", summary);
    }
  } catch (err) {
    console.error("Follow-up failed:", err);
    summary = fallback;
  }
  await prisma.payRun.update({ where: { id: runId }, data: { resultSummary: summary, followUpState: "DONE" } });
}
