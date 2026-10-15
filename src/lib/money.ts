export function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** PYUSD on Solana has 6 decimals: 1 cent = 10,000 base units. */
export function centsToPyusdUnits(cents: number): bigint {
  return BigInt(cents) * BigInt(10_000);
}

export function periodKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
