// Proof: send 1 test PYUSD from the treasury wallet to the test worker on Solana devnet.
// Run with: npm run proof:pyusd
import "dotenv/config";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  getMint,
  transferChecked,
} from "@solana/spl-token";
import bs58 from "bs58";

const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
if (!rpc.includes("devnet")) throw new Error("Refusing to run outside Solana devnet.");
if (!process.env.TREASURY_SECRET_KEY || !process.env.TEST_WORKER_ADDRESS || !process.env.PYUSD_MINT) {
  throw new Error("Run `npm run wallets` first, and make sure PYUSD_MINT is set in .env.");
}

const connection = new Connection(rpc, "confirmed");
const treasury = Keypair.fromSecretKey(bs58.decode(process.env.TREASURY_SECRET_KEY));
const worker = new PublicKey(process.env.TEST_WORKER_ADDRESS);
const mint = new PublicKey(process.env.PYUSD_MINT);

async function pyusdBalance(owner: PublicKey) {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
  try {
    const bal = await connection.getTokenAccountBalance(ata);
    return bal.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

async function main() {
  const sol = (await connection.getBalance(treasury.publicKey)) / LAMPORTS_PER_SOL;
  const before = await pyusdBalance(treasury.publicKey);
  console.log(`Treasury ${treasury.publicKey.toBase58()}: ${sol} SOL, ${before} PYUSD`);
  if (sol < 0.01) throw new Error("Treasury needs a little devnet SOL for fees (faucet.solana.com).");
  if (before < 1) throw new Error("Treasury needs test PYUSD (faucet.paxos.com, Solana devnet).");

  const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  const from = getAssociatedTokenAddressSync(mint, treasury.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const to = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, worker, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID);

  const amount = BigInt(10 ** mintInfo.decimals);
  const sig = await transferChecked(connection, treasury, from, mint, to.address, treasury, amount, mintInfo.decimals, [], undefined, TOKEN_2022_PROGRAM_ID);

  console.log(`Sent 1 PYUSD to ${worker.toBase58()}`);
  console.log(`Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  console.log(`Worker now holds ${await pyusdBalance(worker)} PYUSD`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
