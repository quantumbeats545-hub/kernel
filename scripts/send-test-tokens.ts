/**
 * Send Test $KERNEL Tokens
 *
 * Usage: npx ts-node scripts/send-test-tokens.ts <wallet-address> [amount]
 *
 * Sends $KERNEL tokens from authority wallet to specified address for testing.
 * Default amount: 1,000,000 KERNEL
 */

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';

const KERNEL_MINT = new PublicKey('61haxRk7djifSYwso9Kzt9NtPB9oB9QwQyQZBoiv47Dk');
const DECIMALS = 6;
const DEFAULT_AMOUNT = 1_000_000; // 1 million KERNEL

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx ts-node scripts/send-test-tokens.ts <wallet-address> [amount]');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node scripts/send-test-tokens.ts ABC123...xyz');
    console.log('  npx ts-node scripts/send-test-tokens.ts ABC123...xyz 5000000');
    process.exit(1);
  }

  const recipientAddress = args[0];
  const amount = args[1] ? parseInt(args[1]) : DEFAULT_AMOUNT;

  // Validate recipient address
  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(recipientAddress);
  } catch {
    console.error('❌ Invalid wallet address:', recipientAddress);
    process.exit(1);
  }

  // Load authority wallet
  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log('='.repeat(60));
  console.log('$KERNEL Test Token Sender');
  console.log('='.repeat(60));
  console.log('From:', authority.publicKey.toBase58());
  console.log('To:', recipientPubkey.toBase58());
  console.log('Amount:', amount.toLocaleString(), '$KERNEL');
  console.log('');

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Get authority's token account
  const authorityAta = getAssociatedTokenAddressSync(
    KERNEL_MINT,
    authority.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  // Check authority balance
  try {
    const authorityAccount = await getAccount(connection, authorityAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
    const balance = Number(authorityAccount.amount) / 10 ** DECIMALS;
    console.log('Authority balance:', balance.toLocaleString(), '$KERNEL');

    if (balance < amount) {
      console.error('❌ Insufficient balance!');
      process.exit(1);
    }
  } catch {
    console.error('❌ Authority token account not found');
    process.exit(1);
  }

  // Get or create recipient's token account
  const recipientAta = getAssociatedTokenAddressSync(
    KERNEL_MINT,
    recipientPubkey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction();

  // Check if recipient ATA exists
  const recipientAccountInfo = await connection.getAccountInfo(recipientAta);
  if (!recipientAccountInfo) {
    console.log('📦 Creating recipient token account...');
    tx.add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        recipientAta,
        recipientPubkey,
        KERNEL_MINT,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  // Add transfer instruction
  const transferAmount = BigInt(amount) * BigInt(10 ** DECIMALS);
  tx.add(
    createTransferCheckedInstruction(
      authorityAta,
      KERNEL_MINT,
      recipientAta,
      authority.publicKey,
      transferAmount,
      DECIMALS,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log('💸 Sending tokens...');
  const sig = await sendAndConfirmTransaction(connection, tx, [authority]);

  console.log('');
  console.log('✅ Tokens sent successfully!');
  console.log('Transaction:', sig);
  console.log('View: https://solscan.io/tx/' + sig + '?cluster=devnet');

  // Show recipient's new balance
  const recipientAccount = await getAccount(connection, recipientAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const newBalance = Number(recipientAccount.amount) / 10 ** DECIMALS;
  console.log('');
  console.log('Recipient new balance:', newBalance.toLocaleString(), '$KERNEL');
  console.log('');
  console.log('Note: 5% transfer fee was deducted (2% reflections, 2% LP, 1% burn)');
}

main().catch(console.error);
