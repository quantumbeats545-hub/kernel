# Audit Submission Package - Kernel Token

**Prepared For**: External Security Auditors
**Version**: 1.0
**Date**: December 27, 2025
**Prepared By**: Sovereign Labs Security Team

---

## 1. Project Overview

### 1.1 Description

$KERNEL is a Solana-based token with staking, reflections, and governance features built on Anchor. Key features:
- **Staking with reflections** - Token-2022 based staking with automatic reward distribution
- **Fee distribution** - 5% fee split between reflections (2%), LP (2%), and burns (1%)
- **Timelock governance** - 24-hour delays on fee/authority changes
- **Airdrop system** - Batch distribution for community rewards

### 1.2 Program Structure

| Program | Purpose | Lines of Code |
|---------|---------|---------------|
| `kernel-token` | Main token program | ~1,500 |

### 1.3 Trust Model

- **Single authority** - Admin controls governed by timelocks
- **PDA-based security** - Vault accounts are self-authorizing PDAs
- **Immutable core logic** - Upgrades require program redeployment

---

## 2. Repository Structure

```
kernel/
├── programs/
│   └── kernel-token/
│       ├── src/
│       │   ├── lib.rs              # Main program
│       │   └── property_tests.rs   # Proptest invariants
│       └── Cargo.toml
├── tests/
│   └── kernel-token.ts             # TypeScript integration tests
├── migrations/
│   └── deploy.ts
├── docs/
│   ├── INVARIANTS.md              # Formal invariants
│   └── THREAT_MODEL.md            # Security analysis
├── Anchor.toml
└── Cargo.toml
```

---

## 3. Scope of Audit

### 3.1 In Scope (Priority Order)

1. **Staking Operations**
   - `stake()` - Deposit tokens to staking vault
   - `unstake()` - Withdraw tokens from staking vault
   - `claim_reflections()` - Claim accumulated rewards

2. **Fee Management**
   - `propose_fee_update()` - Create timelocked fee proposal
   - `execute_fee_update()` - Apply fee changes after timelock
   - `cancel_fee_proposal()` - Cancel pending proposal

3. **Authority Transfer**
   - `propose_authority_transfer()` - Timelocked authority change
   - `execute_authority_transfer()` - Apply after 24-hour delay

4. **LP Vault Operations**
   - `withdraw_lp_funds()` - Withdraw pending LP allocation
   - `record_lp_deployment()` - Track deployed LP tokens

5. **Burns and Airdrops**
   - `burn_fees()` - Execute fee burns
   - `airdrop()` - Batch distribution (max 50 recipients)

### 3.2 Out of Scope

- Solana runtime internals
- Anchor framework code
- Token-2022 program implementation
- Frontend applications
- External LP pool contracts

---

## 4. Security Considerations

### 4.1 Critical Areas

| Area | Risk Level | Mitigation |
|------|------------|------------|
| Staking vault drain | Critical | PDA authority, balance checks |
| Reflection pool insolvency | Critical | Accumulated per share math |
| Authority takeover | Critical | 24-hour timelock |
| Fee manipulation | High | Sum constraint (500 bps), timelock |
| Double withdrawal | High | State updates before transfers |
| Integer overflow | High | Checked math, Rust overflow checks |

### 4.2 Known Risks (Accepted)

1. **Authority centralization** - Mitigated by timelocks and transparency
2. **LP deployment trust** - Authority controls LP fund withdrawal
3. **Reflection math precision** - 10^12 precision constant

### 4.3 Previous Audits

This is the initial audit submission. No previous audits have been conducted.

---

## 5. Testing Summary

### 5.1 Test Coverage

| Metric | Value |
|--------|-------|
| Property Tests | 29 passing |
| Integration Tests | TypeScript suite |
| Invariant Coverage | 30+ invariants |

### 5.2 Test Categories

- **Property Tests**: Proptest-based invariant verification
- **Integration Tests**: Full transaction flow testing
- **Fuzz Testing**: Random input validation

### 5.3 Running Tests

```bash
cd kernel

# Build
anchor build

# Property tests (requires rustc 1.82+)
RUSTUP_TOOLCHAIN=stable cargo test --lib -p kernel-token

# Integration tests
anchor test
```

---

## 6. Formal Verification

### 6.1 Defined Invariants

See `docs/INVARIANTS.md` for complete specifications:

**ST-2**: Unstake bounded by stake
```
∀ user u, unstake_amount a:
  unstake(u, a) succeeds → a ≤ user_stake[u].staked_amount
```

**ST-3**: Total staked consistency
```
config.total_staked = Σ(user_stake[u].staked_amount) for all u
```

**FC-1**: Fee sum constraint
```
reflection_share_bps + lp_share_bps + burn_share_bps = 500
```

**TL-1**: Proposal execution delay
```
∀ proposal p:
  can_execute(p) → current_time - p.proposed_at ≥ 86400
```

**RF-3**: Accumulated per share monotonicity
```
∀ t1 < t2: accumulated_per_share(t1) ≤ accumulated_per_share(t2)
```

### 6.2 Property Test Results

```
running 29 tests
test property_tests::fc1_fee_sum_always_500 ... ok
test property_tests::fc2_fee_bounds ... ok
test property_tests::st2_unstake_bounded_by_stake ... ok
test property_tests::st3_total_staked_consistency ... ok
test property_tests::tl1_proposal_execution_delay ... ok
test property_tests::rf3_accumulated_per_share_monotonic ... ok
... (24 more passing)

test result: ok. 29 passed; 0 failed
```

---

## 7. Deployment Information

### 7.1 Target Networks

| Network | Status |
|---------|--------|
| Solana Mainnet-Beta | Planned |
| Solana Devnet | Deployed |

### 7.2 Dependencies

- Anchor: 0.32.1
- Solana: 1.18+
- Rust: 1.81.0 (BPF toolchain)
- Node.js: 18+

---

## 8. Account Structure

### 8.1 PDAs

| PDA | Seeds | Purpose |
|-----|-------|---------|
| `config` | `["config", mint]` | Global configuration |
| `staking_vault` | `["staking_vault", mint]` | Token custody |
| `reflection_pool` | `["reflection_pool", mint]` | Reward distribution |
| `lp_vault` | `["lp_vault", mint]` | LP fund custody |
| `user_stake` | `["stake", config, owner]` | Per-user stake info |
| `fee_proposal` | `["fee_proposal", config]` | Pending fee change |
| `burn_record` | `["burn", mint]` | Burn tracking |

### 8.2 Account Sizes

| Account | Size (bytes) | Rent-Exempt (SOL) |
|---------|--------------|-------------------|
| KernelConfig | 256 | ~0.003 |
| UserStake | 128 | ~0.002 |
| FeeProposal | 64 | ~0.001 |
| LPVault | 96 | ~0.001 |
| BurnRecord | 64 | ~0.001 |

---

## 9. Access Control Matrix

| Instruction | Signer | Additional Checks |
|-------------|--------|-------------------|
| `initialize` | Authority | One-time setup |
| `stake` | User | Not paused, amount > 0 |
| `unstake` | User | Balance check |
| `claim_reflections` | User | Pending > 0 |
| `propose_fee_update` | Authority | Sum = 500 bps |
| `execute_fee_update` | Anyone | Timelock expired |
| `withdraw_lp_funds` | Authority | Pending balance |
| `airdrop` | Authority | Max 50 recipients |
| `pause` / `unpause` | Authority | - |

---

## 10. Contact Information

### Technical Questions

**Email**: security@sovereignlabs.com.au
**Response Time**: 48 hours

### Emergency Contact

**Email**: security@sovereignlabs.com.au (subject: URGENT)
**Response Time**: 4 hours

---

## 11. Audit Deliverables Expected

1. Comprehensive security assessment report
2. Severity classification (Critical/High/Medium/Low/Informational)
3. Recommended fixes for all findings
4. Verification of fixes after remediation
5. Final audit certificate
6. Solana-specific security recommendations

---

## 12. Additional Resources

- **Invariants**: `docs/INVARIANTS.md`
- **Threat Model**: `docs/THREAT_MODEL.md`
- **Property Tests**: `programs/kernel-token/src/property_tests.rs`

---

## Appendix A: Key Instruction Signatures

### Staking

```rust
pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()>
pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()>
pub fn claim_reflections(ctx: Context<ClaimReflections>) -> Result<()>
```

### Fee Management

```rust
pub fn propose_fee_update(
    ctx: Context<ProposeFeeUpdate>,
    new_reflection_bps: u16,
    new_lp_bps: u16,
    new_burn_bps: u16,
) -> Result<()>

pub fn execute_fee_update(ctx: Context<ExecuteFeeUpdate>) -> Result<()>
pub fn cancel_fee_proposal(ctx: Context<CancelFeeProposal>) -> Result<()>
```

### Authority

```rust
pub fn propose_authority_transfer(
    ctx: Context<ProposeAuthorityTransfer>,
    new_authority: Pubkey,
) -> Result<()>

pub fn execute_authority_transfer(
    ctx: Context<ExecuteAuthorityTransfer>,
) -> Result<()>
```

---

## Appendix B: Compute Budget

| Instruction | CU Estimate |
|-------------|-------------|
| `initialize` | ~50,000 |
| `stake` | ~30,000 |
| `unstake` | ~35,000 |
| `claim_reflections` | ~25,000 |
| `propose_fee_update` | ~20,000 |
| `execute_fee_update` | ~15,000 |
| `airdrop` (50 recipients) | ~200,000 |

---

*End of Audit Submission Package*
