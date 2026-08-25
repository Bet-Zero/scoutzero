/**
 * FILE: src/features/architect/utils/offseason/resolveOffseasonTransition.ts
 * PURPOSE: Single source of truth for offseason state transitions (Year N -> N+1).
 * OWNERSHIP: Feature: architect/offseason
 *
 * HISTORY:
 *  - 2026-02-03: Created by plan `plans/_archive/offseason-transition-engine-phase1/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/offseason-transition-engine-phase1/plan.md
 *  - Latest Chunk: N/A
 */

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import {
  getCapRulesForYear,
  type CapProjectionOverrides,
} from '@/features/architect/utils/capRulesProfile';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
  getCapHoldForPlayer,
  isCapHoldAmountValid,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import {
  calculateCapHold,
  type CapHold,
  type CapHoldPlayerInput,
} from '@/features/architect/utils/capHolds';
import {
  processTradeExceptions,
  getTpeExpiryISO,
  type TpeLifecycleRecord,
} from '@/features/architect/utils/tpeLifecycle';
import {
  appendExceptionHistory,
  createTpeExpiryHistoryEntry,
} from '@/features/architect/utils/exceptionHistory/historyHelpers';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import { resetTeamNonTpeExceptionsForNewSeason } from '@/features/architect/utils/exceptions';
import { validateOptionDecision } from '@/features/architect/utils/capLegalityValidation';
// Wave 17 Step 1: validation extracted to resolveOffseasonTransition.validation.ts
import {
  validateOffseasonState,
  type OffseasonHardCapStateSnapshot,
} from './resolveOffseasonTransition.validation';
// Wave 17 Step 2: option-decision normalizers extracted to resolveOffseasonTransition.optionDecisions.ts
import {
  getPlayerId,
  getPlayerName,
  normalizeOptionDecisions,
} from './resolveOffseasonTransition.optionDecisions';
// Wave 27: types and private helpers extracted to resolveOffseasonTransition.helpers.ts
export * from './resolveOffseasonTransition.helpers';
import {
  advanceDeadMoney,
  clearHardCapState,
  cloneTeam,
  filterRosterByPlayerIds,
  getRosterEntryId,
  normalizeCapHoldPlayer,
  normalizeExceptionsShape,
  pruneExpiredCapHolds,
  removePlayerFromRoster,
  type OffseasonAppliedChangesSummary,
  type OffseasonCapHold,
  type OffseasonDeadCapByYear,
  type OffseasonDeadCapHistoryEntry,
  type OffseasonExceptions,
  type OffseasonOptionDecisionMap,
  type OffseasonPlayer,
  type OffseasonRosterEntry,
  type OffseasonSalaryRow,
  type OffseasonTeamCapSheet,
  type OffseasonTransitionContext,
  type OffseasonTransitionParams,
  type OffseasonTransitionResult,
  type OffseasonViolation,
} from './resolveOffseasonTransition.helpers';

export function resolveOffseasonTransition({
  teamCapSheet,
  fromYear,
  toYear,
  optionDecisions = {},
  context = {},
}: OffseasonTransitionParams): OffseasonTransitionResult {
  if (!teamCapSheet) {
    return {
      success: false,
      error: 'teamCapSheet is required',
      violations: [
        {
          rule: 'missing_team',
          message: 'teamCapSheet is required',
          severity: 'error',
        },
      ],
    };
  }

  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) {
    return {
      success: false,
      error: 'fromYear and toYear must be valid numbers',
      violations: [
        {
          rule: 'invalid_year',
          message: 'fromYear and toYear must be valid numbers',
          severity: 'error',
        },
      ],
    };
  }

  const baselineTeam = cloneTeam(teamCapSheet);
  const nextTeam = cloneTeam(teamCapSheet);

  const appliedChangesSummary: OffseasonAppliedChangesSummary = {
    exercisedOptions: [],
    declinedOptions: [],
    expiredContracts: [],
    expiredTPEs: [],
    capHoldsCreated: 0,
    transitionedExceptions: [],
    hardCapCleared: false,
  };

  const violations: OffseasonViolation[] = [];
  const warnings: OffseasonViolation[] = [];

  const toSeason = toSeasonCode(toYear);
  nextTeam.season = toSeason;

  // Ensure arrays exist
  nextTeam.players = Array.isArray(nextTeam.players) ? nextTeam.players : [];
  nextTeam.capHolds = Array.isArray(nextTeam.capHolds) ? nextTeam.capHolds : [];

  // =========================================================================
  // 1) Apply option decisions
  // =========================================================================
  const { decisionsById, violations: decisionViolations } =
    normalizeOptionDecisions(optionDecisions, nextTeam.players);
  if (decisionViolations.length > 0) {
    violations.push(...decisionViolations);
  }

  for (const player of nextTeam.players) {
    if (!player?.contract?.salariesByYear) continue;
    const playerId = getPlayerId(player);
    const decisionKey = playerId || getPlayerName(player);
    if (!decisionKey) continue;

    const salaries = Array.isArray(player.contract.salariesByYear)
      ? player.contract.salariesByYear
      : [];

    const optionYearIndex = salaries.findIndex((row: OffseasonSalaryRow) => {
      const yearEnd = toEndYear(row?.season);
      return yearEnd === toYear && row?.option;
    });

    if (optionYearIndex === -1) continue;

    const decision = decisionsById[decisionKey];
    if (!decision) {
      continue; // no decision provided; leave option untouched
    }

    const originalPlayer = (baselineTeam.players || []).find(
      (p) => getPlayerId(p) === playerId
    );

    if (decision.decision === 'exercise') {
      player.contract.salariesByYear = salaries.map(
        (row: OffseasonSalaryRow, idx: number) => {
          if (idx === optionYearIndex) {
            return { ...row, optionUsed: true };
          }
          return row;
        }
      );

      appliedChangesSummary.exercisedOptions.push({
        playerId: playerId || decisionKey,
        playerName: getPlayerName(player) || decisionKey,
        optionType: salaries[optionYearIndex]?.option,
        salary:
          salaries[optionYearIndex]?.salary ||
          salaries[optionYearIndex]?.capHit ||
          0,
      });
    } else if (decision.decision === 'decline') {
      const optionRow = salaries[optionYearIndex];
      const priorRow = salaries[optionYearIndex - 1];
      const lastSalary = priorRow?.salary ?? priorRow?.capHit ?? 0;

      const filteredSalaries = salaries.filter(
        (_: OffseasonSalaryRow, idx: number) => idx < optionYearIndex
      );
      player.contract.salariesByYear = filteredSalaries;

      if (filteredSalaries.length > 0) {
        filteredSalaries[filteredSalaries.length - 1] = {
          ...filteredSalaries[filteredSalaries.length - 1],
          optionUsed: false,
        };
      }

      const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
        optionRow?.season,
        toYear
      );
      const freeAgencyYear =
        typeof faYearInfo.year === 'number' ? faYearInfo.year : toYear - 1;

      player.contract.freeAgency = {
        year: freeAgencyYear,
        type: 'UFA',
      };
      player.freeAgentYear = freeAgencyYear;

      const capHoldPlayer = normalizeCapHoldPlayer(player);
      const rightsType = getRightsTypeFromPlayer(capHoldPlayer);
      const capHoldResult = computeExpectedCapHoldAmount({
        player: capHoldPlayer,
        lastSalary,
        rules: null,
        rightsType,
      });

      if (!playerId) {
        violations.push({
          rule: 'cap_hold_missing_player_id',
          message: `Declined option for \"${getPlayerName(player)}\" but playerId is missing.`,
          severity: 'error',
        });
      } else if (lastSalary > 0 && capHoldResult.amount) {
        const existingHold = getCapHoldForPlayer(nextTeam, playerId);
        if (!existingHold) {
          nextTeam.capHolds.push({
            playerId,
            playerName: getPlayerName(player) || playerId,
            amount: capHoldResult.amount,
            type: 'FA Cap Hold',
            season: toSeasonCode(toYear),
            isSigned: false,
            active: true,
            reason: capHoldResult.usedFallback
              ? `Declined ${optionRow?.option} (fallback multiplier)`
              : `Declined ${optionRow?.option}`,
            notes: capHoldResult.usedFallback
              ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
              : undefined,
          });
          appliedChangesSummary.capHoldsCreated += 1;
        }
      }

      if (Array.isArray(nextTeam.roster) && playerId) {
        nextTeam.roster = removePlayerFromRoster(nextTeam.roster, playerId);
      }

      appliedChangesSummary.declinedOptions.push({
        playerId: playerId || decisionKey,
        playerName: getPlayerName(player) || decisionKey,
        optionType: optionRow?.option,
        salary: optionRow?.salary || optionRow?.capHit || 0,
      });
    }

    if (playerId) {
      const validation = validateOptionDecision({
        originalTeam: baselineTeam,
        updatedTeam: nextTeam,
        originalPlayer,
        updatedPlayer: player,
        accepted: decision.decision === 'exercise',
        targetYear: toYear,
        currentYear: fromYear,
      });

      if (validation.violations?.length) {
        validation.violations.forEach((violation) => {
          violations.push({
            rule: violation.rule || 'option_decision_invalid',
            message: violation.message || 'Option decision invalid',
            severity: 'error',
          });
        });
      }

      if (validation.warnings?.length) {
        validation.warnings.forEach((warning) => {
          warnings.push({
            rule: warning.rule || 'option_decision_warning',
            message: warning.message || 'Option decision warning',
            severity: 'warning',
          });
        });
      }
    }
  }

  // =========================================================================
  // 2) Process expirations (standard)
  // =========================================================================
  const remainingPlayers: OffseasonPlayer[] = [];
  const expiredPlayers: OffseasonPlayer[] = [];

  for (const player of nextTeam.players) {
    if (
      !player?.contract?.salariesByYear ||
      !Array.isArray(player.contract.salariesByYear)
    ) {
      remainingPlayers.push(player);
      continue;
    }

    const nextYearSlice = getContractYearSlice(player, toYear);
    if (!nextYearSlice) {
      expiredPlayers.push(player);
      continue;
    }

    remainingPlayers.push(player);
  }

  const remainingIds = new Set(
    remainingPlayers
      .map((player) => getPlayerId(player))
      .filter((playerId): playerId is string => typeof playerId === 'string')
  );

  if (expiredPlayers.length > 0) {
    nextTeam.players = remainingPlayers;
    if (Array.isArray(nextTeam.roster)) {
      nextTeam.roster = filterRosterByPlayerIds(nextTeam.roster, remainingIds);
    }
  }

  for (const player of expiredPlayers) {
    const playerId = getPlayerId(player);
    appliedChangesSummary.expiredContracts.push({
      playerId,
      playerName: getPlayerName(player) || playerId || 'Unknown',
    });
  }

  // =========================================================================
  // 3) Generate rights + cap holds for standard expirations
  // =========================================================================
  for (const player of expiredPlayers) {
    const playerId = getPlayerId(player);
    if (!playerId) {
      violations.push({
        rule: 'cap_hold_missing_player_id',
        message: `Expired player "${getPlayerName(player)}" is missing a stable playerId.`,
        severity: 'error',
      });
      continue;
    }

    const existingHold = getCapHoldForPlayer(nextTeam, playerId);
    if (existingHold) continue;

    const holdCalc = calculateCapHold(normalizeCapHoldPlayer(player));
    if (!holdCalc || !Number.isFinite(holdCalc.amount)) {
      warnings.push({
        rule: 'cap_hold_missing_amount',
        message: `Could not compute cap hold for expired player "${getPlayerName(player) || playerId}".`,
        severity: 'warning',
      });
      continue;
    }

    nextTeam.capHolds.push({
      playerId,
      playerName: getPlayerName(player) || playerId,
      amount: holdCalc.amount,
      type: 'FA Cap Hold',
      season: toSeasonCode(toYear),
      isSigned: false,
      active: holdCalc.active ?? true,
      reason: holdCalc.reason,
    });

    appliedChangesSummary.capHoldsCreated += 1;
  }

  pruneExpiredCapHolds(nextTeam, toSeason);

  // =========================================================================
  // 4) Decrement contract years / advance contracts
  // =========================================================================
  for (const player of nextTeam.players) {
    const contract = player?.contract;
    if (!contract) continue;

    if (contract.yearsRemaining !== undefined) {
      const nextRemaining = Math.max(0, Number(contract.yearsRemaining) - 1);
      contract.yearsRemaining = nextRemaining;
    }

    if (Array.isArray(contract.salariesByYear)) {
      contract.salariesByYear = contract.salariesByYear.filter(
        (row: OffseasonSalaryRow) => {
          const yearEnd = toEndYear(row?.season);
          return (
            yearEnd !== null && Number.isFinite(yearEnd) && yearEnd >= toYear
          );
        }
      );
    }
  }

  // =========================================================================
  // 5) Advance dead money
  // =========================================================================
  advanceDeadMoney(nextTeam, toYear);

  // =========================================================================
  // 6) Exception lifecycle
  // =========================================================================
  const normalizedExceptions = normalizeExceptionsShape(nextTeam.exceptions);
  if (normalizedExceptions.changed) {
    nextTeam.exceptions = normalizedExceptions.normalized;
  }
  if (!nextTeam.exceptions) {
    nextTeam.exceptions = {};
  }

  const exceptionReset = resetTeamNonTpeExceptionsForNewSeason(
    nextTeam as NonNullable<
      Parameters<typeof resetTeamNonTpeExceptionsForNewSeason>[0]
    >,
    toYear,
    {
      customCapProjections: context?.capProjections,
    }
  );
  if (exceptionReset.hasChanges) {
    appliedChangesSummary.transitionedExceptions =
      exceptionReset.transitionedExceptions;
  }

  // DPE lifecycle: clear on rollover
  const seasonKey = `${toYear - 1}-${String(toYear).slice(-2)}`;
  const dpe = nextTeam.exceptions?.dpe;
  const dpeWasActive =
    dpe &&
    ((dpe.enabled ?? false) ||
      Number(dpe.totalAmount ?? 0) > 0 ||
      Number(dpe.usedAmount ?? 0) > 0 ||
      Number(dpe.remainingAmount ?? 0) > 0 ||
      dpe.seasonKey !== seasonKey);
  if (!nextTeam.exceptions) {
    nextTeam.exceptions = {};
  }
  nextTeam.exceptions.dpe = {
    enabled: false,
    totalAmount: 0,
    usedAmount: 0,
    remainingAmount: 0,
    seasonKey,
  };
  if (dpeWasActive) {
    appliedChangesSummary.transitionedExceptions = [
      ...new Set([
        ...(appliedChangesSummary.transitionedExceptions || []),
        'dpe',
      ]),
    ];
  }

  // TPE lifecycle
  const tpeList = getTeamTpeList(nextTeam);
  const tpeResult = processTradeExceptions(tpeList, toSeason);
  if (tpeResult.hasChanges) {
    nextTeam.exceptions = nextTeam.exceptions || {};
    nextTeam.exceptions.tpe = tpeResult.activeTPEs;
    nextTeam.tradeExceptions = tpeResult.activeTPEs;
    appliedChangesSummary.expiredTPEs = tpeResult.expiredTPEs || [];

    if (tpeResult.expiredTPEs && tpeResult.expiredTPEs.length > 0) {
      const teamCode = context?.teamCode || nextTeam.teamCode;
      const timestampISO = context?.effectiveAt || new Date().toISOString();
      const expiryHistoryEntries = tpeResult.expiredTPEs
        .map((expiredTpe) => {
          const expiresOn = getTpeExpiryISO(expiredTpe);
          const amountExpired =
            Number(expiredTpe.remainingAmount ?? expiredTpe.amount ?? 0) || 0;
          const totalAmount =
            Number(
              expiredTpe.totalAmount ?? expiredTpe.amount ?? amountExpired
            ) || amountExpired;

          return createTpeExpiryHistoryEntry({
            teamCode: teamCode || '',
            tpeId: expiredTpe.id || '',
            amountExpired,
            totalAmount,
            expiresOn: expiresOn || undefined,
            toSeason,
            createdFrom:
              typeof expiredTpe.createdFrom === 'string'
                ? expiredTpe.createdFrom
                : undefined,
            timestampISO,
            worldId: context?.worldId || undefined,
          });
        })
        .filter(Boolean);

      if (expiryHistoryEntries.length > 0) {
        appendExceptionHistory(nextTeam, expiryHistoryEntries);
      }
    }
  }

  // =========================================================================
  // 7) Hard cap lifecycle
  // =========================================================================
  // Phase E1.1: Capture pre-clear hard cap state so validateOffseasonState
  // can check it AFTER clearHardCapState removes the flags.
  const preTransitionHardCapState = {
    hadHardCap: !!(
      nextTeam?.hardCapTriggered ||
      nextTeam?.hardCapFirstApron?.active ||
      nextTeam?.hardCapSecondApron?.active ||
      nextTeam?.hardCapped === true ||
      nextTeam?.hardCapped === 1 ||
      nextTeam?.hardCapped === 2 ||
      nextTeam?.totals?.isHardCapped
    ),
    hardCapTriggered: nextTeam?.hardCapTriggered,
    hardCapLevel: nextTeam?.hardCapLevel,
    hardCapped: nextTeam?.hardCapped,
    totalsIsHardCapped: nextTeam?.totals?.isHardCapped,
    apronTeamSalary: nextTeam?.totals?.apronTeamSalary,
  };
  appliedChangesSummary.hardCapCleared = clearHardCapState(nextTeam);

  // =========================================================================
  // 8) Recompute totals
  // =========================================================================
  nextTeam.totals = computeTeamCapTotals(nextTeam, toYear, {
    capProjections: context?.capProjections,
  });

  // =========================================================================
  // 9) Legality validation
  // =========================================================================
  const validation = validateOffseasonState(
    nextTeam,
    toYear,
    context,
    preTransitionHardCapState
  );
  if (validation.violations.length > 0) {
    violations.push(...validation.violations);
  }
  if (validation.warnings.length > 0) {
    warnings.push(...validation.warnings);
  }

  if (violations.length > 0) {
    return {
      success: false,
      violations,
      warnings,
      error: violations[0]?.message || 'Offseason transition blocked',
    };
  }

  return {
    success: true,
    nextTeamCapSheet: nextTeam,
    appliedChangesSummary,
    warnings,
  };
}
