import { useMemo } from 'react';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
import { getTeamColors } from '@/shared/utils/formatting';
import {
  computeTeamCapTotals,
  warnOnTotalsDivergence,
} from '@/features/architect/utils/capTotals';
import {
  normalizeYearInput,
  getCapHitForSeason,
} from '@/features/architect/utils/tradeMachine/utils/seasonUtils';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import { getTeamSnapshot } from '@/features/architect/hooks/useTradeMachineSnapshot';
import { toSeasonKey } from '@/features/architect/utils/seasonUtils';
import { getTeamFaExceptionBuckets } from '@/features/architect/utils/faExceptionUtils';
import { isTwoWayTradePlayer } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import {
  toPlayerTeamOption,
  toEntitlementTeamOption,
} from './TradeTeamCard.helpers';
import type {
  UnknownRecord,
  PlayerLike,
  EntitlementLike,
  TeamLike,
  TeamOptionLike,
  TeamTradeException,
  ValidationResultLike,
} from './TradeTeamCard.helpers';

type UseTradeTeamCardSalariesParams = {
  team: TeamLike | null | undefined;
  sends: PlayerLike[];
  incomingPlayers: PlayerLike[];
  incomingEntitlements: EntitlementLike[];
  entitlementsOut: EntitlementLike[];
  otherTeams: TeamOptionLike[];
  yearKey: number | string;
  validationResult: ValidationResultLike | null | undefined;
  selectedTeamId: string | null | undefined;
  teamTradeExceptions: TeamTradeException[];
  hasTeam: boolean;
  worldAsOfDate: string | null;
};

export const useTradeTeamCardSalaries = ({
  team,
  sends,
  incomingPlayers,
  incomingEntitlements,
  entitlementsOut,
  otherTeams,
  yearKey,
  validationResult,
  selectedTeamId,
  teamTradeExceptions,
  hasTeam,
  worldAsOfDate,
}: UseTradeTeamCardSalariesParams) => {
  const teamTradePlayers = useMemo(() => {
    const seenIds = new Set<string>();
    return [...(team?.players ?? []), ...(team?.twoWayPlayers ?? [])].filter(
      (player) => {
        const playerId = player.player_id ?? player.id;
        if (playerId == null) return true;

        const key = String(playerId);
        if (seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      }
    );
  }, [team?.players, team?.twoWayPlayers]);

  const filteredIncomingPlayers = useMemo(
    () =>
      incomingPlayers.filter(
        (p) =>
          !teamTradePlayers.some(
            (tp) => (tp.player_id ?? tp.id) === (p.player_id ?? p.id)
          )
      ),
    [incomingPlayers, teamTradePlayers]
  );

  const teamTotalSalary = useMemo(() => {
    if (!team) return 0;
    const normalizedYear = normalizeYearInput(yearKey);
    if (!normalizedYear) return 0;
    const totals = computeTeamCapTotals(
      team as UnknownRecord,
      normalizedYear.endYear,
      { asOfDate: worldAsOfDate }
    );
    return totals.totalCapAllocations || 0;
  }, [team, worldAsOfDate, yearKey]);

  const snapshot = getTeamSnapshot(selectedTeamId, validationResult);
  const hasValidatorResult = snapshot !== null;

  const localOutgoingBaseSalary = useMemo(
    () => getSalaryForYear(sends, yearKey),
    [sends, yearKey]
  );
  const localIncomingBaseSalary = useMemo(
    () => getSalaryForYear(incomingPlayers, yearKey),
    [incomingPlayers, yearKey]
  );
  const localOutgoingSalary = useMemo(
    () =>
      getSalaryForYear(
        sends.filter((player) => !isTwoWayTradePlayer(player)),
        yearKey
      ),
    [sends, yearKey]
  );
  const localIncomingSalary = useMemo(
    () =>
      getSalaryForYear(
        incomingPlayers.filter((player) => !isTwoWayTradePlayer(player)),
        yearKey
      ),
    [incomingPlayers, yearKey]
  );

  const outgoingSalary = hasValidatorResult
    ? snapshot.outgoingMatchingSalary
    : localOutgoingSalary;
  const incomingSalary = hasValidatorResult
    ? snapshot.incomingMatchingSalary
    : localIncomingSalary;
  const isEstimate = !hasValidatorResult;

  const outgoingBaseSalary = hasValidatorResult
    ? snapshot.outgoingBaseSalary
    : localOutgoingBaseSalary;
  const incomingBaseSalary = hasValidatorResult
    ? snapshot.incomingBaseSalary
    : localIncomingBaseSalary;

  const hasOutgoingAdjustment =
    Math.abs(outgoingSalary - outgoingBaseSalary) > 1;
  const hasIncomingAdjustment =
    Math.abs(incomingSalary - incomingBaseSalary) > 1;

  if (hasValidatorResult) {
    warnOnTotalsDivergence(
      'TradeTeamCard',
      'outgoingSalary',
      localOutgoingSalary,
      snapshot.outgoingMatchingSalary,
      1
    );
    warnOnTotalsDivergence(
      'TradeTeamCard',
      'incomingSalary',
      localIncomingSalary,
      snapshot.incomingMatchingSalary,
      1
    );
  }

  const { primary } = useMemo(
    () =>
      getTeamColors(
        team?.id === null || team?.id === undefined
          ? undefined
          : String(team.id)
      ),
    [team?.id]
  );

  const playersCount = useMemo(
    () => teamTradePlayers.length - sends.length + incomingPlayers.length,
    [teamTradePlayers, sends, incomingPlayers]
  );
  const outgoingPlayersTeam = useMemo(
    () => ({ players: teamTradePlayers }),
    [teamTradePlayers]
  );
  const playerOtherTeams = useMemo(
    () => otherTeams.map(toPlayerTeamOption),
    [otherTeams]
  );
  const entitlementOtherTeams = useMemo(
    () => otherTeams.map(toEntitlementTeamOption),
    [otherTeams]
  );
  const picksCount = useMemo(
    () =>
      (team?.entitlements?.length || 0) -
      entitlementsOut.length +
      incomingEntitlements.length,
    [team, entitlementsOut, incomingEntitlements]
  );

  const capSettings = useMemo(() => getCapSettingsForYear(yearKey), [yearKey]);

  const faBuckets = useMemo(
    () => getTeamFaExceptionBuckets(team || {}),
    [team]
  );

  const allowableIncomingNoTPE = hasValidatorResult
    ? snapshot.displayAllowableIncoming
    : null;

  const salaryMatchingApplicable = hasValidatorResult
    ? snapshot.salaryMatchingApplicable
    : true;
  const salaryMatchingSkipReason = hasValidatorResult
    ? snapshot.salaryMatchingSkipReason
    : null;

  const salaryMatchingRuleLabel = hasValidatorResult
    ? snapshot.salaryMatchingRule
    : '';
  const salaryMatchingFormula = hasValidatorResult
    ? snapshot.salaryMatchingFormula
    : '';
  const hardCapIsLimiter =
    hasValidatorResult &&
    snapshot.isHardCapped &&
    snapshot.effectiveAllowableIncoming != null &&
    snapshot.allowableIncoming != null &&
    snapshot.effectiveAllowableIncoming < snapshot.allowableIncoming;
  const hardCapLimiterLabel = hasValidatorResult
    ? snapshot.hardCapLimiterLabel ||
      (snapshot.hardCapType === 'SECOND_APRON'
        ? '2nd Apron'
        : snapshot.hardCapType === 'FIRST_APRON'
          ? '1st Apron'
          : snapshot.hardCapType === 'UNKNOWN'
            ? '1st Apron (fail-closed)'
            : 'Hard Cap')
    : null;

  const tpeEligiblePlayers = useMemo(() => {
    if (!hasTeam) return [];
    const seasonKey =
      typeof yearKey === 'string' && yearKey.includes('-')
        ? yearKey
        : toSeasonKey(yearKey);
    return incomingPlayers.filter((player) => {
      if (isTwoWayTradePlayer(player)) return false;

      const playerSalary =
        getCapHitForSeason(player as UnknownRecord, seasonKey) || 0;
      return (teamTradeExceptions || []).some(
        (tpe) =>
          !tpe?.isUsed &&
          playerSalary <=
            Number(
              tpe?.remainingAmount ?? tpe?.remaining ?? tpe?.amount ?? 0
            ) &&
          (!tpe?.expirationDate ||
            new Date(String(tpe.expirationDate)) > new Date())
      );
    });
  }, [hasTeam, incomingPlayers, teamTradeExceptions, yearKey]);

  return {
    filteredIncomingPlayers,
    teamTotalSalary,
    snapshot,
    hasValidatorResult,
    outgoingSalary,
    incomingSalary,
    isEstimate,
    outgoingBaseSalary,
    incomingBaseSalary,
    hasOutgoingAdjustment,
    hasIncomingAdjustment,
    primary,
    playersCount,
    outgoingPlayersTeam,
    playerOtherTeams,
    entitlementOtherTeams,
    picksCount,
    faBuckets,
    allowableIncomingNoTPE,
    salaryMatchingApplicable,
    salaryMatchingSkipReason,
    salaryMatchingRuleLabel,
    salaryMatchingFormula,
    hardCapIsLimiter,
    hardCapLimiterLabel,
    tpeEligiblePlayers,
  };
};
