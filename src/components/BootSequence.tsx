import React, { useEffect, useState } from 'react';
import './BootSequence.css';

interface BootSequenceProps {
    onComplete: () => void;
}

const bootLogs = [
    "INITIALIZING SITE ZERO KERNEL...",
    "ESTABLISHING SECURE MESH RELAY TO SOLANA NETWORK...",
    "DECRYPTING ARCHIVAL METADATA...",
    "VERIFYING CONTAINMENT ARRAY INTEGRITY...",
    "LOADING RAYDIUM CPMM INTERFACES...",
    "WARNING: SUB-ZERO TEMPERATURES DETECTED. ENGAGING HEURISTICS.",
    "MOUNTING SPL-404 FRACTIONAL VATS...",
    "ACCESS GRANTED. WELCOME USER.",
];

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
    const [lines, setLines] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < bootLogs.length) {
            const timer = setTimeout(() => {
                setLines(prev => [...prev, bootLogs[currentIndex]]);
                setCurrentIndex(prev => prev + 1);
            }, Math.random() * 400 + 100); // Random delay between 100ms and 500ms

            return () => clearTimeout(timer);
        } else {
            const exitTimer = setTimeout(() => {
                onComplete();
            }, 800);
            return () => clearTimeout(exitTimer);
        }
    }, [currentIndex, onComplete]);

    return (
        <div className="boot-terminal">
            <div className="boot-overlay"></div>
            <div className="boot-content">
                <h1 className="boot-brand">OS SITE_ZERO.sol // v1.0.404</h1>
                <div className="boot-logs">
                    {lines.map((line, i) => (
                        <div key={i} className="boot-line">
                            <span className="log-timestamp">[{new Date().toISOString().split('T')[1].substring(0, 8)}] </span>
                            <span className="log-text">{line}</span>
                        </div>
                    ))}
                    {currentIndex < bootLogs.length && (
                        <div className="boot-cursor">_</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BootSequence;
