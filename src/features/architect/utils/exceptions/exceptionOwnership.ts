/**
 * FILE: src/features/architect/utils/exceptions/exceptionOwnership.ts
 * PURPOSE: Canonical non-TPE exception ownership normalization for runtime reads.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * NOTE:
 * - team.exceptions is the only authoritative non-TPE owner path at runtime.
 * - Legacy nested aliases and top-level compatibility blobs are accepted only
 *   at normalization boundaries, then rewritten into canonical nested owners.
 * - Missing state stays unavailable; existing legacy state normalizes to
 *   enabled unless it explicitly marks itself unavailable.
 */

import type { TradeExceptionRecord } from '@/features/architect/utils/tradeMachine/constants/types';

type UnknownRecord = Record<string, unknown>;

export type CanonicalNonTpeExceptionKey = 'mle' | 'tpmle' | 'bae' | 'room';

export type CanonicalNonTpeExceptionState = {
  enabled: boolean;
  available: boolean;
  maxAmount: number;
  totalAmount: number;
  amount: number;
  usedAmount: number;
  remainingAmount: number;
  seasonKey?: string | null;
  notes?: string | null;
  type?: string | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  lastUsedAt?: string | null;
};

export type CanonicalDpeExceptionState = {
  enabled?: boolean | null;
  available?: boolean | null;
  maxAmount?: number | string | null;
  totalAmount?: number | string | null;
  amount?: number | string | null;
  usedAmount?: number | string | null;
  remainingAmount?: number | string | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  seasonKey?: string | null;
  lastUsedAt?: string | null;
};

export type CanonicalTeamExceptions = Partial<
  Record<CanonicalNonTpeExceptionKey, CanonicalNonTpeExceptionState | null>
> & {
  dpe?: CanonicalDpeExceptionState | null;
  tpe?: TradeExceptionRecord[];
};

export type CanonicalNonTpeExceptionAvailability = {
  key: CanonicalNonTpeExceptionKey;
  present: boolean;
  enabled: boolean;
  usable: boolean;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  entry: CanonicalNonTpeExceptionState | null;
};

type TeamExceptionOwnerLike = UnknownRecord & {
  exceptions?: UnknownRecord | null;
};

type CanonicalTeamExceptionsWithPreservedBuckets =
  CanonicalTeamExceptions & UnknownRecord;

type DerivedSimpleException = {
  amount: number;
  used: number;
  remaining: number;
};

const CANONICAL_KEYS = ['mle', 'tpmle', 'bae', 'room'] as const satisfies readonly CanonicalNonTpeExceptionKey[];
const EXCEPTION_ALIAS_KEYS = new Set([
  'mle',
  'tpmle',
  'bae',
  'room',
  'taxpayerMle',
  'tpMle',
  'miniMle',
  'nonTaxpayerMle',
  'fullMLE',
  'biAnnual',
  'roomMLE',
  'roommle',
  'rmle',
]);

const NON_TPE_EXCEPTION_SOURCES: Record<
  CanonicalNonTpeExceptionKey,
  {
    nestedKeys: string[];
    topLevelKeys: string[];
  }
> = {
  mle: {
    nestedKeys: ['mle', 'nonTaxpayerMle', 'fullMLE'],
    topLevelKeys: ['mle'],
  },
  tpmle: {
    nestedKeys: ['tpmle', 'taxpayerMle', 'tpMle', 'miniMle'],
    topLevelKeys: ['tpMle', 'taxpayerMle'],
  },
  bae: {
    nestedKeys: ['bae', 'biAnnual'],
    topLevelKeys: ['bae'],
  },
  room: {
    nestedKeys: ['room', 'roomMLE', 'roommle', 'rmle'],
    topLevelKeys: ['room'],
  },
};

const MECHANISM_TO_CANONICAL_EXCEPTION_KEY: Record<
  string,
  CanonicalNonTpeExceptionKey
> = {
  fullmle: 'mle',
  ntmle: 'mle',
  mle: 'mle',
  full: 'mle',
  taxpayermle: 'tpmle',
  tpmle: 'tpmle',
  tpemle: 'tpmle',
  roommle: 'room',
  room: 'room',
  rmle: 'room',
  bae: 'bae',
  biannual: 'bae',
  full_mle: 'mle',
  room_mle: 'room',
};

const SIMPLE_ALIAS_KEYS = ['mle', 'tpMle', 'bae'] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const toNonNegativeNumber = (value: unknown, fallback = 0): number =>
  Math.max(0, toFiniteNumber(value, fallback));

const normalizeMechanismToken = (value: unknown): string =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z_]/g, '');

const normalizeLegacyExceptionValue = (
  value: unknown
): CanonicalNonTpeExceptionState | null => {
  if (!isRecord(value)) {
    const scalarAmount = toFiniteNumber(value, Number.NaN);
    if (!Number.isFinite(scalarAmount)) {
      return null;
    }

    const normalizedScalarAmount = Math.max(0, scalarAmount);
    return {
      enabled: true,
      available: true,
      maxAmount: normalizedScalarAmount,
      totalAmount: normalizedScalarAmount,
      amount: normalizedScalarAmount,
      usedAmount: 0,
      remainingAmount: normalizedScalarAmount,
    };
  }

  const explicitDisabled =
    value.enabled === false || value.available === false;
  const fallbackTotalAmount =
    toFiniteNumber(value.remainingAmount ?? value.remaining, 0) +
    toFiniteNumber(value.usedAmount ?? value.used, 0);
  const maxAmount = toNonNegativeNumber(
    value.maxAmount ??
      value.totalAmount ??
      value.amount ??
      fallbackTotalAmount,
    0
  );
  const totalAmount = toNonNegativeNumber(
    value.totalAmount ?? value.maxAmount ?? value.amount,
    maxAmount
  );
  const amount = toNonNegativeNumber(
    value.amount ?? value.totalAmount ?? value.maxAmount,
    totalAmount
  );
  const usedAmount = toNonNegativeNumber(
    value.usedAmount ?? value.used,
    0
  );
  const remainingCandidate = value.remainingAmount ?? value.remaining;
  const remainingAmount =
    remainingCandidate !== undefined && remainingCandidate !== null
      ? toNonNegativeNumber(remainingCandidate, Math.max(0, totalAmount - usedAmount))
      : Math.max(0, totalAmount - usedAmount);

  return {
    ...value,
    enabled: !explicitDisabled,
    available: !explicitDisabled,
    maxAmount,
    totalAmount,
    amount,
    usedAmount,
    remainingAmount,
  };
};

const readLegacyExceptionSource = (
  team: TeamExceptionOwnerLike,
  key: CanonicalNonTpeExceptionKey
): CanonicalNonTpeExceptionState | null => {
  const exceptions = isRecord(team.exceptions) ? team.exceptions : null;
  const { nestedKeys, topLevelKeys } = NON_TPE_EXCEPTION_SOURCES[key];

  for (const nestedKey of nestedKeys) {
    const normalized = normalizeLegacyExceptionValue(exceptions?.[nestedKey]);
    if (normalized) {
      return normalized;
    }
  }

  for (const topLevelKey of topLevelKeys) {
    const normalized = normalizeLegacyExceptionValue(team[topLevelKey]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const readAuthoritativeCanonicalExceptionSource = (
  team: TeamExceptionOwnerLike | null | undefined,
  key: CanonicalNonTpeExceptionKey
): unknown => {
  const exceptions = isRecord(team?.exceptions) ? team.exceptions : null;
  const { nestedKeys } = NON_TPE_EXCEPTION_SOURCES[key];

  for (const nestedKey of nestedKeys) {
    const normalized = normalizeLegacyExceptionValue(exceptions?.[nestedKey]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const CANONICAL_NON_TPE_EXCEPTION_KEYS = Object.freeze(
  [...CANONICAL_KEYS]
) as readonly CanonicalNonTpeExceptionKey[];

export function getCanonicalExceptionKeyForSigningMechanism(
  value: unknown
): CanonicalNonTpeExceptionKey | null {
  const token = normalizeMechanismToken(value);
  if (!token) {
    return null;
  }

  return MECHANISM_TO_CANONICAL_EXCEPTION_KEY[token] || null;
}

export function normalizeCanonicalTeamExceptions(
  team: TeamExceptionOwnerLike | null | undefined
): CanonicalTeamExceptions {
  const exceptions = isRecord(team?.exceptions) ? team.exceptions : {};
  const normalized: CanonicalTeamExceptionsWithPreservedBuckets = {};

  for (const [key, value] of Object.entries(exceptions)) {
    if (EXCEPTION_ALIAS_KEYS.has(key)) {
      continue;
    }
    normalized[key] = value;
  }

  if (!team) {
    return normalized;
  }

  for (const key of CANONICAL_KEYS) {
    const normalizedEntry = readLegacyExceptionSource(team, key);
    if (normalizedEntry) {
      normalized[key] = normalizedEntry;
    }
  }

  return normalized;
}

export function getCanonicalExceptionEntry(
  team: TeamExceptionOwnerLike | null | undefined,
  key: CanonicalNonTpeExceptionKey
): CanonicalNonTpeExceptionState | null {
  return normalizeLegacyExceptionValue(
    readAuthoritativeCanonicalExceptionSource(team, key)
  );
}

export function getCanonicalExceptionAvailability(
  team: TeamExceptionOwnerLike | null | undefined,
  key: CanonicalNonTpeExceptionKey
): CanonicalNonTpeExceptionAvailability {
  const entry = getCanonicalExceptionEntry(team, key);
  const enabled = entry?.enabled === true;
  const remainingAmount = entry?.remainingAmount ?? 0;

  return {
    key,
    present: Boolean(entry),
    enabled,
    usable: enabled && remainingAmount > 0,
    totalAmount: entry?.totalAmount ?? 0,
    usedAmount: entry?.usedAmount ?? 0,
    remainingAmount,
    entry,
  };
}

export function buildDerivedExceptionCompatibilityAliases(
  team: TeamExceptionOwnerLike | null | undefined
): Partial<Record<(typeof SIMPLE_ALIAS_KEYS)[number], DerivedSimpleException | null>> {
  const mle = getCanonicalExceptionEntry(team, 'mle');
  const tpmle = getCanonicalExceptionEntry(team, 'tpmle');
  const bae = getCanonicalExceptionEntry(team, 'bae');

  const toSimple = (
    entry: CanonicalNonTpeExceptionState | null
  ): DerivedSimpleException | null =>
    entry
      ? {
          amount: entry.totalAmount,
          used: entry.usedAmount,
          remaining: entry.remainingAmount,
        }
      : null;

  return {
    mle: toSimple(mle),
    tpMle: toSimple(tpmle),
    bae: toSimple(bae),
  };
}

export function normalizeTeamExceptionOwnership<
  TTeam extends TeamExceptionOwnerLike | null | undefined,
>(team: TTeam): TTeam {
  if (!team) {
    return team;
  }

  const normalizedTeam = {
    ...team,
    exceptions: normalizeCanonicalTeamExceptions(team),
  } as UnknownRecord;

  for (const aliasKey of EXCEPTION_ALIAS_KEYS) {
    delete normalizedTeam[aliasKey];
  }

  return normalizedTeam as TTeam;
}
