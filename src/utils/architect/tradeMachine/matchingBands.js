/**
 * Salary matching band calculations for trade validation
 * Provides functions to calculate allowable incoming salary margins
 */

import { calculateAllowableIncoming } from '@/utils/architect/tradeHelpers.js';

/**
 * Calculates the allowable incoming salary margin for a team
 * @param {Object} params - Parameters for calculation
 * @param {string} params.team - Team identifier
 * @param {number} params.teamTotalSalary - Current team total salary
 * @param {number} params.secondApron - Second apron threshold
 * @param {boolean} params.isAtOrAboveSecondApron - Whether team is at/above second apron
 * @returns {number} The allowable incoming margin
 */
export function getAllowableIncomingMargin({
  team,
  teamTotalSalary = 0,
  secondApron = 0,
  isAtOrAboveSecondApron = false,
}) {
  // Second apron teams must match exactly (0% margin)
  if (isAtOrAboveSecondApron || teamTotalSalary >= secondApron) {
    return 0;
  }

  // For other teams, use the standard calculation from tradeHelpers
  // This handles under-cap, over-cap, and first apron teams appropriately
  return calculateAllowableIncoming(
    teamTotalSalary,
    0, // salaryOut - this will be added separately
    [], // incomingPlayers
    [], // tradeExceptions
    { secondApron }, // capSettings
    2025 // yearKey
  );
}