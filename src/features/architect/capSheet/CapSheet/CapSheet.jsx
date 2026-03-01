/**
 * PURPOSE: Current-year cap sheet grid for Architect teams, now annotated with player rules profiles.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2025-12-10: Added PlayerRulesProfile-driven annotations (chunk_01).
 *  - 2025-12-14: Refactored to use shared cap holds utility functions.
 *
 * LINKS:
 *  - Plan: plans/player-rules-architect/plan.md
 *  - Latest Chunk: plans/player-rules-architect/chunks/chunk_01.md
 */
import React, { useState } from 'react';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  getMinimumCapHit,
  getContractYearSlice,
} from '@/features/architect/utils/contractUtils';
import { getActiveUnsignedCapHoldsByEndYear } from '@/features/architect/utils/capHolds';
import CapSummaryTiles from '@/features/architect/CapSummaryTiles';
import { POSITION_MAP } from '@/shared/utils/roles';
import getCapPercentage from '@/features/architect/utils/basicArchitectUtils';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';

// Helper to identify two-way contracts (don't count against cap)
const isTwoWayContract = (player) => {
  const contractType =
    player?.contractType || player?.contract?.contractType || '';
  return contractType.toLowerCase() === 'two-way' || contractType === 'TWO-WAY';
};

import ManageDeadMoneyModal from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';
import ManageExceptionsModal from '@/features/architect/capSheet/modals/ManageExceptionsModal';

const CapSheet = ({
  teamCapSheet,
  currentYear,
  onSelectPlayer,
  onSetDeadCap,
  onSetExceptions,
}) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showCapHolds, setShowCapHolds] = useState(false);
  const [showDeadMoneyModal, setShowDeadMoneyModal] = useState(false);
  const [showExceptionsModal, setShowExceptionsModal] = useState(false);

  const { getProfile } = usePlayerRulesProfiles({
    players: teamCapSheet?.players || [],
    teamCapSheet,
    currentYear: selectedYear,
    teamCode: teamCapSheet?.teamCode,
  });

  // SINGLE SOURCE OF TRUTH: Compute totals once for the entire surface
  const totals = React.useMemo(
    () => computeTeamCapTotals(teamCapSheet, selectedYear),
    [teamCapSheet, selectedYear]
  );

  if (!teamCapSheet) {
    return <div className="text-white/60 p-4">Loading cap sheet...</div>;
  }

  if (!teamCapSheet.players) {
    return <div className="text-white/60 p-4">Loading players...</div>;
  }

  const generateYears = (startYear, count) =>
    Array.from({ length: count }, (_, i) => startYear + i);

  const allYears = generateYears(currentYear, 7);

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
  // const calculateCapHitTotal = (players, yearKey) =>
  //   players.reduce((sum, p) => sum + getCapHit(p, yearKey), 0);

  const renderNotes = (player, yearKey, rulesProfile) => {
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
    if (rulesProfile?.extensionEligibility) {
      const { isEligible, reason, eligibleDate } =
        rulesProfile.extensionEligibility;
      const eligibleYear = eligibleDate
        ? new Date(eligibleDate).getFullYear()
        : null;
      const extLabel = eligibleYear
        ? `EXT '${String(eligibleYear % 100).padStart(2, '0')}`
        : 'EXT';
      notes.push({
        label: extLabel,
        className: isEligible
          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-200',
        title:
          (isEligible
            ? 'Extension eligible'
            : reason || 'Not extension eligible') +
          (eligibleYear
            ? ` (eligible ${eligibleYear - 1}-${String(eligibleYear % 100).padStart(2, '0')})`
            : ''),
      });
    }

    return (
      <span className="flex flex-wrap gap-1.5 justify-end">
        {notes.map((note, i) => (
          <span
            key={i}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/50 border border-white/10 ${
              note.className || ''
            }`}
            title={note.title}
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

  // Get cap holds from teamCapSheet.capHolds (canonical source), filter by selected year
  // Using shared utility - selectedYear is the END year (e.g., 2025 for "2024-25")
  const displayedCapHolds = getActiveUnsignedCapHoldsByEndYear(
    teamCapSheet.capHolds,
    selectedYear
  ).sort((a, b) => (b.amount || 0) - (a.amount || 0));

  // REMOVED: Local totals calculation in favor of SSOT `totals` object
  // const playersCapTotal = calculateCapHitTotal(filteredPlayers, selectedYear);
  // const capHoldsTotal = getActiveUnsignedCapHoldsTotalByEndYear(teamCapSheet.capHolds, selectedYear);
  // const totalCapHit = playersCapTotal + (showCapHolds ? capHoldsTotal : 0);

  const confidenceLabel = React.useMemo(() => {
    const summary = totals?._meta?.rulesSourcesSummary;
    if (!summary) return null; // Fallback or loading state

    // Detailed mapping for display
    switch (summary) {
      case 'real':
        return {
          text: 'Official',
          className: 'text-green-400 bg-green-400/10 border-green-400/20',
        };
      case 'reported':
        return {
          text: 'Reported',
          className: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
        };
      case 'projected':
        return {
          text: 'Projected',
          className: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        };
      case 'unknown':
        return {
          text: 'Unknown',
          className: 'text-red-400 bg-red-400/10 border-red-400/20',
        };
      default:
        return {
          text: summary,
          className: 'text-white/40 bg-white/5 border-white/10',
        };
    }
  }, [totals]);

  return (
    <div className="text-white font-sans">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold tracking-tight text-white/90 flex items-center gap-2">
          <span>
            Cap Sheet <span className="text-white/40 font-light">|</span>{' '}
            {formatYearLabel(selectedYear)}
          </span>
          {confidenceLabel && (
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${confidenceLabel.className}`}
            >
              {confidenceLabel.text}
            </span>
          )}
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
        totals={totals}
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
            const rulesProfile = getProfile(player);

            const age = player.age ?? '-';
            const position = player.position ?? '-';
            // Use totals.salaryCap (SSOT) for cap % to match totals display
            const capPct = getCapPercentage(capHit, totals.salaryCap || 1);
            const capPctDisplay = capPct ? `${capPct}%` : '—';

            return (
              <div
                key={`${player.name}-${idx}`}
                className="grid grid-cols-[2fr,0.8fr,0.6fr,1.2fr,0.8fr,1.2fr,1.5fr] gap-2 px-4 py-2 items-center hover:bg-white/[0.02] transition-colors group"
              >
                <div className="font-medium text-xs text-white/90 truncate">
                  <button
                    data-testid="cap-sheet-player-row-button"
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
                  {renderNotes(player, selectedYear, rulesProfile)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Section (Cap Holds, Total, Actions) */}
        <div className="bg-white/[0.02] border-t border-white/5">
          {/* Cap Holds Toggle */}
          {displayedCapHolds.length > 0 && (
            <div className="border-b border-white/5">
              <button
                onClick={() => setShowCapHolds(!showCapHolds)}
                className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span>{showCapHolds ? 'Hide' : 'Show'} Cap Holds</span>
                  <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">
                    {displayedCapHolds.length}
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
                    {displayedCapHolds.map((h) => (
                      <div
                        key={`${h.playerId}-${h.season}-${h.type}`}
                        className="grid grid-cols-[2fr,1.2fr,3fr] gap-2 px-4 py-2 items-center hover:bg-white/[0.02]"
                      >
                        <div className="text-xs text-white/60">
                          {h.playerName || h.playerId}
                        </div>
                        <div className="text-xs text-white/40 tabular-nums">
                          ${(h.amount || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-white/30">
                          {h.reason || h.type || ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manage Actions Row */}
          <div className="border-b border-white/5 bg-white/[0.015] px-4 py-2 flex items-center justify-end gap-4">
            <button
              data-testid="cap-sheet-manage-exceptions-button"
              onClick={() => setShowExceptionsModal(true)}
              className="text-[10px] font-medium text-white/40 hover:text-white transition-colors flex items-center gap-1"
            >
              <span className="opacity-50">📋</span> Manage Exceptions
            </button>
            <button
              data-testid="cap-sheet-manage-dead-money-button"
              onClick={() => setShowDeadMoneyModal(true)}
              className="text-[10px] font-medium text-white/40 hover:text-white transition-colors flex items-center gap-1"
            >
              <span className="opacity-50">⚙️</span> Manage Dead Money
            </button>
          </div>

          {/* Cap Breakdown */}
          <div className="border-b border-white/5 bg-white/[0.01] px-4 py-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-white/50">
              <span>Player Salaries</span>
              <span className="tabular-nums">
                ${totals.playersTotal.toLocaleString()}
              </span>
            </div>
            {totals.deadMoneyTotal > 0 && (
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span>Dead Money</span>
                <span className="tabular-nums">
                  ${totals.deadMoneyTotal.toLocaleString()}
                </span>
              </div>
            )}
            {totals.capHoldsTotal > 0 && (
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span>Cap Holds</span>
                <span className="tabular-nums">
                  ${totals.capHoldsTotal.toLocaleString()}
                </span>
              </div>
            )}
            {totals.incompleteChargesTotal > 0 && (
              <div
                data-testid="incomplete-roster-charge-row"
                className="flex items-center justify-between text-[10px] text-amber-400/80"
              >
                <span>
                  Incomplete Roster Charge
                  {totals._meta?.incompleteRosterCharge?.missingSlots && (
                    <span className="text-white/40 ml-1">
                      ({totals._meta.incompleteRosterCharge.missingSlots} open{' '}
                      {totals._meta.incompleteRosterCharge.missingSlots === 1
                        ? 'slot'
                        : 'slots'}
                      )
                    </span>
                  )}
                </span>
                <span className="tabular-nums">
                  ${totals.incompleteChargesTotal.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Total Cap Hit */}
          <div className="px-4 py-3 flex items-center justify-between bg-white/[0.02]">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Total Cap Hit
            </span>
            <span className="text-lg font-bold text-white tabular-nums tracking-tight">
              ${totals.totalCapAllocations.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDeadMoneyModal && (
        <ManageDeadMoneyModal
          isOpen={showDeadMoneyModal}
          onClose={() => setShowDeadMoneyModal(false)}
          teamCapSheet={teamCapSheet}
          currentYear={selectedYear}
          onSave={onSetDeadCap}
        />
      )}
      {showExceptionsModal && (
        <ManageExceptionsModal
          isOpen={showExceptionsModal}
          onClose={() => setShowExceptionsModal(false)}
          teamCapSheet={teamCapSheet}
          currentYear={selectedYear}
          onSave={onSetExceptions}
        />
      )}
    </div>
  );
};

export default CapSheet;
