import React, { useState } from 'react';
import { getMinimumCapHit } from '@/utils/architect/contractUtils';
import CapSummaryTiles from '@/features/architect/CapSummaryTiles';
import { POSITION_MAP } from '@/utils/roles/positionMap';
import getCapPercentage from '@/utils/architect/getCapPercentage';
import capProjections from '@/utils/architect/capProjections';

const CapSheet = ({ teamCapSheet, currentYear, onSelectPlayer }) => {
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
    const salary =
      player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
    if (player.isMinimum && player.yearsOfService >= 3) {
      return getMinimumCapHit(player.yearsOfService);
    }
    return salary;
  };

  const renderNotes = (player, yearKey) => {
    const option =
      player.contract_clean?.salaries_by_year?.[yearKey]?.option || null;
    const isPO = option === 'Player Option';
    const isTO = option === 'Team Option';
    const isNG =
      player.contract_clean?.salaries_by_year?.[yearKey]?.guaranteed === false;

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
    .filter((p) => p.contract_clean?.salaries_by_year?.[selectedYear])
    .sort((a, b) => {
      const aSalary =
        a.contract_clean?.salaries_by_year?.[selectedYear]?.salary || 0;
      const bSalary =
        b.contract_clean?.salaries_by_year?.[selectedYear]?.salary || 0;
      return bSalary - aSalary;
    });

  const capHoldPlayers = teamCapSheet.players
    .filter((p) => {
      const hasSalary =
        p.contract_clean?.salaries_by_year?.[selectedYear]?.salary;
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

  let totalCapHit = 0;

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
            const salary =
              player.contract_clean?.salaries_by_year?.[selectedYear]?.salary ||
              0;
            const capHit = getCapHit(player, selectedYear);
            totalCapHit += capHit;

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
                    {player.name}
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
                  totalCapHit += amt;
                  return (
                    <tr key={idx} className="odd:bg-[#171717]">
                      <td className="p-2">{p.name}</td>
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
