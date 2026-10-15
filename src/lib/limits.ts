// Simple per-visitor limits so a public demo link can't run up AI costs or drain the test wallets.
// In memory: resets when the server restarts, which is fine for a demo.

const hits = new Map<string, number[]>();

const LIMITS = {
  ai: { max: 20, windowMs: 60 * 60 * 1000, message: "That's a lot of AI requests for one hour. Try again a little later." },
  send: { max: 6, windowMs: 60 * 60 * 1000, message: "That's a lot of payments for one hour. Try again a little later." },
  reset: { max: 10, windowMs: 60 * 60 * 1000, message: "You've started over a lot this hour. Try again a little later." },
} as const;

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export function checkLimit(kind: keyof typeof LIMITS, key: string) {
  const { max, windowMs, message } = LIMITS[kind];
  const now = Date.now();
  const id = `${kind}:${key}`;
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new Error(message);
  recent.push(now);
  hits.set(id, recent);
}
