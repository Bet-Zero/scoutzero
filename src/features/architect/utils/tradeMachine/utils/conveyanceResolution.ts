import { isMeaningfulProtection } from './tradeUtilityMisc';

type PositionsMap = Record<string, number>;

interface ConveyanceResolutionOptions {
  draftYear?: number;
  nowIso?: string;
  method?: string;
}

interface ProtectionMetaLike extends Record<string, unknown> {
  type?: unknown;
  maxPosition?: unknown;
}

interface ProtectionLadderTierLike extends Record<string, unknown> {
  year?: unknown;
  condition?: unknown;
}

interface ConversionTargetLike extends Record<string, unknown> {
  action?: unknown;
  toYear?: unknown;
  toRound?: unknown;
}

interface ConveyanceConditionsLike extends Record<string, unknown> {
  protection?: unknown;
  ifConveys?: unknown;
  ifRolls?: unknown;
}

interface ConveyanceLike extends Record<string, unknown> {
  conditions?: ConveyanceConditionsLike | null;
  currentYear?: unknown;
  finalYear?: unknown;
}

interface ConveyancePickLike extends Record<string, unknown> {
  id?: unknown;
  year?: unknown;
  round?: unknown;
  originalTeam?: unknown;
  protection?: unknown;
  protectionMeta?: ProtectionMetaLike | null;
  protectionLadder?: ProtectionLadderTierLike[] | null;
  conveyance?: ConveyanceLike | null;
  conversionTarget?: ConversionTargetLike | null;
  status?: unknown;
  conveyanceResult?: unknown;
}

interface TeamConveyanceResult {
  draftPicks: unknown[];
  resolvedCount: number;
  warnings: string[];
}

void isMeaningfulProtection;

export function parseProtectionThreshold(
  protectionString: unknown
): number | null {
  if (!protectionString || typeof protectionString !== 'string') {
    return null;
  }

  const topMatch = protectionString.match(/top\s*(\d+)/i);
  if (topMatch) {
    return parseInt(topMatch[1], 10);
  }

  if (/lottery/i.test(protectionString)) {
    return 14;
  }

  if (/1-14/i.test(protectionString)) {
    return 14;
  }

  return null;
}

export function protectionTriggers(
  protection: unknown,
  position: unknown
): boolean {
  const threshold = parseProtectionThreshold(protection);

  if (
    threshold === null ||
    typeof position !== 'number' ||
    position < 1
  ) {
    return false;
  }

  return position <= threshold;
}

export function resolveConveyanceForPick(
  pick: ConveyancePickLike | null | undefined,
  positionsMap: PositionsMap,
  opts: ConveyanceResolutionOptions = {}
): ConveyancePickLike | null | undefined {
  if (!pick || typeof pick !== 'object') {
    return pick;
  }

  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return pick;
  }

  if (opts.draftYear && pick.year !== opts.draftYear) {
    return pick;
  }

  if (!pick.conveyance || typeof pick.conveyance !== 'object') {
    return pick;
  }

  const conditions = pick.conveyance.conditions;
  if (!conditions || typeof conditions !== 'object') {
    return pick;
  }

  const teamCode = String(pick.originalTeam || 'UNK');
  const position = positionsMap[teamCode];

  if (typeof position !== 'number' || position < 1) {
    return pick;
  }

  let protection: unknown = null;
  const currentYear = (pick.conveyance.currentYear || pick.year) as
    | number
    | undefined;

  if (Array.isArray(pick.protectionLadder)) {
    const currentTier = pick.protectionLadder.find(
      (tier) => tier?.year === currentYear
    );
    if (currentTier?.condition) {
      protection = currentTier.condition;
    }
  }

  if (!protection) {
    protection = conditions.protection || pick.protection;
  }

  const triggered = protectionTriggers(protection, position);
  const nowIso = opts.nowIso || new Date().toISOString();
  const method = opts.method || 'lottery';

  if (triggered) {
    return resolveProtectionTrigger(pick, position, { nowIso, method });
  }

  return {
    ...pick,
    status: 'conveyed',
    conveyanceResult: {
      outcome: 'conveyed',
      resolvedAt: nowIso,
      method,
      position,
      reason: `Position ${position} outside protection range`,
    },
  };
}

function resolveProtectionTrigger(
  pick: ConveyancePickLike,
  position: number,
  opts: Required<Pick<ConveyanceResolutionOptions, 'nowIso' | 'method'>>
): ConveyancePickLike {
  const { nowIso, method } = opts;

  const conditions = pick.conveyance?.conditions || {};
  const finalYear = pick.conveyance?.finalYear as number | undefined;
  const currentYear = (pick.conveyance?.currentYear || pick.year) as number;

  if (pick.conversionTarget && pick.conversionTarget.action === 'convert') {
    return {
      ...pick,
      year: pick.conversionTarget.toYear || pick.year,
      round: pick.conversionTarget.toRound || 2,
      status: 'converted',
      conveyanceResult: {
        outcome: 'converted',
        resolvedAt: nowIso,
        method,
        position,
        reason: `Protection triggered at position ${position} - converted to round ${pick.conversionTarget.toRound || 2}`,
        originalRound: pick.round,
      },
    };
  }

  if (finalYear && currentYear >= finalYear) {
    return {
      ...pick,
      status: 'conveyed',
      conveyanceResult: {
        outcome: 'conveyed',
        resolvedAt: nowIso,
        method,
        position,
        reason: `Final year ${finalYear} reached - pick must convey`,
      },
    };
  }

  const nextYear = currentYear + 1;

  let nextProtection: unknown = null;
  if (Array.isArray(pick.protectionLadder)) {
    const nextTier = pick.protectionLadder.find(
      (tier) => tier?.year === nextYear
    );
    if (nextTier?.condition) {
      nextProtection = nextTier.condition;
    }
  }

  if (!nextProtection && conditions.ifRolls) {
    const protectionPattern = /(top\s*\d+|lottery|unprotected)/i;
    const ifRollsMatch = String(conditions.ifRolls).match(protectionPattern);
    nextProtection = ifRollsMatch ? ifRollsMatch[0] : 'Unprotected';
  }

  return {
    ...pick,
    year: nextYear,
    protection: nextProtection || 'Unprotected',
    status: 'rolled',
    conveyance: {
      ...pick.conveyance,
      currentYear: nextYear,
      conditions: {
        ...pick.conveyance?.conditions,
        protection: nextProtection || 'Unprotected',
      },
    },
    conveyanceResult: {
      outcome: 'rolled',
      resolvedAt: nowIso,
      method,
      position,
      reason: `Protection triggered at position ${position} - rolled to ${nextYear}`,
      previousYear: currentYear,
      previousProtection: pick.protection,
    },
  };
}

export function resolveTeamConveyanceForYear(
  draftPicks: unknown,
  draftYear: number,
  positionsMap: PositionsMap,
  opts: ConveyanceResolutionOptions = {}
): TeamConveyanceResult {
  if (!Array.isArray(draftPicks)) {
    return {
      draftPicks: [],
      resolvedCount: 0,
      warnings: ['draftPicks must be an array'],
    };
  }

  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return {
      draftPicks,
      resolvedCount: 0,
      warnings: ['No positionsMap provided - skipping conveyance resolution'],
    };
  }

  const { nowIso, method } = opts;
  let resolvedCount = 0;
  const warnings: string[] = [];

  const updatedPicks = draftPicks.map((pick) => {
    const conveyancePick = pick as ConveyancePickLike | null | undefined;

    if (!conveyancePick || typeof conveyancePick !== 'object') {
      return pick;
    }

    if (conveyancePick.year !== draftYear) {
      return pick;
    }

    if (
      !conveyancePick.conveyance ||
      !conveyancePick.conveyance.conditions
    ) {
      return pick;
    }

    if (conveyancePick.conveyanceResult) {
      return pick;
    }

    try {
      const resolved = resolveConveyanceForPick(
        conveyancePick,
        positionsMap,
        { draftYear, nowIso, method }
      ) as ConveyancePickLike;
      if (resolved?.conveyanceResult) {
        resolvedCount++;
      }
      return resolved;
    } catch (err) {
      warnings.push(
        `Pick ${conveyancePick.id || 'unknown'}: ${err instanceof Error ? err.message : String(err)}`
      );
      return pick;
    }
  });

  return {
    draftPicks: updatedPicks,
    resolvedCount,
    warnings,
  };
}

export function getProtectionLabel(
  protectionMeta: ProtectionMetaLike | null | undefined
): string {
  if (!protectionMeta || typeof protectionMeta !== 'object') {
    return '';
  }

  const { type, maxPosition } = protectionMeta;

  switch (type) {
    case 'position':
      return maxPosition ? `Top ${maxPosition}` : '';
    case 'lottery':
      return 'Lottery';
    case 'playoff':
      return 'Playoff Protected';
    case 'always':
      return 'Unprotected';
    case 'never':
      return 'Unconditional';
    default:
      return '';
  }
}

export function normalizeProtection(
  protectionOrPick: unknown
): { protection: unknown; protectionMeta: ProtectionMetaLike | null } {
  if (!protectionOrPick) {
    return { protection: null, protectionMeta: null };
  }

  if (typeof protectionOrPick === 'object') {
    const pick = protectionOrPick as ConveyancePickLike;

    if (pick.protectionMeta) {
      return {
        protection:
          pick.protection || getProtectionLabel(pick.protectionMeta),
        protectionMeta: pick.protectionMeta,
      };
    }

    return {
      protection: pick.protection || null,
      protectionMeta: null,
    };
  }

  return {
    protection: protectionOrPick,
    protectionMeta: null,
  };
}
