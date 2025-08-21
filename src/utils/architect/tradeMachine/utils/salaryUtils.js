import { getApronStatus } from '@/utils/architect/tradeHelpers.js';

/**
 * Computes final matching values for trade validation accounting for:
 * - Base Year Compensation (BYC)
 * - Trade kickers
 * - Poison pill averaging
 */
export function computeMatchingValues({ teams, yearKey }) {
  teams.forEach((team) => {
    (team.sends || []).forEach((player) => {
      const current =
        player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
      const newSalary = player.newSalary || 0;
      const previous = player.previousSalary || 0;
      const kicker = player.tradeKicker || 0;
      const remainingYears = player.remainingGuaranteedYears || 0;

      // Calculate outgoing matching value
      if (player.isBYC) {
        // BYC outgoing = max(50% of new salary, prior salary)
        const bycValue = Math.max(newSalary * 0.5, previous);
        player.matchOutgoing = bycValue;
      } else {
        player.matchOutgoing = current;
      }

      // Calculate incoming matching value with trade kicker
      if (kicker > 0 && remainingYears > 0) {
        // Prorate kicker based on remaining guaranteed years
        const kickerAmount = (current * kicker) / remainingYears;
        player.matchIncoming = current + kickerAmount;
      } else {
        player.matchIncoming = current;
      }

      // Handle poison pill contracts (salary spikes)
      if (player.extensionYears?.length) {
        const futureTotal = player.extensionYears.reduce(
          (sum, yr) => sum + yr.salary,
          0
        );
        const averageSalary =
          (current + futureTotal) / (1 + player.extensionYears.length);
        player.matchIncoming = Math.max(player.matchIncoming, averageSalary);
      }
    });
  });
}

export function getIncomingCeilingForTeam(team) {
  if (!team || !team.sends) return 0;

  const outgoingTotal = team.sends.reduce(
    (sum, p) => sum + (p.matchOutgoing || 0),
    0
  );

  // Teams below cap can take back any amount
  if (!team.team?.isOverCap) {
    return Number.MAX_SAFE_INTEGER;
  }

  // Second apron teams limited to 100%
  if (team.team?.isOverSecondApron) {
    return outgoingTotal;
  }

  // First apron teams limited to 110%
  if (team.team?.isOverFirstApron) {
    return outgoingTotal * 1.1;
  }

  // Standard over-cap rules: 125% + 100k
  return outgoingTotal * 1.25 + 100000;
}
