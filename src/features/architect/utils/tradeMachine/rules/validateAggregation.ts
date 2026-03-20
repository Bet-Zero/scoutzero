import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers.js';
import { isSecondApronTeam } from '../utils/capUtils.js';
import {
  SECOND_APRON_AGGREGATION_UP_BLOCKED,
  SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED,
} from '@/features/architect/utils/tradeMachine/constants/secondApronMessages.js';

interface AggregationPlayer {
  salary?: number;
  fromTeamId?: string | number | null;
  [key: string]: unknown;
}

interface AggregationCapSettings {
  secondApron?: number | string | null;
  [key: string]: unknown;
}

interface AggregationContext {
  yearKey?: number | string;
  capSettings?: AggregationCapSettings | null;
  [key: string]: unknown;
}

interface AggregationTeamData {
  totalSalary?: number | string | null;
  teamTotalSalary?: number | string | null;
  [key: string]: unknown;
}

interface AggregationTeam {
  postTradeStatus?: {
    isAtOrAboveSecondApron?: boolean;
  };
  outgoingPlayers?: AggregationPlayer[];
  sends?: AggregationPlayer[];
  incomingPlayers?: AggregationPlayer[];
  teamTotalSalary?: number | string | null;
  team?: AggregationTeamData | null;
  context?: AggregationContext | null;
  [key: string]: unknown;
}

interface AggregationValidationResult {
  passed: boolean;
  violations: string[];
  message: string;
  details: string;
  calculations?: {
    outgoingSalaries: number[];
    incomingSalaries: number[];
  };
}

/**
 * Validates salary aggregation rules:
 * - Second apron teams cannot aggregate multiple smaller salaries to acquire a larger salary
 * - Each incoming salary must be matched by a single outgoing salary for second apron teams
 *
 * NOTE: Salary mismatch (incoming > outgoing) is NOT checked here -
 * that's the responsibility of validateSalaryMatching to avoid duplicate messages.
 */
export function validateAggregation(
  team: AggregationTeam,
  context: AggregationContext | null = {}
): AggregationValidationResult {
  const {
    postTradeStatus,
    outgoingPlayers = [],
    sends = [],
    incomingPlayers = [],
    teamTotalSalary = 0,
  } = team;
  const resolvedContext = context || team.context || {};
  const yearKey = resolvedContext.yearKey;
  const capSettings = resolvedContext.capSettings ?? {};

  // Calculate if team is ABOVE second apron
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  const secondApron = capSettings.secondApron || 190000000;
  const isAboveSecondApron =
    postTradeStatus?.isAtOrAboveSecondApron ||
    isSecondApronTeam({ totalSalary: teamTotalSalary }, capSettings) ||
    isSecondApronTeam(team.team, capSettings);

  // Only apply to second apron teams
  if (!isAboveSecondApron) {
    return {
      passed: true,
      violations: [],
      message: 'Aggregation valid (not a second apron team)',
      details: `Team salary ${teamTotalSalary?.toLocaleString()} is below second apron ${secondApron.toLocaleString()}`,
    };
  }

  // Get outgoing salaries sorted in descending order
  const outgoingSrc = outgoingPlayers.length ? outgoingPlayers : sends;
  const outgoingSalaries = outgoingSrc
    .map((player) => getSalaryForYear(player, yearKey))
    .filter((salary) => Number.isFinite(salary) && salary > 0)
    .sort((a, b) => b - a);

  // Get incoming salaries sorted in descending order
  const incomingSalaries = incomingPlayers
    .map((player) => getSalaryForYear(player, yearKey))
    .filter((salary) => Number.isFinite(salary) && salary > 0)
    .sort((a, b) => b - a);

  const violations: string[] = [];

  // CBA FIX: Aggregation violation only when combining smaller salaries to get HIGHER-paid player
  // Multi-player trades for similar-value returns are allowed
  if (outgoingSalaries.length > 1 && incomingSalaries.length > 0) {
    // Find max outgoing salary (the largest player being traded away)
    const maxOutgoing =
      outgoingSalaries.length > 0 ? Math.max(...outgoingSalaries) : 0;

    // Check if ANY incoming player is higher than the max outgoing
    const aggregatingUp = incomingSalaries.some((salary) => salary > maxOutgoing);

    if (aggregatingUp) {
      violations.push(SECOND_APRON_AGGREGATION_UP_BLOCKED);
    }
  }

  // Check for receiving from multiple teams (incoming aggregation)
  if (incomingPlayers.length > 1) {
    // Check if incoming players are from different teams
    const incomingTeams = new Set(
      incomingPlayers.map((player) => player.fromTeamId).filter((id) => id)
    );
    if (incomingTeams.size > 1) {
      violations.push(SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED);
    }
  }

  // NOTE: Salary mismatch check removed - validateSalaryMatching is the SSOT for this

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0 ? 'Aggregation violation' : 'Valid aggregation',
    details: violations.join('; '),
    calculations: {
      outgoingSalaries,
      incomingSalaries,
    },
  };
}
