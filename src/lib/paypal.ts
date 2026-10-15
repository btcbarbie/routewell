// PayPal Payouts (sandbox only). One batch pays many people at once.

const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (!base.includes("sandbox")) throw new Error("Routewell only runs against the PayPal sandbox.");
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal sandbox keys are missing from .env.");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal sign-in failed (${res.status}).`);
  const json = await res.json();
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export type PayoutItem = { envelopeId: string; email: string; cents: number; note: string };

export async function sendBatch(batchId: string, subject: string, items: PayoutItem[]) {
  const token = await accessToken();
  const res = await fetch(`${base}/v1/payments/payouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": batchId },
    body: JSON.stringify({
      sender_batch_header: { sender_batch_id: batchId, email_subject: subject, email_message: "Sent with Routewell (PayPal sandbox)." },
      items: items.map((i) => ({
        recipient_type: "EMAIL",
        receiver: i.email,
        amount: { value: (i.cents / 100).toFixed(2), currency: "USD" },
        note: i.note,
        sender_item_id: i.envelopeId,
      })),
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    const detail = json?.details?.[0]?.issue ?? json?.name ?? res.status;
    throw new Error(`PayPal didn't accept the batch: ${json?.message ?? detail}`);
  }
  return { payoutBatchId: json.batch_header.payout_batch_id as string, status: json.batch_header.batch_status as string };
}

export type BatchItemStatus = {
  envelopeId: string;
  payoutItemId: string;
  status: string; // PayPal transaction_status
  errorName?: string;
  errorMessage?: string;
};

export async function getBatch(payoutBatchId: string) {
  const token = await accessToken();
  const res = await fetch(`${base}/v1/payments/payouts/${payoutBatchId}?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Couldn't read the batch from PayPal (${res.status}).`);
  const items: BatchItemStatus[] = (json.items ?? []).map((i: Record<string, any>) => ({
    envelopeId: i.payout_item?.sender_item_id,
    payoutItemId: i.payout_item_id,
    status: i.transaction_status,
    errorName: i.errors?.name,
    errorMessage: i.errors?.message,
  }));
  return { status: json.batch_header.batch_status as string, items };
}

/** Map PayPal's item status to an envelope status. */
export function envelopeStatusFor(paypalStatus: string): string {
  switch (paypalStatus) {
    case "SUCCESS":
      return "PAID";
    case "UNCLAIMED":
      return "UNCLAIMED";
    case "RETURNED":
    case "REFUNDED":
    case "REVERSED":
      return "RETURNED";
    case "FAILED":
    case "BLOCKED":
    case "DENIED":
      return "FAILED";
    default:
      return "PENDING"; // PENDING, ONHOLD, NEW, UNCLAIMED handled above
  }
}

/** Plain-words explanations of PayPal errors we have seen. */
export const PAYPAL_ERRORS: Record<string, string> = {
  RECEIVER_UNREGISTERED: "They don't have a PayPal account yet. PayPal emailed them a link to claim it; if they don't within 30 days, the money comes back.",
  SELF_PAY_NOT_ALLOWED: "This would pay the company's own PayPal account, which PayPal doesn't allow.",
  INSUFFICIENT_FUNDS: "The company's PayPal balance is too low for this batch.",
  RECEIVER_ACCOUNT_LOCKED: "Their PayPal account is locked, so PayPal couldn't pay it.",
  RECEIVER_COUNTRY_NOT_ALLOWED: "PayPal can't pay accounts in their country.",
};
