import React from 'react';

const ExceptionTracker = ({ teamCapSheet, currentYear }) => {
  const { mle, tradeExceptions = [] } = teamCapSheet;
  const today = new Date();
  
  const daysUntil = (exp) => Math.floor((new Date(exp) - today) / (1000 * 60 * 60 * 24));
  
  const getTPEStatusClass = (exp) => {
    const days = daysUntil(exp);
    if (days <= 0) return 'expired';
    if (days <= 30) return 'expiring';
    return 'active';
  };

  const renderMLE = () => {
    if (!mle) return <p>No MLE available.</p>;
    const remaining = mle.amount - (mle.used || 0);
    return (
      <div className="mle-block">
        <strong title="MLE: Mid-Level Exception (can be used to sign free agents above the minimum)">
          MLE:
        </strong><br />
        Total: ${mle.amount.toLocaleString()}<br />
        Used: ${mle.used?.toLocaleString() || 0}<br />
        Remaining: ${remaining.toLocaleString()}
      </div>
    );
  };

  const renderTPEs = () => {
    if (tradeExceptions.length === 0) return <p>No Trade Exceptions</p>;
    return (
      <ul className="tpe-list">
        {tradeExceptions.map((tpe, idx) => {
          const statusClass = getTPEStatusClass(tpe.expires);
          const days = daysUntil(tpe.expires);
          return (
            <li key={idx} className={statusClass}>
              <strong>${tpe.amount.toLocaleString()}</strong>
              &nbsp;– expires {tpe.expires}
              {tpe.createdFrom ? ` (from ${tpe.createdFrom})` : ''}
              {days <= 0 ? ' – Expired' : days <= 30 ? ` – ${days} days left` : ''}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="exception-tracker">
      <h3>Exception Tracker</h3>
      {renderMLE()}
      <div style={{ marginTop: '12px' }}>
        <strong title="TPEs: Created when trading a player without taking back matching salary. Last 1 year.">
          Trade Exceptions:
        </strong>
        {renderTPEs()}
      </div>
    </div>
  );
};

export default ExceptionTracker;