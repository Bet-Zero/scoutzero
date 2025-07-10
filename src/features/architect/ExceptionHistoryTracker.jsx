import React from 'react';

const ExceptionHistoryTracker = ({ exceptionHistory = [], mleHistory = [] }) => {
  const renderTPEHistory = () => {
    if (exceptionHistory.length === 0) return <p>No TPE activity logged.</p>;
    return (
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Amount</th>
            <th>Source Player</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {exceptionHistory.map((entry, idx) => (
            <tr key={idx}>
              <td>{entry.date}</td>
              <td>{entry.action}</td>
              <td>${entry.amount.toLocaleString()}</td>
              <td>{entry.source || '—'}</td>
              <td>{entry.expires || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderMLEHistory = () => {
    if (mleHistory.length === 0) return <p>No MLE activity logged.</p>;
    return (
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Total</th>
            <th>Used</th>
            <th>Remaining</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {mleHistory.map((mle, idx) => (
            <tr key={idx}>
              <td>{mle.year}</td>
              <td>${mle.total.toLocaleString()}</td>
              <td>${mle.used.toLocaleString()}</td>
              <td>${(mle.total - mle.used).toLocaleString()}</td>
              <td>{mle.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="exception-history-tracker">
      <h3>Trade Exception Activity</h3>
      {renderTPEHistory()}

      <h3 style={{ marginTop: '30px' }}>MLE Usage History</h3>
      {renderMLEHistory()}
    </div>
  );
};

export default ExceptionHistoryTracker;