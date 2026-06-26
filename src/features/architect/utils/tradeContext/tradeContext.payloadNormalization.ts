/**
 * FILE: src/features/architect/utils/tradeContext/tradeContext.payloadNormalization.ts
 * PURPOSE: Player projections, exception normalization, and payload normalization helpers.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * Wave 9 Step 3: Extracted from tradeContext.ts (L115-L730).
 * Scalar converters (toFiniteNumberOrUndefined, toNonEmptyString, etc.) are also
 * exported here since buildPostTradeTeamsSnapshot (staying in tradeContext.ts) uses them.
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { isOffseasonAsOfDate } from '@/features/architect/utils/buildRuleContext.helpers';
import type {
  SignAndTradePlayerLike,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  TradeExceptionRecord,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  ArchitectMutationTeamRecord,
  ArchitectTradePayloadPlayer,
} from '@/features/architect/utils/mutationPipeline';
import type {
  AnyRecord,
  OutgoingTradeRouteLike,
  TradeApplyValidationPlayer,
  TradeApplyValidationTeam,
  TradeContextPayload,
  TradeContextValidationPlayer,
  ValidationTeam,
} from './types';

// Local types copied from tradeContext.ts (used by exception normalization functions)
type SnapshotTradeException = Required<
  Pick<
    TradeExceptionRecord,
    'id' | 'amount' | 'totalAmount' | 'remainingAmount' | 'usedAmount'
  >
> &
  Pick<TradeExceptionRecord, 'createdSeason' | 'expiresOn' | 'createdFrom'>;

type SnapshotTradeExceptionSource = 'legacy' | 'canonical';

type SnapshotTradeExceptionCandidate = {
  normalized: SnapshotTradeException;
  completeness: number;
  source: SnapshotTradeExceptionSource;
};

export function toFiniteNumberOrUndefined(value: unknown): number | undefined {
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

export function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function toScalarId(value: unknown): string | number | null | undefined {
  return typeof value === 'string' || typeof value === 'number' || value === null
    ? value
    : undefined;
}

export function toStringOrNull(value: unknown): string | null | undefined {
  return typeof value === 'string' || value === null ? value : undefined;
}

export function toObjectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function toSignAndTradePlayerLike(
  player:
    | TradeContextValidationPlayer
    | TradeApplyValidationPlayer
    | ArchitectTradePayloadPlayer
): SignAndTradePlayerLike {
  const record = player as AnyRecord;
  const normalized: SignAndTradePlayerLike = {};
  const id = toScalarId(record.id);
  const playerId = toScalarId(record.playerId);
  const player_id = toScalarId(record.player_id);
  const originTeamId = toScalarId(record.originTeamId);
  const name = toStringOrNull(record.name);
  const displayName = toStringOrNull(record.displayName);
  const teamCode = toStringOrNull(record.teamCode);
  const teamId = toStringOrNull(record.teamId);
  const teamAbbr = toStringOrNull(record.teamAbbr);
  const team = toStringOrNull(record.team);
  const freeAgentYear = toScalarId(record.freeAgentYear);

  if (id !== undefined) normalized.id = id;
  if (playerId !== undefined) normalized.playerId = playerId;
  if (player_id !== undefined) normalized.player_id = player_id;
  if (name !== undefined) normalized.name = name;
  if (displayName !== undefined) normalized.displayName = displayName;
  if (toObjectRecord(record.bio)) {
    normalized.bio = record.bio as SignAndTradePlayerLike['bio'];
  }
  if (teamCode !== undefined) normalized.teamCode = teamCode;
  if (teamId !== undefined) normalized.teamId = teamId;
  if (teamAbbr !== undefined) normalized.teamAbbr = teamAbbr;
  if (team !== undefined) normalized.team = team;
  if (originTeamId !== undefined) normalized.originTeamId = originTeamId;
  if (toObjectRecord(record.contract)) {
    normalized.contract = record.contract as SignAndTradePlayerLike['contract'];
  }
  if (record.primaryContract != null) {
    normalized.primaryContract =
      record.primaryContract as SignAndTradePlayerLike['primaryContract'];
  }
  if (freeAgentYear !== undefined) {
    normalized.freeAgentYear = freeAgentYear;
  }
  if (typeof record.rightsRenounced === 'boolean') {
    normalized.rightsRenounced = record.rightsRenounced;
  }
  if (record.signAndTrade === true) {
    normalized.signAndTrade = true;
  }
  if (record.signAndTradeContract != null) {
    normalized.signAndTradeContract =
      record.signAndTradeContract as SignAndTradePlayerLike['signAndTradeContract'];
  }
  if (Array.isArray(record.salariesByYear)) {
    normalized.salariesByYear =
      record.salariesByYear as SignAndTradePlayerLike['salariesByYear'];
  }
  if (Array.isArray(record.salaries)) {
    normalized.salaries = record.salaries;
  }
  if (typeof record.contractYears === 'number') {
    normalized.contractYears = record.contractYears;
  }
  if (typeof record.years === 'number') {
    normalized.years = record.years;
  }
  if (typeof record.firstYearGuaranteed === 'boolean') {
    normalized.firstYearGuaranteed = record.firstYearGuaranteed;
  }

  return normalized;
}

export function projectTradeApplyValidationPlayer(
  player: unknown
): TradeApplyValidationPlayer | null {
  if (!player || typeof player !== 'object') {
    return null;
  }

  const record = player as AnyRecord;
  const projected: TradeApplyValidationPlayer = {};
  const playerId = toNonEmptyString(record.player_id);
  const id = toNonEmptyString(record.id);
  const playerIdAlias = toNonEmptyString(record.playerId);
  const name = toNonEmptyString(record.name);
  const displayName = toNonEmptyString(record.displayName);
  const playerName = toNonEmptyString(record.playerName);
  const absorptionMode = toNonEmptyString(record.absorptionMode);
  const tpeId = toNonEmptyString(record.tpeId);
  const matchIncoming = toFiniteNumberOrUndefined(record.matchIncoming);

  if (playerId !== undefined) {
    projected.player_id = playerId;
  }
  if (id !== undefined) {
    projected.id = id;
  }
  if (playerIdAlias !== undefined) {
    projected.playerId = playerIdAlias;
  }
  if (name !== undefined) {
    projected.name = name;
  }
  if (displayName !== undefined) {
    projected.displayName = displayName;
  }
  if (playerName !== undefined) {
    projected.playerName = playerName;
  }
  if (absorptionMode !== undefined) {
    projected.absorptionMode = absorptionMode;
  }
  if (tpeId !== undefined) {
    projected.tpeId = tpeId;
  }
  if (matchIncoming !== undefined) {
    projected.matchIncoming = matchIncoming;
  }

  return projected;
}

export function normalizeFallbackTradeApplyValidationTeam(
  team: ValidationTeam | null | undefined
): TradeApplyValidationTeam {
  const receives = Array.isArray(team?.receives)
    ? team.receives
        .map((player) => projectTradeApplyValidationPlayer(player))
        .filter(
          (player): player is TradeApplyValidationPlayer => player !== null
        )
    : [];

  return {
    teamCode: toNonEmptyString(team?.teamCode) ?? null,
    receives,
  };
}

export function getTradeApplyValidationPlayerKey(
  player: TradeApplyValidationPlayer | null | undefined
): string | null {
  return (
    player?.player_id ||
    player?.id ||
    player?.playerId ||
    player?.name ||
    player?.displayName ||
    player?.playerName ||
    null
  );
}

export function mergeTradeApplyValidationPlayer(
  validatedPlayer: TradeApplyValidationPlayer,
  fallbackPlayer: TradeApplyValidationPlayer | undefined
): TradeApplyValidationPlayer {
  if (!fallbackPlayer) {
    return validatedPlayer;
  }

  const merged: TradeApplyValidationPlayer = { ...validatedPlayer };

  if (
    merged.absorptionMode === undefined &&
    fallbackPlayer.absorptionMode !== undefined
  ) {
    merged.absorptionMode = fallbackPlayer.absorptionMode;
  }
  if (merged.tpeId === undefined && fallbackPlayer.tpeId !== undefined) {
    merged.tpeId = fallbackPlayer.tpeId;
  }
  if (
    merged.matchIncoming === undefined &&
    fallbackPlayer.matchIncoming !== undefined
  ) {
    merged.matchIncoming = fallbackPlayer.matchIncoming;
  }

  return merged;
}

export function buildAuthoritativeTradeApplyReceives({
  validatedReceives,
  fallbackReceives,
}: {
  validatedReceives: TradeApplyValidationPlayer[];
  fallbackReceives: TradeApplyValidationPlayer[];
}): TradeApplyValidationPlayer[] {
  if (validatedReceives.length === 0) {
    return fallbackReceives;
  }

  const fallbackByKey = new Map<string, TradeApplyValidationPlayer>();
  fallbackReceives.forEach((player) => {
    const key = getTradeApplyValidationPlayerKey(player);
    if (key) {
      fallbackByKey.set(key, player);
    }
  });

  const validatedKeys = new Set<string>();
  const mergedReceives = validatedReceives.map((player) => {
    const key = getTradeApplyValidationPlayerKey(player);
    if (key) {
      validatedKeys.add(key);
    }
    return mergeTradeApplyValidationPlayer(
      player,
      key ? fallbackByKey.get(key) : undefined
    );
  });

  const unmatchedFallbackReceives = fallbackReceives.filter((player) => {
    const key = getTradeApplyValidationPlayerKey(player);
    return key ? !validatedKeys.has(key) : true;
  });

  return [...mergedReceives, ...unmatchedFallbackReceives];
}

export function normalizeSnapshotTradeException({
  raw,
  source,
  teamCode,
  index,
  timestamp,
}: {
  raw: unknown;
  source: SnapshotTradeExceptionSource;
  teamCode: string | null;
  index: number;
  timestamp: number;
}): SnapshotTradeExceptionCandidate | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as AnyRecord;
  const explicitId = toNonEmptyString(record.id);
  const amountValue =
    toFiniteNumberOrUndefined(record.totalAmount) ??
    toFiniteNumberOrUndefined(record.amount);
  const remainingValue = toFiniteNumberOrUndefined(record.remainingAmount);
  const usedAmountValue = toFiniteNumberOrUndefined(record.usedAmount);
  const createdSeason =
    toFiniteNumberOrUndefined(record.createdSeason) ??
    toFiniteNumberOrUndefined(record.createdAtSeason) ??
    toFiniteNumberOrUndefined(record.season);
  const expiresOn =
    toNonEmptyString(record.expiresOn) ??
    toNonEmptyString(record.expirationDate) ??
    toNonEmptyString(record.expiryISO) ??
    toNonEmptyString(record.expiryDate);
  const createdFrom =
    toNonEmptyString(record.createdFrom) ?? toNonEmptyString(record.name);

  return {
    normalized: {
      id:
        explicitId ||
        `tpe_${teamCode || 'unknown'}_${source}_${index}_${timestamp}`,
      amount: amountValue ?? remainingValue ?? 0,
      totalAmount: amountValue ?? remainingValue ?? 0,
      remainingAmount: remainingValue ?? amountValue ?? 0,
      usedAmount: usedAmountValue ?? 0,
      ...(createdSeason !== undefined ? { createdSeason } : {}),
      ...(expiresOn !== undefined ? { expiresOn } : {}),
      ...(createdFrom !== undefined ? { createdFrom } : {}),
    },
    completeness:
      Number(Boolean(explicitId)) +
      Number(amountValue !== undefined) +
      Number(remainingValue !== undefined) +
      Number(usedAmountValue !== undefined) +
      Number(createdSeason !== undefined) +
      Number(expiresOn !== undefined) +
      Number(createdFrom !== undefined),
    source,
  };
}

export function buildSnapshotTradeExceptions({
  team,
  teamCode,
  timestamp,
}: {
  team: AnyRecord;
  teamCode: string | null;
  timestamp: number;
}): SnapshotTradeException[] {
  const compatibilityCandidates: SnapshotTradeExceptionCandidate[] = [];
  const exceptions = team.exceptions as AnyRecord | undefined;

  (Array.isArray(team.tradeExceptions) ? team.tradeExceptions : []).forEach(
    (rawTpe, index) => {
      const candidate = normalizeSnapshotTradeException({
        raw: rawTpe,
        source: 'legacy',
        teamCode,
        index,
        timestamp,
      });
      if (candidate) {
        compatibilityCandidates.push(candidate);
      }
    }
  );

  (Array.isArray(exceptions?.tpe) ? exceptions.tpe : []).forEach(
    (rawTpe, index) => {
      const candidate = normalizeSnapshotTradeException({
        raw: rawTpe,
        source: 'canonical',
        teamCode,
        index,
        timestamp,
      });
      if (candidate) {
        compatibilityCandidates.push(candidate);
      }
    }
  );

  const deduped = new Map<string, SnapshotTradeExceptionCandidate>();
  for (const candidate of compatibilityCandidates) {
    const existing = deduped.get(candidate.normalized.id);
    if (!existing) {
      deduped.set(candidate.normalized.id, candidate);
      continue;
    }

    // Exact overlap rule for the live trade bridge:
    // prefer the record that already carries more of the fields this path reads
    // (`id`, amount/totalAmount, remainingAmount, usedAmount, createdSeason,
    // expiresOn, createdFrom). When completeness ties, keep canonical data.
    const shouldReplace =
      candidate.completeness > existing.completeness ||
      (candidate.completeness === existing.completeness &&
        candidate.source === 'canonical' &&
        existing.source === 'legacy');

    if (shouldReplace) {
      deduped.set(candidate.normalized.id, candidate);
    }
  }

  return Array.from(deduped.values()).map((candidate) => candidate.normalized);
}

export function normalizeTradeTeamCodeLike(value: unknown): string | null {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.length === 3 ? normalized.toUpperCase() : normalized;
}

export function resolveOutgoingTradeDestinationTeamCode({
  payloadTeamCodes,
  senderIndex,
  player,
}: {
  payloadTeamCodes: string[];
  senderIndex: number;
  player: OutgoingTradeRouteLike;
}): string | null {
  const parsedTargetIndex = Number(player.receivingTeamIndex);
  const hasIndexRoute = Number.isInteger(parsedTargetIndex);
  const normalizedTargetId = normalizeTradeTeamCodeLike(
    player.receivingTeamId ||
      player.tradeTo ||
      player.toTeamId ||
      player.destTeamId
  );

  if (hasIndexRoute) {
    return payloadTeamCodes[parsedTargetIndex] || normalizedTargetId || null;
  }

  if (normalizedTargetId) {
    return normalizedTargetId;
  }

  if (payloadTeamCodes.length === 2) {
    return payloadTeamCodes.find((_, index) => index !== senderIndex) || null;
  }

  return null;
}

export function getTradePayloadPlayerId(
  player: AnyRecord | null | undefined
): string | null {
  const rawId = player?.player_id || player?.playerId || player?.id || null;
  if (rawId == null) {
    return null;
  }

  const normalized = String(rawId).trim();
  return normalized || null;
}

export function getTradePayloadPlayerMatchKey(
  player: AnyRecord | null | undefined
): string | null {
  return (
    getTradePayloadPlayerId(player) ||
    toNonEmptyString(player?.name) ||
    toNonEmptyString(player?.displayName) ||
    toNonEmptyString(player?.playerName) ||
    null
  );
}

export function findMatchingTradeReceivePayload(
  receives: AnyRecord[] | null | undefined,
  player: AnyRecord | null | undefined
): AnyRecord | null {
  const targetKey = getTradePayloadPlayerMatchKey(player);
  if (!targetKey || !Array.isArray(receives)) {
    return null;
  }

  return (
    receives.find(
      (candidate) => getTradePayloadPlayerMatchKey(candidate) === targetKey
    ) || null
  );
}

export function findTradePlayerSnapshot(
  team: AnyRecord | null | undefined,
  playerId: string | null
): AnyRecord | null {
  if (!playerId) {
    return null;
  }

  const playerCollections = [team?.players, team?.twoWayPlayers];
  for (const collection of playerCollections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    const match = collection.find((candidate) => {
      const record = candidate as AnyRecord | null | undefined;
      return getTradePayloadPlayerId(record) === playerId;
    });

    if (match && typeof match === 'object') {
      return match as AnyRecord;
    }
  }

  return null;
}

export function buildTradeValidationPlayer({
  player,
  sourceTeamState,
}: {
  player: ArchitectTradePayloadPlayer;
  sourceTeamState: AnyRecord | null | undefined;
}): TradeContextValidationPlayer {
  const authoritativeSnapshot = findTradePlayerSnapshot(
    sourceTeamState,
    getTradePayloadPlayerId(player)
  );

  const merged = authoritativeSnapshot
    ? { ...authoritativeSnapshot, ...player }
    : { ...player };
  const matchIncoming = toFiniteNumberOrUndefined(merged.matchIncoming);
  const matchOutgoing = toFiniteNumberOrUndefined(merged.matchOutgoing);

  if (matchIncoming !== undefined) {
    merged.matchIncoming = matchIncoming;
  } else {
    delete merged.matchIncoming;
  }

  if (matchOutgoing !== undefined) {
    merged.matchOutgoing = matchOutgoing;
  } else {
    delete merged.matchOutgoing;
  }

  return merged as TradeContextValidationPlayer;
}

export function buildTradeValidationTeamRecord(
  team: ArchitectMutationTeamRecord,
  fallbackTeamCode: string | null
): ValidationTeam['team'] {
  const teamRecord = team as Record<string, unknown>;
  const teamCode = normalizeTradeTeamCodeLike(team.teamCode) ?? fallbackTeamCode;
  const teamId =
    teamRecord.teamId != null ? String(teamRecord.teamId) : undefined;

  return {
    ...team,
    ...(teamRecord.id != null ? { id: String(teamRecord.id) } : {}),
    ...(teamId != null ? { teamId } : {}),
    ...(teamCode != null ? { teamCode } : {}),
  } as ValidationTeam['team'];
}

export function buildTradeValidatorContext(
  payload: TradeContextPayload
): TradeValidatorContext {
  const rawTradeCtx = payload.tradeCtx || {};
  const tradeCtx: TradeValidatorContext = {};
  const asOfDate = payload.asOfDate ?? rawTradeCtx.asOfDate;
  if (typeof rawTradeCtx.worldId === 'string') {
    tradeCtx.worldId = rawTradeCtx.worldId;
  }
  if (typeof rawTradeCtx.source === 'string') {
    tradeCtx.source = rawTradeCtx.source;
  }
  if (asOfDate != null) {
    tradeCtx.asOfDate = String(asOfDate);
  }
  if (typeof rawTradeCtx.tradeDate === 'string') {
    tradeCtx.tradeDate = rawTradeCtx.tradeDate;
  }
  if (typeof rawTradeCtx.offseason === 'boolean') {
    tradeCtx.offseason = rawTradeCtx.offseason;
  } else if (asOfDate != null) {
    tradeCtx.offseason = isOffseasonAsOfDate(String(asOfDate));
  }
  const normalizedYearKey =
    rawTradeCtx.yearKey != null ? toEndYear(rawTradeCtx.yearKey) : null;

  if (typeof normalizedYearKey === 'number' && Number.isFinite(normalizedYearKey)) {
    tradeCtx.yearKey = normalizedYearKey;
  }

  return tradeCtx;
}

export function buildTradeIncomingPlayerSnapshot({
  player,
  sourceTeamState,
}: {
  player: ArchitectTradePayloadPlayer;
  sourceTeamState: AnyRecord | null | undefined;
}): AnyRecord {
  const authoritativeSnapshot = findTradePlayerSnapshot(
    sourceTeamState,
    getTradePayloadPlayerId(player)
  );

  if (authoritativeSnapshot) {
    return { ...authoritativeSnapshot };
  }

  const fallback: AnyRecord = {};
  const keys = [
    'player_id',
    'playerId',
    'id',
    'name',
    'displayName',
    'playerName',
    'isTwoWay',
    'originTeamId',
  ] as const;

  const record = player as AnyRecord;
  keys.forEach((key) => {
    if (record[key] !== undefined) {
      fallback[key] = record[key];
    }
  });

  return fallback;
}
