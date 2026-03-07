import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { useToast } from './ToastProvider';
import { getLivePrices } from '../utils/priceProvider';
import './SwapCard.css';

// Whitelisted tokens with real Mainnet mint addresses
const TOKENS = [
    { name: 'SOL', symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9, logo: '/logos/Solana.png', isToken2022: false },
    { name: 'USDC', symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logo: '/logos/USDC.png', isToken2022: false },
    { name: 'SSS10i', symbol: 'SSS10i', mint: 'AnDgVLkfHUmuSrKMFsqFy8d7Fw49CzJjWk1uZZYPcSei', decimals: 9, logo: '/logos/sss10i.jpg', isToken2022: false },
    { name: 'CARDANO', symbol: 'CARDANO', mint: '2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump', decimals: 6, logo: '/logos/CARDANO.png', isToken2022: true },
    { name: 'HARRY', symbol: 'HARRY', mint: '7oZCgJNtCFvBNBNx7S1Nza9TwfzSNaovXMkfnk4gpump', decimals: 6, logo: '/logos/HarryPepe.jpg', isToken2022: true },
    { name: 'BULK', symbol: 'BULK', mint: 'F4TJfiMVi7zFGRJj4FVC1Zuj7fdCo6skKa4SnAU4pump', decimals: 6, logo: '/logos/bulk.jpg', isToken2022: true },
];

// Jupiter Lite API — free public endpoint, no API key required
const JUPITER_QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_URL  = 'https://lite-api.jup.ag/swap/v1/swap';

const SwapCard: React.FC = () => {
    const [fromToken, setFromToken] = useState(TOKENS[0]);
    const [toToken, setToToken] = useState(TOKENS[3]);
    const [amount, setAmount] = useState<string>('');
    const [quote, setQuote] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [swapping, setSwapping] = useState(false);
    const [showFromSelect, setShowFromSelect] = useState(false);
    const [showToSelect, setShowToSelect] = useState(false);
    const [fromBalance, setFromBalance] = useState<string>('—');
    const [toBalance, setToBalance] = useState<string>('—');
    const [balanceRefreshTrigger, setBalanceRefreshTrigger] = useState(0);
    const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const wallet = useAnchorWallet();
    const { connection } = useConnection();
    const { showToast } = useToast();

    // Fetch on-chain balance for a given token mint
    const fetchBalance = useCallback(async (mintStr: string, decimals: number, isToken2022?: boolean): Promise<string> => {
        if (!wallet) return '—';
        try {
            if (mintStr === 'So11111111111111111111111111111111111111112') {
                const lamports = await connection.getBalance(wallet.publicKey);
                return (lamports / LAMPORTS_PER_SOL).toFixed(4);
            }
            const mintPk = new PublicKey(mintStr);
            // Token2022 tokens need the correct program ID for ATA derivation
            const programs = isToken2022
                ? [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]
                : [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
            for (const prog of programs) {
                try {
                    const ata = getAssociatedTokenAddressSync(mintPk, wallet.publicKey, false, prog);
                    const info = await connection.getTokenAccountBalance(ata);
                    return (Number(info.value.amount) / 10 ** decimals).toFixed(4);
                } catch { /* try next program */ }
            }
            return '0.0000';
        } catch {
            return '0.0000';
        }
    }, [wallet, connection]);

    // Refresh balances whenever tokens, wallet, or trigger changes
    useEffect(() => {
        let active = true;
        if (!wallet) { setFromBalance('—'); setToBalance('—'); return; }
        
        // Fetch and safely set balances
        fetchBalance(fromToken.mint, fromToken.decimals, fromToken.isToken2022).then(bal => {
            if (active) setFromBalance(bal);
        });
        
        fetchBalance(toToken.mint, toToken.decimals, toToken.isToken2022).then(bal => {
            if (active) setToBalance(bal);
        });

        return () => { active = false; };
    }, [wallet, fromToken, toToken, fetchBalance, balanceRefreshTrigger]);

    // Fetch Jupiter quote with debounce
    const fetchQuote = useCallback(async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setQuote(null); return; }
        if (fromToken.mint === toToken.mint) { setQuote(null); return; }

        setLoading(true);
        try {
            const inputAmount = Math.floor(Number(amount) * 10 ** fromToken.decimals);
            const url = `${JUPITER_QUOTE_URL}?inputMint=${fromToken.mint}&outputMint=${toToken.mint}&amount=${inputAmount}&slippageBps=100&onlyDirectRoutes=false`;
            const res = await fetch(url);
            if (!res.ok) {
                const errText = await res.text();
                console.error('Jupiter Quote Error:', errText);
                setQuote(null);
                showToast('No route found for this pair.', 'error');
                return;
            }
            const data = await res.json();
            setQuote(data);
        } catch (err) {
            console.error('Quote fetch error:', err);
            setQuote(null);
            showToast('Could not reach Jupiter API. Check your connection.', 'error');
        } finally {
            setLoading(false);
        }
    }, [amount, fromToken, toToken, showToast]);

    useEffect(() => {
        if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
        quoteTimerRef.current = setTimeout(fetchQuote, 700);
        return () => { if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current); };
    }, [fetchQuote]);

    const formatOutput = () => {
        if (!quote?.outAmount) return '';
        return (Number(quote.outAmount) / 10 ** toToken.decimals).toFixed(6);
    };

    const getPriceImpact = () => {
        if (!quote?.priceImpactPct) return '< 0.01%';
        const pct = Number(quote.priceImpactPct) * 100;
        return `${pct.toFixed(4)}%`;
    };

    const handleSwap = async () => {
        if (!wallet) { showToast('Connect your wallet first.', 'error'); return; }
        if (!amount || Number(amount) <= 0) { showToast('Enter an amount.', 'error'); return; }
        if (insufficientBalance) { showToast(`Insufficient ${fromToken.symbol} balance.`, 'error'); return; }

        // If no quote yet, fetch one first
        let activeQuote = quote;
        if (!activeQuote) {
            setLoading(true);
            try {
                const inputAmount = Math.floor(Number(amount) * 10 ** fromToken.decimals);
                const url = `${JUPITER_QUOTE_URL}?inputMint=${fromToken.mint}&outputMint=${toToken.mint}&amount=${inputAmount}&slippageBps=100`;
                const res = await fetch(url);
                if (!res.ok) { showToast('No route found.', 'error'); setLoading(false); return; }
                activeQuote = await res.json();
                setQuote(activeQuote);
            } catch { showToast('Failed to fetch quote. Check internet connection.', 'error'); setLoading(false); return; }
            setLoading(false);
        }

        setSwapping(true);
        showToast('Building swap via Jupiter...', 'info');

        try {
            // Determine maximum priority fee based on swap USD value
            const prices = getLivePrices();
            const tokenPrice = (prices as any)[fromToken.symbol] || 0;
            const swapUsdValue = Number(amount) * tokenPrice;
            
            // For small swaps, cap priority fee strictly to prevent Phantom's "malicious drainer" warning
            // For larger swaps, allow a higher max priority fee to ensure fast execution
            let maxLamports = 1000000; // Default 0.001 SOL (~$0.15)
            if (tokenPrice > 0 && swapUsdValue < 5.0) {
                maxLamports = 250000; // 0.00025 SOL (~$0.04) for swaps under $5
            } else if (tokenPrice > 0) {
                maxLamports = 5000000; // 0.005 SOL (~$0.75) for swaps over $5
            } else {
                maxLamports = 1000000; // Fallback
            }

            const swapRes = await fetch(JUPITER_SWAP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteResponse: activeQuote,
                    userPublicKey: wallet.publicKey.toBase58(),
                    wrapAndUnwrapSol: true,
                    dynamicComputeUnitLimit: true,
                    prioritizationFeeLamports: {
                        priorityLevelWithMaxLamports: {
                            maxLamports: maxLamports,
                            priorityLevel: "veryHigh" // Ensures fast routing but capped by maxLamports
                        }
                    },
                }),
            });

            if (!swapRes.ok) {
                const errText = await swapRes.text();
                console.error('Jupiter Swap API Error:', errText);
                showToast('Failed to build swap transaction.', 'error');
                return;
            }

            const { swapTransaction } = await swapRes.json();
            const txBuf = Buffer.from(swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(txBuf);
            const signedTx = await wallet.signTransaction(transaction);

            const txId = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: false, maxRetries: 3 });
            showToast('Swap sent! Confirming...', 'info');

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            await connection.confirmTransaction({ signature: txId, blockhash, lastValidBlockHeight }, 'confirmed');

            showToast(`✅ Swap Success! TX: ${txId.slice(0, 8)}...`, 'success');
            console.log('✅ Swap TX:', txId);
            setAmount('');
            setQuote(null);
            // Refresh balances using effect trigger to avoid stale token states
            setBalanceRefreshTrigger(prev => prev + 1);
        } catch (err: any) {
            console.error('Swap Error:', err);
            showToast(`Swap Failed: ${err?.message || err}`, 'error');
        } finally {
            setSwapping(false);
        }
    };

    const handleFlip = () => {
        setFromToken(toToken);
        setToToken(fromToken);
        setQuote(null);
        setAmount('');
    };

    // True when user typed more than their actual balance
    const insufficientBalance = wallet
        && amount
        && Number(amount) > 0
        && fromBalance !== '—'
        && Number(amount) > Number(fromBalance);

    const getButtonLabel = () => {
        if (!wallet) return 'CONNECT WALLET';
        if (swapping) return 'SWAPPING...';
        if (loading) return 'FINDING ROUTE...';
        if (!amount || Number(amount) <= 0) return 'ENTER AMOUNT';
        if (insufficientBalance) return 'INSUFFICIENT BALANCE';
        if (!quote) return 'GET QUOTE & SWAP';
        return 'EXECUTE SWAP';
    };

    return (
        <div className="swap-card">
            <div className="swap-card-header">
                <h3>ASSET <span className="ice-accent">SWAP</span></h3>
                <span className="power-tag">POWERED BY JUPITER</span>
            </div>

            <div className="swap-inputs">
                {/* FROM */}
                <div className="input-field">
                    <div className="field-header">
                        <label>SELL</label>
                        <span onClick={() => wallet && setAmount(fromBalance)} style={{ cursor: wallet ? 'pointer' : 'default', opacity: 0.7 }}>
                            BAL: {fromBalance} {fromToken.symbol}
                        </span>
                    </div>
                    <div className="field-body">
                        <input
                            type="text"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            style={insufficientBalance ? { borderColor: '#f87171', color: '#f87171' } : {}}
                        />
                        <div className="token-select" onClick={() => { setShowFromSelect(!showFromSelect); setShowToSelect(false); }}>
                            <img src={fromToken.logo} alt={fromToken.symbol} />
                            <span>{fromToken.symbol}</span>
                            <span className="chevron">▼</span>
                        </div>
                        {showFromSelect && (
                            <div className="token-dropdown">
                                {TOKENS.filter(t => t.mint !== toToken.mint).map(t => (
                                    <div key={t.symbol} className="token-option" onClick={() => { setFromToken(t); setShowFromSelect(false); setQuote(null); }}>
                                        <img src={t.logo} alt={t.symbol} />
                                        <span>{t.symbol}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="swap-arrow" onClick={handleFlip} style={{ cursor: 'pointer' }}>
                    <div className="arrow-glow">⇅</div>
                </div>

                {/* TO */}
                <div className="input-field">
                    <div className="field-header">
                        <label>BUY</label>
                        <span style={{ opacity: 0.7 }}>BAL: {toBalance} {toToken.symbol}</span>
                    </div>
                    <div className="field-body">
                        <input type="text" placeholder="0.00" value={formatOutput()} readOnly />
                        <div className="token-select" onClick={() => { setShowToSelect(!showToSelect); setShowFromSelect(false); }}>
                            <img src={toToken.logo} alt={toToken.symbol} />
                            <span>{toToken.symbol}</span>
                            <span className="chevron">▼</span>
                        </div>
                        {showToSelect && (
                            <div className="token-dropdown">
                                {TOKENS.filter(t => t.mint !== fromToken.mint).map(t => (
                                    <div key={t.symbol} className="token-option" onClick={() => { setToToken(t); setShowToSelect(false); setQuote(null); }}>
                                        <img src={t.logo} alt={t.symbol} />
                                        <span>{t.symbol}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {quote && (
                <div className="quote-details">
                    <div className="detail-row">
                        <span>PRICE IMPACT:</span>
                        <span className="impact-val">{getPriceImpact()}</span>
                    </div>
                    <div className="detail-row">
                        <span>ROUTE:</span>
                        <span>{quote.routePlan?.map((r: any) => r.swapInfo?.label || '?').join(' → ') || 'Direct'}</span>
                    </div>
                </div>
            )}

            <button
                className={`extract-btn ${loading || swapping ? 'btn-loading' : ''}`}
                disabled={!wallet || swapping || loading || !!insufficientBalance}
                onClick={handleSwap}
            >
                {getButtonLabel()}
            </button>
        </div>
    );
};

export default SwapCard;
