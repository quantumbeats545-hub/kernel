/**
 * Verify $KERNEL Deployment
 *
 * Confirms the program is deployed and initialized correctly on devnet.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getMint } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const KERNEL_PROGRAM_ID = new PublicKey('BvsKLbUiEVBzfxbKG8ECM4zFzaVw4Rcqj4t2oji2cdkx');
const KERNEL_MINT = new PublicKey('7c3nWjin5q92RW9LBxeK9JHuPiAHaStXx8YLBLjVyJgN');
const RPC_ENDPOINT = 'https://api.devnet.solana.com';

async function main() {
  console.log('='.repeat(60));
  console.log('$KERNEL Deployment Verification');
  console.log('='.repeat(60));

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // 1. Verify program is deployed
  console.log('\n📦 1. Program Deployment');
  console.log('  Program ID:', KERNEL_PROGRAM_ID.toBase58());

  const programInfo = await connection.getAccountInfo(KERNEL_PROGRAM_ID);
  if (!programInfo) {
    console.log('  ❌ Program not found!');
    return false;
  }
  console.log('  ✅ Program is deployed');
  console.log('  Owner:', programInfo.owner.toBase58());

  // 2. Verify token mint
  console.log('\n🪙 2. Token Mint');
  console.log('  Mint Address:', KERNEL_MINT.toBase58());

  try {
    const mintInfo = await getMint(connection, KERNEL_MINT, 'confirmed', TOKEN_2022_PROGRAM_ID);
    console.log('  ✅ Token mint exists');
    console.log('  Decimals:', mintInfo.decimals);
    console.log('  Supply:', Number(mintInfo.supply) / 1e9, 'tokens');
    console.log('  Mint Authority:', mintInfo.mintAuthority?.toBase58() || 'null');
    console.log('  Freeze Authority:', mintInfo.freezeAuthority?.toBase58() || 'null');
  } catch (error) {
    console.log('  ❌ Token mint not found or invalid');
    return false;
  }

  // 3. Verify PDAs
  console.log('\n🔐 3. Program PDAs');

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );
  console.log('  Config PDA:', configPda.toBase58());

  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    console.log('  ❌ Config account not initialized!');
    return false;
  }
  console.log('  ✅ Config account exists');
  console.log('  Account size:', configInfo.data.length, 'bytes');
  console.log('  Owner:', configInfo.owner.toBase58());

  // Parse config data
  const data = configInfo.data;
  // Skip discriminator (8 bytes), then read authority (32 bytes)
  const authority = new PublicKey(data.slice(8, 40));
  const tokenMint = new PublicKey(data.slice(40, 72));

  console.log('\n  Config Data:');
  console.log('    Authority:', authority.toBase58());
  console.log('    Token Mint:', tokenMint.toBase58());

  // 4. Verify staking vault PDA
  const [stakingVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('staking_vault'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );
  console.log('\n  Staking Vault:', stakingVaultPda.toBase58());

  const vaultInfo = await connection.getAccountInfo(stakingVaultPda);
  if (vaultInfo) {
    console.log('  ✅ Staking vault exists');
  } else {
    console.log('  ⚠️ Staking vault not yet created (normal if no stakes)');
  }

  // 5. Verify reflection pool PDA
  const [reflectionPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('reflection_pool'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );
  console.log('  Reflection Pool:', reflectionPoolPda.toBase58());

  const poolInfo = await connection.getAccountInfo(reflectionPoolPda);
  if (poolInfo) {
    console.log('  ✅ Reflection pool exists');
  } else {
    console.log('  ⚠️ Reflection pool not yet created (normal if no deposits)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ DEPLOYMENT VERIFIED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log('\nThe $KERNEL program is:');
  console.log('  • Deployed to devnet');
  console.log('  • Initialized with config');
  console.log('  • Ready for staking operations');
  console.log('\nFrontend app can connect at:');
  console.log('  http://localhost:3000');
  console.log('\nExplorer links:');
  console.log('  Program: https://solscan.io/account/' + KERNEL_PROGRAM_ID.toBase58() + '?cluster=devnet');
  console.log('  Token: https://solscan.io/token/' + KERNEL_MINT.toBase58() + '?cluster=devnet');

  return true;
}

main().catch(console.error);
