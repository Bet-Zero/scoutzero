/**
 * Wave 22 Step 1: Primitive coercion utilities extracted from
 * mutationPipeline.helpers.ts (lines 210–444).
 */

import type { TradeContextCurrentState } from '@/features/architect/utils/tradeContext/types';
import type {
  LooseRecord,
  MutationCurrentStateContractDateLike,
  MutationTeamSourceLike,
  TradeStateSlice,
} from './mutationPipeline';

export function asLooseRecord(value: unknown): LooseRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as LooseRecord;
  }
  return null;
}

export function normalizeCurrentStateTeamSource(
  value: unknown
): MutationTeamSourceLike | undefined {
  if (typeof value === 'string') {
    const provider = toOptionalTrimmedString(value);
    return provider ? { provider } : undefined;
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: NonNullable<MutationTeamSourceLike> = {};
  const provider = toOptionalTrimmedString(record.provider);
  const teamPageUrl = toOptionalTrimmedString(record.teamPageUrl);
  const playerPageUrl = toOptionalTrimmedString(record.playerPageUrl);
  const scrapedAt = toOptionalTrimmedString(record.scrapedAt);
  const season = toOptionalTrimmedString(record.season);
  const type = toOptionalTrimmedString(record.type);
  const worldId = toOptionalTrimmedString(record.worldId);
  const generatedAt = toOptionalTrimmedString(record.generatedAt);
  const baseTeamVersion = toOptionalTrimmedString(record.baseTeamVersion);
  const lastModifiedAt = toOptionalTrimmedString(record.lastModifiedAt);

  if (provider !== undefined) normalized.provider = provider;
  if (teamPageUrl !== undefined) normalized.teamPageUrl = teamPageUrl;
  if (playerPageUrl !== undefined) normalized.playerPageUrl = playerPageUrl;
  if (scrapedAt !== undefined) normalized.scrapedAt = scrapedAt;
  if (season !== undefined) normalized.season = season;
  if (type !== undefined) normalized.type = type;
  if (worldId !== undefined) normalized.worldId = worldId;
  if (generatedAt !== undefined) normalized.generatedAt = generatedAt;
  if (baseTeamVersion !== undefined)
    normalized.baseTeamVersion = baseTeamVersion;
  if (lastModifiedAt !== undefined) normalized.lastModifiedAt = lastModifiedAt;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function removeUndefinedDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item: unknown) => removeUndefinedDeep(item));
  }

  if (typeof obj === 'object') {
    const result: LooseRecord = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefinedDeep(value);
      }
    }
    return result;
  }

  return obj;
}

export function toTradeStateSlice(
  currentState: TradeStateSlice
): TradeContextCurrentState {
  const teams: TradeContextCurrentState['teams'] = [];

  if (Array.isArray(currentState.teams)) {
    currentState.teams.forEach((entry) => {
      if (!entry?.team) return;
      teams.push({
        teamCode: entry.teamCode ?? entry.team.teamCode ?? null,
        team: entry.team,
      });
    });
  }

  return {
    teams,
    ...(currentState.governedCashTeamSnapshots
      ? { governedCashTeamSnapshots: currentState.governedCashTeamSnapshots }
      : {}),
  };
}

export function toOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function toOptionalIdString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return toOptionalTrimmedString(value);
}

export function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return undefined;
}

export function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function toOptionalBooleanOrNull(
  value: unknown
): boolean | null | undefined {
  if (value === null) return null;
  return toOptionalBoolean(value);
}

export function toOptionalNumberishOrNull(
  value: unknown
): number | string | null | undefined {
  if (value === null) return null;
  return toOptionalNumberish(value);
}

export function toOptionalContractDateLikeOrNull(
  value: unknown
): MutationCurrentStateContractDateLike | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return toOptionalTrimmedString(value);
}

export function toOptionalNumberish(
  value: unknown
): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return toOptionalTrimmedString(value);
}

export function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((entry) => toOptionalIdString(entry))
    .filter((entry): entry is string => typeof entry === 'string');
}

export function toOptionalNumberOrNull(
  value: unknown
): number | null | undefined {
  if (value === null) return null;
  return toOptionalNumber(value);
}

export function toOptionalTrimmedStringOrNull(
  value: unknown
): string | null | undefined {
  if (value === null) return null;
  return toOptionalTrimmedString(value);
}
