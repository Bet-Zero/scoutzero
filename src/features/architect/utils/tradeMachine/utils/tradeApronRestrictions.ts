import {
  TradeHardCapLedgerZ,
  type TradeApronLevel,
  type TradeApronRestrictionRow,
  type TradeHardCapLedgerEntry,
  type TradeHardCapProof,
} from '@/schemas/tradeApronRestriction';
import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import type {
  TradeExceptionRecord,
  TradeTeam,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  TradeSalaryMatchingPath,
} from '@/schemas/tradeSalaryMatchingPath';
import type {
  TradeSalaryPathEvaluation,
} from './tradeSalaryMatchingPaths';

export type TradeApronRestrictionStatus =
  | 'PASS'
  | 'FAIL'
  | 'NEEDS_INPUT'
  | 'NOT_APPLICABLE';

export type TradeApronRestrictionEvaluation = {
  version: 1;
  status: TradeApronRestrictionStatus;
  passed: boolean;
  restrictionRow: TradeApronRestrictionRow | null;
  salaryMatchingPath: TradeSalaryMatchingPath | null;
  apronLevel: TradeApronLevel | null;
  ceiling: number | null;
  postTransactionApronTeamSalary: number | null;
  margin: number | null;
  transactionDate: string | null;
  salaryCapYear: number | null;
  tpeId: string | null;
  tpeCreatedOn: string | null;
  tpeExpiresOn: string | null;
  tpeTimings: TpeTiming[];
  regularSeasonClosing: string | null;
  hardCapWillPersist: boolean;
  canonLeafIds: readonly string[];
  missingInputs: string[];
  violations: string[];
  proof: TradeHardCapProof | null;
};

type EvaluationInput = {
  team: TradeTeam;
  teamCode: string;
  pathEvaluation: TradeSalaryPathEvaluation | null;
  context: TradeValidatorContext;
};

export type TpeTiming = {
  tpeId: string;
  createdOn: string;
  expiresOn: string;
};

function dateOnly(value: string): string | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function exactInstant(value: string): number | null {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteMoney(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function envelopeDate(value: string): string | null {
  if (exactInstant(value) !== null) return value;
  const day = dateOnly(value);
  return day ? `${day}T12:00:00Z` : null;
}

function result(
  values: Partial<TradeApronRestrictionEvaluation> &
    Pick<TradeApronRestrictionEvaluation, 'status'>
): TradeApronRestrictionEvaluation {
  return {
    version: 1,
    status: values.status,
    passed:
      values.status === 'PASS' || values.status === 'NOT_APPLICABLE',
    restrictionRow: values.restrictionRow ?? null,
    salaryMatchingPath: values.salaryMatchingPath ?? null,
    apronLevel: values.apronLevel ?? null,
    ceiling: values.ceiling ?? null,
    postTransactionApronTeamSalary:
      values.postTransactionApronTeamSalary ?? null,
    margin: values.margin ?? null,
    transactionDate: values.transactionDate ?? null,
    salaryCapYear: values.salaryCapYear ?? null,
    tpeId: values.tpeId ?? null,
    tpeCreatedOn: values.tpeCreatedOn ?? null,
    tpeExpiresOn: values.tpeExpiresOn ?? null,
    tpeTimings: values.tpeTimings ?? [],
    regularSeasonClosing: values.regularSeasonClosing ?? null,
    hardCapWillPersist: values.hardCapWillPersist ?? false,
    canonLeafIds: values.canonLeafIds ?? [],
    missingInputs: values.missingInputs ?? [],
    violations: values.violations ?? [],
    proof: values.proof ?? null,
  };
}

function resolveTpeTiming(
  team: TradeTeam,
  tpeId: string
): { timing: TpeTiming | null; missingInputs: string[] } {
  const tpe = (getTeamTpeList(team.team) as TradeExceptionRecord[]).find(
    (candidate) => candidate.id === tpeId
  );
  if (!tpe) {
    return { timing: null, missingInputs: [`heldTpe.${tpeId}.identity`] };
  }
  const createdOn =
    typeof tpe.createdOn === 'string' && tpe.createdOn.trim()
      ? tpe.createdOn.trim()
      : null;
  const expiresOn =
    [tpe.expiresOn, tpe.expirationDate, tpe.expiryISO, tpe.expiryDate].find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    ) ?? null;
  const missingInputs: string[] = [];
  if (!createdOn) missingInputs.push(`heldTpe.${tpeId}.createdOn`);
  if (!expiresOn) missingInputs.push(`heldTpe.${tpeId}.expiresOn`);
  if (missingInputs.length > 0 || !createdOn || !expiresOn) {
    return { timing: null, missingInputs };
  }
  if (!dateOnly(createdOn)) missingInputs.push(`heldTpe.${tpeId}.createdOn`);
  if (!dateOnly(expiresOn)) missingInputs.push(`heldTpe.${tpeId}.expiresOn`);
  return missingInputs.length > 0
    ? { timing: null, missingInputs }
    : { timing: { tpeId, createdOn, expiresOn }, missingInputs: [] };
}

function compareAcquisitionToExpiry(
  acquisition: string,
  expiry: string
): 'WITHIN_WINDOW' | 'EXPIRED' | 'NEEDS_EXACT_TIME' {
  const acquisitionInstant = exactInstant(acquisition);
  const expiryInstant = exactInstant(expiry);
  if (acquisitionInstant !== null && expiryInstant !== null) {
    return acquisitionInstant <= expiryInstant
      ? 'WITHIN_WINDOW'
      : 'EXPIRED';
  }
  const acquisitionDay = dateOnly(acquisition);
  const expiryDay = dateOnly(expiry);
  if (!acquisitionDay || !expiryDay || acquisitionDay === expiryDay) {
    return 'NEEDS_EXACT_TIME';
  }
  return acquisitionDay < expiryDay ? 'WITHIN_WINDOW' : 'EXPIRED';
}

function oneYearAnniversaryDate(value: string): string | null {
  const day = dateOnly(value);
  if (!day) return null;
  const [year, month, date] = day.split('-').map(Number);
  const targetYear = year + 1;
  const anniversary = new Date(Date.UTC(targetYear, month - 1, date));
  if (
    anniversary.getUTCFullYear() !== targetYear ||
    anniversary.getUTCMonth() !== month - 1 ||
    anniversary.getUTCDate() !== date
  ) {
    return null;
  }
  return `${String(targetYear).padStart(4, '0')}-${String(month).padStart(
    2,
    '0'
  )}-${String(date).padStart(2, '0')}`;
}

function makeProof(
  envelope: ReturnType<typeof resolveGovernedSeasonEnvelope>,
  apronLevel: TradeApronLevel
): TradeHardCapProof | null {
  const calendar = envelope.calendar.record;
  const level =
    envelope.systemLevels[
      apronLevel === 'FIRST_APRON' ? 'first-apron' : 'second-apron'
    ].record;
  if (!calendar || !level) return null;
  return {
    registryId: envelope.registry.registryId,
    registryVersion: envelope.registry.registryVersion,
    canonCandidateCommit: envelope.registry.canonCandidateCommit,
    canonSha256: envelope.registry.canonSha256,
    calendarRecordId: calendar.recordId,
    calendarRecordVersion: calendar.recordVersion,
    apronRecordId: level.recordId,
    apronRecordVersion: level.recordVersion,
  };
}

export function evaluateTradeApronRestriction({
  team,
  teamCode,
  pathEvaluation,
  context,
}: EvaluationInput): TradeApronRestrictionEvaluation {
  const path = pathEvaluation?.electedPath ?? null;
  if (!path || pathEvaluation?.status !== 'PASS') {
    return result({
      status: 'NOT_APPLICABLE',
      salaryMatchingPath: path,
      transactionDate: context.tradeDate ?? null,
      salaryCapYear: context.currentYear ?? null,
    });
  }
  if (path === 'ROOM') {
    return result({
      status: 'NOT_APPLICABLE',
      salaryMatchingPath: path,
      transactionDate: context.tradeDate ?? null,
      salaryCapYear: context.currentYear ?? null,
    });
  }

  const missingInputs: string[] = [];
  const transactionDate = context.tradeDate ?? context.asOfDate ?? null;
  const salaryCapYear = context.currentYear ?? context.yearKey ?? null;
  const postSalary = finiteMoney(
    pathEvaluation.postAssignmentApronTeamSalary
  );
  const projectedSalary = finiteMoney(team.projectedSalary);
  if (!transactionDate || !dateOnly(transactionDate)) {
    missingInputs.push('transactionDate');
  }
  if (!Number.isInteger(salaryCapYear)) missingInputs.push('salaryCapYear');
  if (postSalary === null) missingInputs.push('postAssignmentApronTeamSalary');
  if (projectedSalary === null) missingInputs.push('projectedApronTeamSalary');
  if (
    postSalary !== null &&
    projectedSalary !== null &&
    postSalary !== projectedSalary
  ) {
    missingInputs.push('postAssignmentApronTeamSalary.reconciliation');
  }

  let restrictionRow: TradeApronRestrictionRow | null =
    path === 'AGGREGATED_STANDARD_TPE' ? 'H' : null;
  let apronLevel: TradeApronLevel | null =
    restrictionRow === 'H' ? 'SECOND_APRON' : null;
  const tpeTimings: TpeTiming[] = [];
  let regularSeasonClosing: string | null = null;
  let standardWindowExpired = false;

  if (path === 'STANDARD_TPE') {
    const heldComponents = pathEvaluation.components.filter(
      (component) => component.kind === 'HELD_STANDARD_TPE'
    );
    if (heldComponents.length === 0) {
      return result({
        status: 'NOT_APPLICABLE',
        salaryMatchingPath: path,
        transactionDate,
        salaryCapYear:
          typeof salaryCapYear === 'number' ? salaryCapYear : null,
      });
    }
    for (const held of heldComponents) {
      const timingResolution = resolveTpeTiming(team, held.componentId);
      missingInputs.push(...timingResolution.missingInputs);
      const timing = timingResolution.timing;
      if (timing) tpeTimings.push(timing);
      if (timing) {
        const anniversary = oneYearAnniversaryDate(timing.createdOn);
        if (!anniversary) {
          missingInputs.push(`heldTpe.${timing.tpeId}.oneYearAnniversary`);
        } else if (dateOnly(timing.expiresOn) !== anniversary) {
          missingInputs.push(`heldTpe.${timing.tpeId}.expiresOn.oneYearReconciliation`);
        }
      }
      if (transactionDate && timing) {
        const window = compareAcquisitionToExpiry(
          transactionDate,
          timing.expiresOn
        );
        if (window === 'NEEDS_EXACT_TIME') {
          missingInputs.push('transactionDate.exactTimeAtTpeExpiry');
        } else if (window === 'EXPIRED') {
          standardWindowExpired = true;
        }
      }
    }
  }

  const envelopeAsOf = transactionDate ? envelopeDate(transactionDate) : null;
  const envelope = resolveGovernedSeasonEnvelope({
    asOfDate: envelopeAsOf ?? undefined,
    salaryCapYear:
      typeof salaryCapYear === 'number' ? salaryCapYear : undefined,
    requiredAuthority: 'official',
    team: {
      teamId: teamCode,
      teamCode,
      worldId: context.worldId ?? undefined,
    },
  });
  if (envelope.status !== 'complete') {
    missingInputs.push('governedSeasonEnvelope');
  } else {
    regularSeasonClosing =
      envelope.calendar.regularSeasonClosing?.value ?? null;
  }

  if (
    path === 'STANDARD_TPE' &&
    transactionDate &&
    tpeTimings.length > 0 &&
    regularSeasonClosing
  ) {
    const acquisitionDay = dateOnly(transactionDate);
    const closingDay = dateOnly(regularSeasonClosing);
    const hasAgedTpe = tpeTimings.some((timing) => {
      const createdDay = dateOnly(timing.createdOn);
      return Boolean(createdDay && closingDay && createdDay <= closingDay);
    });
    if (
      acquisitionDay &&
      closingDay &&
      acquisitionDay > closingDay &&
      hasAgedTpe
    ) {
      restrictionRow = 'F';
      apronLevel = 'FIRST_APRON';
    }
  }

  if (missingInputs.length > 0) {
    return result({
      status: 'NEEDS_INPUT',
      restrictionRow,
      salaryMatchingPath: path,
      apronLevel,
      postTransactionApronTeamSalary: postSalary,
      transactionDate,
      salaryCapYear:
        typeof salaryCapYear === 'number' ? salaryCapYear : null,
      tpeId: tpeTimings[0]?.tpeId ?? null,
      tpeCreatedOn: tpeTimings[0]?.createdOn ?? null,
      tpeExpiresOn: tpeTimings[0]?.expiresOn ?? null,
      tpeTimings,
      regularSeasonClosing,
      canonLeafIds:
        path === 'STANDARD_TPE' ? ['CBA2-A02.3'] : ['CBA2-A05.10'],
      missingInputs: [...new Set(missingInputs)],
      violations: [
        `Apron restriction needs governed input: ${[
          ...new Set(missingInputs),
        ].join(', ')}.`,
      ],
    });
  }

  if (standardWindowExpired) {
    return result({
      status: 'FAIL',
      restrictionRow,
      salaryMatchingPath: path,
      apronLevel,
      postTransactionApronTeamSalary: postSalary,
      transactionDate,
      salaryCapYear: salaryCapYear as number,
      tpeId: tpeTimings[0]?.tpeId ?? null,
      tpeCreatedOn: tpeTimings[0]?.createdOn ?? null,
      tpeExpiresOn: tpeTimings[0]?.expiresOn ?? null,
      tpeTimings,
      regularSeasonClosing,
      canonLeafIds: ['CBA2-A02.3'],
      violations: ['The held Standard TPE is outside its exact one-year acquisition window.'],
    });
  }

  if (!restrictionRow || !apronLevel) {
    return result({
      status: 'NOT_APPLICABLE',
      salaryMatchingPath: path,
      postTransactionApronTeamSalary: postSalary,
      transactionDate,
      salaryCapYear: salaryCapYear as number,
      tpeId: tpeTimings[0]?.tpeId ?? null,
      tpeCreatedOn: tpeTimings[0]?.createdOn ?? null,
      tpeExpiresOn: tpeTimings[0]?.expiresOn ?? null,
      tpeTimings,
      regularSeasonClosing,
      canonLeafIds: ['CBA2-A02.3', 'CBA2-A05.8'],
    });
  }

  const levelResolution =
    envelope.systemLevels[
      apronLevel === 'FIRST_APRON' ? 'first-apron' : 'second-apron'
    ];
  const ceiling =
    levelResolution.state === 'available' ? levelResolution.amount : null;
  const proof = makeProof(envelope, apronLevel);
  if (ceiling === null || !proof || postSalary === null) {
    return result({
      status: 'NEEDS_INPUT',
      restrictionRow,
      salaryMatchingPath: path,
      apronLevel,
      postTransactionApronTeamSalary: postSalary,
      transactionDate,
      salaryCapYear: salaryCapYear as number,
      tpeId: tpeTimings[0]?.tpeId ?? null,
      tpeCreatedOn: tpeTimings[0]?.createdOn ?? null,
      tpeExpiresOn: tpeTimings[0]?.expiresOn ?? null,
      tpeTimings,
      regularSeasonClosing,
      missingInputs: ['applicableApronLevel'],
      violations: ['The applicable governed apron level is unavailable.'],
    });
  }
  const margin = ceiling - postSalary;
  const passed = postSalary <= ceiling;
  const baseLeaves =
    restrictionRow === 'F'
      ? ['CBA2-A02.3', 'CBA2-A05.8', 'CBA2-A05.1']
      : ['CBA2-A05.10', 'CBA2-A05.1'];
  return result({
    status: passed ? 'PASS' : 'FAIL',
    restrictionRow,
    salaryMatchingPath: path,
    apronLevel,
    ceiling,
    postTransactionApronTeamSalary: postSalary,
    margin,
    transactionDate,
    salaryCapYear: salaryCapYear as number,
    tpeId: tpeTimings[0]?.tpeId ?? null,
    tpeCreatedOn: tpeTimings[0]?.createdOn ?? null,
    tpeExpiresOn: tpeTimings[0]?.expiresOn ?? null,
    tpeTimings,
    regularSeasonClosing,
    hardCapWillPersist: passed,
    canonLeafIds: passed ? [...baseLeaves, 'CBA2-A05.2'] : baseLeaves,
    violations: passed
      ? []
      : [
          `Transaction Restrictions Table Row ${restrictionRow} prohibits this trade because post-transaction Apron Team Salary exceeds the ${apronLevel === 'FIRST_APRON' ? 'First' : 'Second'} Apron by $${Math.abs(margin).toLocaleString('en-US')}.`,
        ],
    proof,
  });
}

export function parseTradeHardCapLedger(value: unknown): {
  entries: TradeHardCapLedgerEntry[];
  valid: boolean;
} {
  if (value === undefined || value === null) return { entries: [], valid: true };
  const parsed = TradeHardCapLedgerZ.safeParse(value);
  return parsed.success
    ? { entries: parsed.data, valid: true }
    : { entries: [], valid: false };
}

export function selectHardCapLedgerEntry(
  value: unknown,
  salaryCapYear?: number | null
): TradeHardCapLedgerEntry | null {
  const parsed = parseTradeHardCapLedger(value);
  if (!parsed.valid) return null;
  return selectHardCapLedgerEntryFromEntries(parsed.entries, salaryCapYear);
}

export function selectHardCapLedgerEntryFromEntries(
  parsedEntries: TradeHardCapLedgerEntry[],
  salaryCapYear?: number | null
): TradeHardCapLedgerEntry | null {
  const targetYear =
    salaryCapYear ??
    (parsedEntries.length > 0
      ? Math.max(
          ...parsedEntries.map((candidate) => candidate.salaryCapYear)
        )
      : null);
  const entries =
    targetYear === null
      ? []
      : parsedEntries.filter((entry) => entry.salaryCapYear === targetYear);
  return (
    [...entries].sort(
      (left, right) =>
        left.ceiling - right.ceiling ||
        right.effectiveAt.localeCompare(left.effectiveAt)
    )[0] ?? null
  );
}

export function createTradeHardCapLedgerEntry({
  evaluation,
  teamCode,
  transactionId,
  effectiveAt,
}: {
  evaluation: TradeApronRestrictionEvaluation;
  teamCode: string;
  transactionId: string;
  effectiveAt: string;
}): TradeHardCapLedgerEntry | null {
  if (
    evaluation.status !== 'PASS' ||
    !evaluation.restrictionRow ||
    !evaluation.apronLevel ||
    !evaluation.salaryMatchingPath ||
    evaluation.salaryMatchingPath === 'ROOM' ||
    evaluation.ceiling === null ||
    evaluation.salaryCapYear === null ||
    !evaluation.transactionDate ||
    !evaluation.proof ||
    !teamCode.trim()
  ) {
    return null;
  }
  return {
    version: 1,
    entryId: `${transactionId}:hard-cap:${teamCode.trim()}`,
    teamCode: teamCode.trim(),
    salaryCapYear: evaluation.salaryCapYear,
    restrictionRow: evaluation.restrictionRow,
    salaryMatchingPath: evaluation.salaryMatchingPath,
    apronLevel: evaluation.apronLevel,
    ceiling: evaluation.ceiling,
    triggerTransactionDate: evaluation.transactionDate,
    effectiveAt,
    expiresAt: `${evaluation.salaryCapYear}-07-01T00:00:00Z`,
    transactionId,
    tpeIds: evaluation.tpeTimings.map((timing) => timing.tpeId),
    canonLeafIds: [...evaluation.canonLeafIds],
    proof: evaluation.proof,
  };
}
