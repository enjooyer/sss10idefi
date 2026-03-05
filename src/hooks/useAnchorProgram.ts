import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useMemo } from 'react';
import { IDL } from '../idl/site_zero_matrix';
import type { SiteZeroMatrix } from '../idl/site_zero_matrix';
import { PROGRAM_ID } from '../utils/constants';
import { getSmartConnection } from '../utils/SmartConnection';

export function useAnchorProgram() {
    const wallet = useAnchorWallet();

    const program = useMemo(() => {
        // Use our SmartConnection utility for Anchor as well
        const connection: Connection = getSmartConnection(); // Explicitly type connection

        // Create a dummy wallet for read-only RPC calls when disconnected
        const fallbackWallet = wallet || {
            publicKey: new PublicKey('11111111111111111111111111111111'),
            signTransaction: async (tx: any) => { throw new Error('Wallet not connected'); return tx; },
            signAllTransactions: async (txs: any[]) => { throw new Error('Wallet not connected'); return txs; }
        };

        // Create an Anchor provider (works in read-only mode with dummy wallet)
        const provider = new AnchorProvider(connection, fallbackWallet, {
            preflightCommitment: 'processed',
        });

        // Return the strongly-typed program instance
        return new Program<SiteZeroMatrix>(IDL, PROGRAM_ID, provider);
    }, [wallet]); // Remove 'connection' from dependencies as it's a constant function call

    return program;
}
