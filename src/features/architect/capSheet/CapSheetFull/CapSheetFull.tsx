/**
 * FILE: src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx
 * PURPOSE: Multi-year cap table view with option/FA actions and rules profile annotations.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2025-12-10: Added PlayerRulesProfile indicators for multi-year cap view (chunk_02).
 *  - 2025-12-11: Updated bird rights display to use icons instead of text labels.
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E88.
 *  - 2026-03-29: Clarified multi-year surface hierarchy between player rows, cap holds, and canonical yearly totals.
 */
import React, { useState, useMemo } from 'react';
import type {
  PlayerRulesProfile,
  PlayerRulesProfileInput,
  PlayerRulesProfileTeamCapSheet,
} from '@/features/architect/types';
import {
  getContractYearSlice,
  getPlayerCapSheetAmountsForYear,
  isTwoWayContract,
} from '@/features/architect/utils/contractUtils';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { BirdRightsIcon } from '@/shared/components/BirdRightsIcon';

type NumericLike = number | string | null | undefined;
type RulesProfileLike = PlayerRulesProfile | null;
type CapSheetFullPlayerLike = PlayerRulesProfileInput;
type CapHoldLike = {
  playerId?: string | number | null;
  playerName?: string | null;
  season?: string | null;
  amount?: NumericLike;
  type?: string | null;
  isSigned?: boolean | null;
};
type TeamCapSheetLike = PlayerRulesProfileTeamCapSheet & {
  players?: CapSheetFullPlayerLike[] | null;
};
type ContractYearSliceLike = ReturnType<typeof getContractYearSlice>;
type VisiblePlayerEntry = {
  player: CapSheetFullPlayerLike;
  currentYearSlice: ContractYearSliceLike;
  currentYearAmount: number;
  firstVisibleYear: number;
  firstVisibleAmount: number;
  originalIndex: number;
};

export type CapSheetActionType = 'rfa' | 'ufa' | 'po' | 'to' | 'renounce';
export type CapSheetModalActionType = Exclude<CapSheetActionType, 'renounce'>;
export type CapSheetImmediateActionType = Extract<
  CapSheetActionType,
  'renounce'
>;

type CapSheetFullProps = {
  teamCapSheet?: TeamCapSheetLike | null;
  currentYear: number;
  onOpenPlayerContractModal?:
    | ((player: CapSheetFullPlayerLike) => void)
    | null;
  onLaunchContractAction?:
    | ((
        player: CapSheetFullPlayerLike,
        action: CapSheetModalActionType,
        year: number
      ) => void)
    | null;
  onRenounceCapHold?: ((capHold: CapHoldLike) => void) | null;
  // Legacy aliases kept temporarily while the live dashboard route migrates.
  onSelectPlayer?: ((player: CapSheetFullPlayerLike) => void) | null;
  onActionClick?:
    | ((
        item: CapSheetFullPlayerLike | CapHoldLike,
        action: CapSheetActionType,
        year?: number
      ) => void)
    | null;
  getRulesProfileForYear?:
    | ((player: CapSheetFullPlayerLike, year: number) => RulesProfileLike)
    | null;
};

const CAP_SHEET_FULL_SURFACE_LABELS = {
  primary: 'Primary multi-year cap sheet surface',
  playerDetail: 'Multi-year player detail surface',
  canonicalYearlyTotals: 'Multi-year canonical yearly totals surface',
  capHoldsDetail: 'Multi-year cap holds detail surface',
} as const;

// Helper to normalize free agent type to display format
const normalizeFAType = (type: string | null | undefined): string | null => {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === 'unrestricted' || t === 'ufa') return 'UFA';
  if (t === 'restricted' || t === 'rfa') return 'RFA';
  return type.toUpperCase();
};

// Color scheme for tags - matching chart style
const getTagColor = (type: string | null) => {
  if (type === 'UFA') return 'bg-blue-500/30 text-white/70';
  if (type === 'RFA') return 'bg-red-600/30 text-white/70';
  if (type === 'PO') return 'bg-green-600/30 text-white/70';
  if (type === 'TO') return 'bg-orange-500/30 text-white/70';
  if (type === 'TWO-WAY') return 'bg-white/10 text-white/60';
  return 'bg-gray-600 text-white/70';
};

const formatQOText = (amount: NumericLike) => {
  if (amount == null) return null;
  return `QO $${(Number(amount) / 1_000_000).toFixed(1)}M`;
};

const formatCapSheetMoney = (amount: NumericLike) =>
  `$${Number(amount ?? 0).toLocaleString()}`;

const formatSeasonLabel = (year: number) =>
  `${year - 1}-${String(year % 100).padStart(2, '0')}`;

const formatExtLabel = (year: number) =>
  `EXT '${String(year % 100).padStart(2, '0')}`;

const getExtensionEligibleYear = (rulesProfile: RulesProfileLike) => {
  const eligibleDate = rulesProfile?.extensionEligibility?.eligibleDate;
  if (!eligibleDate) return null;
  const d = new Date(eligibleDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
};

type ContractAmountDisplayProps = {
  capHit: number;
  baseSalary: number;
  hasCapHitAdjustment: boolean;
  primaryClassName: string;
  secondaryClassName: string;
};

const ContractAmountDisplay = ({
  capHit,
  baseSalary,
  hasCapHitAdjustment,
  primaryClassName,
  secondaryClassName,
}: ContractAmountDisplayProps) => {
  if (!hasCapHitAdjustment) {
    return <span className={primaryClassName}>{formatCapSheetMoney(capHit)}</span>;
  }

  return (
    <span
      className="flex flex-col items-center leading-tight"
      title={`Cap hit counts as ${formatCapSheetMoney(capHit)}; base salary is ${formatCapSheetMoney(baseSalary)}.`}
    >
      <span className={primaryClassName}>{formatCapSheetMoney(capHit)}</span>
      <span className={secondaryClassName}>
        Base {formatCapSheetMoney(baseSalary)}
      </span>
    </span>
  );
};

export const CapSheetFull = ({
  teamCapSheet,
  currentYear,
  onOpenPlayerContractModal,
  onLaunchContractAction,
  onRenounceCapHold,
  onSelectPlayer,
  onActionClick,
  getRulesProfileForYear = null,
}: CapSheetFullProps) => {
  const [showCapHolds, setShowCapHolds] = useState(false);
  const openPlayerContractModal =
    onOpenPlayerContractModal ?? onSelectPlayer ?? null;
  const launchContractAction =
    onLaunchContractAction ??
    ((player: CapSheetFullPlayerLike, action: CapSheetModalActionType, year: number) =>
      onActionClick?.(player, action, year));
  const renounceCapHold =
    onRenounceCapHold ??
    ((capHold: CapHoldLike) => onActionClick?.(capHold, 'renounce'));

  if (!teamCapSheet || !teamCapSheet.players) return null;

  // Generate 7 years starting from currentYear
  const allYears = useMemo(
    () => Array.from({ length: 7 }, (_, i) => currentYear + i),
    [currentYear]
  );

  const sortedPlayers = useMemo(() => {
    const visiblePlayers = (teamCapSheet.players || [])
      .map((player, originalIndex): VisiblePlayerEntry | null => {
        const currentYearSlice = getContractYearSlice(player, currentYear);
        const currentYearAmount =
          Number(currentYearSlice?.salary ?? currentYearSlice?.capHit ?? 0) || 0;

        let firstVisibleYear: number | null = null;
        let firstVisibleAmount = 0;

        for (const year of allYears) {
          const yearSlice = getContractYearSlice(player, year);
          if (!yearSlice) continue;

          firstVisibleYear = year;
          firstVisibleAmount =
            Number(yearSlice.salary ?? yearSlice.capHit ?? 0) || 0;
          break;
        }

        if (firstVisibleYear == null) {
          return null;
        }

        return {
          player,
          currentYearSlice,
          currentYearAmount,
          firstVisibleYear,
          firstVisibleAmount,
          originalIndex,
        };
      })
      .filter((entry): entry is VisiblePlayerEntry => entry !== null);

    visiblePlayers.sort((a, b) => {
      const aHasCurrentYearSlice = Boolean(a.currentYearSlice);
      const bHasCurrentYearSlice = Boolean(b.currentYearSlice);

      if (aHasCurrentYearSlice !== bHasCurrentYearSlice) {
        return aHasCurrentYearSlice ? -1 : 1;
      }

      if (aHasCurrentYearSlice && bHasCurrentYearSlice) {
        const currentYearDelta = b.currentYearAmount - a.currentYearAmount;
        if (currentYearDelta !== 0) {
          return currentYearDelta;
        }

        return a.originalIndex - b.originalIndex;
      }

      const firstVisibleYearDelta = a.firstVisibleYear - b.firstVisibleYear;
      if (firstVisibleYearDelta !== 0) {
        return firstVisibleYearDelta;
      }

      const firstVisibleAmountDelta =
        b.firstVisibleAmount - a.firstVisibleAmount;
      if (firstVisibleAmountDelta !== 0) {
        return firstVisibleAmountDelta;
      }

      return a.originalIndex - b.originalIndex;
    });

    return visiblePlayers.map((entry) => entry.player);
  }, [teamCapSheet.players, currentYear, allYears]);

  // For the separate table below, likely show all active holds or just imminent ones?
  // Let's show all valid holds.
  const displayedCapHolds = ((teamCapSheet.capHolds || []) as CapHoldLike[]).filter(
    (h: CapHoldLike) => !h.isSigned
  );

  // SSOT: Use computeTeamCapTotals for each year to include
  // players + dead money + cap holds + incomplete roster charges.
  // Replaces local reduce that missed dead money and incomplete charges.
  const yearTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const year of allYears) {
      const result = computeTeamCapTotals(
        teamCapSheet
          ? { ...teamCapSheet, players: teamCapSheet.players?.map(p => ({ ...p })) }
          : null,
        year
      );
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

      <section
        aria-label={CAP_SHEET_FULL_SURFACE_LABELS.primary}
        className="w-full"
      >
        <div className="bg-[#0f0f0f] border border-white/5 rounded-lg overflow-hidden shadow-2xl shadow-black/50 relative w-full">
          {/* SUPPORTING DETAIL SURFACE: Player rows explain season-by-season contract detail.
              They do not own canonical yearly totals truth. */}
          <section aria-label={CAP_SHEET_FULL_SURFACE_LABELS.playerDetail}>
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.03]">
              <p className="text-[10px] text-white/40 leading-relaxed">
                Player rows show season-by-season contract detail only. Total
                Cap is the canonical yearly cap total and can also include cap
                holds, dead money, and incomplete roster charges.
              </p>
            </div>

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
                            onClick={() => openPlayerContractModal?.(player)}
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
                          const rowAmounts = getPlayerCapSheetAmountsForYear(
                            player,
                            year
                          );
                          const entry = rowAmounts.contractSlice;
                          const freeAgency =
                            player.futureContract?.freeAgency ||
                            player.contract?.freeAgency ||
                            {};
                          const fallbackFaYear =
                            typeof freeAgency === 'object' && freeAgency !== null
                              ? freeAgency.year
                              : undefined;
                          const fallbackFaType = normalizeFAType(
                            typeof freeAgency === 'object' && freeAgency !== null
                              ? freeAgency.type
                              : undefined
                          );
                          const rulesProfileForYear =
                            getRulesProfileForYear?.(player, year) || null;
                          const rfaInfo =
                            rulesProfileForYear?.restrictedFreeAgency;
                          const birdRightsTypeForYear =
                            rulesProfileForYear?.birdRights?.type;
                          const derivedFaYear =
                            rulesProfileForYear?.contractSummary?.freeAgencyYear ??
                            fallbackFaYear;
                          const derivedFaTypeRaw =
                            rulesProfileForYear?.contractSummary?.freeAgencyType ||
                            fallbackFaType;
                          const derivedFaType =
                            normalizeFAType(derivedFaTypeRaw);
                          const isExtension = entry?.isExtensionSeason;
                          const faLabel = derivedFaType || 'FA';
                          const isExtensionEligibleYear =
                            extensionEligibleYear &&
                            extensionEligibleYear === year;

                          // Free agency year: faYear of 2027 means they become FA in 2027, for the 2027-28 season
                          // The column showing "2027-28" has year === 2028, so check faYear + 1 === year
                          const isFreeAgentYear =
                            derivedFaYear &&
                            derivedFaType &&
                            Number(derivedFaYear) + 1 === year;

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
                                    launchContractAction?.(
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
                            entry.option === 'Team Option' ||
                            entry.option === 'TO';

                          if (isPO || isTO) {
                            const optionStyle = isPO
                              ? 'bg-green-600/10 hover:bg-green-600/20 border-b border-green-600/30'
                              : 'bg-orange-500/10 hover:bg-orange-500/20 border-b border-orange-500/30';

                            return (
                              <div
                                key={year}
                                onClick={() =>
                                  launchContractAction?.(
                                    player,
                                    isPO ? 'po' : 'to',
                                    year
                                  )
                                }
                                className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[36px] transition-colors cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 ${optionStyle}`}
                                title={`Click to manage ${isPO ? 'Player' : 'Team'} Option`}
                              >
                                <ContractAmountDisplay
                                  capHit={rowAmounts.capHit}
                                  baseSalary={rowAmounts.baseSalary}
                                  hasCapHitAdjustment={
                                    rowAmounts.hasCapHitAdjustment
                                  }
                                  primaryClassName={`text-xs font-medium tabular-nums tracking-tight ${
                                    isExtension
                                      ? 'text-cyan-200/90'
                                      : 'text-white/70'
                                  }`}
                                  secondaryClassName={`text-[8px] uppercase tracking-wider tabular-nums ${
                                    isExtension
                                      ? 'text-cyan-100/60'
                                      : 'text-white/45'
                                  }`}
                                />
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
                              <ContractAmountDisplay
                                capHit={rowAmounts.capHit}
                                baseSalary={rowAmounts.baseSalary}
                                hasCapHitAdjustment={
                                  rowAmounts.hasCapHitAdjustment
                                }
                                primaryClassName={`text-xs font-medium tabular-nums tracking-tight ${
                                  isExtension
                                    ? 'text-cyan-200/90'
                                    : 'text-white/60'
                                }`}
                                secondaryClassName={`text-[8px] uppercase tracking-wider tabular-nums ${
                                  isExtension
                                    ? 'text-cyan-100/60'
                                    : 'text-white/40'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* CANONICAL TOTALS CONSUMER SURFACE: The Total Cap row reads
              computeTeamCapTotals(...) outputs directly and remains the
              canonical yearly totals destination for this view. */}
          <section
            aria-label={CAP_SHEET_FULL_SURFACE_LABELS.canonicalYearlyTotals}
            className="border-t border-white/5 bg-white/[0.02]"
          >
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.03] space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                Canonical Yearly Totals
              </p>
              <p className="text-[10px] text-white/40 leading-relaxed">
                Player rows above and cap hold details below support the same
                future-year cap story.
              </p>
            </div>

            <div className="overflow-x-auto w-full">
              <div className="min-w-full">
                <div className="grid grid-cols-[200px_repeat(7,minmax(100px,1fr))] bg-white/5 font-semibold">
                  <div className="sticky left-0 z-10 bg-[#161616] px-4 py-3 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                    <span className="block text-[10px] uppercase tracking-wider text-white/60">
                      Total Cap
                    </span>
                    <span className="mt-1 block text-[8px] uppercase tracking-[0.18em] text-white/35">
                      Canonical yearly total
                    </span>
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
          </section>
        </div>

        {/* SUPPORTING DETAIL SURFACE: Cap holds remain separate from player rows
            and explain part of the same canonical Total Cap story. */}
        {displayedCapHolds.length > 0 &&
          (() => {
          // 1. Create a map of player ID/Name to index from the main sortedPlayers list
          // This allows us to replicate the main table's sort order.
          const playerSortMap = new Map<string | number, number>();
          sortedPlayers.forEach((p, idx) => {
            if (p.id) playerSortMap.set(p.id, idx);
            if (p.player_id) playerSortMap.set(p.player_id, idx);
            if (p.name) playerSortMap.set(p.name, idx);
          });

          // 2. Split holds into "Roster Players" (Group A) and "Legacy/Other" (Group B)
          const rosterHolds: CapHoldLike[] = [];
          const otherHolds: CapHoldLike[] = [];

          displayedCapHolds.forEach((h) => {
            const id = h.playerId || h.playerName;
            if (playerSortMap.has(id || '') || playerSortMap.has(h.playerName || '')) {
              rosterHolds.push(h);
            } else {
              otherHolds.push(h);
            }
          });

          // 3. Sort Group A to match main table
          rosterHolds.sort((a, b) => {
            const idxA =
              playerSortMap.get(a.playerId || '') ??
              playerSortMap.get(a.playerName || '') ??
              9999;
            const idxB =
              playerSortMap.get(b.playerId || '') ??
              playerSortMap.get(b.playerName || '') ??
              9999;
            return idxA - idxB;
          });

          const renderHoldRow = (h: CapHoldLike, idx: number, isLegacy = false) => (
            <div
              key={`${h.playerId}-${idx}`}
              className={`grid grid-cols-[140px_60px_repeat(7,minmax(100px,1fr))] items-center hover:bg-white/[0.02] transition-colors group ${isLegacy ? 'bg-white/[0.01]' : ''}`}
            >
              {/* Name Column */}
              <div className="px-4 py-2 flex items-center border-r border-white/5 h-[36px] relative overflow-hidden">
                <span
                  className="text-xs font-medium text-white/90 truncate w-full"
                  title={h.playerName || String(h.playerId || '')}
                >
                  {h.playerName || h.playerId}
                </span>

                {/* Renounce Button - Absolute Positioned on Hover */}
                <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    data-testid="cap-sheet-full-absolve-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      renounceCapHold?.(h);
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
                  className={`${getTagColor(h.type || null)} px-1 py-px rounded-[2px] text-[8px] font-bold uppercase tracking-wider truncate max-w-full`}
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
                        ${Number(h.amount || 0).toLocaleString()}
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
              <section
                aria-label={CAP_SHEET_FULL_SURFACE_LABELS.capHoldsDetail}
                className="mt-8"
              >
              <button
                data-testid="cap-sheet-full-cap-holds-toggle"
                onClick={() => setShowCapHolds(!showCapHolds)}
                className="w-full text-left group mb-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 transform text-sm text-white/60 transition-transform duration-200 ${showCapHolds ? 'rotate-90' : ''}`}
                  >
                    ▶
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-md font-bold tracking-tight text-white/90 group-hover:text-white transition-colors">
                        Cap Hold Details
                      </h3>
                      <span className="bg-white/10 text-white/60 px-2 py-0.5 rounded text-xs">
                        {displayedCapHolds.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/35 leading-relaxed">
                      Separate from player rows. Matching-season holds feed the
                      canonical Total Cap row.
                    </p>
                  </div>
                </div>
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
              </section>
            );
          })()}
      </section>
    </div>
  );
};

