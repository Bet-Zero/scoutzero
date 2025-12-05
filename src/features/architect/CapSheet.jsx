import React, { useState } from 'react';
import {
  getMinimumCapHit,
  getContractYearSlice,
} from '@/features/architect/utils/contractUtils';
import CapSummaryTiles from '@/features/architect/CapSummaryTiles';
import { POSITION_MAP } from '@/shared/utils/roles';
import getCapPercentage from '@/features/architect/utils/basicArchitectUtils';
import capProjections from '@/features/architect/utils/capProjections';

// Helper to identify two-way contracts (don't count against cap)
const isTwoWayContract = (player) => {
  const contractType =
    player?.contractType || player?.contract?.contractType || '';
  return contractType.toLowerCase() === 'two-way' || contractType === 'TWO-WAY';
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
  const yearKey = `${selectedYear - 1}-${String(selectedYear % 100).padStart(
    2,
    '0'
  )}`;
  const salaryCap = capProjections[yearKey]?.cap || 1;

  const formatYearLabel = (year) =>
    `${year - 1}-${String(year % 100).padStart(2, '0')}`;

  const getCapHit = (player, yearKey) => {
    // Two-way contracts don't count against the cap
    if (isTwoWayContract(player)) {
      return 0;
    }
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
    const isPO = option === 'Player Option' || option === 'PO';
    const isTO = option === 'Team Option' || option === 'TO';
    const isNG = slice && slice.guaranteed === false;
    const isTwoWay = isTwoWayContract(player);

    const notes = [];
    if (isTwoWay)
      notes.push({
        label: '2W',
        className: 'bg-white/5 border-white/20 text-white/50',
      });
    if (isPO)
      notes.push({
        label: 'PO',
        className: 'bg-green-500/10 border-green-500/30 text-green-300',
      });
    if (isTO)
      notes.push({
        label: 'TO',
        className: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
      });
    if (player.isMinimum && player.yearsOfService >= 3)
      notes.push({ label: 'Vet Min' });
    if (isNG) notes.push({ label: 'NG' });

    return (
      <span className="flex flex-wrap gap-1.5 justify-end">
        {notes.map((note, i) => (
          <span
            key={i}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/50 border border-white/10 ${
              note.className || ''
            }`}
          >
            {note.label}
          </span>
        ))}
      </span>
    );
  };

  const filteredPlayers = teamCapSheet.players
    .filter((p) => getContractYearSlice(p, selectedYear))
    .sort((a, b) => {
      const aSlice = getContractYearSlice(a, selectedYear);
      const bSlice = getContractYearSlice(b, selectedYear);
      const aSalary = aSlice?.salary ?? aSlice?.capHit ?? 0;
      const bSalary = bSlice?.salary ?? bSlice?.capHit ?? 0;
      return bSalary - aSalary;
    });

  const capHoldPlayers = teamCapSheet.players
    .filter((p) => {
      const slice = getContractYearSlice(p, selectedYear);
      const hasSalary = slice?.salary ?? slice?.capHit;
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
    <div className="text-white font-sans">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold tracking-tight text-white/90">
          Cap Sheet <span className="text-white/40 font-light">|</span>{' '}
          {formatYearLabel(selectedYear)}
        </h3>

        {/* Year Selector */}
        <div className="flex bg-[#0f0f0f] p-0.5 rounded-md border border-white/5">
          {allYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1 rounded text-[10px] font-medium transition-all duration-200 ${
                year === selectedYear
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              {formatYearLabel(year)}
            </button>
          ))}
        </div>
      </div>

      <CapSummaryTiles
        teamCapSheet={teamCapSheet}
        selectedYear={selectedYear}
      />

      {/* Roster Cap Table (Grid Layout) */}
      <div className="mt-4 bg-[#0f0f0f] border border-white/5 rounded-lg overflow-hidden shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="grid grid-cols-[2fr,0.8fr,0.6fr,1.2fr,0.8fr,1.2fr,1.5fr] gap-2 px-4 py-2 bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-wider font-semibold text-white/40">
          <div>Player</div>
          <div>Pos</div>
          <div>Age</div>
          <div className="text-right">Cap Hit</div>
          <div className="text-right">Cap %</div>
          <div className="text-right">Base Salary</div>
          <div>Notes</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5">
          {filteredPlayers.map((player, idx) => {
            const slice = getContractYearSlice(player, selectedYear);
            const salary = slice?.salary ?? slice?.capHit ?? 0;
            const capHit = getCapHit(player, selectedYear);
            const isExtensionSeason = slice?.isExtensionSeason;

            const age = player.age ?? '-';
            const position = player.position ?? '-';
            const capPct = getCapPercentage(capHit, salaryCap);
            const capPctDisplay = capPct ? `${capPct}%` : '—';

            return (
              <div
                key={`${player.name}-${idx}`}
                className="grid grid-cols-[2fr,0.8fr,0.6fr,1.2fr,0.8fr,1.2fr,1.5fr] gap-2 px-4 py-2 items-center hover:bg-white/[0.02] transition-colors group"
              >
                <div className="font-medium text-xs text-white/90 truncate">
                  <button
                    onClick={() => onSelectPlayer && onSelectPlayer(player)}
                    className="hover:text-blue-400 transition-colors text-left truncate w-full"
                  >
                    {player.displayName ||
                      player.bio?.displayName ||
                      player.name}
                  </button>
                </div>
                <div className="text-[10px] text-white/50">
                  {POSITION_MAP[position] || position || '—'}
                </div>
                <div className="text-[10px] text-white/50">{age}</div>
                <div className="text-xs font-medium text-right tabular-nums tracking-tight">
                  <span
                    className={`inline-flex items-center justify-end tabular-nums ${
                      isExtensionSeason
                        ? 'text-cyan-100 bg-cyan-500/10 border border-cyan-500/30 rounded px-2 py-1'
                        : 'text-white/90'
                    }`}
                  >
                    ${capHit.toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-white/50 text-right tabular-nums">
                  {capPctDisplay}
                </div>
                <div className="text-[10px] text-right tabular-nums">
                  <span
                    className={`inline-flex items-center justify-end ${
                      isExtensionSeason ? 'text-cyan-100' : 'text-white/50'
                    }`}
                  >
                    ${salary.toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px]">
                  {renderNotes(player, selectedYear)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Section (Cap Holds + Total) */}
        <div className="bg-white/[0.02] border-t border-white/5">
          {/* Cap Holds Toggle */}
          {capHoldPlayers.length > 0 && (
            <div className="border-b border-white/5">
              <button
                onClick={() => setShowCapHolds(!showCapHolds)}
                className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span>{showCapHolds ? 'Hide' : 'Show'} Cap Holds</span>
                  <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">
                    {capHoldPlayers.length}
                  </span>
                </div>
                <span className="text-xs opacity-50">
                  {showCapHolds ? '−' : '+'}
                </span>
              </button>

              {showCapHolds && (
                <div className="bg-black/20 border-t border-white/5">
                  <div className="grid grid-cols-[2fr,1.2fr,3fr] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-white/30">
                    <div>Player</div>
                    <div>Amount</div>
                    <div>Reason</div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {capHoldPlayers.map((p, idx) => {
                      const amt =
                        typeof p.cap_hold === 'number'
                          ? p.cap_hold
                          : p.cap_hold?.amount || 0;
                      const reason =
                        typeof p.cap_hold === 'object'
                          ? p.cap_hold?.reason
                          : '';

                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[2fr,1.2fr,3fr] gap-2 px-4 py-2 items-center hover:bg-white/[0.02]"
                        >
                          <div className="text-xs text-white/60">
                            {p.displayName || p.bio?.displayName || p.name}
                          </div>
                          <div className="text-xs text-white/40 tabular-nums">
                            ${amt.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-white/30">
                            {reason}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Total Cap Hit */}
          <div className="px-4 py-3 flex items-center justify-between bg-white/[0.02]">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Total Cap Hit
            </span>
            <span className="text-lg font-bold text-white tabular-nums tracking-tight">
              ${totalCapHit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CapSheet;
