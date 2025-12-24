/**
 * $KERNEL Token Burn Script
 * Burns tokens for deflation
 * "Sacrificing kernels to the crypto gods!"
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  burn,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: yarn token:burn <amount>");
    console.log("Example: yarn token:burn 1000000");
    process.exit(1);
  }

  const burnAmount = parseFloat(args[0]);
  if (isNaN(burnAmount) || burnAmount <= 0) {
    console.log("Invalid amount. Please provide a positive number.");
    process.exit(1);
  }

  console.log("===========================================");
  console.log("   $KERNEL Token Burn");
  console.log("   'Into the fire they go!'");
  console.log("===========================================\n");

  // Load wallet
  const walletPath = process.env.WALLET_PATH ||
    `${process.env.HOME}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  // Load mint info
  const mintInfoPath = path.join(__dirname, "../../.kernel-mint.json");
  if (!fs.existsSync(mintInfoPath)) {
    console.log("Mint not found. Run 'yarn token:create' first.");
    process.exit(1);
  }

  const mintInfo = JSON.parse(fs.readFileSync(mintInfoPath, "utf-8"));
  const mintPubkey = new PublicKey(mintInfo.mint);
  const decimals = mintInfo.decimals;

  // Connect
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log(`Burner: ${walletKeypair.publicKey.toBase58()}`);
  console.log(`Mint: ${mintPubkey.toBase58()}\n`);

  // Get token account
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    mintPubkey,
    walletKeypair.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // Get current balance
  const accountInfo = await getAccount(
    connection,
    tokenAccount.address,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );

  const currentBalance = Number(accountInfo.amount) / (10 ** decimals);
  console.log(`Token Account: ${tokenAccount.address.toBase58()}`);
  console.log(`Current Balance: ${currentBalance.toLocaleString()} KERNEL\n`);

  const burnAmountRaw = BigInt(Math.floor(burnAmount * (10 ** decimals)));

  if (burnAmountRaw > accountInfo.amount) {
    console.log("Insufficient balance for burn.");
    process.exit(1);
  }

  console.log(`Burning: ${burnAmount.toLocaleString()} KERNEL\n`);

  // Burn tokens
  const signature = await burn(
    connection,
    walletKeypair,
    tokenAccount.address,
    mintPubkey,
    walletKeypair,
    burnAmountRaw,
    [],
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID
  );

  const newBalance = currentBalance - burnAmount;

  console.log("===========================================");
  console.log("   $KERNEL BURNED SUCCESSFULLY!");
  console.log("   Colonel Kernel salutes your sacrifice!");
  console.log("===========================================\n");

  console.log(`Transaction: ${signature}`);
  console.log(`Burned: ${burnAmount.toLocaleString()} KERNEL`);
  console.log(`New Balance: ${newBalance.toLocaleString()} KERNEL\n`);

  console.log("View on Explorer:");
  console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
