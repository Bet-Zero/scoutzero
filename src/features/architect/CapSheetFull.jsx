// CapSheetFull.jsx
import React, { useState } from 'react';
import { formatName } from '@/shared/utils/formatting';

// Get contract year data from Architect contract shape (BasePlayerContractZ)
const getContractYearSlice = (player, endYear) => {
  if (!player) return null;

  const contract = player.contract;
  if (contract?.salariesByYear?.length) {
    const seasonKey = `${endYear - 1}-${String(endYear).slice(-2)}`;
    const yearEntry =
      contract.salariesByYear.find((y) => y.season === seasonKey) ||
      contract.salariesByYear.find((y) => String(y.season) === String(endYear));
    if (yearEntry) return yearEntry;
  }

  return null;
};

// Color scheme matching FreeAgentRow
const getTagColor = (type) => {
  if (type === 'UFA') return 'bg-blue-500/30 text-white/70';
  if (type === 'RFA') return 'bg-red-600/30 text-white/70';
  if (type === 'PO') return 'bg-green-600/30 text-white/70';
  if (type === 'TO') return 'bg-orange-500/30 text-white/70';
  return 'bg-gray-600 text-white/70';
};

const CapSheetFull = ({
  teamCapSheet,
  currentYear,
  onSelectPlayer,
  playersMap = {},
}) => {
  if (!teamCapSheet || !teamCapSheet.players) return null;

  const [showCapHolds, setShowCapHolds] = useState(false);

  // Generate 7 years starting from currentYear
  const allYears = Array.from({ length: 7 }, (_, i) => currentYear + i);

  // Sort players by current year salary descending
  const sortedPlayers = teamCapSheet.players
    .filter((p) => getContractYearSlice(p, currentYear))
    .sort((a, b) => {
      const aSlice = getContractYearSlice(a, currentYear);
      const bSlice = getContractYearSlice(b, currentYear);
      const aSalary = aSlice?.salary || aSlice?.capHit || 0;
      const bSalary = bSlice?.salary || bSlice?.capHit || 0;
      return bSalary - aSalary;
    });

  const capHoldPlayers = teamCapSheet.players
    .filter((p) => {
      const slice = getContractYearSlice(p, currentYear);
      const hasSalary = slice?.salary || slice?.capHit;
      const holdAmount =
        typeof p.cap_hold === 'number' ? p.cap_hold : p.cap_hold?.amount || 0;
      const isActive =
        typeof p.cap_hold === 'object' ? p.cap_hold?.active : holdAmount > 0;
      return !hasSalary && isActive && holdAmount > 0;
    })
    .sort((a, b) => {
      const aAmt =
        typeof a.cap_hold === 'number' ? a.cap_hold : a.cap_hold?.amount || 0;
      const bAmt =
        typeof b.cap_hold === 'number' ? b.cap_hold : b.cap_hold?.amount || 0;
      return bAmt - aAmt;
    });

  // Build totals per year
  const yearTotals = {};
  for (const year of allYears) {
    yearTotals[year] = sortedPlayers.reduce((sum, player) => {
      const slice = getContractYearSlice(player, year);
      const salary = slice?.salary || slice?.capHit || 0;
      const holdAmount =
        typeof player.cap_hold === 'number'
          ? player.cap_hold
          : player.cap_hold?.amount || 0;
      const isActive =
        typeof player.cap_hold === 'object'
          ? player.cap_hold?.active
          : holdAmount > 0;
      const hold = !salary && isActive ? holdAmount : 0;
      return sum + salary + hold;
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
                  {year - 1}-{String(year % 100).padStart(2, '0')}
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
                  <button
                    onClick={() => onSelectPlayer && onSelectPlayer(player)}
                    className="text-blue-400 hover:underline"
                  >
                    {playersMap[player.name]?.bio?.displayName ||
                      formatName(player.bio?.displayName || player.name)}
                  </button>
                </td>
                {allYears.map((year) => {
                  const entry = getContractYearSlice(player, year);
                  const faYear = player.contract?.freeAgency?.year;
                  const faType = player.contract?.freeAgency?.type;
                  
                  // Debug logging
                  if (player.name === 'LeBron James' && year === 2027) {
                    console.log('🔍 LeBron 2027 Debug:', {
                      player: player.name,
                      year,
                      entry,
                      faYear,
                      faType,
                      fullContract: player.contract
                    });
                  }
                  
                  // Handle free agency years (no salary)
                  if (!entry?.salary && !entry?.capHit) {
                    if (faYear === year && faType) {
                      return (
                        <td key={year} className="px-2 py-1 text-center">
                          <span className={`px-1.5 py-[2px] rounded text-[11px] font-semibold ${getTagColor(faType)}`}>
                            {faType}
                          </span>
                        </td>
                      );
                    }
                    return <td key={year} className="px-2 py-1" />;
                  }

                  // Handle contract years with options
                  const isPO = entry.option === 'Player Option' || entry.option === 'PO';
                  const isTO = entry.option === 'Team Option' || entry.option === 'TO';
                  
                  // Debug logging for options
                  if (entry.option) {
                    console.log('🔍 Option found:', {
                      player: player.name,
                      year,
                      option: entry.option,
                      isPO,
                      isTO
                    });
                  }
                  
                  if (isPO || isTO) {
                    const optionType = isPO ? 'PO' : 'TO';
                    return (
                      <td key={year} className="px-2 py-1 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`px-1.5 py-[2px] rounded text-[11px] font-semibold ${getTagColor(optionType)}`}>
                            {optionType}
                          </span>
                          <span className="text-white/70">
                            ${entry.salary.toLocaleString()}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  // Regular contract year
                  return (
                    <td key={year} className="px-2 py-1 text-center text-white/70">
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

        {capHoldPlayers.length > 0 && (
          <>
            <button
              onClick={() => setShowCapHolds(!showCapHolds)}
              className="mt-4 mb-2 px-3 py-1 rounded bg-[#1a1a1a] hover:bg-[#222] border border-white/20"
            >
              {showCapHolds
                ? 'Hide Cap Holds'
                : `Show Cap Holds (${capHoldPlayers.length})`}
            </button>

            {showCapHolds && (
              <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded mb-2">
                <thead className="bg-[#111]">
                  <tr>
                    <th className="p-2 text-left">Player</th>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {capHoldPlayers.map((p, idx) => {
                    const amt =
                      typeof p.cap_hold === 'number'
                        ? p.cap_hold
                        : p.cap_hold?.amount || 0;
                    const reason =
                      typeof p.cap_hold === 'object' ? p.cap_hold?.reason : '';
                    return (
                      <tr key={idx} className="odd:bg-[#171717]">
                        <td className="p-2">
                          {playersMap[p.name]?.bio?.displayName ||
                            formatName(p.bio?.displayName || p.name)}
                        </td>
                        <td className="p-2">${amt.toLocaleString()}</td>
                        <td className="p-2">{reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CapSheetFull;
