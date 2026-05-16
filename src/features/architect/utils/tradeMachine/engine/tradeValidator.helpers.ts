/**
 * Wave 18 Step 2: Private utility functions extracted from tradeValidator.ts.
 * Contains shouldRoutePlayerToTeam, extractPlayerId, computeProjectedRosterLegality.
 */

import { resolvePlayerDestinationTeamId } from './tradeValidator.ruleEnvelopes';
import { checkRosterCounts } from '../rules/validateRoster';
import type {
  TradeValidatorPlayer,
  TradeValidatorTeamSlot,
} from './tradeValidator.types';

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

  // Build a set of current player IDs for overlap detection.
  // If most roster players lack IDs we fall back to simple arithmetic.
  const allRoster = teamPlayers.concat(teamTwoWay);
  const currentIds = new Set(
    allRoster.map(extractPlayerId).filter(Boolean)
  );
  const hasReliableIds = currentIds.size > 0 && currentIds.size >= allRoster.length * 0.5;

  // Determine current standard / two-way counts.
  let currentStandard: number;
  let currentTwoWay: number;
  if (teamTwoWay.length > 0) {
    currentStandard = teamPlayers.length;
    currentTwoWay = teamTwoWay.length;
  } else {
    currentStandard = teamPlayers.filter((p) => !p.isTwoWay).length;
    currentTwoWay = teamPlayers.filter((p) => p.isTwoWay).length;
  }

  let projectedStandard: number;
  let projectedTwoWay: number;

  if (hasReliableIds) {
    // ID-aware path: only count outgoing still in roster and incoming not yet in roster.
    const outStd = outgoing.filter((p) => {
      const pid = extractPlayerId(p);
      return !p.isTwoWay && pid && currentIds.has(pid);
    }).length;
    const outTw = outgoing.filter((p) => {
      const pid = extractPlayerId(p);
      return p.isTwoWay && pid && currentIds.has(pid);
    }).length;
    const inStd = incoming.filter((p) => {
      const pid = extractPlayerId(p);
      return !p.isTwoWay && (!pid || !currentIds.has(pid));
    }).length;
    const inTw = incoming.filter((p) => {
      const pid = extractPlayerId(p);
      return p.isTwoWay && (!pid || !currentIds.has(pid));
    }).length;

    projectedStandard = currentStandard - outStd + inStd;
    projectedTwoWay = currentTwoWay - outTw + inTw;
  } else {
    // Simple arithmetic path (pre-trade shape or test fixtures without IDs).
    const outStd = outgoing.filter((p) => !p.isTwoWay).length;
    const outTw = outgoing.filter((p) => p.isTwoWay).length;
    const inStd = incoming.filter((p) => !p.isTwoWay).length;
    const inTw = incoming.filter((p) => p.isTwoWay).length;

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
