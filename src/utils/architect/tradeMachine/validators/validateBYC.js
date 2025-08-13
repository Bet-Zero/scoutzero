import { BYC_PERCENT } from '@/utils/architect/cbaConstants.js';

/**
 * Validates Base Year Compensation (BYC) rules:
 * - For salary matching, outgoing value = max(previous salary, 50% new salary)
 * - Poison pill calculation for receiving team
 */
export function validateBYC(team, tradeCtx = {}) {
  const violations = [];
  const { sends = [], incomingPlayers = [] } = team;

  // Check each outgoing player with BYC status
  sends.forEach((player) => {
    if (player.isBYC) {
      const previousSalary = player.previousSalary || 0;
      const newSalary = player.newSalary || 0;
      const bycValue = Math.max(previousSalary, newSalary * BYC_PERCENT);

      // Verify the outgoing matching value is using BYC rules
      if (player.matchOutgoing !== Math.floor(bycValue)) {
        violations.push(
          `${player.name || 'Player'} BYC value incorrectly calculated`
        );
      }
    }
  });

  // Check each incoming BYC player
  incomingPlayers.forEach((player) => {
    if (player.isBYC) {
      const currentSalary = player.currentSalary || 0;

      // Verify the incoming matching value is using actual salary
      if (player.matchIncoming !== Math.floor(currentSalary)) {
        violations.push(
          `${player.name || 'Player'} incoming BYC value should use actual salary`
        );
      }
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0 ? 'BYC validation failed' : 'BYC validation passed',
    details: violations.join('; '),
  };
}
