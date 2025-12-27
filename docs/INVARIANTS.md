# Formal Verification Invariants - Kernel Token

**Version**: 1.0
**Last Updated**: December 27, 2025
**Purpose**: Define critical invariants for fuzzing and audit

---

## Overview

This document defines invariants for the $KERNEL Anchor program. While Solana/Anchor doesn't have the same formal verification tooling as EVM, these invariants guide:
- Property-based testing (proptest)
- Fuzz testing
- Manual audit review
- Trident fuzzing framework

---

## Staking Invariants

### ST-1: Staking Vault Balance
```
INVARIANT: Staking vault balance equals sum of all staked amounts
FORMAL: vault_balance = Σ(user_stake.staked_amount) for all users
```

### ST-2: Individual Stake Bound
```
INVARIANT: User cannot unstake more than staked
FORMAL: ∀ user u, unstake_amount a:
  unstake(u, a) succeeds → a ≤ user_stake[u].staked_amount
```

### ST-3: Total Staked Consistency
```
INVARIANT: config.total_staked equals sum of all user stakes
FORMAL: config.total_staked = Σ(user_stake[u].staked_amount) for all u
```

### ST-4: Stake Non-Negativity
```
INVARIANT: Staked amount is never negative
FORMAL: ∀ user u: user_stake[u].staked_amount ≥ 0
```

### ST-5: Stake Time Recording
```
INVARIANT: Stake time is set to current timestamp on stake
FORMAL: ∀ stake operation at time t:
  user_stake.stake_time = t
```

---

## Reflection Invariants

### RF-1: Reflection Pool Solvency
```
INVARIANT: Reflection pool can cover all pending rewards
FORMAL: reflection_pool_balance ≥ Σ(pending_rewards(u)) for all stakers u
```

### RF-2: Reward Debt Consistency
```
INVARIANT: Reward debt is updated correctly on stake changes
FORMAL: ∀ stake/unstake by user u:
  user_stake[u].reward_debt =
    user_stake[u].staked_amount * config.accumulated_per_share / PRECISION
```

### RF-3: Accumulated Per Share Monotonicity
```
INVARIANT: accumulated_per_share never decreases
FORMAL: ∀ t1 < t2:
  config.accumulated_per_share(t1) ≤ config.accumulated_per_share(t2)
```

### RF-4: Total Distributed Tracking
```
INVARIANT: total_reflections_distributed tracks all claims
FORMAL: config.total_reflections_distributed =
  Σ(user_stake[u].total_claimed) for all u
```

### RF-5: Pending Rewards Calculation
```
INVARIANT: Pending rewards are calculated correctly
FORMAL: ∀ user u:
  pending(u) = (staked * accumulated_per_share / PRECISION) - reward_debt
```

---

## Fee Configuration Invariants

### FC-1: Fee Sum Constraint
```
INVARIANT: Fees always sum to 500 bps (5%)
FORMAL: reflection_share_bps + lp_share_bps + burn_share_bps = 500
```

### FC-2: Fee Bounds
```
INVARIANT: Individual fees are bounded
FORMAL:
  0 ≤ reflection_share_bps ≤ 500
  0 ≤ lp_share_bps ≤ 500
  0 ≤ burn_share_bps ≤ 500
```

---

## Timelock Invariants

### TL-1: Proposal Execution Delay
```
INVARIANT: Fee proposals cannot execute before 24 hours
FORMAL: ∀ fee_proposal p:
  can_execute(p) →
    current_time - p.proposed_at ≥ TIMELOCK_DURATION (86400)
```

### TL-2: Authority Transfer Delay
```
INVARIANT: Authority transfers cannot execute before 24 hours
FORMAL: ∀ pending_transfer t:
  can_execute(t) →
    current_time - t.proposed_at ≥ TIMELOCK_DURATION (86400)
```

### TL-3: Proposal Single Execution
```
INVARIANT: Proposals can only be executed once
FORMAL: ∀ proposal p:
  execute(p) succeeds → ¬p.executed_before ∧ p.executed_after
```

### TL-4: Cancelled Proposals Cannot Execute
```
INVARIANT: Cancelled proposals are never executable
FORMAL: ∀ proposal p:
  p.cancelled → ¬can_execute(p)
```

---

## Authority Invariants

### AU-1: Single Authority
```
INVARIANT: Only one authority controls the program
FORMAL: |{addr : is_authority(addr)}| = 1
```

### AU-2: Authority Transfer Atomicity
```
INVARIANT: Authority transfer is atomic
FORMAL: ∀ transfer t:
  execute_transfer(t) →
    old_authority_removed ∧ new_authority_set
```

### AU-3: Authority Function Restriction
```
INVARIANT: Only authority can call privileged functions
FORMAL: ∀ privileged call c:
  c.succeeds → c.signer = config.authority
```

---

## LP Vault Invariants

### LP-1: Pending Deployment Bound
```
INVARIANT: Cannot withdraw more than pending deployment
FORMAL: ∀ withdraw of amount a:
  a ≤ lp_vault.pending_deployment
```

### LP-2: Total Allocated Consistency
```
INVARIANT: total_allocated = total_deployed + pending_deployment
FORMAL: lp_vault.total_allocated =
  lp_vault.total_deployed + lp_vault.pending_deployment
```

### LP-3: Deployment Recording
```
INVARIANT: Deployments reduce pending and increase deployed
FORMAL: ∀ record_deployment(amount):
  pending' = pending - amount
  deployed' = deployed + amount
```

---

## Burn Invariants

### BR-1: Burn Record Accuracy
```
INVARIANT: Burn record matches actual burns
FORMAL: burn_record.total_burned =
  initial_supply - current_supply (accounting for burns only)
```

### BR-2: Burn Count Increment
```
INVARIANT: Each burn increments count by 1
FORMAL: ∀ burn:
  burn_record.burn_count' = burn_record.burn_count + 1
```

### BR-3: Burn Time Recording
```
INVARIANT: Last burn time is updated on burn
FORMAL: ∀ burn at time t:
  burn_record.last_burn_time = t
```

---

## Pause Invariants

### PA-1: Pause Blocks Staking
```
INVARIANT: Staking fails when paused
FORMAL: config.is_paused → ∀ stake(): reverts
```

### PA-2: Unstake Always Works
```
INVARIANT: Unstaking works regardless of pause
FORMAL: ∀ unstake(u, a) where a ≤ stake[u]:
  ¬depends_on(is_paused)
```

### PA-3: Claim Always Works
```
INVARIANT: Claiming works regardless of pause
FORMAL: ∀ claim_reflections(u):
  ¬depends_on(is_paused)
```

---

## Airdrop Invariants

### AD-1: Recipient Limit
```
INVARIANT: Airdrop cannot exceed 50 recipients per call
FORMAL: ∀ airdrop(recipients, _):
  recipients.len() ≤ 50
```

### AD-2: Accounting Only
```
INVARIANT: Airdrop updates accounting but doesn't transfer
FORMAL: ∀ airdrop():
  token_balances unchanged
  airdrop_state.total_airdropped increased
```

---

## PDA Security Invariants

### PDA-1: Staking Vault Authority
```
INVARIANT: Staking vault is self-authority
FORMAL: staking_vault.authority = staking_vault (PDA)
```

### PDA-2: Reflection Pool Authority
```
INVARIANT: Reflection pool is self-authority
FORMAL: reflection_pool.authority = reflection_pool (PDA)
```

### PDA-3: LP Vault Token Authority
```
INVARIANT: LP vault token is self-authority
FORMAL: lp_vault_token.authority = lp_vault_token (PDA)
```

### PDA-4: Seed Uniqueness
```
INVARIANT: PDAs are derived from unique seeds
FORMAL:
  staking_vault: ["staking_vault", mint]
  reflection_pool: ["reflection_pool", mint]
  config: ["config", mint]
  user_stake: ["stake", config, owner]
```

---

## Cross-Instruction Invariants

### CI-1: State Consistency Across Instructions
```
INVARIANT: State remains consistent across any instruction sequence
FORMAL: ∀ instruction sequence S:
  execute(S) → all_invariants_hold
```

### CI-2: No Double Withdrawal
```
INVARIANT: User cannot withdraw same tokens twice
FORMAL: ∀ user u, time t:
  tokens_withdrawn(u, t) ≤ tokens_staked(u, t) + reflections_earned(u, t)
```

---

## Testing Patterns

### Rust Property Tests
```rust
#[cfg(test)]
mod invariant_tests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn fee_sum_always_500(
            reflection in 0u16..=500,
            lp in 0u16..=500,
        ) {
            let burn = 500 - reflection.saturating_sub(lp.min(500 - reflection));
            // Simulate fee update
            prop_assert_eq!(reflection + lp + burn, 500);
        }

        #[test]
        fn stake_unstake_balance(
            stake_amount in 1u64..=1_000_000_000,
            unstake_amount in 1u64..=1_000_000_000,
        ) {
            if unstake_amount <= stake_amount {
                // Should succeed
                let remaining = stake_amount - unstake_amount;
                prop_assert!(remaining >= 0);
            }
        }
    }
}
```

### Trident Fuzz Targets
```rust
// For Trident fuzzing framework
impl FuzzInstruction for KernelFuzz {
    fn check_invariants(&self, accounts: &AccountsState) {
        // FC-1: Fee sum
        let config = accounts.get::<KernelConfig>("config");
        assert_eq!(
            config.reflection_share_bps +
            config.lp_share_bps +
            config.burn_share_bps,
            500
        );

        // ST-3: Total staked consistency
        let total: u64 = accounts
            .get_all::<UserStake>()
            .iter()
            .map(|s| s.staked_amount)
            .sum();
        assert_eq!(config.total_staked, total);
    }
}
```

---

## Audit Focus Areas

Based on these invariants, auditors should focus on:

1. **Reflection Math** (RF-1 through RF-5) - Precision, overflow, edge cases
2. **Timelock Bypass** (TL-1 through TL-4) - Any way to skip delay
3. **PDA Security** (PDA-1 through PDA-4) - Authority verification
4. **Pause Semantics** (PA-1 through PA-3) - User fund access
5. **Fee Constraints** (FC-1, FC-2) - Validation on all paths

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-27 | Security Team | Initial invariants |
