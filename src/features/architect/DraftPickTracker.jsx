import React from 'react';

const DraftPickTracker = ({ pickLog = [], currentPicks = {} }) => {
  const years = Array.from(
    new Set(
      Object.keys(currentPicks).map(Number)
    )
  ).sort((a, b) => a - b);

  return (
    <div className="text-white">
      <h3 className="text-lg font-semibold mb-2">Draft Pick Trade Log</h3>
      {pickLog.length === 0 ? (
        <p>No draft pick trades logged.</p>
      ) : (
        <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
          <thead>
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Pick</th>
              <th className="p-2 text-left">Partner Team</th>
              <th className="p-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {pickLog.map((entry, idx) => (
              <tr key={`${entry.date}-${idx}`} className="odd:bg-[#171717]">
                <td className="p-2">{entry.date || 'Unknown'}</td>
                <td className="p-2">{entry.action || '—'}</td>
                <td className="p-2">{entry.pick || '—'}</td>
                <td className="p-2">{entry.partner || '—'}</td>
                <td className="p-2">{entry.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-6 text-lg font-semibold">Current Pick Inventory</h3>
      {years.length === 0 ? (
        <p>No picks currently owned.</p>
      ) : (
        <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
          <thead>
            <tr>
              <th className="p-2 text-left">Year</th>
              <th className="p-2 text-left">1st Round</th>
              <th className="p-2 text-left">2nd Round</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year} className="odd:bg-[#171717]">
                <td className="p-2">{year}</td>
                <td className="p-2">{currentPicks[year]?.first || '—'}</td>
                <td className="p-2">{currentPicks[year]?.second || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DraftPickTracker;