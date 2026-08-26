/**
 * Wave 26 Step 1: Payload normalization functions extracted from
 * tradeContext.snapshot.ts (lines 677–879).
 */

import {
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
  toFiniteNumberOrUndefined,
  toNonEmptyString,
} from './tradeContext.payloadNormalization';
import type { ArchitectTradePayloadPlayer } from '@/features/architect/utils/mutationPipeline';
import type {
  BuildTradeApplyPreparationParams,
  PayloadPlayerIngress,
  PayloadTeamIngress,
  TradeContextNormalizedPayload,
  TradeContextPayload,
} from './types';
import { TradeSalaryMatchingElectionZ } from '@/schemas/tradeSalaryMatchingPath';
import { GovernedTradeSalaryBasisZ } from '@/schemas/governedTradeSalaryBasis';
import {
  GovernedSignAndTradeAuthorityZ,
  GovernedSignAndTradeProposalZ,
} from '@/schemas/governedSignAndTrade';

export function normalizeTradePayloadPlayer({
  player,
  payloadTeamCodes,
  senderIndex,
}: {
  player: PayloadPlayerIngress | null | undefined;
  payloadTeamCodes: string[];
  senderIndex: number;
}): ArchitectTradePayloadPlayer {
  const normalized: ArchitectTradePayloadPlayer = {};
  const playerId =
    toNonEmptyString(player?.player_id) ??
    toNonEmptyString(player?.playerId) ??
    toNonEmptyString(player?.id);
  const name =
    toNonEmptyString(player?.name) ??
    toNonEmptyString(player?.displayName) ??
    toNonEmptyString(player?.playerName);
  const displayName = toNonEmptyString(player?.displayName) ?? name;
  const originTeamId = toNonEmptyString(player?.originTeamId);
  const matchIncoming = toFiniteNumberOrUndefined(player?.matchIncoming);
  const matchOutgoing = toFiniteNumberOrUndefined(player?.matchOutgoing);
  const absorptionMode = toNonEmptyString(player?.absorptionMode);
  const tpeId = toNonEmptyString(player?.tpeId);
  const isTwoWay = player?.isTwoWay === true;
  const governedTradeSalaryBasis = GovernedTradeSalaryBasisZ.safeParse(
    player?.governedTradeSalaryBasis
  );
  const governedSignAndTradeAuthority =
    GovernedSignAndTradeAuthorityZ.safeParse(
      player?.governedSignAndTradeAuthority
    );
  const resolvedDestinationTeamCode = resolveOutgoingTradeDestinationTeamCode({
    payloadTeamCodes,
    senderIndex,
    player: player ?? {},
  });
  const receivingTeamId = normalizeTradeTeamCodeLike(player?.receivingTeamId);
  const tradeTo =
    toNonEmptyString(player?.tradeTo) ?? resolvedDestinationTeamCode;

  if (playerId !== undefined) normalized.player_id = playerId;
  if (name !== undefined) normalized.name = name;
  if (displayName !== undefined) normalized.displayName = displayName;
  if (originTeamId !== undefined) normalized.originTeamId = originTeamId;
  if (matchIncoming !== undefined) normalized.matchIncoming = matchIncoming;
  if (matchOutgoing !== undefined) normalized.matchOutgoing = matchOutgoing;
  if (absorptionMode !== undefined) normalized.absorptionMode = absorptionMode;
  if (tpeId !== undefined) normalized.tpeId = tpeId;
  if (isTwoWay) normalized.isTwoWay = true;
  if (player?.signAndTrade === true) normalized.signAndTrade = true;
  if (player?.signAndTradeContract != null) {
    normalized.signAndTradeContract = player.signAndTradeContract;
  }
  const governedSignAndTradeProposal = GovernedSignAndTradeProposalZ.safeParse(
    player?.governedSignAndTradeProposal
  );
  if (governedSignAndTradeProposal.success) {
    normalized.governedSignAndTradeProposal = governedSignAndTradeProposal.data;
  }
  if (governedSignAndTradeAuthority.success) {
    normalized.governedSignAndTradeAuthority =
      governedSignAndTradeAuthority.data;
  }
  if (governedTradeSalaryBasis.success) {
    normalized.governedTradeSalaryBasis = governedTradeSalaryBasis.data;
  }
  if (receivingTeamId !== null) {
    normalized.receivingTeamId = receivingTeamId;
  }
  if (tradeTo !== null) normalized.tradeTo = tradeTo;

  return normalized;
}

export function normalizeTradePayloadEntitlements(
  entitlements: PayloadTeamIngress['entitlementsOut']
): TradeContextNormalizedPayload['teams'][number]['entitlementsOut'] {
  if (!Array.isArray(entitlements)) {
    return [];
  }

  return entitlements.map((entitlement) => ({
    ...(entitlement?.entitlementId != null
      ? { entitlementId: String(entitlement.entitlementId) }
      : {}),
    ...(entitlement?.id != null ? { id: String(entitlement.id) } : {}),
    ...(toNonEmptyString(entitlement?.type) !== undefined
      ? { type: toNonEmptyString(entitlement?.type) }
      : {}),
    ...(toNonEmptyString(entitlement?.name) !== undefined
      ? { name: toNonEmptyString(entitlement?.name) }
      : {}),
    ...(toFiniteNumberOrUndefined(entitlement?.year) !== undefined
      ? { year: toFiniteNumberOrUndefined(entitlement?.year) }
      : entitlement?.year != null
        ? { year: String(entitlement.year) }
        : {}),
    ...(toFiniteNumberOrUndefined(entitlement?.round) !== undefined
      ? { round: toFiniteNumberOrUndefined(entitlement?.round) }
      : {}),
    ...(entitlement?.toTeamId != null
      ? { toTeamId: String(entitlement.toTeamId) }
      : {}),
  }));
}

export function normalizeTradePayloadTeam({
  team,
  payloadTeamCodes,
  senderIndex,
}: {
  team: PayloadTeamIngress | null | undefined;
  payloadTeamCodes: string[];
  senderIndex: number;
}): TradeContextNormalizedPayload['teams'][number] {
  const teamCode =
    normalizeTradeTeamCodeLike(team?.teamCode) ??
    normalizeTradeTeamCodeLike(team?.team?.teamCode) ??
    normalizeTradeTeamCodeLike(team?.team?.id) ??
    normalizeTradeTeamCodeLike(team?.teamId);
  const salaryMatchingElection = TradeSalaryMatchingElectionZ.safeParse(
    team?.salaryMatchingElection
  );

  return {
    teamCode,
    sends: Array.isArray(team?.sends)
      ? team.sends.map((player) =>
          normalizeTradePayloadPlayer({ player, payloadTeamCodes, senderIndex })
        )
      : [],
    receives: Array.isArray(team?.receives)
      ? team.receives.map((player) =>
          normalizeTradePayloadPlayer({ player, payloadTeamCodes, senderIndex })
        )
      : [],
    entitlementsOut: normalizeTradePayloadEntitlements(
      team?.entitlementsOut || team?.outgoingEntitlements || []
    ),
    picksOut: Array.isArray(team?.picksOut) ? team.picksOut : [],
    ...(team?.cashSent !== undefined && team?.cashSent !== null
      ? { cashSent: team.cashSent }
      : {}),
    ...(team?.cashReceived !== undefined && team?.cashReceived !== null
      ? { cashReceived: team.cashReceived }
      : {}),
    ...(team?.cashToTeamId !== undefined && team?.cashToTeamId !== null
      ? { cashToTeamId: String(team.cashToTeamId).trim().toUpperCase() }
      : {}),
    ...(salaryMatchingElection.success
      ? { salaryMatchingElection: salaryMatchingElection.data }
      : team?.salaryMatchingElection === null
        ? { salaryMatchingElection: null }
        : {}),
  };
}

export function normalizeTradeContextPayload(
  payload: TradeContextPayload
): TradeContextNormalizedPayload {
  const ingressTeams = Array.isArray(payload?.teams) ? payload.teams : [];
  const payloadTeamCodes = ingressTeams
    .map(
      (team) =>
        normalizeTradeTeamCodeLike(team?.teamCode) ??
        normalizeTradeTeamCodeLike(team?.team?.teamCode) ??
        normalizeTradeTeamCodeLike(team?.team?.id) ??
        normalizeTradeTeamCodeLike(team?.teamId)
    )
    .map((teamCode) => teamCode ?? '');

  return {
    teams: ingressTeams.map((team, senderIndex) =>
      normalizeTradePayloadTeam({ team, payloadTeamCodes, senderIndex })
    ),
    ...(payload?.capProjections
      ? { capProjections: payload.capProjections }
      : {}),
    ...(payload?.tradeCtx ? { tradeCtx: payload.tradeCtx } : {}),
    ...(payload?.asOfDate != null ? { asOfDate: payload.asOfDate } : {}),
  };
}

export function buildTradeValidationPayload({
  payload,
  asOfDate,
}: Pick<
  BuildTradeApplyPreparationParams,
  'payload' | 'asOfDate'
>): TradeContextNormalizedPayload {
  const normalizedPayload = normalizeTradeContextPayload(payload);

  if (!asOfDate || normalizedPayload.asOfDate === asOfDate) {
    return normalizedPayload;
  }

  return {
    ...normalizedPayload,
    asOfDate,
    tradeCtx: {
      ...(normalizedPayload?.tradeCtx || {}),
      asOfDate,
    },
  };
}
