# Threat Model - Kernel Token ($KERNEL)

**Version**: 1.0
**Last Updated**: December 27, 2025
**Status**: Pre-Audit

---

## System Overview

Kernel is a Solana Anchor program implementing:
- **Staking**: Users stake $KERNEL to earn reflections
- **Reflections**: 2% of fees distributed to stakers
- **LP Vault**: 2% of fees allocated to liquidity
- **Burns**: 1% of fees burned permanently
- **Timelocks**: 24-hour delay on authority and fee changes

**Program ID**: `5QVVrCBUgqjG3pWcSmRkqaagFaokaAwgoFFDLXBJgFJw`

## Assets at Risk

| Asset | Location | Value Estimate | Priority |
|-------|----------|----------------|----------|
| Staked tokens | Staking Vault PDA | Variable | Critical |
| Reflection rewards | Reflection Pool PDA | Variable | Critical |
| LP allocation | LP Vault PDA | Variable | High |
| Authority control | Config account | Protocol control | Critical |

---

## Threat Actors

### 1. External Attacker
- **Motivation**: Drain staking vault or reflection pool
- **Capabilities**: CPI exploitation, PDA manipulation
- **Resources**: High

### 2. Malicious Authority
- **Motivation**: Rug pull, fee manipulation
- **Capabilities**: Legitimate authority access
- **Resources**: Direct access

### 3. Compromised Signer
- **Motivation**: Varied (coercion, bribery)
- **Capabilities**: One of N multi-sig keys
- **Resources**: Partial access

### 4. MEV Bot
- **Motivation**: Value extraction
- **Capabilities**: Transaction ordering, sandwiching
- **Resources**: High (automated)

---

## Attack Vectors

### AV-1: Authority Key Compromise

**Target**: Authority keypair (ideally Squads vault)
**Method**: Phishing, malware, social engineering
**Impact**: Critical - Can pause, change fees, propose authority transfer

**Timelock Protection**:
| Action | Timelock | Window |
|--------|----------|--------|
| Authority transfer | 24 hours | Cancellable |
| Fee configuration | 24 hours | Cancellable |
| Emergency fee change | None | Requires guardian co-sign |
| Pause/unpause | None | Immediate |

**Attack Timeline**:
```
T+0:  Attacker compromises authority
T+0:  Attacker proposes authority transfer to attacker wallet
T+0:  Team detects suspicious proposal
T+0 to T+24h: Team cancels proposal
T+24h: If not cancelled, attacker executes transfer
```

**Mitigations**:
- Squads multi-sig (2/3 or 3/5)
- Monitoring for pending proposals
- Guardian required for emergency actions

**Residual Risk**: Low (with monitoring)

---

### AV-2: Staking Vault Drain

**Target**: Tokens in staking vault PDA
**Method**: Unauthorized CPI, PDA seed manipulation
**Impact**: Critical - Loss of all staked user funds

**PDA Security Analysis**:
```rust
// Staking vault PDA
seeds = [b"staking_vault", token_mint.key().as_ref()]
authority = staking_vault (self-authority)
```

| Attack | Mitigation |
|--------|------------|
| Direct transfer | PDA is self-authority, no external signer |
| CPI from malicious program | Anchor checks program ownership |
| Seed collision | Seeds include mint key |

**Verified Controls**:
- [ ] `unstake()` verifies user_stake.owner == signer
- [ ] Transfer uses PDA signer seeds correctly
- [ ] Amount <= user's staked balance

**Residual Risk**: Very Low (if controls verified)

---

### AV-3: Reflection Pool Manipulation

**Target**: Reflection pool PDA, accumulated_per_share
**Method**: Manipulate reward calculations
**Impact**: High - Steal other users' rewards

**Attack Scenarios**:

| Scenario | Method | Mitigation |
|----------|--------|------------|
| Claim more than entitled | Forge reward_debt | PDA-controlled, stored on-chain |
| Inflate accumulated_per_share | Fake deposit | Only authority can deposit |
| Double-claim | Re-enter claim | No external calls during claim |
| Precision attack | Overflow/underflow | u128 precision, checked math |

**Calculation Verification**:
```rust
pending = (staked * accumulated_per_share / PRECISION) - reward_debt
```
- PRECISION = 1e12 (sufficient for most cases)
- All math uses checked operations
- reward_debt updated after each stake/unstake/claim

**Residual Risk**: Low

---

### AV-4: Fee Proposal Front-Running

**Target**: Fee configuration timelock
**Method**: Monitor mempool, extract value before change
**Impact**: Medium - Arbitrage on fee changes

**Scenario**:
1. Authority proposes fee change (e.g., lower LP share)
2. Attacker sees pending tx
3. Attacker front-runs to extract value during window

**Mitigations**:
- 24-hour timelock gives time to cancel malicious proposals
- Timelocks are public - community can monitor
- Fee changes limited (must sum to 500 bps)

**Residual Risk**: Low

---

### AV-5: LP Vault Exploitation

**Target**: LP vault token account
**Method**: Unauthorized withdrawal, fake deployment records
**Impact**: High - Loss of LP allocation

**Controls**:
```rust
// Withdraw requires authority signature
constraint = config.authority == authority.key()

// Record requires authority signature
constraint = config.authority == authority.key()
```

**Attack Scenarios**:
| Scenario | Mitigation |
|----------|------------|
| Unauthorized withdraw | Authority signature required |
| Fake deployment record | No direct fund access from record |
| Withdraw more than pending | `pending_deployment >= amount` check |

**Residual Risk**: Low

---

### AV-6: Pause Bypass

**Target**: Staking function when paused
**Method**: Find code path that bypasses is_paused check
**Impact**: Medium - Policy violation

**Analysis**:
```rust
// stake() checks is_paused
require!(!ctx.accounts.config.is_paused, KernelError::ProgramPaused);

// unstake() intentionally does NOT check is_paused
// claim_reflections() intentionally does NOT check is_paused
```

**Design Decision**: Users can always withdraw, even when paused. This is a FEATURE, not a bug.

**Residual Risk**: None (by design)

---

### AV-7: Airdrop Accounting Manipulation

**Target**: Airdrop state account
**Method**: Inflate recipient count or amounts
**Impact**: Low - Accounting only, no fund movement

**Analysis**:
```rust
// airdrop() only updates accounting
// Does NOT transfer tokens
airdrop_state.total_airdropped += total_amount;
airdrop_state.recipient_count += recipients.len();
```

**Risk**: Attacker could register fake airdrops, but this doesn't move tokens.

**Residual Risk**: Very Low (accounting only)

---

### AV-8: Cross-Program Invocation Attack

**Target**: Token transfers via CPI
**Method**: Malicious program calling kernel_token
**Impact**: Critical if successful

**Solana/Anchor Protections**:
- Program ID verification on all accounts
- Signer verification on authority
- PDA verification via seeds

**Verified Controls**:
- [ ] All CPI uses correct token program
- [ ] Authority signer required for privileged ops
- [ ] User signer required for user ops

**Residual Risk**: Very Low (Anchor framework)

---

### AV-9: Token-2022 Compatibility Issues

**Target**: Token operations
**Method**: Exploit Token-2022 specific features
**Impact**: Medium to High

**Considerations**:
- Transfer hooks could interfere with staking
- Fee-on-transfer could cause accounting issues
- Extensions could have unexpected behavior

**Mitigations**:
- Program uses `token_interface` for compatibility
- Explicit decimals handling in transfers
- Test with Token-2022 mints

**Residual Risk**: Medium (requires testing)

---

### AV-10: Guardian Key Compromise

**Target**: Guardian key (for emergency fee updates)
**Method**: Phishing, theft
**Impact**: Medium - Can bypass fee timelock (with authority)

**Analysis**:
Emergency fee update requires BOTH:
1. Authority signature (multi-sig)
2. Guardian signature

Single guardian compromise is insufficient.

**Mitigations**:
- Guardian stored offline when not needed
- Different person/entity than authority signers
- Rotate guardian periodically

**Residual Risk**: Low

---

## Trust Assumptions

| Component | Trust Level | Justification |
|-----------|-------------|---------------|
| Authority multi-sig | High | Controls protocol parameters |
| Anchor framework | High | Widely used, audited |
| SPL Token / Token-2022 | High | Solana core |
| Solana runtime | High | Battle-tested |
| Squads multi-sig | High | Audited, widely used |
| Raydium (LP) | Medium | Off-chain integration |

---

## Attack Tree Summary

```
Root: Exploit Kernel Protocol
├── Compromise Authority [AV-1]
│   ├── Single key theft → Multi-sig mitigates
│   ├── Multiple key theft → Geographic distribution
│   └── Social engineering → Training, verification
├── Drain User Funds [AV-2, AV-3]
│   ├── Staking vault → PDA self-authority
│   ├── Reflection pool → Calculation verification
│   └── LP vault → Authority-only access
├── Manipulate Protocol [AV-4, AV-6]
│   ├── Fee changes → 24h timelock
│   └── Pause bypass → By design for user protection
└── Technical Exploits [AV-8, AV-9]
    ├── CPI attacks → Anchor verification
    └── Token-2022 → Requires testing
```

---

## Risk Matrix

| ID | Threat | Likelihood | Impact | Risk Level |
|----|--------|------------|--------|------------|
| AV-1 | Authority Compromise | Low | Critical | Medium |
| AV-2 | Staking Vault Drain | Very Low | Critical | Low |
| AV-3 | Reflection Manipulation | Very Low | High | Low |
| AV-4 | Fee Front-Running | Low | Medium | Low |
| AV-5 | LP Vault Exploit | Very Low | High | Low |
| AV-6 | Pause Bypass | N/A | N/A | None (by design) |
| AV-7 | Airdrop Manipulation | Low | Low | Very Low |
| AV-8 | CPI Attack | Very Low | Critical | Low |
| AV-9 | Token-2022 Issues | Medium | Medium | Medium |
| AV-10 | Guardian Compromise | Low | Medium | Low |

---

## Recommendations

### Critical Priority
1. Deploy Squads multi-sig before mainnet
2. Verify all PDA signer seeds
3. Test extensively with Token-2022

### High Priority
4. Set up proposal monitoring
5. Document guardian key handling
6. Create operational runbooks

### Medium Priority
7. Conduct Raydium integration testing
8. Implement off-chain monitoring
9. Regular authority rotation drills

---

## Audit Scope Recommendations

1. **PDA authority verification** - Ensure PDAs cannot be drained
2. **Reflection math** - Verify precision and edge cases
3. **CPI security** - Validate all cross-program calls
4. **Timelock implementation** - Verify 24-hour delays
5. **Token-2022 compatibility** - Test with extensions

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-27 | Security Team | Initial threat model |
