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
      <h3 className="text-xl font-semibold mb-3">
        Future Cap Sheet (Multi-Year View)
      </h3>
      <div className="max-w-[1100px] mx-auto overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-y-1">
          <thead>
            <tr className="bg-black/60 text-white border-b border-white/10">
              <th className="px-2 py-1 text-left w-48">Player</th>
              {allYears.map((year) => (
                <th key={year} className="px-2 py-1 text-center w-[70px]">
                  {year}-{String((parseInt(year) + 1) % 100).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, idx) => (
              <tr
                key={idx}
                className="bg-[#1a1a1a] hover:bg-[#222] transition duration-150 border-b border-white/5"
              >
                <td className="px-2 py-1 text-left w-48 whitespace-nowrap">
                  {player.display_name}
                </td>
                {allYears.map((year) => {
                  const entry = player.contract_clean?.salaries_by_year?.[year];
                  if (!entry?.salary)
                    return <td key={year} className="px-2 py-1" />;

                  const isPO = entry.option === 'Player Option';
                  const isTO = entry.option === 'Team Option';
                  const style = isPO
                    ? 'text-green-400 font-semibold'
                    : isTO
                      ? 'text-red-400 font-semibold'
                      : '';

                  return (
                    <td key={year} className={`px-2 py-1 text-center ${style}`}>
                      ${entry.salary.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-black/30 text-white border-t border-white/20 font-semibold">
              <td className="px-2 py-1 w-48">Total Cap</td>
              {allYears.map((year) => (
                <td key={year} className="px-2 py-1 text-center">
                  ${yearTotals[year].toLocaleString()}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CapSheetFull;
