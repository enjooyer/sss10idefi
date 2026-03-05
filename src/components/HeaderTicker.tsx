import React from 'react';
import './HeaderTicker.css';
import { useTickerData } from '../hooks/useTickerData';

const HeaderTicker: React.FC = () => {
    const data = useTickerData();

    // Helper to render the sequence of items
    const renderSequence = () => (
        <>
            {data.map((item, idx) => (
                <React.Fragment key={`${item.label} -${idx} `}>
                    <span className="ticker-item">
                        <span className="highlight">{item.label}:</span> {item.value}
                    </span>
                    <span className="ticker-separator">//</span>
                </React.Fragment>
            ))}
        </>
    );

    return (
        <div className="header-ticker">
            <div className="ticker-content">
                {renderSequence()}
                {/* Duplicate for infinite seamless scroll effect */}
                <div style={{ marginLeft: '40px', display: 'inline' }}>
                    {renderSequence()}
                </div>
            </div>
        </div>
    );
};

export default HeaderTicker;
