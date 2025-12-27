# Multi-Sig Setup Guide for Kernel Token

This guide covers setting up Squads multi-sig on Solana for secure authority management.

## Overview

The $KERNEL program uses a single `authority` pubkey stored in the `KernelConfig` account. This authority controls all privileged operations. For production, this should be a Squads multi-sig.

## Authority Functions Requiring Multi-Sig

### Critical (Must Have Multi-Sig)

| Function | Risk Level | Description |
|----------|------------|-------------|
| `propose_authority_transfer()` | Critical | Changes program authority (24h timelock) |
| `execute_authority_transfer()` | Critical | Executes authority change |
| `set_paused()` | High | Emergency pause/unpause |
| `withdraw_from_lp_vault()` | High | Emergency LP fund withdrawal |
| `update_fees()` | High | Emergency fee change (requires guardian co-sign) |

### Standard Operations (Should Have Multi-Sig)

| Function | Risk Level | Description |
|----------|------------|-------------|
| `propose_fee_update()` | Medium | Propose fee config change (24h timelock) |
| `execute_fee_update()` | Medium | Execute fee change |
| `deposit_reflections()` | Medium | Add rewards to reflection pool |
| `allocate_to_lp()` | Medium | Allocate tokens for LP |
| `airdrop()` | Medium | Register airdrop campaign |
| `record_lp_deployment()` | Low | Record LP deployment |

### User Functions (No Admin Control)

| Function | Description |
|----------|-------------|
| `stake()` | Users stake tokens (respects `is_paused`) |
| `unstake()` | Users withdraw (ALWAYS works, even when paused) |
| `claim_reflections()` | Users claim rewards (ALWAYS works, even when paused) |

---

## Step 1: Create Squads Multi-Sig

### Go to Squads App

- **Mainnet**: https://v4.squads.so/
- **Devnet**: https://devnet.squads.so/

### Create a New Squad

1. Connect wallet
2. Click "Create Squad"
3. Configure settings:

```
Name: KERNEL Operations
Threshold: 2/3 (recommended minimum)
Members:
  - Member 1: 0x... (Team Lead)
  - Member 2: 0x... (Tech Lead)
  - Member 3: 0x... (Ops Lead)
```

### Recommended Configurations

#### Operations Squad (Standard Functions)
```
Members: 2-3 core team
Threshold: 2/2 or 2/3
Use: Fee updates, LP allocation, airdrops
```

#### Treasury Squad (Critical Functions)
```
Members: 3-5 stakeholders
Threshold: 3/5
Use: Authority transfers, emergency actions
```

### Hardware Wallet Best Practices

1. **All signers should use Ledger** - Solana Ledger app v1.0.4+
2. **Geographic distribution** - Signers in different locations
3. **Backup seed phrases** - Stored in separate secure locations
4. **Test transactions first** - Verify signing works before transfer

---

## Step 2: Transfer Authority to Squads

### Current Authority Check

```bash
# Get current authority from config account
solana account <CONFIG_PDA> --output json | jq '.data'

# Or via Anchor client
anchor run check-authority
```

### Propose Transfer

The program has a 24-hour timelock for authority transfers:

```typescript
// Using Anchor client
const newAuthority = new PublicKey("SQUADS_VAULT_ADDRESS");

await program.methods
  .proposeAuthorityTransfer(newAuthority)
  .accounts({
    authority: currentAuthority.publicKey,
    tokenMint: KERNEL_MINT,
    config: configPda,
    pendingTransfer: pendingTransferPda,
    systemProgram: SystemProgram.programId,
  })
  .signers([currentAuthority])
  .rpc();

console.log("Authority transfer proposed! Wait 24 hours before executing.");
```

### Execute Transfer (After 24 Hours)

```typescript
await program.methods
  .executeAuthorityTransfer()
  .accounts({
    authority: currentAuthority.publicKey,
    tokenMint: KERNEL_MINT,
    config: configPda,
    pendingTransfer: pendingTransferPda,
  })
  .signers([currentAuthority])
  .rpc();

console.log("Authority transferred to Squads!");
```

### Cancel Transfer (If Needed)

```typescript
await program.methods
  .cancelAuthorityTransfer()
  .accounts({
    authority: currentAuthority.publicKey,
    tokenMint: KERNEL_MINT,
    config: configPda,
    pendingTransfer: pendingTransferPda,
  })
  .signers([currentAuthority])
  .rpc();
```

---

## Step 3: Execute Transactions via Squads

### Creating a Proposal

1. Go to Squads app → Your Squad
2. Click "New Transaction"
3. Select "Program Interaction"
4. Enter:
   - Program ID: `5QVVrCBUgqjG3pWcSmRkqaagFaokaAwgoFFDLXBJgFJw`
   - Instruction data (from Anchor client or manually encoded)
5. Submit proposal

### Approving a Proposal

1. View pending proposals
2. Review transaction details carefully
3. Click "Approve" and sign with wallet
4. Wait for threshold to be met

### Executing After Threshold

1. Once threshold is met, anyone can execute
2. Click "Execute" on the approved proposal
3. Transaction is sent to the network

---

## Step 4: Fee Update Workflow

### Standard Update (24-Hour Timelock)

```
Day 0: Authority proposes fee update via Squads
        → 2/3 signers approve → Transaction executes
        → Proposal created on-chain, timelock starts

Day 1: Wait 24 hours

Day 2: Authority executes fee update via Squads
        → 2/3 signers approve → Transaction executes
        → New fees are active
```

### Emergency Update (Requires Guardian)

For immediate fee changes without timelock:

```typescript
// Requires BOTH authority AND guardian signatures
await program.methods
  .updateFees(200, 200, 100) // reflection, lp, burn (bps)
  .accounts({
    authority: squadsSigner, // Squads vault
    guardian: guardianSigner, // Separate guardian key
    tokenMint: KERNEL_MINT,
    config: configPda,
  })
  .signers([guardianSigner]) // Squads handles authority sig
  .rpc();
```

---

## Step 5: Guardian Configuration

The `update_fees()` function requires both authority AND guardian signatures. This provides 2FA for emergency actions.

### Guardian Options

1. **Hardware wallet** - Separate Ledger held by trusted party
2. **Second Squads vault** - Another multi-sig (e.g., 2/2)
3. **Time-locked account** - Using Clockwork or similar

### Guardian Best Practices

- Guardian should NOT be a member of the authority Squads
- Store guardian key offline when not needed
- Document when guardian was last used
- Rotate guardian periodically

---

## Security Checklist

### Before Mainnet

- [ ] Squads vault created with appropriate threshold
- [ ] All signers using hardware wallets
- [ ] Test transaction executed successfully
- [ ] Authority transfer proposed
- [ ] 24-hour timelock waited
- [ ] Authority transfer executed
- [ ] Verified new authority is Squads vault
- [ ] Guardian key configured and tested
- [ ] Emergency procedures documented
- [ ] All team members have Squads app access

### Ongoing Operations

- [ ] Monitor proposal queue regularly
- [ ] Review all proposals before signing
- [ ] Keep hardware wallets firmware updated
- [ ] Rotate signers if team changes
- [ ] Test emergency procedures quarterly

---

## Squads Addresses Template

Fill in after creating Squads:

```
# Solana Mainnet Squads
OPERATIONS_SQUAD=<vault_address>
TREASURY_SQUAD=<vault_address>

# Signers
SIGNER_1=<pubkey> (Ledger)
SIGNER_2=<pubkey> (Ledger)
SIGNER_3=<pubkey> (Ledger)

# Guardian
GUARDIAN_KEY=<pubkey>
```

---

## Emergency Contacts

Document emergency contacts for quick response:

```
Team Lead: [contact info]
Tech Lead: [contact info]
Ops Lead: [contact info]

Emergency Procedures: See EMERGENCY_PROCEDURES.md
```
