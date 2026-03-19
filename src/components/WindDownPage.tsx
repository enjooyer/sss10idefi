import React from 'react';
import './WindDownPage.css';

const WindDownPage: React.FC = () => {
  return (
    <div className="wind-down-container">
      <div className="wind-down-content">
        <h1 className="wind-down-title glow-text">Thank you for using Facility Sieben Defi</h1>
        <p className="wind-down-subtitle">
          The farms are now closed per the latest Telegram announcement.
        </p>
        <div className="wind-down-message-box">
          <p>
            99% of depositors withdrew, if you were the one with approx. $70 worth of LP deposited it has been permanently burned - please contact CH on Telegram <a href="https://t.me/Number1Dev" target="_blank" rel="noopener noreferrer" className="ch-link">@Number1Dev</a> for a refund
          </p>
        </div>
        <p className="wind-down-signoff">
          Thanks for supporting the farms, I am excited for the future (I've already lived it)
        </p>
        <p className="wind-down-signature">
          - CH
        </p>
      </div>
    </div>
  );
};

export default WindDownPage;
