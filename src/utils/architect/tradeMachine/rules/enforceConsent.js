import { validationFlags } from '@/config/validationFlags.js';

export function enforceConsent(
  team,
  context = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const { outgoingPlayers = [], incomingPlayers = [] } = team;
  const enforcement = validationFlags.consent || 'error';

      players: outgoingPlayers.map((p) => p.name),
    });
  }

  const violations = [];

  // Check outgoing players for consent issues
  outgoingPlayers.forEach((player) => {
    let violationMsg = null;

    // Full no-trade clause
    if (
      (player.hasFullNTC || player.noTradeClause) &&
      !player.consentGranted &&
      !player.hasConsented
    ) {
      violationMsg = 'Player NTC — consent required';
    }

    // Limited no-trade clause
    if (player.limitedNTCTeamIds && Array.isArray(player.limitedNTCTeamIds)) {
      // If player is being traded to a team NOT on their approved list
      if (
        player.tradeTo &&
        !player.limitedNTCTeamIds.includes(player.tradeTo) &&
        !player.consentGranted
      ) {
        violationMsg = 'Player NTC — consent required';
      }
    }

    // Bird rights veto (1-year Bird deals)
    if (player.onOneYearBirdDeal && !player.consentGranted) {
      violationMsg = '1-yr Bird veto — consent required';
    }

    if (violationMsg) {
      violations.push(violationMsg);
      if (enforcement === 'warn') {
        warn(violationMsg);
      } else {
        reject(violationMsg);
      }
    }
  });

  // Check incoming players for consent issues
  incomingPlayers.forEach((player) => {
    let violationMsg = null;

    // Full no-trade clause
    if (
      (player.hasFullNTC || player.hasFullNoTrade) &&
      !player.hasTradeConsent &&
      !player.consentGranted
    ) {
      violationMsg = `${player.name} has not waived their no-trade clause`;
    }

    // Limited no-trade clause
    if (player.limitedNTCTeamIds && Array.isArray(player.limitedNTCTeamIds)) {
      if (
        !player.limitedNTCTeamIds.includes(team.teamId) &&
        !player.hasTradeConsent &&
        !player.consentGranted
      ) {
        violationMsg = `${player.name} has not approved a trade to ${team.teamName}`;
      }
    }

    // Bird rights veto
    if (
      (player.hasBirdRightsVeto || player.onOneYearBirdDeal) &&
      !player.hasTradeConsent &&
      !player.consentGranted
    ) {
      violationMsg = `${player.name} has not waived their Bird rights veto`;
    }

    if (violationMsg) {
      violations.push(violationMsg);
      if (enforcement === 'warn') {
        warn(violationMsg);
      } else {
        reject(violationMsg);
      }
    }
  });

  return violations;
}
