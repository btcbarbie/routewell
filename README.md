# Routewell

**Everyone gets paid.**

Routewell helps small teams pay contractors and pay back staff expenses, wherever they live. Drop in this month's messages, spreadsheets and receipts. An AI turns them into one pay envelope per person and checks each one. You approve, and everyone is paid in one go: through PayPal, or in PYUSD to their own wallet when PayPal can't reach them.

> Work in progress for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Everything runs on PayPal's sandbox and Solana devnet, with test money only.

## Status

- [x] Proof: PayPal sandbox batch payout (`npm run proof:payouts`). PayPal processes the batch and reports a result per person, including unclaimed payouts for people without a PayPal account.
- [x] Proof: test PYUSD transfer on Solana devnet (`npm run proof:pyusd`). Sends 1 test PYUSD from the company's test wallet to a worker's test wallet. This part runs on Solana devnet from our own wallet, not through PayPal.

Test PYUSD for Solana devnet comes from the [Google Cloud Web3 faucet](https://cloud.google.com/application/web3/faucet) or [Paxos faucet](https://faucet.paxos.com). Devnet SOL for network fees comes from [faucet.solana.com](https://faucet.solana.com).

## Run it locally

```bash
npm install
cp .env.example .env   # then fill in your own sandbox values
npm run dev
```

## Licence

[MIT](LICENSE)
