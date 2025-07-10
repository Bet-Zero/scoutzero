import React, { useState } from 'react';
import { getMinimumCapHit } from '@/utils/architect/contractUtils';

const CapSheet = ({ teamCapSheet, capSettings, currentYear }) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const allYears = Array.from(
    new Set(
      teamCapSheet.activeContracts.flatMap((contract) =>
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
    const optionYear =
      contract.options?.playerOptionYear || contract.options?.teamOptionYear;

    if (contract.options?.playerOption && optionYear === year) notes.push('PO');
    if (contract.options?.teamOption && optionYear === year) notes.push('TO');
    if (contract.isMinimum && contract.yearsOfService >= 3)
      notes.push('Vet Min');
    if (contract.guaranteed === false) notes.push('Non-Guaranteed');
    if (typeof contract.guaranteed === 'number') {
      notes.push(`Guaranteed ${Math.round(contract.guaranteed * 100)}%`);
    }

    return notes.join(', ');
  };

  let totalCapHit = 0;

  return (
    <div className="text-white">
      <h3 className="text-xl font-semibold mb-2">Cap Sheet – {selectedYear}</h3>
      <div className="flex gap-2 mb-3">
        {allYears.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-2 py-1 rounded text-xs border border-white/20 ${
              year === selectedYear ? 'bg-blue-600' : 'bg-[#1a1a1a]'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
      <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
        <thead className="bg-[#111]">
          <tr>
            <th className="p-2 text-left">Player</th>
            <th className="p-2 text-left">Salary</th>
            <th className="p-2 text-left">Cap Hit</th>
            <th className="p-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {teamCapSheet.activeContracts
            .filter((c) => c.salaryByYear?.[selectedYear])
            .map((contract, idx) => {
              const salary = contract.salaryByYear?.[selectedYear] || 0;
              const capHit = getCapHit(contract, selectedYear);
              totalCapHit += capHit;

              return (
                <tr
                  key={`${contract.name}-${idx}`}
                  className="odd:bg-[#171717]"
                >
                  <td className="p-2">{contract.name}</td>
                  <td className="p-2">${salary.toLocaleString()}</td>
                  <td className="p-2">${capHit.toLocaleString()}</td>
                  <td className="p-2">{renderNotes(contract, selectedYear)}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
      <p className="mt-2 font-semibold">
        Total Cap Hit: ${totalCapHit.toLocaleString()}
      </p>
    </div>
  );
};

export default CapSheet;
