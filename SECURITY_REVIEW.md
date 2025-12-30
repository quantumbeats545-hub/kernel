# Kernel Token Security Review

**Reviewed by:** Claude Code (Tab 5)
**Date:** 2025-12-25
**Program:** kernel-token
**Version:** 0.1.0
**Framework:** Anchor

---

## Executive Summary

The `kernel-token` program is a Solana-based staking and reflection mechanism for the $KERNEL meme token. The program implements:
- Staking with reflection rewards (2%)
- LP allocation tracking (2%)
- Token burning (1%)
- Timelock-protected fee updates
- Emergency multisig fee override

**Overall Assessment: LOW-MEDIUM RISK**

The program follows Solana/Anchor security best practices with proper authority validation, checked arithmetic, and PDA-based access control. Several design considerations and minor issues are noted below.

---

## Fee Mechanism Analysis

### 5% Total Fee Distribution

The program tracks fee distribution percentages but **does not implement automatic transfer fees**. Fees must be collected externally (e.g., via Token-2022 transfer hook or off-chain fee harvesting) and then deposited via:

| Function | Purpose | BPS |
|----------|---------|-----|
| `deposit_reflections()` | Distribute to stakers | 200 (2%) |
| `allocate_to_lp()` | Add to liquidity pool | 200 (2%) |
| `burn_tokens()` | Reduce supply | 100 (1%) |

**Validation:** Fee shares must always total exactly 500 BPS (5%). Enforced at:
- `initialize()` - Line 34-36
- `propose_fee_update()` - Line 364-367
- `update_fees()` - Line 437-439

```rust
require!(
    reflection_share_bps + lp_share_bps + burn_share_bps == 500,
    KernelError::InvalidFeeConfig
);
```

---

## Security Checklist

### 1. Reentrancy Vulnerabilities

| Status | Finding |
|--------|---------|
| **PASS** | Solana's single-threaded runtime prevents traditional reentrancy |
| **PASS** | State updates occur after CPI calls (good practice) |
| **PASS** | All PDAs use proper seeds and bump validation |

### 2. Integer Overflow/Underflow

| Status | Finding |
|--------|---------|
| **PASS** | All arithmetic uses `checked_add`, `checked_sub`, `checked_mul`, `checked_div` |
| **PASS** | `saturating_sub` used appropriately for reward calculations (Line 236, 625) |
| **INFO** | `unwrap()` on checked operations will panic on overflow - this is safer than silent wraparound |

**Key calculations reviewed:**
- `calculate_pending_rewards()` - Lines 610-626
- `calculate_reward_debt()` - Lines 628-634
- Staking/unstaking amounts - Lines 99, 104, 166-167
- Reflection distribution - Lines 269-277

### 3. Authority Validation

| Status | Finding |
|--------|---------|
| **PASS** | All admin functions check `config.authority == authority.key()` via Anchor constraints |
| **PASS** | User stake operations validate `user_stake.owner == owner.key()` |
| **PASS** | PDA seeds include mint key preventing cross-mint attacks |

**Protected functions:**
- `deposit_reflections` - Line 836
- `airdrop` - Line 909
- `propose_fee_update` - Line 936
- `execute_fee_update` - Line 964
- `cancel_fee_proposal` - Line 988
- `update_fees` - Line 1015
- `set_paused` - Line 1194
- `transfer_authority` - Line 1210
- All LP operations

### 4. Fee Calculation Accuracy

| Status | Finding |
|--------|---------|
| **PASS** | Uses u128 precision with PRECISION = 1e12 scaling factor |
| **PASS** | `accumulated_per_share` properly tracks per-token reward distribution |
| **INFO** | Precision loss in casting u128 to u64 at Line 625 is safe due to input constraints |

---

## Issues & Recommendations

### HIGH PRIORITY

None identified.

### MEDIUM PRIORITY

#### M-1: `transfer_authority` Lacks Timelock Protection ✅ FIXED

**Location:** Lines 459-522 (now `propose_authority_transfer`, `execute_authority_transfer`, `cancel_authority_transfer`)

**Issue:** Authority can be transferred instantly without a timelock, unlike fee updates which require 24-hour delay.

**Risk:** If authority key is compromised, attacker has immediate control.

**Resolution (2025-12-26):** Implemented 24-hour timelock for authority transfers, matching the fee update pattern:
- `propose_authority_transfer(new_authority)` - Initiates transfer with 24-hour delay
- `execute_authority_transfer()` - Executes after timelock expires
- `cancel_authority_transfer()` - Cancels pending transfer

```rust
// NEW: Timelock-protected authority transfer
pub fn propose_authority_transfer(ctx: Context<ProposeAuthorityTransfer>, new_authority: Pubkey) -> Result<()>
pub fn execute_authority_transfer(ctx: Context<ExecuteAuthorityTransfer>) -> Result<()>
pub fn cancel_authority_transfer(ctx: Context<CancelAuthorityTransfer>) -> Result<()>
```

#### M-2: Emergency `update_fees` Test Mismatch ✅ FIXED

**Location:** Test file Lines 698-754

**Issue:** The test calls `update_fees()` with only authority signature, but the contract requires both `authority` AND `guardian` signers (Lines 1058-1074).

**Impact:** Test will fail if run against current contract.

**Resolution (2025-12-26):** Updated test to include guardian co-signature:
- Added `guardian` keypair to test setup
- Updated `updateFees` test to include `guardian` in accounts and signers
- Added new test case verifying that update fails without guardian signature

### LOW PRIORITY

#### L-1: Inconsistent Pause Checks ✅ FIXED

**Location:** Various functions

**Issue:** Only `stake()` checks `is_paused` (Line 65). Other functions like `unstake()`, `claim_reflections()`, and LP operations do not.

**Assessment:** This is **intentional** to allow users to exit and claim rewards even when protocol is paused.

**Resolution (2025-12-26):** Added documentation to each function explaining the intentional design:
- `unstake()` - Users must always be able to withdraw staked tokens
- `claim_reflections()` - Users must always be able to claim earned rewards
- `allocate_to_lp()` - LP operations should continue to maintain liquidity
- `withdraw_from_lp_vault()` - Emergency withdrawals must always be possible

#### L-2: Unused Variable Warning ✅ FIXED

**Location:** Line 302

**Issue:** `decimals` variable declared but unused in `burn_tokens()`.

**Resolution (2025-12-26):** Prefixed with underscore and added explanatory comment:
```rust
// Note: burn() doesn't require decimals unlike transfer_checked()
let _decimals = ctx.accounts.token_mint.decimals;
```

#### L-3: Airdrop Function Doesn't Transfer Tokens ✅ FIXED

**Location:** Lines 329-378

**Issue:** The `airdrop()` function only updates accounting state, not actual token transfers.

**Resolution (2025-12-26):** Added comprehensive function-level documentation explaining:
- This is intentional for batch processing and off-chain verification
- Token transfers done separately via standard SPL transfers
- Documents the complete airdrop flow with example

---

## Governance Analysis

### Timelock Mechanism

| Feature | Duration | Location |
|---------|----------|----------|
| Fee Update Proposal | 24 hours | `TIMELOCK_DURATION = 24 * 60 * 60` (Line 606) |
| Emergency Override | Instant | Requires authority + guardian signatures |

**Flow:**
1. Authority proposes fee change via `propose_fee_update()`
2. 24-hour timelock begins
3. After timelock, `execute_fee_update()` applies changes
4. Can be cancelled via `cancel_fee_proposal()`

**Emergency path:** `update_fees()` requires BOTH authority AND guardian signatures (multisig pattern).

---

## Test Coverage Assessment

**Current Status:** ✅ All 32 tests passing (2025-12-27)

**Test File:** `tests/kernel-token.ts` (~1,100 lines)

**Test Categories:**
- Initialize (2 tests)
- Staking (3 tests)
- Unstaking (2 tests)
- Reflections (3 tests)
- Burn (1 test)
- Admin Functions (9 tests) - includes authority transfer timelock security tests
- Airdrop Registration (1 test)
- Fee Proposal Timelock (4 tests)
- LP Vault Operations (6 tests)
- Multi-User Reflections (1 test)

**Authority Transfer Timelock Tests (2025-12-27):**
- prevents non-authority from proposing authority transfer
- prevents non-authority from cancelling authority transfer
- prevents executing a cancelled authority transfer

**Remaining Test Coverage Opportunities:**
- Edge cases for precision loss in large reward calculations
- Authority transfer execution after timelock expires (requires time manipulation)

---

## Recommendations Summary

| Priority | Issue | Recommendation | Status |
|----------|-------|----------------|--------|
| MEDIUM | M-1 | Add timelock to `transfer_authority` | ✅ FIXED |
| MEDIUM | M-2 | Fix test to include guardian signature | ✅ FIXED |
| LOW | L-1 | Document intentional pause behavior | ✅ FIXED |
| LOW | L-2 | Fix unused variable warning | ✅ FIXED |
| LOW | L-3 | Enhance airdrop documentation | ✅ FIXED |

---

## Conclusion

The kernel-token program implements a solid staking and reflection mechanism with appropriate security controls for a Solana token. All identified issues have been addressed:

1. ~~Adding timelock protection to authority transfers (M-1)~~ ✅ Fixed 2025-12-26
2. ~~Updating test suite for guardian signature requirement (M-2)~~ ✅ Fixed 2025-12-26
3. ~~Adding tests for LP vault and timelock functionality~~ ✅ Fixed 2025-12-26

No critical vulnerabilities were identified. The program follows Anchor best practices with proper PDA derivation, checked arithmetic, and authority validation.

**Test Coverage:** 32 tests covering all major functionality including fee proposal timelocks, LP vault operations, multi-user reflection distribution, and authority transfer timelock security.

---

*Review conducted as part of Freedom Labs security audit initiative.*
