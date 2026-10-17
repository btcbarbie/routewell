import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

// Claude Opus 5.5 with structured outputs: every answer comes back in a fixed shape the app checks.
// Server-side fallbacks are on, so a declined request is retried on Anthropic's recommended fallback model.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: "https://api.anthropic.com" });
export const MODEL = "claude-opus-5-5";

export class AiError extends Error {}

type Effort = "low" | "medium" | "high";

async function structured<T extends z.ZodType>(
  schema: T,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  effort: Effort,
): Promise<z.infer<T>> {
  let res;
  try {
    res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError("The AI is busy right now. Try again in a minute.");
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("The AI key isn't working. Check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.APIError) throw new AiError(`The AI couldn't answer (${e.status}). Try again.`);
    throw e;
  }
  if (res.stop_reason === "refusal") throw new AiError("The AI declined to read this.");
  if (!res.parsed_output) throw new AiError("The AI's answer couldn't be read. Try again.");
  return res.parsed_output as z.infer<T>;
}

const VOICE = `Write notes like a careful bookkeeper's pencil notes in the margin: plain words, no jargon, no exclamation marks.
Keep every note under 25 words and every issue under 20 words. Say what you checked and what you found.
Never invent facts, rates, dates or amounts that aren't in the input. If something is unclear, flag it rather than guessing.`;

// ---------- Intake: messages and spreadsheets -> pay envelopes ----------

export const IntakeResult = z.object({
  summary: z.string().describe("One short sentence about what you read and anything the owner should know (like who is paid automatically). Don't count envelopes; the app adds the counts."),
  envelopes: z.array(
    z.object({
      workerId: z.string().nullable().describe("The id of the matching person from the list, or null if no one matches."),
      nameAsWritten: z.string(),
      kind: z.enum(["WORK", "BONUS"]),
      amountUsd: z.number().describe("Amount to pay in US dollars."),
      description: z.string().describe("Short, e.g. '36 hours of design production'."),
      calculation: z.string().nullable().describe("e.g. '36 hours × $25'. Null if there's no calculation."),
      sourceQuote: z.string().describe("The exact words or sheet row this came from."),
      issues: z.array(z.string()).describe("Problems the owner should look at. Empty if none."),
      note: z.string().describe("Your margin note for this envelope, one or two short sentences."),
    }),
  ),
  notUnderstood: z.array(z.string()).describe("Only things in the input you couldn't understand or act on. Not people you skipped on purpose (those go in the summary). Usually empty."),
});
export type IntakeResult = z.infer<typeof IntakeResult>;

export async function readIntake(input: {
  today: string;
  messageText: string;
  sheets: { fileName: string; text: string }[];
  people: unknown;
  lastPaid: unknown;
  schedules: unknown;
}): Promise<IntakeResult> {
  const system = `You help a small business owner prepare this month's payments to contractors.
You read their messages and spreadsheets and turn them into one pay envelope per person per item of work.

Rules:
- Only use rates you can see in the person's rate note or in the input. Work out amounts from hours × rate or items × price.
- If two sources disagree (for example a message says 38 hours and the sheet says 36), use the sheet's number for the amount and add an issue that says exactly what disagrees.
- Compare with what each person was paid last month. If an amount is much higher than usual, add an issue.
- Flag anyone who isn't on the people list.
- Someone on a schedule (like a monthly retainer) is paid automatically on their payday. Don't make an envelope for that; mention it in the summary instead.
- "Pay everyone" or "the usual" means one envelope per person who has a usual amount, for that amount, unless the owner says otherwise. Skip people on a schedule and people with no usual amount, and say who you skipped in the summary.
- A usual amount that equals what the person was paid last month is fine. Don't flag it, and don't re-derive hours from it.
- Expenses with receipts are handled separately. If a message mentions a receipt, don't make an envelope for it.
- Never make up a payment that isn't asked for.
${VOICE}`;

  const sheetText = input.sheets.length
    ? input.sheets.map((s) => `--- Spreadsheet: ${s.fileName} ---\n${s.text}`).join("\n\n")
    : "(no spreadsheets)";

  const text = `Today is ${input.today}.

People (with ids):
${JSON.stringify(input.people, null, 2)}

Paid last month:
${JSON.stringify(input.lastPaid, null, 2)}

Scheduled payments:
${JSON.stringify(input.schedules, null, 2)}

--- Messages from the owner ---
${input.messageText || "(none)"}

${sheetText}`;

  return structured(IntakeResult, system, [{ type: "text", text }], "medium");
}

// ---------- Receipts: photo -> expense envelope ----------

export const ReceiptResult = z.object({
  vendor: z.string().nullable(),
  date: z.string().nullable().describe("YYYY-MM-DD, or null if you can't read it."),
  totalUsd: z.number().nullable().describe("The receipt total in US dollars, or null if it isn't in dollars or can't be read."),
  currency: z.string().nullable(),
  category: z.string().describe("e.g. Taxi, Meal, Equipment, Travel, Other."),
  nameOnReceipt: z.string().nullable().describe("A person's name printed on the receipt, if any."),
  lineItems: z.array(z.object({ text: z.string(), amountUsd: z.number().nullable() })),
  allowedUsd: z.number().nullable().describe("How much the company rules allow to pay back. Equal to the total if nothing breaks a rule. Null if you can't tell."),
  working: z.string().nullable().describe("If allowedUsd differs from the total, one short line showing how, e.g. 'Wine $24 removed with its share of tax and tip'. Otherwise null."),
  issues: z.array(z.string()).describe("Each rule this receipt breaks or anything unclear, in plain words. Empty if none."),
  note: z.string().describe("Your margin note: what the receipt is and what you checked."),
});
export type ReceiptResult = z.infer<typeof ReceiptResult>;

export async function readReceipt(input: {
  today: string;
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  rules: string[];
  forPerson: string | null;
}): Promise<ReceiptResult> {
  const system = `You check staff expense receipts for a small business before they're paid back.
Read the receipt photo, then check it against the company's spending rules.
- If something isn't allowed (for example alcohol), work out what can be paid back without it. Split tax and tip in proportion when you remove an item, and show your working in the note.
- If the receipt is older than a rule allows, say so.
- Never guess numbers you can't read.
${VOICE}`;
  const text = `Today is ${input.today}.
${input.forPerson ? `This receipt was sent in by ${input.forPerson}.` : ""}
Company spending rules:
${input.rules.map((r) => `- ${r}`).join("\n")}`;
  return structured(
    ReceiptResult,
    system,
    [
      { type: "image", source: { type: "base64", media_type: input.mimeType, data: input.imageBase64 } },
      { type: "text", text },
    ],
    "medium",
  );
}

// ---------- Ask bar: plain-English instructions -> proposed actions ----------

export const AskResult = z.object({
  reply: z.string().describe("One or two short sentences to the owner saying what you'll do, or why you can't."),
  actions: z.array(
    z.object({
      type: z.enum(["SET_AMOUNT", "ADD_PAYMENT", "REMOVE_ENVELOPE", "SET_METHOD", "CREATE_SCHEDULE", "PAUSE_SCHEDULE", "RESUME_SCHEDULE"]),
      envelopeId: z.string().nullable(),
      workerId: z.string().nullable(),
      scheduleId: z.string().nullable(),
      amountUsd: z.number().nullable(),
      dayOfMonth: z.number().nullable(),
      method: z.enum(["PAYPAL", "PYUSD"]).nullable(),
      description: z.string().nullable().describe("For ADD_PAYMENT and CREATE_SCHEDULE: what it's for, e.g. 'Bonus for the launch'."),
      label: z.string().describe("One short line describing this action for the owner to approve."),
    }),
  ),
});
export type AskResult = z.infer<typeof AskResult>;

export async function interpretAsk(input: { today: string; instruction: string; context: unknown }): Promise<AskResult> {
  const system = `You help a small business owner adjust this month's payments and their scheduled paydays.
Turn their instruction into actions from the allowed list. The owner approves every action before it happens.
- Use ids from the context exactly. Never invent an id.
- ADD_PAYMENT needs workerId, amountUsd and description. CREATE_SCHEDULE needs workerId, amountUsd, dayOfMonth (1-28) and description.
- If the instruction is unclear or asks for something not in the list, return no actions and say what you need.
${VOICE}`;
  const text = `Today is ${input.today}.
Context:
${JSON.stringify(input.context, null, 2)}

Owner's instruction: ${input.instruction}`;
  return structured(AskResult, system, [{ type: "text", text }], "low");
}

// ---------- Summaries after paying ----------

export const SummaryResult = z.object({ summary: z.string() });

export async function summarizeResults(input: { results: unknown; context: string }): Promise<string> {
  const system = `Write a short summary (at most two sentences, under 45 words) for a business owner of what happened to a batch of payments.
Say who was paid and who wasn't and why, and what the owner can do next. Use the error explanations given.
This app runs on PayPal's sandbox and Solana devnet with test money on purpose; don't mention that. ${VOICE}`;
  const out = await structured(
    SummaryResult,
    system,
    [{ type: "text", text: `${input.context}\n\nResults:\n${JSON.stringify(input.results, null, 2)}` }],
    "low",
  );
  return out.summary;
}

// ---------- Scheduled paydays: explain the code's checks in plain words ----------

export const PaydayNotes = z.object({
  notes: z.array(z.object({ scheduleId: z.string(), note: z.string() })),
  summary: z.string().describe("One sentence for the owner: what this payday will do."),
});

export async function explainPayday(input: { date: string; budget: string; items: unknown }): Promise<z.infer<typeof PaydayNotes>> {
  const system = `It's a scheduled payday for a small business. Code has already checked each scheduled payment (approved amount, budget, payout details).
Write one short margin note per payment explaining what was checked and the result, and a one-sentence summary.
Only report the checks you're given. Don't change any decision. ${VOICE}`;
  const text = `Payday date: ${input.date}. Monthly payday budget: ${input.budget}.
Payments and the code's checks:
${JSON.stringify(input.items, null, 2)}`;
  return structured(PaydayNotes, system, [{ type: "text", text }], "low");
}

// ---------- Review: check envelopes the owner made directly (usual amounts or one by one) ----------

export const ReviewResult = z.object({
  reviews: z.array(
    z.object({
      envelopeId: z.string(),
      note: z.string().describe("Your margin note: what you compared it with and what you found."),
      issues: z.array(z.string()).describe("Problems the owner should look at. Empty if none."),
    }),
  ),
});

export async function reviewEnvelopes(input: { today: string; toCheck: unknown; alsoInThisPayRun: unknown }): Promise<z.infer<typeof ReviewResult>> {
  const system = `A small business owner added these payments directly. Check each one before any money moves.
Compare it with the person's usual amount, their rate, and what they were paid last month. Flag an amount that's very different from usual,
a second payment for the same person and reason already in this pay run, or anything that doesn't add up. An amount that matches the usual is fine.
Give one review per envelope, using its envelopeId exactly. ${VOICE}`;
  const text = `Today is ${input.today}.
Payments to check:
${JSON.stringify(input.toCheck, null, 2)}

Already in this pay run:
${JSON.stringify(input.alsoInThisPayRun, null, 2)}`;
  return structured(ReviewResult, system, [{ type: "text", text }], "low");
}
