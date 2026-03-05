import React, { useState } from 'react';
import ZapModal from './ZapModal';
import { useToast } from './ToastProvider';
import { useAnchorProgram } from '../hooks/useAnchorProgram';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import { SSS10i_MINT } from '../utils/constants';
import { useGlobalPools } from '../contexts/GlobalPoolContext';
import './PoolCard.css';

interface PoolCardProps {
    title: string;
    subtitle: string;
    staked: string;
    tokenIcon: string;
    baseIcon: string;
    isHot?: boolean;
    totalStakedUsd: string;
    endsInDays: number;
    lpMintId: string;
    poolPubkey?: string; // Add the on-chain Pool PDA or Keypair address
    isTrinity?: boolean;
    isOffline?: boolean;
    raydiumPoolId?: string;
    poolMintA?: string;
    poolMintB?: string;
}

const PoolCard: React.FC<PoolCardProps> = ({
    title, subtitle, staked, tokenIcon, baseIcon, isHot,
    totalStakedUsd, endsInDays, lpMintId, poolPubkey, isTrinity, isOffline,
    raydiumPoolId, poolMintA, poolMintB
}) => {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isZapOpen, setIsZapOpen] = useState(false);
    const [showWithdrawLink, setShowWithdrawLink] = useState(false);
    
    const { showToast } = useToast();
    const program = useAnchorProgram();
    const wallet = useAnchorWallet();
    const { pools, refreshData } = useGlobalPools();

    // Pull values map exclusively from the GlobalPoolContext
    const poolData = poolPubkey ? pools[poolPubkey] : null;

    const liveStaked = poolData ? poolData.stakedLpAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : staked;
    const liveStakedUsd = poolData ? poolData.stakedLpUsd : totalStakedUsd;
    const liveUserVelocity = poolData ? poolData.userVelocity : "0.00 SSS10i / Day";
    const liveEarned = poolData ? poolData.earnedSss10i : "0.00000000";
    
    const userStaked = poolData ? poolData.userStakedLp.toFixed(8) : "0.00";
    const userStakedUsd = poolData ? poolData.userStakedLpUsd : "$0.00";
    const userStakedRaw = poolData ? poolData.userStakedLpRaw : null;
    const userLpBalance = poolData ? poolData.userLpBalance : 0;
    const lpDecimals = poolData ? poolData.lpDecimals : 6;
    const liveApr = poolData ? poolData.poolApr : "0.00%";


    const handleStake = async () => {
        if (isOffline) return;
        if (!program || !wallet || !poolPubkey) {
            showToast("Wallet not connected or Pool Offline", "error");
            return;
        }

        if (userLpBalance <= 0) {
            showToast("You have 0 LP tokens to stake. Add liquidity on Raydium first!", "error");
            return;
        }

        try {
            showToast(`Sign to stake LP into ${subtitle}...`, 'info');
            const pubkey = new PublicKey(poolPubkey);
            const lpMintPubkey = new PublicKey(lpMintId);

            const [globalPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );

            const [vaultLpAccount] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("vault"), pubkey.toBuffer()],
                program.programId
            );

            const [userInfoPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("user"), pubkey.toBuffer(), wallet.publicKey.toBuffer()],
                program.programId
            );

            const userLpAccount = getAssociatedTokenAddressSync(lpMintPubkey, wallet.publicKey);

            // Use actual LP balance with dynamic decimals
            const amountRaw = Math.floor(userLpBalance * (10 ** lpDecimals));
            if (amountRaw <= 0) {
                showToast("Cannot stake 0 tokens. Your LP balance is too small.", "error");
                return;
            }
            const amount = new anchor.BN(amountRaw);

            const txBuilder = program.methods.depositLp(amount)
                .accounts({
                    global: globalPda,
                    pool: pubkey,
                    userInfo: userInfoPda,
                    userLpAccount: userLpAccount,
                    acceptedLpMint: lpMintPubkey,
                    vaultLpAccount: vaultLpAccount,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                } as any);

            // SIMULATION CHECK
            const tx = await txBuilder.transaction();
            tx.feePayer = wallet.publicKey;
            tx.recentBlockhash = (await program.provider.connection.getLatestBlockhash()).blockhash;

            const sim = await program.provider.connection.simulateTransaction(tx);
            if (sim.value.err) {
                console.error("STAKE SIMULATION FAILED:", sim.value.err, sim.value.logs);
                showToast(`STAKE SIM FAILED: ${JSON.stringify(sim.value.err)}`, "error");
                return;
            }

            await txBuilder.rpc();
            showToast(`Success: Staked 1.0 LP into ${subtitle}!`, 'success');
            
            // Immediately refresh the global pool store
            await refreshData();
        } catch (err: any) {
            console.error("Stake Error:", err);
            showToast(`Stake Failed: ${err.message}`, "error");
        }
    }

    const handleHarvest = async () => {
        if (!program || !wallet || !poolPubkey) {
            showToast("Wallet not connected.", "error");
            return;
        }

        try {
            showToast("Extracting Fractions yield...", "info");
            const pubkey = new PublicKey(poolPubkey);

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

            // Create user's SSS10i ATA if it doesn't exist (fixes Phantom mobile error 3012)
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
            
            // Immediately refresh the global pool store
            await refreshData();
        } catch (err: any) {
            console.error("Harvest Error:", err);
            showToast(`Harvest Failed: ${err.message}`, "error");
        }
    }

    const handleWithdraw = async () => {
        if (!program || !wallet || !poolPubkey) {
            showToast("Wallet not connected.", "error");
            return;
        }

        try {
            showToast("Withdrawing LP...", "info");
            const pubkey = new PublicKey(poolPubkey);
            const lpMintPubkey = new PublicKey(lpMintId);

            const [globalPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );

            const [vaultLpAccount] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("vault"), pubkey.toBuffer()],
                program.programId
            );

            const [userInfoPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("user"), pubkey.toBuffer(), wallet.publicKey.toBuffer()],
                program.programId
            );

            const userLpAccount = getAssociatedTokenAddressSync(lpMintPubkey, wallet.publicKey);

            // Use exact raw amount from on-chain to avoid InsufficientStake rounding errors
            if (!userStakedRaw || userStakedRaw.isZero()) {
                showToast("Cannot withdraw 0 tokens. Your staked balance is zero.", "error");
                return;
            }
            const amount = userStakedRaw;

            await program.methods.withdrawLp(amount)
                .accounts({
                    global: globalPda,
                    pool: pubkey,
                    userInfo: userInfoPda,
                    userLpAccount: userLpAccount,
                    acceptedLpMint: lpMintPubkey,
                    vaultLpAccount: vaultLpAccount,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                })
                .rpc();

            showToast(`Success: Withdrawn from ${subtitle}!`, 'success');
            
            // Show Raydium link in UI
            if (raydiumPoolId) {
                setShowWithdrawLink(true);
            }
            
            // Immediately refresh the global pool store
            await refreshData();
        } catch (err: any) {
            console.error("Withdraw Error:", err);
            showToast(`Withdraw Failed: ${err.message}`, "error");
        }
    };

    return (
        <div className={`pool-card-container ${isHot ? 'hot-pool' : ''} ${isTrinity ? 'trinity-pool' : ''}`}>
            {isHot && <div className="hot-badge">🔥 HOT</div>}
            {isTrinity && <div className="trinity-badge">💠 TRINITY POOL</div>}

            <div className="pool-card-header">
                <div className="pool-card-title">
                    <h3>{title}</h3>
                    <p>{subtitle}</p>
                </div>
                <div className="pool-card-icons">
                    <span className="icon-base">
                        {baseIcon.startsWith('/assets') ? (
                            <img src={baseIcon} alt="Base" className="icon-img" />
                        ) : (
                            baseIcon
                        )}
                    </span>
                    <span className="icon-token">
                        {tokenIcon.startsWith('/assets') ? (
                            <img src={tokenIcon} alt="Token" className="icon-img" />
                        ) : (
                            tokenIcon
                        )}
                    </span>
                </div>
            </div>

            <div className="pool-card-body">
                {wallet && (
                    <div className="pool-stat">
                        <span className="stat-label">REWARD VELOCITY:</span>
                        <span className={`stat-value velocity-value ${isOffline ? 'offline-text' : ''}`}>
                            {isOffline ? 'OFFLINE' : liveUserVelocity}
                        </span>
                    </div>
                )}

                <div className="pool-stat" style={{ marginTop: '0.5rem' }}>
                    <span className="stat-label">LIVE APR:</span>
                    <span className={`stat-value velocity-value highlight-gold ${isOffline ? 'offline-text' : ''}`}>
                        {isOffline ? 'OFFLINE' : liveApr}
                    </span>
                </div>

                <div className="earn-section">
                    <p className="earn-label">SSS10i EARNED</p>
                    <div className="earn-display">
                        <h4 className={liveEarned.startsWith('0.00000000') ? 'empty-value' : 'filled-value'}>{liveEarned}</h4>
                        <button className="harvest-btn" disabled={liveEarned.startsWith('0.00000000')} onClick={handleHarvest}>Harvest</button>
                    </div>
                </div>

                <div className="stake-section">
                    <div className="stake-header-row">
                        <p className="stake-label">{subtitle} STAKED</p>
                        <span className="user-usd-value" title={`${userStaked} LP tokens`}>{userStakedUsd}</span>
                    </div>
                    <div className="btn-row">
                        <button 
                            className="enable-btn" 
                            onClick={handleStake}
                            disabled={!wallet || userLpBalance <= 0 || isOffline}
                            style={(!wallet || userLpBalance <= 0 || isOffline) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        >
                            {isOffline ? 'OFFLINE' : (!wallet ? 'CONNECT' : (userLpBalance > 0 ? 'STAKE LP' : 'INSUFFICIENT LP TOKENS'))}
                        </button>
                        {raydiumPoolId && (
                            <a
                                href={`https://raydium.io/liquidity/increase/?mode=add&pool_id=${raydiumPoolId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="addlp-btn"
                            >
                                ADD LP ↗
                            </a>
                        )}
                        <button 
                            className="withdraw-btn" 
                            onClick={handleWithdraw}
                            disabled={isOffline}
                        >WITHDRAW</button>
                    </div>
                    {showWithdrawLink && raydiumPoolId && (
                        <div className="withdraw-link-container">
                            <a 
                                href={`https://raydium.io/liquidity/decrease/?mode=remove&pool_id=${raydiumPoolId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="raydium-remove-link"
                            >
                                Remove Liquidity on Raydium ↗
                            </a>
                        </div>
                    )}
                    <button 
                        className="zap-btn" 
                        onClick={() => !isOffline && setIsZapOpen(true)}
                        disabled={isOffline}
                        style={isOffline ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >⚡ DIRECT ZAP DEPOSIT</button>
                </div>
            </div>

            <div className="pool-card-footer">
                <button
                    className="details-toggle"
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                >
                    {isDetailsOpen ? 'Hide' : 'Details'}
                    <span className="arrow">{isDetailsOpen ? '↑' : '↓'}</span>
                </button>

                {isDetailsOpen && (
                    <div className="details-content">
                        <div className="detail-row">
                            <span className="detail-label">Total Value Locked:</span>
                            <span className="detail-value highlight-gold" title={`${liveStaked} LP total`}>{poolPubkey ? liveStakedUsd : totalStakedUsd}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Ends in:</span>
                            <span className="detail-value">{endsInDays} days</span>
                        </div>
                    </div>
                )}
            </div>

            <ZapModal
                isOpen={isZapOpen}
                onClose={() => setIsZapOpen(false)}
                poolSubtitle={subtitle}
                lpMintId={lpMintId}
                poolPubkey={poolPubkey}
                raydiumPoolId={raydiumPoolId}
                poolMintA={poolMintA}
                poolMintB={poolMintB}
            />
        </div>
    );
};

export default PoolCard;
