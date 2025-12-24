/**
 * $KERNEL Token Distribution Script
 * Distributes tokens according to tokenomics
 *
 * Distribution:
 *   50% -> Liquidity Pool
 *   20% -> Airdrops
 *   15% -> Marketing/Dev
 *   10% -> Initial Burn
 *   5%  -> Team (vested)
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  transfer,
  burn,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Distribution wallets (replace with actual addresses in production)
const DISTRIBUTION = {
  liquidity: { share: 0.50, address: null }, // 50%
  airdrops: { share: 0.20, address: null },  // 20%
  marketing: { share: 0.15, address: null }, // 15%
  burn: { share: 0.10, address: null },      // 10% (burn address)
  team: { share: 0.05, address: null },      // 5%
};

async function main() {
  console.log("===========================================");
  console.log("   $KERNEL Token Distribution");
  console.log("   'Spreading the kernel love!'");
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

  console.log(`Distributor: ${walletKeypair.publicKey.toBase58()}`);
  console.log(`Mint: ${mintPubkey.toBase58()}\n`);

  // Get source token account
  const sourceAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    mintPubkey,
    walletKeypair.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  const accountInfo = await getAccount(
    connection,
    sourceAccount.address,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );

  const totalBalance = Number(accountInfo.amount) / (10 ** decimals);
  console.log(`Total Balance: ${totalBalance.toLocaleString()} KERNEL\n`);

  console.log("Distribution Plan:");
  console.log("==================");

  for (const [name, config] of Object.entries(DISTRIBUTION)) {
    const amount = totalBalance * config.share;
    const percentage = config.share * 100;
    console.log(`  ${name.padEnd(12)} ${percentage.toFixed(0)}%  ${amount.toLocaleString()} KERNEL`);
  }

  console.log("\n[DEVNET MODE]");
  console.log("In production, this script would:");
  console.log("  1. Transfer 50% to Liquidity wallet");
  console.log("  2. Transfer 20% to Airdrop pool wallet");
  console.log("  3. Transfer 15% to Marketing/Dev wallet");
  console.log("  4. Burn 10% (send to burn address)");
  console.log("  5. Transfer 5% to Team vesting wallet");
  console.log("\nTo execute distribution, update wallet addresses in script.");

  // For devnet testing, just show what would happen
  console.log("\n===========================================");
  console.log("   Distribution Preview Complete");
  console.log("   No tokens moved (devnet test mode)");
  console.log("===========================================");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
