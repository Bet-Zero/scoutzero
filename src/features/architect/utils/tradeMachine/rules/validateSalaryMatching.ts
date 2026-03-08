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
} from '@/features/architect/utils/tradeHelpers.js';
import { shouldWarnOnly } from '@/config/validationFlags.js';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_RULE_KEYS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { SECOND_APRON_SALARY_MISMATCH } from '@/features/architect/utils/tradeMachine/constants/secondApronMessages.js';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import { isSecondApronTeam } from '../utils/capUtils.js';
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
  [key: string]: unknown;
};

type FaExceptionBucketLike = {
  type?: unknown;
  remaining?: number | string | null;
  [key: string]: unknown;
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
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
} | null;

type SalaryMatchingValidationState = {
  passed?: boolean;
  [key: string]: unknown;
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
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
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
    globalProcess.process?.env?.NODE_ENV === 'development' || import.meta?.env?.DEV
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

// Validator version for trade receipt tracking - bumped for TPE fix
export const SALARY_MATCHING_VERSION = '2.4.0';

export function validateSalaryMatching(
  team: SalaryMatchingTeam,
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
  const totalSalary = toFiniteNumber(
    team.teamTotalSalary ?? context.totalSalary ?? team.team?.totalSalary ?? 0
  );
  const projectedSalary = toFiniteNumber(
    team.projectedSalary ?? totalSalary - salaryOut + salaryIn
  );

  const totalSalarySource =
    team.teamTotalSalary !== undefined
      ? 'team.teamTotalSalary'
      : context.totalSalary !== undefined
        ? 'context.totalSalary'
        : 'team.team.totalSalary';

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
  const hardCapStatus = getHardCapStatus(team, {
    isWorldless,
    capSettings: {
      firstApron: actualFirstApron,
      secondApron,
    },
  });

  const violations: string[] = [];
  let allowableIncoming = 0;
  let ruleApplied = '';
  let formulaUsed = '';

  if (team.absorptionMode === 'FA_EXCEPTION' && team.bucketType) {
    const buckets = Array.isArray(team.team?.faExceptionBuckets)
      ? team.team.faExceptionBuckets
      : [];
    const bucket = buckets.find((item) => item.type === team.bucketType);
    const bucketRemaining = bucket ? toFiniteNumber(bucket.remaining) : 0;

    if (!bucket || salaryIn > bucketRemaining) {
      const bucketSize = bucket ? formatCurrency(bucketRemaining) : '$0';
      violations.push(`FA Exception bucket insufficient (${bucketSize} remaining)`);
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

  const incomingPlayers = getIncomingPlayers(team);
  const resolveIncomingTradeSalary = (player: SalaryMatchingPlayer): number =>
    Number(
      player?.matchIncoming ??
        player?.salary ??
        getSalaryForYear(player, context.yearKey) ??
        0
    );

  const hasTPEPlayers = incomingPlayers.some(
    (player) => player.absorptionMode === 'TPE' || !!player.tpeId
  );

  const appliedTPEs = Array.isArray(team.appliedTPEs) ? team.appliedTPEs : [];
  const availableTPEs =
    appliedTPEs.length > 0
      ? appliedTPEs
      : (getTeamTpeList(team.team) as TradeExceptionRecord[]).filter(
          (tpe) => !tpe.isUsed
        );

  let tpeAbsorbedSalary = 0;

  if (hasTPEPlayers && availableTPEs.length > 0) {
    const tpeUsageMap = new Map<TradeExceptionRecord['id'], TpeUsage>();

    availableTPEs.forEach((tpe) => {
      tpeUsageMap.set(tpe.id, {
        tpe,
        amount: toFiniteNumber(tpe.amount),
        assignedPlayers: [],
        totalAssigned: 0,
      });
    });

    const tpeViolations: string[] = [];

    incomingPlayers.forEach((player) => {
      const playerSalary = toFiniteNumber(player.salary || player.matchIncoming || 0);
      const isTpeAbsorbed = player.absorptionMode === 'TPE' || !!player.tpeId;

      if (!isTpeAbsorbed) return;

      if (player.tpeId && tpeUsageMap.has(player.tpeId)) {
        const usage = tpeUsageMap.get(player.tpeId);
        if (usage) {
          usage.assignedPlayers.push(player);
          usage.totalAssigned += playerSalary;
          tpeAbsorbedSalary += playerSalary;
        }
        return;
      }

      if (player.absorptionMode === 'TPE') {
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

    if (salaryIn - tpeAbsorbedSalary <= 0) {
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
    (player) => player.absorptionMode === 'FA_EXCEPTION'
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

  if (totalSalary < salaryCap) {
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
    isSecondApronTeam({ totalSalary }, capSettings) ||
    isSecondApronTeam({ totalSalary: projectedSalary }, capSettings)
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
    },
  };
}
