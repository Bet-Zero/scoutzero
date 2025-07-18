import React from 'react';
import capProjections from '@/utils/architect/capProjections';

const ExceptionTracker = ({ teamCapSheet, currentYear }) => {
  const {
    mle,
    tpMle = {},
    bae = {},
    tradeExceptions = [],
    hardCapped,
  } = teamCapSheet;
  const yearKey = `${currentYear}-${String((currentYear + 1) % 100).padStart(
    2,
    '0'
  )}`;
  const capData = capProjections[yearKey] || {};
  const today = new Date();

  const daysUntil = (exp) =>
    Math.floor((new Date(exp) - today) / (1000 * 60 * 60 * 24));

  const getTPEStatusClass = (exp) => {
    const days = daysUntil(exp);
    if (days <= 0) return 'expired';
    if (days <= 30) return 'expiring';
    return 'active';
  };

  const statusClasses = {
    expired: 'text-red-400',
    expiring: 'text-yellow-300',
    active: 'text-green-400',
  };

  const formatMoney = (amount) => `$${amount.toLocaleString()}`;

  const getRemaining = (exception, defaultAmount = 0) => {
    const amount = exception?.amount ?? defaultAmount;
    const used = exception?.used || 0;
    return Math.max(0, amount - used);
  };

  const renderTPEs = () => {
    if (tradeExceptions.length === 0) return <p>No Trade Exceptions</p>;
    return (
      <ul className="mt-1 space-y-1 text-sm">
        {tradeExceptions.map((tpe, idx) => {
          const statusKey = getTPEStatusClass(tpe.expires);
          const days = daysUntil(tpe.expires);
          return (
            <li key={idx} className={statusClasses[statusKey]}>
              <strong>${tpe.amount.toLocaleString()}</strong>
              &nbsp;– expires {tpe.expires}
              {tpe.createdFrom ? ` (from ${tpe.createdFrom})` : ''}
              {days <= 0
                ? ' – Expired'
                : days <= 30
                  ? ` – ${days} days left`
                  : ''}
            </li>
          );
        })}
      </ul>
    );
  };

  const mleRemaining = getRemaining(mle, capData.fullMLE);
  const tpRemaining = getRemaining(tpMle, capData.taxpayerMLE);
  const baeRemaining = getRemaining(bae, capData.bae);

  return (
    <div className="text-white">
      <h3 className="text-lg font-semibold mb-2">Exception Tracker</h3>
      <div className="mt-3">
        <strong title="TPEs: Created when trading a player without taking back matching salary. Last 1 year.">
          Trade Exceptions:
        </strong>
        {renderTPEs()}
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <div>MLE: {formatMoney(mleRemaining)}</div>
        <div>TPMLE: {formatMoney(tpRemaining)}</div>
        <div>BAE: {formatMoney(baeRemaining)}</div>
        {hardCapped && <div className="text-red-400">Team is hard capped</div>}
      </div>
    </div>
  );
};

export default ExceptionTracker;
