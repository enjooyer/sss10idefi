import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID, SSS10i_MINT, NFT_MINT, RPC_URL } from '../utils/constants';
import * as anchor from '@coral-xyz/anchor';
import { POOL_CONFIGS } from '../utils/mockApi';
import { getSmartConnection } from '../utils/SmartConnection';
import './DocsTerminal.css';

type DocSection = 
    | 'introduction'
    | 'vision'
    | 'how-it-works'
    | 'why-77'
    | 'effects'
    | 'tokenomics'
    | 'farming-pairs'
    | 'farming-guide'
    | 'strategies'
    | 'wrap-unwrap'
    | 'emergency'
    | 'transparency'
    | 'disclaimer';

interface NavItem {
    id: DocSection;
    label: string;
    icon: string;
}

const navSections: { category: string; items: NavItem[] }[] = [
    {
        category: 'Getting Started',
        items: [
            { id: 'introduction', label: 'Introduction', icon: '📖' },
            { id: 'vision', label: 'Vision & Philosophy', icon: '💎' },
        ]
    },
    {
        category: 'Protocol',
        items: [
            { id: 'how-it-works', label: 'How It Works', icon: '⚙️' },
            { id: 'why-77', label: 'Why 77 Tokens?', icon: '🔢' },
            { id: 'effects', label: 'Ecosystem Effects', icon: '🌊' },
        ]
    },
    {
        category: 'Tokenomics',
        items: [
            { id: 'tokenomics', label: 'Token Economics', icon: '📊' },
            { id: 'farming-pairs', label: 'Farming Pairs', icon: '🌾' },
        ]
    },
    {
        category: 'User Guide',
        items: [
            { id: 'farming-guide', label: 'Farming Guide', icon: '📚' },
            { id: 'strategies', label: 'Strategies', icon: '🎯' },
            { id: 'wrap-unwrap', label: 'Wrap & Unwrap', icon: '🔄' },
            { id: 'emergency', label: 'Emergency Withdraw', icon: '🚨' },
        ]
    },
    {
        category: 'Governance',
        items: [
            { id: 'transparency', label: 'Transparency', icon: '🔍' },
            { id: 'disclaimer', label: 'Disclaimer & Risks', icon: '⚠️' },
        ]
    }
];

interface TreasuryBalance {
    name: string;
    address: string;
    sss10i: number;
    nfts: number | null;
    isGlobal?: boolean;
}

const DocsTerminal: React.FC = () => {
    const [activeSection, setActiveSection] = useState<DocSection>('introduction');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [treasuryBalances, setTreasuryBalances] = useState<TreasuryBalance[]>([]);
    const [fetchingTreasury, setFetchingTreasury] = useState(false);

    useEffect(() => {
        if (activeSection === 'transparency') {
            const fetchTreasury = async () => {
                setFetchingTreasury(true);
                try {
                    const connection = getSmartConnection();
                    const balances: TreasuryBalance[] = [];

                    // 1. NFT Contract Treasury
                    const [nftTreasuryPda] = PublicKey.findProgramAddressSync(
                        [anchor.utils.bytes.utf8.encode('nft_treasury')],
                        PROGRAM_ID
                    );
                    
                    let nftCount = 0;
                    let wrapSss10iLiquid = 0;

                    try {
                        const tAta = getAssociatedTokenAddressSync(SSS10i_MINT, nftTreasuryPda, true, TOKEN_PROGRAM_ID);
                        const tBal = await connection.getTokenAccountBalance(tAta);
                        wrapSss10iLiquid = Number(tBal.value.uiAmount ?? 0);
                    } catch (e) {
                        console.warn("Could not fetch NFT Treasury SSS10i balance", e);
                    }

                    try {
                        const dasRes = await fetch(RPC_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0', id: 'stats-nft',
                                method: 'searchAssets',
                                params: {
                                    ownerAddress: nftTreasuryPda.toBase58(),
                                    grouping: ['collection', NFT_MINT.toBase58()],
                                    page: 1, limit: 100,
                                },
                            }),
                        });
                        const dasData = await dasRes.json();
                        nftCount = dasData?.result?.total ?? dasData?.result?.items?.length ?? 0;
                    } catch (e) {
                        console.warn("Could not fetch NFT Treasury NFTs count", e);
                    }

                    balances.push({
                        name: 'Wrap Contract Treasury',
                        address: nftTreasuryPda.toBase58(),
                        sss10i: wrapSss10iLiquid,
                        nfts: nftCount,
                        isGlobal: true
                    });

                    // 2. Pool Treasuries
                    const activePools = POOL_CONFIGS.filter(p => !p.isOffline && p.poolPubkey);
                    const poolPdas = activePools.map(p => new PublicKey(p.poolPubkey!));
                    const treasuryPdas = poolPdas.map(poolPk => {
                        const [treasuryPda] = PublicKey.findProgramAddressSync(
                            [anchor.utils.bytes.utf8.encode('treasury'), poolPk.toBuffer()],
                            PROGRAM_ID
                        );
                        return treasuryPda;
                    });
                    const treasuryAtas = treasuryPdas.map(tPda => getAssociatedTokenAddressSync(SSS10i_MINT, tPda, true, TOKEN_PROGRAM_ID));

                    try {
                        const treasuryInfos = await connection.getMultipleAccountsInfo(treasuryAtas);
                        activePools.forEach((pool, index) => {
                            const info = treasuryInfos[index];
                            let amount = 0;
                            if (info && info.data.length >= 72) {
                                const raw = info.data.readBigUInt64LE(64);
                                amount = Number(raw) / 1e9;
                            }
                            balances.push({
                                name: `${pool.title} Treasury (${pool.subtitle})`,
                                address: treasuryPdas[index].toBase58(),
                                sss10i: amount,
                                nfts: null
                            });
                        });
                    } catch (e) {
                        console.warn("Could not fetch pool treasury balances", e);
                        activePools.forEach((pool, index) => {
                            balances.push({
                                name: `${pool.title} Treasury (${pool.subtitle})`,
                                address: treasuryPdas[index].toBase58(),
                                sss10i: 0,
                                nfts: null
                            });
                        });
                    }

                    setTreasuryBalances(balances);
                } catch (err) {
                    console.error("Treasury fetch error", err);
                } finally {
                    setFetchingTreasury(false);
                }
            };
            fetchTreasury();
            const interval = setInterval(fetchTreasury, 30000); // 30s refresh
            return () => clearInterval(interval);
        }
    }, [activeSection]);

    useEffect(() => {
        setSidebarOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeSection]);

    const renderContent = () => {
        switch (activeSection) {
            case 'introduction':
                return (
                    <div className="docs-section">
                        <div className="docs-hero">
                            <div className="hero-badge">OFFICIAL DOCUMENTATION</div>
                            <h1>Facility Sieben</h1>
                            <p className="hero-subtitle">The World's First Scarcity-Enforced DeFi Protocol</p>
                        </div>
                        
                        <div className="docs-announcement">
                            <span className="announcement-icon">🎉</span>
                            <p>I am pleased to announce the completion of the Facility Sieben DeFi mechanism.</p>
                        </div>

                        <div className="docs-links-grid">
                            <a href="https://magiceden.us/marketplace/sss10i" target="_blank" rel="noopener noreferrer" className="docs-link-card">
                                <span className="link-icon">🖼️</span>
                                <span className="link-label">NFT Marketplace</span>
                                <span className="link-url">Magic Eden</span>
                            </a>
                            <div className="docs-link-card contract-card">
                                <span className="link-icon">📜</span>
                                <span className="link-label">Liquid SSS10i Contract</span>
                                <span className="link-url" style={{fontSize: '0.8rem', wordBreak: 'break-all'}}>AnDgVLkfHUmuSrKMFsqFy8d7Fw49CzJjWk1uZZYPcSei</span>
                            </div>
                            <a href="https://defi.sss10i.com" target="_blank" rel="noopener noreferrer" className="docs-link-card">
                                <span className="link-icon">🌐</span>
                                <span className="link-label">Official Website</span>
                                <span className="link-url">defi.sss10i.com</span>
                            </a>
                            <a href="https://solscan.io/account/68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF" target="_blank" rel="noopener noreferrer" className="docs-link-card">
                                <span className="link-icon">📜</span>
                                <span className="link-label">Smart Contract</span>
                                <span className="link-url">Solscan</span>
                            </a>
                        </div>

                        <h2>The Problem with Traditional DeFi</h2>
                        <p>For many years traditional DeFi farming protocols have bootstrapped liquidity but led to infinite dumps via highly inflationary 2-token ecosystems. The evidence is written on every reward token's chart.</p>
                        <p className="highlight-box">I have fixed this critical flaw in DeFi with $CARDANO.</p>
                    </div>
                );

            case 'vision':
                return (
                    <div className="docs-section">
                        <h1>Vision & Philosophy</h1>
                        <div className="docs-quote">
                            <span className="quote-mark">"</span>
                            <p>Back in my day, a farmer was a man that had a dream. Not a 35-wallet "meme trencher" but a man with capital to deploy and a dream that it could work for him while he slept and potentially change his life.</p>
                            <p>Whether he had $15 to his name or $15 million it didn't matter. He had a dream and was rewarded proportionally for his participation.</p>
                            <span className="quote-mark">"</span>
                            <p style={{textAlign: 'right', marginTop: '10px', fontStyle: 'italic'}}>-CH</p>
                        </div>
                        <p>It is my goal that through $CARDANO I can return back to this mindset and way of thinking.</p>
                        
                        <h2>Core Principles</h2>
                        <div className="principles-grid">
                            <div className="principle-card">
                                <span className="principle-icon">⚖️</span>
                                <h3>Fair Distribution</h3>
                                <p>Rewards are distributed proportionally based on your stake. No insider advantages.</p>
                            </div>
                            <div className="principle-card">
                                <span className="principle-icon">🔒</span>
                                <h3>Fixed Supply</h3>
                                <p>77 tokens. No more, no less. Ever. Mathematically enforced on-chain.</p>
                            </div>
                            <div className="principle-card">
                                <span className="principle-icon">⏳</span>
                                <h3>Time-Locked Emissions</h3>
                                <p>1 year emission period creates sustained value and allows buy pressure to form on a scarce digital asset.</p>
                            </div>
                            <div className="principle-card">
                                <span className="principle-icon">🎨</span>
                                <h3>Art-Backed Value</h3>
                                <p>Each token is backed by rare digital collectible artwork, creating intrinsic value.</p>
                            </div>
                        </div>
                    </div>
                );

            case 'how-it-works':
                return (
                    <div className="docs-section">
                        <h1>How It Works</h1>
                        <p className="section-intro">Users can deposit Raydium LP tokens or zap into liquidity positions at the Facility Sieben farms via SOL or USDC.</p>
                        
                        <div className="step-flow">
                            <div className="step-card">
                                <div className="step-number">1</div>
                                <h3>Provide Liquidity</h3>
                                <p>Add liquidity to supported Raydium pools or use our Zap feature with SOL/USDC.</p>
                            </div>
                            <div className="step-arrow">→</div>
                            <div className="step-card">
                                <div className="step-number">2</div>
                                <h3>Stake LP Tokens</h3>
                                <p>Deposit your LP tokens into Facility Sieben farms to start earning.</p>
                            </div>
                            <div className="step-arrow">→</div>
                            <div className="step-card">
                                <div className="step-number">3</div>
                                <h3>Earn $SSS10i</h3>
                                <p>Accumulate fractional $SSS10i rewards every second based on your stake.</p>
                            </div>
                            <div className="step-arrow">→</div>
                            <div className="step-card">
                                <div className="step-number">4</div>
                                <h3>Collect or Wrap</h3>
                                <p>Harvest liquid tokens or wrap 1.0 $SSS10i into a rare NFT artifact.</p>
                            </div>
                        </div>
                    </div>
                );

            case 'why-77':
                return (
                    <div className="docs-section">
                        <h1>Why 77 Tokens?</h1>
                        <p className="section-intro">The number isn't arbitrary—it's engineered for maximum scarcity and value preservation.</p>
                        
                        <div className="feature-list">
                            <div className="feature-item">
                                <span className="feature-icon">🖼️</span>
                                <div className="feature-content">
                                    <h3>Each Token = 1 NFT</h3>
                                    <p>Each full token represents a rare, digital collectible (NFT). These aren't just numbers—they're art pieces with intrinsic collectible value.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">💎</span>
                                <div className="feature-content">
                                    <h3>Enforced Scarcity</h3>
                                    <p>77 tokens enables scarcity. The underlying art backing them encourages collecting and holding rather than dumping.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">📈</span>
                                <div className="feature-content">
                                    <h3>Buy Pressure Mechanics</h3>
                                    <p>The prolonged distribution of only 77 full tokens (NFTs) over 1 year enables BUY pressure to form on an extremely scarce digital collectible.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">👑</span>
                                <div className="feature-content">
                                    <h3>The Ultimate Status Symbol</h3>
                                    <p>The ultimate status symbol</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'effects':
                return (
                    <div className="docs-section">
                        <h1>Ecosystem Effects</h1>
                        
                        <div className="effects-grid">
                            <div className="effect-card cardano">
                                <h3>Effects on $CARDANO</h3>
                                <ul>
                                    <li>Deepened liquidity across trading pairs</li>
                                    <li>Increased burns via wrap/unwrap fees</li>
                                    <li>Buy backs and sustained volume</li>
                                    <li>Increased alignment throughout the Solana meme ecosystem</li>
                                </ul>
                            </div>
                            
                            <div className="effect-card sss10i">
                                <h3>Effects on $SSS10i / NFTs</h3>
                                <ul>
                                    <li>Fair, distributed supply of very rare fully liquid collectibles over 1 year</li>
                                    <li>Instant monetary or collectible rewards for liquidity providers</li>
                                    <li>Scarcity and value enforced by slow emissions + backing by underlying artworks</li>
                                    <li>More liquidity miners = significantly harder to obtain a full token/NFT</li>
                                    <li>Buy pressure as collectors look to secure extremely scarce art</li>
                                    <li>Arbitrage opportunities between liquid $SSS10i and fungible NFTs via art marketplaces</li>
                                </ul>
                            </div>
                            
                            <div className="effect-card dimension">
                                <h3>Effects on the Dimension</h3>
                                <p className="dimension-text">One step closer to complete distributed consensus.</p>
                            </div>
                        </div>
                    </div>
                );

            case 'tokenomics':
                return (
                    <div className="docs-section">
                        <h1>Token Economics</h1>
                        
                        <div className="tokenomics-header">
                            <div className="token-badge">
                                <span className="token-symbol">$SSS10I</span>
                                <span className="token-desc">Liquid Tokenized NFT • Farming Reward</span>
                            </div>
                            <div className="token-badge">
                                <span className="token-symbol">$wSSSi</span>
                                <span className="token-desc">Wrapped SSS10i • NFT Form</span>
                            </div>
                        </div>

                        <h2>Fee Structure</h2>
                        <div className="fee-table">
                            <div className="fee-row">
                                <span className="fee-label">Protocol Fees</span>
                                <span className="fee-value green">None</span>
                                <span className="fee-note">No deposit fees. No extra swap fees. Full emissions belong to LP providers.</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">Trading Fees</span>
                                <span className="fee-value green">None</span>
                                <span className="fee-note">No taxes on $SSS10i liquid tokens.</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">NFT Royalties</span>
                                <span className="fee-value">5%</span>
                                <span className="fee-note">Royalty on sales paid to CARDANO treasury (enforced at marketplace's discretion).</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">Wrap/Unwrap Fee</span>
                                <span className="fee-value burn">50,000 CARDANO</span>
                                <span className="fee-note">Burned permanently. Encourages re-rolling for desired art & arbitrage.</span>
                            </div>
                        </div>

                        <h2>Initial Liquidity</h2>
                        <div className="liquidity-grid">
                            <div className="liquidity-item">
                                <span className="liq-pair">SSS10i / CARDANO</span>
                                <span className="liq-amount">5 SSS10i + 20M CARDANO</span>
                            </div>
                            <div className="liquidity-item">
                                <span className="liq-pair">SSS10i / USDC</span>
                                <span className="liq-amount">2.5 SSS10i + 200 USDC</span>
                            </div>
                        </div>

                        <h2>Launch Metrics</h2>
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <span className="metric-value">1</span>
                                <span className="metric-label">Treasury Reserve</span>
                                <span className="metric-note">For CH to redeem as a forever PFP</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-value">$6,160</span>
                                <span className="metric-label">Starting Market Cap</span>
                                <span className="metric-note">Liquid NFT market cap at launch</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-value">~$80</span>
                                <span className="metric-label">Starting Token Price</span>
                                <span className="metric-note">Per full liquid token (or more with price impact)</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-value">TBD</span>
                                <span className="metric-label">Starting NFT Price</span>
                                <span className="metric-note">Market decides</span>
                            </div>
                        </div>

                        <div className="info-callout">
                            <span className="callout-icon">💡</span>
                            <p>Although this farm was designed with sustainability and creating value in mind, there will obviously be a period of inflation beyond the small LP pool backing for the initial tokens. As liquidity grows and rewards are earned—<strong>you are encouraged NOT to rush to buy your tokens via DEX and instead earn them through farming.</strong> Expect high volatility as new $SSS10i are earned, sold, bought, etc.</p>
                        </div>
                    </div>
                );

            case 'farming-pairs':
                return (
                    <div className="docs-section">
                        <h1>Farming Pairs</h1>
                        <p className="section-intro">Initial pairs available for yield farming at launch.</p>
                        
                        <div className="pairs-grid">
                            <div className="pair-card">
                                <div className="pair-tokens">
                                    <img src="/logos/CARDANO.png" alt="CARDANO" className="token-icon-img" />
                                    <span className="pair-slash">/</span>
                                    <img src="/logos/Solana.png" alt="SOL" className="token-icon-img" />
                                </div>
                                <h3>CARDANO / SOL</h3>
                                <span className="pair-status active">Active</span>
                            </div>
                            <div className="pair-card">
                                <div className="pair-tokens">
                                    <img src="/logos/CARDANO.png" alt="CARDANO" className="token-icon-img" />
                                    <span className="pair-slash">/</span>
                                    <img src="/logos/USDC.png" alt="USDC" className="token-icon-img" />
                                </div>
                                <h3>CARDANO / USDC</h3>
                                <span className="pair-status active">Active</span>
                            </div>
                            <div className="pair-card">
                                <div className="pair-tokens">
                                    <img src="/logos/sss10i.jpg" alt="SSS10i" className="token-icon-img" />
                                    <span className="pair-slash">/</span>
                                    <img src="/logos/CARDANO.png" alt="CARDANO" className="token-icon-img" />
                                </div>
                                <h3>SSS10i / CARDANO</h3>
                                <span className="pair-status active">Active</span>
                            </div>
                            <div className="pair-card">
                                <div className="pair-tokens">
                                    <img src="/logos/sss10i.jpg" alt="SSS10i" className="token-icon-img" />
                                    <span className="pair-slash">/</span>
                                    <img src="/logos/USDC.png" alt="USDC" className="token-icon-img" />
                                </div>
                                <h3>SSS10i / USDC</h3>
                                <span className="pair-status active">Active</span>
                            </div>
                            <div className="pair-card">
                                <div className="pair-tokens">
                                    <img src="/logos/HarryPepe.jpg" alt="HARRY" className="token-icon-img" />
                                    <span className="pair-slash">/</span>
                                    <img src="/logos/CARDANO.png" alt="CARDANO" className="token-icon-img" />
                                </div>
                                <h3>HARRY / CARDANO</h3>
                                <span className="pair-status active">Active</span>
                            </div>
                            <div className="pair-card">
                                <div className="pair-tokens">
                                    <img src="/logos/bulk.jpg" alt="BULK" className="token-icon-img" />
                                    <span className="pair-slash">/</span>
                                    <img src="/logos/CARDANO.png" alt="CARDANO" className="token-icon-img" />
                                </div>
                                <h3>BULK / CARDANO</h3>
                                <span className="pair-status active">Active</span>
                            </div>
                        </div>

                        <h2>Partner Farms</h2>
                        <div className="partner-info">
                            <p>Farming pairs will be added/removed at the HyperCluster's discretion.</p>
                            <h3>Want a Partner Farm?</h3>
                            <p>Should any meme/cult/community wish to have a partner farm, you are encouraged to:</p>
                            <ol>
                                <li>Seed a Raydium Standard AMM liquidity pool (1% fee) with <strong>$500 USD</strong> worth of your token + <strong>$500 USD</strong> worth of $CARDANO as the quote token</li>
                                <li>Let this pool marinate for <strong>7 days</strong></li>
                                <li>Contact CH to discuss partnership</li>
                            </ol>
                            <p className="partner-note">This demonstrates alignment with the HyperCluster ecosystem.</p>
                        </div>
                    </div>
                );

            case 'farming-guide':
                return (
                    <div className="docs-section">
                        <h1>Beginner's Farming Guide</h1>
                        <p className="section-intro">Everything you need to know to start earning $SSS10i rewards.</p>

                        <div className="info-callout warning">
                            <span className="callout-icon">⚠️</span>
                            <p>Liquidity farming is a <strong>2-step process</strong>. You must either manually add to the pool via Raydium's interface, then deposit your LP tokens into the farm—OR utilize the Zap feature.</p>
                        </div>

                        <h2>What is Zap?</h2>
                        <div className="example-box">
                            <h4>Example Scenario</h4>
                            <p>You have <strong>$50 USDC</strong>. You choose to Zap into the SSS10i/CARDANO pool.</p>
                            <div className="zap-flow">
                                <div className="zap-step">Your $50 USDC</div>
                                <div className="zap-arrow">→</div>
                                <div className="zap-step">$25 → SSS10i<br/>$25 → CARDANO</div>
                                <div className="zap-arrow">→</div>
                                <div className="zap-step">Link to Add Liquidity</div>
                                <div className="zap-arrow">→</div>
                                <div className="zap-step">Deposit LP & Earn!</div>
                            </div>
                        </div>

                        <h2>What Does Withdraw Mean?</h2>
                        <p>When you withdraw your LP tokens from the Facility Sieben farm, you are <strong>not</strong> unpairing your assets—you are simply removing them from the farm.</p>
                        <p>Just like depositing, withdrawal is a 2-step process requiring you to navigate to Raydium's interface and remove from the pool there before receiving your 2 assets back.</p>

                        <h2>The Full Beginner Loop</h2>
                        <div className="guide-steps">
                            <div className="guide-step">
                                <div className="step-num">1</div>
                                <div className="step-content">
                                    <h4>Select Zap Method</h4>
                                    <p>Navigate to the "Farms" tab, click "Zap" on your chosen pool, and select either USDC or SOL as your input token.</p>
                                </div>
                            </div>
                            
                            <div className="guide-step">
                                <div className="step-num">2</div>
                                <div className="step-content">
                                    <h4>Execute Swaps</h4>
                                    <p>Enter your amount and click "Execute Zap Swaps". The protocol will automatically calculate the optimal ratio and swap your single token into both tokens needed for the pool.</p>
                                </div>
                            </div>

                            <div className="guide-step">
                                <div className="step-num">3</div>
                                <div className="step-content">
                                    <h4>Add Liquidity & Deposit</h4>
                                    <p>Follow the link to Raydium to add your liquidity, then return to the dApp and click "Deposit LP Tokens" to start earning.</p>
                                </div>
                            </div>
                            <div className="guide-step">
                                <div className="step-num">4</div>
                                <div className="step-content">
                                    <h4>Withdraw from Farm</h4>
                                    <p>When ready, click withdraw via Facility Sieben. Receive your Raydium LP tokens back.</p>
                                </div>
                            </div>
                            <div className="guide-step">
                                <div className="step-num">5</div>
                                <div className="step-content">
                                    <h4>Remove Liquidity</h4>
                                    <p>Navigate to Raydium's website and withdraw your LP tokens from the pool. You will receive back your underlying assets at their current market value.</p>
                                </div>
                            </div>
                            <div className="guide-step">
                                <div className="step-num">6</div>
                                <div className="step-content">
                                    <h4>Enjoy Your Gains</h4>
                                    <p>Swap to USDC if needed. You're ready for a hot date with an ABG. 😎</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'strategies':
                return (
                    <div className="docs-section">
                        <h1>Farming Strategies</h1>
                        <p className="section-intro">Different approaches to maximize your farming experience based on your risk tolerance.</p>

                        <div className="info-callout">
                            <span className="callout-icon">💡</span>
                            <p><strong>Disclaimer:</strong> There is no right or wrong way to participate in Facility Sieben. These are just ideas to help you get started. Your strategy should align with your own goals, risk tolerance, and market outlook. Do your own research and never invest more than you can afford to lose.</p>
                        </div>

                        <h2>High-Risk Strategies</h2>
                        <p>For those who want maximum exposure to potential gains and don't mind volatility.</p>

                        <div className="strategy-card">
                            <h3>🔥 SSS10i Pair Farming</h3>
                            <p><strong>Pools:</strong> SSS10i/CARDANO, SSS10i/USDC</p>
                            <div className="strategy-details">
                                <h4>How It Works</h4>
                                <p>Pair your assets with SSS10i in high-emission pools (25-30% allocation). You're exposed to both the farming rewards AND the price action of SSS10i itself.</p>
                                
                                <h4>Risks</h4>
                                <ul>
                                    <li><strong>Inflation Pressure:</strong> SSS10i has daily emissions that increase circulating supply, which can create downward price pressure if demand doesn't keep up</li>
                                    <li><strong>Impermanent Loss:</strong> If SSS10i price moves significantly vs your paired asset, you'll experience IL when you withdraw</li>
                                    <li><strong>Double Volatility:</strong> Both sides of the pair can be volatile (especially SSS10i/CARDANO)</li>
                                </ul>

                                <h4>Benefits</h4>
                                <ul>
                                    <li><strong>Highest Emissions:</strong> These pools receive 25-30% of total daily rewards</li>
                                    <li><strong>Compounding Potential:</strong> Harvest SSS10i rewards and add them back to your position for exponential growth</li>
                                    <li><strong>Price Upside:</strong> If SSS10i appreciates, you benefit from both farming rewards AND capital gains</li>
                                    <li><strong>Volume Exposure:</strong> High trading volume means more fee revenue for LPs</li>
                                </ul>

                                <h4>Who This Is For</h4>
                                <p>Believers in the SSS10i ecosystem who want maximum exposure and are comfortable with price swings. Best for those who plan to hold long-term and compound aggressively.</p>
                            </div>
                        </div>

                        <div className="strategy-card">
                            <h3>⚡ Volatile Pair Speculation</h3>
                            <p><strong>Pools:</strong> HARRY/CARDANO, BULK/CARDANO</p>
                            <div className="strategy-details">
                                <h4>How It Works</h4>
                                <p>Farm meme token pairs with lower emissions (5% each) but potentially explosive price action. You're betting on community momentum and viral growth.</p>
                                
                                <h4>Risks</h4>
                                <ul>
                                    <li><strong>Meme Volatility:</strong> These tokens can swing 50%+ in a day</li>
                                    <li><strong>Lower Emissions:</strong> Only 5% allocation means fewer SSS10i rewards</li>
                                    <li><strong>Liquidity Risk:</strong> Smaller pools can have wider spreads and slippage</li>
                                </ul>

                                <h4>Benefits</h4>
                                <ul>
                                    <li><strong>Moonshot Potential:</strong> If the meme catches fire, your LP value can skyrocket</li>
                                    <li><strong>Community Alignment:</strong> Supporting partner projects strengthens the ecosystem</li>
                                    <li><strong>Diversification:</strong> Spread risk across different narratives</li>
                                </ul>

                                <h4>Who This Is For</h4>
                                <p>Degen traders who enjoy riding meme waves and don't mind the possibility of getting rekt. Best for small position sizes you're willing to lose.</p>
                            </div>
                        </div>

                        <h2>Low-Risk Strategies</h2>
                        <p>For those who prefer stability and predictable returns.</p>

                        <div className="strategy-card">
                            <h3>🛡️ Stable Pair Farming</h3>
                            <p><strong>Pools:</strong> CARDANO/USDC</p>
                            <div className="strategy-details">
                                <h4>How It Works</h4>
                                <p>Farm the CARDANO/USDC pool which pairs a relatively stable meme token with a USD stablecoin. Lower volatility, steadier returns.</p>
                                
                                <h4>Risks</h4>
                                <ul>
                                    <li><strong>CARDANO Volatility:</strong> While more stable than other memes, CARDANO can still move 10-20%</li>
                                    <li><strong>Moderate Emissions:</strong> 20% allocation is solid but not the highest</li>
                                    <li><strong>Opportunity Cost:</strong> You might miss bigger gains in riskier pools</li>
                                </ul>

                                <h4>Benefits</h4>
                                <ul>
                                    <li><strong>Reduced IL:</strong> USDC side stays stable, limiting impermanent loss</li>
                                    <li><strong>Predictable Rewards:</strong> 20% emission allocation provides consistent SSS10i income</li>
                                    <li><strong>Easy Exit:</strong> USDC provides instant liquidity if you need to cash out</li>
                                    <li><strong>Sleep Well:</strong> Less stress watching charts</li>
                                </ul>

                                <h4>Who This Is For</h4>
                                <p>Conservative farmers who want exposure to SSS10i rewards without extreme volatility. Great for larger positions where capital preservation matters.</p>
                            </div>
                        </div>

                        <div className="strategy-card">
                            <h3>🔄 Harvest & Rotate Strategy</h3>
                            <p><strong>Pools:</strong> Any stable pool → Compound into higher-yield pools</p>
                            <div className="strategy-details">
                                <h4>How It Works</h4>
                                <p>Start in a stable pool like CARDANO/USDC. Regularly harvest your SSS10i rewards and use them to enter higher-emission pools. This lets you "play with house money" on riskier positions.</p>
                                
                                <h4>Example Flow</h4>
                                <ol>
                                    <li>Farm CARDANO/USDC with your initial capital</li>
                                    <li>Harvest SSS10i rewards weekly</li>
                                    <li>Pair harvested SSS10i with CARDANO or USDC</li>
                                    <li>Enter SSS10i/CARDANO or SSS10i/USDC pool with rewards</li>
                                    <li>Keep your original stable position intact</li>
                                </ol>

                                <h4>Benefits</h4>
                                <ul>
                                    <li><strong>Risk Isolation:</strong> Your principal stays in a stable pool</li>
                                    <li><strong>Upside Capture:</strong> Rewards go into high-growth pools</li>
                                    <li><strong>Psychological Edge:</strong> Easier to stomach volatility when it's profits, not principal</li>
                                    <li><strong>Flexible:</strong> Adjust your rotation based on market conditions</li>
                                </ul>

                                <h4>Who This Is For</h4>
                                <p>Strategic farmers who want both stability and growth. Best for those who enjoy active management and optimization.</p>
                            </div>
                        </div>

                        <h2>Advanced Tips</h2>
                        <div className="tips-grid">
                            <div className="tip-box">
                                <h4>📊 Monitor Emissions</h4>
                                <p>Check the Stats page to see daily emission rates and APRs. Pool allocations can change, so stay informed.</p>
                            </div>
                            <div className="tip-box">
                                <h4>⏰ Harvest Timing</h4>
                                <p>Gas fees on Solana are low, so you can harvest frequently. Consider daily harvests during high-volatility periods to lock in gains.</p>
                            </div>
                            <div className="tip-box">
                                <h4>🔥 CARDANO Burns</h4>
                                <p>Every wrap/unwrap burns 50,000 CARDANO. Monitor burn stats to gauge ecosystem activity and potential CARDANO price support.</p>
                            </div>
                            <div className="tip-box">
                                <h4>💎 NFT Arbitrage</h4>
                                <p>If you're farming SSS10i, consider wrapping some into NFTs when floor prices are favorable. This can be a hedge against inflation.</p>
                            </div>
                        </div>

                        <div className="info-callout warning">
                            <span className="callout-icon">⚠️</span>
                            <p><strong>Final Reminder:</strong> All farming involves risk. Impermanent loss, smart contract risk, and market volatility are real. Start small, learn the mechanics, and scale up as you gain confidence. The best strategy is the one you understand and can stick with through market cycles.</p>
                        </div>
                    </div>
                );

            case 'wrap-unwrap':
                return (
                    <div className="docs-section">
                        <h1>Wrap & Unwrap</h1>
                        <p className="section-intro">Convert between liquid $SSS10i tokens and rare NFT artifacts.</p>

                        <div className="wrap-cards">
                            <div className="wrap-card">
                                <div className="wrap-header">
                                    <span className="wrap-icon">🎁</span>
                                    <h3>Wrap to NFT</h3>
                                </div>
                                <div className="wrap-body">
                                    <p>Convert <strong>1.0 $SSS10i</strong> into a random NFT artifact from the treasury.</p>
                                    <div className="wrap-cost">
                                        <span className="cost-label">Cost:</span>
                                        <span className="cost-value">50,000 CARDANO (burned)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="wrap-card">
                                <div className="wrap-header">
                                    <span className="wrap-icon">💧</span>
                                    <h3>Unwrap to Tokens</h3>
                                </div>
                                <div className="wrap-body">
                                    <p>Convert <strong>1 NFT</strong> back into <strong>1.0 $SSS10i</strong> liquid tokens.</p>
                                    <div className="wrap-cost">
                                        <span className="cost-label">Cost:</span>
                                        <span className="cost-value">50,000 CARDANO (burned)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="info-callout">
                            <span className="callout-icon">🔥</span>
                            <p>The 50,000 CARDANO fee is <strong>permanently burned</strong>—not sent to any wallet. You are encouraged to re-roll your NFTs to get a piece of art that resonates with you, or arbitrage as much as you like and burn $CARDANO in the process.</p>
                        </div>
                    </div>
                );

            case 'emergency':
                return (
                    <div className="docs-section">
                        <h1>Emergency Withdraw</h1>
                        
                        <div className="emergency-hero">
                            <span className="emergency-icon">🚨</span>
                            <h2>On-Chain Emergency Recovery</h2>
                            <p>Should the frontend ever go down, Emergency Withdraw of LP tokens can be completed anytime on-chain using <a href="https://beta.solpg.io" target="_blank" rel="noopener noreferrer">Solana Playground</a>.</p>
                        </div>

                        <div className="info-callout warning">
                            <span className="callout-icon">⚠️</span>
                            <p><strong>Important:</strong> Executing an emergency withdrawal will successfully return your underlying LP tokens back to your wallet. However, it will <strong>permanently forfeit and wipe out any pending, unharvested rewards</strong>. Those rewards will be lost forever.</p>
                        </div>

                        <div className="info-callout">
                            <span className="callout-icon">💡</span>
                            <p><strong>Why Solana Playground?</strong> Unlike EVM blockchains (Ethereum, BSC) where block explorers have a "Write Contract" tab, Solana explorers like SolScan do not offer this feature. On Solana, you interact with programs by building and signing transactions. <a href="https://beta.solpg.io" target="_blank" rel="noopener noreferrer">Solana Playground (SolPG)</a> is a free, browser-based tool that lets you do exactly this — no installation required.</p>
                        </div>

                        <h2>Step-by-Step Emergency Recovery</h2>
                        
                        <div className="guide-steps">
                            <div className="guide-step">
                                <div className="step-num">1</div>
                                <div className="step-content">
                                    <h4>Find Your Deposit Transaction on SolScan</h4>
                                    <p>Go to <a href="https://solscan.io/" target="_blank" rel="noopener noreferrer">solscan.io</a> and paste your wallet address in the search bar. Navigate to your <strong>Transaction History</strong> and find the transaction where you originally deposited LP tokens into Facility Sieben. Click into that transaction.</p>
                                    <p>In the <strong>Instruction Details</strong> section, look for the <code>DepositLp</code> instruction. You will see a list of accounts. <strong>Write down</strong> the following addresses from this transaction — you will need them all:</p>
                                    <ul>
                                        <li><strong>Pool</strong> — the Pool account (or match it from the reference table below)</li>
                                        <li><strong>User Info</strong> — your unique stake PDA (this is derived from your wallet + pool)</li>
                                        <li><strong>User Lp Account</strong> — your wallet's Associated Token Account for this LP mint</li>
                                        <li><strong>Accepted Lp Mint</strong> — the LP token mint address</li>
                                        <li><strong>Vault Lp Account</strong> — the program's vault that holds LP tokens</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div className="guide-step">
                                <div className="step-num">2</div>
                                <div className="step-content">
                                    <h4>Open Solana Playground</h4>
                                    <p>Go to <a href="https://beta.solpg.io" target="_blank" rel="noopener noreferrer">beta.solpg.io</a>. Click the <strong>wallet icon</strong> in the bottom-left to connect your Phantom (or compatible) wallet. Make sure you are connected to <strong>Mainnet</strong> (check the cluster setting in the bottom bar).</p>
                                </div>
                            </div>

                            <div className="guide-step">
                                <div className="step-num">3</div>
                                <div className="step-content">
                                    <h4>Import the Program IDL</h4>
                                    <p>In the left sidebar, click on the <strong>wrench icon (🔧 Test)</strong> tab. At the top, you will see a field for the Program ID. Enter the Facility Sieben Program ID:</p>
                                    <code className="program-id" style={{display: 'block', margin: '10px 0', padding: '8px', fontSize: '0.85em'}}>68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF</code>
                                    <p>Click <strong>Fetch IDL</strong> (or import the IDL manually). Once loaded, you will see a list of all available instructions, including <code>emergencyWithdraw</code>.</p>
                                </div>
                            </div>

                            <div className="guide-step">
                                <div className="step-num">4</div>
                                <div className="step-content">
                                    <h4>Fill in the 7 Required Accounts</h4>
                                    <p>Click on the <code>emergencyWithdraw</code> instruction. You will see fields for 7 accounts. Fill them in using the addresses from your deposit transaction (Step 1):</p>
                                    <div className="fee-table" style={{margin: '10px 0'}}>
                                        <div className="fee-row">
                                            <span className="fee-label"><strong>1. pool</strong></span>
                                            <span className="fee-note">The Pool address for the farm you deposited into. See the reference table below, or copy from your deposit transaction.</span>
                                        </div>
                                        <div className="fee-row">
                                            <span className="fee-label"><strong>2. userInfo</strong></span>
                                            <span className="fee-note">Your unique "User Info" PDA. Found in your deposit transaction under the <code>DepositLp</code> instruction as the account labeled "User Info" or the 3rd account in the list.</span>
                                        </div>
                                        <div className="fee-row">
                                            <span className="fee-label"><strong>3. userLpAccount</strong></span>
                                            <span className="fee-note">Your wallet's Associated Token Account (ATA) for the LP token. This is where your LP tokens will be returned. Found in your deposit tx as "User Lp Account".</span>
                                        </div>
                                        <div className="fee-row">
                                            <span className="fee-label"><strong>4. acceptedLpMint</strong></span>
                                            <span className="fee-note">The LP token mint address. See the reference table below, or copy from your deposit transaction under "Accepted Lp Mint".</span>
                                        </div>
                                        <div className="fee-row">
                                            <span className="fee-label"><strong>5. vaultLpAccount</strong></span>
                                            <span className="fee-note">The program's vault holding LP tokens. Found in your deposit transaction as "Vault Lp Account".</span>
                                        </div>
                                        <div className="fee-row">
                                            <span className="fee-label"><strong>6. user</strong></span>
                                            <span className="fee-note">Your connected wallet address. SolPG will auto-fill this when you select "My address" or "Wallet".</span>
                                        </div>
                                        <div className="fee-row">
                                            <span className="fee-label"><strong>7. tokenProgram</strong></span>
                                            <span className="fee-note">The standard SPL Token Program. SolPG will typically auto-fill this. If not, use: <code>TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA</code></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="guide-step">
                                <div className="step-num">5</div>
                                <div className="step-content">
                                    <h4>Execute & Sign</h4>
                                    <p>Double-check all 7 account addresses, then click <strong>"Test"</strong> (or "Send Transaction") in Solana Playground. Your wallet will prompt you to approve the transaction. Sign it, and your LP tokens will be returned to your wallet immediately.</p>
                                    <p>You can verify success by checking your wallet balance or viewing the transaction on <a href="https://solscan.io/" target="_blank" rel="noopener noreferrer">SolScan</a>.</p>
                                </div>
                            </div>
                        </div>

                        <h2>Pool Address Reference</h2>
                        <p>Use this table to identify the correct <strong>Pool</strong> and <strong>LP Mint</strong> addresses for the farm you deposited into:</p>
                        
                        <div className="fee-table" style={{margin: '15px 0'}}>
                            <div className="fee-row" style={{fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.2)'}}>
                                <span className="fee-label">Farm</span>
                                <span className="fee-value" style={{flex: 2}}>Pool Address</span>
                                <span className="fee-note">LP Mint</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">CARDANO/SOL</span>
                                <span className="fee-value" style={{flex: 2, fontSize: '0.7em', wordBreak: 'break-all'}}>GNwnKFx2v6zoPRtnv7SxN3mhAKfy4c1dmRZA1WkfkMFp</span>
                                <span className="fee-note" style={{fontSize: '0.7em', wordBreak: 'break-all'}}>3an9TS1g2dEYkdk1ShiYkzYEyi7P6SR5aveCYTKnmHGe</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">CARDANO/USDC</span>
                                <span className="fee-value" style={{flex: 2, fontSize: '0.7em', wordBreak: 'break-all'}}>6k7fotdNejY4v2Y6LRRELPPBJPdr9WDQkt5PdSCQWnmP</span>
                                <span className="fee-note" style={{fontSize: '0.7em', wordBreak: 'break-all'}}>C3Lsu6S8H4DwX8qRhoi8jdjPmfjEAVTARtWGCtG3vQnC</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">SSS10I/CARDANO</span>
                                <span className="fee-value" style={{flex: 2, fontSize: '0.7em', wordBreak: 'break-all'}}>7x7vqpNoUeGZnK1nnvkRaMoiEuAbyfvuAajuBtFPKjuq</span>
                                <span className="fee-note" style={{fontSize: '0.7em', wordBreak: 'break-all'}}>6C9FsWhLKQqdkuASDB7ZFVSE8n4phQJKr49zFUuSkmUW</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">SSS10I/USDC</span>
                                <span className="fee-value" style={{flex: 2, fontSize: '0.7em', wordBreak: 'break-all'}}>BdsRqJg5aA9H1aetXgniVQTh4SFpkzYcxSQCgkTa8FRK</span>
                                <span className="fee-note" style={{fontSize: '0.7em', wordBreak: 'break-all'}}>HNXgfh2PzRHMuPVGz7qyeTF9LunRvpg4P9cw5veMU8wg</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">HARRY/CARDANO</span>
                                <span className="fee-value" style={{flex: 2, fontSize: '0.7em', wordBreak: 'break-all'}}>ADEyjn3apNiUJ5t5rjEGaysuiX7APu1ihbfkrG6c3PCk</span>
                                <span className="fee-note" style={{fontSize: '0.7em', wordBreak: 'break-all'}}>46vpcjrqZ7aPpAwzQkXHyc2ihoWMf3TYKarLbaA7mZTD</span>
                            </div>
                            <div className="fee-row">
                                <span className="fee-label">BULK/CARDANO</span>
                                <span className="fee-value" style={{flex: 2, fontSize: '0.7em', wordBreak: 'break-all'}}>7mGYx1maeJNrBoB9KKHuf8VDLF3yfWJQAQVyWQXHsvEs</span>
                                <span className="fee-note" style={{fontSize: '0.7em', wordBreak: 'break-all'}}>ByZeE5GPEX1HdqLH4DDUvR665SmQhkbtjEdQkZw4RCmd</span>
                            </div>
                        </div>

                        <div className="contract-info">
                            <h3>Program ID</h3>
                            <code className="program-id">68BXyaV2EfZxMGCo24uDnMGze4HrUozLDomvfS8CrjzF</code>
                        </div>

                        <div className="info-callout">
                            <span className="callout-icon">🛟</span>
                            <p><strong>Need help?</strong> If you are having difficulty locating any of these addresses, look for <em>any</em> past transaction with the Facility Sieben program (<code>68BXya...CrjzF</code>) in your wallet history on SolScan. All the account addresses you need are listed inside the instruction details of your deposit transaction.</p>
                        </div>
                    </div>
                );

            case 'transparency':
                return (
                    <div className="docs-section">
                        <h1>Transparency</h1>
                        <p className="section-intro">Full disclosure of administrative controls and protocol governance.</p>

                        <div className="transparency-grid">
                            <div className="transparency-card safe" style={{ gridColumn: '1 / -1' }}>
                                <h3>Current Treasury Information</h3>
                                <p style={{ marginBottom: '15px', color: '#a3a3a3' }}>Real-time on-chain verification of all protocol treasuries.</p>
                                
                                <div className="fee-table" style={{ margin: '0' }}>
                                    <div className="fee-row header-row" style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                                        <span className="fee-label" style={{flex: 2, paddingLeft: '0'}}>Treasury Account</span>
                                        <span className="fee-value" style={{flex: 1, textAlign: 'right', paddingRight: '20px'}}>Liquid $SSS10i</span>
                                        <span className="fee-note" style={{flex: 1, textAlign: 'right'}}>wSSS10i (NFTs)</span>
                                    </div>
                                    
                                    {fetchingTreasury && treasuryBalances.length === 0 ? (
                                        <div className="fee-row">
                                            <span style={{flex: 1, textAlign: 'center', opacity: 0.5}} className="loading-pulse">SYNCING WITH CHAIN...</span>
                                        </div>
                                    ) : treasuryBalances.map((tb, idx) => (
                                        <div className="fee-row" key={idx} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                                            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', paddingLeft: '0' }}>
                                                <span className="fee-label" style={{ paddingLeft: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {tb.name}
                                                    {tb.isGlobal && <span style={{ fontSize: '0.65em', background: 'rgba(0,255,128,0.1)', color: '#00ff80', padding: '2px 6px', borderRadius: '4px', letterSpacing: '1px' }}>GLOBAL</span>}
                                                </span>
                                                <a href={`https://solscan.io/account/${tb.address}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75em', color: '#a3a3a3', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', width: 'fit-content' }}>
                                                    <span style={{ fontFamily: 'monospace' }}>{tb.address.slice(0, 4)}...{tb.address.slice(-4)}</span>
                                                    <span style={{ fontSize: '0.9em' }}>↗</span>
                                                </a>
                                            </div>
                                            <span className="fee-value" style={{flex: 1, textAlign: 'right', paddingRight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '1.1em'}}>{tb.sss10i > 0 ? tb.sss10i.toFixed(4) : '0.0000'}</span>
                                            <span className="fee-note" style={{flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end'}}>
                                                {tb.nfts !== null ? (
                                                    <span style={{ color: '#00ff80', fontWeight: 'bold', fontSize: '1.1em' }}>{tb.nfts}</span>
                                                ) : (
                                                    <span style={{ opacity: 0.3 }}>—</span>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="transparency-card">
                                <h3>Pool & Emission Control</h3>
                                <p>As CH, I maintain full control over pools and emissions. I can <strong>not</strong> increase the supply of $SSS10i, but I can increase/decrease/remove emissions from pools, and add new ones.</p>
                                <p>As liquidity deepens and additional projects align with $CARDANO, emissions will change and be communicated clearly.</p>
                            </div>
                            
                            <div className="transparency-card highlight">
                                <h3>Your Rewards Are Safe</h3>
                                <p>Whether certain pools end or have their emissions reduced—<strong>the rewards you earn will always be available for you to claim.</strong></p>
                                <p className="code-note">This is hard coded into the program. You cannot lose rewards just because a pool ended while you were away on a 77-day vacation with your best ABG.</p>
                            </div>
                            
                            <div className="transparency-card">
                                <h3>Initial Liquidity</h3>
                                <p>As CH, I maintain full control of the initial liquidity seeding for $SSS10i. <strong>Unlocked. Unburned.</strong></p>
                                <p>Why? When $CARDANO does what I know that it will, having flexibility to reallocate and reprovision liquidity as/when needed will be extremely valuable for future success.</p>
                            </div>
                            
                            <div className="transparency-card safe">
                                <h3>Your Deposits Are Yours</h3>
                                <p>As CH, I do <strong>NOT</strong> have access or control over your deposits into the farm. I cannot recover your LP if you lose your wallet keys.</p>
                            </div>
                            
                            <div className="transparency-card">
                                <h3>Upgrade Authority</h3>
                                <p>As CH, I maintain upgrade authority over the program to implement last-minute new features and/or squash any bugs/issues that may arise during the early phases of launch.</p>
                                <p><strong>This will be revoked at a later time.</strong></p>
                            </div>
                            <div className="transparency-card safe">
                                <h3>Open Source Code</h3>
                                <p>The SSS10i DeFi Protocol is completely open source. You can view, audit, and contribute to the client code directly on GitHub.</p>
                                <a href="https://github.com/enjooyer/sss10idefi" target="_blank" rel="noopener noreferrer" className="docs-external-link">
                                    View Repository ↗
                                </a>
                            </div>
                        </div>

                        <div className="user-responsibility">
                            <h3>Your Responsibilities</h3>
                            <ol>
                                <li><strong>Ensure proper wallet security</strong> — Use hardware wallets when possible, never share seed phrases.</li>
                                <li><strong>Verify all links</strong> — DO NOT GET PHISHED. Always double-check URLs.</li>
                            </ol>
                        </div>
                    </div>
                );

            case 'disclaimer':
                return (
                    <div className="docs-section">
                        <h1>Disclaimer & Risks</h1>
                        
                        <div className="disclaimer-box">
                            <h2>⚠️ Important Notice</h2>
                            <p>With any DeFi system, inherent risks are present. I have done, and will continue to do my best to verify and maintain the security of my DeFi protocol during its lifetime, and I will continue to operate with elite, HyperCluster-enlightened transparency and ethics.</p>
                        </div>

                        <h2>Known Risks</h2>
                        <div className="risk-list">
                            <div className="risk-item">
                                <span className="risk-icon">📉</span>
                                <div className="risk-content">
                                    <h3>Impermanent Loss</h3>
                                    <p>Providing liquidity exposes you to impermanent loss when token prices diverge. This is inherent to all AMM-based liquidity provision.</p>
                                </div>
                            </div>
                            <div className="risk-item">
                                <span className="risk-icon">🔓</span>
                                <div className="risk-content">
                                    <h3>Smart Contract Risk</h3>
                                    <p>While extensively tested, smart contracts may contain undiscovered vulnerabilities. Never deposit more than you can afford to lose.</p>
                                </div>
                            </div>
                            <div className="risk-item">
                                <span className="risk-icon">📊</span>
                                <div className="risk-content">
                                    <h3>Market Volatility</h3>
                                    <p>Cryptocurrency markets are highly volatile. Token prices can fluctuate dramatically in short periods.</p>
                                </div>
                            </div>
                        </div>

                        <div className="final-note">
                            <p>DeFi is great. And the Facility Sieben DeFi protocol brings the planet one step closer to running on CARDANO.</p>
                            <p className="highlight">But always remember: the safest and most secure way to experience the raw power and glory of the HyperCluster will always be to simply hold $CARDANO and embrace proof-of-work.</p>
                        </div>

                        <div className="blessing">
                            <p>May the HyperCluster bless you, and your crops.</p>
                            <span className="signature">— CH</span>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="docs-container">
            {/* Mobile Header */}
            <div className="docs-mobile-header">
                <button 
                    className={`docs-menu-toggle ${sidebarOpen ? 'open' : ''}`}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                <span className="docs-mobile-title">Documentation</span>
            </div>

            {/* Sidebar */}
            <aside className={`docs-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-icon">❄️</span>
                        <div className="logo-text">
                            <span className="logo-title">Facility Sieben</span>
                            <span className="logo-subtitle">Documentation</span>
                        </div>
                    </div>
                </div>
                
                <nav className="sidebar-nav">
                    {navSections.map((section) => (
                        <div key={section.category} className="nav-category">
                            <span className="category-label">{section.category}</span>
                            <ul className="nav-items">
                                {section.items.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                                            onClick={() => setActiveSection(item.id)}
                                        >
                                            <span className="nav-icon">{item.icon}</span>
                                            <span className="nav-label">{item.label}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <a href="https://magiceden.us/marketplace/sss10i" target="_blank" rel="noopener noreferrer" className="sidebar-link">
                        <span>🖼️</span> NFT Marketplace
                    </a>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {sidebarOpen && <div className="docs-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* Main Content */}
            <main className="docs-main">
                <div className="docs-content">
                    {renderContent()}
                </div>
                
                <footer className="docs-footer">
                    <p>© 2026 Facility Sieben • Built on Solana • Powered by the HyperCluster</p>
                </footer>
            </main>
        </div>
    );
};

export default DocsTerminal;
