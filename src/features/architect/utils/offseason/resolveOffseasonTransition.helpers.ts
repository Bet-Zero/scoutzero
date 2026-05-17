/**
 * Wave 27: Private types and helper functions extracted from
 * resolveOffseasonTransition.ts (lines 62–570).
 */

import {
  type CapHold,
  type CapHoldPlayerInput,
} from '@/features/architect/utils/capHolds';
import {
  type TpeLifecycleRecord,
} from '@/features/architect/utils/tpeLifecycle';
import { type CapProjectionOverrides } from '@/features/architect/utils/capRulesProfile';

// ============================================================
// Types (exported — used by main function and Wave 17 satellites)
// ============================================================

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

export type OffseasonSalaryRow = {
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

export type OffseasonRosterEntry =
  | string
  | {
      player_id?: string | null;
      playerId?: string | null;
      id?: string | null;
    };

export type OffseasonDeadCapByYear = Record<string, number | string | null>;

export type OffseasonDeadCapHistoryEntry = {
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

export type OffseasonExceptions = OffseasonKnownExceptions & Record<string, unknown>;

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


// ============================================================
// Private helper functions
// ============================================================

export function cloneTeam<T>(team: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(team);
  }
  return JSON.parse(JSON.stringify(team));
}

export function normalizeCapHoldPlayer(
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

export function getRosterEntryId(entry: OffseasonRosterEntry | null | undefined): string | null {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return entry.player_id || entry.playerId || entry.id || null;
}

export function removePlayerFromRoster(
  roster: OffseasonRosterEntry[],
  playerId: string
): OffseasonRosterEntry[] {
  if (!Array.isArray(roster)) return roster;
  return roster.filter((entry) => getRosterEntryId(entry) !== playerId);
}

export function filterRosterByPlayerIds(
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

export function normalizeExceptionsShape(exceptions: OffseasonExceptions | null | undefined): {
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

export function pruneExpiredCapHolds(
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

export function advanceDeadMoney(
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

export function clearHardCapState(team: OffseasonTeamCapSheet): boolean {
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
