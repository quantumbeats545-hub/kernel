# $KERNEL

A Solana meme coin built with Token-2022 transfer fees, staking rewards, and automatic burn mechanics.

## Features

- **Token-2022 Transfer Fees**: 5% fee on every transfer, automatically collected
- **Staking Rewards**: Stake $KERNEL to earn reflection rewards from transfer fees
- **Automatic Burns**: 1% of fees permanently burned, reducing supply over time
- **LP Incentives**: 2% of fees allocated to liquidity providers
- **Airdrop System**: Claim-based airdrop distribution for early supporters

## Tokenomics

| Metric | Value |
|--------|-------|
| Total Supply | 10,000,000,000 (10B) |
| Transfer Fee | 5% |
| Decimals | 6 |

### Fee Distribution

```
5% Transfer Fee
├── 2% → Staker Reflections
├── 2% → LP Rewards
└── 1% → Burn (Deflationary)
```

## Architecture

```
kernel/
├── programs/kernel-token/     # Anchor program
│   └── src/
│       ├── lib.rs            # Program entry & instructions
│       ├── state.rs          # Account structures
│       └── errors.rs         # Custom errors
├── app/                       # Next.js frontend
│   └── src/
│       ├── app/              # Pages (home, token, stake, airdrop)
│       ├── components/       # React components
│       ├── hooks/            # Solana wallet & data hooks
│       └── lib/              # Constants, IDL, utilities
├── scripts/                   # Deployment & management scripts
└── tests/                     # Anchor integration tests
```

## Prerequisites

- Node.js 18+
- Rust & Cargo
- Solana CLI
- Anchor CLI 0.32.1+

## Installation

```bash
# Clone the repository
git clone https://github.com/quantumbeats545-hub/kernel.git
cd kernel

# Install Anchor dependencies
npm install

# Install frontend dependencies
cd app && npm install
```

## Development

### Build the program

```bash
anchor build
```

### Run tests

```bash
anchor test
```

### Start the frontend

```bash
cd app
npm run dev
```

The app will be available at http://localhost:3000

## Deployment

### Devnet

```bash
# Deploy program
anchor deploy --provider.cluster devnet

# Initialize token and config
npx ts-node scripts/initialize.ts
```

### Current Devnet Deployment

| Account | Address |
|---------|---------|
| Program | `BvsKLbUiEVBzfxbKG8ECM4zFzaVw4Rcqj4t2oji2cdkx` |
| Token Mint | `61haxRk7djifSYwso9Kzt9NtPB9oB9QwQyQZBoiv47Dk` |

## Program Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize` | Create token mint and config |
| `stake` | Stake tokens to earn reflections |
| `unstake` | Withdraw staked tokens |
| `claim_reflections` | Claim pending reflection rewards |
| `harvest_fees` | Collect transfer fees from mint |
| `deposit_reflections` | Distribute fees to staking pool |
| `process_lp_rewards` | Send LP allocation to reward pool |
| `burn_allocation` | Burn the 1% fee allocation |
| `claim_airdrop` | Claim airdrop allocation |

## Frontend Pages

- **/** - Landing page with project overview
- **/token** - Token info, supply stats, holder count
- **/stake** - Stake/unstake interface with rewards dashboard
- **/airdrop** - Check eligibility and claim airdrop

## Security

- Transfer hook validates all transfers go through program
- Fee collection requires authority signature
- Staking uses accumulated-per-share pattern for fair distribution
- All PDAs derived deterministically from seeds

## License

MIT
