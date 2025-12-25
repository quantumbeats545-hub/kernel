/**
 * Fresh initialization with a new token mint
 * Creates a new Token-2022 mint with transfer fee extension and initializes staking
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  ExtensionType,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createMintToInstruction,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const KERNEL_PROGRAM_ID = new PublicKey('BvsKLbUiEVBzfxbKG8ECM4zFzaVw4Rcqj4t2oji2cdkx');

// Fee distribution (must total 500 = 5%)
const REFLECTION_SHARE_BPS = 200; // 2%
const LP_SHARE_BPS = 200;         // 2%
const BURN_SHARE_BPS = 100;       // 1%

// Token config
const DECIMALS = 6;
const TOTAL_SUPPLY = 10_000_000_000; // 10 billion
const TRANSFER_FEE_BPS = 500; // 5%
const MAX_FEE = BigInt(1_000_000_000) * BigInt(10 ** DECIMALS); // 1 billion max

// Load IDL
const idlPath = path.join(__dirname, '..', 'target', 'idl', 'kernel_token.json');
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

async function main() {
  // Load wallet
  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log('='.repeat(60));
  console.log('$KERNEL Fresh Initialization');
  console.log('='.repeat(60));
  console.log('Authority:', authority.publicKey.toBase58());

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const balance = await connection.getBalance(authority.publicKey);
  console.log('SOL Balance:', balance / 1e9);

  // Generate new mint keypair
  const mintKeypair = Keypair.generate();
  console.log('\n📍 New Token Mint:', mintKeypair.publicKey.toBase58());

  // Calculate mint size with transfer fee extension
  const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
  const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  console.log('Mint account size:', mintLen, 'bytes');
  console.log('Rent exemption:', mintLamports / 1e9, 'SOL');

  // Create mint with transfer fee extension
  console.log('\n🔨 Creating Token-2022 mint with transfer fee...');

  const createMintTx = new Transaction().add(
    // Create account for mint
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    // Initialize transfer fee config
    createInitializeTransferFeeConfigInstruction(
      mintKeypair.publicKey,
      authority.publicKey, // fee config authority
      authority.publicKey, // withdraw authority
      TRANSFER_FEE_BPS,    // fee basis points (5%)
      MAX_FEE,             // max fee
      TOKEN_2022_PROGRAM_ID
    ),
    // Initialize mint
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      authority.publicKey, // mint authority
      null,                // freeze authority
      TOKEN_2022_PROGRAM_ID
    )
  );

  const mintSig = await sendAndConfirmTransaction(connection, createMintTx, [authority, mintKeypair]);
  console.log('✅ Mint created:', mintSig);

  // Create authority's token account
  const authorityAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    authority.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log('\n📦 Creating authority token account...');
  const createAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      authority.publicKey,
      authorityAta,
      authority.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, createAtaTx, [authority]);

  // Mint initial supply
  console.log('🪙 Minting initial supply...');
  const mintAmount = BigInt(TOTAL_SUPPLY) * BigInt(10 ** DECIMALS);
  const mintToTx = new Transaction().add(
    createMintToInstruction(
      mintKeypair.publicKey,
      authorityAta,
      authority.publicKey,
      mintAmount,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, mintToTx, [authority]);
  console.log('✅ Minted', TOTAL_SUPPLY.toLocaleString(), '$KERNEL');

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), mintKeypair.publicKey.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  const [stakingVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('staking_vault'), mintKeypair.publicKey.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  const [reflectionPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('reflection_pool'), mintKeypair.publicKey.toBuffer()],
    KERNEL_PROGRAM_ID
  );

  console.log('\n📍 PDAs:');
  console.log('  Config:', configPda.toBase58());
  console.log('  Staking Vault:', stakingVaultPda.toBase58());
  console.log('  Reflection Pool:', reflectionPoolPda.toBase58());

  // Initialize program
  console.log('\n🚀 Initializing staking program...');

  const provider = new AnchorProvider(
    connection,
    new Wallet(authority),
    { commitment: 'confirmed' }
  );

  const program = new Program(IDL, provider);

  const initTx = await program.methods
    .initialize(REFLECTION_SHARE_BPS, LP_SHARE_BPS, BURN_SHARE_BPS)
    .accounts({
      authority: authority.publicKey,
      tokenMint: mintKeypair.publicKey,
      stakingVault: stakingVaultPda,
      reflectionPool: reflectionPoolPda,
      config: configPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  console.log('✅ Program initialized:', initTx);

  // Update constants file
  console.log('\n📝 Updating constants...');
  const constantsPath = path.join(__dirname, '..', 'app', 'src', 'lib', 'constants.ts');
  if (fs.existsSync(constantsPath)) {
    let constants = fs.readFileSync(constantsPath, 'utf-8');
    constants = constants.replace(
      /export const KERNEL_MINT = new PublicKey\('[^']+'\)/,
      `export const KERNEL_MINT = new PublicKey('${mintKeypair.publicKey.toBase58()}')`
    );
    fs.writeFileSync(constantsPath, constants);
    console.log('✅ Updated app/src/lib/constants.ts');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 FRESH INITIALIZATION COMPLETE');
  console.log('='.repeat(60));
  console.log('Token Mint:', mintKeypair.publicKey.toBase58());
  console.log('Program ID:', KERNEL_PROGRAM_ID.toBase58());
  console.log('Config PDA:', configPda.toBase58());
  console.log('Total Supply:', TOTAL_SUPPLY.toLocaleString(), '$KERNEL');
  console.log('Transfer Fee:', TRANSFER_FEE_BPS / 100, '%');
  console.log('\nView token: https://solscan.io/token/' + mintKeypair.publicKey.toBase58() + '?cluster=devnet');
}

main().catch(console.error);
