import { useMemo } from 'react';
import type { FC, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { RPC_ENDPOINTS } from '../utils/constants';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
    children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
    // Connect to Mainnet via the prioritized RPC list with failover logic
    const endpoint = useMemo(() => RPC_ENDPOINTS[0], []);

    // Simple config - use standard fetch, SmartConnection handles failover in useAnchorProgram
    const config = useMemo(() => ({
        commitment: 'confirmed' as const,
    }), []);

    // NOTE: ConnectionProvider internally creates a NEW Connection object using the 'endpoint' string.
    // To ensure our Smart Failover works everywhere, we override the default ConnectionProvider's
    // behavior or ensure our useAnchorProgram hook uses getSmartConnection explicitly.


    const wallets = useMemo(
        () => [
            // Wallets that implement WalletAdapterStandard are automatically detected.
            // You can also add custom wallet adapters here.
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint} config={config}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
