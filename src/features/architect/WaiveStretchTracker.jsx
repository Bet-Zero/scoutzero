import React from 'react';

const WaiveStretchTracker = ({ waivedContracts = [] }) => {
  const deadCapByYear = {};
  
  waivedContracts.forEach((contract) => {
    const entries = contract.deadCap || {};
    Object.entries(entries).forEach(([year, amount]) => {
      if (!deadCapByYear[year]) deadCapByYear[year] = 0;
      deadCapByYear[year] += amount;
    });
  });

  const sortedYears = Object.keys(deadCapByYear)
    .map(Number)
    .sort();

  return (
    <div className="text-white">
      <h3 className="text-lg font-semibold mb-2">Waived & Stretched Contracts</h3>
      
      {waivedContracts.length === 0 ? (
        <p>No waived contracts.</p>
      ) : (
        <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
          <thead>
            <tr>
              <th className="p-2 text-left">Player</th>
              <th className="p-2 text-left">Waived On</th>
              <th className="p-2 text-left">Stretched?</th>
              <th className="p-2 text-left">Dead Cap Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {waivedContracts.map((wc, idx) => (
              <tr key={idx} className="odd:bg-[#171717]">
                <td className="p-2">{wc.name}</td>
                <td className="p-2">{wc.waivedOn}</td>
                <td className="p-2">{wc.stretched ? 'Yes' : 'No'}</td>
                <td className="p-2 space-y-1">
                  {Object.entries(wc.deadCap || {}).map(([year, amt]) => (
                    <div key={year}>
                      {year}: ${amt.toLocaleString()}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      <h4 className="mt-5 font-semibold">Dead Cap by Year</h4>
      
      {sortedYears.length === 0 ? (
        <p>No dead money on the books.</p>
      ) : (
        <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
          <thead>
            <tr>
              <th className="p-2 text-left">Year</th>
              <th className="p-2 text-left">Total Dead Cap</th>
            </tr>
          </thead>
          <tbody>
            {sortedYears.map((year) => (
              <tr key={year} className="odd:bg-[#171717]">
                <td className="p-2">{year}</td>
                <td className="p-2">${deadCapByYear[year].toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default WaiveStretchTracker;