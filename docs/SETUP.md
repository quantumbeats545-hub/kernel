# $KERNEL Development Setup

## Overview

$KERNEL is a meme coin on Solana with:
- **Total Supply**: 69,420,000,000 KERNEL
- **Transfer Fee**: 5% (2% reflections, 2% LP, 1% burn)
- **Staking**: Stake KERNEL to earn reflection rewards
- **Theme**: Colonel Kernel - "The Core of Crypto Security!"

## Prerequisites

### For Token Scripts Only (Quick Start)
- Node.js 18+
- Yarn or npm

### For Full Development (including Anchor program)
- Rust & Cargo
- Solana CLI (full version)
- Anchor CLI 0.28.0+

## Installation

### 1. Install Dependencies
```bash
cd ~/sovereign-labs/kernel
yarn install
```

### 2. Configure Solana CLI
```bash
# Set to devnet
solana config set --url devnet

# Create wallet (if needed)
solana-keygen new -o ~/.config/solana/id.json

# Get devnet SOL
solana airdrop 2
```

## Running the Project

### Token Scripts
```bash
# Create the $KERNEL mint (Token-2022 with 5% transfer fee)
yarn token:create

# Mint initial supply (69.42 billion tokens)
yarn token:mint

# Harvest withheld fees
yarn token:harvest

# Burn tokens
yarn token:burn <amount>

# Preview distribution
yarn token:distribute

# Run airdrop
yarn airdrop:run
```

### Anchor Program (Staking/Reflections)
```bash
# Build the program
anchor build

# Test
anchor test

# Deploy to devnet
anchor deploy
```

## Project Structure
```
kernel/
├── programs/           # Anchor/Solana programs
│   └── kernel-token/   # Staking, reflections, burns
├── scripts/            # Utility scripts
│   ├── token/          # Token-2022 scripts
│   └── airdrop/        # Airdrop distribution
├── app/                # Frontend (TODO)
├── tests/              # Integration tests
├── assets/             # Images, metadata
└── docs/               # Documentation
```

## Tokenomics

### Distribution
- **50%** - Liquidity Pool (locked)
- **20%** - Airdrops & Rewards
- **15%** - Marketing & Development
- **10%** - Initial Burn
- **5%**  - Team (vested)

### Fee Breakdown (5% total)
- **2%** - Reflections to stakers
- **2%** - Auto-LP (liquidity)
- **1%** - Burn (deflation)

## Security Notes
- Never commit keypairs or .env files
- All development is on devnet/localnet
- No mainnet deployments until release approval
- Private repo until public launch

## Colonel Kernel Says
"No kernel panics here - just pamps!"
