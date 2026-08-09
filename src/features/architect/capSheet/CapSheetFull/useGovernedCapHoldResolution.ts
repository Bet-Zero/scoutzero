import { useMemo } from 'react';

import type { PlayerRulesProfileInput } from '@/features/architect/types';
import {
  resolveFreeAgentRights,
  type FreeAgentRights,
} from '@/features/architect/utils/freeAgentRights';
import {
  isDateOnly,
  isDateOnlyWithinSalaryCapYear,
  isWithinSalaryCapYear,
  isZonedDateTime,
  salaryCapYearWindow,
} from '@/features/architect/utils/governedSeason';
import type { RightsEventLedgerPayload } from '@/schemas/rightsEventLedger';

type NumericLike = number | string | null | undefined;

export type CapHoldLike = {
  playerId?: string | number | null;
  playerName?: string | null;
  season?: string | null;
  amount?: NumericLike;
  type?: string | null;
  isSigned?: boolean | null;
};

export type ResolvedCapHoldEntry = {
  hold: CapHoldLike;
  rights: FreeAgentRights;
  player: PlayerRulesProfileInput | null;
  isOnRoster: boolean;
};

export type GovernedRightsContext = {
  worldId: string;
  teamId: string;
  asOfDate: string | null;
  worldVersion: number | null;
};

export const resolvedHoldAmount = (entry: ResolvedCapHoldEntry): number =>
  Number(
    entry.rights.authority === 'governed-history'
      ? entry.rights.capHoldAmount
      : entry.rights.capHoldAmount || entry.hold.amount || 0
  );

const toEndYear = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const seasonMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (seasonMatch) return 2000 + Number(seasonMatch[2]);
  const numericYear = Number.parseInt(trimmed, 10);
  return /^\d{4}$/.test(trimmed) && Number.isFinite(numericYear)
    ? numericYear
    : null;
};

const toStartYear = (value: unknown): number | null => {
  const endYear = toEndYear(value);
  return endYear === null ? null : endYear - 1;
};

const normalizeLookupKey = (value: unknown): string | null => {
  if (value == null) return null;
  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
};

const addLookupKey = (keys: Set<string>, value: unknown) => {
  if (value == null) return;
  const raw = String(value).trim();
  if (!raw) return;
  keys.add(raw);
  const normalized = normalizeLookupKey(raw);
  if (normalized) keys.add(normalized);
};

export const getPlayerLookupKeys = (
  player: PlayerRulesProfileInput | null
): Set<string> => {
  const keys = new Set<string>();
  if (!player) return keys;
  const candidate = player as {
    id?: unknown;
    player_id?: unknown;
    playerId?: unknown;
    name?: unknown;
    displayName?: unknown;
    bio?: { playerId?: unknown; displayName?: unknown };
  };
  addLookupKey(keys, candidate.id);
  addLookupKey(keys, candidate.player_id);
  addLookupKey(keys, candidate.playerId);
  addLookupKey(keys, candidate.bio?.playerId);
  addLookupKey(keys, candidate.name);
  addLookupKey(keys, candidate.displayName);
  addLookupKey(keys, candidate.bio?.displayName);
  return keys;
};

export const getHoldLookupKeys = (hold: CapHoldLike): Set<string> => {
  const keys = new Set<string>();
  addLookupKey(keys, hold.playerId);
  addLookupKey(keys, hold.playerName);
  return keys;
};

const resolveCapHoldPlayer = (
  hold: CapHoldLike,
  playersMap: Record<string, unknown>
): PlayerRulesProfileInput | null => {
  for (const key of getHoldLookupKeys(hold)) {
    const player = playersMap[key];
    if (player && typeof player === 'object') {
      return player as PlayerRulesProfileInput;
    }
  }
  return null;
};

const resolveProjectionDate = (
  asOfDate: string | null,
  salaryCapYear: number
): string | null => {
  if (
    asOfDate &&
    ((isDateOnly(asOfDate) &&
      isDateOnlyWithinSalaryCapYear(asOfDate, salaryCapYear)) ||
      (isZonedDateTime(asOfDate) &&
        isWithinSalaryCapYear(asOfDate, salaryCapYear)))
  ) {
    return asOfDate;
  }
  return salaryCapYearWindow(salaryCapYear)?.from.slice(0, 10) ?? null;
};

export function useGovernedCapHoldResolution({
  displayedCapHolds,
  playersMap,
  rosterLookupKeys,
  rightsLedger,
  governedRightsContext,
  currentYear,
}: {
  displayedCapHolds: readonly CapHoldLike[];
  playersMap: Record<string, unknown>;
  rosterLookupKeys: ReadonlySet<string>;
  rightsLedger: RightsEventLedgerPayload | null | undefined;
  governedRightsContext: GovernedRightsContext | null;
  currentYear: number;
}) {
  const resolvedCapHolds = useMemo<ResolvedCapHoldEntry[]>(
    () =>
      displayedCapHolds.map((hold) => {
        const player = resolveCapHoldPlayer(hold, playersMap);
        const holdKeys = getHoldLookupKeys(hold);
        const playerKeys = getPlayerLookupKeys(player);
        const isOnRoster =
          Array.from(holdKeys).some((key) => rosterLookupKeys.has(key)) ||
          Array.from(playerKeys).some((key) => rosterLookupKeys.has(key));
        const holdSalaryCapYear = toEndYear(hold.season) ?? currentYear;
        const rights = resolveFreeAgentRights(
          player as unknown as Parameters<typeof resolveFreeAgentRights>[0], // eslint-disable-line no-restricted-syntax -- LEDGER:CAST-172
          {
            activeSeasonStartYear: currentYear - 1,
            holdType: hold.type,
            holdSeasonStartYear: toStartYear(hold.season),
            isOnRoster,
            ...(governedRightsContext
              ? {
                  governedRights: {
                    ledger: rightsLedger,
                    worldId: governedRightsContext.worldId,
                    teamId: governedRightsContext.teamId,
                    playerId: String(
                      hold.playerId ??
                        player?.playerId ??
                        player?.player_id ??
                        player?.id ??
                        ''
                    ),
                    asOfDate: resolveProjectionDate(
                      governedRightsContext.asOfDate,
                      holdSalaryCapYear
                    ),
                    salaryCapYear: holdSalaryCapYear,
                    worldVersion: governedRightsContext.worldVersion,
                  },
                }
              : {}),
          }
        );
        return { hold, rights, player, isOnRoster };
      }),
    [
      currentYear,
      displayedCapHolds,
      governedRightsContext,
      playersMap,
      rightsLedger,
      rosterLookupKeys,
    ]
  );

  const incompleteEntries = resolvedCapHolds.filter(
    (entry) =>
      entry.rights.authority === 'governed-history' &&
      entry.rights.projectionStatus !== 'available' &&
      entry.rights.projectionStatus !== 'renounced'
  );

  return {
    resolvedCapHolds,
    hasGovernedRightsNeedsInput: incompleteEntries.length > 0,
    governedRightsIncompleteYears: new Set(
      incompleteEntries
        .map((entry) => toEndYear(entry.hold.season))
        .filter((year): year is number => year !== null)
    ),
  };
}
