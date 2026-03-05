# Zap Feature - Implementation Guide

## Overview
The Zap feature allows users to easily enter staking pools by automatically converting SOL or USDC into LP tokens through a multi-step process using Jupiter aggregator and Raydium pools.

## How It Works

### User Flow
1. **User selects input token** (SOL or USDC) and enters amount
2. **Click "1. EXECUTE ZAP SWAPS"** - System automatically:
   - Calculates optimal swap amounts based on pool ratio
   - Swaps input token to both pool tokens via Jupiter (best rates)
   - Shows real-time progress with transaction links
3. **User adds liquidity on Raydium** - After swaps complete, user clicks the Raydium link to add liquidity
4. **Click "2. DEPOSIT LP TOKENS INTO POOL"** - Deposits received LP tokens into staking pool

### Technical Implementation

#### Files Created/Modified
- **`src/utils/zapUtils.ts`** - Core Zap logic
  - `executeJupiterSwap()` - Executes token swaps via Jupiter API
  - `calculateSwapAmount()` - Determines optimal swap ratios
  - `getPoolReserves()` - Fetches pool data from Raydium API
  - `getLpTokenBalance()` - Checks user's LP token balance
  - `executeZapSwaps()` - Main orchestration function

- **`src/components/ZapModal.tsx`** - UI component
  - Multi-step progress tracking
  - Transaction status indicators
  - Raydium integration link
  - LP token deposit functionality

- **`src/components/ZapModal.css`** - Styling
  - Progress tracker animations
  - Step status indicators (pending/processing/success/error)
  - Mobile-responsive design

#### Dependencies
- `@raydium-io/raydium-sdk-v2` - Raydium pool integration
- Jupiter Lite API - Token swap routing

## Configuration Requirements

To enable Zap for a pool, pass these props to `ZapModal`:
```typescript
<ZapModal
  isOpen={zapModalOpen}
  onClose={() => setZapModalOpen(false)}
  poolSubtitle="CARDANO / SOL"
  lpMintId="3an9TS1g2dEYkdk1ShiYkzYEyi7P6SR5aveCYTKnmHGe"
  poolPubkey="GNwnKFx2v6zoPRtnv7SxN3mhAKfy4c1dmRZA1WkfkMFp"
  poolMintA="2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump" // CARDANO
  poolMintB="So11111111111111111111111111111111111111112"   // SOL
  raydiumPoolId="<RAYDIUM_POOL_ID>"
/>
```

## Testing Checklist

### Before Production
- [ ] Test with small SOL amount (0.1 SOL)
- [ ] Test with USDC
- [ ] Verify Jupiter swap execution
- [ ] Verify transaction links work on Solscan
- [ ] Test Raydium liquidity addition flow
- [ ] Verify LP token deposit into staking pool
- [ ] Test error handling (insufficient balance, network errors)
- [ ] Test on mobile devices
- [ ] Verify progress tracker updates correctly

### Known Limitations
1. **Manual Raydium Step**: User must manually add liquidity on Raydium.io between steps 1 and 2
   - This is intentional to avoid complex SDK integration issues
   - Provides user control and transparency
   
2. **Pool Configuration**: Each pool needs proper `poolMintA`, `poolMintB`, and `raydiumPoolId` configured

3. **Slippage**: Currently uses default 1% slippage for Jupiter swaps

## Future Enhancements
- [ ] Fully automated liquidity addition (requires Raydium SDK V2 integration)
- [ ] Configurable slippage settings
- [ ] Price impact warnings
- [ ] Estimated LP output preview
- [ ] Multi-pool Zap support
- [ ] Gas optimization for batch transactions

## Troubleshooting

### "Pool configuration incomplete"
- Ensure `poolMintA`, `poolMintB`, and `raydiumPoolId` are set in pool data

### "No LP tokens found"
- User hasn't added liquidity on Raydium yet
- Check Raydium transaction was successful

### Jupiter swap fails
- Check wallet has sufficient balance
- Verify RPC connection is stable
- Check Jupiter API status

### Transaction links not working
- Verify transaction hash format
- Check Solscan is accessible

## API Endpoints Used
- Jupiter Quote: `https://lite-api.jup.ag/swap/v1/quote`
- Jupiter Swap: `https://lite-api.jup.ag/swap/v1/swap`
- Raydium Pool Info: `https://api-v3.raydium.io/pools/info/ids`

## Security Considerations
- All transactions require user wallet approval
- No private keys handled by application
- Jupiter API used for optimal routing (decentralized)
- Raydium liquidity addition done on official Raydium UI
