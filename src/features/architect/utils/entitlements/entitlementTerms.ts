/**
 * FILE: src/features/architect/utils/entitlements/entitlementTerms.ts
 * PURPOSE: Normalize entitlement term data for Trade Machine consumption.
 * OWNERSHIP: Feature: architect/entitlements (TM-5 Entitlement Terms Integration)
 *
 * HISTORY:
 *  - 2026-02-05: Created by plan `plans/phase-tm-5-entitlement-simulation-integration/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/phase-tm-5-entitlement-simulation-integration/plan.md
 *  - Latest Chunk: n/a
 */

export type ProtectionLadderTier = {
  year: number;
  condition: string;
  ifTriggered: 'roll' | 'convert' | 'cancel';
  rollToYear?: number;
  convertToRound?: number;
};

export type EntitlementSwapRole = 'swap_right' | 'base_pick';
export type EntitlementSwapType = 'best_of' | 'worst_of';

export type EntitlementTerms = {
  empty: boolean;
  seasonYear?: number;
  round?: number;
  hasProtectionLadder: boolean;
  hasSwap: boolean;
  hasConveyance: boolean;
  protectionLadder?: {
    tiers: ProtectionLadderTier[];
    currentTier: ProtectionLadderTier | null;
  };
  swap?: {
    role: EntitlementSwapRole;
    swapType?: EntitlementSwapType;
    swapControllerPickId?: string;
    swapTargetDefinition?: string;
    poolUnderlyingPickIds?: string[];
  };
  conveyance?: {
    poolUnderlyingPickIds?: string[];
    receivesRank?: number[];
    receivesComparator?: 'more_favorable' | 'less_favorable' | 'middle';
  };
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toStringValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
};

const normalizeNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry));
};

const parseSwapType = (entitlementDoc: Record<string, unknown>): EntitlementSwapType => {
  const explicit = entitlementDoc.swapType as string | undefined;
  if (explicit === 'worst_of') return 'worst_of';
  if (explicit === 'best_of') return 'best_of';

  const def = toStringValue(entitlementDoc.swapTargetDefinition).toLowerCase();
  if (def.includes('worst') || def.includes('less favorable')) return 'worst_of';

  const desc = toStringValue(entitlementDoc.description).toLowerCase();
  if (desc.includes('worst') || desc.includes('less favorable')) return 'worst_of';

  return 'best_of';
};

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',')}}`;
};

const formatRoundLabel = (round?: number): string => {
  if (round === 1) return '1st';
  if (round === 2) return '2nd';
  if (typeof round === 'number') return `R${round}`;
  return '';
};

export const normalizeEntitlementTerms = (
  entitlementDoc: Record<string, unknown> | null | undefined
): EntitlementTerms => {
  if (!entitlementDoc || typeof entitlementDoc !== 'object') {
    return {
      empty: true,
      hasProtectionLadder: false,
      hasSwap: false,
      hasConveyance: false,
    };
  }

  const seasonYear = toNumber(entitlementDoc.seasonYear);
  const round = toNumber(entitlementDoc.round);

  const ladderRaw = Array.isArray(entitlementDoc.protectionLadder)
    ? entitlementDoc.protectionLadder
    : [];
  const ladderTiers = ladderRaw
    .filter((tier) => tier && typeof tier === 'object')
    .map((tier) => {
      const tierRecord = tier as Record<string, unknown>;
      const year = toNumber(tierRecord.year);
      const condition = toStringValue(tierRecord.condition);
      if (!year || !condition) return null;
      const ifTriggered =
        tierRecord.ifTriggered === 'convert' ||
        tierRecord.ifTriggered === 'cancel'
          ? (tierRecord.ifTriggered as 'convert' | 'cancel')
          : 'roll';
      return {
        year,
        condition,
        ifTriggered,
        rollToYear: toNumber(tierRecord.rollToYear),
        convertToRound: toNumber(tierRecord.convertToRound),
      } as ProtectionLadderTier;
    })
    .filter(Boolean) as ProtectionLadderTier[];

  const sortedTiers = [...ladderTiers].sort((a, b) => a.year - b.year);
  const currentTier = sortedTiers.length
    ? sortedTiers.find((tier) => tier.year === seasonYear) || sortedTiers[0]
    : null;
  const hasProtectionLadder = sortedTiers.length > 0;

  const kind = toStringValue(entitlementDoc.kind);
  const coveredBy = Array.isArray(entitlementDoc.coveredByEntitlementIds)
    ? entitlementDoc.coveredByEntitlementIds.length > 0
    : false;

  const hasSwapFields =
    kind === 'swap_right' ||
    Boolean(toStringValue(entitlementDoc.swapControllerPickId)) ||
    Boolean(toStringValue(entitlementDoc.swapTargetDefinition));

  let swapRole: EntitlementSwapRole | null = null;
  if (kind === 'swap_right') swapRole = 'swap_right';
  else if (coveredBy) swapRole = 'base_pick';
  else if (hasSwapFields) swapRole = 'swap_right';

  const swapType = swapRole === 'swap_right' ? parseSwapType(entitlementDoc) : undefined;
  const swapControllerPickId = toStringValue(entitlementDoc.swapControllerPickId) || undefined;
  const swapTargetDefinition = toStringValue(entitlementDoc.swapTargetDefinition) || undefined;
  const poolUnderlyingPickIds = normalizeStringArray(entitlementDoc.poolUnderlyingPickIds);

  const hasConveyanceFields =
    kind === 'conveyance_right' ||
    normalizeNumberArray(entitlementDoc.receivesRank).length > 0 ||
    Boolean(toStringValue(entitlementDoc.receivesComparator));

  const hasConveyance = hasConveyanceFields ||
    (poolUnderlyingPickIds.length > 0 && kind === 'conveyance_right');

  const conveyanceReceivesRank = normalizeNumberArray(entitlementDoc.receivesRank);
  const conveyanceReceivesComparator =
    toStringValue(entitlementDoc.receivesComparator) as
      | 'more_favorable'
      | 'less_favorable'
      | 'middle'
      | '';

  const hasSwap = Boolean(swapRole || hasSwapFields);

  const terms: EntitlementTerms = {
    empty: !(hasProtectionLadder || hasSwap || hasConveyance),
    seasonYear,
    round,
    hasProtectionLadder,
    hasSwap,
    hasConveyance,
  };

  if (hasProtectionLadder) {
    terms.protectionLadder = {
      tiers: sortedTiers,
      currentTier: currentTier || null,
    };
  }

  if (hasSwap) {
    terms.swap = {
      role: swapRole || 'swap_right',
      swapType,
      swapControllerPickId,
      swapTargetDefinition,
      poolUnderlyingPickIds: hasSwapFields ? poolUnderlyingPickIds : undefined,
    };
  }

  if (hasConveyance) {
    terms.conveyance = {
      poolUnderlyingPickIds: poolUnderlyingPickIds.length
        ? poolUnderlyingPickIds
        : undefined,
      receivesRank: conveyanceReceivesRank.length
        ? conveyanceReceivesRank
        : undefined,
      receivesComparator: conveyanceReceivesComparator || undefined,
    };
  }

  return terms;
};

export const formatEntitlementTermsShort = (terms: EntitlementTerms): string => {
  if (!terms || terms.empty) return '';

  if (terms.protectionLadder?.currentTier) {
    const tier = terms.protectionLadder.currentTier;
    const condition = tier.condition || 'Protected';

    if (tier.ifTriggered === 'cancel') {
      return `${condition} prot -> extinguish`;
    }

    if (tier.ifTriggered === 'convert') {
      const targetYear = terms.seasonYear ?? tier.year;
      const targetRound = tier.convertToRound ?? terms.round;
      const roundLabel = formatRoundLabel(targetRound);
      return roundLabel
        ? `${condition} prot -> ${targetYear} ${roundLabel}`
        : `${condition} prot -> ${targetYear}`;
    }

    const targetYear =
      tier.rollToYear ?? (tier.year ? tier.year + 1 : terms.seasonYear);
    const roundLabel = formatRoundLabel(terms.round);
    return roundLabel
      ? `${condition} prot -> ${targetYear} ${roundLabel}`
      : `${condition} prot -> ${targetYear}`;
  }

  if (terms.swap?.role === 'swap_right') {
    const swapLabel = terms.swap?.swapType === 'worst_of' ? 'worst' : 'best';
    return terms.seasonYear
      ? `Swap ${swapLabel} (${terms.seasonYear})`
      : `Swap ${swapLabel}`;
  }

  if (terms.swap?.role === 'base_pick') {
    return 'Swap-backed';
  }

  if (terms.hasConveyance) {
    return 'Conveys (ranked)';
  }

  return '';
};

export const getEntitlementDraftKey = (
  entitlementDoc: Record<string, unknown> | null | undefined,
  terms: EntitlementTerms
): string => {
  if (!entitlementDoc || typeof entitlementDoc !== 'object') {
    return `entitlement|terms:${stableStringify(terms)}`;
  }

  const id =
    toStringValue(entitlementDoc.id) ||
    toStringValue(entitlementDoc.entitlementId) ||
    toStringValue(entitlementDoc.underlyingPickId) ||
    'entitlement';
  const kind = toStringValue(entitlementDoc.kind) || 'unknown';
  const year = toNumber(entitlementDoc.seasonYear);
  const round = toNumber(entitlementDoc.round);
  const identity = `${id}|${kind}|${year ?? 'na'}|${round ?? 'na'}`;
  return `ent:${identity}|terms:${stableStringify(terms)}`;
};

export const decorateEntitlementForTrade = (
  entitlementDoc: Record<string, unknown> | null | undefined
): Record<string, unknown> | null | undefined => {
  if (!entitlementDoc || typeof entitlementDoc !== 'object') return entitlementDoc;
  const terms = normalizeEntitlementTerms(entitlementDoc);
  const termsShort = formatEntitlementTermsShort(terms);
  const draftKey = getEntitlementDraftKey(entitlementDoc, terms);
  return {
    ...entitlementDoc,
    terms,
    termsShort,
    draftKey,
  };
};
