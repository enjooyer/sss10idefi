export type SiteZeroMatrix = {
    version: "0.1.0";
    name: "site_zero_matrix";
    address: "68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF";
    instructions: [
        {
            name: "initializeGlobal";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "authority"; isMut: true; isSigner: true },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [
                { name: "rewardPerSec"; type: "u64" },
                { name: "emissionEndTime"; type: "i64" }
            ];
        },
        {
            name: "migrateGlobalState";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "authority"; isMut: true; isSigner: true },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [];
        },
        {
            name: "migrateGlobalStateV2";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "authority"; isMut: true; isSigner: true },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [
                { name: "nftCollectionMint"; type: "publicKey" },
                { name: "sss10iMint"; type: "publicKey" }
            ];
        },
        {
            name: "adminSetGlobalMints";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "authority"; isMut: true; isSigner: true }
            ];
            args: [
                { name: "nftCollectionMint"; type: "publicKey" },
                { name: "sss10iMint"; type: "publicKey" }
            ];
        },
        {
            name: "addPool";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "pool"; isMut: true; isSigner: true },
                { name: "rewardMint"; isMut: false; isSigner: false },
                { name: "lpMint"; isMut: false; isSigner: false },
                { name: "cardanoMint"; isMut: false; isSigner: false },
                { name: "nftCollectionMint"; isMut: false; isSigner: false },
                { name: "vaultLpAccount"; isMut: true; isSigner: false },
                { name: "authority"; isMut: true; isSigner: true },
                { name: "systemProgram"; isMut: false; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false }
            ];
            args: [{ name: "allocPoint"; type: "u64" }];
        },
        {
            name: "adminRecoverTokens";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "pool"; isMut: true; isSigner: false },
                { name: "authority"; isMut: true; isSigner: true },
                { name: "rewardMint"; isMut: true; isSigner: false },
                { name: "treasury"; isMut: true; isSigner: false },
                { name: "treasuryFractionsAta"; isMut: true; isSigner: false },
                { name: "adminFractionsAta"; isMut: true; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "associatedTokenProgram"; isMut: false; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [{ name: "amount"; type: "u64" }];
        },
        {
            name: "adminRecoverAnyToken";
            accounts: [
                { name: "global"; isMut: false; isSigner: false },
                { name: "pool"; isMut: false; isSigner: false },
                { name: "authority"; isMut: true; isSigner: true },
                { name: "tokenMint"; isMut: false; isSigner: false },
                { name: "treasury"; isMut: true; isSigner: false },
                { name: "sourceAta"; isMut: true; isSigner: false },
                { name: "destinationAta"; isMut: true; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false }
            ];
            args: [{ name: "amount"; type: "u64" }];
        },
        {
            name: "adminTransferToNftTreasury";
            accounts: [
                { name: "global"; isMut: false; isSigner: false },
                { name: "pool"; isMut: false; isSigner: false },
                { name: "authority"; isMut: true; isSigner: true },
                { name: "tokenMint"; isMut: false; isSigner: false },
                { name: "poolTreasury"; isMut: true; isSigner: false },
                { name: "nftTreasury"; isMut: true; isSigner: false },
                { name: "sourceAta"; isMut: true; isSigner: false },
                { name: "nftTreasuryAta"; isMut: true; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "associatedTokenProgram"; isMut: false; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [{ name: "amount"; type: "u64" }];
        },
        {
            name: "depositLp";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "pool"; isMut: true; isSigner: false },
                { name: "userInfo"; isMut: true; isSigner: false },
                { name: "userLpAccount"; isMut: true; isSigner: false },
                { name: "acceptedLpMint"; isMut: false; isSigner: false },
                { name: "vaultLpAccount"; isMut: true; isSigner: false },
                { name: "user"; isMut: true; isSigner: true },
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false },
                { name: "associatedTokenProgram"; isMut: false; isSigner: false }
            ];
            args: [{ name: "amount"; type: "u64" }];
        },
        {
            name: "withdrawLp";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "pool"; isMut: true; isSigner: false },
                { name: "userInfo"; isMut: true; isSigner: false },
                { name: "userLpAccount"; isMut: true; isSigner: false },
                { name: "acceptedLpMint"; isMut: false; isSigner: false },
                { name: "vaultLpAccount"; isMut: true; isSigner: false },
                { name: "user"; isMut: true; isSigner: true },
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false },
                { name: "associatedTokenProgram"; isMut: false; isSigner: false }
            ];
            args: [{ name: "amount"; type: "u64" }];
        },
        {
            name: "emergencyWithdraw";
            accounts: [
                { name: "pool"; isMut: true; isSigner: false },
                { name: "userInfo"; isMut: true; isSigner: false },
                { name: "userLpAccount"; isMut: true; isSigner: false },
                { name: "acceptedLpMint"; isMut: false; isSigner: false },
                { name: "vaultLpAccount"; isMut: true; isSigner: false },
                { name: "user"; isMut: true; isSigner: true },
                { name: "tokenProgram"; isMut: false; isSigner: false }
            ];
            args: [];
        },
        {
            name: "harvestMatrixRewards";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "pool"; isMut: true; isSigner: false },
                { name: "userInfo"; isMut: true; isSigner: false },
                { name: "user"; isMut: true; isSigner: true },
                { name: "rewardMint"; isMut: true; isSigner: false },
                { name: "treasury"; isMut: true; isSigner: false },
                { name: "treasuryFractionsAta"; isMut: true; isSigner: false },
                { name: "userFractionsAta"; isMut: true; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "associatedTokenProgram"; isMut: false; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [];
        },
        {
            name: "updateAllocPoint";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "pool"; isMut: true; isSigner: false },
                { name: "authority"; isMut: false; isSigner: true }
            ];
            args: [{ name: "newAlloc"; type: "u64" }];
        },
        {
            name: "updateEmissionRate";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "authority"; isMut: false; isSigner: true }
            ];
            args: [{ name: "newRate"; type: "u64" }];
        },
        {
            name: "setEmissionParams";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "authority"; isMut: false; isSigner: true }
            ];
            args: [
                { name: "newRate"; type: "u64" },
                { name: "newEndTime"; type: "i64" }
            ];
        },
        {
            name: "setEmissionBudget";
            accounts: [
                { name: "global"; isMut: true; isSigner: false },
                { name: "authority"; isMut: false; isSigner: true }
            ];
            args: [{ name: "budget"; type: "u64" }];
        },
        {
            name: "wrapToNft";
            accounts: [
                { name: "user"; isMut: true; isSigner: true },
                { name: "global"; isMut: false; isSigner: false },
                { name: "cardanoMint"; isMut: true; isSigner: false },
                { name: "userCardanoAta"; isMut: true; isSigner: false },
                { name: "sss10iMint"; isMut: true; isSigner: false },
                { name: "nftTreasury"; isMut: true; isSigner: false },
                { name: "userFractionsAta"; isMut: true; isSigner: false },
                { name: "nftTreasuryFractionsAta"; isMut: true; isSigner: false },
                { name: "nftMint"; isMut: false; isSigner: false },
                { name: "userNftAta"; isMut: true; isSigner: false },
                { name: "nftTreasuryNftAta"; isMut: true; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "token2022Program"; isMut: false; isSigner: false },
                { name: "associatedTokenProgram"; isMut: false; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [];
        },
        {
            name: "unwrapToFractions";
            accounts: [
                { name: "user"; isMut: true; isSigner: true },
                { name: "global"; isMut: false; isSigner: false },
                { name: "cardanoMint"; isMut: true; isSigner: false },
                { name: "userCardanoAta"; isMut: true; isSigner: false },
                { name: "sss10iMint"; isMut: true; isSigner: false },
                { name: "nftTreasury"; isMut: true; isSigner: false },
                { name: "userFractionsAta"; isMut: true; isSigner: false },
                { name: "nftTreasuryFractionsAta"; isMut: true; isSigner: false },
                { name: "nftMint"; isMut: false; isSigner: false },
                { name: "userNftAta"; isMut: true; isSigner: false },
                { name: "nftTreasuryNftAta"; isMut: true; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "token2022Program"; isMut: false; isSigner: false },
                { name: "associatedTokenProgram"; isMut: false; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false }
            ];
            args: [];
        }
    ];
    accounts: [
        {
            name: "GlobalState";
            type: {
                kind: "struct";
                fields: [
                    { name: "authority"; type: "publicKey" },
                    { name: "totalAllocPoint"; type: "u64" },
                    { name: "totalRewardPerSecond"; type: "u64" },
                    { name: "emissionEndTime"; type: "i64" },
                    { name: "totalEmissionBudget"; type: "u64" },
                    { name: "totalEmitted"; type: "u64" },
                    { name: "nftCollectionMint"; type: "publicKey" },
                    { name: "sss10iMint"; type: "publicKey" }
                ];
            };
        },
        {
            name: "PoolState";
            type: {
                kind: "struct";
                fields: [
                    { name: "authority"; type: "publicKey" },
                    { name: "rewardMint"; type: "publicKey" },
                    { name: "acceptedLpMint"; type: "publicKey" },
                    { name: "cardanoMint"; type: "publicKey" },
                    { name: "nftCollectionMint"; type: "publicKey" },
                    { name: "allocPoint"; type: "u64" },
                    { name: "totalStaked"; type: "u64" },
                    { name: "lastUpdateTime"; type: "i64" },
                    { name: "accRewardPerShare"; type: "u128" },
                    { name: "totalRewardLiability"; type: "u128" }
                ];
            };
        },
        {
            name: "UserInfo";
            type: {
                kind: "struct";
                fields: [
                    { name: "stakedAmount"; type: "u64" },
                    { name: "pendingRewards"; type: "u64" },
                    { name: "rewardDebt"; type: "u128" }
                ];
            };
        }
    ];
    errors: [
        { code: 6000; name: "Unauthorized"; msg: "Unauthorized access to Pool Configuration." },
        { code: 6001; name: "ZeroDeposit"; msg: "Cannot deposit 0 tokens." },
        { code: 6002; name: "ZeroWithdrawal"; msg: "Cannot withdraw 0 tokens." },
        { code: 6003; name: "InsufficientStake"; msg: "Insufficient staked balance for withdrawal." },
        { code: 6004; name: "TreasuryEmpty"; msg: "Treasury is out of NFTs." },
        { code: 6005; name: "InvalidWrapAmount"; msg: "Must send exactly 1.0 Fractions to Wrap." },
        { code: 6006; name: "NoRewardsToHarvest"; msg: "No rewards currently pending to harvest." },
        { code: 6007; name: "InvalidNFTAmount"; msg: "Invalid NFT amount constraint." },
        { code: 6008; name: "InvalidMint"; msg: "Invalid token mint used directly attempting to exploit protocol." },
        { code: 6009; name: "InvalidNFTCollection"; msg: "NFT does not belong to the official Pool Collection." },
        { code: 6010; name: "UnverifiedNFT"; msg: "NFT Collection membership is unverified." },
        { code: 6011; name: "InsufficientProtocolLiquidity"; msg: "Reward Treasury balance is below protocol liability." },
        { code: 6012; name: "LiabilityConflict"; msg: "Attempted to withdraw tokens that are already owed to stakers." },
        { code: 6013; name: "MathOverflow"; msg: "Arithmetic overflow or underflow detected." },
        { code: 6014; name: "EmissionBudgetExhausted"; msg: "All farming emissions have been fully distributed. Budget exhausted." },
        { code: 6015; name: "EmissionBudgetAlreadySet"; msg: "Emission budget has already been locked. Cannot reset after emissions have begun." },
        { code: 6016; name: "MigrationNotNeeded"; msg: "GlobalState migration not needed - account is already at correct size." },
        { code: 3012; name: "AccountNotInitialized"; msg: "Account not initialized" }
    ];
};

export const IDL: SiteZeroMatrix = {
    version: "0.1.0",
    name: "site_zero_matrix",
    address: "68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF",
    instructions: [
        {
            name: "initializeGlobal",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "authority", isMut: true, isSigner: true },
                { name: "systemProgram", isMut: false, isSigner: false }
            ],
            args: [
                { name: "rewardPerSec", type: "u64" },
                { name: "emissionEndTime", type: "i64" }
            ]
        },
        {
            name: "migrateGlobalState",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "authority", isMut: true, isSigner: true },
                { name: "systemProgram", isMut: false, isSigner: false }
            ],
            args: []
        },
        {
            name: "migrateGlobalStateV2",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "authority", isMut: true, isSigner: true },
                { name: "systemProgram", isMut: false, isSigner: false }
            ],
            args: [
                { name: "nftCollectionMint", type: "publicKey" },
                { name: "sss10iMint", type: "publicKey" }
            ]
        },
        {
            name: "adminSetGlobalMints",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "authority", isMut: true, isSigner: true }
            ],
            args: [
                { name: "nftCollectionMint", type: "publicKey" },
                { name: "sss10iMint", type: "publicKey" }
            ]
        },
        {
            name: "addPool",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "pool", isMut: true, isSigner: true },
                { name: "rewardMint", isMut: false, isSigner: false },
                { name: "lpMint", isMut: false, isSigner: false },
                { name: "cardanoMint", isMut: false, isSigner: false },
                { name: "nftCollectionMint", isMut: false, isSigner: false },
                { name: "vaultLpAccount", isMut: true, isSigner: false },
                { name: "authority", isMut: true, isSigner: true },
                { name: "systemProgram", isMut: false, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false }
            ],
            args: [{ name: "allocPoint", type: "u64" }]
        },
        {
            name: "adminRecoverTokens",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "pool", isMut: true, isSigner: false },
                { name: "authority", isMut: true, isSigner: true },
                { name: "rewardMint", isMut: true, isSigner: false },
                { name: "treasury", isMut: true, isSigner: false },
                { name: "treasuryFractionsAta", isMut: true, isSigner: false },
                { name: "adminFractionsAta", isMut: true, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false },
                { name: "associatedTokenProgram", isMut: false, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false }
            ],
            args: [{ name: "amount", type: "u64" }]
        },
        {
            name: "adminRecoverAnyToken",
            accounts: [
                { name: "global", isMut: false, isSigner: false },
                { name: "pool", isMut: false, isSigner: false },
                { name: "authority", isMut: true, isSigner: true },
                { name: "tokenMint", isMut: false, isSigner: false },
                { name: "treasury", isMut: true, isSigner: false },
                { name: "sourceAta", isMut: true, isSigner: false },
                { name: "destinationAta", isMut: true, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false }
            ],
            args: [{ name: "amount", type: "u64" }]
        },
        {
            name: "adminTransferToNftTreasury",
            accounts: [
                { name: "global", isMut: false, isSigner: false },
                { name: "pool", isMut: false, isSigner: false },
                { name: "authority", isMut: true, isSigner: true },
                { name: "tokenMint", isMut: false, isSigner: false },
                { name: "poolTreasury", isMut: true, isSigner: false },
                { name: "nftTreasury", isMut: true, isSigner: false },
                { name: "sourceAta", isMut: true, isSigner: false },
                { name: "nftTreasuryAta", isMut: true, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false },
                { name: "associatedTokenProgram", isMut: false, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false }
            ],
            args: [{ name: "amount", type: "u64" }]
        },
        {
            name: "depositLp",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "pool", isMut: true, isSigner: false },
                { name: "userInfo", isMut: true, isSigner: false },
                { name: "userLpAccount", isMut: true, isSigner: false },
                { name: "acceptedLpMint", isMut: false, isSigner: false },
                { name: "vaultLpAccount", isMut: true, isSigner: false },
                { name: "user", isMut: true, isSigner: true },
                { name: "tokenProgram", isMut: false, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false },
                { name: "associatedTokenProgram", isMut: false, isSigner: false }
            ],
            args: [{ name: "amount", type: "u64" }]
        },
        {
            name: "withdrawLp",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "pool", isMut: true, isSigner: false },
                { name: "userInfo", isMut: true, isSigner: false },
                { name: "userLpAccount", isMut: true, isSigner: false },
                { name: "acceptedLpMint", isMut: false, isSigner: false },
                { name: "vaultLpAccount", isMut: true, isSigner: false },
                { name: "user", isMut: true, isSigner: true },
                { name: "tokenProgram", isMut: false, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false },
                { name: "associatedTokenProgram", isMut: false, isSigner: false }
            ],
            args: [{ name: "amount", type: "u64" }]
        },
        {
            name: "emergencyWithdraw",
            accounts: [
                { name: "pool", isMut: true, isSigner: false },
                { name: "userInfo", isMut: true, isSigner: false },
                { name: "userLpAccount", isMut: true, isSigner: false },
                { name: "acceptedLpMint", isMut: false, isSigner: false },
                { name: "vaultLpAccount", isMut: true, isSigner: false },
                { name: "user", isMut: true, isSigner: true },
                { name: "tokenProgram", isMut: false, isSigner: false }
            ],
            args: []
        },
        {
            name: "harvestMatrixRewards",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "pool", isMut: true, isSigner: false },
                { name: "userInfo", isMut: true, isSigner: false },
                { name: "user", isMut: true, isSigner: true },
                { name: "rewardMint", isMut: true, isSigner: false },
                { name: "treasury", isMut: true, isSigner: false },
                { name: "treasuryFractionsAta", isMut: true, isSigner: false },
                { name: "userFractionsAta", isMut: true, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false },
                { name: "associatedTokenProgram", isMut: false, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false }
            ],
            args: []
        },
        {
            name: "updateAllocPoint",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "pool", isMut: true, isSigner: false },
                { name: "authority", isMut: false, isSigner: true }
            ],
            args: [{ name: "newAlloc", type: "u64" }]
        },
        {
            name: "updateEmissionRate",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "authority", isMut: false, isSigner: true }
            ],
            args: [{ name: "newRate", type: "u64" }]
        },
        {
            name: "setEmissionParams",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "authority", isMut: false, isSigner: true }
            ],
            args: [
                { name: "newRate", type: "u64" },
                { name: "newEndTime", type: "i64" }
            ]
        },
        {
            name: "setEmissionBudget",
            accounts: [
                { name: "global", isMut: true, isSigner: false },
                { name: "authority", isMut: false, isSigner: true }
            ],
            args: [{ name: "budget", type: "u64" }]
        },
        {
            name: "wrapToNft",
            accounts: [
                { name: "user", isMut: true, isSigner: true },
                { name: "global", isMut: false, isSigner: false },
                { name: "cardanoMint", isMut: true, isSigner: false },
                { name: "userCardanoAta", isMut: true, isSigner: false },
                { name: "sss10iMint", isMut: true, isSigner: false },
                { name: "nftTreasury", isMut: true, isSigner: false },
                { name: "userFractionsAta", isMut: true, isSigner: false },
                { name: "nftTreasuryFractionsAta", isMut: true, isSigner: false },
                { name: "nftMint", isMut: false, isSigner: false },
                { name: "userNftAta", isMut: true, isSigner: false },
                { name: "nftTreasuryNftAta", isMut: true, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false },
                { name: "token2022Program", isMut: false, isSigner: false },
                { name: "associatedTokenProgram", isMut: false, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false }
            ],
            args: []
        },
        {
            name: "unwrapToFractions",
            accounts: [
                { name: "user", isMut: true, isSigner: true },
                { name: "global", isMut: false, isSigner: false },
                { name: "cardanoMint", isMut: true, isSigner: false },
                { name: "userCardanoAta", isMut: true, isSigner: false },
                { name: "sss10iMint", isMut: true, isSigner: false },
                { name: "nftTreasury", isMut: true, isSigner: false },
                { name: "userFractionsAta", isMut: true, isSigner: false },
                { name: "nftTreasuryFractionsAta", isMut: true, isSigner: false },
                { name: "nftMint", isMut: false, isSigner: false },
                { name: "userNftAta", isMut: true, isSigner: false },
                { name: "nftTreasuryNftAta", isMut: true, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false },
                { name: "token2022Program", isMut: false, isSigner: false },
                { name: "associatedTokenProgram", isMut: false, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false }
            ],
            args: []
        }
    ],
    accounts: [
        {
            name: "GlobalState",
            type: {
                kind: "struct",
                fields: [
                    { name: "authority", type: "publicKey" },
                    { name: "totalAllocPoint", type: "u64" },
                    { name: "totalRewardPerSecond", type: "u64" },
                    { name: "emissionEndTime", type: "i64" },
                    { name: "totalEmissionBudget", type: "u64" },
                    { name: "totalEmitted", type: "u64" },
                    { name: "nftCollectionMint", type: "publicKey" },
                    { name: "sss10iMint", type: "publicKey" }
                ]
            }
        },
        {
            name: "PoolState",
            type: {
                kind: "struct",
                fields: [
                    { name: "authority", type: "publicKey" },
                    { name: "rewardMint", type: "publicKey" },
                    { name: "acceptedLpMint", type: "publicKey" },
                    { name: "cardanoMint", type: "publicKey" },
                    { name: "nftCollectionMint", type: "publicKey" },
                    { name: "allocPoint", type: "u64" },
                    { name: "totalStaked", type: "u64" },
                    { name: "lastUpdateTime", type: "i64" },
                    { name: "accRewardPerShare", type: "u128" },
                    { name: "totalRewardLiability", type: "u128" }
                ]
            }
        },
        {
            name: "UserInfo",
            type: {
                kind: "struct",
                fields: [
                    { name: "stakedAmount", type: "u64" },
                    { name: "pendingRewards", type: "u64" },
                    { name: "rewardDebt", type: "u128" }
                ]
            }
        }
    ],
    errors: [
        { code: 6000, name: "Unauthorized", msg: "Unauthorized access to Pool Configuration." },
        { code: 6001, name: "ZeroDeposit", msg: "Cannot deposit 0 tokens." },
        { code: 6002, name: "ZeroWithdrawal", msg: "Cannot withdraw 0 tokens." },
        { code: 6003, name: "InsufficientStake", msg: "Insufficient staked balance for withdrawal." },
        { code: 6004, name: "TreasuryEmpty", msg: "Treasury is out of NFTs." },
        { code: 6005, name: "InvalidWrapAmount", msg: "Must send exactly 1.0 Fractions to Wrap." },
        { code: 6006, name: "NoRewardsToHarvest", msg: "No rewards currently pending to harvest." },
        { code: 6007, name: "InvalidNFTAmount", msg: "Invalid NFT amount constraint." },
        { code: 6008, name: "InvalidMint", msg: "Invalid token mint used directly attempting to exploit protocol." },
        { code: 6009, name: "InvalidNFTCollection", msg: "NFT does not belong to the official Pool Collection." },
        { code: 6010, name: "UnverifiedNFT", msg: "NFT Collection membership is unverified." },
        { code: 6011, name: "InsufficientProtocolLiquidity", msg: "Reward Treasury balance is below protocol liability." },
        { code: 6012, name: "LiabilityConflict", msg: "Attempted to withdraw tokens that are already owed to stakers." },
        { code: 6013, name: "MathOverflow", msg: "Arithmetic overflow or underflow detected." },
        { code: 6014, name: "EmissionBudgetExhausted", msg: "All farming emissions have been fully distributed. Budget exhausted." },
        { code: 6015, name: "EmissionBudgetAlreadySet", msg: "Emission budget has already been locked. Cannot reset after emissions have begun." },
        { code: 6016, name: "MigrationNotNeeded", msg: "GlobalState migration not needed - account is already at correct size." },
        { code: 3012, name: "AccountNotInitialized", msg: "Account not initialized" }
    ]
} as const;
