import { useState, useEffect, Suspense, lazy } from 'react'
import './App.css'
import PoolCard from './components/PoolCard'
import WrapTerminal from './components/WrapTerminal';
import HeaderTicker from './components/HeaderTicker';
import { ToastProvider } from './components/ToastProvider';
import { WalletContextProvider } from './components/WalletContextProvider';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { usePoolConfigs } from './utils/mockApi';
import { GlobalPoolProvider } from './contexts/GlobalPoolContext';

// Lazy-loaded page components — only bundled when visited
const DocsTerminal = lazy(() => import('./components/DocsTerminal'));
const DexPage = lazy(() => import('./components/DexPage'));
const StatsPage = lazy(() => import('./components/StatsPage'));
const PortfolioPage = lazy(() => import('./components/PortfolioPage'));

// Minimal loading fallback
const PageLoader = () => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-sub)', letterSpacing: '3px', fontFamily: 'var(--font-body)' }}>
    LOADING MODULE...
  </div>
);

type NavPage = 'pools' | 'wrap' | 'docs' | 'dex' | 'stats' | 'portfolio';

function App() {
  const getInitialPage = (): NavPage => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/dex')) return 'dex';
    if (path.includes('/wrap')) return 'wrap';
    if (path.includes('/docs')) return 'docs';
    if (path.includes('/stats')) return 'stats';
    if (path.includes('/portfolio')) return 'portfolio';
    return 'pools';
  };

  const [activeNav, setActiveNav] = useState<NavPage>(getInitialPage);
    const livePools = usePoolConfigs();

  // Sync URL when nav changes
  useEffect(() => {
    const currentPath = window.location.pathname;
    const newPath = activeNav === 'pools' ? '/' : `/${activeNav}`;
    if (currentPath !== newPath && currentPath !== `${newPath}/`) {
      window.history.pushState({}, '', newPath);
    }
  }, [activeNav]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setActiveNav(getInitialPage());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  const handleNavClick = (page: NavPage) => {
    setActiveNav(page);
  };

  return (
    <WalletContextProvider>
      <GlobalPoolProvider>
        <ToastProvider>
          {/* Background VFX: Antarctica Ice Facility */}
          <div className="bg-animation">
          <div className="ice-shard" style={{ left: '10%', top: '30%', transform: 'scale(1.2)' }}></div>
          <div className="ice-shard" style={{ right: '5%', top: '50%', transform: 'scale(0.8) rotate(15deg)' }}></div>
          <div className="ice-shard" style={{ left: '80%', bottom: '5%', transform: 'scale(1.5) rotate(-10deg)' }}></div>
          <div className="ice-shard" style={{ left: '40%', top: '-5%', transform: 'scale(1.1) rotate(5deg)' }}></div>

          <div className="frost-drip" style={{ left: '20%', height: '80px', animationDelay: '0s' }}></div>
          <div className="frost-drip" style={{ left: '45%', height: '150px', animationDelay: '3s', opacity: 0.4 }}></div>
          <div className="frost-drip" style={{ right: '35%', height: '60px', animationDelay: '5s' }}></div>
          <div className="frost-drip" style={{ right: '15%', height: '120px', animationDelay: '1s', opacity: 0.7 }}></div>

          <div className="glacier-bg"></div>
        </div>

        <div className="app-container">
          <HeaderTicker />

          {/* ═════════════ DESKTOP HEADER ═════════════ */}
          <header className="defi-header">
            <div className="logo-area" onClick={() => handleNavClick('pools')} style={{ cursor: 'pointer' }}>
              <div className="glow-icon">🍼</div>
              <h1>SSS10i <span className="ice-accent">DEFI</span></h1>
            </div>

            {/* Desktop nav (hidden on mobile) */}
            <nav className="header-nav desktop-nav">
              <a href="#" className={activeNav === 'pools' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('pools'); }}>[ FARMS ]</a>
              <a href="#" className={activeNav === 'dex' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('dex'); }}>[ DEX ]</a>
              <a href="#" className={activeNav === 'wrap' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('wrap'); }}>[ WRAP ]</a>
              <a href="#" className={activeNav === 'stats' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('stats'); }}>[ STATS ]</a>
              <a href="#" className={activeNav === 'portfolio' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('portfolio'); }}>[ PORTFOLIO ]</a>
              <a href="#" className={activeNav === 'docs' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('docs'); }}>[ DOCS ]</a>
              <a href="https://magiceden.us/marketplace/sss10i" target="_blank" rel="noopener noreferrer">[ NFT ]</a>
              <a href="https://sss10i.com" target="_blank" rel="noopener noreferrer">[ HOME ]</a>
            </nav>


            <div className="wallet-area">
              <WalletMultiButton className="btn-connect" />
            </div>
          </header>


          <main className={`main-content ${activeNav === 'docs' ? 'main-content--docs' : ''}`}>
            {activeNav !== 'docs' && (
            <div className="hero-section">
              <div className="hero-grid-layer"></div>
              {activeNav === 'pools' ? (
                <>
                  <h2><span className="ice-accent">FACILITY</span> <span className="white-text">SIEBEN</span></h2>
                  <p className="sub-tagline">MINE Liquidity</p>
                </>
              ) : activeNav === 'dex' ? (
                <>
                  <h2><span className="ice-accent">DEX</span></h2>
                  <p className="sub-tagline">Swap Whitelisted Assets</p>
                </>
              ) : activeNav === 'wrap' ? (
                <>
                  <h2><span className="ice-accent">WRAP</span></h2>
                  <p className="sub-tagline">EXTRACT AND SHATTER</p>
                </>
              ) : activeNav === 'portfolio' ? (
                <>
                  <h2><span className="ice-accent">PORTFOLIO</span></h2>
                  <p className="sub-tagline">Personal Holdings</p>
                </>
              ) : (
                <>
                  <h2><span className="ice-accent">STATS</span></h2>
                  <p className="sub-tagline">Resource Analytics</p>
                </>
              )}
            </div>
            )}

            {activeNav === 'pools' ? (
              <>
                <div className="pool-controls">
                  <h2 className="section-title">ACTIVE CONTAINERS</h2>
                </div>

                <div className="pools-grid">
                  {livePools.map(pool => (
                    <PoolCard
                      key={pool.id}
                      title={pool.title}
                      subtitle={pool.subtitle}
                      staked={pool.staked}
                      tokenIcon={pool.tokenIcon}
                      baseIcon={pool.baseIcon}
                      isHot={pool.isHot}
                      totalStakedUsd={pool.totalStakedUsd}
                      endsInDays={pool.endsInDays}
                      lpMintId={pool.lpMintAddress}
                      poolPubkey={pool.poolPubkey}
                      isTrinity={pool.isTrinity}
                      raydiumPoolId={pool.raydiumPoolId}
                      poolMintA={pool.poolMintA}
                      poolMintB={pool.poolMintB}
                    />
                  ))}
                </div>
              </>
            ) : (
              <Suspense fallback={<PageLoader />}>
                {activeNav === 'wrap' ? (
                  <WrapTerminal />
                ) : activeNav === 'dex' ? (
                  <DexPage />
                ) : activeNav === 'stats' ? (
                  <StatsPage />
                ) : activeNav === 'portfolio' ? (
                  <PortfolioPage />
                ) : (
                  <DocsTerminal />
                )}
              </Suspense>
            )}
          </main>

          {/* ═════════════ MOBILE BOTTOM TAB BAR ═════════════ */}
          <nav className="mobile-bottom-bar">
            <button className={activeNav === 'pools' ? 'tab-active' : ''} onClick={() => setActiveNav('pools')}>
              <span className="tab-icon">⛏️</span>
              <span className="tab-label">Farms</span>
            </button>
            <button className={activeNav === 'dex' ? 'tab-active' : ''} onClick={() => setActiveNav('dex')}>
              <span className="tab-icon">💱</span>
              <span className="tab-label">DEX</span>
            </button>
            <button className={activeNav === 'wrap' ? 'tab-active' : ''} onClick={() => setActiveNav('wrap')}>
              <span className="tab-icon">🔮</span>
              <span className="tab-label">Wrap</span>
            </button>
            <button className={activeNav === 'stats' ? 'tab-active' : ''} onClick={() => setActiveNav('stats')}>
              <span className="tab-icon">📊</span>
              <span className="tab-label">Stats</span>
            </button>
            <button className={activeNav === 'portfolio' ? 'tab-active' : ''} onClick={() => setActiveNav('portfolio')}>
              <span className="tab-icon">💼</span>
              <span className="tab-label">Portfolio</span>
            </button>
            <button className={activeNav === 'docs' ? 'tab-active' : ''} onClick={() => setActiveNav('docs')}>
              <span className="tab-icon">📖</span>
              <span className="tab-label">Docs</span>
            </button>
          </nav>

          <footer className="terminal-footer">
            <p>C 2026 SSS10I TICKER $CARDANO // FUSHIGI HYPERCLUSTER // ABG ARRAY SYSTEMS</p>
            <div className="social-links">
              <a href="https://x.com/sss10inu" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Twitter">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://github.com/enjooyer/sss10idefi" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </a>
              <a href="https://t.me/sss10inu" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Telegram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.667 8.528l-1.956 9.214c-.147.654-.537.818-1.083.504l-3-2.21l-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053l5.56-5.023c.242-.213-.054-.334-.373-.121l-6.871 4.326l-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.817.987z"/>
                </svg>
              </a>
            </div>
          </footer>
        </div>
      </ToastProvider>
      </GlobalPoolProvider>
    </WalletContextProvider>
  )
}

export default App

