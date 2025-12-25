import { PublicKey } from '@solana/web3.js';

// Environment-based configuration
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';
export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta';

// Token Configuration (from env or defaults)
export const KERNEL_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_KERNEL_MINT || '61haxRk7djifSYwso9Kzt9NtPB9oB9QwQyQZBoiv47Dk'
);
export const KERNEL_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_KERNEL_PROGRAM || 'BvsKLbUiEVBzfxbKG8ECM4zFzaVw4Rcqj4t2oji2cdkx'
);

// Token Info
export const KERNEL_DECIMALS = 9;
export const KERNEL_TOTAL_SUPPLY = 69_420_000_000;
export const KERNEL_SYMBOL = 'KERNEL';
export const KERNEL_NAME = 'Kernel Coin';

// Fee Configuration (in basis points)
export const TOTAL_FEE_BPS = 500; // 5%
export const REFLECTION_FEE_BPS = 200; // 2%
export const LP_FEE_BPS = 200; // 2%
export const BURN_FEE_BPS = 100; // 1%

// Distribution
export const DISTRIBUTION = {
  LP: 0.50,           // 50% - Liquidity Pool
  AIRDROP: 0.20,      // 20% - Airdrops & Rewards
  MARKETING: 0.15,    // 15% - Marketing & Development
  BURN: 0.10,         // 10% - Initial Burn
  TEAM: 0.05,         // 5% - Team (vested)
};

// Explorer URLs
export const getExplorerUrl = (address: string, type: 'address' | 'tx' = 'address') => {
  const base = NETWORK === 'mainnet-beta'
    ? 'https://solscan.io'
    : 'https://solscan.io';
  const cluster = NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `${base}/${type}/${address}${cluster}`;
};

// Theme colors
export const KERNEL_COLORS = {
  primary: '#FFD700',    // Gold (popcorn/kernel)
  secondary: '#8B4513',  // Saddle brown (military)
  accent: '#FF6B35',     // Orange (hot kernel)
  background: '#1A1A2E', // Dark navy
  card: '#16213E',       // Slightly lighter navy
  text: '#FFFFFF',
  textMuted: '#A0A0A0',
};
