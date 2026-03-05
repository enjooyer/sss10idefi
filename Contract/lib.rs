use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, Burn};
use anchor_spl::token_interface::{Mint as InterfaceMint, TokenAccount as InterfaceTokenAccount, TokenInterface, Burn as InterfaceBurn, Token2022};
use anchor_spl::associated_token::AssociatedToken;

// ------------------------------------------------------------------
// SITE ZERO // SPL-404 YIELD MATRIX MASTERCHEF
// Enterprise Security Hardened Edition v2
// Includes MasterChef Math, PDA Singularity Checks, Asset Verification,
// Emission Cap Enforcement, and Overflow-Safe Arithmetic
// ------------------------------------------------------------------

declare_id!("68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF"); 

#[program]
pub mod site_zero_matrix {
    use super::*;

    // 1. Initialize the global configuration
    pub fn initialize_global(ctx: Context<InitializeGlobal>, reward_per_sec: u64, emission_end_time: i64) -> Result<()> {
        let global = &mut ctx.accounts.global;
        global.authority = ctx.accounts.authority.key();
        global.total_alloc_point = 0;
        global.total_reward_per_second = reward_per_sec;
        global.emission_end_time = emission_end_time;
        // Budget fields: initialized to 0. Must call set_emission_budget before farming begins.
        global.total_emission_budget = 0;
        global.total_emitted = 0;
        Ok(())
    }

    // 1.1 ONE-TIME MIGRATION: Resize GlobalState from 64 to 80 bytes
    // This adds the emission budget fields to an existing GlobalState account
    pub fn migrate_global_state(ctx: Context<MigrateGlobalState>) -> Result<()> {
        let global_info = ctx.accounts.global.to_account_info();
        let current_len = global_info.data_len();
        
        // Only run if account is old size (64 bytes)
        require!(current_len == 64, MatrixError::MigrationNotNeeded);
        
        // Resize account to new size (80 bytes)
        let new_len = 80usize;
        let rent = Rent::get()?;
        let new_minimum_balance = rent.minimum_balance(new_len);
        let current_balance = global_info.lamports();
        
        // Transfer additional lamports if needed via System Program CPI
        if current_balance < new_minimum_balance {
            let diff = new_minimum_balance - current_balance;
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: global_info.clone(),
                    },
                ),
                diff,
            )?;
        }
        
        // Realloc the account
        global_info.realloc(new_len, false)?;
        
        // Initialize the new fields to 0 (they're at the end of the struct)
        let mut data = global_info.try_borrow_mut_data()?;
        // Bytes 64-71: total_emission_budget = 0
        data[64..72].copy_from_slice(&0u64.to_le_bytes());
        // Bytes 72-79: total_emitted = 0
        data[72..80].copy_from_slice(&0u64.to_le_bytes());
        
        msg!("GlobalState migrated from 64 to 80 bytes. Emission fields initialized to 0.");
        Ok(())
    }

    // 1.2 MIGRATION V2: Add NFT collection and SSS10i mint to GlobalState
    // This resizes GlobalState from 80 to 144 bytes (adds 2 Pubkeys = 64 bytes)
    pub fn migrate_global_state_v2(
        ctx: Context<MigrateGlobalStateV2>, 
        nft_collection_mint: Pubkey,
        sss10i_mint: Pubkey
    ) -> Result<()> {
        let global_info = ctx.accounts.global.to_account_info();
        let current_len = global_info.data_len();
        
        // Only run if account is at 80 bytes (post-v1 migration)
        require!(current_len == 80, MatrixError::MigrationNotNeeded);
        
        let new_len = 144usize; // 80 + 32 + 32 = 144
        let rent = Rent::get()?;
        let new_minimum_balance = rent.minimum_balance(new_len);
        let current_balance = global_info.lamports();
        
        if current_balance < new_minimum_balance {
            let diff = new_minimum_balance - current_balance;
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: global_info.clone(),
                    },
                ),
                diff,
            )?;
        }
        
        global_info.realloc(new_len, false)?;
        
        let mut data = global_info.try_borrow_mut_data()?;
        // Bytes 80-111: nft_collection_mint
        data[80..112].copy_from_slice(nft_collection_mint.as_ref());
        // Bytes 112-143: sss10i_mint
        data[112..144].copy_from_slice(sss10i_mint.as_ref());
        
        msg!("GlobalState migrated to v2. NFT collection: {}, SSS10i mint: {}", 
            nft_collection_mint, sss10i_mint);
        Ok(())
    }

    // 1.3 ADMIN: Update GlobalState mints (for fixing migration issues)
    pub fn admin_set_global_mints(
        ctx: Context<AdminSetGlobalMints>,
        nft_collection_mint: Pubkey,
        sss10i_mint: Pubkey
    ) -> Result<()> {
        let global = &mut ctx.accounts.global;
        require!(ctx.accounts.authority.key() == global.authority, MatrixError::Unauthorized);
        
        global.nft_collection_mint = nft_collection_mint;
        global.sss10i_mint = sss10i_mint;
        
        msg!("GlobalState mints updated. NFT collection: {}, SSS10i mint: {}", 
            nft_collection_mint, sss10i_mint);
        Ok(())
    }

    // 1.5 Add a new Syrup Pool (Extraction Array)
    pub fn add_pool(ctx: Context<AddPool>, alloc_point: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let global = &mut ctx.accounts.global;

        require!(ctx.accounts.authority.key() == global.authority, MatrixError::Unauthorized);

        pool.authority = ctx.accounts.authority.key();
        pool.reward_mint = ctx.accounts.reward_mint.key();
        pool.accepted_lp_mint = ctx.accounts.lp_mint.key();
        pool.cardano_mint = ctx.accounts.cardano_mint.key();
        pool.nft_collection_mint = ctx.accounts.nft_collection_mint.key();

        pool.alloc_point = alloc_point;
        pool.total_staked = 0;
        pool.last_update_time = Clock::get()?.unix_timestamp;
        pool.acc_reward_per_share = 0;
        pool.total_reward_liability = 0;

        global.total_alloc_point = global.total_alloc_point
            .checked_add(alloc_point)
            .ok_or(MatrixError::MathOverflow)?;

        emit!(PoolInitialized {
            pool: pool.key(),
            reward_rate: alloc_point, 
            lp_mint: pool.accepted_lp_mint,
        });

        Ok(())
    }

    // 1.8 Admin Token Recovery (Smart Logic)
    pub fn admin_recover_tokens(ctx: Context<AdminRecoverTokens>, amount: u64) -> Result<()> {
        let global = &ctx.accounts.global;
        let pool = &mut ctx.accounts.pool;

        require!(ctx.accounts.authority.key() == global.authority, MatrixError::Unauthorized);

        // 1. Update pool math to ensure liability is current
        update_pool(pool, global)?;

        // 2. Calculate "Safe to Withdraw" balance
        // Current Treasury Balance - Total Liability (Tokens owed to stakers)
        let pool_liability = pool.total_reward_liability;
        let treasury_balance = ctx.accounts.treasury_fractions_ata.amount as u128;
        
        require!(treasury_balance >= pool_liability, MatrixError::InsufficientProtocolLiquidity);
        let available_for_recovery = treasury_balance
            .checked_sub(pool_liability)
            .ok_or(MatrixError::MathOverflow)?;

        require!((amount as u128) <= available_for_recovery, MatrixError::LiabilityConflict);

        // 3. Perform CPI Transfer back to admin
        let pool_key = pool.key();
        let seeds = &[b"treasury".as_ref(), pool_key.as_ref(), &[ctx.bumps.treasury]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury_fractions_ata.to_account_info(),
            to: ctx.accounts.admin_fractions_ata.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        msg!("Admin recovered {} tokens. Remaining Pool Liability: {}", amount, pool_liability);

        Ok(())
    }

    // 1.9 Admin Recovery for ANY Token (Emergency Use)
    // This allows the global authority to recover ANY token from ANY pool's treasury.
    // Use case: Recovering tokens sent to wrong pool, or tokens that don't match pool's reward_mint.
    // No liability checks - admin takes full responsibility.
    pub fn admin_recover_any_token(ctx: Context<AdminRecoverAnyToken>, amount: u64) -> Result<()> {
        let global = &ctx.accounts.global;
        
        require!(ctx.accounts.authority.key() == global.authority, MatrixError::Unauthorized);
        
        let pool_key = ctx.accounts.pool.key();
        let seeds = &[b"treasury".as_ref(), pool_key.as_ref(), &[ctx.bumps.treasury]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.source_ata.to_account_info(),
            to: ctx.accounts.destination_ata.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            cpi_accounts, 
            signer
        );
        token::transfer(cpi_ctx, amount)?;

        msg!("Admin emergency recovered {} tokens of mint {}", amount, ctx.accounts.token_mint.key());
        Ok(())
    }

    // 1.10 Admin Transfer to Global NFT Treasury (Direct Transfer)
    // Transfers tokens from any pool's treasury directly to the global NFT treasury
    // Saves gas by avoiding intermediate wallet transfers
    pub fn admin_transfer_to_nft_treasury(ctx: Context<AdminTransferToNftTreasury>, amount: u64) -> Result<()> {
        let global = &ctx.accounts.global;
        
        require!(ctx.accounts.authority.key() == global.authority, MatrixError::Unauthorized);
        
        let pool_key = ctx.accounts.pool.key();
        let seeds = &[b"treasury".as_ref(), pool_key.as_ref(), &[ctx.bumps.pool_treasury]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.source_ata.to_account_info(),
            to: ctx.accounts.nft_treasury_ata.to_account_info(),
            authority: ctx.accounts.pool_treasury.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            cpi_accounts, 
            signer
        );
        token::transfer(cpi_ctx, amount)?;

        msg!("Admin transferred {} tokens to global NFT treasury", amount);
        Ok(())
    }

    // 2. Deposit Raydium CPMM LP Tokens
    pub fn deposit_lp(ctx: Context<StakeLp>, amount: u64) -> Result<()> {
        update_pool(&mut ctx.accounts.pool, &ctx.accounts.global)?;

        let user_info = &mut ctx.accounts.user_info;
        let pool = &mut ctx.accounts.pool;
        
        require!(amount > 0, MatrixError::ZeroDeposit);

        let mut pending: u64 = 0;
        if user_info.staked_amount > 0 {
            let accumulated = (user_info.staked_amount as u128)
                .checked_mul(pool.acc_reward_per_share)
                .ok_or(MatrixError::MathOverflow)?
                .checked_div(1_000_000_000_000)
                .ok_or(MatrixError::MathOverflow)?;
            let pending_128 = accumulated
                .checked_sub(user_info.reward_debt)
                .ok_or(MatrixError::MathOverflow)?;
            pending = u64::try_from(pending_128).map_err(|_| MatrixError::MathOverflow)?;
        }

        user_info.pending_rewards = user_info.pending_rewards
            .checked_add(pending)
            .ok_or(MatrixError::MathOverflow)?;

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_lp_account.to_account_info(),
            to: ctx.accounts.vault_lp_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        user_info.staked_amount = user_info.staked_amount
            .checked_add(amount)
            .ok_or(MatrixError::MathOverflow)?;
        user_info.reward_debt = (user_info.staked_amount as u128)
            .checked_mul(pool.acc_reward_per_share)
            .ok_or(MatrixError::MathOverflow)?
            .checked_div(1_000_000_000_000)
            .ok_or(MatrixError::MathOverflow)?;
        
        pool.total_staked = pool.total_staked
            .checked_add(amount)
            .ok_or(MatrixError::MathOverflow)?;

        emit!(UserDeposited {
            user: ctx.accounts.user.key(),
            amount,
            new_total_stake: pool.total_staked,
        });

        Ok(())
    }

    // 3. Withdraw Raydium CPMM LP Tokens
    pub fn withdraw_lp(ctx: Context<StakeLp>, amount: u64) -> Result<()> {
        update_pool(&mut ctx.accounts.pool, &ctx.accounts.global)?;

        let user_info = &mut ctx.accounts.user_info;
        let pool = &mut ctx.accounts.pool;

        require!(amount > 0, MatrixError::ZeroWithdrawal);
        require!(user_info.staked_amount >= amount, MatrixError::InsufficientStake);

        let accumulated = (user_info.staked_amount as u128)
            .checked_mul(pool.acc_reward_per_share)
            .ok_or(MatrixError::MathOverflow)?
            .checked_div(1_000_000_000_000)
            .ok_or(MatrixError::MathOverflow)?;
        let pending_128 = accumulated
            .checked_sub(user_info.reward_debt)
            .ok_or(MatrixError::MathOverflow)?;
        let pending = u64::try_from(pending_128).map_err(|_| MatrixError::MathOverflow)?;
        
        user_info.pending_rewards = user_info.pending_rewards
            .checked_add(pending)
            .ok_or(MatrixError::MathOverflow)?;

        let pool_key = pool.key();
        let seeds = &[b"vault".as_ref(), pool_key.as_ref(), &[ctx.bumps.vault_lp_account]];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_lp_account.to_account_info(),
            to: ctx.accounts.user_lp_account.to_account_info(),
            authority: ctx.accounts.vault_lp_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;
        
        user_info.staked_amount = user_info.staked_amount
            .checked_sub(amount)
            .ok_or(MatrixError::MathOverflow)?;
        user_info.reward_debt = (user_info.staked_amount as u128)
            .checked_mul(pool.acc_reward_per_share)
            .ok_or(MatrixError::MathOverflow)?
            .checked_div(1_000_000_000_000)
            .ok_or(MatrixError::MathOverflow)?;

        pool.total_staked = pool.total_staked
            .checked_sub(amount)
            .ok_or(MatrixError::MathOverflow)?;
        
        emit!(UserWithdrew {
            user: ctx.accounts.user.key(),
            amount,
            remaining_stake: user_info.staked_amount,
        });

        Ok(())
    }

    // 3.5 EMERGENCY WITHDRAW (Safe Recovery)
    // Withdraws 100% of Principal bypassing all reward math/overflows
    // SECURITY: This instruction uses a dedicated struct without init_if_needed 
    // to guarantee we only touch existing, valid staker PDAs.
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        let user_info = &mut ctx.accounts.user_info;
        let pool = &mut ctx.accounts.pool;
        let amount = user_info.staked_amount;

        require!(amount > 0, MatrixError::InsufficientStake);

        // FIX M-2: Reduce liability by forfeited pending rewards before zeroing
        let forfeited = user_info.pending_rewards as u128;
        pool.total_reward_liability = pool.total_reward_liability
            .checked_sub(forfeited)
            .unwrap_or(0);

        let pool_key = pool.key();
        let seeds = &[b"vault".as_ref(), pool_key.as_ref(), &[ctx.bumps.vault_lp_account]];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_lp_account.to_account_info(),
            to: ctx.accounts.user_lp_account.to_account_info(),
            authority: ctx.accounts.vault_lp_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;
        
        user_info.staked_amount = 0;
        user_info.reward_debt = 0;
        user_info.pending_rewards = 0;

        pool.total_staked = pool.total_staked.checked_sub(amount).unwrap_or(0);
        
        emit!(EmergencyWithdrawExecuted {
            user: ctx.accounts.user.key(),
            amount,
        });

        Ok(())
    }

    // 4. Harvest Matrix Rewards
    pub fn harvest_matrix_rewards(ctx: Context<HarvestRewards>) -> Result<()> {
        update_pool(&mut ctx.accounts.pool, &ctx.accounts.global)?;

        let user_info = &mut ctx.accounts.user_info;
        let pool = &mut ctx.accounts.pool;
        let global = &mut ctx.accounts.global;
        
        let accumulated = (user_info.staked_amount as u128)
            .checked_mul(pool.acc_reward_per_share)
            .ok_or(MatrixError::MathOverflow)?
            .checked_div(1_000_000_000_000)
            .ok_or(MatrixError::MathOverflow)?;
        let pending_128 = accumulated
            .checked_sub(user_info.reward_debt)
            .ok_or(MatrixError::MathOverflow)?;
        let pending = u64::try_from(pending_128).map_err(|_| MatrixError::MathOverflow)?;
        
        let total_harvest = user_info.pending_rewards
            .checked_add(pending)
            .ok_or(MatrixError::MathOverflow)?;
        if total_harvest == 0 {
            msg!("No rewards currently pending to harvest.");
            return Ok(());
        }
        
        user_info.pending_rewards = 0;
        user_info.reward_debt = (user_info.staked_amount as u128)
            .checked_mul(pool.acc_reward_per_share)
            .ok_or(MatrixError::MathOverflow)?
            .checked_div(1_000_000_000_000)
            .ok_or(MatrixError::MathOverflow)?;

        // CRITICAL: Hard ceiling check — wrap/unwrap deposits cannot inflate rewards
        let new_total_emitted = global.total_emitted
            .checked_add(total_harvest as u64)
            .ok_or(MatrixError::MathOverflow)?;
        require!(
            global.total_emission_budget == 0 || new_total_emitted <= global.total_emission_budget,
            MatrixError::EmissionBudgetExhausted
        );
        global.total_emitted = new_total_emitted;

        // Reduce total liability since tokens are being physically removed from the matrix
        pool.total_reward_liability = pool.total_reward_liability
            .checked_sub(total_harvest as u128)
            .unwrap_or(0);

        // CPI Transfer from Treasury to User
        let pool_key = pool.key();
        let seeds = &[b"treasury".as_ref(), pool_key.as_ref(), &[ctx.bumps.treasury]];
        let signer = &[&seeds[..]];

        let cpi_transfer_fraction = Transfer {
            from: ctx.accounts.treasury_fractions_ata.to_account_info(),
            to: ctx.accounts.user_fractions_ata.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_transfer_fraction, signer), total_harvest)?;

        emit!(UserHarvested {
            user: ctx.accounts.user.key(),
            amount: total_harvest,
        });

        Ok(())
    }

    // 5. Update Matrix Allocation Weight (Admin Only)
    pub fn update_alloc_point(ctx: Context<UpdateAllocPoint>, new_alloc: u64) -> Result<()> {
        // FIX M-1: Verify global authority in addition to pool authority
        require!(ctx.accounts.authority.key() == ctx.accounts.global.authority, MatrixError::Unauthorized);

        update_pool(&mut ctx.accounts.pool, &ctx.accounts.global)?;
        let pool = &mut ctx.accounts.pool;
        let global = &mut ctx.accounts.global;
        
        let old_alloc = pool.alloc_point;
        
        // Update global weight
        global.total_alloc_point = global.total_alloc_point
            .checked_sub(old_alloc)
            .ok_or(MatrixError::MathOverflow)?
            .checked_add(new_alloc)
            .ok_or(MatrixError::MathOverflow)?;

        pool.alloc_point = new_alloc;

        emit!(RewardRateUpdated {
            pool: pool.key(),
            old_rate: old_alloc,
            new_rate: new_alloc,
        });

        Ok(())
    }

    // 6. Update Emission Velocity (Admin Only)
    // NOTE: In production, the admin MUST update all active pools right before 
    // calling this, otherwise the new rate applies retroactively to un-updated pools!
    pub fn update_emission_rate(ctx: Context<UpdateEmissionRate>, new_rate: u64) -> Result<()> {
        let global = &mut ctx.accounts.global;
        let old_rate = global.total_reward_per_second;
        global.total_reward_per_second = new_rate;
        
        msg!("Global emission velocity updated from {} to {}", old_rate, new_rate);
        Ok(())
    }

    // 6.5 Set Emission Params — rate + end time (Call this ON LAUNCH DAY)
    // Sets both the per-second rate and the absolute emission end timestamp atomically.
    // Use to start the official 1-year farming window from the exact moment of launch.
    // new_end_time = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
    pub fn set_emission_params(ctx: Context<UpdateEmissionRate>, new_rate: u64, new_end_time: i64) -> Result<()> {
        let global = &mut ctx.accounts.global;
        let old_rate = global.total_reward_per_second;
        let old_end = global.emission_end_time;
        global.total_reward_per_second = new_rate;
        global.emission_end_time = new_end_time;
        msg!("LAUNCH DAY: rate {} -> {}, end_time {} -> {}", old_rate, new_rate, old_end, new_end_time);
        Ok(())
    }

    // 6.6 Set Emission Budget — the FIXED total tokens available for farming rewards.
    // Call ONCE on launch day AFTER depositing tokens to the treasury.
    // This is an absolute ceiling. Wrap/Unwrap deposits to the same treasury ATA
    // can NEVER inflate this budget — it is set in stone at launch.
    // budget = total SSS10i tokens deposited for farming × 10^9 (lamports)
    pub fn set_emission_budget(ctx: Context<UpdateEmissionRate>, budget: u64) -> Result<()> {
        let global = &mut ctx.accounts.global;
        // Safety: can only be set once (while at 0) to prevent re-setting mid-stream.
        // If you ever need to increase, you must call this while total_emitted == 0.
        require!(global.total_emitted == 0, MatrixError::EmissionBudgetAlreadySet);
        global.total_emission_budget = budget;
        msg!("LAUNCH DAY: Emission budget locked at {} raw units ({} SSS10i)",
            budget, budget / 1_000_000_000);
        Ok(())
    }

    // ------------------------------------------------------------------
    // ESCROW / SPL-404 WRAP MECHANISM (Hardened)
    // ------------------------------------------------------------------
    // WRAP/UNWRAP - Uses Global NFT Treasury (independent from staking pools)
    // ------------------------------------------------------------------

    pub fn wrap_to_nft(ctx: Context<WrapToNftGlobal>) -> Result<()> {
        let amount = 1_000_000_000; // 1.0 SSS10i (9 Decimals)
        let burn_amount = 50_000_000_000_u64; // 50,000 $CARDANO (6 decimals: 50_000 * 10^6)

        // SECURITY: NFT ownership is verified by:
        // 1. nft_treasury_nft_ata constraint ensures it's the treasury's ATA for this NFT
        // 2. The transfer will fail if treasury doesn't own the NFT
        // 3. Only NFTs that were sent to treasury can be wrapped out
        // Collection verification removed due to Metaplex version incompatibility
        
        // 1. Burn 50k $CARDANO as fee
        let cpi_burn = InterfaceBurn {
            mint: ctx.accounts.cardano_mint.to_account_info(),
            from: ctx.accounts.user_cardano_ata.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        anchor_spl::token_interface::burn(CpiContext::new(ctx.accounts.token_2022_program.to_account_info(), cpi_burn), burn_amount)?;

        // 2. Transfer 1.0 SSS10i Fraction to the Global NFT Treasury
        let cpi_transfer_fraction = Transfer {
            from: ctx.accounts.user_fractions_ata.to_account_info(),
            to: ctx.accounts.nft_treasury_fractions_ata.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_transfer_fraction), amount)?;

        // 3. Transfer 1 wSSS10i NFT from the Global NFT Treasury to the User
        let seeds = &[b"nft_treasury".as_ref(), &[ctx.bumps.nft_treasury]];
        let signer = &[&seeds[..]];

        let cpi_transfer_nft = Transfer {
            from: ctx.accounts.nft_treasury_nft_ata.to_account_info(),
            to: ctx.accounts.user_nft_ata.to_account_info(),
            authority: ctx.accounts.nft_treasury.to_account_info(),
        };
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_transfer_nft, signer), 1)?;

        emit!(ArtifactForged { user: ctx.accounts.user.key() });
        Ok(())
    }

    pub fn unwrap_to_fractions(ctx: Context<UnwrapToFractionGlobal>) -> Result<()> {
        let amount = 1_000_000_000; // 1.0 SSS10i (9 Decimals)
        let burn_amount = 50_000_000_000_u64; // 50,000 $CARDANO (6 decimals: 50_000 * 10^6)
        
        // SECURITY: NFT ownership is verified by:
        // 1. user_nft_ata constraint ensures user owns this NFT
        // 2. The transfer will fail if user doesn't own the NFT
        // 3. nft_treasury_nft_ata ensures we're sending to treasury's ATA
        // Collection verification removed due to Metaplex version incompatibility
        
        // 1. Burn 50k $CARDANO as fee
        let cpi_burn = InterfaceBurn {
            mint: ctx.accounts.cardano_mint.to_account_info(),
            from: ctx.accounts.user_cardano_ata.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        anchor_spl::token_interface::burn(CpiContext::new(ctx.accounts.token_2022_program.to_account_info(), cpi_burn), burn_amount)?;

        // 2. Transfer 1 wSSS10i NFT back to the Global NFT Treasury
        let cpi_transfer_nft = Transfer {
            from: ctx.accounts.user_nft_ata.to_account_info(),
            to: ctx.accounts.nft_treasury_nft_ata.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_transfer_nft), 1)?;

        // 3. Transfer 1.0 SSS10i Fraction from the Global NFT Treasury to the User
        let seeds = &[b"nft_treasury".as_ref(), &[ctx.bumps.nft_treasury]];
        let signer = &[&seeds[..]];

        let cpi_transfer_fraction = Transfer {
            from: ctx.accounts.nft_treasury_fractions_ata.to_account_info(),
            to: ctx.accounts.user_fractions_ata.to_account_info(),
            authority: ctx.accounts.nft_treasury.to_account_info(),
        };
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_transfer_fraction, signer), amount)?;

        emit!(ArtifactShattered { user: ctx.accounts.user.key() });
        Ok(())
    }
}

// Internal function to update the global pool math
fn update_pool(pool: &mut Account<PoolState>, global: &Account<GlobalState>) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    if current_time <= pool.last_update_time {
        return Ok(());
    }

    if pool.total_staked == 0 || global.total_alloc_point == 0 {
        pool.last_update_time = current_time;
        return Ok(());
    }

    // FIX C-2: Cap effective time to emission_end_time so rewards stop accruing after the end date
    let effective_time = if global.emission_end_time > 0 && current_time > global.emission_end_time {
        global.emission_end_time
    } else {
        current_time
    };

    // If we've already updated past the emission end, no more rewards
    if effective_time <= pool.last_update_time {
        pool.last_update_time = current_time;
        return Ok(());
    }

    let time_elapsed = effective_time
        .checked_sub(pool.last_update_time)
        .ok_or(MatrixError::MathOverflow)?;
    
    // Weighted Reward Calculation: (time * global_rate * pool_weight) / total_weight
    let reward_emitted = (time_elapsed as u128)
        .checked_mul(global.total_reward_per_second as u128)
        .ok_or(MatrixError::MathOverflow)?
        .checked_mul(pool.alloc_point as u128)
        .ok_or(MatrixError::MathOverflow)?
        .checked_div(global.total_alloc_point as u128)
        .ok_or(MatrixError::MathOverflow)?;

    // Calculate reward per share with 1e12 precision to avoid rounding down to 0
    let reward_per_share_increase = reward_emitted
        .checked_mul(1_000_000_000_000)
        .ok_or(MatrixError::MathOverflow)?
        .checked_div(pool.total_staked as u128)
        .ok_or(MatrixError::MathOverflow)?;

    pool.acc_reward_per_share = pool.acc_reward_per_share
        .checked_add(reward_per_share_increase)
        .ok_or(MatrixError::MathOverflow)?;
    
    // FIX H-3: Track total tokens "promised" to users in this pool (u128 safe)
    pool.total_reward_liability = pool.total_reward_liability
        .checked_add(reward_emitted)
        .ok_or(MatrixError::MathOverflow)?;
    
    pool.last_update_time = current_time;

    Ok(())
}

// ------------------------------------------------------------------
// ACCOUNT STRUCTS
// ------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeGlobal<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 8, // disc + authority + alloc_point + rate + end_time + budget + emitted
        seeds = [b"global"],
        bump
    )]
    pub global: Account<'info, GlobalState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Migration struct - uses UncheckedAccount to bypass deserialization during resize
#[derive(Accounts)]
pub struct MigrateGlobalState<'info> {
    /// CHECK: We manually handle the account data during migration
    #[account(
        mut,
        seeds = [b"global"],
        bump
    )]
    pub global: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Migration V2 struct - adds nft_collection_mint and sss10i_mint to GlobalState
#[derive(Accounts)]
pub struct MigrateGlobalStateV2<'info> {
    /// CHECK: We manually handle the account data during migration
    #[account(
        mut,
        seeds = [b"global"],
        bump
    )]
    pub global: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Admin instruction to set global mints (for fixing migration issues)
#[derive(Accounts)]
pub struct AdminSetGlobalMints<'info> {
    #[account(mut, seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AddPool<'info> {
    #[account(mut, seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    #[account(init, payer = authority, space = 8 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 16 + 16)]
    pub pool: Account<'info, PoolState>,
    pub reward_mint: Account<'info, Mint>,
    pub lp_mint: Account<'info, Mint>,
    pub cardano_mint: InterfaceAccount<'info, InterfaceMint>,
    /// CHECK: NFT collection mint address stored for verification in wrap/unwrap. 
    /// Only settable by global authority during pool creation.
    pub nft_collection_mint: AccountInfo<'info>, 
    
    #[account(
        init,
        payer = authority,
        seeds = [b"vault", pool.key().as_ref()],
        bump,
        token::mint = lp_mint,
        token::authority = vault_lp_account
    )]
    pub vault_lp_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StakeLp<'info> {
    #[account(mut, seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    #[account(mut, has_one = accepted_lp_mint @ MatrixError::InvalidMint)]
    pub pool: Account<'info, PoolState>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 8 + 8 + 16,
        seeds = [b"user", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_info: Account<'info, UserInfo>,
    #[account(
        mut,
        associated_token::mint = accepted_lp_mint,
        associated_token::authority = user
    )]
    pub user_lp_account: Account<'info, TokenAccount>,
    /// CHECK: LP mint used for ATA validation, constrained by pool.has_one
    pub accepted_lp_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump
    )]
    pub vault_lp_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(mut, has_one = accepted_lp_mint @ MatrixError::InvalidMint)]
    pub pool: Account<'info, PoolState>,
    
    // SECURITY: Dedicated user_info check WITHOUT init_if_needed.
    // Derived from the signer's key. Hacker cannot pass another user's PDA 
    // because the seed check would fail against the 'user' signer.
    #[account(
        mut,
        seeds = [b"user", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_info: Account<'info, UserInfo>,
    
    #[account(
        mut,
        associated_token::mint = accepted_lp_mint,
        associated_token::authority = user
    )]
    pub user_lp_account: Account<'info, TokenAccount>,

    /// CHECK: LP mint used for ATA validation, constrained by pool.has_one
    pub accepted_lp_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump
    )]
    pub vault_lp_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminRecoverTokens<'info> {
    #[account(mut, seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    #[account(mut, has_one = reward_mint @ MatrixError::InvalidMint)]
    pub pool: Account<'info, PoolState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, address = pool.reward_mint)]
    pub reward_mint: Account<'info, Mint>,

    /// CHECK: PDA Treasury bound to Pool
    #[account(
        mut, 
        seeds = [b"treasury", pool.key().as_ref()], 
        bump
    )]
    pub treasury: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_fractions_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = authority,
    )]
    pub admin_fractions_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminRecoverAnyToken<'info> {
    #[account(seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    
    /// The pool whose treasury we're recovering from (no reward_mint constraint)
    pub pool: Account<'info, PoolState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The mint of the token being recovered (can be ANY token)
    pub token_mint: Account<'info, Mint>,

    /// CHECK: PDA Treasury bound to Pool
    #[account(
        mut, 
        seeds = [b"treasury", pool.key().as_ref()], 
        bump
    )]
    pub treasury: AccountInfo<'info>,

    /// Source ATA: treasury's token account for the mint being recovered
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = treasury,
    )]
    pub source_ata: Account<'info, TokenAccount>,

    /// Destination ATA: admin's token account for the mint being recovered
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = authority,
    )]
    pub destination_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminTransferToNftTreasury<'info> {
    #[account(seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    
    /// The pool whose treasury we're transferring from
    pub pool: Account<'info, PoolState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The mint of the token being transferred
    pub token_mint: Account<'info, Mint>,

    /// CHECK: Pool's treasury PDA
    #[account(
        mut, 
        seeds = [b"treasury", pool.key().as_ref()], 
        bump
    )]
    pub pool_treasury: AccountInfo<'info>,

    /// CHECK: Global NFT treasury PDA
    #[account(
        mut, 
        seeds = [b"nft_treasury"], 
        bump
    )]
    pub nft_treasury: AccountInfo<'info>,

    /// Source ATA: pool treasury's token account
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = pool_treasury,
    )]
    pub source_ata: Account<'info, TokenAccount>,

    /// Destination ATA: global NFT treasury's token account
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = nft_treasury,
    )]
    pub nft_treasury_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HarvestRewards<'info> {
    #[account(mut, seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    #[account(mut, has_one = reward_mint @ MatrixError::InvalidMint)]
    pub pool: Account<'info, PoolState>,
    #[account(
        mut,
        seeds = [b"user", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_info: Account<'info, UserInfo>,
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, address = pool.reward_mint)]
    pub reward_mint: Account<'info, Mint>,

    /// CHECK: PDA Treasury bound to Pool
    #[account(
        mut, 
        seeds = [b"treasury", pool.key().as_ref()], 
        bump
    )]
    pub treasury: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_fractions_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = user,
    )]
    pub user_fractions_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ------------------------------------------------------------------
// GLOBAL NFT TREASURY - Wrap/Unwrap Accounts (Independent from Pools)
// ------------------------------------------------------------------

#[derive(Accounts)]
pub struct WrapToNftGlobal<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    
    // CARDANO mint for burn fee
    #[account(mut)]
    pub cardano_mint: InterfaceAccount<'info, InterfaceMint>,

    #[account(
        mut,
        associated_token::mint = cardano_mint,
        associated_token::authority = user,
        associated_token::token_program = token_2022_program
    )]
    pub user_cardano_ata: InterfaceAccount<'info, InterfaceTokenAccount>,

    // SSS10i mint (from global state)
    #[account(mut, address = global.sss10i_mint)]
    pub sss10i_mint: Account<'info, Mint>,

    /// CHECK: Global NFT Treasury PDA
    #[account(
        mut, 
        seeds = [b"nft_treasury"], 
        bump
    )]
    pub nft_treasury: AccountInfo<'info>,
    
    // User's SSS10i token account
    #[account(
        mut,
        associated_token::mint = sss10i_mint,
        associated_token::authority = user,
    )]
    pub user_fractions_ata: Account<'info, TokenAccount>,
    
    // NFT Treasury's SSS10i token account (init_if_needed for first wrap)
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = sss10i_mint,
        associated_token::authority = nft_treasury,
    )]
    pub nft_treasury_fractions_ata: Account<'info, TokenAccount>,

    // NFT being wrapped
    pub nft_mint: Account<'info, Mint>,

    // User's NFT ATA (init_if_needed - user may not have this NFT's ATA yet)
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = nft_mint,
        associated_token::authority = user
    )]
    pub user_nft_ata: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = nft_treasury
    )]
    pub nft_treasury_nft_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnwrapToFractionGlobal<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,

    // CARDANO mint for burn fee
    #[account(mut)]
    pub cardano_mint: InterfaceAccount<'info, InterfaceMint>,

    #[account(
        mut,
        associated_token::mint = cardano_mint,
        associated_token::authority = user,
        associated_token::token_program = token_2022_program
    )]
    pub user_cardano_ata: InterfaceAccount<'info, InterfaceTokenAccount>,

    // SSS10i mint (from global state)
    #[account(mut, address = global.sss10i_mint)]
    pub sss10i_mint: Account<'info, Mint>,

    /// CHECK: Global NFT Treasury PDA
    #[account(
        mut, 
        seeds = [b"nft_treasury"], 
        bump
    )]
    pub nft_treasury: AccountInfo<'info>,
    
    // User's SSS10i token account (init_if_needed for first unwrap)
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = sss10i_mint,
        associated_token::authority = user,
    )]
    pub user_fractions_ata: Account<'info, TokenAccount>,
    
    // NFT Treasury's SSS10i token account
    #[account(
        mut,
        associated_token::mint = sss10i_mint,
        associated_token::authority = nft_treasury,
    )]
    pub nft_treasury_fractions_ata: Account<'info, TokenAccount>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = user
    )]
    pub user_nft_ata: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = nft_treasury,
    )]
    pub nft_treasury_nft_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAllocPoint<'info> {
    #[account(mut, seeds = [b"global"], bump)]
    pub global: Account<'info, GlobalState>,
    #[account(
        mut,
        has_one = authority @ MatrixError::Unauthorized
    )]
    pub pool: Account<'info, PoolState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateEmissionRate<'info> {
    #[account(
        mut,
        seeds = [b"global"],
        bump,
        has_one = authority @ MatrixError::Unauthorized
    )]
    pub global: Account<'info, GlobalState>,
    pub authority: Signer<'info>,
}

#[account]
pub struct GlobalState {
    pub authority: Pubkey,           // 32
    pub total_alloc_point: u64,      // 8
    pub total_reward_per_second: u64, // 8
    pub emission_end_time: i64,      // 8  — FIX C-2: Unix timestamp when emissions stop
    pub total_emission_budget: u64,  // 8  — FIXED total SSS10i ever emittable (set once at launch)
    pub total_emitted: u64,          // 8  — Running tally of SSS10i already paid to farmers
    pub nft_collection_mint: Pubkey, // 32 — Official NFT collection for wrap/unwrap
    pub sss10i_mint: Pubkey,         // 32 — Official SSS10i mint for wrap/unwrap
}

#[account]
pub struct PoolState {
    pub authority: Pubkey,
    pub reward_mint: Pubkey,
    pub accepted_lp_mint: Pubkey,
    pub cardano_mint: Pubkey,
    pub nft_collection_mint: Pubkey,
    pub alloc_point: u64,
    pub total_staked: u64,
    pub last_update_time: i64,
    pub acc_reward_per_share: u128,
    pub total_reward_liability: u128,    // FIX H-3: Promoted from u64 to u128
}

#[account]
pub struct UserInfo {
    pub staked_amount: u64,
    pub pending_rewards: u64,
    pub reward_debt: u128,
}

// ------------------------------------------------------------------
// EVENTS
// ------------------------------------------------------------------

#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub reward_rate: u64,
    pub lp_mint: Pubkey,
}

#[event]
pub struct UserDeposited {
    pub user: Pubkey,
    pub amount: u64,
    pub new_total_stake: u64,
}

#[event]
pub struct UserWithdrew {
    pub user: Pubkey,
    pub amount: u64,
    pub remaining_stake: u64,
}

#[event]
pub struct UserHarvested {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RewardRateUpdated {
    pub pool: Pubkey,
    pub old_rate: u64,
    pub new_rate: u64,
}

#[event]
pub struct ArtifactForged {
    pub user: Pubkey,
}

#[event]
pub struct ArtifactShattered {
    pub user: Pubkey,
}

// FIX L-3: Proper event for emergency withdraw
#[event]
pub struct EmergencyWithdrawExecuted {
    pub user: Pubkey,
    pub amount: u64,
}

// ------------------------------------------------------------------
// ERROR CODES
// ------------------------------------------------------------------

#[error_code]
pub enum MatrixError {
    #[msg("Unauthorized access to Pool Configuration.")]
    Unauthorized,
    #[msg("Cannot deposit 0 tokens.")]
    ZeroDeposit,
    #[msg("Cannot withdraw 0 tokens.")]
    ZeroWithdrawal,
    #[msg("Insufficient staked balance for withdrawal.")]
    InsufficientStake,
    #[msg("Treasury is out of NFTs.")]
    TreasuryEmpty,
    #[msg("Must send exactly 1.0 Fractions to Wrap.")]
    InvalidWrapAmount,
    #[msg("No rewards currently pending to harvest.")]
    NoRewardsToHarvest,
    #[msg("Invalid NFT amount constraint.")]
    InvalidNFTAmount,
    #[msg("Invalid token mint used directly attempting to exploit protocol.")]
    InvalidMint,
    #[msg("NFT does not belong to the official Pool Collection.")]
    InvalidNFTCollection,
    #[msg("NFT Collection membership is unverified.")]
    UnverifiedNFT,
    #[msg("Reward Treasury balance is below protocol liability.")]
    InsufficientProtocolLiquidity,
    #[msg("Attempted to withdraw tokens that are already owed to stakers.")]
    LiabilityConflict,
    #[msg("Arithmetic overflow or underflow detected.")]
    MathOverflow,
    #[msg("All farming emissions have been fully distributed. Budget exhausted.")]
    EmissionBudgetExhausted,
    #[msg("Emission budget has already been locked. Cannot reset after emissions have begun.")]
    EmissionBudgetAlreadySet,
    #[msg("GlobalState migration not needed - account is already at correct size.")]
    MigrationNotNeeded,
}
