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
          </footer>
        </div>
      </ToastProvider>
      </GlobalPoolProvider>
    </WalletContextProvider>
  )
}

export default App

