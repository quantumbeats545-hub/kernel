/**
 * $KERNEL Airdrop Script
 * Distributes tokens to community members
 * "Popcorn for everyone!"
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
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Example recipients (replace with actual addresses)
const AIRDROP_RECIPIENTS = [
  // { address: "recipient1pubkey", amount: 1000000 },
  // { address: "recipient2pubkey", amount: 500000 },
];

async function main() {
  console.log("===========================================");
  console.log("   $KERNEL Airdrop Distribution");
  console.log("   'Popcorn for the people!'");
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

  if (AIRDROP_RECIPIENTS.length === 0) {
    console.log("No recipients configured.");
    console.log("\nTo add recipients, edit scripts/airdrop/airdrop.ts");
    console.log("Add entries to AIRDROP_RECIPIENTS array:\n");
    console.log("const AIRDROP_RECIPIENTS = [");
    console.log('  { address: "recipientPubkey1", amount: 1000000 },');
    console.log('  { address: "recipientPubkey2", amount: 500000 },');
    console.log("];\n");
    return;
  }

  // Get source account
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

  const sourceBalance = Number(accountInfo.amount) / (10 ** decimals);
  console.log(`Source Balance: ${sourceBalance.toLocaleString()} KERNEL\n`);

  // Calculate total airdrop
  const totalAirdrop = AIRDROP_RECIPIENTS.reduce((sum, r) => sum + r.amount, 0);
  console.log(`Total to Airdrop: ${totalAirdrop.toLocaleString()} KERNEL`);
  console.log(`Recipients: ${AIRDROP_RECIPIENTS.length}\n`);

  if (totalAirdrop > sourceBalance) {
    console.log("Insufficient balance for airdrop.");
    process.exit(1);
  }

  console.log("Processing airdrops...\n");

  let successCount = 0;
  let failCount = 0;

  for (const recipient of AIRDROP_RECIPIENTS) {
    try {
      const recipientPubkey = new PublicKey(recipient.address);

      // Get or create recipient's token account
      const recipientAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        walletKeypair,
        mintPubkey,
        recipientPubkey,
        false,
        "confirmed",
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      // Transfer
      const amountRaw = BigInt(recipient.amount * (10 ** decimals));
      await transfer(
        connection,
        walletKeypair,
        sourceAccount.address,
        recipientAccount.address,
        walletKeypair,
        amountRaw,
        [],
        { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );

      console.log(`  Sent ${recipient.amount.toLocaleString()} KERNEL to ${recipient.address.slice(0, 8)}...`);
      successCount++;
    } catch (err) {
      console.log(`  Failed: ${recipient.address.slice(0, 8)}... - ${err}`);
      failCount++;
    }
  }

  console.log("\n===========================================");
  console.log("   AIRDROP COMPLETE!");
  console.log("   Colonel Kernel thanks you!");
  console.log("===========================================\n");

  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total Distributed: ${(successCount * (totalAirdrop / AIRDROP_RECIPIENTS.length)).toLocaleString()} KERNEL`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
