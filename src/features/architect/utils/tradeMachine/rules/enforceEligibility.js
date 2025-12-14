import { validationFlags } from '@/config/validationFlags.js';

/**
 * Enforces player re-acquisition rules:
 * - Cannot reacquire a player within same season after trading them
 * - Cannot reacquire a waived player until after season + July 1
 */
export function enforceEligibility(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const { incomingPlayers = [] } = team;
  const violations = [];

  // Check re-acquisition restrictions
  incomingPlayers.forEach((player) => {
    // Check for traded players (support multiple property names)
    const lastTradedFromTeam = player.lastTradedFrom || player.lastTradedFromTeamId;
    if (lastTradedFromTeam === team.teamId) {
      const lastTradeDate = player.lastTradeDate
        ? new Date(player.lastTradeDate)
        : null;
      const tradeDate = tradeCtx.asOfDate
        ? new Date(tradeCtx.asOfDate)
        : new Date();

      // One year from trade date
      if (
        lastTradeDate &&
        tradeDate - lastTradeDate < 365 * 24 * 60 * 60 * 1000
      ) {
        violations.push(
          `Re-acquisition bar: Cannot reacquire ${player.name || 'player'} until one year after trading them`
        );
      }
    }

    // Check waiver history (support multiple property names)
    const wasWaivedByTeam = player.lastWaivedFrom || player.wasWaivedByTeamId;
    if (wasWaivedByTeam === team.teamId) {
      const waivedDate = player.waivedDate || player.contractEndDate ? new Date(player.waivedDate || player.contractEndDate) : null;
      const july1 = new Date(waivedDate?.getFullYear() + 1, 6, 1); // July is 6 in JS dates
      const tradeDate = tradeCtx.asOfDate
        ? new Date(tradeCtx.asOfDate)
        : new Date();

      if (waivedDate && tradeDate < july1) {
        violations.push(
          `Re-acquisition bar: Cannot reacquire ${player.name || 'player'} until July 1 after waiving them`
        );
      }
    }
  });

  violations.forEach((msg) => {
    if (validationFlags.eligibility === 'warn') {
      warn(msg);
    } else {
      reject(msg);
    }
  });

  return violations;
}

// Helper function for date comparison
// function _isWithinOneYear(date1, date2) {
//   return (
//     Math.abs(new Date(date1) - new Date(date2)) < 365 * 24 * 60 * 60 * 1000
//   );
// }
