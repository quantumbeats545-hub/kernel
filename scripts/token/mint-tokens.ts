/**
 * $KERNEL Token Minting Script
 * Mints initial supply: 69,420,000,000 KERNEL
 * "Popping kernels into existence!"
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// === CONFIG ===
const TOTAL_SUPPLY = 69_420_000_000; // 69.42 billion
const DECIMALS = 9;

async function main() {
  console.log("===========================================");
  console.log("   $KERNEL Token Minting");
  console.log("   Total Supply: 69,420,000,000 KERNEL");
  console.log("   'Popping fresh kernels!'");
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
  const mintKeypair = Keypair.fromSecretKey(
    Uint8Array.from(mintInfo.mintSecretKey)
  );

  // Connect
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log(`Wallet: ${walletKeypair.publicKey.toBase58()}`);
  console.log(`Mint: ${mintKeypair.publicKey.toBase58()}\n`);

  // Create/get token account
  console.log("Getting token account...");
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    mintKeypair.publicKey,
    walletKeypair.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(`Token Account: ${tokenAccount.address.toBase58()}\n`);

  // Mint tokens
  const mintAmount = BigInt(TOTAL_SUPPLY) * BigInt(10 ** DECIMALS);
  console.log(`Minting ${TOTAL_SUPPLY.toLocaleString()} $KERNEL...\n`);

  const signature = await mintTo(
    connection,
    walletKeypair,
    mintKeypair.publicKey,
    tokenAccount.address,
    walletKeypair,
    mintAmount,
    [],
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID
  );

  console.log("===========================================");
  console.log("   $KERNEL MINTED SUCCESSFULLY!");
  console.log("   The popcorn machine is running!");
  console.log("===========================================\n");

  console.log(`Transaction: ${signature}\n`);
  console.log(`Total Minted: ${TOTAL_SUPPLY.toLocaleString()} KERNEL\n`);

  console.log("Distribution Plan:");
  console.log(`  - Liquidity (50%):     ${(TOTAL_SUPPLY * 0.5).toLocaleString()} KERNEL`);
  console.log(`  - Airdrops (20%):      ${(TOTAL_SUPPLY * 0.2).toLocaleString()} KERNEL`);
  console.log(`  - Marketing/Dev (15%): ${(TOTAL_SUPPLY * 0.15).toLocaleString()} KERNEL`);
  console.log(`  - Initial Burn (10%):  ${(TOTAL_SUPPLY * 0.1).toLocaleString()} KERNEL`);
  console.log(`  - Team (5%):           ${(TOTAL_SUPPLY * 0.05).toLocaleString()} KERNEL\n`);

  console.log("Note: All tokens minted to dev wallet for devnet testing.");
  console.log("In production, distribute to separate wallets.\n");

  console.log("View on Explorer:");
  console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
