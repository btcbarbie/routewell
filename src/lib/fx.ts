// Today's exchange rates, only for showing "about how much in local money". Never used to move money.
const SOURCE = "https://open.er-api.com/v6/latest/USD";
let cache: { at: number; data: Fx | null } = { at: 0, data: null };

export type Fx = { rates: Record<string, number>; asOf: string; source: string };

export async function usdRates(): Promise<Fx | null> {
  if (cache.data && Date.now() - cache.at < 6 * 60 * 60 * 1000) return cache.data;
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(4000) });
    const json = await res.json();
    if (json.result !== "success") return cache.data;
    const pick = ["NGN", "INR", "PHP", "PKR", "GHS", "KES", "BDT", "EGP"];
    const rates: Record<string, number> = {};
    for (const c of pick) if (json.rates?.[c]) rates[c] = json.rates[c];
    cache = { at: Date.now(), data: { rates, asOf: json.time_last_update_utc, source: "open.er-api.com" } };
    return cache.data;
  } catch {
    return cache.data;
  }
}
