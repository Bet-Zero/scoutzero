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
    <div className="waive-stretch-tracker">
      <h3>Waived & Stretched Contracts</h3>
      
      {waivedContracts.length === 0 ? (
        <p>No waived contracts.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Waived On</th>
              <th>Stretched?</th>
              <th>Dead Cap Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {waivedContracts.map((wc, idx) => (
              <tr key={idx}>
                <td>{wc.name}</td>
                <td>{wc.waivedOn}</td>
                <td>{wc.stretched ? 'Yes' : 'No'}</td>
                <td>
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
      
      <h4 style={{ marginTop: '20px' }}>Dead Cap by Year</h4>
      
      {sortedYears.length === 0 ? (
        <p>No dead money on the books.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Total Dead Cap</th>
            </tr>
          </thead>
          <tbody>
            {sortedYears.map((year) => (
              <tr key={year}>
                <td>{year}</td>
                <td>${deadCapByYear[year].toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default WaiveStretchTracker;