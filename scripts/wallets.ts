// Creates two Solana devnet test wallets (a company treasury and a test worker) and saves them to .env.
// Devnet coins have no value. Run with: npm run wallets
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const envPath = ".env";
if (!existsSync(envPath)) throw new Error("Create .env first: cp .env.example .env");

function setEnv(key: string, value: string) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(envPath, lines.join("\n"));
}

async function main() {
  let treasury: Keypair;
  if (process.env.TREASURY_SECRET_KEY) {
    treasury = Keypair.fromSecretKey(bs58.decode(process.env.TREASURY_SECRET_KEY));
    console.log("Treasury wallet already exists.");
  } else {
    treasury = Keypair.generate();
    setEnv("TREASURY_SECRET_KEY", bs58.encode(treasury.secretKey));
    console.log("Created treasury wallet.");
  }

  let worker = process.env.TEST_WORKER_ADDRESS;
  if (!worker) {
    worker = Keypair.generate().publicKey.toBase58();
    setEnv("TEST_WORKER_ADDRESS", worker);
    console.log("Created test worker wallet.");
  }

  console.log(`\nTreasury address: ${treasury.publicKey.toBase58()}`);
  console.log(`Test worker address: ${worker}\n`);

  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  try {
    const sig = await connection.requestAirdrop(treasury.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("Got 1 devnet SOL for network fees.");
  } catch (e) {
    console.log(`Devnet SOL airdrop didn't work (${(e as Error).message.split("\n")[0]}).`);
    console.log("Get some at https://faucet.solana.com using the treasury address above.");
  }
  const sol = await connection.getBalance(treasury.publicKey);
  console.log(`Treasury SOL balance: ${sol / LAMPORTS_PER_SOL}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
