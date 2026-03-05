import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAnchorProgram } from '../hooks/useAnchorProgram';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { POOL_CONFIGS } from '../utils/mockApi';
import { getLpUsdValue, formatUsd, fetchLivePrices, getLivePrices, fetchLpPrice } from '../utils/priceProvider';

export interface PoolStateData {
    pubkey: string;
    stakedLpAmount: number; // Staked in the pool (decimal adjusted)
    stakedLpUsd: string;    // Formatted TVL USD
    stakedLpUsdRaw: number; // Raw float TVL USD for rendering math safely
    userStakedLp: number;   // User's stake (decimal adjusted)
    userStakedLpUsd: string;// User's stake formatted USD
    userStakedLpRaw: anchor.BN | null; // Raw BN for withdraws
    userLpBalance: number;  // User's ATAs balance right now
    earnedSss10i: string;   // Live pending harvest amount
    userVelocity: string;   // Live daily velocity formatted
    lpDecimals: number;     // Extracted from LP Mint
    poolApr: string;        // Dynamic live APR formatted string
}

interface GlobalPoolContextType {
    pools: Record<string, PoolStateData>; // Mapped by poolPubkey
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const GlobalPoolContext = createContext<GlobalPoolContextType>({
    pools: {},
    isLoading: true,
    refreshData: async () => {},
});

export const GlobalPoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pools, setPools] = useState<Record<string, PoolStateData>>({});
    const [isLoading, setIsLoading] = useState(true);
    const program = useAnchorProgram();
    const wallet = useAnchorWallet();
    const isFetchingRef = useRef(false);

    const fetchAllData = useCallback(async () => {
        if (!program || isFetchingRef.current) return;
        // Skip polling when tab is backgrounded to save RPC calls
        if (document.hidden) return;
        isFetchingRef.current = true;

        try {
            await fetchLivePrices();
            // We'll calculate price down lower using the import

            // Extract valid active pools
            const activeConfigs = POOL_CONFIGS.filter(p => !p.isOffline && p.poolPubkey);
            
            // Build arrays of pubkeys to fetch in batches
            const accountPubkeysToFetch: PublicKey[] = [];
            
            const [globalPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );
            accountPubkeysToFetch.push(globalPda);

            const poolPdas: PublicKey[] = [];
            const userPdas: PublicKey[] = [];
            const lpMintPdas: PublicKey[] = [];
            const userLpAtas: PublicKey[] = [];

            for (const config of activeConfigs) {
                const poolPubkey = new PublicKey(config.poolPubkey!);
                poolPdas.push(poolPubkey);
                accountPubkeysToFetch.push(poolPubkey);
                
                const lpMintPubkey = new PublicKey(config.lpMintAddress);
                lpMintPdas.push(lpMintPubkey);
                accountPubkeysToFetch.push(lpMintPubkey);

                if (wallet) {
                    const [userInfoPda] = PublicKey.findProgramAddressSync(
                        [anchor.utils.bytes.utf8.encode("user"), poolPubkey.toBuffer(), wallet.publicKey.toBuffer()],
                        program.programId
                    );
                    userPdas.push(userInfoPda);
                    accountPubkeysToFetch.push(userInfoPda);

                    const lpAta = getAssociatedTokenAddressSync(lpMintPubkey, wallet.publicKey);
                    userLpAtas.push(lpAta);
                    accountPubkeysToFetch.push(lpAta);
                }
            }

            // Fetch all LP prices in parallel (non-blocking, cached 30s)
            await Promise.allSettled(
                activeConfigs
                    .filter(c => c.raydiumPoolId)
                    .map(c => fetchLpPrice(c.raydiumPoolId!))
            );

            // --- BATCH FETCH EVERYTHING ---
            // This replaces ~20 individual RPC calls with 1
            const accountInfos = await program.provider.connection.getMultipleAccountsInfo(accountPubkeysToFetch);
            
            let infoIndex = 0;
            const globalInfo = accountInfos[infoIndex++];
            let globalState: any = null;
            
            if (globalInfo) {
                 const globalAccountProxy = (program as any).account.globalState || (program as any).account.GlobalState;
                 globalState = globalAccountProxy.coder.accounts.decode("GlobalState", globalInfo.data);
            }

            const SSS10i_DECIMALS = 1_000_000_000;
            const newPoolsData: Record<string, PoolStateData> = {};

            for (let i = 0; i < activeConfigs.length; i++) {
                const config = activeConfigs[i];
                const poolKeyStr = config.poolPubkey!;
                
                // Decode Pool State
                const poolInfo = accountInfos[infoIndex++];
                let poolState: any = null;
                if (poolInfo) {
                     const accountProxy = (program as any).account.poolState || (program as any).account.PoolState;
                     poolState = accountProxy.coder.accounts.decode("PoolState", poolInfo.data);
                }

                // Decode LP Mint Info (for decimals)
                const mintInfoRaw = accountInfos[infoIndex++];
                let lpDecimals = 6;
                if (mintInfoRaw) {
                     lpDecimals = mintInfoRaw.data[44]; // Byte 44 in standard SPL Mint Layout is decimals
                }
                const LP_BASE = Math.pow(10, lpDecimals);

                // Decode User Info
                let userInfo: any = null;
                if (wallet) {
                    const userInfoRaw = accountInfos[infoIndex++];
                    if (userInfoRaw) {
                         const userProxy = (program as any).account.userInfo || (program as any).account.UserInfo;
                         userInfo = userProxy.coder.accounts.decode("UserInfo", userInfoRaw.data);
                    }
                }

                // Decode User LP ATA
                let userLpBalanceNum = 0;
                if (wallet) {
                     const lpAtaRaw = accountInfos[infoIndex++];
                     if (lpAtaRaw) {
                         // Byte 64 in token account is the 8-byte amount
                         const amountBuf = Buffer.from(lpAtaRaw.data.slice(64, 72));
                         const rawAmount = amountBuf.readBigUInt64LE(0);
                         userLpBalanceNum = Number(rawAmount) / LP_BASE;
                     }
                }

                // CALCULATIONS 
                let stakedLpAmount = 0;
                let dailyRewards = 0;
                
                if (poolState && globalState) {
                     stakedLpAmount = Number(poolState.totalStaked.toString()) / LP_BASE;
                     const dailyRewardsBig = (BigInt(globalState.totalRewardPerSecond.toString()) * BigInt(poolState.allocPoint.toString()) / BigInt(globalState.totalAllocPoint.toString())) * 86400n;
                     dailyRewards = Number(dailyRewardsBig) / SSS10i_DECIMALS;
                }

                const stakedLpUsdRaw = getLpUsdValue(stakedLpAmount, config.subtitle, config.raydiumPoolId);
                const stakedLpUsd = formatUsd(stakedLpUsdRaw);

                // USER CALCULATIONS
                let userStakedLp = 0;
                let userVelocity = "0.000000 SSS10I / DAY";
                let earnedSss10i = "0.00000000";
                
                if (userInfo && poolState && globalState) {
                     userStakedLp = Number(userInfo.stakedAmount.toString()) / LP_BASE;
                     
                     if (stakedLpAmount > 0) {
                         const userDaily = (dailyRewards * userStakedLp) / stakedLpAmount;
                         userVelocity = `${userDaily.toFixed(6)} SSS10I / DAY`;
                     }

                     // Harvest Math 
                     const now = BigInt(Math.floor(Date.now() / 1000));
                     const lastUpdate = BigInt(poolState.lastUpdateTime.toString());
                     const totalStakedBig = BigInt(poolState.totalStaked.toString());
                     const rewardPerSecBig = BigInt(globalState.totalRewardPerSecond.toString());
                     const allocBig = BigInt(poolState.allocPoint.toString());
                     const totalAllocBig = BigInt(globalState.totalAllocPoint.toString());
                     let accRewardPerShareBig = BigInt(poolState.accRewardPerShare.toString());

                     if (now > lastUpdate && totalStakedBig > 0n && totalAllocBig > 0n) {
                         const elapsed = now - lastUpdate;
                         const rewardEmitted = (elapsed * rewardPerSecBig * allocBig) / totalAllocBig;
                         const addedAcc = (rewardEmitted * 1_000_000_000_000n) / totalStakedBig;
                         accRewardPerShareBig = accRewardPerShareBig + addedAcc;
                     }

                     const stakedBig = BigInt(userInfo.stakedAmount.toString());
                     const rewardDebtBig = BigInt(userInfo.rewardDebt.toString());
                     const pendingStoredBig = BigInt(userInfo.pendingRewards.toString());

                     const accumulated = (stakedBig * accRewardPerShareBig) / 1_000_000_000_000n;
                     const newPending = accumulated > rewardDebtBig ? accumulated - rewardDebtBig : 0n;
                     const totalPending = newPending + pendingStoredBig;
                     const earnedDisplay = Number(totalPending) / 1_000_000_000;
                     earnedSss10i = earnedDisplay.toFixed(8);
                }

                // Calculate APR dynamically based on live fiat values
                let poolApr = "0.00%";
                
                // Fetch the specific SSS10i Mint live price from the flat mapping object
                const livePrices = getLivePrices();
                const sss10iPrice = livePrices.SSS10i || 0.005;

                
                if (stakedLpUsdRaw > 0 && dailyRewards > 0) {
                    const yearlyRewardsSss10i = dailyRewards * 365;
                    const yearlyRewardsUsd = yearlyRewardsSss10i * sss10iPrice;
                    const aprRatio = (yearlyRewardsUsd / stakedLpUsdRaw) * 100;
                    
                    if (aprRatio > 999999) {
                        poolApr = "> 999k%";
                    } else {
                        poolApr = aprRatio.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + "%";
                    }
                }

                newPoolsData[poolKeyStr] = {
                     pubkey: poolKeyStr,
                     stakedLpAmount,
                     stakedLpUsd,
                     stakedLpUsdRaw,
                     userStakedLp,
                     userStakedLpUsd: formatUsd(getLpUsdValue(userStakedLp, config.subtitle, config.raydiumPoolId)),
                     userStakedLpRaw: userInfo ? userInfo.stakedAmount : null,
                     userLpBalance: userLpBalanceNum,
                     earnedSss10i,
                     userVelocity,
                     lpDecimals,
                     poolApr
                };
            }

            setPools(newPoolsData);

        } catch (err) {
            console.error("GlobalPoolContext fetch error:", err);
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [program, wallet]);

    // MAIN POLLING LOOP (10 seconds) — pauses when tab is backgrounded
    useEffect(() => {
        if (!program) return;
        
        fetchAllData(); // initial fetch
        const intervalId = setInterval(fetchAllData, 10000); // 10s centralized polling

        // Immediately refresh when user returns to the tab
        const handleVisibility = () => {
            if (!document.hidden) fetchAllData();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        
        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [program, wallet, fetchAllData]);

    return (
        <GlobalPoolContext.Provider value={{ pools, isLoading, refreshData: fetchAllData }}>
            {children}
        </GlobalPoolContext.Provider>
    );
};

export const useGlobalPools = () => useContext(GlobalPoolContext);
