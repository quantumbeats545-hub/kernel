/**
 * $KERNEL Fee Harvester
 *
 * This script harvests transfer fees from Token-2022 and distributes them:
 * - 40% (2/5) to Reflection Pool for stakers
 * - 40% (2/5) to LP for liquidity provision
 * - 20% (1/5) burned for deflation
 *
 * Run periodically (e.g., every hour via cron) to process accumulated fees.
 */

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  getTransferFeeAmount,
  harvestWithheldTokensToMint,
  withdrawWithheldTokensFromMint,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const KERNEL_PROGRAM_ID = new PublicKey('BvsKLbUiEVBzfxbKG8ECM4zFzaVw4Rcqj4t2oji2cdkx');
const KERNEL_MINT = new PublicKey('7c3nWjin5q92RW9LBxeK9JHuPiAHaStXx8YLBLjVyJgN');
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';

// Fee distribution (out of 500 bps = 5%)
const REFLECTION_SHARE = 2; // 2/5 = 40%
const LP_SHARE = 2;         // 2/5 = 40%
const BURN_SHARE = 1;       // 1/5 = 20%
const TOTAL_SHARES = 5;

// Load IDL
const idlPath = path.join(__dirname, '..', 'target', 'idl', 'kernel_token.json');
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

interface HarvestResult {
  totalHarvested: bigint;
  reflectionAmount: bigint;
  lpAmount: bigint;
  burnAmount: bigint;
  txSignatures: string[];
}

async function main() {
  // Load wallet
  const walletPath = process.env.WALLET_PATH || process.env.HOME + '/.config/solana/id.json';
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log('='.repeat(60));
  console.log('$KERNEL Fee Harvester');
  console.log('='.repeat(60));
  console.log('Authority:', wallet.publicKey.toBase58());
  console.log('Token Mint:', KERNEL_MINT.toBase58());
  console.log('RPC:', RPC_ENDPOINT);

  // Connect
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('SOL Balance:', balance / 1e9);

  if (balance < 0.01 * 1e9) {
    console.log('\n⚠️  Low SOL balance for transaction fees!');
    return;
  }

  try {
    const result = await harvestFees(connection, wallet);

    console.log('\n='.repeat(60));
    console.log('Harvest Summary');
    console.log('='.repeat(60));
    console.log('Total Harvested:', formatTokens(result.totalHarvested));
    console.log('→ Reflections:', formatTokens(result.reflectionAmount));
    console.log('→ LP:', formatTokens(result.lpAmount));
    console.log('→ Burned:', formatTokens(result.burnAmount));
    console.log('Transactions:', result.txSignatures.length);

    for (const sig of result.txSignatures) {
      console.log('  https://solscan.io/tx/' + sig + '?cluster=devnet');
    }
  } catch (error) {
    console.error('Harvest failed:', error);
    process.exit(1);
  }
}

async function harvestFees(connection: Connection, wallet: Keypair): Promise<HarvestResult> {
  const txSignatures: string[] = [];

  // 1. Get all token accounts holding KERNEL (to harvest withheld fees)
  console.log('\n📊 Checking for withheld fees...');

  // Get fee authority's token account
  const feeAuthorityAta = getAssociatedTokenAddressSync(
    KERNEL_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  // Check if ATA exists
  let ataExists = false;
  try {
    await getAccount(connection, feeAuthorityAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
    ataExists = true;
  } catch {
    ataExists = false;
  }

  // Create ATA if needed
  if (!ataExists) {
    console.log('Creating fee authority token account...');
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        feeAuthorityAta,
        wallet.publicKey,
        KERNEL_MINT,
        TOKEN_2022_PROGRAM_ID
      )
    );
    const sig = await connection.sendTransaction(tx, [wallet]);
    await connection.confirmTransaction(sig);
    txSignatures.push(sig);
    console.log('Created ATA:', sig);
  }

  // 2. Harvest withheld tokens from all accounts to mint
  console.log('\n🌾 Harvesting withheld tokens to mint...');

  // Get token accounts with withheld amounts
  const tokenAccounts = await connection.getTokenAccountsByOwner(
    KERNEL_MINT,
    { programId: TOKEN_2022_PROGRAM_ID }
  );

  // For Token-2022, we need to harvest from individual accounts
  // This is done by calling harvestWithheldTokensToMint
  // In production, you'd iterate through accounts with withheld fees

  console.log('Found', tokenAccounts.value.length, 'token accounts');

  // 3. Withdraw withheld tokens from mint to authority
  console.log('\n💰 Withdrawing fees to authority...');

  try {
    const withdrawSig = await withdrawWithheldTokensFromMint(
      connection,
      wallet,
      KERNEL_MINT,
      feeAuthorityAta,
      wallet,
      [],
      { commitment: 'confirmed' },
      TOKEN_2022_PROGRAM_ID
    );
    txSignatures.push(withdrawSig);
    console.log('Withdrew fees:', withdrawSig);
  } catch (error: any) {
    if (!error.message?.includes('insufficient')) {
      throw error;
    }
    console.log('No withheld fees to withdraw');
  }

  // 4. Check harvested amount
  const authorityAccount = await getAccount(
    connection,
    feeAuthorityAta,
    'confirmed',
    TOKEN_2022_PROGRAM_ID
  );

  const harvestedAmount = authorityAccount.amount;
  console.log('\nHarvested amount:', formatTokens(harvestedAmount));

  if (harvestedAmount === BigInt(0)) {
    console.log('No fees to distribute');
    return {
      totalHarvested: BigInt(0),
      reflectionAmount: BigInt(0),
      lpAmount: BigInt(0),
      burnAmount: BigInt(0),
      txSignatures,
    };
  }

  // 5. Calculate distribution
  const reflectionAmount = (harvestedAmount * BigInt(REFLECTION_SHARE)) / BigInt(TOTAL_SHARES);
  const lpAmount = (harvestedAmount * BigInt(LP_SHARE)) / BigInt(TOTAL_SHARES);
  const burnAmount = harvestedAmount - reflectionAmount - lpAmount; // Remainder to burn

  console.log('\n📦 Distribution:');
  console.log('  Reflections:', formatTokens(reflectionAmount));
  console.log('  LP:', formatTokens(lpAmount));
  console.log('  Burn:', formatTokens(burnAmount));

  // 6. Set up Anchor for program interactions
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: 'confirmed' }
  );
  const program = new Program(IDL, provider);

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  const [reflectionPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('reflection_pool'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  const [burnRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('burn'), configPda.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  // 7. Deposit reflections
  if (reflectionAmount > BigInt(0)) {
    console.log('\n🔄 Depositing to reflection pool...');

    const depositTx = await program.methods
      .depositReflections(new BN(reflectionAmount.toString()))
      .accounts({
        authority: wallet.publicKey,
        tokenMint: KERNEL_MINT,
        config: configPda,
        authorityTokenAccount: feeAuthorityAta,
        reflectionPool: reflectionPoolPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();

    txSignatures.push(depositTx);
    console.log('Deposited reflections:', depositTx);
  }

  // 8. Burn tokens
  if (burnAmount > BigInt(0)) {
    console.log('\n🔥 Burning tokens...');

    const burnTx = await program.methods
      .burnTokens(new BN(burnAmount.toString()))
      .accounts({
        authority: wallet.publicKey,
        tokenMint: KERNEL_MINT,
        config: configPda,
        authorityTokenAccount: feeAuthorityAta,
        burnRecord: burnRecordPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: PublicKey.default,
      })
      .signers([wallet])
      .rpc();

    txSignatures.push(burnTx);
    console.log('Burned tokens:', burnTx);
  }

  // 9. LP handling (keep tokens in authority account for LP provision)
  // In production, this would swap half for SOL and add to Raydium/Orca LP
  if (lpAmount > BigInt(0)) {
    console.log('\n💧 LP tokens held for liquidity provision');
    console.log('  Amount:', formatTokens(lpAmount));
    console.log('  → In production: Auto-add to Raydium/Orca LP');
  }

  return {
    totalHarvested: harvestedAmount,
    reflectionAmount,
    lpAmount,
    burnAmount,
    txSignatures,
  };
}

function formatTokens(amount: bigint): string {
  const tokens = Number(amount) / 1e9;
  if (tokens >= 1_000_000_000) return (tokens / 1_000_000_000).toFixed(2) + 'B';
  if (tokens >= 1_000_000) return (tokens / 1_000_000).toFixed(2) + 'M';
  if (tokens >= 1_000) return (tokens / 1_000).toFixed(2) + 'K';
  return tokens.toFixed(4);
}

// Run if called directly
main().catch(console.error);

export { harvestFees, HarvestResult };
