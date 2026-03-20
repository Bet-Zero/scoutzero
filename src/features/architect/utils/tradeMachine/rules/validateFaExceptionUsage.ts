import { getApronStatus, getSalaryForYear } from '../../tradeHelpers.js';
import { getTeamFaExceptionBuckets } from '../../faExceptionUtils.js';

type NumericLike = number | string | null | undefined;

type FaExceptionBucket = {
  type?: unknown;
  remaining?: NumericLike;
  [key: string]: unknown;
};

type FaExceptionIncomingPlayer = {
  absorptionMode?: string | null;
  bucketType?: unknown;
  matchIncoming?: NumericLike;
  salary?: NumericLike;
  [key: string]: unknown;
};

type FaExceptionTeamData = {
  faExceptionBuckets?: FaExceptionBucket[] | null;
  hardCapFirstApron?: {
    active?: boolean;
    year?: number | string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type FaExceptionValidationContext = {
  yearKey?: number | string;
  capSettings?: {
    firstApron?: NumericLike;
    secondApron?: NumericLike;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type FaExceptionValidationTeam = {
  team: FaExceptionTeamData;
  teamTotalSalary?: NumericLike;
  projectedSalary?: NumericLike;
  incomingPlayers?: FaExceptionIncomingPlayer[] | null;
  outgoingPlayers?: Array<Record<string, unknown>> | null;
  salaryOut?: NumericLike;
  notes?: string[] | null;
  context?: FaExceptionValidationContext | null;
  [key: string]: unknown;
};

export function validateFaExceptionUsage(
  team: FaExceptionValidationTeam,
  _context?: FaExceptionValidationContext | null
): string[] {
  const violations: string[] = [];
  const {
    teamTotalSalary = 0,
    incomingPlayers: rawIncomingPlayers = [],
    context: rawContext = null,
  } = team;
  const context = rawContext || {};
  const capSettings = context.capSettings || {};
  const incomingPlayers = rawIncomingPlayers || [];
  const resolveIncomingTradeSalary = (player: FaExceptionIncomingPlayer) =>
    Number(
      player?.matchIncoming ??
        player?.salary ??
        getSalaryForYear(player, context.yearKey) ??
        0
    );

  // Get FA Exception buckets
  const buckets = getTeamFaExceptionBuckets(
    (team.team || {}) as Parameters<typeof getTeamFaExceptionBuckets>[0]
  );

  // Check if team is above first apron (cannot use FA exceptions)
  const apronStatus = getApronStatus(Number(teamTotalSalary || 0), capSettings);
  if (apronStatus.includes('1st Apron') || apronStatus.includes('2nd Apron')) {
    const hasUsage = incomingPlayers.some(
      (player) => player.absorptionMode === 'FA_EXCEPTION'
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
    const projectedSalary = Number(team.projectedSalary || teamTotalSalary);
    if (projectedSalary >= Number(capSettings.firstApron || 0)) {
      const hasUsage = incomingPlayers.some(
        (player) => player.absorptionMode === 'FA_EXCEPTION'
      );
      if (hasUsage) {
        violations.push(
          'Trade would exceed First Apron with FA Exception usage'
        );
      }
    } else {
      // Check for outgoing salary (both salaryOut and outgoingPlayers)
      const hasOutgoingSalary =
        Number(team.salaryOut || 0) > 0 || (team.outgoingPlayers || []).length > 0;

      // Auto-select FA exception for eligible players (if no absorptionMode is set)
      incomingPlayers.forEach((player) => {
        if (
          !player.absorptionMode &&
          buckets.length > 0 &&
          !hasOutgoingSalary
        ) {
          // Auto-select the first available bucket
          const availableBucket = buckets.find(
            (bucket) =>
              Number(bucket?.remaining || 0) >= resolveIncomingTradeSalary(player)
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

          const bucket = buckets.find((candidate) => candidate.type === bucketType);
          const incomingTradeSalary = resolveIncomingTradeSalary(player);
          if (!bucket) {
            violations.push('No available FA exception found');
            return;
          }

          if (incomingTradeSalary > Number(bucket.remaining || 0)) {
            violations.push('Insufficient FA Exception balance');
            return;
          }

          // Update remaining amount if valid
          bucket.remaining = Number(bucket.remaining || 0) - incomingTradeSalary;

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
            'Team hard-capped at first apron due to FA exception usage'
          );
        }
      });
    }
  }

  return violations; // Return array for standalone usage
}
