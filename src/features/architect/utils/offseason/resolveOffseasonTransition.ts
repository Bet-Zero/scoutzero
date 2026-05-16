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
import {
  validateOptionDecision,
} from '@/features/architect/utils/capLegalityValidation';
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

export type OffseasonTransitionContext = {
  worldId?: string | null;
  teamId?: string | null;
  teamCode?: string | null;
  capProjections?: CapProjectionOverrides | null;
};

export type OffseasonViolation = {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
};

type OffseasonBirdRights = {
  status?: string | null;
  type?: string | null;
  yearsOfService?: number | null;
  yearsWithTeam?: number | null;
  renounced?: boolean | null;
} | null;

type OffseasonSalaryRow = {
  season?: string | null;
  salary?: number | null;
  capHit?: number | null;
  guaranteed?: boolean;
  option?: string | null;
  optionUsed?: boolean;
};

type OffseasonContract = {
  salariesByYear?: OffseasonSalaryRow[];
  contractType?: string | null;
  yearsRemaining?: number | null;
  freeAgency?: { year?: number; type?: string } | null;
  birdRights?: OffseasonBirdRights;
};

export type OffseasonPlayer = {
  player_id?: string | null;
  id?: string | null;
  playerId?: string | null;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  bio?: {
    yearsExperience?: number | null;
  } | null;
  draft?: {
    pick?: number | null;
    round?: number | null;
  } | null;
  contract?: OffseasonContract | null;
  birdRights?: OffseasonBirdRights | string;
  renounced?: boolean | null;
  freeAgentYear?: number | null;
  salary?: number | null;
  currentSalary?: number | null;
  teamCode?: string | null;
};

export type OffseasonCapHold = CapHold & {
  expiresOn?: string | null;
  notes?: string;
};

type OffseasonRosterEntry =
  | string
  | {
      player_id?: string | null;
      playerId?: string | null;
      id?: string | null;
    };

type OffseasonDeadCapByYear = Record<string, number | string | null>;

type OffseasonDeadCapHistoryEntry = {
  id?: string | null;
  name?: string | null;
  waivedOn?: string | null;
  stretched?: boolean | null;
  deadCap?: OffseasonDeadCapByYear | null;
};

type OffseasonTeamTotals = {
  isHardCapped?: boolean | null;
  hardCapLevel?: string | null;
  hardCapDetail?: string | null;
  hardCapReason?: string | null;
  totalCapAllocations?: number | string | null;
  yearKey?: number | string | null;
  playersTotal?: number | string | null;
  deadMoneyTotal?: number | string | null;
  capHoldsTotal?: number | string | null;
  incompleteChargesTotal?: number | string | null;
  salaryCap?: number | string | null;
  luxuryTax?: number | string | null;
  firstApron?: number | string | null;
  secondApron?: number | string | null;
};

type OffseasonHardCapMarker = {
  active?: boolean | null;
  reason?: string | null;
  season?: string | null;
};

type OffseasonExceptionEntry = {
  type?: string | null;
  enabled?: boolean | null;
  available?: boolean | null;
  maxAmount?: number | string | null;
  amount?: number | string | null;
  totalAmount?: number | string | null;
  usedAmount?: number | string | null;
  remainingAmount?: number | string | null;
  seasonKey?: string | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};

type OffseasonKnownExceptions = {
  mle?: OffseasonExceptionEntry;
  tpmle?: OffseasonExceptionEntry;
  bae?: OffseasonExceptionEntry;
  room?: OffseasonExceptionEntry;
  dpe?: OffseasonExceptionEntry;
  tpe?: TpeLifecycleRecord[];
  taxpayerMle?: OffseasonExceptionEntry;
  tpMle?: OffseasonExceptionEntry;
  miniMle?: OffseasonExceptionEntry;
  nonTaxpayerMle?: OffseasonExceptionEntry;
  fullMLE?: OffseasonExceptionEntry;
  biAnnual?: OffseasonExceptionEntry;
};

type OffseasonExceptions = OffseasonKnownExceptions & Record<string, unknown>;

export type OffseasonTeamCapSheet = {
  teamCode?: string | null;
  teamName?: string | null;
  players?: OffseasonPlayer[];
  roster?: OffseasonRosterEntry[];
  capHolds?: OffseasonCapHold[];
  waivedContracts?: OffseasonDeadCapHistoryEntry[];
  stretchHistory?: OffseasonDeadCapHistoryEntry[];
  deadMoney?: OffseasonDeadCapByYear | null;
  totals?: OffseasonTeamTotals | null;
  exceptions?: OffseasonExceptions | null;
  tradeExceptions?: TpeLifecycleRecord[];
  exceptionHistory?: unknown[];
  season?: string | null;
  hardCapTriggered?: string | boolean | null;
  hardCapFirstApron?: OffseasonHardCapMarker | null;
  hardCapSecondApron?: OffseasonHardCapMarker | null;
  hardCapped?: boolean | number | null;
  hardCapLevel?: string | null;
  hardCapReason?: string | null;
  hardCapTriggeredBy?: string | null;
  hardCapYear?: string | number | null;
};

export type OffseasonOptionDecision = {
  decision: 'exercise' | 'decline';
  optionType?: string;
  season?: string;
};

type OffseasonOptionDecisionObject = {
  decision?: string | null;
  choice?: string | null;
  action?: string | null;
  accepted?: boolean;
  optionType?: string | null;
  season?: string | null;
};

export type OffseasonOptionDecisionInput =
  | OffseasonOptionDecision
  | OffseasonOptionDecisionObject
  | boolean
  | string
  | null
  | undefined;

export type OffseasonOptionDecisionMap = Record<
  string,
  OffseasonOptionDecisionInput
>;

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

export type OffseasonAppliedChangesSummary = {
  exercisedOptions: OptionChangeSummary[];
  declinedOptions: OptionChangeSummary[];
  expiredContracts: ExpiredContractSummary[];
  expiredTPEs: TpeSummary[];
  capHoldsCreated: number;
  transitionedExceptions: string[];
  hardCapCleared: boolean;
};

export type OffseasonTransitionResult = {
  success: boolean;
  nextTeamCapSheet?: OffseasonTeamCapSheet;
  appliedChangesSummary?: OffseasonAppliedChangesSummary;
  violations?: OffseasonViolation[];
  warnings?: OffseasonViolation[];
  error?: string;
};

export type OffseasonTransitionParams = {
  teamCapSheet: OffseasonTeamCapSheet;
  fromYear: number;
  toYear: number;
  optionDecisions?: OffseasonOptionDecisionMap;
  context?: OffseasonTransitionContext;
};


function cloneTeam<T>(team: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(team);
  }
  return JSON.parse(JSON.stringify(team));
}

function normalizeCapHoldPlayer(
  player: OffseasonPlayer
): CapHoldPlayerInput & { birdRights?: unknown } {
  const normalized: CapHoldPlayerInput & { birdRights?: unknown } = {};

  if (player.renounced != null) {
    normalized.renounced = player.renounced;
  }

  if (typeof player.bio?.yearsExperience === 'number') {
    normalized.bio = { yearsExperience: player.bio.yearsExperience };
  }

  if (player.draft) {
    const draft: NonNullable<CapHoldPlayerInput['draft']> = {};
    if (typeof player.draft.pick === 'number') {
      draft.pick = player.draft.pick;
    }
    if (typeof player.draft.round === 'number') {
      draft.round = player.draft.round;
    }
    normalized.draft = draft;
  }

  const salaryRows = Array.isArray(player.contract?.salariesByYear)
    ? player.contract.salariesByYear.flatMap((row) => {
        const salaryRow: NonNullable<
          NonNullable<CapHoldPlayerInput['contract']>['salariesByYear']
        >[number] = {};

        if (typeof row.season === 'string') {
          salaryRow.season = row.season;
        }
        if (typeof row.salary === 'number') {
          salaryRow.salary = row.salary;
        }
        if (typeof row.capHit === 'number') {
          salaryRow.capHit = row.capHit;
        }

        return Object.keys(salaryRow).length > 0 ? [salaryRow] : [];
      })
    : undefined;

  const contractBirdRights = player.contract?.birdRights;
  const contract: NonNullable<CapHoldPlayerInput['contract']> = {};
  if (
    contractBirdRights &&
    typeof contractBirdRights === 'object' &&
    typeof contractBirdRights.status === 'string'
  ) {
    contract.birdRights = { status: contractBirdRights.status };
  }
  if (salaryRows !== undefined) {
    contract.salariesByYear = salaryRows;
  }
  if (Object.keys(contract).length > 0) {
    normalized.contract = contract;
  }

  normalized.birdRights = player.birdRights;

  return normalized;
}

function getRosterEntryId(entry: OffseasonRosterEntry | null | undefined): string | null {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return entry.player_id || entry.playerId || entry.id || null;
}

function removePlayerFromRoster(
  roster: OffseasonRosterEntry[],
  playerId: string
): OffseasonRosterEntry[] {
  if (!Array.isArray(roster)) return roster;
  return roster.filter((entry) => getRosterEntryId(entry) !== playerId);
}

function filterRosterByPlayerIds(
  roster: OffseasonRosterEntry[],
  playerIds: Set<string>
): OffseasonRosterEntry[] {
  if (!Array.isArray(roster)) return roster;
  return roster.filter((entry) => {
    const entryId = getRosterEntryId(entry);
    if (!entryId) return true;
    return playerIds.has(entryId);
  });
}

function normalizeExceptionsShape(exceptions: OffseasonExceptions | null | undefined): {
  normalized: OffseasonExceptions;
  changed: boolean;
} {
  const normalized: OffseasonExceptions = { ...(exceptions || {}) };
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

function pruneExpiredCapHolds(
  team: OffseasonTeamCapSheet,
  toSeason: string
): { hasChanges: boolean } {
  if (!team?.capHolds || !Array.isArray(team.capHolds)) {
    return { hasChanges: false };
  }

  let hasChanges = false;
  const seasonStartDate = new Date(`${toSeason.split('-')[0]}-07-01`);

  const activeCapHolds = team.capHolds.filter((hold: OffseasonCapHold) => {
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

function advanceDeadMoney(
  team: OffseasonTeamCapSheet,
  toYear: number
): { hasChanges: boolean } {
  if (!team) return { hasChanges: false };
  let hasChanges = false;

  const filterDeadCapObject = (deadCap: OffseasonDeadCapByYear) => {
    const remaining: OffseasonDeadCapByYear = {};
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
      .map((contract) => {
        if (!contract?.deadCap || typeof contract.deadCap !== 'object') {
          return contract;
        }
        const remaining = filterDeadCapObject(contract.deadCap);
        return Object.keys(remaining).length > 0
          ? { ...contract, deadCap: remaining }
          : null;
      })
      .filter(
        (contract): contract is OffseasonDeadCapHistoryEntry =>
          Boolean(contract)
      );
  }

  if (Array.isArray(team.stretchHistory)) {
    team.stretchHistory = team.stretchHistory
      .map((contract) => {
        if (!contract?.deadCap || typeof contract.deadCap !== 'object') {
          return contract;
        }
        const remaining = filterDeadCapObject(contract.deadCap);
        return Object.keys(remaining).length > 0
          ? { ...contract, deadCap: remaining }
          : null;
      })
      .filter(
        (contract): contract is OffseasonDeadCapHistoryEntry =>
          Boolean(contract)
      );
  }

  if (team.deadMoney && typeof team.deadMoney === 'object') {
    const remainingDeadMoney = filterDeadCapObject(team.deadMoney);
    team.deadMoney = remainingDeadMoney;
  }

  return { hasChanges };
}

function clearHardCapState(team: OffseasonTeamCapSheet): boolean {
  if (!team) return false;

  const fields: Array<
    | 'hardCapTriggered'
    | 'hardCapFirstApron'
    | 'hardCapSecondApron'
    | 'hardCapYear'
    | 'hardCapLevel'
    | 'hardCapReason'
    | 'hardCapTriggeredBy'
  > = [
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
      player.contract.salariesByYear = salaries.map((row: OffseasonSalaryRow, idx: number) => {
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
      contract.salariesByYear = contract.salariesByYear.filter((row: OffseasonSalaryRow) => {
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
            Number(expiredTpe.remainingAmount ?? expiredTpe.amount ?? 0) || 0;
          const totalAmount =
            Number(expiredTpe.totalAmount ?? expiredTpe.amount ?? amountExpired) ||
            amountExpired;

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
