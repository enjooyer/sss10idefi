import React, { useState, useEffect, useCallback } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { useAnchorProgram } from '../hooks/useAnchorProgram';
import { CARDANO_MINT, SSS10i_MINT, RPC_URL, NFT_MINT } from '../utils/constants';
import { useToast } from './ToastProvider';
import './WrapTerminal.css';

const HELIUS_RPC = RPC_URL; // same Helius key

const WrapTerminal: React.FC = () => {
    const [wrapMode, setWrapMode] = useState<'wrap' | 'unwrap'>('wrap');
    const [isProcessing, setIsProcessing] = useState(false);

    // Live balance states
    const [userSss10iBalance, setUserSss10iBalance] = useState<string>('—');
    const [userCardanoBalance, setUserCardanoBalance] = useState<number>(0);
    const [userNftCount, setUserNftCount] = useState<number | null>(null);
    const [treasuryNftCount, setTreasuryNftCount] = useState<number | null>(null);
    const [treasurySss10iBalance, setTreasurySss10iBalance] = useState<string>('—');
    const [collectionMintPk, setCollectionMintPk] = useState<PublicKey | null>(null);
    const [resolvedCardanoAta, setResolvedCardanoAta] = useState<PublicKey | null>(null);

    const BURN_AMOUNT_UI = 50_000; // 50,000 CARDANO required to wrap/unwrap

    const { showToast } = useToast();
    const program = useAnchorProgram();
    const wallet = useAnchorWallet();
    const { connection } = useConnection();

    // Derive GLOBAL NFT treasury PDA (independent from pools)
    const getNftTreasuryPda = useCallback((): PublicKey | null => {
        if (!program) return null;
        const [pda] = PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("nft_treasury")],
            program.programId
        );
        return pda;
    }, [program]);

    // Count NFTs owned by an address belonging to a collection via Helius DAS
    const countNftsInCollection = useCallback(async (owner: PublicKey, collection: PublicKey): Promise<number> => {
        try {
            const response = await fetch(HELIUS_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'count-nfts',
                    method: 'searchAssets',
                    params: {
                        ownerAddress: owner.toBase58(),
                        grouping: ["collection", collection.toBase58()],
                        page: 1,
                        limit: 100
                    },
                }),
            });
            const data = await response.json();
            return data?.result?.total ?? data?.result?.items?.length ?? 0;
        } catch (e) {
            console.error('Error counting NFTs:', e);
            return 0;
        }
    }, []);

    // Refresh all balances
    const refreshBalances = useCallback(async () => {
        if (!wallet || !program) return;

        const nftTreasuryPda = getNftTreasuryPda();
        if (!nftTreasuryPda) return;

        // Fetch collection mint from GLOBAL state (not pool)
        let collectionMint: PublicKey | null = collectionMintPk;
        if (!collectionMint) {
            try {
                const globalProxy = (program as any).account.globalState || (program as any).account.GlobalState;
                const [globalPda] = PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("global")],
                    program.programId
                );
                const globalAccount = await globalProxy.fetch(globalPda);
                collectionMint = globalAccount.nftCollectionMint as PublicKey;
                setCollectionMintPk(collectionMint);
            } catch {
                collectionMint = null;
            }
        }

        // 1. User SSS10i balance
        try {
            const userFracAta = getAssociatedTokenAddressSync(SSS10i_MINT, wallet.publicKey);
            const bal = await connection.getTokenAccountBalance(userFracAta);
            setUserSss10iBalance(bal.value.uiAmountString ?? '0');
        } catch (err: any) {
            console.error('[WrapTerminal] SSS10i balance error:', err?.message || err);
            setUserSss10iBalance('0');
        }

        // 1b. User CARDANO balance — probe Token-2022 then legacy
        let foundCardanoAta: PublicKey | null = null;
        for (const tokenProg of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
            try {
                const ata = getAssociatedTokenAddressSync(CARDANO_MINT, wallet.publicKey, false, tokenProg);
                const bal = await connection.getTokenAccountBalance(ata);
                setUserCardanoBalance(Number(bal.value.uiAmount ?? 0));
                foundCardanoAta = ata;
                break;
            } catch { /* try next */ }
        }
        if (!foundCardanoAta) setUserCardanoBalance(0);
        setResolvedCardanoAta(foundCardanoAta);

        // 2. Treasury SSS10i balance (global NFT treasury)
        try {
            const treasuryFracAta = getAssociatedTokenAddressSync(SSS10i_MINT, nftTreasuryPda, true);
            const bal = await connection.getTokenAccountBalance(treasuryFracAta);
            setTreasurySss10iBalance(bal.value.uiAmountString ?? '0');
        } catch {
            setTreasurySss10iBalance('0');
        }

        if (collectionMint) {
            // 3. User NFT count
            const userCount = await countNftsInCollection(wallet.publicKey, collectionMint);
            setUserNftCount(userCount);

            // 4. Treasury NFT count (global NFT treasury)
            const treasuryCount = await countNftsInCollection(nftTreasuryPda, collectionMint);
            setTreasuryNftCount(treasuryCount);
        }
    }, [wallet, program, connection, getNftTreasuryPda, countNftsInCollection, collectionMintPk]);

    useEffect(() => {
        refreshBalances();
    }, [refreshBalances]);

    const handleAction = async () => {
        if (!program || !wallet) {
            showToast("Wallet not connected.", "error");
            return;
        }

        setIsProcessing(true);
        showToast(`Searching ${wrapMode === 'wrap' ? 'Treasury' : 'Wallet'} for eligible NFT...`, 'info');

        try {
            const userPubkey = wallet.publicKey;

            let userCardanoAta = resolvedCardanoAta;
            if (!userCardanoAta) {
                // Failsafe probe
                for (const prog of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
                    const candidate = getAssociatedTokenAddressSync(CARDANO_MINT, userPubkey, false, prog);
                    try {
                        const info = await connection.getAccountInfo(candidate);
                        if (info !== null) { userCardanoAta = candidate; break; }
                    } catch { /* ignore */ }
                }
            }
            if (!userCardanoAta) {
                showToast("No CARDANO token account found in your wallet.", "error");
                setIsProcessing(false);
                return;
            }
            const userFractionsAta = getAssociatedTokenAddressSync(SSS10i_MINT, userPubkey);

            // Ensure program ID exists
            if (!program.programId) {
                showToast("Program not initialized", "error");
                setIsProcessing(false);
                return;
            }

            // Global NFT treasury PDA (independent from pools)
            const [nftTreasuryPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("nft_treasury")],
                program.programId
            );

            // Global PDA for fetching collection mint
            const [globalPda] = PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );



            // Fetch global state for collection mint and sss10i mint
            const globalStateProxy = (program as any).account.globalState || (program as any).account.GlobalState;
            const globalAccount = await globalStateProxy.fetch(globalPda);
            const collectionMint: PublicKey = globalAccount.nftCollectionMint || NFT_MINT;

            // Helius DAS: find eligible NFT (with random selection for wrap mode)
            const fetchAvailableNft = async (owner: PublicKey, collection: PublicKey, randomize: boolean = false): Promise<PublicKey | null> => {
                try {
                    const response = await fetch(HELIUS_RPC, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 'wrap-search',
                            method: 'searchAssets',
                            params: {
                                ownerAddress: owner.toBase58(),
                                grouping: ["collection", collection.toBase58()],
                                page: 1,
                                limit: randomize ? 100 : 1  // Fetch more for random selection
                            },
                        }),
                    });
                    const data = await response.json();
                    if (data?.result?.items?.length > 0) {
                        if (randomize && data.result.items.length > 1) {
                            // Randomly select from available NFTs
                            const randomIndex = Math.floor(Math.random() * data.result.items.length);
                            console.log(`Random NFT selection: ${randomIndex + 1} of ${data.result.items.length}`);
                            return new PublicKey(data.result.items[randomIndex].id);
                        }
                        return new PublicKey(data.result.items[0].id);
                    }
                    return null;
                } catch (e) {
                    console.error("Helius DAS Error:", e);
                    return null;
                }
            };

            const targetOwner = wrapMode === 'wrap' ? nftTreasuryPda : userPubkey;
            // Randomize selection only for wrap mode (treasury -> user)
            const shouldRandomize = wrapMode === 'wrap';
            const fetchedNftMint = await fetchAvailableNft(targetOwner, collectionMint, shouldRandomize);

            if (!fetchedNftMint) {
                console.warn("Helius DAS returned 0 results — falling back to collectionMint as NFT mint.");
            }

            const activeNftMint = fetchedNftMint || collectionMint;


            const nftTreasuryFractionsAta = getAssociatedTokenAddressSync(SSS10i_MINT, nftTreasuryPda, true);
            const nftTreasuryNftAta = getAssociatedTokenAddressSync(activeNftMint, nftTreasuryPda, true);
            const userNftAta = getAssociatedTokenAddressSync(activeNftMint, userPubkey);

            let txHash: string;
            const commonAccounts = {
                user: userPubkey,
                global: globalPda,
                cardanoMint: CARDANO_MINT,
                userCardanoAta,
                sss10iMint: SSS10i_MINT,
                nftTreasury: nftTreasuryPda,
                userFractionsAta,
                nftTreasuryFractionsAta,
                nftMint: activeNftMint,
                userNftAta,
                nftTreasuryNftAta,
                tokenProgram: TOKEN_PROGRAM_ID,
                token2022Program: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
            };

            if (wrapMode === 'wrap') {
                showToast('Building extraction transaction...', 'info');
                txHash = await program.methods.wrapToNft()
                    .accounts(commonAccounts as any)
                    .rpc();
            } else {
                showToast('Building shatter transaction...', 'info');
                txHash = await program.methods.unwrapToFractions()
                    .accounts(commonAccounts as any)
                    .rpc();
            }

            showToast(`✅ Success! TX: ${txHash.slice(0, 8)}...`, 'success');
            console.log("TX:", txHash);

            // Refresh balances after success
            await refreshBalances();
        } catch (err: any) {
            console.error("Wrap/Unwrap Error:", err);
            showToast(`Transaction Failed: ${err.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const canWrap = Number(userSss10iBalance) >= 1 && userCardanoBalance >= BURN_AMOUNT_UI;
    const canUnwrap = (userNftCount ?? 0) > 0 && userCardanoBalance >= BURN_AMOUNT_UI;

    const getButtonLabel = () => {
        if (isProcessing) return 'INITIALIZING SEQUENCE...';
        if (userCardanoBalance < BURN_AMOUNT_UI) return `NEED ${BURN_AMOUNT_UI.toLocaleString()} CARDANO`;
        if (wrapMode === 'wrap') {
            if (Number(userSss10iBalance) < 1) return 'INSUFFICIENT SSS10i';
            return 'INITIATE EXTRACTION';
        } else {
            if ((userNftCount ?? 0) === 0) return 'NO NFT IN WALLET';
            return 'SHATTER ARTIFACT';
        }
    };


    return (
        <div className="wrap-terminal">
            <div className="terminal-header">
                <h2>ARTIFACT <span className="ice-accent">FORGE</span></h2>
                <p>Convert your liquid SSS10i tokens into Non-Fungible Artifacts.</p>
                <p className="forge-disclaimer">Note: High-Heat Extraction is a volatile process. The Artifact you receive is randomly extracted from the Treasury.</p>
            </div>

            <div className="terminal-body">
                <div className="mode-toggle">
                    <button
                        className={wrapMode === 'wrap' ? 'active' : ''}
                        onClick={() => setWrapMode('wrap')}
                    >
                        EXTRACT (WRAP)
                    </button>
                    <button
                        className={wrapMode === 'unwrap' ? 'active' : ''}
                        onClick={() => setWrapMode('unwrap')}
                    >
                        SHATTER (UNWRAP)
                    </button>
                </div>

                <div className="exchange-interface">
                    {wrapMode === 'wrap' ? (
                        <>
                            <div className="asset-box">
                                <span className="asset-label">INPUT</span>
                                <div className="asset-value">
                                    <img src="/logos/sss10i.jpg" alt="SSS10i" className="token-logo" />
                                    <span className="amount">1.0</span>
                                    <span className="symbol">SSS10i</span>
                                </div>
                                <span className="balance" style={{ color: canWrap ? '#4ade80' : '#f87171' }}>
                                    Balance: {userSss10iBalance} SSS10i
                                    {!canWrap && userSss10iBalance !== null && Number(userSss10iBalance) < 1 && ' ⚠ Insufficient'}
                                    {!canWrap && userCardanoBalance !== null && userCardanoBalance < BURN_AMOUNT_UI && ` ⚠ Need ${BURN_AMOUNT_UI.toLocaleString()} CARDANO`}
                                </span>
                            </div>

                            <div className="flow-indicator">
                                <div className="arrow-down"></div>
                            </div>

                            <div className="asset-box destination">
                                <span className="asset-label">OUTPUT</span>
                                <div className="asset-value">
                                    <img src="/logos/wsss10i.jpg" alt="wSSS10i" className="artifact-logo" />
                                    <span className="amount">1</span>
                                    <span className="symbol">wSSS10i</span>
                                </div>
                                <span className="balance">
                                    Treasury: {treasuryNftCount === null ? '...' : `${treasuryNftCount} NFT${treasuryNftCount !== 1 ? 's' : ''} available`}
                                </span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="asset-box">
                                <span className="asset-label">INPUT</span>
                                <div className="asset-value">
                                    <img src="/logos/wsss10i.jpg" alt="wSSS10i" className="artifact-logo" />
                                    <span className="amount">1</span>
                                    <span className="symbol">wSSS10i NFT</span>
                                </div>
                                <span className="balance" style={{ color: canUnwrap ? '#4ade80' : '#f87171' }}>
                                    Owned: {userNftCount === null ? '...' : `${userNftCount} NFT${userNftCount !== 1 ? 's' : ''}`}
                                    {userNftCount === 0 && ' ⚠ None in wallet'}
                                </span>
                            </div>

                            <div className="flow-indicator">
                                <div className="arrow-down"></div>
                            </div>

                            <div className="asset-box destination">
                                <span className="asset-label">OUTPUT</span>
                                <div className="asset-value">
                                    <img src="/logos/sss10i.jpg" alt="SSS10i" className="token-logo" />
                                    <span className="amount">1.0</span>
                                    <span className="symbol">SSS10i</span>
                                </div>
                                <span className="balance">
                                    Treasury SSS10i: {treasurySss10iBalance}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                <div className="action-area">
                    <button
                        className={`forge-btn ${isProcessing ? 'processing' : ''}`}
                        onClick={handleAction}
                        disabled={isProcessing || (wrapMode === 'wrap' ? !canWrap : !canUnwrap)}
                    >
                        {getButtonLabel()}
                    </button>
                    <div className="fee-notice-area">
                        <p className="fee-notice network">NETWORK FEE: ~0.00001 SOL</p>
                        <p className="fee-notice burn-fee">
                            <span className="fire-icon">🔥</span> ARTIFACT FORGE FEE: <strong>50,000 $CARDANO</strong> (BURNED)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WrapTerminal;
