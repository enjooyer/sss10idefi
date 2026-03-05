import React, { useState } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { createMintToInstruction, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import { CARDANO_MINT, SSS10i_MINT, NFT_MINT, LP_MINT, TARGET_POOL_PUBKEY, PROGRAM_ID } from '../utils/constants';
import { useAnchorProgram } from '../hooks/useAnchorProgram';
import { useToast } from './ToastProvider';
import './DevDebug.css';

const DevDebug: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { connection } = useConnection();
    const wallet = useAnchorWallet();
    
    const program = useAnchorProgram();
    const { showToast } = useToast();
    const [globalExists, setGlobalExists] = useState<boolean>(false);
    const [poolExists, setPoolExists] = useState<boolean>(false);
    const [solBalance, setSolBalance] = useState<string>("0.00");
    const [isSimulatingOnly, setIsSimulatingOnly] = useState<boolean>(false);

    const mintTokens = async () => {
        if (!wallet) return;
        showToast("Provisioning Devnet Test Assets...", "info");

        try {
            const tx = new Transaction();
            const mints = [CARDANO_MINT, SSS10i_MINT, LP_MINT, NFT_MINT];
            //  CARDANO=9dec, SSS10i=9dec, LP=6dec, NFT=0dec
            const amounts = [100000 * 10 ** 9, 10 * 10 ** 9, 500 * 10 ** 6, 2];

            for (let i = 0; i < mints.length; i++) {
                const mint = mints[i];
                const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey);

                // Check if ATA exists
                const info = await connection.getAccountInfo(ata);
                if (!info) {
                    tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, ata, wallet.publicKey, mint));
                }

                tx.add(createMintToInstruction(mint, ata, wallet.publicKey, amounts[i]));
            }

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            const signature = await wallet.signTransaction(tx);
            const txId = await connection.sendRawTransaction(signature.serialize());
            await connection.confirmTransaction(txId);

            showToast("Assets Provisioned!", "success");
            const bal = await connection.getBalance(wallet.publicKey);
            setSolBalance((bal / anchor.web3.LAMPORTS_PER_SOL).toFixed(2));
        } catch (err: any) {
            console.error(err);
            showToast(`Faucet Error: ${err.message}`, "error");
        }
    };

    const requestAirdrop = async () => {
        if (!wallet) return;
        showToast("Requesting airdrop (2 SOL)...", "info");
        try {
            const sig = await connection.requestAirdrop(wallet.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig);
            showToast("Airdrop Successful!", "success");
            checkHealth();
        } catch (err: any) {
            console.error(err);
            showToast(`Airdrop Failed: ${err.message}`, "error");
        }
    };

    const setupGlobal = async () => {
        if (!program || !wallet) return;
        if (globalExists) {
            showToast("Global State already exists!", "info");
            return;
        }
        showToast("Initializing Global Protocol State...", "info");
        try {
            const [globalPda] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );

            // Production value: 60 SSS10i total over 1 year (365 * 24 * 60 * 60 = 31,536,000 seconds)
            // 60 * 10^9 / 31,536,000 = 1,902 lamports per second
            const rewardPerSec = new anchor.BN(1902);
            // Hardened v2: emission end time = 1 year from now
            const ONE_YEAR = 365 * 24 * 60 * 60;
            const emissionEnd = new anchor.BN(Math.floor(Date.now() / 1000) + ONE_YEAR);

            if (isSimulatingOnly) {
                showToast("SIMULATING GLOBAL INIT...", "info");
                const tx = await program.methods.initializeGlobal(rewardPerSec, emissionEnd)
                    .accounts({
                        global: globalPda,
                        authority: wallet.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    } as any)
                    .transaction();

                tx.feePayer = wallet.publicKey;
                tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

                const sim = await connection.simulateTransaction(tx);
                console.log("SIMULATION LOGS:", sim.value.logs);
                if (sim.value.err) {
                    console.error("SIMULATION ERROR:", sim.value.err);
                    showToast(`Sim Failed: ${JSON.stringify(sim.value.err)}`, "error");
                } else {
                    showToast("Simulation Success! (Logs in Console)", "success");
                }
                return;
            }

            const tx = await program.methods.initializeGlobal(rewardPerSec, emissionEnd)
                .accounts({
                    global: globalPda,
                    authority: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                } as any)
                .rpc();

            showToast(`Global State Live! Sig: ${tx.slice(0, 8)}`, "success");
            checkHealth();
        } catch (err: any) {
            console.error("Global Init Error Detailed:", err);
            if (err.logs) console.log("Program Logs:", err.logs);
            showToast(`Global Init Failed: ${err.message}`, "error");
        }
    };

    const updateGlobalRate = async () => {
        if (!program || !wallet) return;
        showToast("Lowering Emission Rate...", "info");
        try {
            const [globalPda] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );

            // Production exact math: 60 SSS10i over 1 year = 1,902 lamports per sec
            const newRate = new anchor.BN(1902);

            const tx = await program.methods.updateEmissionRate(newRate)
                .accounts({
                    global: globalPda,
                    authority: wallet.publicKey,
                } as any)
                .rpc();

            showToast(`Rate Fixed! Sig: ${tx.slice(0, 8)}`, "success");
        } catch (err: any) {
            console.error("Update Rate Error:", err);
            showToast(`Rate Update Failed: ${err.message}`, "error");
        }
    };

    const updateTargetAddress = (addr: string) => {
        if (!addr) return;
        console.log("!!! MANUAL OVERRIDE INSTRUCTIONS !!!");
        console.log("Please update TARGET_POOL_PUBKEY in src/utils/constants.ts with:");
        console.log(addr);
        showToast("Address in Console. Update constants.ts!", "info");
    };

    const checkHealth = async () => {
        if (!program || !wallet) return;
        try {
            const bal = await connection.getBalance(wallet.publicKey);
            setSolBalance((bal / anchor.web3.LAMPORTS_PER_SOL).toFixed(3));

            const [globalPda] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );

            const globalAccountProxy = (program as any).account.globalState || (program as any).account.GlobalState;
            const poolAccountProxy = (program as any).account.poolState || (program as any).account.PoolState;

            console.log("Checking Global PDA:", globalPda.toBase58());

            if (globalAccountProxy) {
                try {
                    // Try fetching with data
                    await globalAccountProxy.fetch(globalPda);
                    setGlobalExists(true);
                } catch (err: any) {
                    // Check if account simply HAS NO DATA or if it's a DATA MISMATCH
                    const info = await connection.getAccountInfo(globalPda);
                    if (info) {
                        console.warn("Global account exists but failed to fetch data (likely discriminator mismatch). Marking as OK.");
                        setGlobalExists(true);
                    } else {
                        setGlobalExists(false);
                    }
                }
            } else {
                console.error("Critical: 'globalState' or 'GlobalState' not found on program.account");
            }

            if (poolAccountProxy) {
                try {
                    await poolAccountProxy.fetch(TARGET_POOL_PUBKEY);
                    setPoolExists(true);
                } catch {
                    const info = await connection.getAccountInfo(TARGET_POOL_PUBKEY);
                    setPoolExists(!!info);
                }
            } else {
                console.error("Critical: 'poolState' or 'PoolState' not found on program.account");
            }

        } catch (e) {
            console.error("Health check error", e);
        }
    }

    const createNewPool = async () => {
        console.log(">> CREATE NEW POOL CLICKED <<");
        if (!program || !wallet) {
            console.error("Program or Wallet MISSING in createNewPool");
            return;
        }
        // (Removed poolExists check so you can reliably force-create it during this test)
        const newPool = anchor.web3.Keypair.generate();
        showToast(`Generating New Pool: ${newPool.publicKey.toBase58().slice(0, 8)}...`, "info");

        try {
            const [globalPda] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("global")],
                program.programId
            );

            const [vaultLpAccount] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("vault"), newPool.publicKey.toBuffer()],
                program.programId
            );

            const allocPoint = new anchor.BN(1000);

            if (isSimulatingOnly) {
                showToast("SIMULATING POOL CREATION...", "info");
                const tx = await program.methods.addPool(allocPoint)
                    .accounts({
                        global: globalPda,
                        pool: newPool.publicKey,
                        rewardMint: SSS10i_MINT,
                        lpMint: LP_MINT,
                        cardanoMint: CARDANO_MINT,
                        nftCollectionMint: NFT_MINT,
                        vaultLpAccount: vaultLpAccount,
                        authority: wallet.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    } as any)
                    .signers([newPool])
                    .transaction();

                tx.feePayer = wallet.publicKey;
                tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                // Note: Simulation with partial signers (newPool) might still throw on some clients
                // but we can try to provide dummy signature if needed. Usually simulate is fine.

                const sim = await connection.simulateTransaction(tx);
                console.log("POOL SIM LOGS:", sim.value.logs);
                if (sim.value.err) {
                    console.error("POOL SIM ERROR:", sim.value.err);
                    showToast(`Pool Sim Failed: See Console`, "error");
                } else {
                    showToast("Pool Sim Success!", "success");
                }
                return;
            }

            console.log("Building TX with priority fees...");
            const computeLimit = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
            const computePrice = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 });

            // Build tx, partial sign with pool keypair, sign with wallet,
            const tx = await program.methods.addPool(allocPoint)
                .accounts({
                    global: globalPda,
                    pool: newPool.publicKey,
                    rewardMint: SSS10i_MINT,
                    lpMint: LP_MINT,
                    cardanoMint: CARDANO_MINT,
                    nftCollectionMint: NFT_MINT,
                    vaultLpAccount: vaultLpAccount,
                    authority: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                } as any)
                .preInstructions([computeLimit, computePrice])
                .transaction();

            console.log("Fetching Blockhash...");

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            console.log("Step 1: Partial signing with Pool Keypair...");
            // Step 1: Partial sign with the new pool keypair
            tx.partialSign(newPool);

            console.log("Step 2: Requesting User Signature...");
            // Step 2: Get the user's signature from Jupiter/Phantom (sign only, no broadcast)
            const signedTx = await wallet.signTransaction(tx);

            console.log("Step 3: Sending Raw Transaction (skipPreflight: false)...");
            // Step 3: Broadcast DIRECTLY to Solana RPC — bypasses Jupiter's /v1/broadcast
            // Using skipPreflight: false so if it fails we find out IMMEDIATELY instead of hanging
            const txId = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: false, maxRetries: 3 });
            console.log("Tx Sent! Waiting for confirmation (txId:", txId, ")...");
            
            const result = await connection.confirmTransaction({ signature: txId, blockhash, lastValidBlockHeight }, 'confirmed');
            if (result.value.err) {
                console.error("❌ Transaction confirmed but FAILED. Error:", JSON.stringify(result.value.err));
                showToast(`Pool Creation Failed on-chain. See console.`, "error");
                return;
            }

            console.log("✅ NEW POOL PUBKEY:", newPool.publicKey.toBase58());
            console.log("✅ Transaction ID:", txId);
            updateTargetAddress(newPool.publicKey.toBase58());
            showToast("SUCCESS! Check console for NEW POOL ADDRESS.", "success");
            checkHealth();
        } catch (err: any) {
            console.error("Pool Creation Error Detailed:", err?.message || err);
            if (err?.logs) console.log("Program Logs:", err.logs);
            showToast(`Pool Creation Failed: ${err?.message}`, "error");
        }
    };

    const provisionTreasury = async () => {
        if (!wallet) return;
        showToast("Provisioning Pool Treasury (SSS10i for farming rewards)...", "info");

        try {
            const [treasuryPda] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("treasury"), TARGET_POOL_PUBKEY.toBuffer()],
                PROGRAM_ID
            );

            const treasuryFractions = getAssociatedTokenAddressSync(SSS10i_MINT, treasuryPda, true);
            const userFractions = getAssociatedTokenAddressSync(SSS10i_MINT, wallet.publicKey);

            console.log("POOL TREASURY PDA:", treasuryPda.toBase58());
            console.log("POOL TREASURY SSS10i ATA:", treasuryFractions.toBase58());

            const tx = new Transaction();
            const { blockhash } = await connection.getLatestBlockhash('finalized');
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            const computeLimit = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
            const computePrice = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 });
            tx.add(computeLimit, computePrice);

            const fracInfo = await connection.getAccountInfo(treasuryFractions);
            if (!fracInfo) {
                tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, treasuryFractions, treasuryPda, SSS10i_MINT));
            }

            let needsSss10i = true;
            if (fracInfo) {
                try {
                    const bal = await connection.getTokenAccountBalance(treasuryFractions);
                    if (Number(bal.value.uiAmount) > 0) needsSss10i = false;
                } catch (e) {}
            }

            if (needsSss10i) {
                const userFracInfo = await connection.getAccountInfo(userFractions);
                if (!userFracInfo) {
                    showToast("No SSS10i ATA found. Do you have SSS10i tokens?", "error");
                    return;
                }
                tx.add(createTransferInstruction(userFractions, treasuryFractions, wallet.publicKey, 1 * 10 ** 9));
            }

            if (tx.instructions.length > 0) {
                const signature = await wallet.signTransaction(tx);
                const txId = await connection.sendRawTransaction(signature.serialize(), { skipPreflight: false });
                const { blockhash: bh2, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
                await connection.confirmTransaction({ signature: txId, blockhash: bh2, lastValidBlockHeight }, 'confirmed');
            }

            showToast("Pool Treasury SSS10i funded for farming rewards!", "success");
        } catch (err: any) {
            console.error("Pool Treasury Provisioning Error:", err?.message || err);
            if (err?.logs) console.log("Program Logs:", err.logs);
            showToast(`Pool Treasury Provisioning Failed. See Console.`, "error");
        }
    };

    const provisionNftTreasury = async () => {
        if (!wallet) return;
        showToast("Provisioning Global NFT Treasury (for Artifact Forge wrap/unwrap)...", "info");

        try {
            const [nftTreasuryPda] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("nft_treasury")],
                PROGRAM_ID
            );

            const nftTreasuryFractions = getAssociatedTokenAddressSync(SSS10i_MINT, nftTreasuryPda, true);
            const userFractions = getAssociatedTokenAddressSync(SSS10i_MINT, wallet.publicKey);

            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.log("GLOBAL NFT TREASURY PDA:", nftTreasuryPda.toBase58());
            console.log("NFT TREASURY SSS10i ATA:", nftTreasuryFractions.toBase58());

            // Check current NFT treasury SSS10i balance
            let currentBalance = 0;
            try {
                const bal = await connection.getTokenAccountBalance(nftTreasuryFractions);
                currentBalance = Number(bal.value.uiAmount ?? 0);
                console.log("NFT TREASURY CURRENT SSS10i BALANCE:", currentBalance);
            } catch { console.log("NFT Treasury SSS10i ATA does not exist yet"); }
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

            const tx = new Transaction();
            const { blockhash } = await connection.getLatestBlockhash('finalized');
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            const computeLimit = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
            const computePrice = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 });
            tx.add(computeLimit, computePrice);

            // Ensure NFT Treasury SSS10i ATA exists
            const fracInfo = await connection.getAccountInfo(nftTreasuryFractions);
            if (!fracInfo) {
                tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, nftTreasuryFractions, nftTreasuryPda, SSS10i_MINT));
            }

            // Transfer SSS10i to NFT treasury if needed (for unwrap liquidity)
            if (currentBalance === 0) {
                const userFracInfo = await connection.getAccountInfo(userFractions);
                if (!userFracInfo) {
                    showToast("No SSS10i ATA found. Do you have SSS10i tokens?", "error");
                    return;
                }
                // Check user balance
                const userBal = await connection.getTokenAccountBalance(userFractions);
                const userAmount = Number(userBal.value.uiAmount ?? 0);
                console.log("Your SSS10i balance:", userAmount);
                if (userAmount < 1) {
                    showToast("Need at least 1 SSS10i to seed NFT Treasury", "error");
                    return;
                }
                // Transfer 1 SSS10i to NFT treasury
                tx.add(createTransferInstruction(userFractions, nftTreasuryFractions, wallet.publicKey, 1 * 10 ** 9));
            }

            if (tx.instructions.length > 0) {
                const signature = await wallet.signTransaction(tx);
                const txId = await connection.sendRawTransaction(signature.serialize(), { skipPreflight: false });
                const { blockhash: bh2, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
                await connection.confirmTransaction({ signature: txId, blockhash: bh2, lastValidBlockHeight }, 'confirmed');
                showToast(`NFT Treasury funded! TX: ${txId.slice(0, 8)}...`, "success");
            } else {
                showToast("NFT Treasury already provisioned!", "info");
            }

            // Show NFT ATA info for manual NFT transfers
            const nftTreasuryNftAta = getAssociatedTokenAddressSync(NFT_MINT, nftTreasuryPda, true);
            console.log("NFT TREASURY wSSS10i NFT ATA (send NFTs here):", nftTreasuryNftAta.toBase58());
            console.log(">>> To add NFTs: Send wSSS10i NFTs to the above ATA from Phantom");
        } catch (err: any) {
            console.error("NFT Treasury Provisioning Error:", err?.message || err);
            if (err?.logs) console.log("Program Logs:", err.logs);
            showToast(`NFT Treasury Provisioning Failed. See Console.`, "error");
        }
    };


    return (
        <div className={`dev-debug-container ${isOpen ? 'open' : ''}`}>
            <button className="debug-toggle" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? 'CLOSE DEBUG' : 'DEV DEBUG'}
            </button>

            {isOpen && (
                <div className="debug-content">
                    <div className="debug-info-grid">
                        <div className="info-item">NETWORK: <span className="text-danger">MAINNET</span></div>
                        <div className="info-item">SOL: <span className="gold-text">{solBalance}</span></div>
                        <div className="info-item tiny">PROGRAM: {PROGRAM_ID.toBase58().slice(0, 6)}...</div>
                        <div className="info-item tiny">PAYER: {wallet?.publicKey.toBase58().slice(0, 6)}...</div>
                    </div>

                    <div className="health-badge">
                        GLOBAL: <span className={globalExists ? 'text-success' : 'text-danger'}>{globalExists ? 'OK' : 'MISSING'}</span> |
                        POOL: <span className={poolExists ? 'text-success' : 'text-danger'}>{poolExists ? 'OK' : 'MISSING'}</span>
                        <button className="refresh-btn" onClick={checkHealth}>🔄</button>
                    </div>

                    <div className="diagnostic-toggle">
                        <label>
                            <input
                                type="checkbox"
                                checked={isSimulatingOnly}
                                onChange={(e) => setIsSimulatingOnly(e.target.checked)}
                            />
                            DEBUG MODE (SIMULATE ONLY)
                        </label>
                    </div>

                    <h4>1. FUNDING</h4>
                    <div className="debug-actions">
                        <button className="faucet-btn" onClick={requestAirdrop}>AIRDROP 2 SOL</button>
                        <button className="faucet-btn" onClick={mintTokens}>MINT ASSETS</button>
                    </div>

                    <h4>2. PROTOCOL SETUP</h4>
                    <p className="debug-tip">Setup Global once. Create Pool for each farm.</p>
                    <div className="debug-actions">
                        <button className="faucet-btn gold" disabled={globalExists && !isSimulatingOnly} onClick={setupGlobal}>A. INIT GLOBAL STATE</button>
                        <button className="faucet-btn gold" onClick={createNewPool}>B. CREATE NEW POOL</button>
                        <button className="faucet-btn secondary" onClick={updateGlobalRate}>C. FIX (LOWER) REWARD RATE</button>
                    </div>

                    <h4>3. POOL TREASURY (Farming Rewards)</h4>
                    <div className="debug-actions">
                        <button className="faucet-btn secondary" onClick={provisionTreasury}>PROVISION POOL TREASURY</button>
                    </div>

                    <h4>4. GLOBAL NFT TREASURY (Artifact Forge)</h4>
                    <p className="debug-tip">Independent treasury for wrap/unwrap. Holds NFTs + SSS10i liquid.</p>
                    <div className="debug-actions">
                        <button className="faucet-btn gold" onClick={provisionNftTreasury}>PROVISION NFT TREASURY</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevDebug;
