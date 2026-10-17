// A fingerprint of exactly what the owner reviewed. Seal and send sends it, and the server refuses
// if the pay run has changed since (for example, the agent or another tab edited it).
type Reviewed = { id: string; amountCents: number; method: string; status: string; stamp: string; ownerDecision: string | null };

export function reviewFingerprint(envelopes: Reviewed[]): string {
  return [...envelopes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => [e.id, e.amountCents, e.method, e.status, e.stamp, e.ownerDecision ?? ""].join(":"))
    .join("|");
}
