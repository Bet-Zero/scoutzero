import {
  hasFullNTC,
  destinationRequiresLimitedNTCConsent,
  birdRightsVetoApplies,
  requiresConsent,
  hasConsent,
} from '@/utils/architect/consentUtils.js';
import { validationFlags } from '@/config/validationFlags.js';

export function validateConsent(team, tradeCtx = {}) {
  const violations = [];

  // For 2-team trades, we need to determine the destination team
  // The normalized team data should include the destination information
  const { teams = [] } = tradeCtx;

  // Check each outgoing player
  (team.sends || []).forEach((player) => {
    // Determine destination team ID
    let destTeamId = null;

    // Method 1: Try to get from trade context teams array
    if (teams.length === 2) {
      // For 2-team trades, destination is the other team
      const otherTeam = teams.find((t) => t.teamId !== team.teamId);
      if (otherTeam) {
        destTeamId = otherTeam.teamId;
      }
    } else if (teams.length > 2) {
      // For multi-team trades, this is more complex
      // For now, we'll need the trade structure to specify destinations
      destTeamId = player.destTeamId || player.toTeamId;
    }

    // Method 2: Use team name as fallback (for the test cases)
    if (!destTeamId && teams.length === 2) {
      const currentTeamName = team.teamName || team.team?.teamName;
      const otherTeam = teams.find(
        (t) => (t.teamName || t.team?.teamName) !== currentTeamName
      );
      if (otherTeam) {
        destTeamId = otherTeam.teamName || otherTeam.team?.teamName;
      }
    }

    // Full no-trade clause
    if (hasFullNTC(player) && !hasConsent(player)) {
      violations.push(
        `${player.name || 'Player'} has a full no-trade clause and must consent`
      );
    }

    // Limited no-trade clause
    if (
      destTeamId &&
      destinationRequiresLimitedNTCConsent(player, destTeamId) &&
      !hasConsent(player)
    ) {
      violations.push(
        `${player.name || 'Player'} has not waived their limited no-trade clause for ${destTeamId}`
      );
    }

    // Bird rights one-year deal veto
    if (
      destTeamId &&
      birdRightsVetoApplies(player, destTeamId) &&
      !hasConsent(player)
    ) {
      violations.push(
        `${player.name || 'Player'} has Bird rights veto power and must consent`
      );
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Player consent required'
      : 'Player consent validated',
    details: violations.join('; '),
  };
}

export function enforceConsent(
  team,
  { warn = () => {}, reject = () => {} } = {}
) {
  const violations = [];
  const enforcement = validationFlags.consent;

      players: (team.sends || []).map((p) => p.name),
    });
  }

  (team.sends || []).forEach((player) => {
    if (requiresConsent(player, team.team?.id) && !hasConsent(player)) {
      const msg = `${player.name || 'Player'} must consent to trade`;
      violations.push(msg);
      if (enforcement === 'warn') {
        warn(msg);
      } else {
        reject(msg);
      }
    }
  });

  return violations;
}
