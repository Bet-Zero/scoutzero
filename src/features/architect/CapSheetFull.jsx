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
  if (type === 'UFA') return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
  if (type === 'RFA') return 'bg-red-600/10 text-red-400 border border-red-600/30';
  if (type === 'PO') return 'bg-green-600/10 text-green-400 border border-green-600/30';
  if (type === 'TO') return 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
  return 'bg-gray-600/10 text-gray-400 border border-gray-600/30';
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
    <div className="text-white font-sans w-full">
      <h3 className="text-lg font-bold tracking-tight text-white/90 mb-4">
        Future Cap Sheet <span className="text-white/40 font-light">|</span> Multi-Year View
      </h3>

      <div className="bg-[#0f0f0f] border border-white/5 rounded-lg overflow-hidden shadow-2xl shadow-black/50 relative w-full">
        <div className="overflow-x-auto w-full">
          <div className="min-w-full">
            {/* Header */}
            <div className="grid grid-cols-[200px_repeat(7,minmax(100px,1fr))] bg-white/5 border-b border-white/5">
              <div className="sticky left-0 z-10 bg-[#161616] px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-white/40 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                Player
              </div>
              {allYears.map((year) => (
                <div key={year} className="px-2 py-3 text-center text-[10px] uppercase tracking-wider font-semibold text-white/40">
                  {year - 1}-{String(year % 100).padStart(2, '0')}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {sortedPlayers.map((player, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[200px_repeat(7,minmax(100px,1fr))] hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Player Name (Sticky) */}
                  <div className="sticky left-0 z-10 bg-[#0f0f0f] group-hover:bg-[#131313] px-4 py-2 flex items-center border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-colors h-[36px]">
                    <button
                      onClick={() => onSelectPlayer && onSelectPlayer(player)}
                      className="text-xs font-medium text-white/90 hover:text-blue-400 transition-colors text-left truncate w-full"
                    >
                      {player.displayName || player.bio?.displayName || player.name}
                    </button>
                  </div>

                  {/* Years */}
                  {allYears.map((year) => {
                    const entry = getContractYearSlice(player, year);
                    const faYear = player.contract?.freeAgency?.year;
                    const faType = player.contract?.freeAgency?.type;

                    // Handle free agency years (no salary)
                    if (!entry?.salary && !entry?.capHit) {
                      if (faYear === year && faType) {
                        return (
                          <div key={year} className="flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[36px]">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getTagColor(faType)}`}>
                              {faType}
                            </span>
                          </div>
                        );
                      }
                      return <div key={year} className="border-l border-white/[0.02] h-[36px]" />;
                    }

                    // Handle contract years with options
                    const isPO = entry.option === 'Player Option' || entry.option === 'PO';
                    const isTO = entry.option === 'Team Option' || entry.option === 'TO';

                    if (isPO || isTO) {
                      const optionStyle = isPO
                        ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-b-2 border-green-500/30'
                        : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-b-2 border-orange-500/30';

                      return (
                        <div key={year} className={`flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[36px] transition-colors ${optionStyle}`}>
                          <span className="text-xs font-medium tabular-nums tracking-tight">
                            ${entry.salary.toLocaleString()}
                          </span>
                        </div>
                      );
                    }

                    // Regular contract year
                    return (
                      <div key={year} className="flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[36px]">
                        <span className="text-xs font-medium text-white/60 tabular-nums tracking-tight">
                          ${entry.salary.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Total Row */}
              <div className="grid grid-cols-[200px_repeat(7,minmax(100px,1fr))] bg-white/5 border-t border-white/10 font-semibold">
                <div className="sticky left-0 z-10 bg-[#161616] px-4 py-3 text-[10px] uppercase tracking-wider text-white/60 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                  Total Cap
                </div>
                {allYears.map((year) => (
                  <div key={year} className="px-2 py-3 text-center text-xs text-white/90 tabular-nums tracking-tight border-l border-white/[0.02]">
                    ${yearTotals[year].toLocaleString()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section (Cap Holds) */}
        {capHoldPlayers.length > 0 && (
          <div className="bg-white/[0.02] border-t border-white/5">
            <button
              onClick={() => setShowCapHolds(!showCapHolds)}
              className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-2">
                <span>{showCapHolds ? 'Hide' : 'Show'} Cap Holds</span>
                <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">{capHoldPlayers.length}</span>
              </div>
              <span className="text-xs opacity-50">{showCapHolds ? '−' : '+'}</span>
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
                      typeof p.cap_hold === 'object' ? p.cap_hold?.reason : '';

                    return (
                      <div key={idx} className="grid grid-cols-[2fr,1.2fr,3fr] gap-2 px-4 py-2 items-center hover:bg-white/[0.02]">
                        <div className="text-xs text-white/60">
                          {p.displayName || p.bio?.displayName || p.name}
                        </div>
                        <div className="text-xs text-white/40 tabular-nums">${amt.toLocaleString()}</div>
                        <div className="text-[10px] text-white/30">{reason}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CapSheetFull;
