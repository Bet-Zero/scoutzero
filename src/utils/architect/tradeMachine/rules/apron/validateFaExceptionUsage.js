import { getApronStatus } from '../../tradeHelpers.js';
import { getTeamFaExceptionBuckets } from '../../faExceptionUtils.js';

export function validateFaExceptionUsage(team) {
  const violations = [];
  const { teamTotalSalary = 0, incomingPlayers = [], context = {} } = team;
  const { capSettings = {} } = context;

  // Get FA Exception buckets
  const buckets = getTeamFaExceptionBuckets(team.team || {});

  // Check if team is above first apron (cannot use FA exceptions)
  const apronStatus = getApronStatus(teamTotalSalary, capSettings);
  if (apronStatus.includes('1st Apron') || apronStatus.includes('2nd Apron')) {
    const hasUsage = incomingPlayers.some(
      (p) => p.absorptionMode === 'FA_EXCEPTION'
    );
    if (hasUsage) {
      if (apronStatus.includes('2nd Apron')) {
        violations.push('Second Apron teams cannot use FA Exceptions');
      } else {
        violations.push('First Apron teams cannot use FA Exceptions');
      }
    }
  } else {
    // Check post-trade salary doesn't exceed first apron
    const projectedSalary = team.projectedSalary || teamTotalSalary;
    if (projectedSalary >= (capSettings.firstApron || 0)) {
      const hasUsage = incomingPlayers.some(
        (p) => p.absorptionMode === 'FA_EXCEPTION'
      );
      if (hasUsage) {
        violations.push(
          'Trade would exceed First Apron with FA Exception usage'
        );
      }
    } else {
      // Check for outgoing salary (both salaryOut and outgoingPlayers)
      const hasOutgoingSalary =
        (team.salaryOut || 0) > 0 || (team.outgoingPlayers || []).length > 0;

      // Auto-select FA exception for eligible players (if no absorptionMode is set)
      incomingPlayers.forEach((player) => {
        if (
          !player.absorptionMode &&
          buckets.length > 0 &&
          !hasOutgoingSalary
        ) {
          // Auto-select the first available bucket
          const availableBucket = buckets.find(
            (b) => (b.remaining || 0) >= (player.matchIncoming || 0)
          );
          if (availableBucket) {
            player.absorptionMode = 'FA_EXCEPTION';
            player.bucketType = availableBucket.type;
          }
        }
      });

      // Check each incoming player using FA Exception
      incomingPlayers.forEach((player) => {
        if (player.absorptionMode === 'FA_EXCEPTION') {
          // Check for aggregation with outgoing salary
          if (hasOutgoingSalary) {
            violations.push('Cannot combine FA Exception with outgoing salary');
            return;
          }

          // Check bucket type
          const bucketType = player.bucketType;
          if (Array.isArray(bucketType)) {
            violations.push('Cannot combine FA Exception buckets');
            return;
          }

          const bucket = buckets.find((b) => b.type === bucketType);
          if (!bucket) {
            violations.push('No available FA exception found');
            return;
          }

          if (player.matchIncoming > (bucket.remaining || 0)) {
            violations.push('Insufficient FA Exception balance');
            return;
          }

          // Update remaining amount if valid
          bucket.remaining = (bucket.remaining || 0) - player.matchIncoming;

          // Mark team as hard-capped at first apron
          if (!team.team.hardCapFirstApron) {
            team.team.hardCapFirstApron = {
              active: true,
              year: context.yearKey,
            };
          }

          // Add note about hard cap
          if (!team.notes) team.notes = [];
          team.notes.push(
            `Team hard-capped at first apron due to FA exception usage`
          );
        }
      });
    }
  }

  return violations; // Return array for standalone usage
}
