# Security Policy - Kernel Token ($KERNEL)

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### Contact

**Email**: security@sovereignlabs.com.au

For urgent issues affecting user funds:
**Emergency**: security@sovereignlabs.com.au (subject: URGENT)

### Scope

This security policy covers:
- `kernel-token` Anchor program (Program ID: `5QVVrCBUgqjG3pWcSmRkqaagFaokaAwgoFFDLXBJgFJw`)
- Staking vault and reflection pool logic
- LP vault management
- Fee distribution mechanisms

### Out of Scope

- Third-party programs (SPL Token, Token-2022, etc.)
- Raydium/DEX integrations
- Frontend-only issues without program impact
- Already disclosed issues

## Bug Bounty

We offer bounties for responsibly disclosed vulnerabilities:

| Severity | Bounty Range |
|----------|--------------|
| Critical (funds at risk) | $5,000 - $50,000 |
| High (significant impact) | $1,000 - $5,000 |
| Medium (moderate impact) | $500 - $1,000 |
| Low (minor impact) | $100 - $500 |

### Eligibility

- First reporter of a unique vulnerability
- Responsible disclosure (no public disclosure before fix)
- No exploitation on mainnet
- Clear proof of concept

### Process

1. Email security@sovereignlabs.io with:
   - Description of the vulnerability
   - Steps to reproduce
   - Proof of concept (code or transaction)
   - Your Solana address for bounty payment

2. We will respond within 48 hours

3. After verification, we will:
   - Confirm severity and bounty amount
   - Work on a fix
   - Coordinate disclosure timeline
   - Pay bounty upon fix deployment

## Security Measures

### Anchor Program
- Audited by [Auditor Name] - [Date]
- Comprehensive test coverage
- 24-hour timelock on authority transfers
- 24-hour timelock on fee configuration changes
- Guardian co-signature for emergency actions
- Squads multi-sig for authority key

### User Protections
- Users can ALWAYS unstake (even when paused)
- Users can ALWAYS claim reflections (even when paused)
- Staking vault is PDA-controlled (no admin access to user funds)

### Operations
- Hardware wallet signers via Squads
- Multi-signature requirements
- Timelock delays on sensitive operations

## Responsible Disclosure

- **DO NOT** disclose publicly until we have deployed a fix
- **DO NOT** exploit the vulnerability on mainnet
- **DO NOT** access or modify user data beyond PoC
- **DO** provide us reasonable time to fix (typically 90 days)

## Safe Harbor

We will not pursue legal action against researchers who:
- Act in good faith
- Avoid privacy violations
- Avoid data destruction
- Report vulnerabilities responsibly

---

Last Updated: December 27, 2025
