// CapSheetFull.jsx
import React from 'react';

const CapSheetFull = ({ teamCapSheet }) => {
  if (!teamCapSheet || !teamCapSheet.players) return null;

  // Project-wide name formatting
  const formatName = (name) =>
    name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  // Always include 2025–2031
  const allYears = Array.from({ length: 7 }, (_, i) => 2025 + i);

  // Sort players by 2025 salary descending
  const sortedPlayers = [...teamCapSheet.players].sort((a, b) => {
    const aSalary = a.contract_clean?.salaries_by_year?.[2025]?.salary || 0;
    const bSalary = b.contract_clean?.salaries_by_year?.[2025]?.salary || 0;
    return bSalary - aSalary;
  });

  // Build totals per year
  const yearTotals = {};
  for (const year of allYears) {
    yearTotals[year] = sortedPlayers.reduce((sum, player) => {
      const salary =
        player.contract_clean?.salaries_by_year?.[year]?.salary || 0;
      return sum + salary;
    }, 0);
  }

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
          {sortedPlayers.map((player, idx) => (
            <tr key={idx} className="odd:bg-[#171717]">
              <td className="p-2">{formatName(player.name)}</td>
              {allYears.map((year) => {
                const entry = player.contract_clean?.salaries_by_year?.[year];
                if (!entry?.salary) return <td key={year} className="p-2" />;

                const isPO = entry.option === 'Player Option';
                const isTO = entry.option === 'Team Option';
                const style = isPO
                  ? 'text-green-400 font-semibold'
                  : isTO
                    ? 'text-red-400 font-semibold'
                    : '';

                return (
                  <td key={year} className={`p-2 ${style}`}>
                    ${entry.salary.toLocaleString()}
                  </td>
                );
              })}
              <td className="p-2" />
            </tr>
          ))}
          <tr className="border-t border-white/20 font-semibold">
            <td className="p-2">Total Cap</td>
            {allYears.map((year) => (
              <td key={year} className="p-2">
                ${yearTotals[year].toLocaleString()}
              </td>
            ))}
            <td className="p-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default CapSheetFull;
