/**
 * Wave 18 Step 2: Private utility functions extracted from tradeValidator.ts.
 * Contains shouldRoutePlayerToTeam, extractPlayerId, computeProjectedRosterLegality.
 */

import { resolvePlayerDestinationTeamId } from './tradeValidator.ruleEnvelopes';
import { checkRosterCounts } from '../rules/validateRoster';
import { isTwoWayTradePlayer } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import type {
  TradeValidatorPlayer,
  TradeValidatorTeamSlot,
} from './tradeValidator.types';

/**
 * A player is two-way when the explicit `isTwoWay` flag is set OR the contract
 * type says so. World-team player objects often carry only `contractType:
 * "Two-Way"` (no precomputed flag), so relying on the flag alone let two-way
 * players fall into the 15-man standard count and rejected every trade. Two-way
 * contracts never count toward the standard roster limit.
 */
export function isTwoWayPlayer(
  player: TradeValidatorPlayer | null | undefined
): boolean {
  return isTwoWayTradePlayer(player);
}

export function shouldRoutePlayerToTeam({
  player,
  receivingTeamId,
  activeTeamCount,
}: {
  player: TradeValidatorPlayer;
  receivingTeamId: string;
  activeTeamCount: number;
}) {
  const destinationTeamId = resolvePlayerDestinationTeamId(player);

  if (activeTeamCount > 2) {
    return destinationTeamId !== null && destinationTeamId === receivingTeamId;
  }

  return destinationTeamId === null || destinationTeamId === receivingTeamId;
}

export function extractPlayerId(p: TradeValidatorPlayer | string | null | undefined) {
  if (!p) return null;
  if (typeof p === 'string') return p || null;
  return (
    p.player_id ||
    p.playerId ||
    p.id ||
    null
  );
}

export function computeProjectedRosterLegality(team: TradeValidatorTeamSlot) {
  const teamPlayers: TradeValidatorPlayer[] = team.team?.players || [];
  const teamTwoWay: TradeValidatorPlayer[] = team.team?.twoWayPlayers || [];
  const outgoing: TradeValidatorPlayer[] = team.outgoingPlayers || [];
  const incoming: TradeValidatorPlayer[] = team.incomingPlayers || [];

  // Build the current roster from both `players` and any separate
  // `twoWayPlayers` array, de-duplicating by id — world data does not always
  // keep two-ways out of `players`, which previously double-counted them into
  // the standard total and blocked every trade on a phantom roster overflow.
  const seenRosterIds = new Set<string>();
  const currentRoster: TradeValidatorPlayer[] = [];
  for (const player of teamPlayers.concat(teamTwoWay)) {
    const pid = extractPlayerId(player);
    if (pid) {
      if (seenRosterIds.has(pid)) continue;
      seenRosterIds.add(pid);
    }
    currentRoster.push(player);
  }

  // If most roster players lack IDs we fall back to simple arithmetic.
  const currentIds = seenRosterIds;
  const hasReliableIds =
    currentIds.size > 0 && currentIds.size >= currentRoster.length * 0.5;

  // Determine current standard / two-way counts. Two-way status comes from the
  // flag OR the contract type (isTwoWayPlayer), so two-ways are always excluded
  // from the standard 15-man count.
  const currentTwoWay = currentRoster.filter(isTwoWayPlayer).length;
  const currentStandard = currentRoster.length - currentTwoWay;

  let projectedStandard: number;
  let projectedTwoWay: number;

  if (hasReliableIds) {
    // ID-aware path: only count outgoing still in roster and incoming not yet in roster.
    const outStd = outgoing.filter((p) => {
      const pid = extractPlayerId(p);
      return !isTwoWayPlayer(p) && pid && currentIds.has(pid);
    }).length;
    const outTw = outgoing.filter((p) => {
      const pid = extractPlayerId(p);
      return isTwoWayPlayer(p) && pid && currentIds.has(pid);
    }).length;
    const inStd = incoming.filter((p) => {
      const pid = extractPlayerId(p);
      return !isTwoWayPlayer(p) && (!pid || !currentIds.has(pid));
    }).length;
    const inTw = incoming.filter((p) => {
      const pid = extractPlayerId(p);
      return isTwoWayPlayer(p) && (!pid || !currentIds.has(pid));
    }).length;

    projectedStandard = currentStandard - outStd + inStd;
    projectedTwoWay = currentTwoWay - outTw + inTw;
  } else {
    // Simple arithmetic path (pre-trade shape or test fixtures without IDs).
    const outStd = outgoing.filter((p) => !isTwoWayPlayer(p)).length;
    const outTw = outgoing.filter((p) => isTwoWayPlayer(p)).length;
    const inStd = incoming.filter((p) => !isTwoWayPlayer(p)).length;
    const inTw = incoming.filter((p) => isTwoWayPlayer(p)).length;

    projectedStandard = currentStandard - outStd + inStd;
    projectedTwoWay = currentTwoWay - outTw + inTw;
  }

  // Delegate rule enforcement to the canonical checkRosterCounts function.
  // This ensures pre-trade and post-state paths share the same rule definitions.
  const result = checkRosterCounts(projectedStandard, projectedTwoWay);
  // Override rosterCounts.current with the actual pre-trade count for display purposes.
  result.rosterCounts.current = currentStandard;
  return result;
}
