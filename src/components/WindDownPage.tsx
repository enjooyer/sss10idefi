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
            99% of depositors withdrew, apart from approx. $70 worth of TVL which has now been permanently burned in the LP. A refund will be issued shortly to the depositor(s) in equal parts Cardano/SOL as this was the only pool with a remaining deposit.
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
