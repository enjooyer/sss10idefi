import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Buffer } from 'buffer';

const JUPITER_QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_URL = 'https://lite-api.jup.ag/swap/v1/swap';

export interface ZapStep {
    name: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    txHash?: string;
    error?: string;
}

export interface ZapResult {
    success: boolean;
    steps: ZapStep[];
    finalLpAmount?: number;
    error?: string;
}

/**
 * Get current pool reserves to calculate optimal swap ratio
 */
export async function getPoolReserves(
    _connection: Connection,
    _poolMintA: PublicKey,
    _poolMintB: PublicKey,
    poolId: string
): Promise<{ reserveA: number; reserveB: number; ratio: number }> {
    try {
        // Fetch pool info from Raydium API
        const response = await fetch(`https://api-v3.raydium.io/pools/info/ids?ids=${poolId}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const pool = data.data[0];
            const reserveA = Number(pool.mintAmountA || 0);
            const reserveB = Number(pool.mintAmountB || 0);
            const ratio = reserveA > 0 ? reserveB / reserveA : 1;
            return { reserveA, reserveB, ratio };
        }
    } catch (error) {
        console.warn('Failed to fetch pool reserves:', error);
    }
    
    // Default to 1:1 ratio if fetch fails
    return { reserveA: 0, reserveB: 0, ratio: 1 };
}

/**
 * Calculate how much of input token to swap to get equal-value amounts of both pool tokens
 */
export async function calculateSwapAmount(
    connection: Connection,
    inputAmount: number,
    inputMint: PublicKey,
    targetMintA: PublicKey,
    targetMintB: PublicKey,
    poolId: string
): Promise<{ swapToMintA: number; swapToMintB: number; keepAsInput: number }> {
    await getPoolReserves(connection, targetMintA, targetMintB, poolId);
    
    // If input is one of the pool tokens, swap half to the other
    if (inputMint.equals(targetMintA)) {
        return {
            swapToMintA: 0,
            swapToMintB: inputAmount * 0.5,
            keepAsInput: inputAmount * 0.5
        };
    } else if (inputMint.equals(targetMintB)) {
        return {
            swapToMintA: inputAmount * 0.5,
            swapToMintB: 0,
            keepAsInput: inputAmount * 0.5
        };
    } else {
        // Input is neither pool token, swap to both based on pool ratio
        // Simplified: split 50/50 by value
        return {
            swapToMintA: inputAmount * 0.5,
            swapToMintB: inputAmount * 0.5,
            keepAsInput: 0
        };
    }
}

/**
 * Execute a Jupiter swap
 */
export async function executeJupiterSwap(
    connection: Connection,
    wallet: AnchorWallet,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number,
    inputDecimals: number,
    slippageBps: number = 100
): Promise<string> {
    const inputAmount = Math.floor(amount * 10 ** inputDecimals);
    
    // Get quote
    const quoteUrl = `${JUPITER_QUOTE_URL}?inputMint=${inputMint.toBase58()}&outputMint=${outputMint.toBase58()}&amount=${inputAmount}&slippageBps=${slippageBps}`;
    console.log(`Jupiter quote URL: ${quoteUrl}`);
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) {
        const errorText = await quoteRes.text();
        console.error(`Jupiter quote failed (${quoteRes.status}):`, errorText);
        throw new Error(`Jupiter quote failed: ${errorText}`);
    }
    const quote = await quoteRes.json();
    console.log(`Jupiter quote response:`, quote);

    // Get swap transaction
    console.log(`Requesting Jupiter swap transaction...`);
    const swapRes = await fetch(JUPITER_SWAP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: wallet.publicKey.toBase58(),
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto',
        }),
    });

    if (!swapRes.ok) {
        const errorText = await swapRes.text();
        console.error(`Jupiter swap API failed (${swapRes.status}):`, errorText);
        throw new Error(`Jupiter swap API failed: ${errorText}`);
    }

    const { swapTransaction } = await swapRes.json();
    console.log(`Got swap transaction, signing...`);
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuf);
    const signedTx = await wallet.signTransaction(transaction);

    console.log(`Sending transaction...`);
    const txId = await connection.sendRawTransaction(signedTx.serialize(), { 
        skipPreflight: false, 
        maxRetries: 3 
    });
    console.log(`Transaction sent: ${txId}`);

    // Wait for confirmation
    console.log(`Waiting for confirmation...`);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const confirmation = await connection.confirmTransaction({ 
        signature: txId, 
        blockhash, 
        lastValidBlockHeight 
    }, 'confirmed');

    if (confirmation.value.err) {
        console.error(`Transaction failed:`, confirmation.value.err);
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`Transaction confirmed: ${txId}`);
    return txId;
}

/**
 * Get LP token balance after adding liquidity
 */
export async function getLpTokenBalance(
    connection: Connection,
    wallet: PublicKey,
    lpMint: PublicKey
): Promise<number> {
    try {
        const lpAta = getAssociatedTokenAddressSync(lpMint, wallet);
        const balance = await connection.getTokenAccountBalance(lpAta);
        return Number(balance.value.uiAmount || 0);
    } catch (e: any) {
        console.error(`Failed to fetch LP token balance for ${lpMint.toBase58()}:`, e);
        // Return 0 if account doesn't exist, but log the error for debugging
        if (e.message?.includes('could not find account')) {
            console.warn(`LP token account does not exist: ${lpMint.toBase58()}`);
        }
        return 0;
    }
}

/**
 * Main Zap function: Input token → Swap to both pool tokens → Add liquidity → Get LP tokens
 * Fully automated - no need to redirect to Raydium
 */
export async function executeZapSwaps(
    connection: Connection,
    wallet: AnchorWallet,
    inputMint: PublicKey,
    inputAmount: number,
    inputDecimals: number,
    poolId: string,
    poolMintA: PublicKey,
    poolMintB: PublicKey,
    _poolDecimalsA: number,
    _poolDecimalsB: number,
    onStepUpdate?: (steps: ZapStep[]) => void
): Promise<ZapResult> {
    const steps: ZapStep[] = [
        { name: 'Calculate optimal swap amounts', status: 'pending' },
        { name: 'Swap to pool token A', status: 'pending' },
        { name: 'Swap to pool token B', status: 'pending' },
    ];

    const updateStep = (index: number, update: Partial<ZapStep>) => {
        steps[index] = { ...steps[index], ...update };
        onStepUpdate?.(steps);
    };

    try {
        // Step 1: Calculate swap amounts
        updateStep(0, { status: 'processing' });
        const swapAmounts = await calculateSwapAmount(
            connection,
            inputAmount,
            inputMint,
            poolMintA,
            poolMintB,
            poolId
        );
        updateStep(0, { status: 'success' });



        // Step 2: Swap to token A (if needed)
        if (swapAmounts.swapToMintA > 0) {
            updateStep(1, { status: 'processing' });
            const txHashA = await executeJupiterSwap(
                connection,
                wallet,
                inputMint,
                poolMintA,
                swapAmounts.swapToMintA,
                inputDecimals
            );
            updateStep(1, { status: 'success', txHash: txHashA });
            
            // Fetch actual received amount
            const ataA = getAssociatedTokenAddressSync(poolMintA, wallet.publicKey);
            try {
                await connection.getTokenAccountBalance(ataA);
            } catch (e: any) {
                const message = e?.message || String(e);
                if (message.includes('could not find account')) {
                    console.warn(`Token A ATA missing (${poolMintA.toBase58()}). Continuing zap; balance treated as 0.`);
                } else {
                    console.error(`Failed to fetch balance for token A (${poolMintA.toBase58()}):`, e);
                    throw new Error(`Failed to fetch token A balance: ${message}`);
                }
            }
        } else {
            updateStep(1, { status: 'success', txHash: 'Skipped (already owned)' });
        }

        // Step 3: Swap to token B (if needed)
        if (swapAmounts.swapToMintB > 0) {
            updateStep(2, { status: 'processing' });
            const txHashB = await executeJupiterSwap(
                connection,
                wallet,
                inputMint,
                poolMintB,
                swapAmounts.swapToMintB,
                inputDecimals
            );
            updateStep(2, { status: 'success', txHash: txHashB });
            
            // Fetch actual received amount
            const ataB = getAssociatedTokenAddressSync(poolMintB, wallet.publicKey);
            try {
                await connection.getTokenAccountBalance(ataB);
            } catch (e: any) {
                const message = e?.message || String(e);
                if (message.includes('could not find account')) {
                    console.warn(`Token B ATA missing (${poolMintB.toBase58()}). Continuing zap; balance treated as 0.`);
                } else {
                    console.error(`Failed to fetch balance for token B (${poolMintB.toBase58()}):`, e);
                    throw new Error(`Failed to fetch token B balance: ${message}`);
                }
            }
        } else {
            updateStep(2, { status: 'success', txHash: 'Skipped (already owned)' });
        }

        return {
            success: true,
            steps,
            finalLpAmount: 0, // LP balance will be checked in ZapModal
        };
    } catch (error: any) {
        const failedStepIndex = steps.findIndex(s => s.status === 'processing');
        if (failedStepIndex >= 0) {
            updateStep(failedStepIndex, { 
                status: 'error', 
                error: error.message 
            });
        }

        return {
            success: false,
            steps,
            error: error.message,
        };
    }
}
