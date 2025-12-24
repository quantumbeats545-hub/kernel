/**
 * $KERNEL Fee Harvesting Script
 * Collects 5% transfer fees for distribution
 * "Harvesting the golden kernels!"
 *
 * Fee breakdown:
 *   2% -> Reflections pool
 *   2% -> Auto-LP
 *   1% -> Burn
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getTransferFeeConfig,
  getMint,
  getOrCreateAssociatedTokenAccount,
  harvestWithheldTokensToMint,
  withdrawWithheldTokensFromMint,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Fee distribution (in basis points of the 5% fee)
const REFLECTION_SHARE = 4000; // 40% of fees = 2% of transfer
const LP_SHARE = 4000;         // 40% of fees = 2% of transfer
const BURN_SHARE = 2000;       // 20% of fees = 1% of transfer

async function main() {
  console.log("===========================================");
  console.log("   $KERNEL Fee Harvesting");
  console.log("   Collecting Transfer Fees");
  console.log("   'Golden kernels for everyone!'");
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

  // Connect
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log(`Authority: ${walletKeypair.publicKey.toBase58()}`);
  console.log(`Mint: ${mintPubkey.toBase58()}\n`);

  // Get mint info with fee config
  const mintData = await getMint(
    connection,
    mintPubkey,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );

  const feeConfig = getTransferFeeConfig(mintData);
  if (!feeConfig) {
    console.log("No transfer fee config found on this mint.");
    process.exit(1);
  }

  console.log("Transfer Fee Config:");
  console.log(`  Fee: ${Number(feeConfig.newerTransferFee.transferFeeBasisPoints) / 100}%`);
  console.log(`  Withheld on Mint: ${feeConfig.withheldAmount} (raw)\n`);

  // Get destination account
  const destAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    mintPubkey,
    walletKeypair.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(`Fee Destination: ${destAccount.address.toBase58()}\n`);

  if (feeConfig.withheldAmount === BigInt(0)) {
    console.log("No fees to harvest. Transfer some tokens first!\n");
    console.log("Fee Distribution Plan (when harvested):");
    console.log("  - 40% -> Reflections Pool (2% of transfers)");
    console.log("  - 40% -> Auto-LP (2% of transfers)");
    console.log("  - 20% -> Burn (1% of transfers)");
    return;
  }

  // Withdraw withheld fees from mint
  console.log("Withdrawing withheld fees from mint...\n");

  const signature = await withdrawWithheldTokensFromMint(
    connection,
    walletKeypair,
    mintPubkey,
    destAccount.address,
    walletKeypair,
    [],
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID
  );

  const harvestedAmount = Number(feeConfig.withheldAmount) / (10 ** mintInfo.decimals);
  const reflectionAmount = harvestedAmount * (REFLECTION_SHARE / 10000);
  const lpAmount = harvestedAmount * (LP_SHARE / 10000);
  const burnAmount = harvestedAmount * (BURN_SHARE / 10000);

  console.log("===========================================");
  console.log("   FEES HARVESTED SUCCESSFULLY!");
  console.log("   Colonel Kernel's treasury grows!");
  console.log("===========================================\n");

  console.log(`Transaction: ${signature}\n`);
  console.log(`Total Harvested: ${harvestedAmount.toLocaleString()} KERNEL\n`);

  console.log("Distribution:");
  console.log(`  - Reflections: ${reflectionAmount.toLocaleString()} KERNEL (40%)`);
  console.log(`  - Auto-LP:     ${lpAmount.toLocaleString()} KERNEL (40%)`);
  console.log(`  - Burn:        ${burnAmount.toLocaleString()} KERNEL (20%)\n`);

  console.log("Note: Manual distribution required. Run separate scripts for:");
  console.log("  - yarn airdrop:reflections (distribute to stakers)");
  console.log("  - Auto-LP bot (swap to SOL, add liquidity)");
  console.log("  - yarn token:burn (burn portion)");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
