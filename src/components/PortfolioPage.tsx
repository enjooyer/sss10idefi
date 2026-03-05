import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import html2canvas from 'html2canvas';
import { useGlobalPools } from '../contexts/GlobalPoolContext';
import type { PoolStateData } from '../contexts/GlobalPoolContext';
import type { PoolData } from '../utils/mockApi';
import { POOL_CONFIGS } from '../utils/mockApi';
import { CARDANO_MINT, SSS10i_MINT } from '../utils/constants';
import { getLivePrices } from '../utils/priceProvider';
import { useAnchorProgram } from '../hooks/useAnchorProgram';
import { useToast } from './ToastProvider';
import { getSmartConnection } from '../utils/SmartConnection';
import './PortfolioPage.css';

const CARDANO_INITIAL_SUPPLY = 1_000_000_000;
const BG_COUNT = 10; // Number of background images available (1.png–10.png)

const PortfolioPage: React.FC = () => {
    const wallet = useAnchorWallet();
    const { pools: globalPools, isLoading, refreshData } = useGlobalPools();
    const program = useAnchorProgram();
    const { showToast } = useToast();

    // CARDANO tracker state
    const [cardanoBalance, setCardanoBalance] = useState<number | null>(null);
    const [cardanoCirculating, setCardanoCirculating] = useState<number | null>(null);

    // Share modal state
    const [sharePool, setSharePool] = useState<{ config: PoolData; pool: PoolStateData } | null>(null);
    const [showTotalShare, setShowTotalShare] = useState(false);
    const [hideDeposit, setHideDeposit] = useState(false);
    const [selectedBg, setSelectedBg] = useState<number | null>(null);
    const [deepFry, setDeepFry] = useState(false);
    const [harvestingPool, setHarvestingPool] = useState<string | null>(null);
    const [savePreviewUrl, setSavePreviewUrl] = useState<string | null>(null);

    const pnlCardRef = useRef<HTMLDivElement>(null);

    // Fetch CARDANO balance + circulating supply
    const fetchCardanoData = useCallback(async () => {
        if (!wallet) return;
        const connection = getSmartConnection();

        try {
            // Use getParsedTokenAccountsByOwner to find ALL token accounts for the CARDANO mint.
            // This is more robust than deriving a single ATA — handles Token-2022, multiple accounts, etc.
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                wallet.publicKey,
                { mint: CARDANO_MINT }
            );

            let totalBalance = 0;
            for (const { account } of tokenAccounts.value) {
                const parsed = account.data.parsed?.info;
                if (parsed?.tokenAmount?.uiAmount != null) {
                    totalBalance += Number(parsed.tokenAmount.uiAmount);
                }
            }
            setCardanoBalance(totalBalance);
        } catch (err) {
            console.error('CARDANO balance fetch error:', err);
            setCardanoBalance(0);
        }

        try {
            const supplyRes = await connection.getTokenSupply(CARDANO_MINT);
            setCardanoCirculating(Number(supplyRes.value.uiAmount ?? 0));
        } catch {
            // leave null
        }
    }, [wallet]);

    useEffect(() => {
        fetchCardanoData();
        const interval = setInterval(fetchCardanoData, 60_000);
        return () => clearInterval(interval);
    }, [fetchCardanoData]);

    // Lock body scroll when share modal is open (prevents background scrolling on mobile)
    useEffect(() => {
        if (sharePool || showTotalShare) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [sharePool, showTotalShare]);

    // ── HARVEST HANDLER ──────────────────────────────────────
    const handleHarvest = async (poolPubkeyStr: string) => {
        if (!program || !wallet) {
            showToast("Wallet not connected.", "error");
            return;
        }

        setHarvestingPool(poolPubkeyStr);
        try {
            showToast("Extracting Fractions yield...", "info");
            const pubkey = new PublicKey(poolPubkeyStr);

            const [globalPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );

            const [userInfoPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("user"), pubkey.toBuffer(), wallet.publicKey.toBuffer()],
                program.programId
            );

            const [treasuryPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("treasury"), pubkey.toBuffer()],
                program.programId
            );

            const userFractionsAta = getAssociatedTokenAddressSync(SSS10i_MINT, wallet.publicKey);
            const treasuryFractionsAta = getAssociatedTokenAddressSync(SSS10i_MINT, treasuryPda, true);

            const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                wallet.publicKey,
                userFractionsAta,
                wallet.publicKey,
                SSS10i_MINT
            );

            const txHash = await program.methods.harvestMatrixRewards()
                .accounts({
                    global: globalPda,
                    pool: pubkey,
                    userInfo: userInfoPda,
                    user: wallet.publicKey,
                    rewardMint: SSS10i_MINT,
                    treasury: treasuryPda,
                    treasuryFractionsAta: treasuryFractionsAta,
                    userFractionsAta: userFractionsAta,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                } as any)
                .preInstructions([createAtaIx])
                .rpc({ skipPreflight: false, commitment: 'confirmed' });

            console.log("Harvest TX:", txHash);
            showToast(`Success: Harvested SSS10i Yield!`, 'success');
            await refreshData();
        } catch (err: any) {
            console.error("Harvest Error:", err);
            showToast(`Harvest Failed: ${err.message}`, "error");
        } finally {
            setHarvestingPool(null);
        }
    };

    // Collect active user positions
    const activeConfigs = POOL_CONFIGS.filter(p => !p.isOffline && p.poolPubkey);
    const userPositions = activeConfigs
        .map(config => ({
            config,
            pool: globalPools[config.poolPubkey!],
        }))
        .filter(p => p.pool && p.pool.userStakedLp > 0);

    // Aggregate totals
    const livePrices = getLivePrices();
    const sss10iPrice = livePrices.SSS10i || 0;

    let totalDepositedUsd = 0;
    let totalPendingSss10i = 0;

    for (const pos of userPositions) {
        const usdStr = pos.pool.userStakedLpUsd.replace(/[$,]/g, '');
        totalDepositedUsd += parseFloat(usdStr) || 0;
        totalPendingSss10i += parseFloat(pos.pool.earnedSss10i) || 0;
    }

    const totalPendingUsd = totalPendingSss10i * sss10iPrice;

    // Compute weighted-average APR across user positions
    let weightedAprSum = 0;
    let weightedAprDenom = 0;
    for (const pos of userPositions) {
        const aprStr = pos.pool.poolApr;
        if (aprStr === '> 999k%' || aprStr === '0.00%') continue;
        const aprNum = parseFloat(aprStr.replace(/[^0-9.]/g, ''));
        if (isNaN(aprNum)) continue;
        const usdStr = pos.pool.userStakedLpUsd.replace(/[$,]/g, '');
        const depositUsd = parseFloat(usdStr) || 0;
        if (depositUsd > 0) {
            weightedAprSum += depositUsd * aprNum;
            weightedAprDenom += depositUsd;
        }
    }
    const avgApr = weightedAprDenom > 0 ? weightedAprSum / weightedAprDenom : 0;
    const avgAprFormatted = avgApr > 999999 ? '> 999k%' : avgApr.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%';

    const cardanoBurned = cardanoCirculating !== null ? Math.max(0, CARDANO_INITIAL_SUPPLY - cardanoCirculating) : null;
    const cardanoSupplyPct = (cardanoBalance !== null && cardanoCirculating !== null && cardanoCirculating > 0)
        ? (cardanoBalance / cardanoCirculating) * 100
        : null;

    // Share card handlers
    // Helper: html2canvas does NOT support CSS filter. If deepFry is on, we
    // pre-render the filtered image onto a canvas, swap the data URL in, run
    // html2canvas, then restore. This bakes the effect into normal pixels.
    const isShareModalOpen = !!(sharePool || showTotalShare);

    const closeShareModal = () => {
        setSharePool(null);
        setShowTotalShare(false);
        setHideDeposit(false);
        setSelectedBg(null);
        setDeepFry(false);
    };

    const prepareForScreenshot = async (): Promise<(() => void) | null> => {
        if (!deepFry || !selectedBg || !pnlCardRef.current) return null;

        const bgDiv = pnlCardRef.current.querySelector('.pnl-bg-image') as HTMLElement | null;
        if (!bgDiv) return null;

        // Load the background image
        const imgUrl = `/assets/share-bg/${selectedBg}.png`;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = imgUrl;
        });

        // Draw on an off-screen canvas with the filter baked in
        const offscreen = document.createElement('canvas');
        offscreen.width = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        const ctx = offscreen.getContext('2d')!;
        ctx.filter = 'contrast(2.4) saturate(5) brightness(1.4) hue-rotate(20deg) sepia(0.3)';
        ctx.drawImage(img, 0, 0);

        // Swap in the pre-rendered data URL and remove the CSS filter
        const originalBg = bgDiv.style.backgroundImage;
        const originalFilter = bgDiv.style.filter;
        bgDiv.style.backgroundImage = `url(${offscreen.toDataURL('image/png')})`;
        bgDiv.style.filter = 'none';

        // Return a restore function
        return () => {
            bgDiv.style.backgroundImage = originalBg;
            bgDiv.style.filter = originalFilter;
        };
    };

    // Detect mobile: touch support + narrow viewport (wallet in-app browsers are always mobile)
    const isMobile = () =>
        'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;

    // Render PNL card to a canvas blob
    const renderPnlToBlob = async (): Promise<Blob | null> => {
        if (!pnlCardRef.current) return null;
        const restore = await prepareForScreenshot();
        const canvas = await html2canvas(pnlCardRef.current, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
        });
        restore?.();
        return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
    };

    const handleDownload = async () => {
        if (!pnlCardRef.current) return;
        try {
            const blob = await renderPnlToBlob();
            if (!blob) return;

            // ── MOBILE: try Web Share API first, then long-press preview ──
            if (isMobile()) {
                // Try Web Share API Level 2 (native share sheet)
                if (navigator.share && navigator.canShare) {
                    const file = new File([blob], `sss10i-yield-${Date.now()}.png`, { type: 'image/png' });
                    const shareData = { files: [file] };
                    if (navigator.canShare(shareData)) {
                        try {
                            await navigator.share(shareData);
                            showToast('Shared successfully!', 'success');
                            return;
                        } catch (shareErr: unknown) {
                            // User cancelled or share failed — fall through to preview
                            if (shareErr instanceof Error && shareErr.name === 'AbortError') return;
                        }
                    }
                }

                // Fallback: show long-press image preview
                const url = URL.createObjectURL(blob);
                setSavePreviewUrl(url);
                return;
            }

            // ── DESKTOP: standard programmatic download ──
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `sss10i-yield-${Date.now()}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Screenshot failed:', e);
        }
    };

    const handleCopy = async () => {
        if (!pnlCardRef.current) return;
        try {
            const blob = await renderPnlToBlob();
            if (!blob) return;

            // On mobile, clipboard.write may not be supported — fall through to preview
            if (navigator.clipboard?.write) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                showToast('Copied to clipboard!', 'success');
            } else if (isMobile()) {
                const url = URL.createObjectURL(blob);
                setSavePreviewUrl(url);
                showToast('Long press the image to save', 'info');
            }
        } catch (e) {
            console.error('Copy failed:', e);
            // Fallback to preview on mobile if clipboard fails
            if (isMobile()) {
                try {
                    const blob = await renderPnlToBlob();
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        setSavePreviewUrl(url);
                        showToast('Long press the image to save', 'info');
                    }
                } catch { /* give up */ }
            }
        }
    };

    const deepFryFilter = deepFry
        ? 'contrast(2.4) saturate(5) brightness(1.4) hue-rotate(20deg) sepia(0.3)'
        : 'none';

    // ── RENDER ────────────────────────────────────────────────
    if (!wallet) {
        return (
            <div className="portfolio-container">
                <div className="portfolio-connect-guard">
                    <span className="guard-icon">🔒</span>
                    <h3>Wallet Required</h3>
                    <p>Connect your wallet to view your portfolio</p>
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-container">
            {/* ── TOTAL SUMMARY ────────────────────────────── */}
            <div className="portfolio-summary">
                <div className="summary-grid">
                    <div className="summary-item">
                        <div className="summary-label">Total Deposited</div>
                        <div className="summary-value">
                            {isLoading ? '...' : `$${totalDepositedUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        </div>
                    </div>
                    <div className="summary-item">
                        <div className="summary-label">Pending Yield</div>
                        <div className="summary-value yield-accent" style={{ color: '#4ade80' }}>
                            {isLoading ? '...' : `${totalPendingSss10i.toFixed(6)} SSS10i`}
                        </div>
                    </div>
                    <div className="summary-item">
                        <div className="summary-label">Yield USD</div>
                        <div className="summary-value fire-accent">
                            {isLoading ? '...' : `$${totalPendingUsd.toFixed(2)}`}
                        </div>
                    </div>
                </div>
                {userPositions.length > 0 && (
                    <button
                        className="summary-share-btn"
                        onClick={() => { setShowTotalShare(true); setHideDeposit(false); setSelectedBg(null); }}
                    >
                        📤 Share
                    </button>
                )}
            </div>

            {/* ── PER-POOL POSITIONS ───────────────────────── */}
            <div className="portfolio-section-title">■ Your Positions</div>
            <div className="portfolio-positions">
                {!isLoading && userPositions.length === 0 && (
                    <div className="portfolio-empty">
                        No active staking positions found. Deposit LP tokens on the Farms page to get started.
                    </div>
                )}
                {userPositions.map(({ config, pool }) => {
                    const canHarvest = !pool.earnedSss10i.startsWith('0.00000000');
                    const isHarvesting = harvestingPool === config.poolPubkey;
                    return (
                        <div key={config.id} className="position-card">
                            <div className="position-header">
                                <div className="position-pool-info">
                                    <div className="position-icons">
                                        <img src={config.tokenIcon} alt="" />
                                        <img src={config.baseIcon} alt="" />
                                    </div>
                                    <div>
                                        <div className="position-pool-name">{config.subtitle}</div>
                                        <div className="position-pool-title">{config.title}</div>
                                    </div>
                                </div>
                                <div className="position-header-actions">
                                    <button
                                        className="position-harvest-btn"
                                        disabled={!canHarvest || isHarvesting}
                                        onClick={() => handleHarvest(config.poolPubkey!)}
                                    >
                                        {isHarvesting ? '⏳' : '⛏'} Harvest
                                    </button>
                                    <button
                                        className="position-share-btn"
                                        onClick={() => { setSharePool({ config, pool }); setShowTotalShare(false); setHideDeposit(false); setSelectedBg(null); }}
                                    >
                                        📤 Share
                                    </button>
                                </div>
                            </div>
                            <div className="position-stats">
                                <div className="position-stat-item">
                                    <div className="position-stat-label">Deposited</div>
                                    <div className="position-stat-value">{pool.userStakedLpUsd}</div>
                                </div>
                                <div className="position-stat-item">
                                    <div className="position-stat-label">LP Staked</div>
                                    <div className="position-stat-value">{pool.userStakedLp.toFixed(4)}</div>
                                </div>
                                <div className="position-stat-item">
                                    <div className="position-stat-label">Pending Yield</div>
                                    <div className="position-stat-value yield-accent">{pool.earnedSss10i} SSS10i</div>
                                </div>
                                <div className="position-stat-item">
                                    <div className="position-stat-label">APR</div>
                                    <div className="position-stat-value">{pool.poolApr}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── CARDANO TRACKER ──────────────────────────── */}
            <div className="portfolio-section-title">■ $CARDANO Holdings</div>
            <div className="cardano-tracker">
                <div className="cardano-tracker-header">
                    <img src="/assets/tokens/CARDANO.png" alt="CARDANO" />
                    <h4>$CARDANO Balance Tracker</h4>
                </div>
                <div className="tracker-grid">
                    <div className="tracker-item">
                        <div className="tracker-label">Your Balance</div>
                        <div className="tracker-value">
                            {cardanoBalance === null ? '...' : cardanoBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                    <div className="tracker-item">
                        <div className="tracker-label">Circulating Supply</div>
                        <div className="tracker-value" style={{ color: '#e2e8f0' }}>
                            {cardanoCirculating === null ? '...' : cardanoCirculating.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                    <div className="tracker-item">
                        <div className="tracker-label">Total Burned</div>
                        <div className="tracker-value" style={{ color: '#f87171' }}>
                            {cardanoBurned === null ? '...' : cardanoBurned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                </div>
                <div className="supply-bar-container">
                    <div
                        className="supply-bar-fill"
                        style={{ width: `${Math.min(cardanoSupplyPct ?? 0, 100)}%` }}
                    />
                </div>
                <div className="supply-bar-label">
                    {cardanoSupplyPct !== null
                        ? `You own ${cardanoSupplyPct < 0.0001 ? '<0.0001' : cardanoSupplyPct.toFixed(4)}% of circulating supply (burn-adjusted)`
                        : 'Loading...'}
                </div>
            </div>

            {/* ── SHARE MODAL (per-pool OR total portfolio) ── */}
            {isShareModalOpen && (
                <div className="share-overlay" onClick={closeShareModal}>
                    <div className="share-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="share-close-btn" onClick={closeShareModal}>✕</button>

                        {/* PNL Card (screenshot target) */}
                        <div className="pnl-card" ref={pnlCardRef}>
                            {/* Background image layer — filter applied here */}
                            {selectedBg && (
                                <div
                                    className="pnl-bg-image"
                                    style={{
                                        backgroundImage: `url(/assets/share-bg/${selectedBg}.png)`,
                                        filter: deepFryFilter,
                                    }}
                                />
                            )}
                            {/* Dark overlay hardcoded to 'deep' for readability */}
                            {selectedBg && (
                                <div className="pnl-bg-overlay" style={{ opacity: 0.7 }} />
                            )}
                            <div className="pnl-content">
                                <div className="pnl-header">
                                    <div className="pnl-brand">
                                        <span className="pnl-brand-icon">🍼</span>
                                        <span className="pnl-brand-text">SSS10i DeFi</span>
                                    </div>
                                    {showTotalShare ? (
                                        <div className="pnl-total-badge">📊 Total Portfolio</div>
                                    ) : sharePool && (
                                        <div className="pnl-pool-badge">
                                            <div className="pnl-pool-icons">
                                                <img src={sharePool.config.tokenIcon} alt="" />
                                                <img src={sharePool.config.baseIcon} alt="" />
                                            </div>
                                            <span className="pnl-pool-name">{sharePool.config.subtitle}</span>
                                        </div>
                                    )}
                                </div>

                                {showTotalShare ? (
                                    /* ── TOTAL PORTFOLIO CARD BODY ── */
                                    <>
                                        <div className="pnl-yield-section">
                                            <div className="pnl-yield-label">Total Pending Yield</div>
                                            <div className="pnl-yield-amount">
                                                {totalPendingSss10i.toFixed(6)} SSS10i
                                            </div>
                                            <div className="pnl-yield-usd">
                                                ≈ ${totalPendingUsd.toFixed(2)} USD
                                            </div>
                                        </div>

                                        <div className="pnl-stats-grid">
                                            <div className="pnl-stat-item">
                                                <div className="pnl-stat-label">Total Deposited</div>
                                                {hideDeposit ? (
                                                    <div className="pnl-deposit-hidden">••••••</div>
                                                ) : (
                                                    <div className="pnl-stat-value">${totalDepositedUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                                )}
                                            </div>
                                            <div className="pnl-stat-item">
                                                <div className="pnl-stat-label">Avg APR</div>
                                                <div className="pnl-stat-value pnl-stat-apr">{avgAprFormatted}</div>
                                            </div>
                                            <div className="pnl-stat-item">
                                                <div className="pnl-stat-label">Active Pools</div>
                                                <div className="pnl-stat-value">{userPositions.length}</div>
                                            </div>
                                            <div className="pnl-stat-item">
                                                <div className="pnl-stat-label">Yield Value</div>
                                                <div className="pnl-stat-value pnl-stat-yield">${totalPendingUsd.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    </>
                                ) : sharePool && (
                                    /* ── PER-POOL CARD BODY (unchanged) ── */
                                    <>
                                        <div className="pnl-yield-section">
                                            <div className="pnl-yield-label">Pending Yield</div>
                                            <div className="pnl-yield-amount">
                                                {sharePool.pool.earnedSss10i} SSS10i
                                            </div>
                                            <div className="pnl-yield-usd">
                                                ≈ ${(parseFloat(sharePool.pool.earnedSss10i) * sss10iPrice).toFixed(2)} USD
                                            </div>
                                        </div>

                                        <div className="pnl-deposit-section">
                                            <span className="pnl-deposit-label">Deposited</span>
                                            {hideDeposit ? (
                                                <span className="pnl-deposit-hidden">••••••</span>
                                            ) : (
                                                <span className="pnl-deposit-value">{sharePool.pool.userStakedLpUsd}</span>
                                            )}
                                        </div>
                                    </>
                                )}

                                <div className="pnl-footer">
                                    <span className="pnl-watermark">Defi.SSS10i.com</span>
                                    <span className="pnl-date">{new Date().toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Background Picker */}
                        <div className="bg-picker">
                            <div className="bg-picker-label">Background</div>
                            <div className="bg-picker-grid">
                                <button
                                    className={`bg-thumb ${selectedBg === null ? 'bg-thumb-active' : ''}`}
                                    onClick={() => setSelectedBg(null)}
                                    title="No background"
                                >
                                    ✕
                                </button>
                                {Array.from({ length: BG_COUNT }, (_, i) => i + 1).map(num => (
                                    <button
                                        key={num}
                                        className={`bg-thumb ${selectedBg === num ? 'bg-thumb-active' : ''}`}
                                        onClick={() => setSelectedBg(num)}
                                        title={`Background ${num}`}
                                    >
                                        <img src={`/assets/share-bg/${num}.png`} alt={`BG ${num}`} />
                                    </button>
                                ))}
                            </div>
                            {/* No tone slider — overlay is hardcoded to 'deep' */}
                            {selectedBg && (
                                <label className="deepfry-toggle">
                                    <input
                                        type="checkbox"
                                        checked={deepFry}
                                        onChange={(e) => setDeepFry(e.target.checked)}
                                    />
                                    <span>🍳 Deep Fry</span>
                                </label>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="share-actions">
                            <button className="share-action-btn" onClick={handleDownload}>
                                📥 Download
                            </button>
                            <button className="share-action-btn" onClick={handleCopy}>
                                📋 Copy
                            </button>
                            <button className="share-toggle-btn" onClick={() => setHideDeposit(!hideDeposit)}>
                                {hideDeposit ? '👁 Show' : '🙈 Hide'} Deposit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── LONG-PRESS SAVE PREVIEW (mobile fallback) ── */}
            {savePreviewUrl && (
                <div
                    className="save-preview-overlay"
                    onClick={() => { URL.revokeObjectURL(savePreviewUrl!); setSavePreviewUrl(null); }}
                >
                    <div className="save-preview-modal" onClick={e => e.stopPropagation()}>
                        <button
                            className="share-close-btn"
                            onClick={() => { URL.revokeObjectURL(savePreviewUrl); setSavePreviewUrl(null); }}
                        >
                            ✕
                        </button>
                        <img
                            src={savePreviewUrl}
                            alt="Your PNL Card"
                            className="save-preview-image"
                        />
                        <div className="save-preview-hint">
                            📲 Long press the image to save or share
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioPage;
