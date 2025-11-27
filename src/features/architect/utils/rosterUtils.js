import { MAX_TWO_WAY_PLAYERS as TWOWAY_MAX } from './cbaConstants.js';

export function getTwoWayCount(team) {
  if (!team) return 0;
  const roster = team.twoWayPlayers?.length || 0;
  const flagged = (team.players || []).filter((p) => p.isTwoWay).length;
  return roster + flagged;
}

function countStandardContracts(team) {
  return team?.players?.filter((p) => !p.isTwoWay).length ?? 0;
}

const CBA_LIMITS = { TWOWAY_MAX };

export function passesRosterWindow(
  teamPostTrade,
  { require14to15 = true, maxTwoWays = CBA_LIMITS.TWOWAY_MAX } = {}
) {
  const standard = countStandardContracts(teamPostTrade);
  const twoWays = getTwoWayCount(teamPostTrade);
  const reasons = [];
  if (require14to15 && !(standard >= 14 && standard <= 15)) {
    reasons.push('Standard roster must be 14–15');
  }
  if (twoWays > maxTwoWays) {
    reasons.push(`Two-way slots exceeded (${twoWays}/${maxTwoWays})`);
  }
  return { ok: reasons.length === 0, reasons, standard, twoWays };
}
