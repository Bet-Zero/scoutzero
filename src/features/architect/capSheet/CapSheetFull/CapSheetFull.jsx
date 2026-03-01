/**
 * FILE: src/features/architect/CapSheetFull.jsx
 * PURPOSE: Multi-year cap table view with option/FA actions and rules profile annotations.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2025-12-10: Added PlayerRulesProfile indicators for multi-year cap view (chunk_02).
 *  - 2025-12-11: Updated bird rights display to use icons instead of text labels.
 *
 * LINKS:
 *  - Plan: plans/_archive/player-rules-architect/plan.md
 *  - Latest Chunk: plans/_archive/player-rules-architect/chunks/chunk_02.md
 */
import React, { useState, useMemo } from 'react';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import BirdRightsIcon from '@/shared/components/BirdRightsIcon';

// Helper to identify two-way contracts (don't count against cap)
const isTwoWayContract = (player) => {
  const contractType =
    player?.contractType || player?.contract?.contractType || '';
  return contractType.toLowerCase() === 'two-way' || contractType === 'TWO-WAY';
};

// Helper to normalize free agent type to display format
const normalizeFAType = (type) => {
  if (!type) return null;
  const t = String(type).toLowerCase();
  if (t === 'unrestricted' || t === 'ufa') return 'UFA';
  if (t === 'restricted' || t === 'rfa') return 'RFA';
  return String(type).toUpperCase();
};

// Color scheme for tags - matching chart style
const getTagColor = (type) => {
  if (type === 'UFA') return 'bg-blue-500/30 text-white/70';
  if (type === 'RFA') return 'bg-red-600/30 text-white/70';
  if (type === 'PO') return 'bg-green-600/30 text-white/70';
  if (type === 'TO') return 'bg-orange-500/30 text-white/70';
  if (type === 'TWO-WAY') return 'bg-white/10 text-white/60';
  return 'bg-gray-600 text-white/70';
};

const formatQOText = (amount) => {
  if (amount == null) return null;
  return `QO $${(amount / 1_000_000).toFixed(1)}M`;
};

const formatSeasonLabel = (year) =>
  `${year - 1}-${String(year % 100).padStart(2, '0')}`;

const formatExtLabel = (year) => `EXT '${String(year % 100).padStart(2, '0')}`;

const getExtensionEligibleYear = (rulesProfile) => {
  const eligibleDate = rulesProfile?.extensionEligibility?.eligibleDate;
  if (!eligibleDate) return null;
  const d = new Date(eligibleDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
};

const CapSheetFull = ({
  teamCapSheet,
  currentYear,
  onSelectPlayer,
  onActionClick,
  getRulesProfileForYear = null,
}) => {
  const [showCapHolds, setShowCapHolds] = useState(false);

  if (!teamCapSheet || !teamCapSheet.players) return null;

  // Generate 7 years starting from currentYear
  const allYears = Array.from({ length: 7 }, (_, i) => currentYear + i);

  // Sort players by current year salary descending
  const sortedPlayers = teamCapSheet.players
    .filter((p) => getContractYearSlice(p, currentYear))
    .sort((a, b) => {
      const aSlice = getContractYearSlice(a, currentYear);
      const bSlice = getContractYearSlice(b, currentYear);
      const aSalary = aSlice?.salary ?? aSlice?.capHit ?? 0;
      const bSalary = bSlice?.salary ?? bSlice?.capHit ?? 0;
      return bSalary - aSalary;
    });

  // For the separate table below, likely show all active holds or just imminent ones?
  // Let's show all valid holds.
  const displayedCapHolds = (teamCapSheet.capHolds || []).filter(
    (h) => !h.isSigned
  );

  // SSOT: Use computeTeamCapTotals for each year to include
  // players + dead money + cap holds + incomplete roster charges.
  // Replaces local reduce that missed dead money and incomplete charges.
  const yearTotals = useMemo(() => {
    const totals = {};
    for (const year of allYears) {
      const result = computeTeamCapTotals(teamCapSheet, year);
      totals[year] = result.totalCapAllocations;
    }
    return totals;
  }, [teamCapSheet, currentYear]);

  return (
    <div className="text-white font-sans w-full">
      <h3 className="text-lg font-bold tracking-tight text-white/90 mb-4">
        Future Cap Sheet <span className="text-white/40 font-light">|</span>{' '}
        Multi-Year View
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
                <div
                  key={year}
                  className="px-2 py-3 text-center text-[10px] uppercase tracking-wider font-semibold text-white/40"
                >
                  {year - 1}-{String(year % 100).padStart(2, '0')}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {sortedPlayers.map((player, idx) => {
                const isTwoWay = isTwoWayContract(player);
                const profileForCurrentYear =
                  getRulesProfileForYear?.(player, currentYear) || null;
                const extensionEligibleYear = getExtensionEligibleYear(
                  profileForCurrentYear
                );
                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-[200px_repeat(7,minmax(100px,1fr))] hover:bg-white/[0.02] transition-colors group ${isTwoWay ? 'opacity-70' : ''}`}
                  >
                    {/* Player Name (Sticky) */}
                    <div className="sticky left-0 z-10 bg-[#0f0f0f] group-hover:bg-[#131313] px-4 py-2 flex items-center gap-2 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-colors h-[36px]">
                      <button
                        data-testid="cap-sheet-full-player-row-button"
                        onClick={() => onSelectPlayer && onSelectPlayer(player)}
                        className="text-xs font-medium text-white/90 hover:text-blue-400 transition-colors text-left truncate flex-1"
                      >
                        {player.displayName ||
                          player.bio?.displayName ||
                          player.name}
                      </button>
                      {isTwoWay && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 ${getTagColor('TWO-WAY')}`}
                        >
                          2W
                        </span>
                      )}
                    </div>

                    {/* Years */}
                    {allYears.map((year) => {
                      const entry = getContractYearSlice(player, year);
                      const freeAgency =
                        player.futureContract?.freeAgency ||
                        player.contract?.freeAgency ||
                        {};
                      const fallbackFaYear = freeAgency?.year;
                      const fallbackFaType = normalizeFAType(freeAgency?.type);
                      const rulesProfileForYear =
                        getRulesProfileForYear?.(player, year) || null;
                      const rfaInfo = rulesProfileForYear?.restrictedFreeAgency;
                      const birdRightsTypeForYear =
                        rulesProfileForYear?.birdRights?.type;
                      const derivedFaYear =
                        rulesProfileForYear?.contractSummary?.freeAgencyYear ??
                        fallbackFaYear;
                      const derivedFaTypeRaw =
                        rulesProfileForYear?.contractSummary?.freeAgencyType ||
                        fallbackFaType;
                      const derivedFaType = normalizeFAType(derivedFaTypeRaw);
                      const isExtension = entry?.isExtensionSeason;
                      const salaryValue = entry?.salary ?? entry?.capHit ?? 0;
                      const faLabel = derivedFaType || 'FA';
                      const isExtensionEligibleYear =
                        extensionEligibleYear && extensionEligibleYear === year;

                      // Free agency year: faYear of 2027 means they become FA in 2027, for the 2027-28 season
                      // The column showing "2027-28" has year === 2028, so check faYear + 1 === year
                      const isFreeAgentYear =
                        derivedFaYear &&
                        derivedFaType &&
                        derivedFaYear + 1 === year;

                      // Handle free agency years (no salary)
                      if (
                        !entry ||
                        (entry?.salary == null && entry?.capHit == null)
                      ) {
                        if (isFreeAgentYear) {
                          return (
                            <div
                              key={year}
                              onClick={() =>
                                onActionClick?.(
                                  player,
                                  faLabel === 'RFA' ? 'rfa' : 'ufa',
                                  year
                                )
                              }
                              className="relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[36px] cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 transition-all"
                              title={
                                rfaInfo?.reason ||
                                rulesProfileForYear?.contractSummary
                                  ?.freeAgencyType
                              }
                            >
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getTagColor(faLabel)} hover:scale-105 transition-transform`}
                              >
                                {faLabel}
                              </span>
                              {(birdRightsTypeForYear ||
                                rfaInfo?.qualifyingOfferAmount != null) && (
                                <span className="absolute bottom-1 right-1 text-[10px] text-white/60 leading-tight text-right">
                                  {birdRightsTypeForYear && (
                                    <div
                                      className="flex items-center justify-center"
                                      data-testid="fa-bird-rights"
                                    >
                                      <BirdRightsIcon
                                        type={birdRightsTypeForYear}
                                        size={20}
                                      />
                                    </div>
                                  )}
                                  {rfaInfo?.qualifyingOfferAmount != null && (
                                    <span className="block">
                                      {formatQOText(
                                        rfaInfo.qualifyingOfferAmount
                                      )}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div
                            key={year}
                            className="border-l border-white/[0.02] h-[36px]"
                          />
                        );
                      }

                      // Handle contract years with options
                      const isPO =
                        entry.option === 'Player Option' ||
                        entry.option === 'PO';
                      const isTO =
                        entry.option === 'Team Option' || entry.option === 'TO';

                      if (isPO || isTO) {
                        const optionStyle = isPO
                          ? 'bg-green-600/10 hover:bg-green-600/20 border-b border-green-600/30'
                          : 'bg-orange-500/10 hover:bg-orange-500/20 border-b border-orange-500/30';

                        return (
                          <div
                            key={year}
                            onClick={() =>
                              onActionClick?.(player, isPO ? 'po' : 'to', year)
                            }
                            className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[36px] transition-colors cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 ${optionStyle}`}
                            title={`Click to manage ${isPO ? 'Player' : 'Team'} Option`}
                          >
                            <span
                              className={`text-xs font-medium tabular-nums tracking-tight ${
                                isExtension
                                  ? 'text-cyan-200/90'
                                  : 'text-white/70'
                              }`}
                            >
                              ${salaryValue.toLocaleString()}
                            </span>
                          </div>
                        );
                      }

                      // Regular contract year
                      return (
                        <div
                          key={year}
                          className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[36px] ${
                            isExtension
                              ? 'bg-cyan-500/5 border-cyan-500/20'
                              : ''
                          }`}
                        >
                          {isExtensionEligibleYear && (
                            <span
                              className="absolute top-0.5 left-1 text-[9px] font-bold uppercase px-1 rounded bg-cyan-500/20 text-cyan-50 border border-cyan-500/30"
                              data-testid="extension-eligibility-badge"
                              title={`Extension eligible starting ${formatSeasonLabel(year)} offseason`}
                            >
                              {formatExtLabel(year)}
                            </span>
                          )}
                          <span
                            className={`text-xs font-medium tabular-nums tracking-tight ${
                              isExtension ? 'text-cyan-200/90' : 'text-white/60'
                            }`}
                          >
                            ${salaryValue.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Total Row */}
              <div className="grid grid-cols-[200px_repeat(7,minmax(100px,1fr))] bg-white/5 border-t border-white/10 font-semibold">
                <div className="sticky left-0 z-10 bg-[#161616] px-4 py-3 text-[10px] uppercase tracking-wider text-white/60 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                  Total Cap
                </div>
                {allYears.map((year) => (
                  <div
                    key={year}
                    className="px-2 py-3 text-center text-xs text-white/90 tabular-nums tracking-tight border-l border-white/[0.02]"
                  >
                    ${yearTotals[year].toLocaleString()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section (Cap Holds) */}
      </div>

      {/* Separate Cap Holds Table */}
      {/* Separate Cap Holds Table */}
      {displayedCapHolds.length > 0 &&
        (() => {
          // 1. Create a map of player ID/Name to index from the main sortedPlayers list
          // This allows us to replicate the main table's sort order.
          const playerSortMap = new Map();
          sortedPlayers.forEach((p, idx) => {
            if (p.id) playerSortMap.set(p.id, idx);
            if (p.player_id) playerSortMap.set(p.player_id, idx);
            if (p.name) playerSortMap.set(p.name, idx);
          });

          // 2. Split holds into "Roster Players" (Group A) and "Legacy/Other" (Group B)
          const rosterHolds = [];
          const otherHolds = [];

          displayedCapHolds.forEach((h) => {
            const id = h.playerId || h.playerName;
            if (playerSortMap.has(id) || playerSortMap.has(h.playerName)) {
              rosterHolds.push(h);
            } else {
              otherHolds.push(h);
            }
          });

          // 3. Sort Group A to match main table
          rosterHolds.sort((a, b) => {
            const idxA =
              playerSortMap.get(a.playerId) ??
              playerSortMap.get(a.playerName) ??
              9999;
            const idxB =
              playerSortMap.get(b.playerId) ??
              playerSortMap.get(b.playerName) ??
              9999;
            return idxA - idxB;
          });

          const renderHoldRow = (h, idx, isLegacy = false) => (
            <div
              key={`${h.playerId}-${idx}`}
              className={`grid grid-cols-[140px_60px_repeat(7,minmax(100px,1fr))] items-center hover:bg-white/[0.02] transition-colors group ${isLegacy ? 'bg-white/[0.01]' : ''}`}
            >
              {/* Name Column */}
              <div className="px-4 py-2 flex items-center border-r border-white/5 h-[36px] relative overflow-hidden">
                <span
                  className="text-xs font-medium text-white/90 truncate w-full"
                  title={h.playerName || h.playerId}
                >
                  {h.playerName || h.playerId}
                </span>

                {/* Renounce Button - Absolute Positioned on Hover */}
                <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    data-testid="cap-sheet-full-absolve-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionClick?.(h, 'renounce');
                    }}
                    className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded border border-red-500/20"
                  >
                    Absolve
                  </button>
                </div>
              </div>

              {/* Tag Column */}
              <div className="px-1 py-1 flex items-center justify-center border-r border-white/5 h-[36px]">
                <span
                  className={`${getTagColor(h.type)} px-1 py-px rounded-[2px] text-[8px] font-bold uppercase tracking-wider truncate max-w-full`}
                >
                  {h.type === 'FA Cap Hold' ? 'HOLD' : h.type || 'HOLD'}
                </span>
              </div>

              {/* Year Columns */}
              {allYears.map((year) => {
                const seasonStr = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
                const matchSeason = h.season === seasonStr;

                if (matchSeason) {
                  return (
                    <div
                      key={year}
                      className="flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[36px] bg-cyan-900/10"
                    >
                      <span className="text-xs font-mono text-cyan-200 tabular-nums">
                        ${(h.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={year}
                    className="border-l border-white/[0.02] h-[36px] opacity-30"
                  />
                );
              })}
            </div>
          );

          return (
            <div className="mt-8">
              <button
                data-testid="cap-sheet-full-cap-holds-toggle"
                onClick={() => setShowCapHolds(!showCapHolds)}
                className="w-full flex items-center justify-between text-left group mb-3"
              >
                <h3 className="text-md font-bold tracking-tight text-white/90 flex items-center gap-2 group-hover:text-white transition-colors">
                  <span
                    className={`transform transition-transform duration-200 ${showCapHolds ? 'rotate-90' : ''}`}
                  >
                    ▶
                  </span>
                  Cap Holds
                  <span className="bg-white/10 text-white/60 px-2 py-0.5 rounded text-xs">
                    {displayedCapHolds.length}
                  </span>
                </h3>
                <div className="h-px bg-white/10 flex-1 ml-4 group-hover:bg-white/20 transition-colors"></div>
              </button>

              {showCapHolds && (
                <div className="bg-[#0f0f0f] border border-white/5 rounded-lg overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Header */}
                  <div className="grid grid-cols-[140px_60px_repeat(7,minmax(100px,1fr))] bg-white/5 border-b border-white/5">
                    <div className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-white/40 border-r border-white/5 truncate">
                      Player
                    </div>
                    <div className="px-1 py-3 text-center text-[9px] uppercase tracking-wider font-semibold text-white/40 border-r border-white/5">
                      Type
                    </div>
                    {allYears.map((year) => (
                      <div
                        key={year}
                        className="px-2 py-3 text-center text-[10px] uppercase tracking-wider font-semibold text-white/40"
                      >
                        {year - 1}-{String(year % 100).padStart(2, '0')}
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-white/5">
                    {rosterHolds.map((h, i) => renderHoldRow(h, i, false))}

                    {rosterHolds.length > 0 && otherHolds.length > 0 && (
                      <div className="h-[2px] bg-white/10 w-full col-span-full relative">
                        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-white/20"></div>
                      </div>
                    )}

                    {otherHolds.map((h, i) => renderHoldRow(h, i, true))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
};

export default CapSheetFull;
