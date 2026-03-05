import { PublicKey } from "@solana/web3.js";

// ------------------------------------------------------------------
// NETWORK & PROGRAM CONSTANTS
// ------------------------------------------------------------------
export const NETWORK = "mainnet-beta";

// Single RPC endpoint - Helius paid only (no failover)
export const RPC_URL = import.meta.env.VITE_RPC_URL || "https://api.mainnet-beta.solana.com";

// For backwards compatibility with SmartConnection
export const RPC_ENDPOINTS: string[] = [RPC_URL];

// Always return Helius endpoint
export const getRpcUrl = (): string => RPC_URL;

// Default export uses the load balancer

export const PROGRAM_ID = new PublicKey("68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF");

// ------------------------------------------------------------------
// MINT IDS (Mainnet - Live Production)
// ------------------------------------------------------------------
export const CARDANO_MINT = new PublicKey("2HE1yvnVitiBEzU1fud7kPsGv89eP7TBwSd8D3tPpump");
export const SSS10i_MINT = new PublicKey("AnDgVLkfHUmuSrKMFsqFy8d7Fw49CzJjWk1uZZYPcSei");
// LP_MINT: CARDANO/SOL Raydium LP — used for test pool initialization
export const LP_MINT = new PublicKey("3an9TS1g2dEYkdk1ShiYkzYEyi7P6SR5aveCYTKnmHGe");
export const NFT_MINT = new PublicKey("2fTa9jhfqtsKa13hMg63oJR6ah75iXzg6ShJyqhsx5yk");
// HARRY_MINT and BULK_MINT: Update with real addresses when known
export const HARRY_MINT = new PublicKey("7oZCgJNtCFvBNBNx7S1Nza9TwfzSNaovXMkfnk4gpump");
export const BULK_MINT = new PublicKey("F4TJfiMVi7zFGRJj4FVC1Zuj7fdCo6skKa4SnAU4pump");
export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Metadata Program for NFTs
export const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// ------------------------------------------------------------------
// POOL INSTANCES
// ------------------------------------------------------------------
// ⚠️  IMPORTANT: After clicking "B. CREATE NEW POOL" in DevDebug,
//     update this address// Update this dynamically after testing / pool creation
export const TARGET_POOL_PUBKEY = new PublicKey("GNwnKFx2v6zoPRtnv7SxN3mhAKfy4c1dmRZA1WkfkMFp");
