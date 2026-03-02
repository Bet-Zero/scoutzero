import React from 'react';

const formatAmount = (entry) => {
  if (typeof entry.amount === 'number') return entry.amount;
  if (typeof entry.amountRemaining === 'number') return entry.amountRemaining;

  const created = Number(entry.amountCreated || 0);
  const consumed = Number(entry.amountConsumed || 0);
  if (Number.isFinite(created) || Number.isFinite(consumed)) {
    return Math.max(0, created - consumed);
  }

  return null;
};

const mapExceptionRow = (entry = {}) => {
  const expires = entry.expires || entry.expiresAt || '—';
  const source = entry.source || entry.sourcePlayerName || '—';
  const date = entry.date || entry.timestamp || '—';
  const action = entry.action || entry.type || '—';
  const amount = formatAmount(entry);

  return {
    ...entry,
    date,
    action,
    amount,
    source,
    expires,
  };
};

const ExceptionHistoryTracker = ({
  exceptionHistory = [],
  mleHistory = [],
}) => {
  const renderTPEHistory = () => {
    if (exceptionHistory.length === 0) return <p>No TPE activity logged.</p>;
    const rows = exceptionHistory.map((entry) => mapExceptionRow(entry));
    return (
      <table
        data-testid="team-history-tpe-table"
        className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded"
      >
        <thead>
          <tr>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Action</th>
            <th className="p-2 text-left">Amount</th>
            <th className="p-2 text-left">Source Player</th>
            <th className="p-2 text-left">Expires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, idx) => (
            <tr
              key={entry.id || idx}
              data-testid={`team-history-tpe-row-${idx}`}
              className="odd:bg-[#171717]"
            >
              <td className="p-2">{entry.date}</td>
              <td className="p-2">{entry.action}</td>
              <td className="p-2">${entry.amount?.toLocaleString() ?? '—'}</td>
              <td className="p-2">{entry.source || '—'}</td>
              <td className="p-2">{entry.expires || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderMLEHistory = () => {
    if (mleHistory.length === 0) return <p>No MLE activity logged.</p>;
    return (
      <table
        data-testid="team-history-mle-table"
        className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded"
      >
        <thead>
          <tr>
            <th className="p-2 text-left">Year</th>
            <th className="p-2 text-left">Total</th>
            <th className="p-2 text-left">Used</th>
            <th className="p-2 text-left">Remaining</th>
            <th className="p-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {mleHistory.map((mle, idx) => (
            <tr
              key={mle.id || idx}
              data-testid={`team-history-mle-row-${idx}`}
              className="odd:bg-[#171717]"
            >
              <td className="p-2">{mle.year || '—'}</td>
              <td className="p-2">${mle.total?.toLocaleString() ?? '—'}</td>
              <td className="p-2">${mle.used?.toLocaleString() ?? '—'}</td>
              <td className="p-2">
                ${((mle.total ?? 0) - (mle.used ?? 0)).toLocaleString()}
              </td>
              <td className="p-2">{mle.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="text-white">
      <h3 className="text-lg font-semibold mb-2">Trade Exception Activity</h3>
      {renderTPEHistory()}

      <h3 className="mt-6 text-lg font-semibold">MLE Usage History</h3>
      {renderMLEHistory()}
    </div>
  );
};

export default ExceptionHistoryTracker;
