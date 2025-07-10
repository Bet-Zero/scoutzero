import React from 'react';

const DraftPickTracker = ({ pickLog = [], currentPicks = {} }) => {
  const years = Array.from(
    new Set(
      Object.keys(currentPicks).map(Number)
    )
  ).sort((a, b) => a - b);

  return (
    <div className="draft-pick-tracker">
      <h3>Draft Pick Trade Log</h3>
      {pickLog.length === 0 ? (
        <p>No draft pick trades logged.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Pick</th>
              <th>Partner Team</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {pickLog.map((entry, idx) => (
              <tr key={`${entry.date}-${idx}`}>
                <td>{entry.date || 'Unknown'}</td>
                <td>{entry.action || '—'}</td>
                <td>{entry.pick || '—'}</td>
                <td>{entry.partner || '—'}</td>
                <td>{entry.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: '30px' }}>Current Pick Inventory</h3>
      {years.length === 0 ? (
        <p>No picks currently owned.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>1st Round</th>
              <th>2nd Round</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year}>
                <td>{year}</td>
                <td>{currentPicks[year]?.first || '—'}</td>
                <td>{currentPicks[year]?.second || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DraftPickTracker;