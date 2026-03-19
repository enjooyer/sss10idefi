import './App.css'
import WindDownPage from './components/WindDownPage';
import { ToastProvider } from './components/ToastProvider';
import { WalletContextProvider } from './components/WalletContextProvider';
import { GlobalPoolProvider } from './contexts/GlobalPoolContext';

function App() {
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
            {/* ═════════════ DESKTOP HEADER ═════════════ */}
            <header className="defi-header" style={{ justifyContent: 'center' }}>
              <div className="logo-area" style={{ cursor: 'pointer', margin: '0 auto' }}>
                <div className="glow-icon">🍼</div>
                <h1>SSS10i <span className="ice-accent">DEFI</span></h1>
              </div>
            </header>

            <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, minHeight: '60vh' }}>
              <WindDownPage />
            </main>

            <footer className="terminal-footer" style={{ marginTop: 'auto' }}>
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
