// CapSheetFull.jsx (rewired to use contract_clean)
import React from 'react';

const CapSheetFull = ({ teamCapSheet }) => {
  if (!teamCapSheet || !teamCapSheet.players) return null;

  // Get all years from all players' contract_clean
  const allYears = Array.from(
    new Set(
      teamCapSheet.players.flatMap((player) =>
        Object.keys(player.contract_clean?.salaries_by_year || {}).map(Number)
      )
    )
  ).sort((a, b) => a - b);

  // Build year-by-year totals
  const yearTotals = {};
  for (const year of allYears) {
    yearTotals[year] = teamCapSheet.players.reduce((sum, player) => {
      const salary =
        player.contract_clean?.salaries_by_year?.[year]?.salary || 0;
      return sum + salary;
    }, 0);
  }

  const renderNotes = (salaries_by_year) => {
    const notes = [];

    for (const [year, data] of Object.entries(salaries_by_year || {})) {
      if (data.option === 'Player Option') notes.push(`PO in ${year}`);
      if (data.option === 'Team Option') notes.push(`TO in ${year}`);
      if (data.guaranteed === false) notes.push(`Non-Guaranteed in ${year}`);
    }

    return notes.join(', ');
  };

  return (
    <div className="text-white">
      <h3 className="text-xl font-semibold mb-2">
        Future Cap Sheet (Multi-Year View)
      </h3>
      <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
        <thead className="bg-[#111]">
          <tr>
            <th className="p-2 text-left">Player</th>
            {allYears.map((year) => (
              <th key={year} className="p-2 text-left">
                {year}
              </th>
            ))}
            <th className="p-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {teamCapSheet.players.map((player, idx) => (
            <tr key={idx} className="odd:bg-[#171717]">
              <td className="p-2">{player.name}</td>
              {allYears.map((year) => {
                const salary =
                  player.contract_clean?.salaries_by_year?.[year]?.salary;
                return (
                  <td key={year} className="p-2">
                    {salary ? `$${salary.toLocaleString()}` : '—'}
                  </td>
                );
              })}
              <td className="p-2">
                {renderNotes(player.contract_clean?.salaries_by_year)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-white/20 font-semibold">
            <td className="p-2">Total Cap</td>
            {allYears.map((year) => (
              <td key={year} className="p-2">
                ${yearTotals[year].toLocaleString()}
              </td>
            ))}
            <td className="p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default CapSheetFull;
