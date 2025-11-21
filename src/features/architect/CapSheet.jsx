import React, { useState } from 'react';
import { formatName } from '@/utils/formatting';
import { getMinimumCapHit } from '@/utils/architect/contractUtils';
import CapSummaryTiles from '@/features/architect/CapSummaryTiles';
import { POSITION_MAP } from '@/utils/roles';
import getCapPercentage from '@/utils/architect/basicArchitectUtils';
import capProjections from '@/utils/architect/capProjections';
import { isTwoWayContract } from '@/utils/roster/contractUtils';

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

  // Generate years starting from current year (not future)
  // Include current year and 6 future years (7 total)
  const allYears = generateYears(currentYear, 7);
  const yearKey = `${selectedYear}-${String((selectedYear + 1) % 100).padStart(
    2,
    '0'
  )}`;
  const salaryCap = capProjections[yearKey]?.cap || 1;

  const formatYearLabel = (year) =>
    `${year}-${String((year + 1) % 100).padStart(2, '0')}`;

  const getCapHit = (player, yearKey) => {
    // Convert yearKey to season string if needed
    const season = typeof yearKey === 'string' && yearKey.includes('-')
      ? yearKey
      : `${yearKey}-${String((yearKey + 1) % 100).padStart(2, '0')}`;
    
    // Try new schema: contract.salariesByYear array (prefer capHit)
    if (player?.contract?.salariesByYear) {
      const yearEntry = player.contract.salariesByYear.find(
        (entry) => entry.season === season
      );
      if (yearEntry) {
        const capHit = yearEntry.capHit || yearEntry.salary || 0;
        if (player.isMinimum && player.yearsOfService >= 3) {
          return getMinimumCapHit(player.yearsOfService);
        }
        return capHit;
      }
    }
    
    // Fallback to old schema: contract_clean.salaries_by_year object
    const salary =
      player.contract_clean?.salaries_by_year?.[yearKey]?.salary ||
      player.contract_clean?.salaries_by_year?.[yearKey - 1]?.salary ||
      player.contract_clean?.salaries_by_year?.[yearKey + 1]?.salary ||
      0;
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
    // Try new schema first
    const season = typeof yearKey === 'string' && yearKey.includes('-')
      ? yearKey
      : `${yearKey}-${String((yearKey + 1) % 100).padStart(2, '0')}`;
    
    let option = null;
    let guaranteed = true;
    
    if (player?.contract?.salariesByYear) {
      const yearEntry = player.contract.salariesByYear.find(
        (entry) => entry.season === season
      );
      if (yearEntry) {
        option = yearEntry.option || null;
        guaranteed = yearEntry.guaranteed !== false;
      }
    }
    
    // Fallback to old schema
    if (option === null) {
      option = player.contract_clean?.salaries_by_year?.[yearKey]?.option || null;
      guaranteed = player.contract_clean?.salaries_by_year?.[yearKey]?.guaranteed !== false;
    }
    
    const isPO = option === 'Player Option';
    const isTO = option === 'Team Option';
    const isNG = guaranteed === false;

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

  // Filter players who have salary data for the selected year
  // Exclude two-way contracts from cap calculations
  // Check both selectedYear and selectedYear-1 since contracts might be keyed by start or end year
  const season = `${selectedYear}-${String((selectedYear + 1) % 100).padStart(2, '0')}`;
  const prevSeason = `${selectedYear - 1}-${String(selectedYear % 100).padStart(2, '0')}`;
  const nextSeason = `${selectedYear + 1}-${String((selectedYear + 2) % 100).padStart(2, '0')}`;
  
  const filteredPlayers = teamCapSheet.players
    .filter((p) => {
      // Exclude two-way contracts from cap calculations
      if (isTwoWayContract(p)) return false;
      
      // Try new schema: contract.salariesByYear array
      if (p?.contract?.salariesByYear) {
        const hasSalary = p.contract.salariesByYear.some(
          (entry) => entry.season === season || entry.season === prevSeason || entry.season === nextSeason
        );
        if (hasSalary) return true;
      }
      
      // Fallback to old schema
      const hasSalary =
        p.contract_clean?.salaries_by_year?.[selectedYear] ||
        p.contract_clean?.salaries_by_year?.[selectedYear - 1] ||
        p.contract_clean?.salaries_by_year?.[selectedYear + 1];
      return !!hasSalary;
    })
    .sort((a, b) => {
      const aSalary = getCapHit(a, selectedYear);
      const bSalary = getCapHit(b, selectedYear);
      return bSalary - aSalary;
    });

  const capHoldPlayers = teamCapSheet.players
    .filter((p) => {
      // Check if player has salary (try new schema first)
      let hasSalary = false;
      if (p?.contract?.salariesByYear) {
        hasSalary = p.contract.salariesByYear.some(
          (entry) => entry.season === season || entry.season === prevSeason || entry.season === nextSeason
        );
      }
      
      // Fallback to old schema
      if (!hasSalary) {
        hasSalary =
          !!p.contract_clean?.salaries_by_year?.[selectedYear]?.salary ||
          !!p.contract_clean?.salaries_by_year?.[selectedYear - 1]?.salary ||
          !!p.contract_clean?.salaries_by_year?.[selectedYear + 1]?.salary;
      }
      
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
            // Get salary from new schema first
            let salary = 0;
            if (player?.contract?.salariesByYear) {
              const yearEntry = player.contract.salariesByYear.find(
                (entry) => entry.season === season || entry.season === prevSeason || entry.season === nextSeason
              );
              if (yearEntry) {
                salary = yearEntry.salary || 0;
              }
            }
            
            // Fallback to old schema
            if (salary === 0) {
              salary =
                player.contract_clean?.salaries_by_year?.[selectedYear]?.salary ||
                player.contract_clean?.salaries_by_year?.[selectedYear - 1]
                  ?.salary ||
                player.contract_clean?.salaries_by_year?.[selectedYear + 1]
                  ?.salary ||
                0;
            }
            
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
                    {player.displayName ||
                      playersMap[player.name]?.bio?.displayName ||
                      playersMap[player.displayName]?.bio?.displayName ||
                      formatName(
                        player.name || player.displayName || player.id
                      )}
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
                        {p.displayName ||
                          playersMap[p.name]?.bio?.displayName ||
                          playersMap[p.displayName]?.bio?.displayName ||
                          formatName(p.name || p.displayName || p.id)}
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
