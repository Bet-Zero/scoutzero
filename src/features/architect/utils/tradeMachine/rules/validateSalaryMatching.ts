/**
 * Salary matching validation for trades
 * Enforces CBA rules for salary exchanges between teams
 *
 * NOTE: This validator delegates to the unified salary matching rules module
 * (salaryMatchingRules.ts) for all allowable incoming calculations to ensure
 * consistency between validation and UI display.
 *
 * Phase 4: Cap settings must be explicitly provided - no silent defaults
 */

import {
  formatCurrency,
  getSalaryForYear,
} from '@/features/architect/utils/tradeHelpers';
import { shouldWarnOnly } from '@/config/validationFlags';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_RULE_KEYS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { SECOND_APRON_SALARY_MISMATCH } from '@/features/architect/utils/tradeMachine/constants/secondApronMessages';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import { isSecondApronTeam } from '@/features/architect/utils/tradeMachine/utils/capUtils';
import { isTwoWayTradePlayer } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import {
  evaluateTradeSalaryMatchingPath,
  type HeldStandardTpeComponentInput,
  type TradeSalaryPathEvaluation,
  type TradeSalaryPathInputPlayer,
} from '@/features/architect/utils/tradeMachine/utils/tradeSalaryMatchingPaths';
import type { TradeSalaryMatchingElection } from '@/schemas/tradeSalaryMatchingPath';
import type {
  AuthoritativeSalaryMatchingResult,
  TeamContext,
  TradeExceptionPlayer,
  TradeExceptionRecord,
} from '../constants/types';

type SalaryMatchingCapSettingsLike = {
  salaryCap?: number | string | null;
  firstApron?: number | string | null;
  apron?: number | string | null;
  secondApron?: number | string | null;
};

type FaExceptionBucketLike = {
  type?: unknown;
  remaining?: number | string | null;
};

type SalaryMatchingPlayer = TradeExceptionPlayer & {
  bucketType?: unknown;
};

type SalaryMatchingContext = TeamContext & {
  salaryOut?: number | string | null;
  salaryIn?: number | string | null;
  totalSalary?: number | string | null;
  capSettings?: SalaryMatchingCapSettingsLike | null;
  capSettingsSource?: string | null;
  worldId?: string | null;
};

type SalaryMatchingTeamData = {
  apronTeamSalary?: number | string | null;
  totalSalary?: number | string | null;
  faExceptionBuckets?: FaExceptionBucketLike[] | null;
  hardCapSecondApron?: unknown;
  hardCapFirstApron?: unknown;
  hardCapType?: unknown;
  hardCapLevel?: unknown;
  hardCapTriggered?: unknown;
  hardCapped?: unknown;
  totals?: {
    hardCapLevel?: unknown;
  } | null;
} | null;

type SalaryMatchingValidationState = {
  passed?: boolean;
} | null;

type SalaryMatchingTeam = {
  salaryOut?: number | string | null;
  salaryIn?: number | string | null;
  teamTotalSalary?: number | string | null;
  projectedSalary?: number | string | null;
  absorptionMode?: string | null;
  bucketType?: unknown;
  appliedTPEs?: TradeExceptionRecord[] | null;
  incomingPlayers?: SalaryMatchingPlayer[] | null;
  receives?: SalaryMatchingPlayer[] | null;
  faExceptionValidation?: SalaryMatchingValidationState;
  team?: SalaryMatchingTeamData;
  context?: SalaryMatchingContext | null;
  hardCapSecondApron?: unknown;
  hardCapFirstApron?: unknown;
  hardCapType?: unknown;
  hardCapLevel?: unknown;
  hardCapTriggered?: unknown;
  hardCapped?: unknown;
  totals?: {
    hardCapLevel?: unknown;
  } | null;
  sends?: SalaryMatchingPlayer[] | null;
  outgoingPlayers?: SalaryMatchingPlayer[] | null;
  salaryMatchingElection?: TradeSalaryMatchingElection | null;
  salaryMatchingPathEvaluation?: TradeSalaryPathEvaluation | null;
} | null;

type TpeUsage = {
  tpe: TradeExceptionRecord;
  amount: number;
  assignedPlayers: SalaryMatchingPlayer[];
  totalAssigned: number;
};

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function isDevEnvironment(): boolean {
  const globalProcess = globalThis as typeof globalThis & {
    process?: {
      env?: {
        NODE_ENV?: string;
      };
    };
  };

  return (
    globalProcess.process?.env?.NODE_ENV === 'development' ||
    import.meta?.env?.DEV
  );
}

function getTeamCapSettings(
  capSettings: SalaryMatchingCapSettingsLike | null | undefined
): SalaryMatchingCapSettingsLike {
  return capSettings && typeof capSettings === 'object' ? capSettings : {};
}

function getIncomingPlayers(team: SalaryMatchingTeam): SalaryMatchingPlayer[] {
  if (Array.isArray(team?.incomingPlayers)) {
    return team.incomingPlayers;
  }

  if (Array.isArray(team?.receives)) {
    return team.receives;
  }

  return [];
}

function getPlayerIdentity(player: SalaryMatchingPlayer): string | null {
  const identity = player.player_id ?? player.playerId ?? player.id ?? null;
  return identity == null || String(identity).trim() === ''
    ? null
    : String(identity);
}

function getTpeCapacity(tpe: TradeExceptionRecord): number {
  return toFiniteNumber(
    tpe.remainingAmount ?? tpe.remaining ?? tpe.amount ?? tpe.totalAmount
  );
}

// Validator version for trade receipt tracking - bumped for TPE fix
export const SALARY_MATCHING_VERSION = '3.0.0';

export function validateSalaryMatching(
  team: SalaryMatchingTeam | null | undefined,
  context: SalaryMatchingContext = {}
): AuthoritativeSalaryMatchingResult {
  if (!team || typeof team !== 'object' || Object.keys(team).length === 0) {
    return {
      passed: false,
      applicable: false,
      skipReason: 'INVALID_INPUT',
      allowableIncoming: null,
      violations: ['Invalid team data provided for salary matching validation'],
      details: {
        ruleApplied: SALARY_MATCHING_RULE_KEYS.INVALID_INPUT,
        formulaUsed: 'N/A',
        capSettingsSource: 'N/A',
      },
    };
  }

  const salaryOut = toFiniteNumber(team.salaryOut ?? context.salaryOut ?? 0);
  const salaryIn = toFiniteNumber(team.salaryIn ?? context.salaryIn ?? 0);
  const rawApronTeamSalary =
    team.team?.apronTeamSalary ?? team.teamTotalSalary;
  const totalSalary = Number(rawApronTeamSalary);
  if (!Number.isFinite(totalSalary)) {
    return {
      passed: false,
      applicable: false,
      skipReason: 'INVALID_INPUT',
      allowableIncoming: null,
      violations: ['Apron Team Salary needs governed input'],
      details: {
        ruleApplied: SALARY_MATCHING_RULE_KEYS.INVALID_INPUT,
        formulaUsed: 'N/A',
        capSettingsSource: 'N/A',
      },
    };
  }
  const projectedSalary = toFiniteNumber(
    team.projectedSalary ?? totalSalary - salaryOut + salaryIn
  );

  const totalSalarySource =
    team.teamTotalSalary !== undefined
      ? 'team.teamTotalSalary'
      : 'team.team.apronTeamSalary';

  const teamCapSettings = getTeamCapSettings(team.context?.capSettings);
  const contextCapSettings = getTeamCapSettings(context.capSettings);
  const capSettings = { ...contextCapSettings, ...teamCapSettings };

  let capSettingsSource = 'context.capSettings';
  if (Object.keys(teamCapSettings).length > 0) {
    capSettingsSource = 'team.context.capSettings';
  } else if (typeof context.capSettingsSource === 'string') {
    capSettingsSource = context.capSettingsSource;
  }

  const capSettingsWarnings: string[] = [];
  const salaryCap = toFiniteNumber(capSettings.salaryCap);
  const firstApron = toFiniteNumber(capSettings.firstApron);
  const apron = toFiniteNumber(capSettings.apron);
  const secondApron = toFiniteNumber(capSettings.secondApron);

  const hasSalaryCap = salaryCap > 0;
  const hasFirstApron = firstApron > 0 || apron > 0;
  const hasSecondApron = secondApron > 0;

  if (!hasSalaryCap || !hasFirstApron || !hasSecondApron) {
    if (isDevEnvironment()) {
      console.warn(
        '[validateSalaryMatching] Missing cap settings:',
        { salaryCap, firstApron, apron, secondApron },
        'source:',
        capSettingsSource
      );
    }

    capSettingsWarnings.push(
      `Cap settings incomplete (salaryCap: ${hasSalaryCap}, firstApron: ${hasFirstApron}, secondApron: ${hasSecondApron}). ` +
        'Validation may be inaccurate.'
    );
  }

  const actualFirstApron = firstApron || apron;
  const isWorldless = !context.worldId;
  const hardCapStatus = getHardCapStatus(
    team as Parameters<typeof getHardCapStatus>[0],
    {
      isWorldless,
      capSettings: {
        firstApron: actualFirstApron,
        secondApron,
      },
    }
  );

  const violations: string[] = [];
  let allowableIncoming = 0;
  let ruleApplied = '';
  let formulaUsed = '';
  const incomingPlayers = getIncomingPlayers(team);
  const usesGovernedTradeSalaryPath =
    context.source === 'tradeMachine' ||
    team.context?.source === 'tradeMachine';
  const governedOutgoingPlayers = (
    Array.isArray(team.outgoingPlayers)
      ? team.outgoingPlayers
      : Array.isArray(team.sends)
        ? team.sends
        : []
  ).filter((player) => !isTwoWayTradePlayer(player));
  const governedIncomingPlayers = incomingPlayers.filter(
    (player) => !isTwoWayTradePlayer(player)
  );
  const hasFaExceptionEligibleIncoming =
    incomingPlayers.length === 0 ||
    incomingPlayers.some((player) => !isTwoWayTradePlayer(player));

  if (
    usesGovernedTradeSalaryPath &&
    salaryOut === 0 &&
    salaryIn === 0 &&
    governedOutgoingPlayers.length === 0 &&
    governedIncomingPlayers.length === 0
  ) {
    return {
      passed: true,
      applicable: false,
      skipReason: 'NO_SALARY_MATCHING',
      allowableIncoming: null,
      salaryIn,
      salaryOut,
      difference: 0,
      message:
        'No salary matching is required because this team sends and receives no matching salary.',
      violations: [],
      warnings: capSettingsWarnings,
      details: {
        ruleApplied: 'No salary matching required',
        formulaUsed: '$0 outgoing / $0 incoming',
        capSettings: {
          salaryCap,
          firstApron: actualFirstApron,
          secondApron,
        },
        capSettingsSource,
        capSettingsWarnings,
        totalSalary,
        totalSalarySource,
        effectiveSalaryIn: 0,
        margin: null,
        pathEvaluation: null,
      },
    };
  }

  if (
    team.absorptionMode === 'FA_EXCEPTION' &&
    team.bucketType &&
    hasFaExceptionEligibleIncoming
  ) {
    const buckets = Array.isArray(team.team?.faExceptionBuckets)
      ? team.team.faExceptionBuckets
      : [];
    const bucket = buckets.find((item) => item.type === team.bucketType);
    const bucketRemaining = bucket ? toFiniteNumber(bucket.remaining) : 0;

    if (!bucket || salaryIn > bucketRemaining) {
      const bucketSize = bucket ? formatCurrency(bucketRemaining) : '$0';
      violations.push(
        `FA Exception bucket insufficient (${bucketSize} remaining)`
      );
    }

    return {
      passed: violations.length === 0,
      applicable: false,
      skipReason: 'FA_EXCEPTION',
      allowableIncoming: null,
      salaryIn,
      salaryOut,
      difference: salaryIn - salaryOut,
      message: violations.length
        ? violations[0]
        : 'FA exception absorption validated',
      violations,
      details: {
        ruleApplied: SALARY_MATCHING_RULE_KEYS.FA_EXCEPTION,
        formulaUsed: `bucket.remaining (${team.bucketType})`,
        bucketRemaining,
        capSettingsSource: 'N/A (FA exception bypass)',
      },
    };
  }

  const resolveIncomingTradeSalary = (player: SalaryMatchingPlayer): number =>
    Number(
      player?.matchIncoming ??
        player?.salary ??
        getSalaryForYear(player, context.yearKey) ??
        0
    );

  const hasTPEPlayers = incomingPlayers.some(
    (player) =>
      !isTwoWayTradePlayer(player) &&
      (player.absorptionMode === 'TPE' || !!player.tpeId)
  );

  const appliedTPEs = Array.isArray(team.appliedTPEs) ? team.appliedTPEs : [];
  const availableTPEs =
    appliedTPEs.length > 0
      ? appliedTPEs
      : (getTeamTpeList(team.team) as TradeExceptionRecord[]).filter(
          (tpe) => !tpe.isUsed
        );

  let tpeAbsorbedSalary = 0;
  const heldStandardTpeComponents: HeldStandardTpeComponentInput[] = [];

  if (
    usesGovernedTradeSalaryPath &&
    hasTPEPlayers &&
    availableTPEs.length === 0
  ) {
    const message =
      'Held Standard TPE assignment could not be verified because this team has no available TPE.';
    return {
      passed: false,
      applicable: true,
      skipReason: null,
      violations: [message],
      salaryIn,
      salaryOut,
      allowableIncoming: null,
      message,
      details: {
        ruleApplied: 'TPE_VALIDATION_FAILED',
        formulaUsed: 'Exact team-held TPE identity and capacity required',
        tpeAbsorbedSalary: 0,
        salaryNeedingMatch: salaryIn,
        capSettingsSource,
      },
    };
  }

  if (hasTPEPlayers && availableTPEs.length > 0) {
    const tpeUsageMap = new Map<TradeExceptionRecord['id'], TpeUsage>();

    availableTPEs.forEach((tpe) => {
      tpeUsageMap.set(tpe.id, {
        tpe,
        amount: getTpeCapacity(tpe),
        assignedPlayers: [],
        totalAssigned: 0,
      });
    });

    const tpeViolations: string[] = [];

    incomingPlayers.forEach((player) => {
      if (isTwoWayTradePlayer(player)) return;

      const playerSalary = toFiniteNumber(resolveIncomingTradeSalary(player));
      const isTpeAbsorbed = player.absorptionMode === 'TPE' || !!player.tpeId;

      if (!isTpeAbsorbed) return;

      if (usesGovernedTradeSalaryPath && !player.tpeId) {
        tpeViolations.push(
          `Held Standard TPE assignment for ${player.name || 'player'} requires an exact tpeId`
        );
        return;
      }

      if (
        usesGovernedTradeSalaryPath &&
        player.tpeId &&
        !tpeUsageMap.has(player.tpeId)
      ) {
        tpeViolations.push(
          `Held Standard TPE ${player.tpeId} assigned to ${player.name || 'player'} could not be verified on this team`
        );
        return;
      }

      if (player.tpeId && tpeUsageMap.has(player.tpeId)) {
        const usage = tpeUsageMap.get(player.tpeId);
        if (usage) {
          usage.assignedPlayers.push(player);
          usage.totalAssigned += playerSalary;
          tpeAbsorbedSalary += playerSalary;
        }
        return;
      }

      if (!usesGovernedTradeSalaryPath && player.absorptionMode === 'TPE') {
        let matched = false;
        for (const [, usage] of tpeUsageMap) {
          const remaining = usage.amount - usage.totalAssigned;
          if (remaining >= playerSalary) {
            usage.assignedPlayers.push(player);
            usage.totalAssigned += playerSalary;
            tpeAbsorbedSalary += playerSalary;
            matched = true;
            break;
          }
        }

        if (!matched) {
          tpeAbsorbedSalary += playerSalary;
          tpeViolations.push(
            `No TPE has sufficient capacity for ${player.name || 'player'} (${formatCurrency(playerSalary)})`
          );
        }
      }
    });

    tpeUsageMap.forEach((usage, tpeId) => {
      if (usage.totalAssigned > usage.amount) {
        tpeViolations.push(
          `TPE ${tpeId} (${formatCurrency(usage.amount)}) insufficient for assigned players (${formatCurrency(usage.totalAssigned)})`
        );
      }

      if (usage.totalAssigned > 0 && tpeId == null) {
        tpeViolations.push(
          'Held Standard TPE component has assigned salary but no verifiable identity'
        );
      } else if (usage.totalAssigned > 0) {
        heldStandardTpeComponents.push({
          tpeId: String(tpeId),
          capacity: usage.amount,
          incomingPlayers: usage.assignedPlayers.map((player) => ({
            playerId: getPlayerIdentity(player),
            playerName: player.name || player.displayName || 'Unknown player',
            salary: toFiniteNumber(resolveIncomingTradeSalary(player)),
          })),
        });
      }
    });

    if (tpeViolations.length > 0) {
      return {
        passed: false,
        applicable: true,
        skipReason: null,
        violations: tpeViolations,
        salaryIn,
        salaryOut,
        allowableIncoming: null,
        message: tpeViolations[0],
        details: {
          ruleApplied: 'TPE_VALIDATION_FAILED',
          formulaUsed: 'Per-player TPE matching',
          tpeAbsorbedSalary,
          salaryNeedingMatch: salaryIn - tpeAbsorbedSalary,
          capSettingsSource,
        },
      };
    }

    if (!usesGovernedTradeSalaryPath && salaryIn - tpeAbsorbedSalary <= 0) {
      return {
        passed: true,
        applicable: false,
        skipReason: 'TPE_ABSORPTION',
        allowableIncoming: null,
        violations: [],
        salaryIn,
        salaryOut,
        tpeAbsorbedSalary,
        difference: salaryIn - salaryOut,
        message: 'Trade exceptions cover incoming salary',
        usingTPE: true,
        details: {
          ruleApplied: SALARY_MATCHING_RULE_KEYS.TPE_ABSORPTION,
          formulaUsed: 'Per-player TPE matching: all incoming covered',
          tpeCount: appliedTPEs.length,
          tpeAbsorbedSalary,
          capSettingsSource: 'N/A (TPE bypass)',
          capSettings: {
            salaryCap,
            firstApron: actualFirstApron,
            secondApron,
          },
          totalSalary,
          totalSalarySource,
        },
      };
    }
  }

  const faExceptionValidation = team.faExceptionValidation || null;
  const faExceptionPlayers = incomingPlayers.filter(
    (player) =>
      !isTwoWayTradePlayer(player) && player.absorptionMode === 'FA_EXCEPTION'
  );
  const faExceptionAbsorbedSalary =
    faExceptionValidation?.passed === true
      ? faExceptionPlayers.reduce(
          (sum, player) => sum + resolveIncomingTradeSalary(player),
          0
        )
      : 0;

  if (
    faExceptionValidation?.passed === true &&
    faExceptionPlayers.length > 0 &&
    salaryIn - tpeAbsorbedSalary - faExceptionAbsorbedSalary <= 0
  ) {
    const bucketTypes = Array.from(
      new Set(
        faExceptionPlayers
          .flatMap((player) =>
            Array.isArray(player.bucketType)
              ? player.bucketType
              : [player.bucketType]
          )
          .filter(Boolean)
      )
    );

    return {
      passed: true,
      applicable: false,
      skipReason: 'FA_EXCEPTION',
      allowableIncoming: null,
      violations: [],
      salaryIn,
      salaryOut,
      tpeAbsorbedSalary: tpeAbsorbedSalary > 0 ? tpeAbsorbedSalary : null,
      faExceptionAbsorbedSalary,
      difference: salaryIn - salaryOut,
      message: 'FA exception absorption validated',
      details: {
        ruleApplied: SALARY_MATCHING_RULE_KEYS.FA_EXCEPTION,
        formulaUsed: 'Incoming salary absorbed by FA exception bucket(s)',
        bucketTypes,
        faExceptionAbsorbedSalary,
        capSettingsSource: 'N/A (FA exception bypass)',
        capSettings: {
          salaryCap,
          firstApron: actualFirstApron,
          secondApron,
        },
        totalSalary,
        totalSalarySource,
      },
    };
  }

  const effectiveSalaryIn =
    salaryIn - tpeAbsorbedSalary - faExceptionAbsorbedSalary;

  let pathEvaluation: TradeSalaryPathEvaluation | null = null;

  if (usesGovernedTradeSalaryPath) {
    const matchingIncomingPlayers: TradeSalaryPathInputPlayer[] =
      incomingPlayers
        .filter(
          (player) =>
            !isTwoWayTradePlayer(player) &&
            player.absorptionMode !== 'TPE' &&
            !player.tpeId &&
            player.absorptionMode !== 'FA_EXCEPTION'
        )
        .map((player) => ({
          playerId: getPlayerIdentity(player),
          playerName: player.name || player.displayName || 'Unknown player',
          salary: toFiniteNumber(resolveIncomingTradeSalary(player)),
        }));

    pathEvaluation = evaluateTradeSalaryMatchingPath({
      election: team.salaryMatchingElection,
      outgoingPlayers: governedOutgoingPlayers.map((player) => ({
        playerId: getPlayerIdentity(player),
        playerName: player.name || player.displayName || 'Unknown player',
      })),
      incomingMatchingPlayers: matchingIncomingPlayers,
      heldStandardTpeComponents,
      teamSalary: totalSalary,
      salaryCap,
      firstApron: actualFirstApron,
      transactionDate: context.tradeDate ?? team.context?.tradeDate,
      salaryCapYear: context.yearKey ?? team.context?.yearKey,
    });
    if (pathEvaluation.status === 'NEEDS_INPUT') {
      const message = `Salary path needs exact input: ${pathEvaluation.missingInputs.join(', ')}`;
      return {
        passed: false,
        applicable: true,
        skipReason: null,
        allowableIncoming: null,
        salaryIn,
        salaryOut,
        difference: salaryIn - salaryOut,
        violations: [message],
        message,
        warnings: capSettingsWarnings,
        details: {
          ruleApplied: pathEvaluation.ruleLabel,
          formulaUsed: pathEvaluation.formula,
          capSettings: {
            salaryCap,
            firstApron: actualFirstApron,
            secondApron,
          },
          capSettingsSource,
          capSettingsWarnings,
          totalSalary,
          totalSalarySource,
          effectiveSalaryIn,
          margin: null,
          pathEvaluation,
        },
      };
    }

    allowableIncoming = pathEvaluation.maximumIncoming ?? 0;
    ruleApplied = pathEvaluation.ruleLabel;
    formulaUsed = pathEvaluation.formula;
    violations.push(...pathEvaluation.violations);
  } else if (totalSalary < salaryCap) {
    const matchingResult = getSalaryMatchingResult({
      teamTotalSalary: totalSalary,
      outgoingSalary: salaryOut,
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
    });

    allowableIncoming = matchingResult.allowableIncoming;
    ruleApplied = matchingResult.ruleKey;
    formulaUsed = matchingResult.formulaUsed;

    const netAddition = effectiveSalaryIn - salaryOut;
    const remainingSpace = salaryCap - totalSalary;
    if (netAddition > remainingSpace) {
      violations.push(
        `Team has ${formatCurrency(remainingSpace)} in cap space but is adding ${formatCurrency(netAddition)} in net salary.`
      );
    }
  } else if (
    isSecondApronTeam({ apronTeamSalary: totalSalary }, capSettings) ||
    isSecondApronTeam({ apronTeamSalary: projectedSalary }, capSettings)
  ) {
    const matchingResult = getSalaryMatchingResult({
      teamTotalSalary: totalSalary,
      outgoingSalary: salaryOut,
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
      apronStatus: 'SECOND_APRON',
    });

    allowableIncoming = matchingResult.allowableIncoming;
    ruleApplied = matchingResult.ruleKey;
    formulaUsed = matchingResult.formulaUsed;

    if (effectiveSalaryIn > salaryOut) {
      violations.push(SECOND_APRON_SALARY_MISMATCH);
    }
  } else if (totalSalary >= actualFirstApron) {
    const matchingResult = getSalaryMatchingResult({
      teamTotalSalary: totalSalary,
      outgoingSalary: salaryOut,
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
      apronStatus: 'FIRST_APRON',
    });

    allowableIncoming = matchingResult.allowableIncoming;
    ruleApplied = matchingResult.ruleKey;
    formulaUsed = matchingResult.formulaUsed;

    if (effectiveSalaryIn > salaryOut) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(effectiveSalaryIn - salaryOut)}. ` +
          'First apron teams cannot receive more salary than sent out.'
      );
    }
  } else if (totalSalary > salaryCap) {
    const matchingResult = getSalaryMatchingResult({
      teamTotalSalary: totalSalary,
      outgoingSalary: salaryOut,
      capSettings: { salaryCap, firstApron: actualFirstApron, secondApron },
    });

    allowableIncoming = matchingResult.allowableIncoming;
    ruleApplied = matchingResult.ruleKey;
    formulaUsed = matchingResult.formulaUsed;

    if (effectiveSalaryIn > allowableIncoming) {
      violations.push(
        `Incoming salary exceeds allowable amount by ${formatCurrency(effectiveSalaryIn - allowableIncoming)}`
      );
    }
  }

  let hardCapIncomingCeiling: number | null = null;
  let effectiveAllowableIncoming: number | null = allowableIncoming;
  let hardCapCeilingApron: number | null = null;
  let hardCapCeilingApronLabel: string | null = null;

  if (hardCapStatus.isHardCapped) {
    hardCapCeilingApron = hardCapStatus.hardCapCeiling;
    hardCapCeilingApronLabel = hardCapStatus.hardCapCeilingLabel;

    if (hardCapCeilingApron !== null) {
      const hardCapRoom = Math.max(0, hardCapCeilingApron - totalSalary);
      hardCapIncomingCeiling = salaryOut + hardCapRoom;

      if (allowableIncoming !== null && allowableIncoming !== undefined) {
        effectiveAllowableIncoming = Math.min(
          allowableIncoming,
          hardCapIncomingCeiling
        );
      } else {
        effectiveAllowableIncoming = hardCapIncomingCeiling;
      }
    }
  }

  const activeAllowableIncoming =
    effectiveAllowableIncoming !== null &&
    effectiveAllowableIncoming !== undefined
      ? effectiveAllowableIncoming
      : allowableIncoming;

  return {
    passed: violations.length === 0,
    applicable: true,
    skipReason: null,
    violations,
    salaryIn,
    salaryOut,
    allowableIncoming,
    hardCapIncomingCeiling,
    effectiveAllowableIncoming,
    difference: salaryIn - salaryOut,
    message: violations.length ? violations[0] : 'Salary matching validated',
    warningsOnly: shouldWarnOnly('salaryMatching') && violations.length > 0,
    warnings: capSettingsWarnings,
    details: {
      ruleApplied: ruleApplied || 'UNKNOWN',
      formulaUsed: formulaUsed || 'Unknown formula',
      capSettings: {
        salaryCap,
        firstApron: actualFirstApron,
        secondApron,
      },
      capSettingsSource,
      capSettingsWarnings,
      totalSalary,
      totalSalarySource,
      tpeAbsorbedSalary: tpeAbsorbedSalary > 0 ? tpeAbsorbedSalary : null,
      faExceptionAbsorbedSalary:
        faExceptionAbsorbedSalary > 0 ? faExceptionAbsorbedSalary : null,
      effectiveSalaryIn,
      margin:
        activeAllowableIncoming !== null &&
        activeAllowableIncoming !== undefined
          ? activeAllowableIncoming - effectiveSalaryIn
          : null,
      hardCapStatus: hardCapStatus.isHardCapped ? hardCapStatus : null,
      hardCapCeiling:
        hardCapIncomingCeiling !== null
          ? {
              ceiling: hardCapIncomingCeiling,
              apron: hardCapCeilingApron,
              apronLabel: hardCapCeilingApronLabel,
              limiter:
                allowableIncoming === null ||
                allowableIncoming === undefined ||
                hardCapIncomingCeiling < allowableIncoming
                  ? 'hardCap'
                  : 'salaryMatching',
            }
          : null,
      pathEvaluation,
    },
  };
}
