import { TradeAcquisitionHistoryZ } from '@/schemas/tradeAggregation';
import type { TradeTeamUpdate } from '../../mutationPipeline.types.result';
import type { TradeSalaryPathEvaluation } from './tradeSalaryMatchingPaths';
import { isDateOnly, isZonedDateTime } from '../../governedSeason/governedTime';
import { isTwoWayTradePlayer } from './twoWayTradeSalary';

/** Called only after apply-time validation, within the existing atomic team write. */
export function recordTradeAcquisitions(input: {
  teamUpdates: readonly TradeTeamUpdate[];
  movements: readonly { playerId: string; destinationTeamCode: string }[];
  salaryMatchingPaths: readonly {
    teamCode: string;
    evaluation: TradeSalaryPathEvaluation;
  }[];
  transactionId: string;
  asOfDate: unknown;
}): string | null {
  for (const move of input.movements) {
    const evaluation = input.salaryMatchingPaths.find(
      (path) => path.teamCode === move.destinationTeamCode
    )?.evaluation;
    // Legacy transactions without governed components gain no invented authority.
    if (!evaluation) continue;
    const team = input.teamUpdates.find(
      (update) => update.teamCode === move.destinationTeamCode
    )?.team;
    if (!team) return 'The acquisition destination is unavailable.';
    const rosterPlayer = team.players?.find(
      (player) =>
        (player.playerId ?? player.player_id ?? player.id) === move.playerId
    );
    const components = evaluation.components.filter((component) =>
      component.incomingPlayers.some(
        (player) => player.playerId === move.playerId
      )
    );
    // Two-Way players are excluded from matching and from aggregation.
    if (
      components.length === 0 &&
      rosterPlayer &&
      isTwoWayTradePlayer(rosterPlayer)
    )
      continue;
    if (
      evaluation.status !== 'PASS' ||
      components.length !== 1 ||
      !(isDateOnly(input.asOfDate) || isZonedDateTime(input.asOfDate))
    )
      return 'The acquisition date or governed salary component is unavailable.';
    const history = TradeAcquisitionHistoryZ.parse(
      team.tradeAcquisitionHistory ?? {
        version: 1,
        baseline: null,
        entries: [],
      }
    );
    if (
      history.entries.some(
        (entry) => entry.teamCode !== move.destinationTeamCode
      )
    )
      return 'The acquisition history belongs to another team.';
    const entry = {
      transactionId: input.transactionId,
      playerId: move.playerId,
      teamCode: move.destinationTeamCode,
      acquiredAt: input.asOfDate,
      viaException: components[0].path !== 'ROOM',
    };
    const existing = history.entries.find(
      (item) =>
        item.transactionId === entry.transactionId &&
        item.playerId === entry.playerId
    );
    if (existing && JSON.stringify(existing) !== JSON.stringify(entry))
      return 'The saved acquisition conflicts with this transaction.';
    team.tradeAcquisitionHistory = {
      ...history,
      entries: existing ? history.entries : [...history.entries, entry],
    };
  }
  return null;
}
