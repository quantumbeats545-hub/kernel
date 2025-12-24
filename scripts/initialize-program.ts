/**
 * Initialize $KERNEL Staking Program
 *
 * This script initializes the on-chain program configuration:
 * - Creates staking vault PDA (holds staked tokens)
 * - Creates reflection pool PDA (holds pending rewards)
 * - Configures fee distribution (2% reflections, 2% LP, 1% burn)
 * - Establishes program authority
 */

import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const KERNEL_PROGRAM_ID = new PublicKey('BvsKLbUiEVBzfxbKG8ECM4zFzaVw4Rcqj4t2oji2cdkx');
const KERNEL_MINT = new PublicKey('7c3nWjin5q92RW9LBxeK9JHuPiAHaStXx8YLBLjVyJgN');

// Fee distribution (must total 500 = 5%)
const REFLECTION_SHARE_BPS = 200; // 2%
const LP_SHARE_BPS = 200;         // 2%
const BURN_SHARE_BPS = 100;       // 1%

// Load IDL
const idlPath = path.join(__dirname, '..', 'target', 'idl', 'kernel_token.json');
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

async function main() {
  // Load wallet
  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log('='.repeat(60));
  console.log('$KERNEL Program Initializer');
  console.log('='.repeat(60));
  console.log('Authority:', wallet.publicKey.toBase58());
  console.log('Program ID:', KERNEL_PROGRAM_ID.toBase58());
  console.log('Token Mint:', KERNEL_MINT.toBase58());

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('Wallet Balance:', balance / 1e9, 'SOL');

  if (balance < 0.1 * 1e9) {
    console.log('\n⚠️  Low balance! Requesting airdrop...');
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig);
    console.log('Airdrop received!');
  }

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  const [stakingVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('staking_vault'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  const [reflectionPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('reflection_pool'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  console.log('\nPDAs:');
  console.log('  Config:', configPda.toBase58());
  console.log('  Staking Vault:', stakingVaultPda.toBase58());
  console.log('  Reflection Pool:', reflectionPoolPda.toBase58());

  // Check if already initialized
  const configAccount = await connection.getAccountInfo(configPda);
  if (configAccount) {
    console.log('\n✅ Program already initialized!');
    console.log('Config account size:', configAccount.data.length, 'bytes');
    return;
  }

  console.log('\nFee Configuration:');
  console.log('  Reflection Share:', REFLECTION_SHARE_BPS / 100, '%');
  console.log('  LP Share:', LP_SHARE_BPS / 100, '%');
  console.log('  Burn Share:', BURN_SHARE_BPS / 100, '%');
  console.log('  Total Fee:', (REFLECTION_SHARE_BPS + LP_SHARE_BPS + BURN_SHARE_BPS) / 100, '%');

  // Set up Anchor provider
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: 'confirmed' }
  );

  // Create program interface
  const program = new Program(IDL, provider);

  try {
    console.log('\n🚀 Initializing $KERNEL program...');

    // Initialize the program
    const tx = await program.methods
      .initialize(REFLECTION_SHARE_BPS, LP_SHARE_BPS, BURN_SHARE_BPS)
      .accounts({
        authority: wallet.publicKey,
        tokenMint: KERNEL_MINT,
        stakingVault: stakingVaultPda,
        reflectionPool: reflectionPoolPda,
        config: configPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();

    console.log('\n✅ Program initialized successfully!');
    console.log('Transaction:', tx);
    console.log('View on Solscan: https://solscan.io/tx/' + tx + '?cluster=devnet');

    // Verify initialization by checking the config account exists
    const verifyConfig = await connection.getAccountInfo(configPda);
    if (verifyConfig) {
      console.log('\nVerified Config Account:');
      console.log('  Account size:', verifyConfig.data.length, 'bytes');
      console.log('  Owner:', verifyConfig.owner.toBase58());
    }

  } catch (error) {
    console.error('\n❌ Error initializing program:', error);
    throw error;
  }
}

main().catch(console.error);
