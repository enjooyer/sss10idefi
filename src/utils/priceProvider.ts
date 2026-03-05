// priceProvider.ts
// Utility to simulate or fetch real-time USD valuations for Facility Sieben assets.

import { CARDANO_MINT, SSS10i_MINT, SOL_MINT, USDC_MINT, RPC_URL } from './constants';

let livePrices = {
    CARDANO: 0.00002,
    SSS10i: 89.00,  // Updated to current market price (was $150)
    SOL: 145.00,
    USDC: 1.00,
    HARRY: 0.0,
    BULK: 0.0
};

export const fetchLivePrices = async () => {
    try {
        // Use Birdeye public API for price data (no auth required)
        const tokens = [
            { mint: CARDANO_MINT.toBase58(), key: 'CARDANO' },
            { mint: SSS10i_MINT.toBase58(), key: 'SSS10i' },
            { mint: SOL_MINT.toBase58(), key: 'SOL' },
            { mint: USDC_MINT.toBase58(), key: 'USDC' },
            { mint: '7oZCgJNtCFvBNBNx7S1Nza9TwfzSNaovXMkfnk4gpump', key: 'HARRY' },
            { mint: 'F4TJfiMVi7zFGRJj4FVC1Zuj7fdCo6skKa4SnAU4pump', key: 'BULK' },
        ];
        
        // Fetch prices from DexScreener (free, no auth) — all in parallel
        const priceResults = await Promise.allSettled(
            tokens.map(async (token) => {
                const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`);
                const json = await res.json();
                if (json.pairs && json.pairs.length > 0) {
                    const price = parseFloat(json.pairs[0].priceUsd || '0');
                    if (price > 0) {
                        return { key: token.key, price };
                    }
                }
                return null;
            })
        );
        for (const result of priceResults) {
            if (result.status === 'fulfilled' && result.value) {
                (livePrices as any)[result.value.key] = result.value.price;
            }
        }


    } catch (e) {
        console.error("Failed to fetch live prices from Jupiter", e);
    }
};

export const getLivePrices = () => livePrices;

export const MOCK_PRICES = livePrices; // Aliased to not break existing imports temporarily

// Cache for LP token prices (raydiumPoolId -> pricePerLp)
const lpPriceCache: Record<string, { price: number; timestamp: number }> = {};
const LP_CACHE_TTL = 30000; // 30 seconds

// Raydium Pool ID to LP Mint mapping for supply lookups
const POOL_LP_MINTS: Record<string, string> = {
    'HPy61MrmjyRjN9prVSB7Utd4LhpvbNMp2ovcLpstko7r': '3an9TS1g2dEYkdk1ShiYkzYEyi7P6SR5aveCYTKnmHGe', // CARDANO/SOL
    'HE9TMHJndNaZ9wAVQcU8Nnewm6GQdxeNsbtYPah2GR1G': 'C3Lsu6S8H4DwX8qRhoi8jdjPmfjEAVTARtWGCtG3vQnC', // CARDANO/USDC
    'HgkRjGJKC9Efd4324JuXJaJxuBeecLzCfPsthWBGQEof': '6C9FsWhLKQqdkuASDB7ZFVSE8n4phQJKr49zFUuSkmUW', // SSS10i/CARDANO
    'H8h4JL8McdF7P9Zkta9Jaxb3UjjMbxpbaJBxqzWfaUFB': 'HNXgfh2PzRHMuPVGz7qyeTF9LunRvpg4P9cw5veMU8wg', // SSS10i/USDC
    '7uj4GTeKxPPTdmpn1JToRvsT2euJ7hwphs2oUY3rwGFM': '46vpcjrqZ7aPpAwzQkXHyc2ihoWMf3TYKarLbaA7mZTD', // HARRY/CARDANO
    'GyMWpDvWRFxMTWx5ofkB53qnaAVRQ9GqLdQHdUBgZsv9': 'ByZeE5GPEX1HdqLH4DDUvR665SmQhkbtjEdQkZw4RCmd', // BULK/CARDANO
};

/**
 * Fetches real-time LP token price from DexScreener.
 * LP Value = Pool Liquidity USD / LP Token Supply
 */
export const fetchLpPrice = async (raydiumPoolId: string): Promise<number> => {
    // Check cache first
    const cached = lpPriceCache[raydiumPoolId];
    if (cached && Date.now() - cached.timestamp < LP_CACHE_TTL) {
        return cached.price;
    }

    try {
        // Fetch pool data from DexScreener
        const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${raydiumPoolId}`);
        const data = await res.json();
        
        if (data.pair && data.pair.liquidity?.usd) {
            const liquidityUsd = data.pair.liquidity.usd;
            
            const lpMint = POOL_LP_MINTS[raydiumPoolId];
            if (lpMint) {
                try {
                    const supplyRes = await fetch(RPC_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 'lp-supply',
                            method: 'getTokenSupply',
                            params: [lpMint]
                        })
                    });
                    const supplyData = await supplyRes.json();
                    
                    // Crucial fix: Only calculate if we have a valid supply > 0
                    const rawSupply = supplyData.result?.value?.uiAmount;
                    if (rawSupply && rawSupply > 0) {
                        const pricePerLp = liquidityUsd / rawSupply;
                        
                        // Cache the result
                        lpPriceCache[raydiumPoolId] = { price: pricePerLp, timestamp: Date.now() };
                        console.log(`[LP] ${raydiumPoolId}: $${pricePerLp.toFixed(4)} per token (Liq: $${liquidityUsd}, Supply: ${rawSupply})`);
                        
                        return pricePerLp;
                    }
                } catch (e) {
                    console.error('[LP] Failed to fetch LP supply:', e);
                }
            }
            
            // Fallback: estimate based on standard pool sizes if supply fetch fails
            // Do NOT return liquidityUsd directly, that causes the $8.30 bug
            const estimatedPrice = liquidityUsd / 1000; // Assume 1000 LP tokens as fallback
            lpPriceCache[raydiumPoolId] = { price: estimatedPrice, timestamp: Date.now() };
            return estimatedPrice;
        }
    } catch (e) {
        console.error(`[LP] Failed to fetch LP price for ${raydiumPoolId}:`, e);
    }
    
    return 0.10; // Fallback
};

/**
 * Gets LP USD value using cached price or fetches if needed.
 * For synchronous calls, uses cached value or fallback.
 */
export const getLpUsdValue = (amount: number, poolSubtitle: string, raydiumPoolId?: string): number => {
    // If amount is 0, return 0 immediately
    if (amount <= 0) return 0;

    // If we have a raydiumPoolId and cached price, use it
    if (raydiumPoolId && lpPriceCache[raydiumPoolId]) {
        return amount * lpPriceCache[raydiumPoolId].price;
    }
    
    // Hardcoded realistic fallbacks while cache populates
    let pricePerLp = 1.0;
    
    if (poolSubtitle.includes("SSS10I / CARDANO") || poolSubtitle.includes("SSS10i / CARDANO")) {
        pricePerLp = 2.90;
    } else if (poolSubtitle.includes("SSS10I / USDC") || poolSubtitle.includes("SSS10i / USDC")) {
        pricePerLp = 2.50;
    } else if (poolSubtitle.includes("CARDANO / SOL")) {
        pricePerLp = 0.10;
    } else if (poolSubtitle.includes("CARDANO / USDC")) {
        pricePerLp = 0.05;
    } else if (poolSubtitle.includes("HARRY")) {
        pricePerLp = 0.052; // DexScreener does not track yet. Raydium values ~100 LP tokens at $5.26 total.
    } else if (poolSubtitle.includes("BULK")) {
        pricePerLp = 0.13;
    }

    return amount * pricePerLp;
};

export const formatUsd = (val: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val);
};
