/**
 * Wave 26 Step 2: buildPostTradeTeamsSnapshot extracted from
 * tradeContext.snapshot.ts (lines 75–555).
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import {
  isSignAndTradeEligible,
  resolveSignAndTradeContractPayload,
  validateSignAndTradeContractPayload,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import {
  buildSnapshotTradeExceptions,
  buildTradeIncomingPlayerSnapshot,
  buildTradeValidationPlayer,
  buildTradeValidationTeamRecord,
  findMatchingTradeReceivePayload,
  getTradePayloadPlayerId,
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
  toNonEmptyString,
  toSignAndTradePlayerLike,
} from './tradeContext.payloadNormalization';
import { normalizeTradeContextPayload } from './tradeContext.snapshot.payloadNorm';
import type { NormalizedTeamPick } from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  AnyRecord,
  BuildPostTradeTeamsSnapshotParams,
  PostTradeSnapshot,
  TeamUpdate,
  TradeContextValidationPlayer,
  ValidationTeam,
} from './types';

export function buildPostTradeTeamsSnapshot({
  payload,
  currentState,
  seasonId,
  timestamp,
}: BuildPostTradeTeamsSnapshotParams): PostTradeSnapshot {
  const normalizedPayload = normalizeTradeContextPayload(payload);
  const payloadTeams = normalizedPayload.teams;
  const teamUpdates: TeamUpdate[] = [];
  const timestampISO = new Date(timestamp).toISOString();

  const payloadTeamCodes = payloadTeams
    .map((team) => normalizeTradeTeamCodeLike(team.teamCode))
    .filter(Boolean) as string[];
  const activeTeamCount = payloadTeamCodes.length;
  const currentEndYear =
    toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
  const enforceSatPreflight =
    normalizedPayload?.tradeCtx?.source === 'tradeMachine' ||
    normalizedPayload?.tradeCtx?.enforceSignAndTradePreflight === true;

  const currentTeamByCode = new Map<string | null, AnyRecord>(
    (currentState.teams || []).map(({ teamCode, team }) => [
      normalizeTradeTeamCodeLike(teamCode),
      team,
    ])
  );
  const validationSendsByTeam: TradeContextValidationPlayer[][] =
    payloadTeams.map((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      const senderTeamState =
        currentTeamByCode.get(senderTeamCode) ||
        currentState.teams[senderIndex]?.team;

      return (teamTrade.sends || []).map((player) =>
        buildTradeValidationPlayer({
          player,
          sourceTeamState: senderTeamState,
        })
      );
    });
  const validationReceivesByTeam: TradeContextValidationPlayer[][] =
    payloadTeams.map(() => []);

  if (enforceSatPreflight) {
    payloadTeams.forEach((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      const senderTeamState =
        currentTeamByCode.get(senderTeamCode) ||
        currentState.teams[senderIndex]?.team;
      const senderCapHolds = Array.isArray(senderTeamState?.capHolds)
        ? senderTeamState.capHolds
        : [];

      (validationSendsByTeam[senderIndex] || []).forEach(
        (player, playerIndex) => {
          if (player.signAndTrade !== true) return;

          const destinationTeamId = resolveOutgoingTradeDestinationTeamCode({
            payloadTeamCodes,
            senderIndex,
            player,
          });
          const playerLabel =
            player.name ||
            player.displayName ||
            player.playerName ||
            player.player_id ||
            player.id ||
            `send[${playerIndex}]`;

          if (
            !destinationTeamId ||
            !payloadTeamCodes.includes(destinationTeamId) ||
            destinationTeamId === senderTeamCode
          ) {
            throw new Error(
              `[SIGN_AND_TRADE_APPLY_ERROR] Outgoing sign-and-trade player "${playerLabel}" from ${senderTeamCode} must have a valid destination team`
            );
          }

          const eligibility = isSignAndTradeEligible({
            player: toSignAndTradePlayerLike(player),
            yearKey: currentEndYear,
            sourceTeamId: senderTeamCode,
            sourceTeamCapHolds: senderCapHolds,
          });

          if (!eligibility.eligible) {
            throw new Error(
              `[SIGN_AND_TRADE_APPLY_ERROR] Outgoing sign-and-trade player "${playerLabel}" is ineligible (${eligibility.reasonCode})`
            );
          }

          if (!player.signAndTradeContract) {
            throw new Error(
              `[SIGN_AND_TRADE_APPLY_ERROR] Outgoing sign-and-trade player "${playerLabel}" is missing signAndTradeContract payload`
            );
          }

          const contract = resolveSignAndTradeContractPayload(
            toSignAndTradePlayerLike(player),
            currentEndYear,
            { allowPlayerContractFallback: false }
          );
          const contractValidation = validateSignAndTradeContractPayload(
            contract,
            currentEndYear,
            { requireActiveYearRow: true }
          );

          if (!contractValidation.valid) {
            throw new Error(
              `[SIGN_AND_TRADE_APPLY_ERROR] Invalid sign-and-trade contract for "${playerLabel}": ${contractValidation.reasons.join('; ')}`
            );
          }
        }
      );
    });
  }

  if (activeTeamCount >= 3) {
    payloadTeams.forEach((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      (teamTrade.sends || []).forEach((player, playerIndex) => {
        const resolvedTarget = resolveOutgoingTradeDestinationTeamCode({
          payloadTeamCodes,
          senderIndex,
          player,
        });

        const isValidTarget =
          !!resolvedTarget &&
          payloadTeamCodes.includes(resolvedTarget) &&
          resolvedTarget !== senderTeamCode;

        if (!isValidTarget) {
          const playerLabel =
            player.name ||
            player.displayName ||
            player.player_id ||
            `send[${playerIndex}]`;
          const destinationDetail = resolvedTarget
            ? `invalid destination "${resolvedTarget}"`
            : 'missing destination';

          throw new Error(
            `[TRADE_APPLY_ROUTING_ERROR] 3+ team apply requires explicit valid destination for outgoing player "${playerLabel}" from ${senderTeamCode || `team-${senderIndex}`}: ${destinationDetail}`
          );
        }
      });
    });
  }

  for (let i = 0; i < payloadTeams.length; i++) {
    const teamTrade = payloadTeams[i];
    const { teamCode, team } = currentState.teams[i];
    const thisTeamCode = normalizeTradeTeamCodeLike(teamCode);

    const updatedTeam: AnyRecord = { ...team };
    const validationSends = validationSendsByTeam[i] || [];
    const outgoingPlayerIds = (teamTrade.sends || [])
      .map((player) => getTradePayloadPlayerId(player))
      .filter((playerId): playerId is string => Boolean(playerId));
    const outgoingSignAndTradePlayers = validationSends.filter(
      (player) => player.signAndTrade === true
    );
    const outgoingSignAndTradeIds = outgoingSignAndTradePlayers
      .map((player) => getTradePayloadPlayerId(player))
      .filter((playerId): playerId is string => Boolean(playerId));
    const outgoingSignAndTradeNames = outgoingSignAndTradePlayers
      .map((player) => player.name || player.displayName || player.playerName)
      .filter((playerName): playerName is string => Boolean(playerName));

    const incomingPlayers: AnyRecord[] = [];
    const validationReceives: AnyRecord[] = [];
    payloadTeams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        const otherTeamCode =
          payloadTeamCodes[otherIndex] ||
          normalizeTradeTeamCodeLike(currentState.teams[otherIndex]?.teamCode);
        const otherTeamState =
          currentTeamByCode.get(otherTeamCode) ||
          currentState.teams[otherIndex]?.team;

        (otherTeamTrade.sends || []).forEach((player, playerIndex) => {
          const validationPlayer = validationSendsByTeam[otherIndex]?.[
            playerIndex
          ] || { ...player };
          const receiveOverride = findMatchingTradeReceivePayload(
            teamTrade.receives || [],
            player
          );
          const mergedValidationPlayer = receiveOverride
            ? { ...validationPlayer, ...receiveOverride }
            : validationPlayer;
          const incomingPlayerSnapshot = buildTradeIncomingPlayerSnapshot({
            player,
            sourceTeamState: otherTeamState,
          });
          const mergedIncomingPlayerSnapshot = receiveOverride
            ? { ...incomingPlayerSnapshot, ...receiveOverride }
            : incomingPlayerSnapshot;
          const resolvedTarget = resolveOutgoingTradeDestinationTeamCode({
            payloadTeamCodes,
            senderIndex: otherIndex,
            player,
          });

          if (resolvedTarget) {
            if (resolvedTarget === thisTeamCode) {
              validationReceives.push(mergedValidationPlayer);

              if (player.signAndTrade === true) {
                const satContract = resolveSignAndTradeContractPayload(
                  toSignAndTradePlayerLike(mergedValidationPlayer),
                  currentEndYear,
                  { allowPlayerContractFallback: false }
                );
                const normalizedSatContract =
                  normalizeContractForWorld({
                    ...(satContract || {}),
                    contractType: 'Sign & Trade',
                    signAndTrade: true,
                    signingDate: timestampISO,
                    signingTeam: otherTeamCode,
                  }) || null;

                incomingPlayers.push({
                  ...mergedIncomingPlayerSnapshot,
                  signAndTrade: true,
                  contractType: 'Sign & Trade',
                  contract: normalizedSatContract,
                  signedDate: timestampISO,
                  isNewlySignedFA: true,
                  originTeamId: otherTeamCode,
                });
              } else {
                incomingPlayers.push(mergedIncomingPlayerSnapshot);
              }
            }
            return;
          }

          if (activeTeamCount <= 2) {
            validationReceives.push(mergedValidationPlayer);
            incomingPlayers.push(mergedIncomingPlayerSnapshot);
            return;
          }

          throw new Error(
            `[TRADE_APPLY_ROUTING_ERROR] 3+ team apply missing destination for player "${player.name || player.displayName || player.player_id}"`
          );
        });
      }
    });
    validationReceivesByTeam[i] = validationReceives;

    const incomingPlayerIds = incomingPlayers
      .map((player) => getTradePayloadPlayerId(player))
      .filter((playerId): playerId is string => Boolean(playerId));

    updatedTeam.roster = [
      ...(Array.isArray(team.roster) ? team.roster : []).filter(
        (id: string) => !outgoingPlayerIds.includes(id)
      ),
      ...incomingPlayerIds,
    ];

    updatedTeam.players = [
      ...(Array.isArray(team.players) ? team.players : []).filter(
        (player: AnyRecord) => {
          const playerId = getTradePayloadPlayerId(player);
          return !outgoingPlayerIds.includes(playerId || '');
        }
      ),
      ...incomingPlayers.map((player) => ({
        ...player,
        teamCode,
        teamName: team.teamName,
      })),
    ];

    if (Array.isArray(team.twoWayPlayers)) {
      const merged = [
        ...team.twoWayPlayers.filter((player: AnyRecord) => {
          const playerId = getTradePayloadPlayerId(player);
          return !outgoingPlayerIds.includes(playerId || '');
        }),
        ...incomingPlayers
          .filter((player) => player.isTwoWay === true)
          .map((player) => ({ ...player, teamCode, teamName: team.teamName })),
      ];
      const seen = new Set<string>();
      updatedTeam.twoWayPlayers = merged.filter((player: AnyRecord) => {
        const playerId = getTradePayloadPlayerId(player);
        if (!playerId) return true;
        if (seen.has(playerId)) return false;
        seen.add(playerId);
        return true;
      });
    }

    const receivesSignAndTrade = incomingPlayers.some(
      (p) => p.signAndTrade === true
    );

    if (
      outgoingSignAndTradeIds.length > 0 &&
      Array.isArray(updatedTeam.capHolds)
    ) {
      updatedTeam.capHolds = updatedTeam.capHolds.filter((hold: AnyRecord) => {
        const holdPlayerId = getTradePayloadPlayerId(hold);
        if (holdPlayerId && outgoingSignAndTradeIds.includes(holdPlayerId)) {
          return false;
        }
        const holdName =
          toNonEmptyString(hold.playerName) || toNonEmptyString(hold.name);
        if (holdName && outgoingSignAndTradeNames.includes(holdName)) {
          return false;
        }
        return true;
      });
    }

    const outgoingPicks = teamTrade.picksOut || [];
    const incomingPicks: NormalizedTeamPick[] = [];
    payloadTeams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        incomingPicks.push(...(otherTeamTrade.picksOut || []));
      }
    });

    updatedTeam.draftPicks = [
      ...(Array.isArray(team.draftPicks) ? team.draftPicks : []).filter(
        (pick: NormalizedTeamPick) =>
          !outgoingPicks.some(
            (outgoing) =>
              outgoing.year === pick.year &&
              outgoing.round === pick.round &&
              outgoing.owner === pick.owner
          )
      ),
      ...incomingPicks,
    ];

    const outgoingEntitlementIds = (teamTrade.entitlementsOut || [])
      .map((e) => e.entitlementId || e.id)
      .filter(Boolean);

    const incomingEntitlementIds: string[] = [];
    payloadTeams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex === i) return;

      const otherOut = otherTeamTrade.entitlementsOut || [];

      otherOut.forEach((e: AnyRecord) => {
        const entIdRaw = e.entitlementId || e.id;
        if (!entIdRaw) return;
        const entId = String(entIdRaw);

        const toTeam = normalizeTradeTeamCodeLike(e.toTeamId);

        if (toTeam) {
          if (!payloadTeamCodes.includes(toTeam)) return;
          if (toTeam === thisTeamCode) incomingEntitlementIds.push(entId);
          return;
        }

        if (activeTeamCount > 2) {
          console.warn(
            `[tradeContext] Entitlement "${entId}" has no toTeamId in ${activeTeamCount}-team trade - skipping`
          );
          return;
        }

        incomingEntitlementIds.push(entId);
      });
    });

    if (
      outgoingEntitlementIds.length > 0 ||
      incomingEntitlementIds.length > 0
    ) {
      const currentEntitlementIds = Array.isArray(team.entitlementIds)
        ? team.entitlementIds
        : [];
      const newEntitlementIds = [
        ...currentEntitlementIds.filter(
          (id: string) => !outgoingEntitlementIds.includes(id)
        ),
        ...incomingEntitlementIds,
      ];
      updatedTeam.entitlementIds = [...new Set(newEntitlementIds)];
    }

    updatedTeam.tradeExceptions = buildSnapshotTradeExceptions({
      team,
      teamCode,
      timestamp,
    });

    updatedTeam.source = {
      ...(updatedTeam.source as AnyRecord),
      type: 'world-snapshot',
      lastModifiedAt: timestampISO,
    };

    updatedTeam.totals = computeTeamCapTotals(updatedTeam, currentEndYear);

    if (receivesSignAndTrade) {
      const totalsObj = updatedTeam.totals as AnyRecord | undefined;
      const existingLevel =
        totalsObj?.hardCapLevel ||
        (updatedTeam.hardCapped === 2 ? 'secondApron' : null);
      const hardCapLevel =
        existingLevel === 'secondApron' ? 'secondApron' : 'firstApron';

      updatedTeam.hardCapped = hardCapLevel === 'secondApron' ? 2 : 1;
      updatedTeam.hardCapLevel = hardCapLevel;
      updatedTeam.hardCapReason =
        'Triggered by receiving sign-and-trade player';
      updatedTeam.hardCapTriggeredBy = 'signAndTrade';
      updatedTeam.totals = {
        ...(totalsObj || {}),
        isHardCapped: true,
        hardCapLevel,
        hardCapDetail: 'Triggered by receiving sign-and-trade player',
      };
    }

    teamUpdates.push({ teamCode, team: updatedTeam });
  }

  const entitlementOwnership = new Map<string, string>();
  for (const { teamCode, team } of teamUpdates) {
    const entitlementIds = Array.isArray(team.entitlementIds)
      ? team.entitlementIds
      : [];
    for (const entId of entitlementIds) {
      const ownershipTeamCode = teamCode ?? 'UNKNOWN_TEAM';
      if (entitlementOwnership.has(entId)) {
        const otherTeam = entitlementOwnership.get(entId);
        throw new Error(
          `[tradeContext] INVARIANT VIOLATION: Entitlement "${entId}" would exist on both ${otherTeam} and ${ownershipTeamCode} after trade. This indicates a routing bug.`
        );
      }
      entitlementOwnership.set(entId, ownershipTeamCode);
    }
  }

  const validationTeams: ValidationTeam[] = payloadTeams.map(
    (teamTrade, idx) => {
      const teamUpdate = teamUpdates[idx];
      return {
        team: buildTradeValidationTeamRecord(
          teamUpdate.team,
          teamUpdate.teamCode
        ),
        teamCode: teamUpdate.teamCode,
        sends: validationSendsByTeam[idx] || [],
        receives: validationReceivesByTeam[idx] || [],
        picksOut: teamTrade.picksOut || [],
        picksIn: [],
        cashSent: teamTrade.cashSent || 0,
        cashReceived: teamTrade.cashReceived || 0,
        salaryMatchingElection: teamTrade.salaryMatchingElection ?? null,
      };
    }
  );

  return {
    teamUpdates,
    validationTeams,
    payloadTeams: payloadTeams,
    _isPostTradeSnapshot: true,
  };
}
