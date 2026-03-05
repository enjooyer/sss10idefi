import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { executeZapSwaps, getLpTokenBalance } from '../utils/zapUtils';
import type { ZapStep } from '../utils/zapUtils';
import { useAnchorProgram } from '../hooks/useAnchorProgram';
import { useToast } from './ToastProvider';
import { SOL_MINT, USDC_MINT, SSS10i_MINT } from '../utils/constants';
import './ZapModal.css';

interface ZapModalProps {
    isOpen: boolean;
    onClose: () => void;
    poolSubtitle: string;
    lpMintId: string;
    poolPubkey?: string;
    poolMintA?: string;
    poolMintB?: string;
    raydiumPoolId?: string;
}

const SOL_RESERVE_FOR_GAS = 0.01; // Reserve 0.01 SOL for transaction fees

const ZapModal: React.FC<ZapModalProps> = ({ 
    isOpen, 
    onClose, 
    poolSubtitle, 
    lpMintId, 
    poolPubkey,
    poolMintA,
    poolMintB,
    raydiumPoolId 
}) => {
    const [amount, setAmount] = useState<string>('');
    const [inputToken, setInputToken] = useState<'SOL' | 'USDC' | 'SSS10I'>('SOL');
    const [zapSteps, setZapSteps] = useState<ZapStep[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [zapComplete, setZapComplete] = useState(false);
    const [solBalance, setSolBalance] = useState<number>(0);
    const [usdcBalance, setUsdcBalance] = useState<number>(0);
    const [sss10iBalance, setSss10iBalance] = useState<number>(0);

    const { showToast } = useToast();
    const program = useAnchorProgram();
    const wallet = useAnchorWallet();
    const { connection } = useConnection();

    // Fetch SOL and USDC balances when modal opens
    useEffect(() => {
        const fetchBalances = async () => {
            if (!wallet || !connection) return;
            
            try {
                // Fetch SOL balance
                const solBal = await connection.getBalance(wallet.publicKey);
                setSolBalance(solBal / 1e9);
                
                // Fetch USDC balance
                try {
                    const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, wallet.publicKey);
                    const usdcBal = await connection.getTokenAccountBalance(usdcAta);
                    setUsdcBalance(Number(usdcBal.value.uiAmount ?? 0));
                } catch {
                    setUsdcBalance(0);
                }
                
                // Fetch SSS10I balance
                try {
                    const sss10iAta = getAssociatedTokenAddressSync(SSS10i_MINT, wallet.publicKey);
                    const sss10iBal = await connection.getTokenAccountBalance(sss10iAta);
                    setSss10iBalance(Number(sss10iBal.value.uiAmount ?? 0));
                } catch {
                    setSss10iBalance(0);
                }
            } catch (e) {
                console.error('Error fetching balances:', e);
            }
        };
        
        if (isOpen) {
            fetchBalances();
        }
    }, [isOpen, wallet, connection]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const getInputMint = (): PublicKey => {
        if (inputToken === 'SOL') return SOL_MINT;
        if (inputToken === 'USDC') return USDC_MINT;
        return SSS10i_MINT;
    };

    const getInputDecimals = (): number => {
        if (inputToken === 'SOL') return 9;
        if (inputToken === 'USDC') return 6;
        return 9; // SSS10I has 9 decimals
    };

    const handleExecuteZap = async () => {
        if (!wallet || !program || !poolPubkey) {
            showToast("Wallet not connected or pool not configured.", "error");
            return;
        }

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            showToast("Enter a valid amount.", "error");
            return;
        }

        if (!poolMintA || !poolMintB || !raydiumPoolId) {
            showToast("Pool configuration incomplete. Contact admin.", "error");
            return;
        }

        setIsExecuting(true);
        setZapComplete(false);
        setZapSteps([]);
        showToast("Starting Zap: Swapping tokens via Jupiter...", "info");

        try {
            const inputMint = getInputMint();
            const inputDecimals = getInputDecimals();
            const mintA = new PublicKey(poolMintA);
            const mintB = new PublicKey(poolMintB);

            // Execute swaps to get both pool tokens
            const result = await executeZapSwaps(
                connection,
                wallet,
                inputMint,
                Number(amount),
                inputDecimals,
                raydiumPoolId,
                mintA,
                mintB,
                9, // Assuming 9 decimals for token A (adjust if needed)
                6, // Assuming 6 decimals for token B (adjust if needed)
                (steps) => setZapSteps(steps)
            );

            if (!result.success) {
                showToast(`Zap failed: ${result.error}`, "error");
                setIsExecuting(false);
                return;
            }

            showToast("✅ Swaps complete! Now add liquidity on Raydium...", "success");
            setZapComplete(true);
            
        } catch (error: any) {
            console.error('Zap error:', error);
            showToast(`Zap failed: ${error.message}`, "error");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleDepositLp = async () => {
        if (!wallet || !program || !poolPubkey) {
            showToast("Wallet not connected.", "error");
            return;
        }

        setIsExecuting(true);
        showToast("Depositing LP tokens into staking pool...", "info");

        try {
            const pubkey = new PublicKey(poolPubkey);
            const lpMintPubkey = new PublicKey(lpMintId);

            // Get current LP balance
            const currentLpBalance = await getLpTokenBalance(connection, wallet.publicKey, lpMintPubkey);
            if (currentLpBalance === 0) {
                showToast("No LP tokens found. Add liquidity on Raydium first.", "error");
                setIsExecuting(false);
                return;
            }

            // Fetch actual LP token decimals
            let lpDecimals = 6;
            try {
                const mintInfo = await connection.getParsedAccountInfo(lpMintPubkey);
                const parsed = (mintInfo.value?.data as any)?.parsed;
                if (parsed?.info?.decimals !== undefined) {
                    lpDecimals = parsed.info.decimals;
                }
            } catch (e) {
                console.warn("Could not fetch LP mint decimals, defaulting to 6");
            }

            // Derive PDAs
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

            // Deposit all LP tokens using dynamic decimals
            const depositAmountRaw = Math.floor(currentLpBalance * (10 ** lpDecimals));
            const depositAmountBn = new anchor.BN(depositAmountRaw);

            const txHash = await program.methods.depositLp(depositAmountBn)
                .accounts({
                    global: globalPda,
                    pool: pubkey,
                    userInfo: userInfoPda,
                    userLpAccount: userLpAccount,
                    acceptedLpMint: lpMintPubkey,
                    vaultLpAccount: vaultLpAccount,
                    user: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                } as any)
                .rpc();

            showToast(`✅ LP Deposit Successful! TX: ${txHash.slice(0, 8)}...`, "success");
            console.log('LP Deposit TX:', txHash);
            onClose();

        } catch (error: any) {
            console.error('LP Deposit error:', error);
            showToast(`LP Deposit failed: ${error.message}`, "error");
        } finally {
            setIsExecuting(false);
        }
    }

    const modalContent = (
        <div className="modal-overlay">
            <div className="zap-modal">
                <button className="close-btn" onClick={onClose}>[X]</button>

                <h3 className="modal-title">⚡ DIRECT ZAP</h3>
                <p className="modal-subtitle">Auto-convert {inputToken} into <strong>{poolSubtitle} LP</strong> and Stake instantly.</p>

                <div className="input-group">
                    <div className="input-group-header">
                        <label>INPUT AMOUNT</label>
                        <div className="token-toggle three-tokens">
                            <button className={inputToken === 'SOL' ? 'active' : ''} onClick={() => setInputToken('SOL')}>SOL</button>
                            <button className={inputToken === 'USDC' ? 'active' : ''} onClick={() => setInputToken('USDC')}>USDC</button>
                            <button className={inputToken === 'SSS10I' ? 'active' : ''} onClick={() => setInputToken('SSS10I')}>SSS10I</button>
                        </div>
                    </div>
                    <div className="balance-display">
                        Balance: <span className="balance-value">
                            {inputToken === 'SOL' && `${solBalance.toFixed(4)} SOL`}
                            {inputToken === 'USDC' && `${usdcBalance.toFixed(2)} USDC`}
                            {inputToken === 'SSS10I' && `${sss10iBalance.toFixed(9)} SSS10I`}
                        </span>
                    </div>
                    <div className="input-wrapper">
                        <input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <button 
                            className="max-btn" 
                            onClick={() => {
                                if (inputToken === 'SOL') {
                                    const maxSol = Math.max(0, solBalance - SOL_RESERVE_FOR_GAS);
                                    setAmount(maxSol.toFixed(4));
                                } else if (inputToken === 'USDC') {
                                    setAmount(usdcBalance.toFixed(2));
                                } else {
                                    setAmount(sss10iBalance.toFixed(9));
                                }
                            }}
                        >MAX</button>
                        <span className="token-symbol">{inputToken}</span>
                    </div>
                </div>

                {zapSteps.length > 0 && (
                    <div className="zap-progress">
                        <h4>ZAP PROGRESS</h4>
                        {zapSteps.map((step, idx) => (
                            <div key={idx} className={`progress-step ${step.status}`}>
                                <span className="step-icon">
                                    {step.status === 'success' && '✅'}
                                    {step.status === 'processing' && '⏳'}
                                    {step.status === 'error' && '❌'}
                                    {step.status === 'pending' && '⏸'}
                                </span>
                                <span className="step-name">{step.name}</span>
                                {step.txHash && step.txHash !== 'Skipped (already owned)' && (
                                    <a 
                                        href={`https://solscan.io/tx/${step.txHash}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="tx-link"
                                    >
                                        {step.txHash.slice(0, 8)}...
                                    </a>
                                )}
                                {step.error && <span className="step-error">{step.error}</span>}
                            </div>
                        ))}
                    </div>
                )}

                {!zapComplete && (
                    <button
                        className="execute-btn"
                        onClick={handleExecuteZap}
                        disabled={isExecuting || !amount}
                    >
                        {isExecuting ? 'EXECUTING SWAPS...' : '1. EXECUTE ZAP SWAPS'}
                    </button>
                )}

                {zapComplete && (
                    <div className="zap-next-steps">
                        <div className="success-message">
                            ✅ Tokens swapped successfully!
                        </div>
                        <div className="instruction">
                            <strong>Next Steps:</strong>
                            <ol>
                                <li>Go to <a href={`https://raydium.io/liquidity/increase/?mode=add&pool_id=${raydiumPoolId}`} target="_blank" rel="noopener noreferrer">Raydium</a> and add liquidity</li>
                                <li>Return here and click "Deposit LP Tokens" below</li>
                            </ol>
                        </div>
                        <button
                            className="execute-btn deposit-btn"
                            onClick={handleDepositLp}
                            disabled={isExecuting}
                        >
                            {isExecuting ? 'DEPOSITING...' : '2. DEPOSIT LP TOKENS INTO POOL'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default ZapModal;
