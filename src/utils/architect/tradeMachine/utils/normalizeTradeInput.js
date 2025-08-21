/**
 * Normalizes trade input data before validation
 * Ensures consistent data structures and handles missing/default values
 */

import { toNum, normalizeCaps } from './capUtils.js';
import { getMatchingValue } from './matchingValues.js';

/**
 * Normalizes a player object with consistent properties
 */
function normalizePlayer(player, yearKey) {
  if (!player) return null;

  return {
    ...player,
    name: player.name || player.display_name || 'Unknown Player',
    salary: toNum(player.salary || getMatchingValue(player, yearKey, false)),
    matchIncoming: toNum(player.matchIncoming),
    matchOutgoing: toNum(player.matchOutgoing),
    isTwoWay: !!player.isTwoWay,
    absorptionMode: player.absorptionMode || 'MATCH',
    signAndTrade: !!player.signAndTrade || !!player.isSignAndTrade,
    contractYears: toNum(player.contractYears || player.years),
    firstYearGuaranteed: player.firstYearGuaranteed !== false, // Default true
    tpeId: player.tpeId,
    fromTeamId: player.fromTeamId || player.originTeamId,
    toTeamId: player.toTeamId || player.tradeTo,
  };
}

/**
 * Normalizes a team object with consistent properties
 */
function normalizeTeam(team, { yearKey, capSettings }) {
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
      players: (raw.players || []).map((p) => normalizePlayer(p, yearKey)),
      twoWayPlayers: raw.twoWayPlayers || [],
      tradeExceptions: (raw.tradeExceptions || []).map((tpe) => ({
        ...tpe,
        amount: toNum(tpe.amount),
        remaining: toNum(tpe.remaining ?? tpe.amount),
      })),
    },
    sends: (team.sends || []).map((p) => normalizePlayer(p, yearKey)),
    picksOut: team.picksOut || [],
    cashSent: toNum(team.cashSent),
    hardCapped: !!team.hardCapped,
    appliedTPEs: (team.appliedTPEs || []).map((tpe) => ({
      ...tpe,
      amount: toNum(tpe.amount),
      remaining: toNum(tpe.remaining ?? tpe.amount),
    })),
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
}) {
  // Normalize cap settings
  const seasonKey = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
  const rawCaps =
    capProjections?.[seasonKey] || capProjections?.[currentYear] || {};
  const capSettings = normalizeCaps(rawCaps);
  const yearKey = currentYear;

  // Normalize teams and their components
  const normalizedTeams = (teams || [])
    .map((team) => normalizeTeam(team, { yearKey, capSettings }))
    .filter(Boolean);

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
