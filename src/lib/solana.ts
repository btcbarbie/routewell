import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  transferChecked,
} from "@solana/spl-token";
import bs58 from "bs58";
import { centsToPyusdUnits } from "./money";

// PYUSD payouts on Solana devnet (test network, test coins) from the company's own test wallet.
// This runs from our wallet, not through PayPal.

const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PYUSD_DECIMALS = 6;

function setup() {
  if (!rpc.includes("devnet")) throw new Error("Routewell only sends PYUSD on Solana devnet.");
  if (!process.env.TREASURY_SECRET_KEY || !process.env.PYUSD_MINT) throw new Error("The company's test PYUSD wallet isn't set up in .env.");
  return {
    connection: new Connection(rpc, "confirmed"),
    treasury: Keypair.fromSecretKey(bs58.decode(process.env.TREASURY_SECRET_KEY)),
    mint: new PublicKey(process.env.PYUSD_MINT),
  };
}

export function isValidAddress(address: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(address).toBytes());
  } catch {
    return false;
  }
}

export async function treasuryBalance(): Promise<{ address: string; pyusdCents: number; sol: number }> {
  const { connection, treasury, mint } = setup();
  const ata = getAssociatedTokenAddressSync(mint, treasury.publicKey, false, TOKEN_2022_PROGRAM_ID);
  let units = 0;
  try {
    units = Number((await connection.getTokenAccountBalance(ata)).value.amount);
  } catch {
    units = 0;
  }
  const lamports = await connection.getBalance(treasury.publicKey);
  return { address: treasury.publicKey.toBase58(), pyusdCents: Math.floor(units / 10_000), sol: lamports / LAMPORTS_PER_SOL };
}

export async function sendPyusd(to: string, cents: number): Promise<string> {
  const { connection, treasury, mint } = setup();
  const recipient = new PublicKey(to);
  const from = getAssociatedTokenAddressSync(mint, treasury.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const dest = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, recipient, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID);
  return transferChecked(connection, treasury, from, mint, dest.address, treasury, centsToPyusdUnits(cents), PYUSD_DECIMALS, [], undefined, TOKEN_2022_PROGRAM_ID);
}

export function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
