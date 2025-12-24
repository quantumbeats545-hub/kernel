use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        self, Burn, Mint, TokenAccount, TokenInterface, TransferChecked,
    },
};

declare_id!("BvsKLbUiEVBzfxbKG8ECM4zFzaVw4Rcqj4t2oji2cdkx");

/// $KERNEL Meme Coin Program
/// "The Core of Crypto Security - No Kernel Panics Here!"
///
/// Features:
/// - Reflection pool for 2% holder rewards
/// - Staking mechanism with real token transfers
/// - Community burns (1% auto-burn on fees)
/// - Airdrop distribution system
/// - Fee harvesting for auto-LP

#[program]
pub mod kernel_token {
    use super::*;

    /// Initialize the $KERNEL ecosystem
    /// Sets up staking vault, reflection pool, and program authority
    pub fn initialize(
        ctx: Context<Initialize>,
        reflection_share_bps: u16, // 200 = 2%
        lp_share_bps: u16,         // 200 = 2%
        burn_share_bps: u16,       // 100 = 1%
    ) -> Result<()> {
        require!(
            reflection_share_bps + lp_share_bps + burn_share_bps == 500,
            KernelError::InvalidFeeConfig
        );

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.token_mint = ctx.accounts.token_mint.key();
        config.staking_vault = ctx.accounts.staking_vault.key();
        config.reflection_pool = ctx.accounts.reflection_pool.key();
        config.reflection_share_bps = reflection_share_bps;
        config.lp_share_bps = lp_share_bps;
        config.burn_share_bps = burn_share_bps;
        config.total_staked = 0;
        config.total_reflections_distributed = 0;
        config.pending_reflections = 0;
        config.accumulated_per_share = 0;
        config.is_paused = false;
        config.bump = ctx.bumps.config;
        config.vault_bump = ctx.bumps.staking_vault;

        msg!("$KERNEL initialized! No kernel panics here!");
        msg!("Staking Vault: {}", ctx.accounts.staking_vault.key());
        msg!("Reflection Pool: {}", ctx.accounts.reflection_pool.key());

        Ok(())
    }

    /// Stake $KERNEL to earn reflections
    /// Transfers tokens from user to staking vault
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, KernelError::ZeroAmount);
        require!(!ctx.accounts.config.is_paused, KernelError::ProgramPaused);

        let user_stake = &mut ctx.accounts.user_stake;
        let config = &mut ctx.accounts.config;

        // Calculate pending rewards before updating stake
        if user_stake.staked_amount > 0 && config.accumulated_per_share > 0 {
            let pending = calculate_pending_rewards(
                user_stake.staked_amount,
                config.accumulated_per_share,
                user_stake.reward_debt,
            );
            user_stake.pending_rewards = user_stake.pending_rewards.checked_add(pending).unwrap();
        }

        // Transfer tokens from user to staking vault
        let decimals = ctx.accounts.token_mint.decimals;

        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.staking_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
            decimals,
        )?;

        // Update stake
        user_stake.owner = ctx.accounts.owner.key();
        user_stake.staked_amount = user_stake.staked_amount.checked_add(amount).unwrap();
        user_stake.stake_time = Clock::get()?.unix_timestamp;
        user_stake.bump = ctx.bumps.user_stake;

        // Update global state
        config.total_staked = config.total_staked.checked_add(amount).unwrap();

        // Update reward debt
        user_stake.reward_debt = calculate_reward_debt(
            user_stake.staked_amount,
            config.accumulated_per_share,
        );

        msg!("Staked {} $KERNEL. Total staked: {}", amount, config.total_staked);

        Ok(())
    }

    /// Unstake $KERNEL and collect any pending rewards
    /// Transfers tokens from staking vault back to user
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        let user_stake = &mut ctx.accounts.user_stake;
        let config = &mut ctx.accounts.config;

        require!(amount > 0, KernelError::ZeroAmount);
        require!(
            user_stake.staked_amount >= amount,
            KernelError::InsufficientStake
        );

        // Calculate and add pending rewards
        if config.accumulated_per_share > 0 {
            let pending = calculate_pending_rewards(
                user_stake.staked_amount,
                config.accumulated_per_share,
                user_stake.reward_debt,
            );
            user_stake.pending_rewards = user_stake.pending_rewards.checked_add(pending).unwrap();
        }

        // Transfer tokens from staking vault back to user
        let mint_key = ctx.accounts.token_mint.key();
        let seeds = &[
            b"staking_vault",
            mint_key.as_ref(),
            &[config.vault_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let decimals = ctx.accounts.token_mint.decimals;

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.staking_vault.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.staking_vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            decimals,
        )?;

        // Update stake
        user_stake.staked_amount = user_stake.staked_amount.checked_sub(amount).unwrap();
        config.total_staked = config.total_staked.checked_sub(amount).unwrap();

        // Update reward debt
        user_stake.reward_debt = calculate_reward_debt(
            user_stake.staked_amount,
            config.accumulated_per_share,
        );

        msg!("Unstaked {} $KERNEL", amount);

        Ok(())
    }

    /// Claim reflection rewards
    /// Transfers pending rewards from reflection pool to user
    pub fn claim_reflections(ctx: Context<ClaimReflections>) -> Result<()> {
        let user_stake = &mut ctx.accounts.user_stake;
        let config = &mut ctx.accounts.config;

        // Calculate total claimable
        let pending = calculate_pending_rewards(
            user_stake.staked_amount,
            config.accumulated_per_share,
            user_stake.reward_debt,
        );
        let total_claimable = user_stake.pending_rewards.checked_add(pending).unwrap();

        require!(total_claimable > 0, KernelError::NothingToClaim);

        // Transfer rewards from reflection pool to user
        let mint_key = ctx.accounts.token_mint.key();
        let seeds = &[
            b"reflection_pool",
            mint_key.as_ref(),
            &[ctx.bumps.reflection_pool],
        ];
        let signer_seeds = &[&seeds[..]];

        let decimals = ctx.accounts.token_mint.decimals;

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.reflection_pool.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.reflection_pool.to_account_info(),
                },
                signer_seeds,
            ),
            total_claimable,
            decimals,
        )?;

        // Update state
        user_stake.pending_rewards = 0;
        user_stake.total_claimed = user_stake.total_claimed.checked_add(total_claimable).unwrap();
        user_stake.reward_debt = calculate_reward_debt(
            user_stake.staked_amount,
            config.accumulated_per_share,
        );

        config.total_reflections_distributed = config
            .total_reflections_distributed
            .checked_add(total_claimable)
            .unwrap();
        config.pending_reflections = config
            .pending_reflections
            .saturating_sub(total_claimable);

        msg!("Claimed {} $KERNEL in reflections!", total_claimable);

        Ok(())
    }

    /// Deposit fees to reflection pool (called after fee harvest)
    /// Updates accumulated_per_share for reward distribution
    pub fn deposit_reflections(ctx: Context<DepositReflections>, amount: u64) -> Result<()> {
        require!(amount > 0, KernelError::ZeroAmount);

        let config = &mut ctx.accounts.config;

        // Transfer tokens from authority to reflection pool
        let decimals = ctx.accounts.token_mint.decimals;

        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.authority_token_account.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.reflection_pool.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
            decimals,
        )?;

        // Update accumulated per share (scaled by 1e12 for precision)
        if config.total_staked > 0 {
            let reward_per_share = (amount as u128)
                .checked_mul(PRECISION)
                .unwrap()
                .checked_div(config.total_staked as u128)
                .unwrap();
            config.accumulated_per_share = config
                .accumulated_per_share
                .checked_add(reward_per_share)
                .unwrap();
        }

        config.pending_reflections = config.pending_reflections.checked_add(amount).unwrap();

        msg!("Deposited {} to reflection pool", amount);

        Ok(())
    }

    /// Burn tokens from supply
    /// Actually burns tokens using SPL Token burn instruction
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, KernelError::ZeroAmount);

        // Burn tokens from authority's account
        let decimals = ctx.accounts.token_mint.decimals;

        token_interface::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.authority_token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update burn record
        let burn_record = &mut ctx.accounts.burn_record;
        burn_record.total_burned = burn_record.total_burned.checked_add(amount).unwrap();
        burn_record.burn_count = burn_record.burn_count.checked_add(1).unwrap();
        burn_record.last_burn_time = Clock::get()?.unix_timestamp;
        burn_record.bump = ctx.bumps.burn_record;

        msg!("Burned {} $KERNEL! Total burned: {}", amount, burn_record.total_burned);
        msg!("Colonel Kernel salutes your sacrifice!");

        Ok(())
    }

    /// Airdrop tokens to recipients
    pub fn airdrop(
        ctx: Context<Airdrop>,
        recipients: Vec<Pubkey>,
        amount_per_recipient: u64,
    ) -> Result<()> {
        require!(recipients.len() <= 50, KernelError::TooManyRecipients);
        require!(amount_per_recipient > 0, KernelError::ZeroAmount);

        let airdrop_state = &mut ctx.accounts.airdrop_state;
        let total_amount = (recipients.len() as u64)
            .checked_mul(amount_per_recipient)
            .unwrap();

        airdrop_state.total_airdropped = airdrop_state
            .total_airdropped
            .checked_add(total_amount)
            .unwrap();
        airdrop_state.recipient_count = airdrop_state
            .recipient_count
            .checked_add(recipients.len() as u64)
            .unwrap();
        airdrop_state.bump = ctx.bumps.airdrop_state;

        // Note: Actual token transfers for airdrop are done via separate transactions
        // This just tracks the accounting for the airdrop campaign

        msg!(
            "Airdrop registered: {} $KERNEL to {} recipients!",
            total_amount,
            recipients.len()
        );

        Ok(())
    }

    /// Update fee configuration (owner only, for emergencies)
    pub fn update_fees(
        ctx: Context<UpdateFees>,
        reflection_share_bps: u16,
        lp_share_bps: u16,
        burn_share_bps: u16,
    ) -> Result<()> {
        require!(
            reflection_share_bps + lp_share_bps + burn_share_bps == 500,
            KernelError::InvalidFeeConfig
        );

        let config = &mut ctx.accounts.config;
        config.reflection_share_bps = reflection_share_bps;
        config.lp_share_bps = lp_share_bps;
        config.burn_share_bps = burn_share_bps;

        msg!("Fee config updated by Colonel Kernel!");

        Ok(())
    }

    /// Pause/unpause the program (emergency only)
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.config.is_paused = paused;
        msg!("Program paused: {}", paused);
        Ok(())
    }

    /// Transfer authority to a new address
    pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let old_authority = config.authority;
        config.authority = new_authority;
        msg!("Authority transferred from {} to {}", old_authority, new_authority);
        Ok(())
    }
}

// === CONSTANTS ===

/// Precision for accumulated_per_share calculations (1e12)
const PRECISION: u128 = 1_000_000_000_000;

// === HELPER FUNCTIONS ===

fn calculate_pending_rewards(
    user_staked: u64,
    accumulated_per_share: u128,
    reward_debt: u128,
) -> u64 {
    if user_staked == 0 {
        return 0;
    }

    let accumulated = (user_staked as u128)
        .checked_mul(accumulated_per_share)
        .unwrap()
        .checked_div(PRECISION)
        .unwrap();

    accumulated.saturating_sub(reward_debt) as u64
}

fn calculate_reward_debt(user_staked: u64, accumulated_per_share: u128) -> u128 {
    (user_staked as u128)
        .checked_mul(accumulated_per_share)
        .unwrap()
        .checked_div(PRECISION)
        .unwrap()
}

// === ACCOUNTS ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    /// Staking vault - PDA that holds staked tokens
    #[account(
        init,
        payer = authority,
        seeds = [b"staking_vault", token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = staking_vault,
        token::token_program = token_program,
    )]
    pub staking_vault: InterfaceAccount<'info, TokenAccount>,

    /// Reflection pool - PDA that holds pending reflection rewards
    #[account(
        init,
        payer = authority,
        seeds = [b"reflection_pool", token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = reflection_pool,
        token::token_program = token_program,
    )]
    pub reflection_pool: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        space = 8 + KernelConfig::INIT_SPACE,
        seeds = [b"config", token_mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, KernelConfig>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, KernelConfig>,

    /// User's token account
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Staking vault
    #[account(
        mut,
        seeds = [b"staking_vault", token_mint.key().as_ref()],
        bump = config.vault_bump,
    )]
    pub staking_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserStake::INIT_SPACE,
        seeds = [b"stake", config.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, KernelConfig>,

    /// User's token account
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Staking vault
    #[account(
        mut,
        seeds = [b"staking_vault", token_mint.key().as_ref()],
        bump = config.vault_bump,
    )]
    pub staking_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"stake", config.key().as_ref(), owner.key().as_ref()],
        bump = user_stake.bump,
        constraint = user_stake.owner == owner.key() @ KernelError::NotOwner
    )]
    pub user_stake: Account<'info, UserStake>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ClaimReflections<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, KernelConfig>,

    /// User's token account
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Reflection pool
    #[account(
        mut,
        seeds = [b"reflection_pool", token_mint.key().as_ref()],
        bump,
    )]
    pub reflection_pool: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"stake", config.key().as_ref(), owner.key().as_ref()],
        bump = user_stake.bump,
        constraint = user_stake.owner == owner.key() @ KernelError::NotOwner
    )]
    pub user_stake: Account<'info, UserStake>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct DepositReflections<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ KernelError::NotAuthority
    )]
    pub config: Account<'info, KernelConfig>,

    /// Authority's token account (source of reflection funds)
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Reflection pool
    #[account(
        mut,
        seeds = [b"reflection_pool", token_mint.key().as_ref()],
        bump,
    )]
    pub reflection_pool: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, KernelConfig>,

    /// Authority's token account (source of tokens to burn)
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + BurnRecord::INIT_SPACE,
        seeds = [b"burn", config.key().as_ref()],
        bump
    )]
    pub burn_record: Account<'info, BurnRecord>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Airdrop<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ KernelError::NotAuthority
    )]
    pub config: Account<'info, KernelConfig>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + AirdropState::INIT_SPACE,
        seeds = [b"airdrop", config.key().as_ref()],
        bump
    )]
    pub airdrop_state: Account<'info, AirdropState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateFees<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ KernelError::NotAuthority
    )]
    pub config: Account<'info, KernelConfig>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ KernelError::NotAuthority
    )]
    pub config: Account<'info, KernelConfig>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"config", token_mint.key().as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ KernelError::NotAuthority
    )]
    pub config: Account<'info, KernelConfig>,
}

// === STATE ===

#[account]
#[derive(InitSpace)]
pub struct KernelConfig {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub staking_vault: Pubkey,
    pub reflection_pool: Pubkey,
    pub reflection_share_bps: u16,  // 200 = 2%
    pub lp_share_bps: u16,          // 200 = 2%
    pub burn_share_bps: u16,        // 100 = 1%
    pub total_staked: u64,
    pub total_reflections_distributed: u64,
    pub pending_reflections: u64,
    pub accumulated_per_share: u128, // Scaled by PRECISION for accuracy
    pub is_paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserStake {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub stake_time: i64,
    pub pending_rewards: u64,
    pub total_claimed: u64,
    pub reward_debt: u128,  // Changed to u128 for precision
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BurnRecord {
    pub total_burned: u64,
    pub burn_count: u64,
    pub last_burn_time: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AirdropState {
    pub total_airdropped: u64,
    pub recipient_count: u64,
    pub bump: u8,
}

// === ERRORS ===

#[error_code]
pub enum KernelError {
    #[msg("Invalid fee configuration - must total 500 bps (5%)")]
    InvalidFeeConfig,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient staked balance")]
    InsufficientStake,
    #[msg("Nothing to claim - keep staking!")]
    NothingToClaim,
    #[msg("You don't own this stake")]
    NotOwner,
    #[msg("Not authorized - Colonel Kernel says no!")]
    NotAuthority,
    #[msg("Too many recipients (max 50)")]
    TooManyRecipients,
    #[msg("Program is paused")]
    ProgramPaused,
}
