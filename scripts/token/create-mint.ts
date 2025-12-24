/**
 * $KERNEL Token Creation Script
 * Creates SPL Token-2022 with 5% Transfer Fee
 * "No kernel panics here!"
 */

import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// === CONFIG ===
const DECIMALS = 9;
const FEE_BASIS_POINTS = 500; // 5%
const MAX_FEE = BigInt(Number.MAX_SAFE_INTEGER); // Unlimited

async function main() {
  console.log("===========================================");
  console.log("   $KERNEL Token Creation");
  console.log("   Token-2022 with 5% Transfer Fee");
  console.log("   'The Core of Crypto Security!'");
  console.log("===========================================\n");

  // Load wallet
  const walletPath = process.env.WALLET_PATH ||
    `${process.env.HOME}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  // Connect to devnet
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log(`Wallet: ${walletKeypair.publicKey.toBase58()}`);
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.log("Insufficient balance. Request airdrop with: solana airdrop 2");
    process.exit(1);
  }

  // Generate mint keypair
  const mintKeypair = Keypair.generate();
  console.log(`Mint Address: ${mintKeypair.publicKey.toBase58()}\n`);

  // Calculate space needed
  const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

  console.log(`Mint account size: ${mintLen} bytes`);
  console.log(`Rent: ${mintRent / LAMPORTS_PER_SOL} SOL\n`);

  // Build transaction
  const transaction = new Transaction().add(
    // Create account
    SystemProgram.createAccount({
      fromPubkey: walletKeypair.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports: mintRent,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    // Initialize transfer fee config
    createInitializeTransferFeeConfigInstruction(
      mintKeypair.publicKey,
      walletKeypair.publicKey, // Fee config authority
      walletKeypair.publicKey, // Withdraw withheld authority
      FEE_BASIS_POINTS,
      MAX_FEE,
      TOKEN_2022_PROGRAM_ID
    ),
    // Initialize mint
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      walletKeypair.publicKey, // Mint authority
      walletKeypair.publicKey, // Freeze authority
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log("Creating $KERNEL mint...\n");

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [walletKeypair, mintKeypair],
    { commitment: "confirmed" }
  );

  console.log("===========================================");
  console.log("   $KERNEL MINT CREATED SUCCESSFULLY!");
  console.log("   Colonel Kernel approves!");
  console.log("===========================================\n");

  console.log(`Mint Address: ${mintKeypair.publicKey.toBase58()}`);
  console.log(`Transaction: ${signature}\n`);

  console.log(`Transfer Fee: 5%`);
  console.log(`Decimals: ${DECIMALS}\n`);

  console.log("View on Solana Explorer:");
  console.log(
    `https://explorer.solana.com/address/${mintKeypair.publicKey.toBase58()}?cluster=devnet\n`
  );

  // Save mint info
  const mintInfo = {
    mint: mintKeypair.publicKey.toBase58(),
    mintSecretKey: Array.from(mintKeypair.secretKey),
    decimals: DECIMALS,
    feeBasisPoints: FEE_BASIS_POINTS,
    createdAt: new Date().toISOString(),
    network: "devnet",
  };

  const savePath = path.join(__dirname, "../../.kernel-mint.json");
  fs.writeFileSync(savePath, JSON.stringify(mintInfo, null, 2));
  console.log(`Mint info saved to: ${savePath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
