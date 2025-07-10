import React from 'react';
import { getMinimumCapHit } from '../utils/contractUtils';

const CapSheetFull = ({ teamCapSheet }) => {
  const allYears = Array.from(
    new Set(
      teamCapSheet.activeContracts.flatMap(contract => 
        Object.keys(contract.salaryByYear || {}).map(Number))
    )
  ).sort();

  const getCapHit = (contract, year) => {
    const salary = contract.salaryByYear?.[year] || 0;
    if (contract.isMinimum && contract.yearsOfService >= 3) {
      return getMinimumCapHit(contract.yearsOfService);
    }
    return salary;
  };

  const renderNotes = (contract) => {
    const notes = [];
    if (contract.options?.playerOption) {
      notes.push(`PO in ${contract.options.playerOptionYear}`);
    }
    if (contract.options?.teamOption) {
      notes.push(`TO in ${contract.options.teamOptionYear}`);
    }
    if (contract.isMinimum && contract.yearsOfService >= 3) {
      notes.push(`Vet Min, ${contract.yearsOfService} yrs`);
    }
    if (contract.guaranteed === false) notes.push("Non-Guaranteed");
    if (typeof contract.guaranteed === 'number') 
      notes.push(`Guaranteed ${Math.round(contract.guaranteed * 100)}%`);
    return notes.join(", ");
  };

  const yearTotals = {};
  allYears.forEach((year) => {
    yearTotals[year] = 0;
    teamCapSheet.activeContracts.forEach((contract) => {
      const hit = getCapHit(contract, year);
      if (contract.salaryByYear?.[year]) {
        yearTotals[year] += hit;
      }
    });
  });

  return (
    <div className="cap-sheet-full">
      <h3>Future Cap Sheet (Multi-Year View)</h3>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            {allYears.map((year) => (
              <th key={year}>{year}</th>
            ))}
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {teamCapSheet.activeContracts.map((contract, idx) => (
            <tr key={idx}>
              <td>{contract.name}</td>
              {allYears.map((year) => {
                const salary = contract.salaryByYear?.[year];
                const capHit = getCapHit(contract, year);
                return (
                  <td key={year}>
                    {salary ? `$${capHit.toLocaleString()}` : '—'}
                  </td>
                );
              })}
              <td>{renderNotes(contract)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid black' }}>
            <td>Total Cap</td>
            {allYears.map((year) => (
              <td key={year}>${yearTotals[year].toLocaleString()}</td>
            ))}
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default CapSheetFull;