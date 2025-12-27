# Emergency Procedures - Kernel Token ($KERNEL)

**Last Updated**: December 27, 2025
**Version**: 1.0
**Classification**: Internal - Team Only

---

## Quick Reference

| Emergency Type | Severity | First Action | Response Time |
|----------------|----------|--------------|---------------|
| Authority key compromise | Critical | Pause program | < 15 minutes |
| Program exploit | Critical | Pause program | < 15 minutes |
| Reflection pool drain | High | Pause staking | < 30 minutes |
| LP vault compromise | High | Withdraw LP funds | < 30 minutes |
| Staking vault issue | Medium | Assess before action | < 1 hour |
| Frontend compromise | Medium | Take down frontend | < 30 minutes |

---

## Emergency Contacts

```
INCIDENT COMMANDER: [Name] - [Phone] - [Signal]
TECH LEAD:          [Name] - [Phone] - [Signal]
OPS LEAD:           [Name] - [Phone] - [Signal]
GUARDIAN HOLDER:    [Name] - [Phone] - [Signal]

Squads Signers Available 24/7:
- Signer 1: [Name] - [Timezone] - [Phone]
- Signer 2: [Name] - [Timezone] - [Phone]
- Signer 3: [Name] - [Timezone] - [Phone]
```

---

## Program Constants

```
PROGRAM_ID: 5QVVrCBUgqjG3pWcSmRkqaagFaokaAwgoFFDLXBJgFJw
TIMELOCK_DURATION: 24 hours (86400 seconds)
```

---

## Scenario 1: Authority Key Compromise

### Indicators
- Unauthorized transactions from authority wallet
- Authority wallet drained
- Phishing/social engineering attempt
- Hardware wallet lost/stolen

### Immediate Actions (< 15 minutes)

1. **Pause the program immediately:**
   ```typescript
   await program.methods
     .setPaused(true)
     .accounts({
       authority: authorityPubkey,
       tokenMint: KERNEL_MINT,
       config: configPda,
     })
     .signers([authorityKeypair])
     .rpc();
   ```

2. **Alert all Squads signers**

3. **Check if authority transfer was initiated:**
   ```bash
   # Look for pending authority transfer account
   solana account <PENDING_TRANSFER_PDA> --output json
   ```

4. **If transfer pending, wait for timelock to expire and cancel:**
   - You have 24 hours from proposal to cancel
   - Use `cancel_authority_transfer()` before attacker can execute

### Secondary Actions (< 1 hour)

5. **Propose new authority transfer to backup Squads:**
   ```typescript
   await program.methods
     .proposeAuthorityTransfer(BACKUP_SQUADS_VAULT)
     .accounts({
       authority: authorityPubkey,
       tokenMint: KERNEL_MINT,
       config: configPda,
       pendingTransfer: pendingTransferPda,
       systemProgram: SystemProgram.programId,
     })
     .rpc();
   ```

6. **After 24 hours, execute transfer:**
   ```typescript
   await program.methods
     .executeAuthorityTransfer()
     .accounts({
       authority: authorityPubkey,
       tokenMint: KERNEL_MINT,
       config: configPda,
       pendingTransfer: pendingTransferPda,
     })
     .rpc();
   ```

### Important Notes

- Users can ALWAYS unstake and claim, even when paused
- Only staking new tokens is blocked when paused
- LP operations continue during pause

---

## Scenario 2: Program Exploit

### Indicators
- Unexpected token movements from PDAs
- Reflection pool or staking vault drained
- Unusual account creations
- Community reports of stolen funds

### Immediate Actions (< 15 minutes)

1. **Pause the program:**
   ```typescript
   await program.methods
     .setPaused(true)
     .accounts({...})
     .rpc();
   ```

2. **Check PDA balances:**
   ```bash
   # Staking vault
   spl-token balance <STAKING_VAULT_PDA>

   # Reflection pool
   spl-token balance <REFLECTION_POOL_PDA>

   # LP vault
   spl-token balance <LP_VAULT_TOKEN_PDA>
   ```

3. **If LP vault has funds at risk:**
   ```typescript
   // Emergency withdraw from LP vault
   await program.methods
     .withdrawFromLpVault(amount)
     .accounts({
       authority: authorityPubkey,
       tokenMint: KERNEL_MINT,
       config: configPda,
       lpVault: lpVaultPda,
       authorityTokenAccount: authorityAta,
       lpVaultToken: lpVaultTokenPda,
       tokenProgram: TOKEN_2022_PROGRAM_ID,
     })
     .rpc();
   ```

4. **Document all suspicious transactions:**
   - Transaction signatures
   - Accounts involved
   - Amounts
   - Timestamps

### Analysis Actions

5. **Download transaction history:**
   ```bash
   solana transaction-history <PROGRAM_ID> --limit 1000
   ```

6. **Contact security researchers if needed:**
   - Neodyme
   - OtterSec
   - Trail of Bits

7. **Prepare incident report**

---

## Scenario 3: Reflection Pool Drain

### Indicators
- Reflection pool balance unexpectedly low/zero
- Users unable to claim reflections
- Excessive claims by single address

### Immediate Actions

1. **Check reflection pool balance:**
   ```bash
   spl-token balance <REFLECTION_POOL_PDA>
   ```

2. **Check accumulated_per_share in config:**
   ```typescript
   const config = await program.account.kernelConfig.fetch(configPda);
   console.log("accumulated_per_share:", config.accumulatedPerShare.toString());
   console.log("pending_reflections:", config.pendingReflections.toString());
   ```

3. **If exploit detected, pause program:**
   ```typescript
   await program.methods.setPaused(true).accounts({...}).rpc();
   ```

4. **Review recent claim transactions:**
   ```bash
   solana transaction-history <REFLECTION_POOL_PDA> --limit 100
   ```

### Recovery Actions

5. **Calculate actual vs expected distributions**
6. **If legitimate bug, prepare patch**
7. **If exploit, coordinate with security team**

---

## Scenario 4: Fee Proposal Attack

### Indicators
- Malicious fee proposal detected
- Fees proposed to change to extreme values
- Unauthorized proposal from authority

### Immediate Actions

1. **Check pending fee proposal:**
   ```typescript
   const proposal = await program.account.feeProposal.fetch(feeProposalPda);
   console.log("Proposed fees:", {
     reflection: proposal.reflectionShareBps,
     lp: proposal.lpShareBps,
     burn: proposal.burnShareBps,
     proposedAt: proposal.proposedAt.toString(),
     executed: proposal.executed,
     cancelled: proposal.cancelled,
   });
   ```

2. **Cancel the proposal (within 24 hours):**
   ```typescript
   await program.methods
     .cancelFeeProposal()
     .accounts({
       authority: authorityPubkey,
       tokenMint: KERNEL_MINT,
       config: configPda,
       feeProposal: feeProposalPda,
     })
     .rpc();
   ```

3. **Investigate how proposal was created**

### Prevention

- All fee proposals should go through Squads
- Monitor for unexpected proposals
- Set up alerts for proposal events

---

## Scenario 5: Frontend/RPC Compromise

### Indicators
- Phishing site detected
- Users reporting wrong addresses
- RPC returning manipulated data

### Immediate Actions

1. **Alert community via trusted channels:**
   - Twitter (verified)
   - Discord announcement
   - Telegram broadcast

2. **Take down compromised frontend:**
   ```bash
   vercel rm production
   ```

3. **Verify RPC integrity:**
   ```bash
   # Compare results from multiple RPCs
   solana cluster-version --url https://api.mainnet-beta.solana.com
   solana cluster-version --url https://your-rpc.com
   ```

4. **Redeploy clean frontend from verified source**

### Recovery

5. **Rotate hosting credentials**
6. **Review DNS settings**
7. **Enable additional security (2FA, etc.)**

---

## Scenario 6: Raydium Pool Attack

### Indicators
- Sudden KERNEL price crash
- Large LP removals
- Flash loan activity detected

### Immediate Actions

1. **Do NOT add liquidity during attack**

2. **Check LP deployment records:**
   ```typescript
   const deployment = await program.account.lpDeployment.fetch(deploymentPda);
   console.log("LP deployment:", {
     pool: deployment.poolAddress.toString(),
     kernelAmount: deployment.kernelAmount.toString(),
     lpTokens: deployment.lpTokensReceived.toString(),
     withdrawn: deployment.withdrawn,
   });
   ```

3. **Document the attack:**
   - Transaction signatures
   - Pool address
   - Amounts involved

4. **Contact Raydium team if pool-level issue**

---

## User Communication Templates

### Pause Announcement
```
⚠️ KERNEL Program Temporarily Paused

We have detected [issue type] and have paused new staking as a precaution.

✅ Your staked tokens are SAFE
✅ You CAN unstake at any time
✅ You CAN claim reflections

We are investigating and will provide updates.

DO NOT interact with any unofficial links.
```

### Exploit Detected
```
🚨 Security Incident - KERNEL

We have detected a potential exploit and have paused the program.

Your Actions:
1. DO NOT interact with the program
2. DO NOT click any unofficial links
3. Wait for our official update

Your staked tokens are protected by program design.

Updates: [official channel link]
```

### Resolution Announcement
```
✅ KERNEL Program Resumed

The issue has been resolved. Normal operations have resumed.

Summary:
- Cause: [brief description]
- Impact: [affected users/funds]
- Resolution: [what was done]

Thank you for your patience.
```

---

## Post-Incident Checklist

- [ ] Incident timeline documented
- [ ] Root cause identified
- [ ] Affected users quantified
- [ ] Patches applied (if any)
- [ ] Authority keys rotated (if compromised)
- [ ] Team debriefed
- [ ] Community updated
- [ ] Post-mortem published
- [ ] Preventive measures implemented
- [ ] This document updated

---

## Backup Addresses

```
# Emergency Squads Vaults
BACKUP_OPERATIONS_SQUAD=<pubkey>
EMERGENCY_TREASURY_SQUAD=<pubkey>

# Cold Storage (hardware only)
COLD_BACKUP_1=<pubkey>
COLD_BACKUP_2=<pubkey>

# Guardian (for emergency fee updates)
GUARDIAN_KEY=<pubkey>
```

---

## Important Links

- Solana Explorer: https://explorer.solana.com
- Squads App: https://v4.squads.so
- Raydium: https://raydium.io
- Program Dashboard: [internal link]
- Emergency Telegram: [link]

---

## Document Maintenance

- Review quarterly
- Update after incidents
- Test with tabletop exercises
- Distribute to all emergency responders
