/**
 * Normalizes trade input data before validation
 * Ensures consistent data structures and handles missing/default values
 *
 * HISTORY:
 *  - Phase 66: Updated to use getTeamTpeList canonical accessor for TPE reads
 */

import { toNum, normalizeCaps } from './capUtils';
import { getMatchingValue } from './matchingValues';
import { getTeamTpeList } from '../../persistenceContracts/normalizeTeamTpe';

type NumericLike = number | string | null | undefined;

interface RawTradeInputPlayer {
  name?: string | null;
  bio?: {
    displayName?: string | null;
    [key: string]: unknown;
  } | null;
  salary?: NumericLike;
  matchIncoming?: NumericLike;
  matchOutgoing?: NumericLike;
  isTwoWay?: boolean;
  absorptionMode?: string | null;
  signAndTrade?: boolean;
  isSignAndTrade?: boolean;
  contractYears?: NumericLike;
  years?: NumericLike;
  firstYearGuaranteed?: boolean;
  tpeId?: string | null;
  fromTeamId?: string | null;
  originTeamId?: string | null;
  toTeamId?: string | null;
  tradeTo?: string | null;
  contract?: {
    salariesByYear?: Array<Record<string, unknown>> | null;
    [key: string]: unknown;
  } | null;
  primaryContract?: {
    salariesByYear?: Array<Record<string, unknown>> | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

interface NormalizedTradeInputPlayer extends RawTradeInputPlayer {
  name: string;
  salary: number;
  matchIncoming: number;
  matchOutgoing: number;
  isTwoWay: boolean;
  absorptionMode: string;
  signAndTrade: boolean;
  contractYears: number;
  firstYearGuaranteed: boolean;
  fromTeamId?: string | null;
  toTeamId?: string | null;
}

interface RawTradeException {
  amount?: NumericLike;
  remaining?: NumericLike;
  [key: string]: unknown;
}

interface NormalizedTradeException extends RawTradeException {
  amount: number;
  remaining: number;
}

interface RawTeamRecord {
  id?: string | number | null;
  teamId?: string | number | null;
  teamName?: string | null;
  name?: string | null;
  teamTotalSalary?: NumericLike;
  totalSalary?: NumericLike;
  projectedSalary?: NumericLike;
  payroll?: NumericLike;
  players?: unknown;
  twoWayPlayers?: unknown;
  hardCapped?: unknown;
  hardCapLevel?: unknown;
  totals?: {
    hardCapLevel?: unknown;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

interface RawTradeTeam {
  team?: RawTeamRecord | null;
  sends?: unknown;
  picksOut?: unknown;
  cashSent?: NumericLike;
  hardCapped?: unknown;
  hardCapLevel?: unknown;
  appliedTPEs?: unknown;
  [key: string]: unknown;
}

interface CapProjectionEntry {
  [key: string]: unknown;
}

type CapProjectionMap = Record<string | number, CapProjectionEntry | undefined>;

interface RawTradeContext {
  tradeDate?: string | null;
  [key: string]: unknown;
}

interface NormalizedTeamRecord extends RawTeamRecord {
  id: string | number | null | undefined;
  teamName: string;
  teamTotalSalary: number;
  projectedSalary: number;
  players: Array<NormalizedTradeInputPlayer | null>;
  twoWayPlayers: unknown;
  tradeExceptions: NormalizedTradeException[];
}

interface NormalizedTradeTeam extends RawTradeTeam {
  team: NormalizedTeamRecord;
  sends: Array<NormalizedTradeInputPlayer | null>;
  picksOut: unknown;
  cashSent: number;
  hardCapped: unknown;
  hardCapLevel: unknown;
  appliedTPEs: NormalizedTradeException[];
}

interface NormalizedTradeInputResult {
  teams: NormalizedTradeTeam[];
  capSettings: ReturnType<typeof normalizeCaps>;
  yearKey: number;
  tradeCtx: RawTradeContext & {
    tradeDate: string;
  };
}

interface NormalizeTradeInputParams {
  teams?: unknown;
  capProjections?: CapProjectionMap | null;
  currentYear: number;
  tradeCtx?: RawTradeContext;
}

/**
 * Normalizes a player object with consistent properties
 */
function normalizePlayer(
  player: RawTradeInputPlayer | null | undefined,
  yearKey: number
): NormalizedTradeInputPlayer | null {
  if (!player) return null;

  return {
    ...player,
    name: player.name || player.bio?.displayName || 'Unknown Player',
    salary: toNum(
      player.salary ||
        getMatchingValue(
          player as Parameters<typeof getMatchingValue>[0],
          yearKey,
          false
        )
    ),
    matchIncoming: toNum(player.matchIncoming),
    matchOutgoing: toNum(player.matchOutgoing),
    isTwoWay: !!player.isTwoWay,
    absorptionMode: player.absorptionMode || 'MATCH',
    signAndTrade: !!player.signAndTrade || !!player.isSignAndTrade,
    contractYears: toNum(player.contractYears || player.years),
    firstYearGuaranteed: player.firstYearGuaranteed !== false,
    tpeId: player.tpeId,
    fromTeamId: player.fromTeamId || player.originTeamId,
    toTeamId: player.toTeamId || player.tradeTo,
  };
}

/**
 * Normalizes a team object with consistent properties
 */
function normalizeTeam(
  team: RawTradeTeam | null | undefined,
  { yearKey }: { yearKey?: number } = {}
): NormalizedTradeTeam | null {
  if (!team?.team) return null;

  const raw = team.team;
  const base = toNum(
    raw.projectedSalary ?? raw.teamTotalSalary ?? raw.totalSalary ?? raw.payroll
  );

  return {
    ...team,
    team: {
      ...raw,
      id: raw.id || raw.teamId,
      teamName: raw.teamName || raw.name || 'Unknown Team',
      teamTotalSalary: toNum(raw.teamTotalSalary ?? raw.totalSalary ?? base),
      projectedSalary: toNum(raw.projectedSalary ?? base),
      players: ((raw.players || []) as Array<RawTradeInputPlayer | null>).map(
        (player) => normalizePlayer(player, yearKey as number)
      ),
      twoWayPlayers: raw.twoWayPlayers || [],
      // Phase 66: Use canonical accessor for TPE reads
      tradeExceptions: getTeamTpeList(raw).map((tpe) => ({
        ...tpe,
        amount: toNum((tpe as RawTradeException).amount),
        remaining: toNum(
          (tpe as RawTradeException).remaining ??
            (tpe as RawTradeException).amount
        ),
      })),
    },
    sends: ((team.sends || []) as Array<RawTradeInputPlayer | null>).map(
      (player) => normalizePlayer(player, yearKey as number)
    ),
    picksOut: team.picksOut || [],
    cashSent: toNum(team.cashSent),
    // Preserve legacy hard-cap markers (boolean, numeric 1/2, typed strings).
    hardCapped:
      team.hardCapped !== undefined ? team.hardCapped : raw.hardCapped ?? false,
    hardCapLevel:
      team.hardCapLevel ||
      raw.hardCapLevel ||
      raw.totals?.hardCapLevel ||
      null,
    appliedTPEs: ((team.appliedTPEs || []) as Array<RawTradeException>).map(
      (tpe) => ({
        ...tpe,
        amount: toNum(tpe.amount),
        remaining: toNum(tpe.remaining ?? tpe.amount),
      })
    ),
  };
}

/**
 * Main entry point for normalizing trade input
 */
export function normalizeTradeInput({
  teams,
  capProjections,
  currentYear,
  tradeCtx = {},
}: NormalizeTradeInputParams): NormalizedTradeInputResult {
  // Normalize cap settings
  const seasonKey = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
  const rawCaps =
    capProjections?.[seasonKey] || capProjections?.[currentYear] || {};
  const capSettings = normalizeCaps(rawCaps);
  const yearKey = currentYear;

  // Normalize teams and their components
  const normalizedTeams = ((teams || []) as Array<RawTradeTeam | null>)
    .map((team) => normalizeTeam(team, { yearKey }))
    .filter((team): team is NormalizedTradeTeam => Boolean(team));

  return {
    teams: normalizedTeams,
    capSettings,
    yearKey,
    tradeCtx: {
      ...tradeCtx,
      tradeDate: tradeCtx.tradeDate || new Date().toISOString(),
    },
  };
}
