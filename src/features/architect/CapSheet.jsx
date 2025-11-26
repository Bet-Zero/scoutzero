import React, { useState } from 'react';
import { formatName } from '@/utils/formatting';
import { getMinimumCapHit } from '@/utils/architect/contractUtils';
import CapSummaryTiles from '@/features/architect/CapSummaryTiles';
import { POSITION_MAP } from '@/utils/roles';
import getCapPercentage from '@/utils/architect/basicArchitectUtils';
import capProjections from '@/utils/architect/capProjections';

// Prefer Architect contract shape (BasePlayerContractZ) but fall back to legacy contract_clean
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

  // Legacy fallback: project contract_clean.salaries_by_year into a compatible slice
  const legacyEntry =
    player.contract_clean?.salaries_by_year?.[endYear] ||
    player.contract_clean?.salaries_by_year?.[
      `${endYear}-${String((endYear + 1) % 100).padStart(2, '0')}`
    ];

  if (!legacyEntry) return null;

  return {
    season: `${endYear - 1}-${String(endYear).slice(-2)}`,
    salary: legacyEntry.salary || 0,
    capHit: legacyEntry.salary || 0,
    guaranteed:
      typeof legacyEntry.guaranteed === 'boolean'
        ? legacyEntry.guaranteed
        : true,
    option: legacyEntry.option || null,
  };
};

const CapSheet = ({
  teamCapSheet,
  currentYear,
  onSelectPlayer,
  playersMap = {},
}) => {
  if (!teamCapSheet) {
    return <div className="text-white/60 p-4">Loading cap sheet...</div>;
  }

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showCapHolds, setShowCapHolds] = useState(false);

  const generateYears = (startYear, count) =>
    Array.from({ length: count }, (_, i) => startYear + i);

  const allYears = generateYears(currentYear, 7);
  const yearKey = `${selectedYear}-${String((selectedYear + 1) % 100).padStart(
    2,
    '0'
  )}`;
  const salaryCap = capProjections[yearKey]?.cap || 1;

  const formatYearLabel = (year) =>
    `${year}-${String((year + 1) % 100).padStart(2, '0')}`;

  const getCapHit = (player, yearKey) => {
    const slice = getContractYearSlice(player, yearKey);
    const salary = slice?.capHit ?? slice?.salary ?? 0;
    if (player.isMinimum && player.yearsOfService >= 3) {
      return getMinimumCapHit(player.yearsOfService);
    }
    return salary;
  };

  // Helper to aggregate cap hits for a group of players
  const calculateCapHitTotal = (players, yearKey) =>
    players.reduce((sum, p) => sum + getCapHit(p, yearKey), 0);

  // Helper to sum cap hold amounts for a group of players
  const calculateCapHoldTotal = (players) =>
    players.reduce((sum, p) => {
      const amt =
        typeof p.cap_hold === 'number' ? p.cap_hold : p.cap_hold?.amount || 0;
      const isActive =
        typeof p.cap_hold === 'object' ? p.cap_hold?.active : amt > 0;
      return isActive ? sum + amt : sum;
    }, 0);

  const renderNotes = (player, yearKey) => {
    const slice = getContractYearSlice(player, yearKey);
    const option = slice?.option || null;
    const isPO = option === 'Player Option';
    const isTO = option === 'Team Option';
    const isNG = slice && slice.guaranteed === false;

    const notes = [];
    if (isPO)
      notes.push(<span className="text-green-400 font-semibold">PO</span>);
    if (isTO)
      notes.push(<span className="text-red-400 font-semibold">TO</span>);
    if (player.isMinimum && player.yearsOfService >= 3) notes.push('Vet Min');
    if (isNG) notes.push('Non-Guaranteed');

    return (
      <span className="flex flex-wrap gap-1">
        {notes.map((note, i) => (
          <span key={i}>{note}</span>
        ))}
      </span>
    );
  };

  const filteredPlayers = teamCapSheet.players
    .filter((p) => getContractYearSlice(p, selectedYear))
    .sort((a, b) => {
      const aSlice = getContractYearSlice(a, selectedYear);
      const bSlice = getContractYearSlice(b, selectedYear);
      const aSalary = aSlice?.salary || aSlice?.capHit || 0;
      const bSalary = bSlice?.salary || bSlice?.capHit || 0;
      return bSalary - aSalary;
    });

  const capHoldPlayers = teamCapSheet.players
    .filter((p) => {
      const slice = getContractYearSlice(p, selectedYear);
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

  const playersCapTotal = calculateCapHitTotal(filteredPlayers, selectedYear);
  const capHoldsTotal = calculateCapHoldTotal(capHoldPlayers);
  // Cap totals are precomputed to avoid any mutation during render
  const totalCapHit = playersCapTotal + (showCapHolds ? capHoldsTotal : 0);

  return (
    <div className="text-white">
      <h3 className="text-xl font-semibold mb-2">
        Cap Sheet – {formatYearLabel(selectedYear)}
      </h3>
      <CapSummaryTiles
        teamCapSheet={teamCapSheet}
        selectedYear={selectedYear}
      />

      {/* Year Selector */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {allYears.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-3 py-1 rounded text-sm font-medium border ${
              year === selectedYear
                ? 'bg-lakers text-black border-transparent'
                : 'bg-[#1a1a1a] border-white/20 hover:bg-white/10'
            }`}
          >
            {formatYearLabel(year)}
          </button>
        ))}
      </div>

      {/* Roster Cap Table */}
      <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
        <thead className="bg-[#111]">
          <tr>
            <th className="p-2 text-left">Player</th>
            <th className="p-2 text-left">Pos</th>
            <th className="p-2 text-left">Age</th>
            <th className="p-2 text-left">Cap Hit</th>
            <th className="p-2 text-left">Cap %</th>
            <th className="p-2 text-left">Base Salary</th>
            <th className="p-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {filteredPlayers.map((player, idx) => {
            const slice = getContractYearSlice(player, selectedYear);
            const salary = slice?.salary || slice?.capHit || 0;
            const capHit = getCapHit(player, selectedYear);

            const age = player.age ?? '-';
            const position = player.position ?? '-';
            const capPct = getCapPercentage(capHit, salaryCap);
            const capPctDisplay = capPct ? `${capPct}%` : '—';

            return (
              <tr key={`${player.name}-${idx}`} className="odd:bg-[#171717]">
                <td className="p-2">
                  <button
                    onClick={() => onSelectPlayer && onSelectPlayer(player)}
                    className="text-blue-400 hover:underline"
                  >
                    {playersMap[player.name]?.bio?.displayName ||
                      formatName(player.name)}
                  </button>
                </td>
                <td className="p-2">
                  {POSITION_MAP[position] || position || '—'}
                </td>
                <td className="p-2">{age}</td>
                <td className="p-2">${capHit.toLocaleString()}</td>
                <td className="p-2 text-white/60">{capPctDisplay}</td>
                <td className="p-2">${salary.toLocaleString()}</td>
                <td className="p-2">{renderNotes(player, selectedYear)}</td>
              </tr>
            );
          })}
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
                        {playersMap[p.name]?.bio?.displayName || formatName(p.name)}
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

      <p className="mt-2 font-semibold">
        Total Cap Hit: ${totalCapHit.toLocaleString()}
      </p>
    </div>
  );
};

export default CapSheet;
