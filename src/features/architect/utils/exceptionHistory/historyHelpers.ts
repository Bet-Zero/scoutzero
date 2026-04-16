/**
 * FILE: src/features/architect/utils/exceptionHistory/historyHelpers.ts
 * PURPOSE: Shared helpers for generating and appending Architect TPE exception history entries.
 * OWNERSHIP: Feature: architect/capSheet
 *
 * HISTORY:
 *  - 2026-01-29: Created by plan `plans/phase49-tpe-history/plan.md`, chunk_01
 *  - 2026-03-12: Phase E54 migrated authoritative implementation to TypeScript.
 *
 * LINKS:
 *  - Plan: plans/phase49-tpe-history/plan.md
 *  - Latest Chunk: plans/phase49-tpe-history/chunks/chunk_01.md
 */

const ENTRY_TYPES = {
  CREATED: 'TPE_CREATED',
  CONSUMED: 'TPE_CONSUMED',
  EXPIRED: 'TPE_EXPIRED',
} as const;

type HistorySeasonValue = string | number | null | undefined;

type HistoryContextParams = {
  mutationType?: string | null;
  worldId?: string | null;
};

type BuildHistoryKeyParams = {
  mutationType?: string | null;
  worldId?: string | null;
  teamCode?: string | null;
  tpeId?: string | null;
  kind?: string | null;
  signature?: string | null;
};

type AbsorbedPlayerLike = {
  playerId?: string | null;
  id?: string | null;
  name?: string | null;
  displayName?: string | null;
  playerName?: string | null;
  amountAbsorbed?: number | string | null;
};

type SanitizedAbsorbedPlayer = {
  playerId: string | null;
  name: string | null;
  amountAbsorbed: number;
};

type ExceptionHistoryEntryLike = {
  historyKey?: string | null;
  type?: string | null;
  teamCode?: string | null;
  tpeId?: string | null;
  timestamp?: string | null;
  [key: string]: unknown;
};

type TeamWithExceptionHistoryLike = {
  exceptionHistory?: unknown;
  [key: string]: unknown;
};

type TpeCreationHistoryEntryParams = {
  teamCode?: string | null;
  tpeId?: string | null;
  amountCreated?: number | string | null;
  createdFrom?: string | null;
  createdSeason?: HistorySeasonValue;
  expiresOn?: string | null;
  seasonId?: string | null;
  seasonYear?: HistorySeasonValue;
  timestampISO?: string | null;
  worldId?: string | null;
  mutationType?: string | null;
  mutationId?: string | null;
};

type TpeConsumptionHistoryEntryParams = {
  teamCode?: string | null;
  tpeId?: string | null;
  amountConsumed?: number | string | null;
  remainingAmountAfter?: number | string | null;
  fullyConsumed?: boolean | null;
  absorbedPlayers?: Array<AbsorbedPlayerLike | null | undefined>;
  seasonId?: string | null;
  seasonYear?: HistorySeasonValue;
  timestampISO?: string | null;
  worldId?: string | null;
  mutationType?: string | null;
  mutationId?: string | null;
};

type BuildExpiryHistoryKeyParams = {
  worldId?: string | null;
  teamCode?: string | null;
  tpeId?: string | null;
  toSeason?: string | null;
  expiresOn?: string | null;
  amountExpired?: number | string | null;
};

type TpeExpiryHistoryEntryParams = {
  teamCode?: string | null;
  tpeId?: string | null;
  amountExpired?: number | string | null;
  totalAmount?: number | string | null;
  expiresOn?: string | null;
  toSeason?: string | null;
  createdFrom?: string | null;
  timestampISO?: string | null;
  worldId?: string | null;
};

type TpeCreationHistoryEntry = {
  historyKey: string;
  type: typeof ENTRY_TYPES.CREATED;
  teamCode: string;
  tpeId: string;
  amountCreated: number;
  createdFrom: string | null;
  createdSeason: HistorySeasonValue;
  expiresOn: string | null;
  seasonId: string | null | undefined;
  seasonYear: HistorySeasonValue;
  timestamp: string | null | undefined;
  worldId?: string;
  mutationId?: string;
};

type TpeConsumptionHistoryEntry = {
  historyKey: string;
  type: typeof ENTRY_TYPES.CONSUMED;
  teamCode: string;
  tpeId: string;
  amountConsumed: number;
  remainingAmountAfter: number;
  fullyConsumed: boolean;
  absorbedPlayers: SanitizedAbsorbedPlayer[];
  seasonId: string | null | undefined;
  seasonYear: HistorySeasonValue;
  timestamp: string | null | undefined;
  worldId?: string;
  mutationId?: string;
};

type TpeExpiryHistoryEntry = {
  historyKey: string;
  type: typeof ENTRY_TYPES.EXPIRED;
  teamCode: string;
  tpeId: string;
  amountExpired: number;
  totalAmount: number;
  expiresOn: string | null;
  toSeason: string;
  timestamp: string;
  createdFrom?: string;
  worldId?: string;
};

function normalizeHistoryContext({
  mutationType,
  worldId,
}: HistoryContextParams) {
  return {
    mutationType: mutationType || 'executeTrade',
    worldId: worldId || 'global',
  };
}

function buildHistoryKey({
  mutationType,
  worldId,
  teamCode,
  tpeId,
  kind,
  signature,
}: BuildHistoryKeyParams) {
  const keyParts = [
    mutationType || 'executeTrade',
    worldId || 'global',
    teamCode || 'team',
    tpeId || 'tpe',
    kind || 'event',
    signature || 'sig',
  ];
  return keyParts.join(':');
}

function sanitizePlayers(
  absorbedPlayers: Array<AbsorbedPlayerLike | null | undefined> = []
) {
  return absorbedPlayers
    .map((player): SanitizedAbsorbedPlayer | null => {
      if (!player) return null;
      const amountAbsorbed = Number(player.amountAbsorbed) || 0;
      return {
        playerId: player.playerId || player.id || null,
        name: player.name || player.displayName || player.playerName || null,
        amountAbsorbed,
      };
    })
    .filter((player): player is SanitizedAbsorbedPlayer =>
      Boolean(
        player && (player.amountAbsorbed > 0 || player.name || player.playerId)
      )
    );
}

export function createTpeCreationHistoryEntry({
  teamCode,
  tpeId,
  amountCreated = 0,
  createdFrom = 'Trade',
  createdSeason,
  expiresOn,
  seasonId,
  seasonYear,
  timestampISO,
  worldId,
  mutationType,
  mutationId,
}: TpeCreationHistoryEntryParams): TpeCreationHistoryEntry | null {
  if (!teamCode || !tpeId) return null;

  const normalizedAmount = Number(amountCreated) || 0;
  const normalizedSeason =
    createdSeason !== undefined && createdSeason !== null
      ? createdSeason
      : (seasonYear ?? null);
  const context = normalizeHistoryContext({ mutationType, worldId });
  const signature = [
    normalizedSeason ?? '',
    expiresOn || '',
    normalizedAmount,
    createdFrom || '',
  ].join('|');

  const entry: TpeCreationHistoryEntry = {
    historyKey: buildHistoryKey({
      mutationType: context.mutationType,
      worldId: context.worldId,
      teamCode,
      tpeId,
      kind: 'created',
      signature,
    }),
    type: ENTRY_TYPES.CREATED,
    teamCode,
    tpeId,
    amountCreated: normalizedAmount,
    createdFrom,
    createdSeason: normalizedSeason,
    expiresOn: expiresOn || null,
    seasonId,
    seasonYear,
    timestamp: timestampISO,
  };

  if (context.worldId && context.worldId !== 'global') {
    entry.worldId = context.worldId;
  }
  if (mutationId) {
    entry.mutationId = mutationId;
  }

  return entry;
}

export function createTpeConsumptionHistoryEntry({
  teamCode,
  tpeId,
  amountConsumed = 0,
  remainingAmountAfter = 0,
  fullyConsumed = false,
  absorbedPlayers = [],
  seasonId,
  seasonYear,
  timestampISO,
  worldId,
  mutationType,
  mutationId,
}: TpeConsumptionHistoryEntryParams): TpeConsumptionHistoryEntry | null {
  if (!teamCode || !tpeId) return null;

  const normalizedConsumed = Number(amountConsumed) || 0;
  if (normalizedConsumed <= 0) return null;

  const normalizedRemaining = Math.max(0, Number(remainingAmountAfter) || 0);
  const players = sanitizePlayers(absorbedPlayers);
  const context = normalizeHistoryContext({ mutationType, worldId });
  const signature = [
    normalizedConsumed,
    normalizedRemaining,
    fullyConsumed ? '1' : '0',
    players
      .map(
        (player) =>
          `${player.playerId || player.name || 'unknown'}:${player.amountAbsorbed}`
      )
      .join(','),
  ].join('|');

  const entry: TpeConsumptionHistoryEntry = {
    historyKey: buildHistoryKey({
      mutationType: context.mutationType,
      worldId: context.worldId,
      teamCode,
      tpeId,
      kind: 'consumed',
      signature,
    }),
    type: ENTRY_TYPES.CONSUMED,
    teamCode,
    tpeId,
    amountConsumed: normalizedConsumed,
    remainingAmountAfter: normalizedRemaining,
    fullyConsumed: Boolean(fullyConsumed),
    absorbedPlayers: players,
    seasonId,
    seasonYear,
    timestamp: timestampISO,
  };

  if (context.worldId && context.worldId !== 'global') {
    entry.worldId = context.worldId;
  }
  if (mutationId) {
    entry.mutationId = mutationId;
  }

  return entry;
}

/**
 * Build a deterministic history key for TPE expiry events during season advance.
 * Key format: seasonAdvance:{worldId}:{teamCode}:{tpeId}:expired:{signature}
 * where signature = {toSeason}|{expiresOn}|{amountExpired}
 *
 * @param {Object} params - Key parameters
 * @param {string} params.worldId - World ID
 * @param {string} params.teamCode - Team code
 * @param {string} params.tpeId - TPE ID
 * @param {string} params.toSeason - Target season code (e.g., "2026-27")
 * @param {string} params.expiresOn - Expiry date ISO string
 * @param {number} params.amountExpired - Amount expired (typically remainingAmount at expiry)
 * @returns {string} Deterministic history key
 */
export function buildExpiryHistoryKey({
  worldId,
  teamCode,
  tpeId,
  toSeason,
  expiresOn,
  amountExpired,
}: BuildExpiryHistoryKeyParams) {
  const signature = [toSeason || '', expiresOn || '', amountExpired ?? 0].join(
    '|'
  );
  return buildHistoryKey({
    mutationType: 'seasonAdvance',
    worldId: worldId || 'global',
    teamCode,
    tpeId,
    kind: 'expired',
    signature,
  });
}

/**
 * Create a TPE expiry history entry for season advance.
 *
 * @param {Object} params - Entry parameters
 * @param {string} params.teamCode - Team code
 * @param {string} params.tpeId - TPE ID
 * @param {number} params.amountExpired - Amount expired (remainingAmount at expiry)
 * @param {number} [params.totalAmount] - Total original TPE amount (if available)
 * @param {string} params.expiresOn - Expiry date ISO string
 * @param {string} params.toSeason - Target season code (e.g., "2026-27")
 * @param {string} [params.createdFrom] - Source of original TPE (e.g., "Trade")
 * @param {string} [params.timestampISO] - Timestamp for the entry
 * @param {string} [params.worldId] - World ID
 * @returns {Object|null} History entry or null if required fields missing
 */
export function createTpeExpiryHistoryEntry({
  teamCode,
  tpeId,
  amountExpired = 0,
  totalAmount,
  expiresOn,
  toSeason,
  createdFrom,
  timestampISO,
  worldId,
}: TpeExpiryHistoryEntryParams): TpeExpiryHistoryEntry | null {
  if (!teamCode || !tpeId || !toSeason) return null;

  const normalizedAmount = Number(amountExpired) || 0;
  const normalizedTotal =
    totalAmount !== undefined ? Number(totalAmount) : normalizedAmount;

  const entry: TpeExpiryHistoryEntry = {
    historyKey: buildExpiryHistoryKey({
      worldId,
      teamCode,
      tpeId,
      toSeason,
      expiresOn,
      amountExpired: normalizedAmount,
    }),
    type: ENTRY_TYPES.EXPIRED,
    teamCode,
    tpeId,
    amountExpired: normalizedAmount,
    totalAmount: normalizedTotal,
    expiresOn: expiresOn || null,
    toSeason,
    timestamp: timestampISO || new Date().toISOString(),
  };

  if (createdFrom) {
    entry.createdFrom = createdFrom;
  }
  if (worldId && worldId !== 'global') {
    entry.worldId = worldId;
  }

  return entry;
}

export function appendExceptionHistory(
  team: TeamWithExceptionHistoryLike | null | undefined,
  entries: Array<ExceptionHistoryEntryLike | null | undefined> = []
) {
  if (!team) return team;
  const pendingEntries = entries.filter(Boolean) as ExceptionHistoryEntryLike[];
  if (pendingEntries.length === 0) {
    if (!Array.isArray(team.exceptionHistory)) {
      team.exceptionHistory = team.exceptionHistory
        ? [...(team.exceptionHistory as unknown[])]
        : [];
    }
    return team;
  }

  const existingHistory: ExceptionHistoryEntryLike[] = Array.isArray(
    team.exceptionHistory
  )
    ? [...team.exceptionHistory]
    : [];

  const existingKeys = new Set(
    existingHistory.map((entry) => {
      if (!entry) return null;
      if (entry.historyKey) return entry.historyKey;
      return JSON.stringify({
        type: entry.type,
        teamCode: entry.teamCode,
        tpeId: entry.tpeId,
        timestamp: entry.timestamp,
      });
    })
  );

  const dedupedEntries: ExceptionHistoryEntryLike[] = [];
  pendingEntries.forEach((entry) => {
    if (!entry.historyKey) return;
    if (existingKeys.has(entry.historyKey)) return;
    existingKeys.add(entry.historyKey);
    dedupedEntries.push(entry);
  });

  if (dedupedEntries.length === 0) {
    team.exceptionHistory = existingHistory;
    return team;
  }

  team.exceptionHistory = [...existingHistory, ...dedupedEntries];
  return team;
}

export const exceptionHistoryHelpers = {
  appendExceptionHistory,
  createTpeConsumptionHistoryEntry,
  createTpeCreationHistoryEntry,
  createTpeExpiryHistoryEntry,
  buildExpiryHistoryKey,
};
