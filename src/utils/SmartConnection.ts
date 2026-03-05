import { Connection } from "@solana/web3.js";
import type { ConnectionConfig } from "@solana/web3.js";
import { RPC_URL } from "./constants";

/**
 * Simple Connection Utility
 * Uses only Helius paid RPC - no failover logic.
 */
export const getSmartConnection = (config?: ConnectionConfig): Connection => {
    return new Connection(RPC_URL, {
        commitment: 'confirmed',
        ...config,
    });
};
