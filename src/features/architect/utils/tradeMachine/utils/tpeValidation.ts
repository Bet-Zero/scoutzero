import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import {
  CanonicalTeamTpeUsage,
  CanonicalTeamTpeUsageEntry,
  NormalizedTradeExceptionRecord,
  TradeExceptionPlayer,
  TradeExceptionRecord,
  TradeTeam,
  UnresolvedTpeUsage,
} from '../constants/types';
import { isTwoWayTradePlayer } from './twoWayTradeSalary';

export const SECOND_APRON_TPE_BLOCK =
  'Second apron team cannot use trade exceptions';

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function isPriorYearTPE(
  tpe: TradeExceptionRecord | null | undefined,
  season: number
): boolean {
  const created =
    tpe?.season ?? tpe?.createdSeason ?? tpe?.createdAtSeason ?? season;
  return created < season;
}

export function isCurrentSeasonTPE(
  tpe: TradeExceptionRecord | null | undefined,
  season: number
): boolean {
  const created =
    tpe?.season ?? tpe?.createdSeason ?? tpe?.createdAtSeason ?? season;
  return created === season;
}

export const isCurrentYearTPE = isCurrentSeasonTPE;

export function hasPriorYearTPE(
  appliedTPEs: TradeExceptionRecord[] | null | undefined,
  currentSeason: number
): boolean {
  if (!Array.isArray(appliedTPEs)) return false;
  return appliedTPEs.some((tpe) => isPriorYearTPE(tpe, currentSeason));
}

export function createTPE({
  teamCtx,
  outgoing,
  incoming,
  tradeDate,
  maximumIncoming,
  usedIncoming,
  salaryMatchingPath,
}: {
  teamCtx: { isOverCap?: boolean | null };
  outgoing: number;
  incoming: number;
  tradeDate?: string | null;
  maximumIncoming?: number;
  usedIncoming?: number;
  salaryMatchingPath?: TradeExceptionRecord['salaryMatchingPath'];
}): TradeExceptionRecord | null {
  if (!teamCtx.isOverCap) return null;
  const governedTotal = toFiniteNumber(maximumIncoming, -1);
  const isGovernedComponent = governedTotal >= 0;
  const total = isGovernedComponent
    ? governedTotal
    : Math.max(0, outgoing - incoming);
  const consumed = isGovernedComponent
    ? Math.max(0, toFiniteNumber(usedIncoming, incoming))
    : 0;
  const remaining = Math.max(0, total - consumed);
  if (remaining <= 0) return null;
  const baseDate = tradeDate ? new Date(tradeDate) : new Date();
  const expiry = new Date(baseDate);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  const roundedTotal = Math.round(total);
  const roundedRemaining = Math.round(remaining);

  const governedFields = isGovernedComponent
    ? {}
    : {
        remaining: roundedRemaining,
        expirationDate: expiry.toISOString(),
      };

  return {
    amount: roundedTotal,
    totalAmount: roundedTotal,
    remainingAmount: roundedRemaining,
    usedAmount: Math.round(consumed),
    createdSeason: baseDate.getUTCFullYear(),
    createdOn: tradeDate || baseDate.toISOString(),
    expiresOn: expiry.toISOString(),
    ...governedFields,
    ...(salaryMatchingPath ? { salaryMatchingPath } : {}),
  };
}

export function isExpiredTPE(
  tpe: TradeExceptionRecord | null | undefined,
  onDate: string
): boolean {
  const expiry = tpe?.expiresOn || tpe?.expiryISO || tpe?.expiryDate;
  if (!expiry) return false;
  return new Date(onDate).getTime() > new Date(expiry).getTime();
}

export function canUseTPE(
  teamCtx: unknown,
  tpe: TradeExceptionRecord | null | undefined,
  { onDate }: { onDate: string }
): boolean {
  void teamCtx;
  if (!tpe || isExpiredTPE(tpe, onDate)) return false;
  return true;
}

export function normalizeTpeForValidation(
  tpe: TradeExceptionRecord | null | undefined
): NormalizedTradeExceptionRecord | null {
  if (!tpe || typeof tpe !== 'object') return null;

  const amount = toFiniteNumber(tpe.amount ?? tpe.totalAmount);
  const remaining = toFiniteNumber(
    tpe.remaining ?? tpe.remainingAmount ?? amount,
    amount
  );
  const expiresOn =
    tpe.expiresOn ??
    tpe.expirationDate ??
    tpe.expiryISO ??
    tpe.expiryDate ??
    null;

  return {
    ...tpe,
    id: String(tpe.id ?? ''),
    amount,
    totalAmount: toFiniteNumber(tpe.totalAmount ?? amount, amount),
    remaining,
    remainingAmount: toFiniteNumber(
      tpe.remainingAmount ?? remaining,
      remaining
    ),
    expiresOn,
    expirationDate: tpe.expirationDate ?? expiresOn,
    expiryISO: tpe.expiryISO ?? expiresOn,
    expiryDate: tpe.expiryDate ?? expiresOn,
    sourceRef: tpe.sourceRef || tpe,
  };
}

function getPlayerSalary(player: TradeExceptionPlayer): number {
  return toFiniteNumber(player?.matchIncoming ?? player?.salary);
}

function getPlayerName(
  player: TradeExceptionPlayer | null | undefined
): string {
  return String(player?.name || player?.displayName || 'Unknown');
}

export function buildCanonicalTeamTpeUsage({
  team,
  incomingPlayers = [],
  appliedTPEs = [],
  tradeExceptions = [],
}: {
  team?: TradeTeam | Record<string, unknown> | null;
  incomingPlayers?: TradeExceptionPlayer[];
  appliedTPEs?: TradeExceptionRecord[];
  tradeExceptions?: TradeExceptionRecord[];
}): CanonicalTeamTpeUsage {
  const availableTpeMap = new Map<string, NormalizedTradeExceptionRecord>();
  const compatibilityTpes = [
    ...(Array.isArray(tradeExceptions) ? tradeExceptions : []),
    ...(Array.isArray(appliedTPEs) ? appliedTPEs : []),
  ];
  const teamHeldTpes = (
    team && typeof team === 'object' && 'team' in team
      ? getTeamTpeList((team as TradeTeam).team)
      : getTeamTpeList(team as Record<string, unknown>)
  ) as TradeExceptionRecord[];

  const addTpe = (rawTpe: TradeExceptionRecord) => {
    const normalizedTpe = normalizeTpeForValidation(rawTpe);
    if (!normalizedTpe?.id) return;

    const existing = availableTpeMap.get(normalizedTpe.id);
    const mergedTpe = existing
      ? normalizeTpeForValidation({ ...existing, ...normalizedTpe })
      : normalizedTpe;

    if (!mergedTpe) return;

    mergedTpe.sourceRef =
      existing?.sourceRef || normalizedTpe.sourceRef || rawTpe;
    availableTpeMap.set(normalizedTpe.id, mergedTpe);
  };

  compatibilityTpes.forEach(addTpe);
  teamHeldTpes.forEach(addTpe);

  const tpeAttemptPlayers = (incomingPlayers || []).filter(
    (player) =>
      !isTwoWayTradePlayer(player) &&
      (player?.absorptionMode === 'TPE' || Boolean(player?.tpeId))
  );
  const usageMap = new Map<string, CanonicalTeamTpeUsageEntry>();
  const unresolvedPlayers: UnresolvedTpeUsage[] = [];

  tpeAttemptPlayers.forEach((player) => {
    const tpeId = player?.tpeId || null;
    if (!tpeId) {
      unresolvedPlayers.push({ player, tpeId: null, reason: 'missingTpeId' });
      return;
    }

    const resolvedTpe = availableTpeMap.get(tpeId) || null;
    if (!resolvedTpe) {
      unresolvedPlayers.push({ player, tpeId, reason: 'missingOnTeam' });
    }

    const existingUsage = usageMap.get(tpeId) || {
      tpeId,
      tpe: resolvedTpe,
      players: [],
      totalUsage: 0,
      source: 'playerAssignment' as const,
    };

    existingUsage.players.push(player);
    existingUsage.totalUsage += getPlayerSalary(player);
    existingUsage.tpe = existingUsage.tpe || resolvedTpe;
    usageMap.set(tpeId, existingUsage);
  });

  const hasEligibleIncomingPlayer = (incomingPlayers || []).some(
    (player) => !isTwoWayTradePlayer(player)
  );
  const shouldApplyCompatibilityUsage =
    (incomingPlayers || []).length === 0 || hasEligibleIncomingPlayer;

  compatibilityTpes.forEach((rawTpe) => {
    if (!shouldApplyCompatibilityUsage) return;
    const normalizedTpe = normalizeTpeForValidation(rawTpe);
    if (!normalizedTpe?.id || usageMap.has(normalizedTpe.id)) return;

    usageMap.set(normalizedTpe.id, {
      tpeId: normalizedTpe.id,
      tpe: availableTpeMap.get(normalizedTpe.id) || normalizedTpe,
      players: [],
      totalUsage: 0,
      source: 'compatibilityInput',
    });
  });

  return {
    availableTpes: Array.from(availableTpeMap.values()),
    usedTpes: Array.from(usageMap.values()),
    unresolvedPlayers: unresolvedPlayers.map((entry) => ({
      ...entry,
      player: entry.player || {
        name: getPlayerName(entry.player),
      },
    })),
    usesTpe: tpeAttemptPlayers.length > 0 || usageMap.size > 0,
  };
}
