import debug from '../debug.js';
import { validationFlags } from '@/config/validationFlags.js';

export function enforceConsent(
  team,
  { warn = () => {}, reject = () => {} } = {}
) {
  const { outgoingPlayers = [], incomingPlayers = [] } = team;
  const enforcement = validationFlags.consent || 'error';

  if (debug.enabled) {
    debug.log(`✋ Trade Consent – ${team.teamName}`, {
      players: outgoingPlayers.map((p) => p.name),
    });
  }

  const violations = [
    ...outgoingPlayers.filter((player) => {
      // Full no-trade clause
      if (player.noTradeClause && !player.hasConsented) {
        return true;
      }

      // Limited no-trade
      if (
        player.limitedNoTrade &&
        Array.isArray(player.approvedTeams) &&
        !player.approvedTeams.includes(team.team?.id)
      ) {
        return true;
      }

      // Bird rights veto
      if (
        player.hasBirdRights &&
        player.wouldLoseBirdRights &&
        !player.hasConsented
      ) {
        return true;
      }

      return false;
    }),
    ...incomingPlayers.filter((player) => {
      // Check full no-trade clause
      if (player.hasFullNoTrade && !player.hasTradeConsent) {
        return `${player.name} has not waived their no-trade clause`;
      }

      // Check limited no-trade clause
      if (
        player.hasLimitedNoTrade &&
        player.approvedTeams &&
        !player.approvedTeams.includes(team.teamId) &&
        !player.hasTradeConsent
      ) {
        return `${player.name} has not approved a trade to ${team.teamName}`;
      }

      // Check Bird rights veto
      if (player.hasBirdRightsVeto && !player.hasTradeConsent) {
        return `${player.name} has not waived their Bird rights veto`;
      }

      return false;
    }),
  ].filter(Boolean);

  violations.forEach((violation) => {
    const msg = `${violation}`;
    if (enforcement === 'warn') {
      warn(msg);
    } else {
      reject(msg);
    }
  });

  return violations;
}
