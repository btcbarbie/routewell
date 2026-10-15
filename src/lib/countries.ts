// Hand-checked payout facts per country. The AI never invents these; it only reads them.
// Checked October 2026. Sources are listed per country and shown in the app.

export type CountryFacts = {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  timezone: string; // default for people added in this country
  paypal: { canReceive: boolean; note: string };
  pyusd: { allowed: boolean; note: string };
  sources: { label: string; url: string }[];
};

export const COUNTRIES: Record<string, CountryFacts> = {
  US: {
    code: "US",
    timezone: "America/New_York",
    name: "United States",
    currency: "USD",
    currencySymbol: "$",
    paypal: { canReceive: true, note: "Paid in dollars." },
    pyusd: { allowed: true, note: "Arrives as digital dollars in their own wallet." },
    sources: [{ label: "PayPal PYUSD", url: "https://www.paypal.com/us/pyusd" }],
  },
  NG: {
    code: "NG",
    timezone: "Africa/Lagos",
    name: "Nigeria",
    currency: "NGN",
    currencySymbol: "₦",
    paypal: {
      canReceive: true,
      note: "Receiving only became possible in January 2026, through a linked Paga wallet. For nearly 20 years Nigerian accounts could send but not receive.",
    },
    pyusd: { allowed: true, note: "Arrives as digital dollars in their own wallet, so it keeps its dollar value." },
    sources: [
      { label: "PayPal returns to Nigeria through Paga (Jan 2026)", url: "https://allafrica.com/stories/202601270689.html" },
    ],
  },
  IN: {
    code: "IN",
    timezone: "Asia/Kolkata",
    name: "India",
    currency: "INR",
    currencySymbol: "₹",
    paypal: {
      canReceive: true,
      note: "Paid in rupees: PayPal converts the money and sends it to their bank. They can't keep it in dollars.",
    },
    pyusd: {
      allowed: true,
      note: "Stays in dollars until they choose to convert. India taxes crypto gains at 30%, plus 1% TDS on sales.",
    },
    sources: [
      { label: "PayPal India auto-withdrawal", url: "https://wise.com/in/blog/how-to-use-paypal-india" },
      { label: "India keeps 30% crypto tax (Budget 2026)", url: "https://decrypt.co/356601/no-relief-for-crypto-investors-as-india-retains-current-crypto-tax-in-budget-2026" },
    ],
  },
  PH: {
    code: "PH",
    timezone: "Asia/Manila",
    name: "Philippines",
    currency: "PHP",
    currencySymbol: "₱",
    paypal: { canReceive: true, note: "Paid in dollars to PayPal, then they withdraw to a local bank." },
    pyusd: { allowed: true, note: "Arrives as digital dollars in their own wallet." },
    sources: [{ label: "PayPal PYUSD", url: "https://www.paypal.com/us/pyusd" }],
  },
  PK: {
    code: "PK",
    timezone: "Asia/Karachi",
    name: "Pakistan",
    currency: "PKR",
    currencySymbol: "Rs",
    paypal: { canReceive: false, note: "PayPal doesn't operate in Pakistan. People there can't open an account to receive money." },
    pyusd: {
      allowed: true,
      note: "Holding crypto is legal under Pakistan's Virtual Assets Act 2026, through licensed platforms. It isn't legal tender.",
    },
    sources: [
      { label: "PayPal still unavailable in Pakistan (2026)", url: "https://www.jobbers.io/best-ways-to-receive-international-payments-in-pakistan-beyond-paypal/" },
      { label: "Pakistan Virtual Assets Act 2026", url: "https://cryptoslate.com/crypto-laws/pakistan-virtual-assets-act-2026-pvara/" },
    ],
  },
};

export function countryFacts(code: string): CountryFacts | undefined {
  return COUNTRIES[code];
}

/** Which payout methods are allowed for a worker in this country. */
export function allowedMethods(code: string): ("PAYPAL" | "PYUSD")[] {
  const c = COUNTRIES[code];
  if (!c) return ["PAYPAL"];
  const out: ("PAYPAL" | "PYUSD")[] = [];
  if (c.paypal.canReceive) out.push("PAYPAL");
  if (c.pyusd.allowed) out.push("PYUSD");
  return out;
}
