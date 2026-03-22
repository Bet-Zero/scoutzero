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
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
  getCapHoldForPlayer,
  isCapHoldAmountValid,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { calculateCapHold } from '@/features/architect/utils/capHolds';
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
import {
  validateOptionDecision,
  validateExceptions,
  validateContractRows,
} from '@/features/architect/utils/capLegalityValidation';

export type OffseasonTransitionContext = {
  worldId?: string | null;
  teamId?: string | null;
  teamCode?: string | null;
  capProjections?: Record<string, unknown> | null;
};

export type OffseasonViolation = {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
};

export type OffseasonTransitionResult = {
  success: boolean;
  nextTeamCapSheet?: OffseasonTeamLike;
  appliedChangesSummary?: {
    exercisedOptions: OptionChangeSummary[];
    declinedOptions: OptionChangeSummary[];
    expiredContracts: ExpiredContractSummary[];
    expiredTPEs: TpeSummary[];
    capHoldsCreated: number;
    transitionedExceptions: string[];
    hardCapCleared: boolean;
  };
  violations?: OffseasonViolation[];
  warnings?: OffseasonViolation[];
  error?: string;
};

/** Internal-only types for offseason transition helpers */
type SalaryRowLike = {
  season?: string | null;
  salary?: number | null;
  capHit?: number | null;
  guaranteed?: boolean;
  option?: string | null;
  optionUsed?: boolean;
  [key: string]: unknown;
};

type ContractLike = {
  salariesByYear?: SalaryRowLike[];
  contractType?: string | null;
  yearsRemaining?: number | null;
  freeAgency?: { year?: number; type?: string } | null;
  birdRights?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type OffseasonPlayerLike = {
  player_id?: string | null;
  id?: string | null;
  playerId?: string | null;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  contract?: ContractLike | null;
  freeAgentYear?: number | null;
  salary?: number | null;
  currentSalary?: number | null;
  teamCode?: string | null;
  [key: string]: unknown;
};

type CapHoldLike = {
  playerId?: string | null;
  playerName?: string | null;
  amount?: number | null;
  season?: string | null;
  isSigned?: boolean;
  active?: boolean;
  expiresOn?: string | null;
  type?: string | null;
  reason?: string;
  notes?: string;
  [key: string]: unknown;
};

type OffseasonTeamLike = {
  teamCode?: string | null;
  teamName?: string | null;
  players?: OffseasonPlayerLike[];
  roster?: unknown[];
  capHolds?: CapHoldLike[];
  waivedContracts?: Record<string, unknown>[];
  stretchHistory?: Record<string, unknown>[];
  deadMoney?: Record<string, unknown> | null;
  totals?: Record<string, unknown> | null;
  exceptions?: Record<string, unknown> | null;
  tradeExceptions?: unknown[];
  exceptionHistory?: unknown[];
  season?: string | null;
  hardCapTriggered?: unknown;
  hardCapFirstApron?: Record<string, unknown> | null;
  hardCapSecondApron?: Record<string, unknown> | null;
  hardCapped?: boolean | number | null;
  hardCapLevel?: string | null;
  hardCapReason?: string | null;
  hardCapTriggeredBy?: string | null;
  hardCapYear?: unknown;
  [key: string]: unknown;
};

type OptionChangeSummary = {
  playerId: string;
  playerName: string;
  optionType?: string | null;
  salary: number;
};

type ExpiredContractSummary = {
  playerId: string | null;
  playerName: string;
};

type TpeSummary = TpeLifecycleRecord;

function cloneTeam<T>(team: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(team);
  }
  return JSON.parse(JSON.stringify(team));
}

function getPlayerId(player: OffseasonPlayerLike | Record<string, unknown> | null | undefined): string | null {
  if (!player) return null;
  return (player.player_id || player.id || player.playerId || null) as string | null;
}

function getPlayerName(player: OffseasonPlayerLike | Record<string, unknown> | null | undefined): string {
  return (player?.displayName || player?.name || player?.playerName || '') as string;
}

function getRosterEntryId(entry: string | Record<string, unknown> | null | undefined): string | null {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return (entry.player_id || entry.playerId || entry.id || null) as string | null;
}

function removePlayerFromRoster(roster: unknown[], playerId: string): unknown[] {
  if (!Array.isArray(roster)) return roster;
  return roster.filter((entry) => getRosterEntryId(entry as string | Record<string, unknown>) !== playerId);
}

function filterRosterByPlayerIds(roster: unknown[], playerIds: Set<string>): unknown[] {
  if (!Array.isArray(roster)) return roster;
  return roster.filter((entry) => {
    const entryId = getRosterEntryId(entry as string | Record<string, unknown>);
    if (!entryId) return true;
    return playerIds.has(entryId);
  });
}

function normalizeDecisionValue(rawDecision: unknown): {
  decision: 'exercise' | 'decline';
  optionType?: string;
  season?: string;
} | null {
  if (rawDecision === null || rawDecision === undefined) return null;

  if (typeof rawDecision === 'boolean') {
    return { decision: rawDecision ? 'exercise' : 'decline' };
  }

  if (typeof rawDecision === 'string') {
    const normalized = rawDecision.trim().toLowerCase();
    if (['accept', 'exercise', 'yes', 'true'].includes(normalized)) {
      return { decision: 'exercise' };
    }
    if (['decline', 'reject', 'no', 'false'].includes(normalized)) {
      return { decision: 'decline' };
    }
    return null;
  }

  if (typeof rawDecision === 'object') {
    const obj = rawDecision as Record<string, unknown>;
    const decisionValue =
      obj.decision ?? obj.choice ?? obj.action ?? null;
    if (typeof decisionValue === 'string') {
      const normalized = decisionValue.trim().toLowerCase();
      if (['accept', 'exercise', 'yes', 'true'].includes(normalized)) {
        return {
          decision: 'exercise',
          optionType: obj.optionType as string | undefined,
          season: obj.season as string | undefined,
        };
      }
      if (['decline', 'reject', 'no', 'false'].includes(normalized)) {
        return {
          decision: 'decline',
          optionType: obj.optionType as string | undefined,
          season: obj.season as string | undefined,
        };
      }
    }

    if (typeof obj.accepted === 'boolean') {
      return {
        decision: obj.accepted ? 'exercise' : 'decline',
        optionType: obj.optionType as string | undefined,
        season: obj.season as string | undefined,
      };
    }
  }

  return null;
}

function normalizeOptionDecisions(
  optionDecisions: Record<string, unknown> | null | undefined,
  players: OffseasonPlayerLike[]
): { decisionsById: Record<string, unknown>; violations: OffseasonViolation[] } {
  const decisionsById: Record<string, unknown> = {};
  const violations: OffseasonViolation[] = [];

  if (!optionDecisions || typeof optionDecisions !== 'object') {
    return { decisionsById, violations };
  }

  const playersById = new Map<string, OffseasonPlayerLike>();
  const playersByName = new Map<string, OffseasonPlayerLike[]>();

  for (const player of players || []) {
    const playerId = getPlayerId(player);
    const playerName = getPlayerName(player);

    if (playerId) {
      playersById.set(playerId, player);
    }

    if (playerName) {
      const existing = playersByName.get(playerName) || [];
      existing.push(player);
      playersByName.set(playerName, existing);
    }
  }

  for (const [rawKey, rawDecision] of Object.entries(optionDecisions)) {
    let resolvedId: string | null = null;

    if (playersById.has(rawKey)) {
      resolvedId = rawKey;
    } else if (playersByName.has(rawKey)) {
      const matches = playersByName.get(rawKey) || [];
      if (matches.length > 1) {
        violations.push({
          rule: 'option_decision_duplicate_name',
          message: `Option decision key "${rawKey}" is ambiguous (multiple players share this name). Use playerId instead.`,
          severity: 'error',
        });
        continue;
      }
      resolvedId = getPlayerId(matches[0]) || rawKey;
    }

    if (!resolvedId) {
      // Decision key does not apply to this team; ignore
      continue;
    }

    const normalizedDecision = normalizeDecisionValue(rawDecision);
    if (!normalizedDecision) {
      violations.push({
        rule: 'option_decision_invalid_value',
        message: `Option decision for player "${rawKey}" is invalid or unsupported.`,
        severity: 'error',
      });
      continue;
    }

    decisionsById[resolvedId] = {
      ...normalizedDecision,
      optionType: normalizedDecision.optionType ?? (rawDecision as Record<string, unknown>)?.optionType,
      season: normalizedDecision.season ?? (rawDecision as Record<string, unknown>)?.season,
    };
  }

  return { decisionsById, violations };
}

function normalizeExceptionsShape(exceptions: Record<string, unknown> | null | undefined): {
  normalized: Record<string, unknown>;
  changed: boolean;
} {
  const normalized = { ...(exceptions || {}) };
  let changed = false;

  const remap = [
    { from: 'taxpayerMle', to: 'tpmle' },
    { from: 'tpMle', to: 'tpmle' },
    { from: 'miniMle', to: 'tpmle' },
    { from: 'nonTaxpayerMle', to: 'mle' },
    { from: 'fullMLE', to: 'mle' },
    { from: 'biAnnual', to: 'bae' },
  ];

  for (const { from, to } of remap) {
    if (normalized[from] !== undefined && normalized[to] === undefined) {
      normalized[to] = normalized[from];
      changed = true;
    }
    if (normalized[from] !== undefined) {
      delete normalized[from];
      changed = true;
    }
  }

  return { normalized, changed };
}

function countStandardRoster(players: OffseasonPlayerLike[]): number {
  if (!Array.isArray(players)) return 0;
  return players.filter((p) => {
    const contractType = p?.contract?.contractType?.toLowerCase() || '';
    return contractType !== 'two-way';
  }).length;
}

function countTwoWayRoster(players: OffseasonPlayerLike[]): number {
  if (!Array.isArray(players)) return 0;
  return players.filter((p) => {
    const contractType = p?.contract?.contractType?.toLowerCase() || '';
    return contractType === 'two-way';
  }).length;
}

function pruneExpiredCapHolds(
  team: OffseasonTeamLike,
  toSeason: string
): { hasChanges: boolean } {
  if (!team?.capHolds || !Array.isArray(team.capHolds)) {
    return { hasChanges: false };
  }

  let hasChanges = false;
  const seasonStartDate = new Date(`${toSeason.split('-')[0]}-07-01`);

  const activeCapHolds = team.capHolds.filter((hold: CapHoldLike) => {
    if (hold?.expiresOn) {
      const expireDate = new Date(hold.expiresOn);
      if (expireDate < seasonStartDate) {
        hasChanges = true;
        return false;
      }
    }

    if (hold?.isSigned) {
      hasChanges = true;
      return false;
    }

    return true;
  });

  if (hasChanges) {
    team.capHolds = activeCapHolds;
  }

  return { hasChanges };
}

function advanceDeadMoney(team: OffseasonTeamLike, toYear: number): { hasChanges: boolean } {
  if (!team) return { hasChanges: false };
  let hasChanges = false;

  const filterDeadCapObject = (deadCap: Record<string, unknown>) => {
    const remaining: Record<string, unknown> = {};
    for (const [year, amount] of Object.entries(deadCap || {})) {
      if (Number(year) >= toYear) {
        remaining[year] = amount;
      } else {
        hasChanges = true;
      }
    }
    return remaining;
  };

  if (Array.isArray(team.waivedContracts)) {
    team.waivedContracts = team.waivedContracts
      .map((contract: Record<string, unknown>) => {
        if (!contract?.deadCap || typeof contract.deadCap !== 'object') {
          return contract;
        }
        const remaining = filterDeadCapObject(contract.deadCap as Record<string, unknown>);
        return Object.keys(remaining).length > 0
          ? { ...contract, deadCap: remaining }
          : null;
      })
      .filter(Boolean);
  }

  if (Array.isArray(team.stretchHistory)) {
    team.stretchHistory = team.stretchHistory
      .map((contract: Record<string, unknown>) => {
        if (!contract?.deadCap || typeof contract.deadCap !== 'object') {
          return contract;
        }
        const remaining = filterDeadCapObject(contract.deadCap as Record<string, unknown>);
        return Object.keys(remaining).length > 0
          ? { ...contract, deadCap: remaining }
          : null;
      })
      .filter(Boolean);
  }

  if (team.deadMoney && typeof team.deadMoney === 'object') {
    const remainingDeadMoney = filterDeadCapObject(team.deadMoney as Record<string, unknown>);
    team.deadMoney = remainingDeadMoney;
  }

  return { hasChanges };
}

function clearHardCapState(team: OffseasonTeamLike): boolean {
  if (!team) return false;

  const fields = [
    'hardCapTriggered',
    'hardCapFirstApron',
    'hardCapSecondApron',
    'hardCapYear',
    'hardCapLevel',
    'hardCapReason',
    'hardCapTriggeredBy',
  ];

  let hadHardCap = false;

  for (const field of fields) {
    if (team[field] !== undefined) {
      hadHardCap = true;
      delete team[field];
    }
  }

  if (team.hardCapped !== undefined) {
    hadHardCap = true;
    team.hardCapped = false;
  }

  if (team.totals) {
    if (
      team.totals.isHardCapped ||
      team.totals.hardCapLevel ||
      team.totals.hardCapDetail
    ) {
      hadHardCap = true;
    }
    team.totals.isHardCapped = false;
    team.totals.hardCapLevel = null;
    team.totals.hardCapDetail = null;
    team.totals.hardCapReason = null;
  }

  return hadHardCap;
}

function validateOffseasonState(
  team: OffseasonTeamLike,
  toYear: number,
  context: OffseasonTransitionContext | undefined,
  preTransitionHardCapState?: {
    hadHardCap: boolean;
    hardCapTriggered: unknown;
    hardCapLevel: unknown;
    hardCapped: unknown;
    totalsIsHardCapped: unknown;
  }
): { violations: OffseasonViolation[]; warnings: OffseasonViolation[] } {
  const violations: OffseasonViolation[] = [];
  const warnings: OffseasonViolation[] = [];

  const rules = getCapRulesForYear(toYear, context?.capProjections);

  const standardRosterCount = countStandardRoster(team?.players);
  const twoWayCount = countTwoWayRoster(team?.players);

  const minRoster = rules.roster.graceMin;
  const maxRoster = rules.roster.maxStandard;

  if (standardRosterCount < minRoster) {
    violations.push({
      rule: 'roster_minimum',
      message: `Roster has ${standardRosterCount} standard players (minimum offseason roster is ${minRoster}).`,
      severity: 'error',
    });
  }

  if (standardRosterCount > maxRoster) {
    violations.push({
      rule: 'roster_size',
      message: `Roster has ${standardRosterCount} standard players (max is ${maxRoster}).`,
      severity: 'error',
    });
  }

  if (twoWayCount > rules.roster.maxTwoWay) {
    violations.push({
      rule: 'two_way_limit',
      message: `Roster has ${twoWayCount} two-way contracts (max is ${rules.roster.maxTwoWay}).`,
      severity: 'error',
    });
  }

  // Phase E1.1: Use pre-transition hard cap state if available (fixes ordering
  // bug where clearHardCapState ran before validation, making this check dead code).
  const hardCapTriggered = preTransitionHardCapState
    ? preTransitionHardCapState.hadHardCap
    : team?.hardCapTriggered ||
      team?.hardCapFirstApron?.active ||
      team?.hardCapSecondApron?.active ||
      team?.hardCapped === true ||
      team?.hardCapped === 1 ||
      team?.hardCapped === 2 ||
      team?.totals?.isHardCapped;

  if (hardCapTriggered) {
    // Phase E1.1: Derive level from pre-transition snapshot if available
    const hcState = preTransitionHardCapState;
    const hardCapLevel = (
      hcState
        ? hcState.hardCapLevel === 'secondApron' || hcState.hardCapped === 2
        : team?.hardCapSecondApron?.active ||
          team?.hardCapTriggered === 'SecondApron' ||
          team?.hardCapped === 2
    )
      ? 'secondApron'
      : 'firstApron';
    const ceiling =
      hardCapLevel === 'secondApron'
        ? rules.cap.secondApron
        : rules.cap.firstApron;
    const projectedCap = Number(team?.totals?.totalCapAllocations || 0);
    if (projectedCap > ceiling) {
      violations.push({
        rule: 'hard_cap_violation',
        message: `Projected cap allocations (${projectedCap}) exceed ${hardCapLevel} ceiling (${ceiling}).`,
        severity: 'error',
      });
    }
  }

  const exceptionSubset: Record<string, unknown> = {};
  if (team?.exceptions && typeof team.exceptions === 'object') {
    for (const key of ['mle', 'tpmle', 'bae', 'room']) {
      if (team.exceptions[key]) {
        exceptionSubset[key] = team.exceptions[key];
      }
    }
  }

  const exceptionValidation = validateExceptions(exceptionSubset);
  if (exceptionValidation.violations?.length) {
    exceptionValidation.violations.forEach((violation) => {
      violations.push({
        rule: violation.rule || 'exceptions_invalid',
        message: violation.message || 'Invalid exceptions data',
        severity: 'error',
      });
    });
  }

  if (exceptionValidation.warnings?.length) {
    exceptionValidation.warnings.forEach((warning) => {
      warnings.push({
        rule: warning.rule || 'exceptions_warning',
        message: warning.message || 'Exception warning',
        severity: 'warning',
      });
    });
  }

  const capHolds = Array.isArray(team?.capHolds) ? team.capHolds : [];
  for (const hold of capHolds) {
    const validation = isCapHoldAmountValid(hold);
    if (!validation.valid) {
      violations.push({
        rule: 'cap_hold_invalid',
        message: validation.reason || 'Invalid cap hold entry',
        severity: 'error',
      });
    }
  }

  // Phase E1.1: Validate contract rows for all remaining players (shared
  // validator from capLegalityValidation — same check the mutation pipeline
  // runs on every signing/extension).
  const players = Array.isArray(team?.players) ? team.players : [];
  for (const player of players) {
    if (!player?.contract) continue;
    const rowResult = validateContractRows(player.contract);
    if (rowResult.violations?.length) {
      for (const v of rowResult.violations) {
        violations.push({
          rule: v.rule || 'contract_row_invalid',
          message: `[${player.displayName || player.player_id || 'Unknown'}] ${v.message || 'Invalid contract row'}`,
          severity: 'error',
        });
      }
    }
    if (rowResult.warnings?.length) {
      for (const w of rowResult.warnings) {
        warnings.push({
          rule: w.rule || 'contract_row_warning',
          message: `[${player.displayName || player.player_id || 'Unknown'}] ${w.message || 'Contract row warning'}`,
          severity: 'warning',
        });
      }
    }
  }

  return { violations, warnings };
}

export function resolveOffseasonTransition({
  teamCapSheet,
  fromYear,
  toYear,
  optionDecisions = {},
  context = {},
}: {
  teamCapSheet: OffseasonTeamLike;
  fromYear: number;
  toYear: number;
  optionDecisions?: Record<string, unknown>;
  context?: OffseasonTransitionContext;
}): OffseasonTransitionResult {
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

  const appliedChangesSummary = {
    exercisedOptions: [] as OptionChangeSummary[],
    declinedOptions: [] as OptionChangeSummary[],
    expiredContracts: [] as ExpiredContractSummary[],
    expiredTPEs: [] as TpeSummary[],
    capHoldsCreated: 0,
    transitionedExceptions: [] as string[],
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

    const optionYearIndex = salaries.findIndex((row: SalaryRowLike) => {
      const yearEnd = toEndYear(row?.season);
      return yearEnd === toYear && row?.option;
    });

    if (optionYearIndex === -1) continue;

    const decision = decisionsById[decisionKey] as Record<string, unknown> | undefined;
    if (!decision) {
      continue; // no decision provided; leave option untouched
    }

    const originalPlayer = (baselineTeam.players || []).find(
      (p: OffseasonPlayerLike) => getPlayerId(p) === playerId
    );

    if (decision.decision === 'exercise') {
      player.contract.salariesByYear = salaries.map((row: SalaryRowLike, idx: number) => {
        if (idx === optionYearIndex) {
          return { ...row, optionUsed: true };
        }
        return row;
      });

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
        (_: SalaryRowLike, idx: number) => idx < optionYearIndex
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

      const rightsType = getRightsTypeFromPlayer(player);
      const capHoldResult = computeExpectedCapHoldAmount({
        player,
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
  const remainingPlayers: OffseasonPlayerLike[] = [];
  const expiredPlayers: OffseasonPlayerLike[] = [];

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

    const holdCalc = calculateCapHold(player);
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
      contract.salariesByYear = contract.salariesByYear.filter((row: SalaryRowLike) => {
        const yearEnd = toEndYear(row?.season);
        return yearEnd !== null && Number.isFinite(yearEnd) && yearEnd >= toYear;
      });
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

  const exceptionReset = resetTeamNonTpeExceptionsForNewSeason(
    nextTeam,
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
  const dpe = nextTeam.exceptions?.dpe as Record<string, unknown> | null | undefined;
  const dpeWasActive =
    dpe &&
    ((dpe.enabled ?? false) ||
      (Number(dpe.totalAmount ?? 0)) > 0 ||
      (Number(dpe.usedAmount ?? 0)) > 0 ||
      (Number(dpe.remainingAmount ?? 0)) > 0 ||
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
      const timestampISO = new Date().toISOString();
      const expiryHistoryEntries = tpeResult.expiredTPEs
        .map((expiredTpe) => {
          const expiresOn = getTpeExpiryISO(expiredTpe);
          const amountExpired =
            expiredTpe.remainingAmount ?? expiredTpe.amount ?? 0;
          const totalAmount =
            expiredTpe.totalAmount ?? expiredTpe.amount ?? amountExpired;

          return createTpeExpiryHistoryEntry({
            teamCode: teamCode as string,
            tpeId: expiredTpe.id as string,
            amountExpired: amountExpired as number,
            totalAmount: totalAmount as number,
            expiresOn: expiresOn as string,
            toSeason,
            createdFrom: expiredTpe.createdFrom as string,
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
