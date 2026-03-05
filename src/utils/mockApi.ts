import { CARDANO_MINT } from './constants';
import axios from 'axios';

export interface PoolData {
    id: string;
    title: string;
    subtitle: string;
    staked: string;
    tokenIcon: string;
    baseIcon: string;
    isHot?: boolean;
    totalStakedUsd: string;
    endsInDays: number;
    lpMintAddress: string;
    poolPubkey?: string;
    isTrinity?: boolean;
    isOffline?: boolean;
    raydiumPoolId?: string;
    poolMintA?: string;
    poolMintB?: string;
}

export const POOL_CONFIGS: PoolData[] = [
    {
        id: "pool-1",
        title: "ABG Factory",
        subtitle: "CARDANO / SOL",
        staked: "0.00",
        tokenIcon: "/assets/tokens/Solana.png",
        baseIcon: "/assets/tokens/CARDANO.png",
        totalStakedUsd: "410,000",
        endsInDays: 365,
        lpMintAddress: "3an9TS1g2dEYkdk1ShiYkzYEyi7P6SR5aveCYTKnmHGe",
        poolPubkey: "GNwnKFx2v6zoPRtnv7SxN3mhAKfy4c1dmRZA1WkfkMFp",
        raydiumPoolId: "HPy61MrmjyRjN9prVSB7Utd4LhpvbNMp2ovcLpstko7r",
        poolMintA: "2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump",
        poolMintB: "So11111111111111111111111111111111111111112"
    },
    {
        id: "pool-2",
        title: "Stable Ice",
        subtitle: "CARDANO / USDC",
        staked: "0.00",
        tokenIcon: "/assets/tokens/USDC.png",
        baseIcon: "/assets/tokens/CARDANO.png",
        totalStakedUsd: "0",
        endsInDays: 0,
        lpMintAddress: "C3Lsu6S8H4DwX8qRhoi8jdjPmfjEAVTARtWGCtG3vQnC",
        poolPubkey: "6k7fotdNejY4v2Y6LRRELPPBJPdr9WDQkt5PdSCQWnmP",
        raydiumPoolId: "HE9TMHJndNaZ9wAVQcU8Nnewm6GQdxeNsbtYPah2GR1G",
        poolMintA: "2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump",
        poolMintB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    },
    {
        id: "pool-3",
        title: "Alignment",
        subtitle: "SSS10I / CARDANO",
        staked: "0.00",
        tokenIcon: "/assets/tokens/CARDANO.png",
        baseIcon: "/assets/tokens/sss10i.jpg",
        totalStakedUsd: "0",
        endsInDays: 365,
        lpMintAddress: "6C9FsWhLKQqdkuASDB7ZFVSE8n4phQJKr49zFUuSkmUW",
        poolPubkey: "7x7vqpNoUeGZnK1nnvkRaMoiEuAbyfvuAajuBtFPKjuq",
        raydiumPoolId: "HgkRjGJKC9Efd4324JuXJaJxuBeecLzCfPsthWBGQEof",
        poolMintA: "AnDgVLkfHUmuSrKMFsqFy8d7Fw49CzJjWk1uZZYPcSei",
        poolMintB: "2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump"
    },
    {
        id: "pool-4",
        title: "Stable JPEGS",
        subtitle: "SSS10I / USDC",
        staked: "0.00",
        tokenIcon: "/assets/tokens/USDC.png",
        baseIcon: "/assets/tokens/sss10i.jpg",
        totalStakedUsd: "0",
        endsInDays: 365,
        lpMintAddress: "HNXgfh2PzRHMuPVGz7qyeTF9LunRvpg4P9cw5veMU8wg",
        poolPubkey: "BdsRqJg5aA9H1aetXgniVQTh4SFpkzYcxSQCgkTa8FRK",
        raydiumPoolId: "H8h4JL8McdF7P9Zkta9Jaxb3UjjMbxpbaJBxqzWfaUFB",
        poolMintA: "AnDgVLkfHUmuSrKMFsqFy8d7Fw49CzJjWk1uZZYPcSei",
        poolMintB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    },
    {
        id: "pool-5",
        title: "Harry Pepe",
        subtitle: "HARRY / CARDANO",
        staked: "0.00",
        tokenIcon: "/assets/tokens/CARDANO.png",
        baseIcon: "/assets/tokens/HarryPepe.jpg",
        totalStakedUsd: "0",
        endsInDays: 0,
        lpMintAddress: "46vpcjrqZ7aPpAwzQkXHyc2ihoWMf3TYKarLbaA7mZTD",
        poolPubkey: "ADEyjn3apNiUJ5t5rjEGaysuiX7APu1ihbfkrG6c3PCk",
        raydiumPoolId: "7uj4GTeKxPPTdmpn1JToRvsT2euJ7hwphs2oUY3rwGFM",
        poolMintA: "7oZCgJNtCFvBNBNx7S1Nza9TwfzSNaovXMkfnk4gpump",
        poolMintB: "2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump",
        isTrinity: true
    },
    {
        id: "pool-6",
        title: "Bulked",
        subtitle: "BULK / CARDANO",
        staked: "0.00",
        tokenIcon: "/assets/tokens/CARDANO.png",
        baseIcon: "/assets/tokens/bulk.jpg",
        totalStakedUsd: "0",
        endsInDays: 0,
        lpMintAddress: "ByZeE5GPEX1HdqLH4DDUvR665SmQhkbtjEdQkZw4RCmd",
        poolPubkey: "7mGYx1maeJNrBoB9KKHuf8VDLF3yfWJQAQVyWQXHsvEs",
        raydiumPoolId: "GyMWpDvWRFxMTWx5ofkB53qnaAVRQ9GqLdQHdUBgZsv9",
        poolMintA: "F4TJfiMVi7zFGRJj4FVC1Zuj7fdCo6skKa4SnAU4pump",
        poolMintB: "2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump",
        isTrinity: true
    }
];

export const usePoolConfigs = (): PoolData[] => {
    return POOL_CONFIGS;
};

// Live Jupiter Routing Estimate using v6 API
export const getLiveZapQuote = async (inputAmount: number, inputMint: string, targetLpMint: string) => {
    try {
        // We use the Jupiter v6 quote API to find a route from Input Token -> Target LP Mint
        // Note: For actual LP tokens, Jupiter routing might be complex or unavailable directly, 
        // but for now we try to get a quote. If it fails, we provide a fallback estimation.
        const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${targetLpMint}&amount=${inputAmount}&slippageBps=100`;
        
        const response = await axios.get(url);
        const data = response.data;
        
        if (!data || !data.outAmount) {
            throw new Error("Invalid quote response");
        }

        const outAmountDecimals = 9; // Assuming LP token has 9 decimals
        const estimatedLpOut = (Number(data.outAmount) / Math.pow(10, outAmountDecimals)).toFixed(4);
        
        let priceImpact = "< 1%";
        if (data.priceImpactPct) {
            priceImpact = `${(Number(data.priceImpactPct) * 100).toFixed(2)}%`;
        }

        return {
            quoteId: data.contextSlot ? `jup-quote-${data.contextSlot}` : `quote-${Math.random()}`,
            inputAmount,
            inputToken: inputMint === CARDANO_MINT.toBase58() ? 'CARDANO' : 'SOL',
            estimatedLpOut,
            priceImpact,
            route: `Jupiter v6 -> Auto-routed via ${data.routePlan?.length || 1} hops`
        };

    } catch (error) {
        console.warn(`Live Jupiter quote failed for ${targetLpMint}. Falling back to estimation.`, error);
        // Fallback mock estimation if Jupiter can't route directly to the LP token
        return new Promise((resolve) => {
            setTimeout(() => {
                const estimatedLpOut = (inputAmount * 0.95).toFixed(4); // Conservative fallback
                resolve({
                    quoteId: `fallback-quote-${Math.random()}`,
                    inputAmount,
                    inputToken: inputMint === CARDANO_MINT.toBase58() ? 'CARDANO' : 'SOL',
                    estimatedLpOut,
                    priceImpact: "Estimated",
                    route: `Direct Protocol Zap (Estimated)`
                });
            }, 500);
        });
    }
};
