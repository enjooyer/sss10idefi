# SSS10i Pool Deployment Guide

## Emission Budget
- **Total**: 68.5 SSS10i over 1 year (365 days)
- **Rate**: 68.5 × 10^9 / 31,536,000 = **2,172 lamports/sec**
- **Daily**: ~0.1877 SSS10i/day across all pools

---

## Pool Allocation Plan

| Pool | LP Pair | Alloc Points | % of Rewards | Daily SSS10i | Yearly SSS10i | Treasury Funding |
|------|---------|--------------|--------------|--------------|---------------|------------------|
| 1 | SOL/CARDANO | 15 | 15% | 0.0282 | 10.275 | 10.275 SSS10i |
| 2 | CARDANO/USDC | 20 | 20% | 0.0375 | 13.700 | 13.700 SSS10i |
| 3 | SSS10i/CARDANO | 30 | 30% | 0.0563 | 20.550 | 20.550 SSS10i |
| 4 | SSS10i/USDC | 25 | 25% | 0.0469 | 17.125 | 17.125 SSS10i |
| 5 | HARRY/CARDANO | 5 | 5% | 0.0094 | 3.425 | 3.425 SSS10i |
| 6 | BULK/CARDANO | 5 | 5% | 0.0094 | 3.425 | 3.425 SSS10i |
| **TOTAL** | | **100** | **100%** | **0.1877** | **68.500** | **68.500 SSS10i** |

**Note**: Rewards are split proportionally by `alloc_point / total_alloc_point`.

---

## Pre-Deployment Checklist

### Step 0: Contract Upgrade (ONE TIME)
```
1. Copy updated lib.rs to Solana Playground
2. Run: build
3. Run: upgrade
4. Verify deployment successful
```

### Step 1: Recover Assets from Old Treasury (ONE TIME)
```
1. Run SSS10i recovery script → admin wallet
2. Run NFT recovery script (77 NFTs) → admin wallet
3. Verify all assets in admin wallet
```

---

## Per-Pool Deployment Process

### For Each Pool (1-6):

#### A. Get LP Token Mint Address
- Go to Raydium or Solscan
- Find the CPMM pool for the pair
- Copy the LP token mint address

#### B. Create Pool
```typescript
// Run in Solana Playground
import { PublicKey, Keypair } from "@solana/web3.js";

const LP_MINT = new PublicKey("LP_MINT_ADDRESS_HERE");
const SSS10i_MINT = new PublicKey("AnDgVLkfHUmuSrKMFsqFy8d7Fw49CzJjWk1uZZYPcSei");
const CARDANO_MINT = new PublicKey("2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump");
const NFT_COLLECTION = new PublicKey("2fTa9jhfqtsKa13hMg63oJR6ah75iXzg6ShJyqhsx5yk");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ALLOC_POINT = 100; // Adjust per pool

async function createPool() {
    const poolKeypair = Keypair.generate();
    console.log("New Pool Pubkey:", poolKeypair.publicKey.toBase58());
    
    const globalPda = PublicKey.findProgramAddressSync(
        [Buffer.from("global")], pg.program.programId
    )[0];
    
    const vaultLpAccount = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), poolKeypair.publicKey.toBuffer()], pg.program.programId
    )[0];
    
    const tx = await pg.program.methods
        .addPool(new anchor.BN(ALLOC_POINT))
        .accounts({
            global: globalPda,
            pool: poolKeypair.publicKey,
            rewardMint: SSS10i_MINT,
            lpMint: LP_MINT,
            cardanoMint: CARDANO_MINT,
            nftCollectionMint: NFT_COLLECTION,
            vaultLpAccount: vaultLpAccount,
            authority: pg.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([poolKeypair])
        .rpc();
    
    console.log("Pool created! TX:", tx);
    console.log("POOL PUBKEY:", poolKeypair.publicKey.toBase58());
}

createPool();
```

#### C. Record Pool Address
- Save the pool pubkey to this document
- Update frontend constants if needed

#### D. Fund Pool Treasury
```typescript
// Calculate treasury PDA and send SSS10i
import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

const PROGRAM_ID = new PublicKey("68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF");
const POOL_PUBKEY = new PublicKey("POOL_PUBKEY_HERE");
const SSS10i_MINT = new PublicKey("AnDgVLkfHUmuSrKMFsqFy8d7Fw49CzJjWk1uZZYPcSei");
const AMOUNT = 11.42 * 1_000_000_000; // SSS10i amount for this pool (68.5 / 6 pools ≈ 11.42 each)

async function fundTreasury() {
    const treasuryPda = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), POOL_PUBKEY.toBuffer()], PROGRAM_ID
    )[0];
    
    console.log("Treasury PDA:", treasuryPda.toBase58());
    
    const userAta = getAssociatedTokenAddressSync(SSS10i_MINT, pg.wallet.publicKey, false, TOKEN_PROGRAM_ID);
    const treasuryAta = getAssociatedTokenAddressSync(SSS10i_MINT, treasuryPda, true, TOKEN_PROGRAM_ID);
    
    const tx = new Transaction();
    const ataInfo = await pg.connection.getAccountInfo(treasuryAta);
    
    if (!ataInfo) {
        tx.add(createAssociatedTokenAccountInstruction(
            pg.wallet.publicKey, treasuryAta, treasuryPda, SSS10i_MINT,
            TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
        ));
    }
    
    tx.add(createTransferInstruction(userAta, treasuryAta, pg.wallet.publicKey, AMOUNT, [], TOKEN_PROGRAM_ID));
    
    const sig = await sendAndConfirmTransaction(pg.connection, tx, [pg.wallet.keypair]);
    console.log("Treasury funded! TX:", sig);
}

fundTreasury();
```

#### E. Fund Pool with NFTs (Only for pools that need wrap/unwrap)
- Run batch NFT transfer script pointing to this pool's treasury

#### F. Test Pool
1. Deposit LP tokens
2. Wait ~60 seconds
3. Harvest rewards
4. Withdraw LP tokens
5. Verify all transactions successful

#### G. Update Frontend
- Add pool to `constants.ts` if multi-pool support
- Or update `TARGET_POOL_PUBKEY` for single-pool mode

---

## Current Pool Status

### Pool 1: SOL/CARDANO (15%)
- **Status**: Created, needs treasury funding
- **Pool Pubkey**: `GNwnKFx2v6zoPRtnv7SxN3mhAKfy4c1dmRZA1WkfkMFp`
- **LP Mint**: `3an9TS1g2dEYkdk1ShiYkzYEyi7P6SR5aveCYTKnmHGe`
- **Alloc Points**: 15
- **Treasury Funding**: 10.275 SSS10i
- **Treasury Funded**: ❌ No
- **NFTs Transferred**: ❌ No (in old treasury)
- **Tested**: ❌ No

### Pool 2: CARDANO/USDC (20%)
- **Status**: Not Created
- **LP Mint**: TBD
- **Alloc Points**: 20
- **Treasury Funding**: 13.700 SSS10i

### Pool 3: SSS10i/CARDANO (30%)
- **Status**: Not Created
- **LP Mint**: TBD
- **Alloc Points**: 30
- **Treasury Funding**: 20.550 SSS10i

### Pool 4: SSS10i/USDC (25%)
- **Status**: Not Created
- **LP Mint**: TBD
- **Alloc Points**: 25
- **Treasury Funding**: 17.125 SSS10i

### Pool 5: HARRY/CARDANO (5%)
- **Status**: Not Created
- **LP Mint**: TBD
- **Alloc Points**: 5
- **Treasury Funding**: 3.425 SSS10i

### Pool 6: BULK/CARDANO (5%)
- **Status**: Not Created
- **LP Mint**: TBD
- **Alloc Points**: 5
- **Treasury Funding**: 3.425 SSS10i

---

## Architecture (Updated 2026-03-01)

**Separation of Concerns:**
- **Pool Treasuries** (6 total): Hold SSS10i for staking rewards ONLY
- **Global NFT Treasury** (1 total): Holds 77 NFTs + SSS10i for wrap/unwrap ONLY

**PDAs:**
- Pool Treasury: `[b"treasury", pool.key()]`
- Global NFT Treasury: `[b"nft_treasury"]`

---

## Immediate Action Items

1. ✅ **Recovered 68.5 SSS10i** from old treasury → admin wallet
2. ✅ **Updated Pool 1 alloc_point** from 100 → 15
3. **Redeploy contract** with global NFT treasury architecture
4. **Run migrate_global_state_v2** to set nft_collection_mint and sss10i_mint
5. **Transfer 77 NFTs** from old pool treasury → global NFT treasury
6. **Fund global NFT treasury** with SSS10i for unwrap operations
7. **Fund Pool 1 treasury** with 10.275 SSS10i
8. **Test Pool 1** deposit/harvest/withdraw
9. **Create Pools 2-6** with correct alloc_points
10. **Fund Pools 2-6 treasuries** with their SSS10i allocations
11. **Set emission budget** (68.5 SSS10i total)
12. **Launch**

---

## Key Addresses Reference

| Item | Address |
|------|---------|
| Program ID | `68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF` |
| SSS10i Mint | `AnDgVLkfHUmuSrKMFsqFy8d7Fw49CzJjWk1uZZYPcSei` |
| CARDANO Mint | `2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump` |
| NFT Collection | `2fTa9jhfqtsKa13hMg63oJR6ah75iXzg6ShJyqhsx5yk` |
| OLD Pool (deprecated) | `7uitjL2naoBkBNCDEA8ir7czTkVUYQp1JS9hc3Zdnn8U` |
| OLD Treasury PDA | `6oujq3YZAoMMUs8jnzKH6Ajo9p3qVAtnRJ3qPbDhgfL8` |
| Pool 1 (CARDANO/SOL) | `GNwnKFx2v6zoPRtnv7SxN3mhAKfy4c1dmRZA1WkfkMFp` |
