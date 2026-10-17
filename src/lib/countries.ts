// Hand-checked payout facts per country. The AI never invents these; it only reads them.
// Checked October 2026. Sources are listed per country and shown in the app.
// paypal.canReceive means "can be paid through PayPal Payouts", per PayPal's Payouts country list.

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
      canReceive: false,
      note: "Nigeria isn't on PayPal's list of countries that can receive Payouts. Since January 2026 Nigerians can receive some PayPal payments through a linked Paga wallet, but for nearly 20 years they couldn't receive at all.",
    },
    pyusd: { allowed: true, note: "Arrives as digital dollars in their own wallet, so it keeps its dollar value." },
    sources: [
      { label: "PayPal Payouts countries", url: "https://developer.paypal.com/payouts/supported-features" },
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
      { label: "PayPal Payouts countries", url: "https://developer.paypal.com/payouts/supported-features" },
      { label: "PayPal still unavailable in Pakistan (2026)", url: "https://www.jobbers.io/best-ways-to-receive-international-payments-in-pakistan-beyond-paypal/" },
      { label: "Pakistan Virtual Assets Act 2026", url: "https://cryptoslate.com/crypto-laws/pakistan-virtual-assets-act-2026-pvara/" },
    ],
  },
  GH: {
    code: "GH",
    timezone: "Africa/Accra",
    name: "Ghana",
    currency: "GHS",
    currencySymbol: "GH₵",
    paypal: { canReceive: false, note: "Ghana isn't on PayPal's list of countries that can receive Payouts." },
    pyusd: {
      allowed: true,
      note: "Crypto is regulated under Ghana's Virtual Asset Service Providers Act 2025, with licensing being rolled out in 2026.",
    },
    sources: [
      { label: "PayPal Payouts countries", url: "https://developer.paypal.com/payouts/supported-features" },
      { label: "Ghana Virtual Asset Service Providers Act 2025", url: "https://cryptoslate.com/crypto-laws/ghana-virtual-asset-service-providers-act-2025-act-1154/" },
    ],
  },
  KE: {
    code: "KE",
    timezone: "Africa/Nairobi",
    name: "Kenya",
    currency: "KES",
    currencySymbol: "KSh",
    paypal: { canReceive: true, note: "Paid in dollars to PayPal." },
    pyusd: {
      allowed: true,
      note: "Crypto is regulated under Kenya's Virtual Asset Service Providers Act 2025. Kenya's central bank can restrict foreign stablecoins on licensed platforms.",
    },
    sources: [
      { label: "PayPal Payouts countries", url: "https://developer.paypal.com/payouts/supported-features" },
      { label: "Kenya Virtual Asset Service Providers Act 2025", url: "https://cryptoslate.com/crypto-laws/kenya-virtual-asset-service-providers-act-2025/" },
    ],
  },
  ZM: {
    code: "ZM",
    timezone: "Africa/Lusaka",
    name: "Zambia",
    currency: "ZMW",
    currencySymbol: "K",
    paypal: { canReceive: false, note: "Zambia isn't on PayPal's list of countries that can receive Payouts." },
    pyusd: {
      allowed: true,
      note: "Crypto isn't banned in Zambia. Since March 2026, crypto service providers must register with the Bank of Zambia.",
    },
    sources: [
      { label: "PayPal Payouts countries", url: "https://developer.paypal.com/payouts/supported-features" },
      { label: "Bank of Zambia: register crypto service providers (2026)", url: "https://www.zambiamonitor.com/bank-of-zambia-calls-for-registration-of-cryptocurrency-service-providers/" },
    ],
  },
  ZW: {
    code: "ZW",
    timezone: "Africa/Harare",
    name: "Zimbabwe",
    currency: "ZWG",
    currencySymbol: "ZiG",
    paypal: { canReceive: false, note: "Zimbabwe isn't on PayPal's list of countries that can receive Payouts." },
    pyusd: {
      allowed: true,
      note: "Crypto businesses in Zimbabwe must register with the Reserve Bank's financial intelligence unit (2026). Crypto isn't legal tender.",
    },
    sources: [
      { label: "PayPal Payouts countries", url: "https://developer.paypal.com/payouts/supported-features" },
      { label: "Zimbabwe crypto business registration (2026)", url: "https://news.fundsforngos.org/2026/06/17/cryptocurrency-businesses-in-zimbabwe-face-mandatory-annual-registration/" },
    ],
  },
  AM: {
    code: "AM",
    timezone: "Asia/Yerevan",
    name: "Armenia",
    currency: "AMD",
    currencySymbol: "֏",
    paypal: { canReceive: false, note: "Armenia isn't on PayPal's list of countries that can receive Payouts." },
    pyusd: {
      allowed: true,
      note: "Armenia's central bank licenses crypto service providers under rules in force since January 2026.",
    },
    sources: [
      { label: "PayPal Payouts countries", url: "https://developer.paypal.com/payouts/supported-features" },
      { label: "Crypto regulation in Armenia (2026)", url: "https://mblegal.am/crypto-regulation-in-armenia/" },
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
