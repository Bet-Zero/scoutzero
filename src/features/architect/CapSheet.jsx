import React, { useState } from 'react';
import { getMinimumCapHit } from '@/utils/architect/contractUtils';

const CapSheet = ({ teamCapSheet, capSettings, currentYear }) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const allYears = Array.from(
    new Set(
      teamCapSheet.players.flatMap((p) =>
        Object.keys(p.contract_clean?.yearly || {})
      )
    )
  ).sort();

  const getCapHit = (player, yearKey) => {
    const salary = player.contract_clean?.yearly?.[yearKey] || 0;
    if (player.isMinimum && player.yearsOfService >= 3) {
      return getMinimumCapHit(player.yearsOfService);
    }
    return salary;
  };

  const renderNotes = (player, yearKey) => {
    const notes = [];
    if (player.contract_clean?.playerOptions?.includes(yearKey)) notes.push('PO');
    if (player.contract_clean?.teamOptions?.includes(yearKey)) notes.push('TO');
    if (player.isMinimum && player.yearsOfService >= 3) notes.push('Vet Min');
    if (player.contract_clean?.unguaranteed?.includes(yearKey))
      notes.push('Non-Guaranteed');

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
          {teamCapSheet.players
            .filter((p) => p.contract_clean?.yearly?.[selectedYear])
            .map((player, idx) => {
              const salary = player.contract_clean?.yearly?.[selectedYear] || 0;
              const capHit = getCapHit(player, selectedYear);
              totalCapHit += capHit;

              return (
                <tr
                  key={`${player.name}-${idx}`}
                  className="odd:bg-[#171717]"
                >
                  <td className="p-2">{player.name}</td>
                  <td className="p-2">${salary.toLocaleString()}</td>
                  <td className="p-2">${capHit.toLocaleString()}</td>
                  <td className="p-2">{renderNotes(player, selectedYear)}</td>
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
