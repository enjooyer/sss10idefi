import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { CARDANO_MINT, SSS10i_MINT, PROGRAM_ID, RPC_URL } from '../utils/constants';
import * as anchor from '@coral-xyz/anchor';
import { useGlobalPools } from '../contexts/GlobalPoolContext';
import { getLivePrices } from '../utils/priceProvider';
import { getSmartConnection } from '../utils/SmartConnection';

export interface TickerItem {
    label: string;
    value: string;
}

const CARDANO_INITIAL_SUPPLY = 1_000_000_000; // pump.fun tokens start at 1B

// All 6 pool treasury PDAs for tracking locked emissions
const POOL_PUBKEYS = [
    'GNwnKFx2v6zoPRtnv7SxN3mhAKfy4c1dmRZA1WkfkMFp',
    '6k7fotdNejY4v2Y6LRRELPPBJPdr9WDQkt5PdSCQWnmP',
    '7x7vqpNoUeGZnK1nnvkRaMoiEuAbyfvuAajuBtFPKjuq',
    'BdsRqJg5aA9H1aetXgniVQTh4SFpkzYcxSQCgkTa8FRK',
    'ADEyjn3apNiUJ5t5rjEGaysuiX7APu1ihbfkrG6c3PCk',
    '7mGYx1maeJNrBoB9KKHuf8VDLF3yfWJQAQVyWQXHsvEs',
];

export const useTickerData = () => {
    const { pools } = useGlobalPools();

    const [tickerData, setTickerData] = useState<TickerItem[]>([
        { label: 'NETWORK', value: 'SOLANA MAINNET' },
        { label: 'SSS10i PRICE', value: 'LOADING...' },
        { label: 'LIQUID SSS10i', value: 'LOADING...' },
        { label: 'LOCKED EMISSIONS', value: 'LOADING...' },
        { label: 'GLOBAL TVL', value: 'LOADING...' },
        { label: 'ARTIFACT TREASURY', value: 'LOADING...' },
        { label: 'CARDANO BURNED', value: 'LOADING...' },
    ]);

    // Derive GLOBAL TVL and SSS10i PRICE from shared context/provider (no RPC needed)
    useEffect(() => {
        const livePrices = getLivePrices();
        const sss10iPrice = livePrices.SSS10i || 0;

        // Calculate TVL from GlobalPoolContext data (already fetched via centralized polling)
        const globalTvlUsd = Object.values(pools).reduce((acc, pool) => {
            return acc + (pool.stakedLpUsdRaw || 0);
        }, 0);

        const updates: Partial<Record<string, string>> = {};

        // SSS10i price from shared priceProvider
        if (sss10iPrice > 0) {
            if (sss10iPrice >= 1) {
                updates['SSS10i PRICE'] = `$${sss10iPrice.toFixed(2)}`;
            } else if (sss10iPrice >= 0.01) {
                updates['SSS10i PRICE'] = `$${sss10iPrice.toFixed(4)}`;
            } else {
                updates['SSS10i PRICE'] = `$${sss10iPrice.toExponential(2)}`;
            }
        }

        // Global TVL from shared context
        if (globalTvlUsd > 0) {
            updates['GLOBAL TVL'] = `$${globalTvlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        }

        if (Object.keys(updates).length > 0) {
            setTickerData(current => current.map(item => {
                if (updates[item.label] !== undefined) {
                    return { ...item, value: updates[item.label]! };
                }
                return item;
            }));
        }
    }, [pools]);

    // Fetch only the data that ISN'T available from shared sources (batched RPC)
    useEffect(() => {
        const fetchUniqueData = async () => {
            try {
                const connection = getSmartConnection();
                const updates: Partial<Record<string, string>> = {};

                // Build all accounts we need to fetch in a single batch
                const accountsToFetch: PublicKey[] = [];

                // Index 0: CARDANO token supply (getTokenSupply is separate, can't batch with accounts)
                // Index 0: SSS10i token supply
                // We need getTokenSupply calls which are separate from getMultipleAccountsInfo
                // But we CAN batch all the treasury ATA lookups

                // 1. NFT Treasury PDA for DAS call
                const [nftTreasuryPda] = PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode('nft_treasury')],
                    PROGRAM_ID
                );

                // 2. NFT Treasury SSS10i ATA
                const nftTreasuryAta = getAssociatedTokenAddressSync(SSS10i_MINT, nftTreasuryPda, true, TOKEN_PROGRAM_ID);
                accountsToFetch.push(nftTreasuryAta);

                // 3. Pool treasury ATAs (for locked emissions)
                const treasuryAtas = POOL_PUBKEYS.map(poolAddr => {
                    const poolPubkey = new PublicKey(poolAddr);
                    const [treasuryPda] = PublicKey.findProgramAddressSync(
                        [anchor.utils.bytes.utf8.encode('treasury'), poolPubkey.toBuffer()],
                        PROGRAM_ID
                    );
                    return getAssociatedTokenAddressSync(SSS10i_MINT, treasuryPda, true, TOKEN_PROGRAM_ID);
                });
                accountsToFetch.push(...treasuryAtas);

                // Execute all fetches in parallel: token supplies + account batch + DAS
                const [cardanoSupplyRes, sss10iSupplyRes, accountInfos, dasResult] = await Promise.allSettled([
                    // CARDANO supply
                    connection.getTokenSupply(CARDANO_MINT),
                    // SSS10i supply  
                    connection.getTokenSupply(SSS10i_MINT),
                    // Batch all treasury accounts (1 RPC call)
                    connection.getMultipleAccountsInfo(accountsToFetch),
                    // NFT count via Helius DAS
                    fetch(RPC_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0', id: 'ticker-nft',
                            method: 'searchAssets',
                            params: {
                                ownerAddress: nftTreasuryPda.toBase58(),
                                page: 1, limit: 100,
                            },
                        }),
                    }).then(r => r.json()),
                ]);

                // Parse CARDANO burned
                if (cardanoSupplyRes.status === 'fulfilled') {
                    const currentCirculating = Number(cardanoSupplyRes.value.value.uiAmount ?? 0);
                    const burned = Math.max(0, CARDANO_INITIAL_SUPPLY - currentCirculating);
                    updates['CARDANO BURNED'] = `${(burned / 1_000_000).toFixed(2)}M`;
                }

                // Parse NFT treasury count
                if (dasResult.status === 'fulfilled') {
                    const dasData = dasResult.value;
                    const nftCount = dasData?.result?.total ?? dasData?.result?.items?.length ?? 0;
                    updates['ARTIFACT TREASURY'] = `${nftCount}/77`;
                }

                // Parse treasury balances from batched account fetch
                if (sss10iSupplyRes.status === 'fulfilled' && accountInfos.status === 'fulfilled') {
                    const totalSss10i = Number(sss10iSupplyRes.value.value.uiAmount ?? 0);
                    const infos = accountInfos.value;

                    // Index 0: NFT treasury SSS10i ATA
                    let nftTreasuryLocked = 0;
                    if (infos[0] && infos[0].data.length >= 72) {
                        const amount = infos[0].data.readBigUInt64LE(64);
                        nftTreasuryLocked = Number(amount) / 1e9;
                    }

                    // Indices 1-6: Pool treasury ATAs
                    let emissionsLocked = 0;
                    for (let i = 1; i <= POOL_PUBKEYS.length; i++) {
                        const info = infos[i];
                        if (info && info.data.length >= 72) {
                            const amount = info.data.readBigUInt64LE(64);
                            emissionsLocked += Number(amount) / 1e9;
                        }
                    }

                    const liquidSupply = Math.max(0, totalSss10i - nftTreasuryLocked - emissionsLocked);
                    updates['LIQUID SSS10i'] = `${liquidSupply.toFixed(2)}/77`;
                    updates['LOCKED EMISSIONS'] = `${emissionsLocked.toFixed(2)} SSS10i`;
                }

                if (Object.keys(updates).length > 0) {
                    setTickerData(current => current.map(item => {
                        if (updates[item.label] !== undefined) {
                            return { ...item, value: updates[item.label]! };
                        }
                        return item;
                    }));
                }
            } catch (err) {
                console.error("Ticker Data Fetch Error:", err);
            }
        };

        fetchUniqueData();
        const interval = setInterval(fetchUniqueData, 60000); // 60s for the remaining unique calls
        return () => clearInterval(interval);
    }, []);

    return tickerData;
};
