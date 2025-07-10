import React, { useState } from 'react';
import { getMinimumCapHit } from '../utils/contractUtils';

const CapSheet = ({ teamCapSheet, capSettings, currentYear }) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const allYears = Array.from(
    new Set(
      teamCapSheet.activeContracts.flatMap(contract => 
        Object.keys(contract.salaryByYear || {}).map(Number)
      )
    )
  ).sort();

  const getCapHit = (contract, year) => {
    const salary = contract.salaryByYear?.[year] || 0;
    if (contract.isMinimum && contract.yearsOfService >= 3) {
      return getMinimumCapHit(contract.yearsOfService);
    }
    return salary;
  };

  const renderNotes = (contract, year) => {
    const notes = [];
    const optionYear = contract.options?.playerOptionYear || contract.options?.teamOptionYear;
    
    if (contract.options?.playerOption && optionYear === year) notes.push('PO');
    if (contract.options?.teamOption && optionYear === year) notes.push('TO');
    if (contract.isMinimum && contract.yearsOfService >= 3) notes.push('Vet Min');
    if (contract.guaranteed === false) notes.push('Non-Guaranteed');
    if (typeof contract.guaranteed === 'number') {
      notes.push(`Guaranteed ${Math.round(contract.guaranteed * 100)}%`);
    }
    
    return notes.join(', ');
  };

  let totalCapHit = 0;

  return (
    <div className="cap-sheet">
      <h3>Cap Sheet – {selectedYear}</h3>
      <div className="year-tabs">
        {allYears.map((year) => (
          <button 
            key={year} 
            onClick={() => setSelectedYear(year)}
            style={{ 
              fontWeight: year === selectedYear ? 'bold' : 'normal',
              marginRight: '6px'
            }}
          >
            {year}
          </button>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Salary</th>
            <th>Cap Hit</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {teamCapSheet.activeContracts
            .filter((c) => c.salaryByYear?.[selectedYear])
            .map((contract, idx) => {
              const salary = contract.salaryByYear?.[selectedYear] || 0;
              const capHit = getCapHit(contract, selectedYear);
              totalCapHit += capHit;

              const rowClass = !contract.guaranteed ? 'non-guaranteed' : 
                typeof contract.guaranteed === 'number' ? 'partial-guaranteed' : '';

              return (
                <tr key={`${contract.name}-${idx}`} className={rowClass}>
                  <td>{contract.name}</td>
                  <td>${salary.toLocaleString()}</td>
                  <td>${capHit.toLocaleString()}</td>
                  <td>{renderNotes(contract, selectedYear)}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
      <p><strong>Total Cap Hit:</strong> ${totalCapHit.toLocaleString()}</p>
    </div>
  );
};

export default CapSheet;