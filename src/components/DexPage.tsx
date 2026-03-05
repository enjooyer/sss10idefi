import React from 'react';
import './DexPage.css';
import SwapCard from './SwapCard';

const DexPage: React.FC = () => {
    return (
        <div className="dex-container">
            <div className="dex-content">
                <SwapCard />
            </div>

            <div className="dex-footer">
                <div className="security-tag">ABG Enlightenment Active</div>
                <div className="security-tag">⚡ DYNAMIC SLIPPAGE ENABLED</div>
            </div>
        </div>
    );
};

export default DexPage;
