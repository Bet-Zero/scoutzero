import {
  type TradeApronLevel,
  type TradeApronRestrictionRow,
  type TradeApronRestrictionTrigger,
  type TradeHardCapLedgerEntry,
  type TradeHardCapProof,
} from '@/schemas/tradeApronRestriction';
import {
  CANON_GOVERNED_SEASON_REGISTRY,
  isWithinSalaryCapYear,
  resolveGovernedSeasonEnvelope,
} from '@/features/architect/utils/governedSeason';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import type {
  TradeExceptionRecord,
  TradeTeam,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type { TradeSalaryMatchingPath } from '@/schemas/tradeSalaryMatchingPath';
import type { TradeSalaryPathEvaluation } from './tradeSalaryMatchingPaths';
import { normalizeTradeApronEnvelopeDate } from './tradeApronDate';
import { parseTradeHardCapLedger } from './tradeHardCapLedgerAuthority';
import { GovernedSignAndTradeAuthorityZ } from '@/schemas/governedSignAndTrade';
import { cashDollarsToCents } from './tradeCashRouting';

export { parseTradeHardCapLedger } from './tradeHardCapLedgerAuthority';

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
  attachedRestrictions: TradeApronRestrictionTrigger[];
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

function resolvePlayerIdentity(player: {
  player_id?: unknown;
  playerId?: unknown;
  id?: unknown;
}): string {
  return String(player.player_id ?? player.playerId ?? player.id ?? '').trim();
}

function result(
  values: Partial<TradeApronRestrictionEvaluation> &
    Pick<TradeApronRestrictionEvaluation, 'status'>
): TradeApronRestrictionEvaluation {
  return {
    version: 1,
    status: values.status,
    passed: values.status === 'PASS' || values.status === 'NOT_APPLICABLE',
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
    attachedRestrictions: values.attachedRestrictions ?? [],
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
    return acquisitionInstant <= expiryInstant ? 'WITHIN_WINDOW' : 'EXPIRED';
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
  calendarEnvelope: ReturnType<typeof resolveGovernedSeasonEnvelope>,
  levelEnvelope: ReturnType<typeof resolveGovernedSeasonEnvelope>,
  apronLevel: TradeApronLevel
): TradeHardCapProof | null {
  const calendar = calendarEnvelope.calendar.record;
  const level =
    levelEnvelope.systemLevels[
      apronLevel === 'FIRST_APRON' ? 'first-apron' : 'second-apron'
    ].record;
  if (!calendar || !level) return null;
  return {
    registryId: levelEnvelope.registry.registryId,
    registryVersion: levelEnvelope.registry.registryVersion,
    canonCandidateCommit: levelEnvelope.registry.canonCandidateCommit,
    canonSha256: levelEnvelope.registry.canonSha256,
    calendarRecordId: calendar.recordId,
    calendarRecordVersion: calendar.recordVersion,
    apronRecordId: level.recordId,
    apronRecordVersion: level.recordVersion,
  };
}

function resolveRowFClosingForHeldTpe({
  timing,
  transactionDate,
  teamCode,
  worldId,
}: {
  timing: TpeTiming;
  transactionDate: string;
  teamCode: string;
  worldId?: string | null;
}): {
  closing: string | null;
  calendarEnvelope: ReturnType<typeof resolveGovernedSeasonEnvelope> | null;
  missingInputs: string[];
} {
  const createdAsOf = normalizeTradeApronEnvelopeDate(timing.createdOn);
  if (!createdAsOf) {
    return {
      closing: null,
      calendarEnvelope: null,
      missingInputs: [`heldTpe.${timing.tpeId}.createdOn`],
    };
  }
  const creationSalaryCapYear =
    CANON_GOVERNED_SEASON_REGISTRY.calendars.find((calendar) =>
      isWithinSalaryCapYear(createdAsOf, calendar.salaryCapYear)
    )?.salaryCapYear ?? null;
  if (creationSalaryCapYear === null) {
    return {
      closing: null,
      calendarEnvelope: null,
      missingInputs: [
        `heldTpe.${timing.tpeId}.creationSeasonCalendarAuthority`,
      ],
    };
  }

  const team = {
    teamId: teamCode,
    teamCode,
    worldId: worldId ?? undefined,
  };
  const creationEnvelope = resolveGovernedSeasonEnvelope({
    // Resolve the retained creation-season calendar at the end of that Salary
    // Cap Year. The calendar may have been published after the TPE arose; Row
    // F needs the governed season fact, not a publication-time guess.
    asOfDate: `${creationSalaryCapYear}-06-30T12:00:00-04:00`,
    salaryCapYear: creationSalaryCapYear,
    requiredAuthority: 'official',
    team,
  });
  const creationClosing =
    creationEnvelope.calendar.state === 'available'
      ? (creationEnvelope.calendar.regularSeasonClosing?.value ?? null)
      : null;
  if (!creationClosing) {
    return {
      closing: null,
      calendarEnvelope: creationEnvelope,
      missingInputs: [
        `heldTpe.${timing.tpeId}.creationSeasonCalendarAuthority`,
      ],
    };
  }

  const createdDay = dateOnly(timing.createdOn);
  if (createdDay && createdDay <= creationClosing) {
    return {
      closing: creationClosing,
      calendarEnvelope: creationEnvelope,
      missingInputs: [],
    };
  }

  const transactionAsOf = normalizeTradeApronEnvelopeDate(transactionDate);
  const followingSalaryCapYear = creationSalaryCapYear + 1;
  if (
    !transactionAsOf ||
    !isWithinSalaryCapYear(transactionAsOf, followingSalaryCapYear)
  ) {
    return {
      closing: null,
      calendarEnvelope: creationEnvelope,
      missingInputs: [],
    };
  }
  const followingEnvelope = resolveGovernedSeasonEnvelope({
    asOfDate: transactionAsOf,
    salaryCapYear: followingSalaryCapYear,
    requiredAuthority: 'official',
    team,
  });
  const followingClosing =
    followingEnvelope.calendar.state === 'available'
      ? (followingEnvelope.calendar.regularSeasonClosing?.value ?? null)
      : null;
  if (!followingClosing) {
    return {
      closing: null,
      calendarEnvelope: followingEnvelope,
      missingInputs: [
        `heldTpe.${timing.tpeId}.followingSeasonCalendarAuthority`,
      ],
    };
  }
  return {
    closing: followingClosing,
    calendarEnvelope: followingEnvelope,
    missingInputs: [],
  };
}

export function evaluateTradeApronRestriction({
  team,
  teamCode,
  pathEvaluation,
  context,
}: EvaluationInput): TradeApronRestrictionEvaluation {
  const path = pathEvaluation?.electedPath ?? null;
  const cashSentCents = cashDollarsToCents(team.cashSent);
  const paysCash = cashSentCents !== null && cashSentCents > 0;
  const incomingSignAndTradePlayers = (
    team.incomingPlayers ||
    team.receives ||
    []
  ).filter((player) => player.signAndTrade === true);
  const usesSavedWorldSignAndTradeAuthority =
    Boolean(context.worldId) && incomingSignAndTradePlayers.length > 0;
  if (!path || pathEvaluation?.status !== 'PASS') {
    return result({
      status: 'NOT_APPLICABLE',
      salaryMatchingPath: path,
      transactionDate: context.tradeDate ?? null,
      salaryCapYear: context.currentYear ?? null,
    });
  }
  if (path === 'ROOM' && !usesSavedWorldSignAndTradeAuthority && !paysCash) {
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
  const canonicalTeamCode = String(team.team?.teamCode || '')
    .trim()
    .toUpperCase();
  const postSalary = finiteMoney(pathEvaluation.postAssignmentApronTeamSalary);
  let signAndTradeApronAdjustment = 0;
  if (usesSavedWorldSignAndTradeAuthority) {
    incomingSignAndTradePlayers.forEach((player, index) => {
      const authority = GovernedSignAndTradeAuthorityZ.safeParse(
        (
          player as typeof player & {
            governedSignAndTradeAuthority?: unknown;
          }
        ).governedSignAndTradeAuthority
      );
      const incomingPlayerId = resolvePlayerIdentity(player);
      if (!authority.success) {
        missingInputs.push(
          `signAndTradeReceiver.${incomingPlayerId || index}.governedAuthority.schema`
        );
        return;
      }
      const authorityMismatch =
        authority.data.worldId !== context.worldId
          ? 'world'
          : !canonicalTeamCode ||
              authority.data.destinationTeamId !== canonicalTeamCode
            ? 'destinationTeam'
            : authority.data.playerId !== incomingPlayerId
              ? 'player'
              : authority.data.salaryCapYear !== salaryCapYear
                ? 'salaryCapYear'
                : authority.data.transactionAt.slice(0, 10) !==
                    transactionDate?.slice(0, 10)
                  ? 'transactionDate'
                  : null;
      if (authorityMismatch) {
        missingInputs.push(
          `signAndTradeReceiver.${incomingPlayerId || index}.governedAuthority.${authorityMismatch}`
        );
        return;
      }
      signAndTradeApronAdjustment +=
        authority.data.contract.firstSeasonUnlikelyBonuses;
    });
  }
  const projectedMatchingSalary = finiteMoney(team.projectedSalary);
  const projectedSalary =
    projectedMatchingSalary === null
      ? null
      : projectedMatchingSalary + signAndTradeApronAdjustment;
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
  let transactionRegularSeasonClosing: string | null = null;
  let standardWindowExpired = false;
  const timingByComponentId = new Map<string, TpeTiming>();
  const rowFByComponentId = new Map<
    string,
    {
      closing: string;
      calendarEnvelope: ReturnType<typeof resolveGovernedSeasonEnvelope>;
    }
  >();

  const components = pathEvaluation.components;
  const componentIds = new Set<string>();
  const playerAssignments = new Map<string, string>();
  components.forEach((component, componentIndex) => {
    const componentId = component.componentId?.trim();
    if (!componentId) {
      missingInputs.push(`componentAttribution.${componentIndex}.identity`);
    } else if (componentIds.has(componentId)) {
      missingInputs.push(`componentAttribution.${componentId}.conflict`);
    } else {
      componentIds.add(componentId);
    }
    if (
      component.kind === 'HELD_STANDARD_TPE' &&
      component.path !== 'STANDARD_TPE'
    ) {
      missingInputs.push(
        `componentAttribution.${componentId || componentIndex}.path`
      );
    }
    if (
      (component.kind === 'HELD_STANDARD_TPE' ||
        (path === 'AGGREGATED_STANDARD_TPE' &&
          component.kind === 'ELECTED_PATH')) &&
      component.incomingPlayers.length === 0
    ) {
      missingInputs.push(
        `componentAttribution.${componentId || componentIndex}.incomingPlayers`
      );
    }
    component.incomingPlayers.forEach((player, playerIndex) => {
      const playerId = player.playerId?.trim();
      if (!playerId) {
        missingInputs.push(
          `componentAttribution.${componentId || componentIndex}.incomingPlayers.${playerIndex}.identity`
        );
        return;
      }
      if (!Number.isFinite(player.salary) || player.salary < 0) {
        missingInputs.push(
          `componentAttribution.${componentId || componentIndex}.incomingPlayers.${playerIndex}.salary`
        );
      }
      const priorComponentId = playerAssignments.get(playerId);
      if (priorComponentId !== undefined) {
        missingInputs.push(`componentAttribution.player.${playerId}.conflict`);
      } else if (componentId) {
        playerAssignments.set(playerId, componentId);
      }
    });
  });

  const electedComponents = components.filter(
    (component) => component.kind === 'ELECTED_PATH'
  );
  const aggregatedComponents = electedComponents.filter(
    (component) => component.path === 'AGGREGATED_STANDARD_TPE'
  );
  if (
    path === 'AGGREGATED_STANDARD_TPE' &&
    (electedComponents.length !== 1 || aggregatedComponents.length !== 1)
  ) {
    missingInputs.push('componentAttribution.aggregatedStandardTpe');
  }

  if (path === 'STANDARD_TPE' || path === 'AGGREGATED_STANDARD_TPE') {
    const heldComponents = components.filter(
      (component) => component.kind === 'HELD_STANDARD_TPE'
    );
    if (
      path === 'STANDARD_TPE' &&
      heldComponents.length === 0 &&
      incomingSignAndTradePlayers.length === 0 &&
      !paysCash
    ) {
      return result({
        status: 'NOT_APPLICABLE',
        salaryMatchingPath: path,
        transactionDate,
        salaryCapYear: typeof salaryCapYear === 'number' ? salaryCapYear : null,
      });
    }
    for (const held of heldComponents) {
      if (!held.componentId?.trim()) {
        missingInputs.push('heldTpe.identity');
        continue;
      }
      const timingResolution = resolveTpeTiming(team, held.componentId);
      missingInputs.push(...timingResolution.missingInputs);
      const timing = timingResolution.timing;
      if (timing) {
        tpeTimings.push(timing);
        timingByComponentId.set(held.componentId, timing);
      }
      if (timing) {
        const anniversary = oneYearAnniversaryDate(timing.createdOn);
        if (!anniversary) {
          missingInputs.push(`heldTpe.${timing.tpeId}.oneYearAnniversary`);
        } else if (dateOnly(timing.expiresOn) !== anniversary) {
          missingInputs.push(
            `heldTpe.${timing.tpeId}.expiresOn.oneYearReconciliation`
          );
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
  tpeTimings.sort((left, right) => left.tpeId.localeCompare(right.tpeId));

  const envelopeAsOf = transactionDate
    ? normalizeTradeApronEnvelopeDate(transactionDate)
    : null;
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
    transactionRegularSeasonClosing =
      envelope.calendar.regularSeasonClosing?.value ?? null;
    regularSeasonClosing = transactionRegularSeasonClosing;
  }

  if (transactionDate && tpeTimings.length > 0) {
    const acquisitionDay = dateOnly(transactionDate);
    for (const timing of tpeTimings) {
      const rowFResolution = resolveRowFClosingForHeldTpe({
        timing,
        transactionDate,
        teamCode,
        worldId: context.worldId,
      });
      missingInputs.push(...rowFResolution.missingInputs);
      if (!regularSeasonClosing && rowFResolution.closing) {
        regularSeasonClosing = rowFResolution.closing;
      }
      if (
        acquisitionDay &&
        rowFResolution.closing &&
        acquisitionDay > rowFResolution.closing &&
        rowFResolution.calendarEnvelope
      ) {
        restrictionRow = 'F';
        apronLevel = 'FIRST_APRON';
        regularSeasonClosing = rowFResolution.closing;
        rowFByComponentId.set(timing.tpeId, {
          closing: rowFResolution.closing,
          calendarEnvelope: rowFResolution.calendarEnvelope,
        });
      }
    }
  }

  if (
    paysCash &&
    transactionDate &&
    transactionRegularSeasonClosing &&
    dateOnly(transactionDate) &&
    dateOnly(transactionDate)! > transactionRegularSeasonClosing
  ) {
    missingInputs.push('subsequentSalaryCapYear.systemLevels');
    missingInputs.push('subsequentSalaryCapYear.A05.17Assumptions');
  }

  if (missingInputs.length > 0) {
    return result({
      status: 'NEEDS_INPUT',
      restrictionRow,
      salaryMatchingPath: path,
      apronLevel,
      postTransactionApronTeamSalary: postSalary,
      transactionDate,
      salaryCapYear: typeof salaryCapYear === 'number' ? salaryCapYear : null,
      tpeId: tpeTimings[0]?.tpeId ?? null,
      tpeCreatedOn: tpeTimings[0]?.createdOn ?? null,
      tpeExpiresOn: tpeTimings[0]?.expiresOn ?? null,
      tpeTimings,
      attachedRestrictions: [],
      regularSeasonClosing,
      canonLeafIds:
        path === 'STANDARD_TPE'
          ? ['CBA2-A02.3']
          : ['CBA2-A02.3', 'CBA2-A05.10'],
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
      attachedRestrictions: [],
      regularSeasonClosing,
      canonLeafIds: ['CBA2-A02.3'],
      violations: [
        'The held Standard TPE is outside its exact one-year acquisition window.',
      ],
    });
  }

  type PendingRestriction = {
    restrictionRow: TradeApronRestrictionRow;
    componentId: string;
    componentKind:
      | 'SIGN_AND_TRADE'
      | 'ELECTED_PATH'
      | 'HELD_STANDARD_TPE'
      | 'CASH';
    componentPath: TradeSalaryMatchingPath;
    incomingPlayers: Array<{
      playerId: string;
      playerName: string;
      salary: number;
    }>;
    apronLevel: TradeApronLevel;
    tpeTiming: TpeTiming | null;
    cashAmountCents: number | null;
    closing: string | null;
    calendarEnvelope: ReturnType<typeof resolveGovernedSeasonEnvelope>;
  };
  const pendingRestrictions: PendingRestriction[] = [];
  if (paysCash) {
    pendingRestrictions.push({
      restrictionRow: 'I',
      componentId: `cash:${teamCode}`,
      componentKind: 'CASH',
      componentPath: path,
      incomingPlayers: [],
      apronLevel: 'SECOND_APRON',
      tpeTiming: null,
      cashAmountCents: cashSentCents,
      closing: null,
      calendarEnvelope: envelope,
    });
  }
  incomingSignAndTradePlayers.forEach((player, index) => {
    const incomingPlayerId = resolvePlayerIdentity(player);
    const incomingSalary = finiteMoney(player.matchIncoming);
    if (!incomingPlayerId || incomingSalary === null) {
      missingInputs.push(
        `signAndTradeReceiver.${incomingPlayerId || index}.identityOrSalary`
      );
      return;
    }
    pendingRestrictions.push({
      restrictionRow: 'C',
      componentId: `sign-and-trade:${incomingPlayerId}`,
      componentKind: 'SIGN_AND_TRADE',
      componentPath: path,
      incomingPlayers: [
        {
          playerId: incomingPlayerId,
          playerName: String(player.name || player.displayName || ''),
          salary: incomingSalary,
        },
      ],
      apronLevel: 'FIRST_APRON',
      tpeTiming: null,
      cashAmountCents: null,
      closing: null,
      calendarEnvelope: envelope,
    });
  });
  for (const component of components) {
    if (
      component.kind === 'HELD_STANDARD_TPE' &&
      rowFByComponentId.has(component.componentId)
    ) {
      const rowF = rowFByComponentId.get(component.componentId)!;
      pendingRestrictions.push({
        restrictionRow: 'F',
        componentId: component.componentId,
        componentKind: component.kind,
        componentPath: component.path,
        incomingPlayers: component.incomingPlayers,
        apronLevel: 'FIRST_APRON',
        tpeTiming: timingByComponentId.get(component.componentId) ?? null,
        cashAmountCents: null,
        closing: rowF.closing,
        calendarEnvelope: rowF.calendarEnvelope,
      });
    }
    if (
      path === 'AGGREGATED_STANDARD_TPE' &&
      component.kind === 'ELECTED_PATH' &&
      component.path === 'AGGREGATED_STANDARD_TPE'
    ) {
      pendingRestrictions.push({
        restrictionRow: 'H',
        componentId: component.componentId,
        componentKind: component.kind,
        componentPath: component.path,
        incomingPlayers: component.incomingPlayers,
        apronLevel: 'SECOND_APRON',
        tpeTiming: null,
        cashAmountCents: null,
        closing: null,
        calendarEnvelope: envelope,
      });
    }
  }
  pendingRestrictions.sort(
    (left, right) =>
      left.apronLevel.localeCompare(right.apronLevel) ||
      left.componentId.localeCompare(right.componentId)
  );

  if (pendingRestrictions.length === 0 && missingInputs.length === 0) {
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
      attachedRestrictions: [],
      regularSeasonClosing,
      canonLeafIds: ['CBA2-A02.3', 'CBA2-A05.8'],
    });
  }

  const attachedRestrictions: TradeApronRestrictionTrigger[] = [];
  for (const pending of pendingRestrictions) {
    const levelResolution =
      envelope.systemLevels[
        pending.apronLevel === 'FIRST_APRON' ? 'first-apron' : 'second-apron'
      ];
    const triggerCeiling =
      levelResolution.state === 'available' ? levelResolution.amount : null;
    const triggerProof = makeProof(
      pending.calendarEnvelope,
      envelope,
      pending.apronLevel
    );
    if (triggerCeiling === null || !triggerProof) {
      missingInputs.push(
        `applicableApronLevel.${pending.restrictionRow}.${pending.componentId}`
      );
      continue;
    }
    attachedRestrictions.push({
      restrictionRow: pending.restrictionRow,
      componentId: pending.componentId,
      componentKind: pending.componentKind,
      salaryMatchingPath: pending.componentPath,
      apronLevel: pending.apronLevel,
      ceiling: triggerCeiling,
      incomingPlayers: [...pending.incomingPlayers]
        .map((player) => ({ ...player }))
        .sort((left, right) => left.playerId.localeCompare(right.playerId)),
      cashAmountCents: pending.cashAmountCents,
      tpeTiming: pending.tpeTiming ? { ...pending.tpeTiming } : null,
      regularSeasonClosing: pending.closing,
      canonLeafIds:
        pending.restrictionRow === 'C'
          ? ['CBA2-A05.5', 'CBA2-A05.1']
          : pending.restrictionRow === 'F'
            ? ['CBA2-A02.3', 'CBA2-A05.8', 'CBA2-A05.1']
            : pending.restrictionRow === 'H'
              ? ['CBA2-A05.10', 'CBA2-A05.1']
              : ['CBA2-A05.11', 'CBA2-A05.1'],
      proof: triggerProof,
    });
  }
  if (
    missingInputs.length > 0 ||
    attachedRestrictions.length !== pendingRestrictions.length ||
    postSalary === null
  ) {
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
      attachedRestrictions,
      regularSeasonClosing,
      missingInputs:
        missingInputs.length > 0
          ? [...new Set(missingInputs)]
          : ['applicableApronLevel'],
      violations: ['The applicable governed apron level is unavailable.'],
    });
  }
  const controllingRestriction = [...attachedRestrictions].sort(
    (left, right) =>
      left.ceiling - right.ceiling ||
      left.restrictionRow.localeCompare(right.restrictionRow) ||
      left.componentId.localeCompare(right.componentId)
  )[0];
  restrictionRow = controllingRestriction.restrictionRow;
  apronLevel = controllingRestriction.apronLevel;
  const ceiling = controllingRestriction.ceiling;
  const proof = controllingRestriction.proof;
  const margin = ceiling - postSalary;
  const passed = postSalary <= ceiling;
  const finalizedRestrictions = attachedRestrictions.map((trigger) => ({
    ...trigger,
    canonLeafIds: passed
      ? [...trigger.canonLeafIds, 'CBA2-A05.2']
      : [...trigger.canonLeafIds],
  }));
  const canonLeafIds = [
    ...new Set(
      finalizedRestrictions.flatMap((trigger) =>
        trigger.canonLeafIds.filter((leafId) => leafId !== 'CBA2-A05.2')
      )
    ),
    ...(passed ? ['CBA2-A05.2'] : []),
  ];
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
    attachedRestrictions: finalizedRestrictions,
    regularSeasonClosing,
    hardCapWillPersist: passed,
    canonLeafIds,
    violations: passed
      ? []
      : [
          `Transaction Restrictions Table Row ${restrictionRow} prohibits this trade because post-transaction Apron Team Salary exceeds the ${apronLevel === 'FIRST_APRON' ? 'First' : 'Second'} Apron by $${Math.abs(margin).toLocaleString('en-US')}.`,
        ],
    proof,
  });
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
      ? Math.max(...parsedEntries.map((candidate) => candidate.salaryCapYear))
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
    evaluation.ceiling === null ||
    evaluation.salaryCapYear === null ||
    !evaluation.transactionDate ||
    !evaluation.proof ||
    evaluation.attachedRestrictions.length === 0 ||
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
    tpeTimings: evaluation.tpeTimings.map((timing) => ({ ...timing })),
    canonLeafIds: [...evaluation.canonLeafIds],
    proof: evaluation.proof,
    triggers: evaluation.attachedRestrictions.map((trigger) => ({
      ...trigger,
      incomingPlayers: trigger.incomingPlayers.map((player) => ({ ...player })),
      tpeTiming: trigger.tpeTiming ? { ...trigger.tpeTiming } : null,
      canonLeafIds: [...trigger.canonLeafIds],
      proof: { ...trigger.proof },
    })),
  };
}
