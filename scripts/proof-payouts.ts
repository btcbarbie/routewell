// Proof: send a small batch payout through PayPal's sandbox and read back the real result.
// Run with: npm run proof:payouts
import "dotenv/config";

const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
const receiver = process.env.PAYPAL_TEST_RECEIVER_EMAIL;

if (!base.includes("sandbox")) throw new Error("Refusing to run outside the PayPal sandbox.");
if (!clientId || !secret || !receiver) {
  throw new Error("Fill in PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_TEST_RECEIVER_EMAIL in .env first.");
}

async function token() {
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal sign-in failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const access = await token();
  const auth = { Authorization: `Bearer ${access}`, "Content-Type": "application/json" };

  // Two envelopes: one to a real sandbox account, one to an email with no PayPal account,
  // so we can see both a paid and an unclaimed result.
  const batchId = `routewell-proof-${Date.now()}`;
  const body = {
    sender_batch_header: {
      sender_batch_id: batchId,
      email_subject: "You've been paid (Routewell sandbox test)",
      email_message: "Test payout from Routewell on PayPal's sandbox.",
    },
    items: [
      {
        recipient_type: "EMAIL",
        receiver,
        amount: { value: "12.50", currency: "USD" },
        note: "Proof envelope 1",
        sender_item_id: `${batchId}-1`,
      },
      {
        recipient_type: "EMAIL",
        receiver: `nobody-${Date.now()}@example.com`,
        amount: { value: "3.00", currency: "USD" },
        note: "Proof envelope 2 (no PayPal account)",
        sender_item_id: `${batchId}-2`,
      },
    ],
  };

  const created = await fetch(`${base}/v1/payments/payouts`, { method: "POST", headers: auth, body: JSON.stringify(body) });
  const createdJson = await created.json();
  if (!created.ok) throw new Error(`Payout failed: ${created.status} ${JSON.stringify(createdJson, null, 2)}`);

  const payoutBatchId = createdJson.batch_header.payout_batch_id as string;
  console.log(`Batch sent. PayPal batch id: ${payoutBatchId} (status ${createdJson.batch_header.batch_status})`);

  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const res = await fetch(`${base}/v1/payments/payouts/${payoutBatchId}`, { headers: auth });
    const json = await res.json();
    const status = json.batch_header.batch_status as string;
    console.log(`Batch status: ${status}`);
    if (!["PENDING", "PROCESSING"].includes(status)) {
      for (const item of json.items ?? []) {
        const why = item.errors ? ` (${item.errors.name}: ${item.errors.message})` : "";
        console.log(`  ${item.payout_item.receiver}: ${item.transaction_status} $${item.payout_item.amount.value}${why}`);
      }
      return;
    }
  }
  console.log("Still processing after a minute. Run again later to check.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
