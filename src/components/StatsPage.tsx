import React, { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import './StatsPage.css';
import {
    RPC_URL,
    PROGRAM_ID,
    SSS10i_MINT,
    CARDANO_MINT,
    NFT_MINT, // collection mint
} from '../utils/constants';
import { useAnchorProgram } from '../hooks/useAnchorProgram';
import { useGlobalPools } from '../contexts/GlobalPoolContext';
import { getSmartConnection } from '../utils/SmartConnection';

const HELIUS_RPC = RPC_URL;

// Known pool pubkeys (avoids expensive getProgramAccounts)
const KNOWN_POOL_PUBKEYS = [
    { address: 'GNwnKFx2v6zoPRtnv7SxN3mhAKfy4c1dmRZA1WkfkMFp', name: 'CARDANO/SOL LP' },
    { address: '6k7fotdNejY4v2Y6LRRELPPBJPdr9WDQkt5PdSCQWnmP', name: 'CARDANO/USDC LP' },
    { address: '7x7vqpNoUeGZnK1nnvkRaMoiEuAbyfvuAajuBtFPKjuq', name: 'SSS10i/CARDANO LP' },
    { address: 'BdsRqJg5aA9H1aetXgniVQTh4SFpkzYcxSQCgkTa8FRK', name: 'SSS10i/USDC LP' },
    { address: 'ADEyjn3apNiUJ5t5rjEGaysuiX7APu1ihbfkrG6c3PCk', name: 'HARRY/CARDANO LP' },
    { address: '7mGYx1maeJNrBoB9KKHuf8VDLF3yfWJQAQVyWQXHsvEs', name: 'BULK/CARDANO LP' },
];
const TOTAL_NFT_SUPPLY = 77;

const REFRESH_INTERVAL_MS = 60_000;

interface PoolLiveData {
    address: string;
    totalStaked: number;      // raw LP units staked
    lpMint: string;
    rewardMint: string;
    allocPoint: number;
    totalAllocPoint: number;
    rewardPerSecond: number;  // global
    treasurySss10iBalance: number;
    emissionEndTime: number;  // unix
    name: string;             // pool display name
}

interface StatsData {
    // From on-chain
    sss10iCirculatingSupply: number | null;   // total minted - treasury liquid
    treasurySss10iLiquid: number | null;      // SSS10i in treasury
    treasuryNftCount: number | null;          // NFTs in treasury PDA
    cardanoTotalSupply: number | null;        // Derive burned = max - current
    cardanoBurned: number | null;             // burned = initial supply - current circulating
    pools: PoolLiveData[];
    emissionEndTime: number | null;           // unix timestamp from global state
    rewardPerSecond: number | null;
    dailyEmissionTotal: number | null;
    error: string | null;
    lastRefresh: Date | null;
}

const StatCard: React.FC<{ label: string; value: React.ReactNode; sub?: string; className?: string }> = ({
    label, value, sub, className = ''
}) => (
    <div className={`stat-card ${className}`}>
        <div className="card-bg-effect"></div>
        <p className="label">{label}</p>
        <h3 className="value">{value}</h3>
        {sub && <p className="sub-label">{sub}</p>}
    </div>
);


const StatsPage: React.FC = () => {
    const { pools: globalPools, isLoading: poolsLoading } = useGlobalPools();

    const [stats, setStats] = useState<StatsData>({
        sss10iCirculatingSupply: null,
        treasurySss10iLiquid: null,
        treasuryNftCount: null,
        cardanoTotalSupply: null,
        cardanoBurned: null,
        pools: [],
        emissionEndTime: null,
        rewardPerSecond: null,
        dailyEmissionTotal: null,
        error: null,
        lastRefresh: null,
    });
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState<string>('--:--:--:--');
    const program = useAnchorProgram();

    // Calculate Global TVL instantly from the GlobalPoolContext instead of RPC loops
    const globalTvlUsd = Object.values(globalPools).reduce((acc, pool) => {
        const poolUsdNum = pool.stakedLpUsdRaw || 0;
        return acc + poolUsdNum;
    }, 0);


    // Countdown timer based on on-chain emission_end_time
    useEffect(() => {
        if (!stats.emissionEndTime) return;
        const endMs = stats.emissionEndTime * 1000;
        const timer = setInterval(() => {
            const distance = endMs - Date.now();
            if (distance <= 0) { setCountdown('00:00:00:00'); return; }
            const days = Math.floor(distance / 86400000);
            const hrs  = Math.floor((distance % 86400000) / 3600000);
            const mins = Math.floor((distance % 3600000) / 60000);
            const secs = Math.floor((distance % 60000) / 1000);
            setCountdown(`${days}:${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`);
        }, 1000);
        return () => clearInterval(timer);
    }, [stats.emissionEndTime]);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        const connection = getSmartConnection();
        const newStats: StatsData = {
            sss10iCirculatingSupply: null,
            treasurySss10iLiquid: null,
            treasuryNftCount: null,
            cardanoTotalSupply: null,
            cardanoBurned: null,
            pools: [],
            emissionEndTime: null,
            rewardPerSecond: null,
            dailyEmissionTotal: null,
            error: null,
            lastRefresh: new Date(),
        };

        try {
            // ── 1. SSS10i CIRCULATING SUPPLY ───────────────────────────────
            const sss10iSupplyRes = await connection.getTokenSupply(SSS10i_MINT);
            const totalSss10i = Number(sss10iSupplyRes.value.uiAmount ?? 0);

            // ── 2. GLOBAL NFT TREASURY PDA ────────────────────────────────
            let nftTreasuryPda: PublicKey | null = null;
            if (program) {
                const [pda] = PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode('nft_treasury')],
                    PROGRAM_ID
                );
                nftTreasuryPda = pda;
            }

            // ── 3. GLOBAL NFT TREASURY SSS10i BALANCE ─────────────────────
            if (nftTreasuryPda) {
                try {
                    const tAta = getAssociatedTokenAddressSync(SSS10i_MINT, nftTreasuryPda, true, TOKEN_PROGRAM_ID);
                    const tBal = await connection.getTokenAccountBalance(tAta);
                    newStats.treasurySss10iLiquid = Number(tBal.value.uiAmount ?? 0);
                } catch { newStats.treasurySss10iLiquid = 0; }
            }

            // Calculate total SSS10i locked in all pool treasuries (emissions not yet claimed)
            let poolTreasuriesLocked = 0;
            const treasuryAtas = KNOWN_POOL_PUBKEYS.map(poolInfo => {
                const poolPubkey = new PublicKey(poolInfo.address);
                const [treasuryPda] = PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode('treasury'), poolPubkey.toBuffer()],
                    PROGRAM_ID
                );
                return getAssociatedTokenAddressSync(SSS10i_MINT, treasuryPda, true, TOKEN_PROGRAM_ID);
            });

            try {
                const treasuryInfos = await connection.getMultipleAccountsInfo(treasuryAtas);
                for (const info of treasuryInfos) {
                    if (info && info.data.length >= 72) {
                        const amount = info.data.readBigUInt64LE(64);
                        poolTreasuriesLocked += Number(amount) / 1e9; // SSS10i has 9 decimals
                    }
                }
            } catch { /* batch fetch failed */ }

            // Circulating/Emitted = total minted minus what's locked in NFT treasury and pool treasuries
            const lockedLiquid = (newStats.treasurySss10iLiquid ?? 0) + poolTreasuriesLocked;
            newStats.sss10iCirculatingSupply = parseFloat((totalSss10i - lockedLiquid).toFixed(9));

            // ── 4. GLOBAL NFT TREASURY NFT COUNT via Helius DAS ───────────
            if (nftTreasuryPda) {
                try {
                    const dasRes = await fetch(HELIUS_RPC, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0', id: 'stats-nft',
                            method: 'searchAssets',
                            params: {
                                ownerAddress: nftTreasuryPda.toBase58(),
                                grouping: ['collection', NFT_MINT.toBase58()],
                                page: 1, limit: 100,
                            },
                        }),
                    });
                    const dasData = await dasRes.json();
                    newStats.treasuryNftCount = dasData?.result?.total ?? dasData?.result?.items?.length ?? 0;
                } catch { newStats.treasuryNftCount = 0; }
            }

            // ── 5. CARDANO BURNED ─────────────────────────────────────────
            // Token-2022 — getTokenSupply works the same way
            try {
                const cardanoRes = await connection.getTokenSupply(CARDANO_MINT);
                // pump.fun initial supply is 1,000,000,000 (1 billion) for all tokens
                const CARDANO_INITIAL_SUPPLY = 1_000_000_000;
                const currentCirculatingCardano = Number(cardanoRes.value.uiAmount ?? 0);
                newStats.cardanoTotalSupply = currentCirculatingCardano;
                // Burned = initial - current (pump.fun tokens start at 1B, no reminting)
                newStats.cardanoBurned = Math.max(0, CARDANO_INITIAL_SUPPLY - currentCirculatingCardano);
            } catch { /* leave null */ }

            // ── 6. POOL + GLOBAL STATE from Anchor (batched, no getProgramAccounts) ──
            if (program) {
                try {
                    // Global state
                    const [globalPda] = PublicKey.findProgramAddressSync(
                        [anchor.utils.bytes.utf8.encode('global')],
                        PROGRAM_ID
                    );

                    // Build batch: globalPda + all known pool pubkeys
                    const poolPubkeys = KNOWN_POOL_PUBKEYS.map(p => new PublicKey(p.address));
                    const batchKeys = [globalPda, ...poolPubkeys];

                    // Also batch all treasury SSS10i ATAs for per-pool balances
                    const poolTreasuryAtaKeys = poolPubkeys.map(poolPk => {
                        const [treasuryPda] = PublicKey.findProgramAddressSync(
                            [anchor.utils.bytes.utf8.encode('treasury'), poolPk.toBuffer()],
                            PROGRAM_ID
                        );
                        return getAssociatedTokenAddressSync(SSS10i_MINT, treasuryPda, true, TOKEN_PROGRAM_ID);
                    });
                    batchKeys.push(...poolTreasuryAtaKeys);

                    // Single batched RPC call for everything
                    const batchInfos = await connection.getMultipleAccountsInfo(batchKeys);

                    // Decode global state (index 0)
                    const globalInfo = batchInfos[0];
                    if (!globalInfo) throw new Error('Global state not found');
                    const globalProxy = (program as any).account.globalState || (program as any).account.GlobalState;
                    const globalAccount = globalProxy.coder.accounts.decode('GlobalState', globalInfo.data);

                    newStats.emissionEndTime = Number(globalAccount.emissionEndTime ?? 0);
                    newStats.rewardPerSecond = Number(globalAccount.totalRewardPerSecond ?? 0);
                    newStats.dailyEmissionTotal = (newStats.rewardPerSecond / 1e9) * 86400;
                    const totalAllocPoint = Number(globalAccount.totalAllocPoint ?? 1);

                    // Decode individual pools (indices 1..6)
                    const poolProxy = (program as any).account.poolState || (program as any).account.PoolState;

                    newStats.pools = KNOWN_POOL_PUBKEYS.map((poolMeta, i) => {
                        const poolInfo = batchInfos[1 + i];
                        const treasuryInfo = batchInfos[1 + KNOWN_POOL_PUBKEYS.length + i];

                        let poolAccount: any = null;
                        if (poolInfo) {
                            try {
                                poolAccount = poolProxy.coder.accounts.decode('PoolState', poolInfo.data);
                            } catch { /* decode error */ }
                        }

                        // Parse treasury balance from raw account data
                        let treasuryBalance = 0;
                        if (treasuryInfo && treasuryInfo.data.length >= 72) {
                            const amount = treasuryInfo.data.readBigUInt64LE(64);
                            treasuryBalance = Number(amount) / 1e9;
                        }

                        return {
                            address: poolMeta.address,
                            totalStaked: poolAccount ? Number(poolAccount.totalStaked ?? 0) : 0,
                            lpMint: poolAccount?.acceptedLpMint?.toBase58?.() ?? '',
                            rewardMint: poolAccount?.rewardMint?.toBase58?.() ?? '—',
                            allocPoint: poolAccount ? Number(poolAccount.allocPoint ?? 0) : 0,
                            totalAllocPoint,
                            rewardPerSecond: newStats.rewardPerSecond ?? 0,
                            treasurySss10iBalance: treasuryBalance,
                            emissionEndTime: newStats.emissionEndTime ?? 0,
                            name: poolMeta.name,
                        };
                    }).sort((a, b) => b.allocPoint - a.allocPoint);
                } catch (e: any) {
                    newStats.error = `Pool/Global fetch failed: ${e.message}`;
                }
            } else {
                newStats.error = 'Program not connected — connect wallet for full stats.';
            }

        } catch (e: any) {
            newStats.error = `Stats fetch error: ${e.message}`;
        }

        setStats(newStats);
        setLoading(false);
    }, [program]);

    useEffect(() => {
        fetchStats();
        // Still poll stats every 60s since these contain heavy Dashboard-level computations 
        // that shouldn't burden the 10s instant pool loops.
        const interval = setInterval(fetchStats, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchStats]);

    const nftInCirculation = TOTAL_NFT_SUPPLY - (stats.treasuryNftCount ?? TOTAL_NFT_SUPPLY);
    const liquidInCirculation = stats.sss10iCirculatingSupply ?? 0;

    return (
        <div className="stats-container">
            {loading && <div className="stats-loading-bar" />}

            <div className="stats-grid">

                {/* SSS10i Circulating Supply */}
                <StatCard
                    className="tvl-card"
                    label="SSS10i CIRCULATING SUPPLY"
                    value={
                        stats.sss10iCirculatingSupply === null
                            ? <span className="loading-pulse">LOADING...</span>
                            : <span className="glow-text">{stats.sss10iCirculatingSupply.toFixed(4)}</span>
                    }
                    sub={`OF ${TOTAL_NFT_SUPPLY} TOTAL UNITS`}
                />

                {/* Resource Ratio */}
                <div className="stat-card distribution-card">
                    <div className="card-bg-effect"></div>
                    <p className="label">RESOURCE RATIO</p>
                    <div className="ratio-split">
                        <div className="split-item">
                            <span className="split-val">
                                {stats.treasuryNftCount === null ? '—' : nftInCirculation}
                            </span>
                            <span className="split-label">wSSS10i (NFT)</span>
                        </div>
                        <div className="divider">/</div>
                        <div className="split-item">
                            <span className="split-val">
                                {stats.sss10iCirculatingSupply === null ? '—' : liquidInCirculation.toFixed(3)}
                            </span>
                            <span className="split-label">$SSS10i (LIQUID)</span>
                        </div>
                    </div>
                    <p className="sub-label">
                        TREASURY: {stats.treasuryNftCount === null ? '—' : stats.treasuryNftCount} NFTs + {stats.treasurySss10iLiquid === null ? '—' : stats.treasurySss10iLiquid?.toFixed(3)} LIQUID
                    </p>
                </div>

                {/* CARDANO Burned */}
                <StatCard
                    className="burn-card"
                    label="TOTAL $CARDANO BURNED"
                    value={
                        stats.cardanoBurned === null
                            ? <span className="loading-pulse">LOADING...</span>
                            : <span className="fire-text">{stats.cardanoBurned.toLocaleString()}</span>
                    }
                    sub="ON-CHAIN VERIFIED"
                />

                {/* TVL — Real-time from DexScreener via Context */}
                <StatCard
                    className="tvl-card"
                    label="TOTAL VALUE LOCKED (USD)"
                    value={
                        poolsLoading 
                            ? <span className="loading-pulse">LOADING...</span>
                            : <span className="glow-text">${globalTvlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    }
                    sub="REAL-TIME LP VALUATION (LIVE)"
                />

                {/* Extraction Array Pool Table */}
                <div className="stat-card pool-stats-full">
                    <p className="label">EXTRACTION ARRAY STATUS</p>
                    <div className="status-table">
                        <div className="table-row header">
                            <span>POOL</span>
                            <span>DAILY EMISSION</span>
                            <span>TREASURY SSS10i</span>
                            <span>STAKED LP</span>
                        </div>
                        {stats.error && (
                            <div className="table-row error-row">
                                <span style={{color:'#f87171', fontSize:'0.75rem'}}>{stats.error}</span>
                            </div>
                        )}
                        {!stats.error && stats.pools.length > 0 && stats.pools.map((pool) => {
                            const poolWeight = pool.allocPoint / Math.max(pool.totalAllocPoint, 1);
                            const poolDailyEmission = (pool.rewardPerSecond / 1e9) * 86400 * poolWeight;
                            const isActive = pool.allocPoint > 0 && pool.treasurySss10iBalance > 0;
                            // Pull LIVE staked amount from the Global Context if available
                            const liveStakedLp = globalPools[pool.address]?.stakedLpAmount ?? (pool.totalStaked / 1e9);
                            
                            return (
                                <div key={pool.address} className="table-row">
                                    <span title={pool.address}>{pool.name}</span>
                                    <span>{poolDailyEmission > 0 ? poolDailyEmission.toFixed(4) : '—'} SSS10i</span>
                                    <span>{pool.treasurySss10iBalance.toFixed(4)}</span>
                                    <span>{liveStakedLp.toFixed(4)}</span>
                                    <span className={isActive ? 'st-active' : 'st-pending'}>
                                        {isActive ? 'ACTIVE' : 'PENDING'}
                                    </span>
                                </div>
                            );
                        })}
                        {!stats.error && stats.pools.length === 0 && !loading && (
                            <div className="table-row">
                                <span style={{opacity:0.5}}>No pools found — wallet may need connection</span>
                            </div>
                        )}
                        {loading && (
                            <div className="table-row">
                                <span className="loading-pulse">SYNCING WITH CHAIN...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Daily Emission Rate */}
                <StatCard
                    label="DAILY EMISSION RATE"
                    value={
                        stats.dailyEmissionTotal === null
                            ? <span className="loading-pulse">LOADING...</span>
                            : <span className="ice-accent">{stats.dailyEmissionTotal.toFixed(4)} SSS10i</span>
                    }
                    sub="GLOBAL ACROSS ALL POOLS"
                />

                {/* Network Inflation */}
                <StatCard
                    label="NETWORK INFLATION"
                    value={
                        (stats.dailyEmissionTotal === null || stats.sss10iCirculatingSupply === null || stats.sss10iCirculatingSupply === 0)
                            ? <span className="loading-pulse">LOADING...</span>
                            : <span className="fire-text">
                                {((stats.dailyEmissionTotal / stats.sss10iCirculatingSupply) * 100).toFixed(2)}%
                              </span>
                    }
                    sub="DAILY INFLATION RATE VS CIRCULATING SUPPLY"
                />

            </div>

            <div className="stats-footer-note">
                <div className="emission-countdown-inline">
                    <span className="label">EMISSION LIFECYCLE:</span>
                    <span className="value countdown-glitch">{countdown}</span>
                </div>
                <p>
                    DATA REFRESHED EVERY 60S // BLOCKCHAIN STATE VERIFIED
                    {stats.lastRefresh && ` // LAST SYNC: ${stats.lastRefresh.toLocaleTimeString()}`}
                </p>
            </div>
        </div>
    );
};

export default StatsPage;
