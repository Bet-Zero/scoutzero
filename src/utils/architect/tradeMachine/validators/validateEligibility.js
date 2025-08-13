import { validationFlags } from '@/config/validationFlags.js';
import debug from '../debug.js';

export function validateEligibility(team, tradeCtx = {}) {
  const violations = [];
  const { asOfDate = new Date().toISOString() } = tradeCtx;
  const tradeDate = new Date(asOfDate);

  // Check each incoming player for reacquisition restrictions
  (team.incomingPlayers || []).forEach((player) => {
    // Check one-year reacquisition rule
    if (player.lastTradedFrom === team.teamId) {
      const lastTradeDate = new Date(player.lastTradedDate);
      const daysSinceDeparture =
        (tradeDate - lastTradeDate) / (1000 * 60 * 60 * 24);

      if (daysSinceDeparture < 365) {
        violations.push(
          `Cannot reacquire ${player.name || 'player'} within one year of trade (${Math.ceil(
            365 - daysSinceDeparture
          )} days remaining)`
        );
      }
    }

    // Check waived player reacquisition rule
    if (player.waivedBy === team.teamId) {
      const waivedDate = new Date(player.waivedDate);
      const contractEndYear =
        player.contractEndYear || waivedDate.getFullYear();
      const julyFirst = new Date(contractEndYear, 6, 1); // Month is 0-based

      if (tradeDate < julyFirst) {
        violations.push(
          `Cannot reacquire ${player.name || 'player'} until July 1, ${contractEndYear} (waiver restriction)`
        );
      }
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Player eligibility restrictions in effect'
      : 'Player eligibility validated',
    details: violations.join('; '),
  };
}

export function enforceEligibility(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const violations = [];
  const enforcement = validationFlags.eligibility;

  if (debug.enabled) {
    debug.log(`🚫 Trade Eligibility – ${team.teamName}`, {
      players: (team.incomingPlayers || []).map((p) => p.name),
    });
  }

  // Get violations from validator
  const result = validateEligibility(team, tradeCtx);
  violations.push(...result.violations);

  // Handle enforcement based on validation flag
  violations.forEach((msg) => {
    if (enforcement === 'warn') {
      warn(msg);
    } else {
      reject(msg);
    }
  });

  return violations;
}
