# Routewell

**Everyone gets paid.**

**Live demo:** https://routewell-production.up.railway.app (PayPal sandbox and Solana devnet, test money only)

Routewell helps small teams pay contractors and pay back staff expenses, wherever they live. Drop in this month's messages, spreadsheets and receipt photos. An AI turns them into one pay envelope per person and checks each one. You approve, and everyone is paid in one go: through PayPal, or in PYUSD to their own wallet when PayPal can't reach them.

> Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Everything runs on PayPal's sandbox and Solana devnet, with test money only.

## Why

For nearly 20 years, freelancers in Nigeria could send money with PayPal but not receive it. In Pakistan, PayPal still doesn't operate. In India, PayPal converts every payment to rupees. Small teams paying people in these places end up with spreadsheets, wire fees, and workers who don't get paid on time. Routewell gives each person the payout route that works where they live, and catches mistakes before money moves.

## What it does

The homepage explains Routewell and offers two doors: **see the demo company** (Brightside Studio, already set up with 6 people in 5 countries) or **start your own** (name your company, add the people you pay, and pay them).

- **Four ways to start this month's pay.** Pay everyone their usual amount in one click, tell the AI in plain words ("Pay everyone for October. Add a $50 bonus for Maria."), add envelopes one by one, or drop in a spreadsheet (.csv or .xlsx) and receipt photos. Every way ends with Claude checking each envelope against the person's usual amount, rate and last month's pay.
- **An AI note on every envelope.** Each envelope says what was checked: rates, last month's pay, the sheet against the messages. Anything off is stamped **LOOK AGAIN** and explained, like hours that don't match, a receipt that was already paid back, or wine on a meal receipt when the rules say no alcohol.
- **Receipts checked against your expense rules.** Expense rules say what you pay back when staff spend their own money on work, in plain sentences with worked examples ("Meals with clients: we pay back up to $50 per person. Alcohol isn't paid back."). Claude reads the receipt photo, applies the rules, and works out what can be paid back. Code also checks for the exact same receipt being sent twice.
- **You decide.** Pay anyway, change the amount, or take an envelope out. Review everything as envelopes or as an AG Grid table you can sort, filter and edit.
- **Seal and send.** PayPal envelopes go out in one PayPal Payouts batch. PYUSD envelopes are sent to each worker's own wallet on Solana devnet. Routewell then shows what PayPal reports for each person: paid, not claimed yet, or failed, with the reason in plain words.
- **Countries.** Each person sees only the payout options that work in their country, from a hand-checked list with sources (for example: PayPal isn't available in Pakistan, so PYUSD is offered). Each worker gets a private link to choose PayPal or PYUSD themselves.
- **Scheduled paydays.** "Pay Jordan $1,500 every 28th" goes on a Bryntum calendar. On the day, code checks the approved amount, the monthly payday budget and the payout details, the AI explains the checks, and Routewell pays. Anything off is held back. Drag a payday on the calendar to move it. One switch pauses all of them.
- **Ask in plain English.** "Add a $50 bonus for Maria" or "Pay Ali $30 on the 15th of every month". The AI proposes the change; nothing happens until you click Do it.

## What the AI does and doesn't do

The AI (Claude Opus 5.5, through the Anthropic API with structured outputs) reads messages, sheets and receipt photos, writes the notes, flags problems, and turns plain-English requests into proposed changes. It never moves money by itself. Code enforces the rules: only owner-approved amounts are paid, scheduled paydays never exceed the budget, payout details are validated, and the country options come from a fixed, sourced list rather than the AI. Requests use Anthropic's server-side fallback, so a declined request is retried on Anthropic's recommended fallback model.

## Honest notes

- **PayPal:** payouts use the PayPal Payouts API in the sandbox. All PayPal workers in the demo receive at one sandbox personal account, because sandbox payouts have to go to sandbox accounts.
- **PYUSD:** transfers are sent from Routewell's own test wallet on Solana devnet, not through PayPal. Test PYUSD comes from the [Google Cloud Web3 faucet](https://cloud.google.com/application/web3/faucet) or the [Paxos faucet](https://faucet.paxos.com).
- **Not payroll:** Routewell doesn't calculate or file taxes, so it isn't for salaried staff wages. Staff expense reimbursements are supported.
- **Demo control:** scheduled paydays run on their date. The Paydays tab has a clearly labelled "Pretend it's this day" control so you can see one now.
- **Each visitor gets their own copy of the demo studio**, so you can try everything without affecting anyone else. "Start the demo over" gives you a fresh copy. A company you set up yourself is kept separately, and you can switch between the two.
- **Your own company** can add people in the five countries Routewell has checked facts for so far (US, Nigeria, Pakistan, India, Philippines). PayPal payouts only arrive at PayPal sandbox accounts in this test version.

## Built with

- **PayPal:** Payouts API (sandbox), batch status, per-item error reasons
- **AI:** Claude Opus 5.5 via the Anthropic TypeScript SDK (structured outputs, vision for receipts)
- **PYUSD:** Solana devnet, Token-2022, `@solana/web3.js` and `@solana/spl-token`
- **AG Grid:** the review table and payment history
- **Bryntum Calendar:** scheduled paydays, drag to reschedule (trial package)
- Next.js 16, React 19, Tailwind CSS 4, Prisma 7 with SQLite

## Run it locally

You need Node.js 20+, a PayPal sandbox app with **Payouts** turned on, an Anthropic API key, and a little devnet SOL plus test PYUSD.

```bash
npm install
cp .env.example .env    # fill in your own sandbox values
npm run wallets         # creates a test company wallet and a test worker wallet, saved to .env
npx prisma db push      # creates the local database
npm run dev
```

Then send devnet SOL and test PYUSD to the company wallet address that `npm run wallets` prints.

Quick checks that the payment routes work:

```bash
npm run proof:payouts   # a small PayPal sandbox batch payout
npm run proof:pyusd     # 1 test PYUSD on Solana devnet
```

## Licence

[MIT](LICENSE)
