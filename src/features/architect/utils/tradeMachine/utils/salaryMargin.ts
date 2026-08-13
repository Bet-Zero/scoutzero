/**
 * Salary margin utilities for trade validation
 * Handles calculations for allowable incoming salary
 */

import { calculateAllowableIncoming } from '@/features/architect/utils/tradeHelpers';
import {
  getTeamObject,
  isSecondApronTeam,
  resolvePayroll,
  toNum,
} from './capUtils';

type NumericLike = number | string | null | undefined;

interface SalaryMarginIncomingPlayer {
  absorptionMode?: 'TPE' | 'FA_EXCEPTION' | string | null;
  matchIncoming?: NumericLike;
  tpeAmount?: NumericLike;
  [key: string]: unknown;
}

interface SalaryMarginCapSettings {
  salaryCap?: NumericLike;
  firstApron?: NumericLike;
  secondApron?: NumericLike;
  [key: string]: unknown;
}

interface SalaryMarginPostTradeStatus {
  projectedSalary?: NumericLike;
  isAtOrAboveFirstApron?: boolean;
  isAtOrAboveSecondApron?: boolean;
  [key: string]: unknown;
}

interface SalaryMarginPreTradeStatus {
  projectedSalary?: NumericLike;
  [key: string]: unknown;
}

interface SalaryMarginContext {
  capSettings?: SalaryMarginCapSettings | null;
  yearKey?: number | string | null;
  [key: string]: unknown;
}

interface SalaryMarginTeamData {
  id?: string;
  name?: string;
  nickname?: string;
  salaryOut?: NumericLike;
  teamTotalSalary?: NumericLike;
  totalSalary?: NumericLike;
  projectedSalary?: NumericLike;
  payroll?: NumericLike;
  incomingPlayers?: SalaryMarginIncomingPlayer[] | null;
  postTradeStatus?: SalaryMarginPostTradeStatus | null;
  preTradeStatus?: SalaryMarginPreTradeStatus | null;
  context?: SalaryMarginContext | null;
  [key: string]: unknown;
}

interface SalaryMarginTeamWrapper {
  team?: SalaryMarginTeamData | null;
  sourceTeam?: SalaryMarginTeamData | null;
  ctx?: SalaryMarginTeamData | null;
  [key: string]: unknown;
}

type SalaryMarginTeamLike =
  | SalaryMarginTeamData
  | SalaryMarginTeamWrapper
  | null
  | undefined;

/**
 * Calculates the allowable incoming salary margin for a team
 * @param teamLike - Team or team-containing object
 * @returns The allowable incoming margin
 */
export function getAllowableIncomingMargin(
  teamLike: SalaryMarginTeamLike
): number {
  const team = getTeamObject(teamLike) as SalaryMarginTeamData | null;
  const capSettings = team?.context?.capSettings || {};
  const yearKey = team?.context?.yearKey;

  const secondApron = toNum(capSettings.secondApron);
  const salaryCap = toNum(capSettings.salaryCap);
  const payroll = resolvePayroll(team);

  // Apron clamp
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  const isAboveSecondApron =
    team?.postTradeStatus?.isAtOrAboveSecondApron ??
    isSecondApronTeam({ totalSalary: payroll }, capSettings);
  if (isAboveSecondApron || team?.postTradeStatus?.isAtOrAboveFirstApron) {
    console.log('[getAllowableIncomingMargin]', {
      team: team?.nickname || team?.name || team?.id,
      teamTotalSalary: payroll,
      secondApron,
      isAboveSecondApron: true,
      marginAboutToReturn: 0,
    });
    return 0;
  }

  // Below-cap = cap room
  if (salaryCap && payroll < salaryCap) {
    const margin = Math.max(0, salaryCap - payroll);
    console.log('[getAllowableIncomingMargin]', {
      team: team?.nickname || team?.name || team?.id,
      teamTotalSalary: payroll,
      secondApron,
      isAtOrAboveSecondApron: false,
      marginAboutToReturn: margin,
    });
    return margin;
  }

  const incomingPlayers = team?.incomingPlayers || [];

  // Over-cap bands WITHOUT pooled TPEs
  const baseNoTPE = calculateAllowableIncoming(
    payroll,
    team?.salaryOut || 0,
    incomingPlayers,
    /* tradeExceptions */ [], // stop pooling all TPEs
    capSettings,
    yearKey
  ) as number;

  // Add only actually USED buckets
  const usedTPE = incomingPlayers
    .filter((player) => player.absorptionMode === 'TPE')
    .reduce(
      (sum, player) =>
        sum + toNum(player.matchIncoming ?? player.tpeAmount ?? 0),
      0
    );

  const faUsage = incomingPlayers
    .filter((player) => player.absorptionMode === 'FA_EXCEPTION')
    .reduce((sum, player) => sum + toNum(player.matchIncoming ?? 0), 0);

  const margin = baseNoTPE + usedTPE + faUsage;

  console.log('[getAllowableIncomingMargin]', {
    team: team?.nickname || team?.name || team?.id,
    teamTotalSalary: payroll,
    secondApron,
    isAtOrAboveSecondApron: false,
    marginAboutToReturn: margin,
  });
  return margin;
}

/**
 * Calculates the maximum incoming salary a team can receive in a trade
 * @param team - The team object
 * @returns The maximum incoming salary ceiling
 */
export function getIncomingCeilingForTeam(
  team: SalaryMarginTeamData | null | undefined
): number {
  const {
    context,
    salaryOut = 0,
    teamTotalSalary = 0,
  } = team as SalaryMarginTeamData;
  const capSettings = context?.capSettings ?? {};
  const { salaryCap = 0, firstApron = 0, secondApron = 0 } = capSettings;

  // Teams above second apron can only take back equal salary
  // Per CBA Art VII Sec 2(f): team is "Second Apron Team" only if salary > secondApron (strict)
  if (isSecondApronTeam({ totalSalary: teamTotalSalary }, { secondApron })) {
    return salaryOut as number;
  }

  // Teams above first apron limited to 100% matching
  if ((teamTotalSalary as number) >= (firstApron as number)) {
    return salaryOut as number;
  }

  // Under-cap teams can take salary up to the cap
  if ((teamTotalSalary as number) < (salaryCap as number)) {
    return (salaryCap as number) - (teamTotalSalary as number);
  }

  // Over-cap teams use standard bands - return the total allowable ceiling
  const margin = getAllowableIncomingMargin(team);
  return (salaryOut as number) + margin; // This gives us the total allowable incoming amount
}
