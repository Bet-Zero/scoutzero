/**
 * Wave 22 Step 2: Player persistence helpers extracted from
 * mutationPipeline.helpers.ts (lines 815–1179).
 */

import {
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
} from '@/features/architect/utils/tradeContext/tradeContext';
import type { TradeContextCurrentState } from '@/features/architect/utils/tradeContext/types';
import { removeUndefinedDeep } from './mutationPipeline.helpers.primitives';
import {
  normalizeCurrentStatePlayerSnapshot,
  normalizeCurrentStatePlayerOverridePersistenceSidecar,
  normalizeCurrentStatePlayerRfaBoundary,
} from './mutationPipeline.helpers.playerNorm';
import type {
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamUpdate,
  CurrentStatePlayerBio,
  PlayerDeleteLike,
  PlayerLike,
  PlayerUpdateLike,
  PersistablePlayerOverride,
  PersistablePlayerOverrideSource,
  TeamLike,
  TradeMutationPayload,
} from './mutationPipeline';

type MutationPlayerIdCarrier = Pick<
  ArchitectMutationPlayerRecord,
  'player_id' | 'playerId' | 'id'
>;

export function getMutationPlayerId(
  player: MutationPlayerIdCarrier | null | undefined
) {
  if (!player) return null;

  const rawId = player.player_id || player.playerId || player.id || null;
  if (!rawId) return null;

  const playerId = String(rawId).trim();
  return playerId || null;
}

export function findPlayerInTeamPlayers(
  team: TeamLike | null | undefined,
  playerId: string
): PlayerLike | null {
  const players = Array.isArray(team?.players)
    ? team.players
        .map((player) => normalizeCurrentStatePlayerSnapshot(player))
        .filter((player): player is PlayerLike => player !== null)
    : [];
  return (
    players.find((player) => getMutationPlayerId(player) === playerId) || null
  );
}

export function toPersistablePlayerOverrideFromNormalizedPlayer(
  normalizedPlayer: PersistablePlayerOverrideSource
): PersistablePlayerOverride {
  const playerId = getMutationPlayerId(normalizedPlayer);
  const bio =
    normalizedPlayer.bio &&
    typeof normalizedPlayer.bio === 'object' &&
    !Array.isArray(normalizedPlayer.bio)
      ? (normalizedPlayer.bio as CurrentStatePlayerBio)
      : undefined;
  const persistenceSidecar =
    normalizeCurrentStatePlayerOverridePersistenceSidecar(normalizedPlayer);
  const rfaBoundary = normalizeCurrentStatePlayerRfaBoundary(normalizedPlayer);

  return removeUndefinedDeep({
    playerId: playerId || undefined,
    displayName:
      normalizedPlayer.displayName ||
      normalizedPlayer.playerName ||
      normalizedPlayer.name ||
      bio?.displayName ||
      undefined,
    teamCode: normalizedPlayer.teamCode || undefined,
    teamName: normalizedPlayer.teamName || undefined,
    bio,
    contract: normalizedPlayer.contract || undefined,
    futureContract: normalizedPlayer.futureContract || undefined,
    ...persistenceSidecar,
    ...rfaBoundary,
  }) as PersistablePlayerOverride;
}

export function toPersistablePlayerOverrideFromSnapshot(
  player: unknown
): PersistablePlayerOverride | null {
  const normalizedPlayer = normalizeCurrentStatePlayerSnapshot(player);
  if (!normalizedPlayer) return null;
  return toPersistablePlayerOverrideFromNormalizedPlayer(normalizedPlayer);
}

export type TradePlayerMoveCandidate = {
  playerId: string;
  sourceTeamCode: string;
  destinationTeamCode: string;
};

export type CanonicalPlayerPersistenceMode = 'replace' | 'move';

export type CanonicalPlayerPersistenceCandidate = {
  playerId: string;
  destinationTeamCode: string;
  sourceTeamCode?: string;
  mode: CanonicalPlayerPersistenceMode;
};

export function buildCanonicalPlayerPersistenceManifest({
  teamUpdates,
  candidates,
  manifestLabel,
}: {
  teamUpdates: ArchitectMutationTeamUpdate[];
  candidates: CanonicalPlayerPersistenceCandidate[];
  manifestLabel: string;
}):
  | { success: true; playerUpdates: PlayerUpdateLike[]; playerDeletes: PlayerDeleteLike[] }
  | { success: false; error: string } {
  const destinationTeamsByCode = new Map<string, TeamLike | null>(
    teamUpdates.map((update) => [
      String(update.teamCode || '').trim(),
      (update.team || null) as TeamLike | null,
    ])
  );
  const uniqueCandidates = new Map<string, CanonicalPlayerPersistenceCandidate>();

  for (const candidate of candidates) {
    const playerId = String(candidate?.playerId || '').trim();
    const destinationTeamCode = String(candidate?.destinationTeamCode || '').trim();
    const sourceTeamCode = String(candidate?.sourceTeamCode || '').trim();
    const mode = candidate?.mode;

    if (!playerId) {
      return {
        success: false,
        error: `${manifestLabel} requires every candidate to have a stable playerId.`,
      };
    }

    if (!destinationTeamCode) {
      return {
        success: false,
        error: `${manifestLabel} could not conclusively resolve destination team for player ${playerId}.`,
      };
    }

    if (mode !== 'replace' && mode !== 'move') {
      return {
        success: false,
        error: `${manifestLabel} received an unsupported persistence mode for player ${playerId}.`,
      };
    }

    if (mode === 'replace' && sourceTeamCode && sourceTeamCode !== destinationTeamCode) {
      return {
        success: false,
        error: `${manifestLabel} received conflicting replace candidate teams for player ${playerId}.`,
      };
    }

    if (mode === 'move' && !sourceTeamCode) {
      return {
        success: false,
        error: `${manifestLabel} requires a source team for moved player ${playerId}.`,
      };
    }

    const normalizedCandidate: CanonicalPlayerPersistenceCandidate = {
      playerId,
      destinationTeamCode,
      sourceTeamCode: sourceTeamCode || undefined,
      mode,
    };

    const existing = uniqueCandidates.get(playerId);
    if (
      existing &&
      (existing.destinationTeamCode !== normalizedCandidate.destinationTeamCode ||
        existing.sourceTeamCode !== normalizedCandidate.sourceTeamCode ||
        existing.mode !== normalizedCandidate.mode)
    ) {
      return {
        success: false,
        error: `${manifestLabel} resolved conflicting persistence candidates for player ${playerId}.`,
      };
    }

    if (!existing) {
      uniqueCandidates.set(playerId, normalizedCandidate);
    }
  }

  const playerUpdates: PlayerUpdateLike[] = [];
  const playerDeletes: PlayerDeleteLike[] = [];

  for (const candidate of uniqueCandidates.values()) {
    const destinationTeam = destinationTeamsByCode.get(candidate.destinationTeamCode);
    if (!destinationTeam) {
      return {
        success: false,
        error: `${manifestLabel} could not find final destination team ${candidate.destinationTeamCode} for player ${candidate.playerId}.`,
      };
    }

    const finalPlayer = findPlayerInTeamPlayers(destinationTeam, candidate.playerId);
    if (!finalPlayer) {
      return {
        success: false,
        error: `${manifestLabel} could not find final destination snapshot player ${candidate.playerId} on ${candidate.destinationTeamCode}.`,
      };
    }

    if (
      normalizeTradeTeamCodeLike(finalPlayer.teamCode) !== candidate.destinationTeamCode
    ) {
      return {
        success: false,
        error: `${manifestLabel} found mismatched teamCode for player ${candidate.playerId} on destination ${candidate.destinationTeamCode}.`,
      };
    }

    const persistedPlayer = toPersistablePlayerOverrideFromSnapshot(finalPlayer);
    if (!persistedPlayer) {
      return {
        success: false,
        error: `${manifestLabel} could not normalize persisted player override for ${candidate.playerId}.`,
      };
    }

    playerUpdates.push({ playerId: candidate.playerId, player: persistedPlayer });

    if (
      candidate.mode === 'move' &&
      candidate.sourceTeamCode &&
      candidate.sourceTeamCode !== candidate.destinationTeamCode
    ) {
      playerDeletes.push({ playerId: candidate.playerId, teamCode: candidate.sourceTeamCode });
    }
  }

  return { success: true, playerUpdates, playerDeletes };
}

export function buildTradePlayerPersistenceManifest({
  payload,
  currentState,
  teamUpdates,
}: {
  payload: TradeMutationPayload;
  currentState: TradeContextCurrentState;
  teamUpdates: ArchitectMutationTeamUpdate[];
}):
  | { success: true; playerUpdates: PlayerUpdateLike[]; playerDeletes: PlayerDeleteLike[] }
  | { success: false; error: string } {
  const tradeTeams = Array.isArray(payload.teams) ? payload.teams : [];
  const payloadTeamCodes: string[] = [];

  tradeTeams.forEach((teamTrade, index) => {
    const sourceTeamCode = normalizeTradeTeamCodeLike(
      teamTrade.teamCode || currentState.teams[index]?.teamCode
    );
    if (sourceTeamCode) payloadTeamCodes.push(sourceTeamCode);
  });

  if (payloadTeamCodes.length !== tradeTeams.length) {
    return {
      success: false,
      error: 'Trade player persistence manifest could not resolve all source team codes.',
    };
  }

  const moveCandidates = new Map<string, TradePlayerMoveCandidate>();

  for (const [senderIndex, teamTrade] of tradeTeams.entries()) {
    const sourceTeamCode = payloadTeamCodes[senderIndex];

    for (const player of teamTrade.sends || []) {
      const playerId = getMutationPlayerId(player);
      if (!playerId) {
        return {
          success: false,
          error:
            'Trade player persistence manifest requires every moved player to have a stable playerId.',
        };
      }

      const destinationTeamCode = resolveOutgoingTradeDestinationTeamCode({
        payloadTeamCodes,
        senderIndex,
        player: player || {},
      });

      if (!destinationTeamCode || !sourceTeamCode) {
        return {
          success: false,
          error: `Trade player persistence manifest could not conclusively resolve source/destination for player ${playerId}.`,
        };
      }

      if (destinationTeamCode === sourceTeamCode) continue;

      const existing = moveCandidates.get(playerId);
      if (
        existing &&
        (existing.sourceTeamCode !== sourceTeamCode ||
          existing.destinationTeamCode !== destinationTeamCode)
      ) {
        return {
          success: false,
          error: `Trade player persistence manifest resolved conflicting destinations for player ${playerId}.`,
        };
      }

      if (!existing) {
        moveCandidates.set(playerId, { playerId, sourceTeamCode, destinationTeamCode });
      }
    }
  }

  return buildCanonicalPlayerPersistenceManifest({
    teamUpdates,
    candidates: Array.from(moveCandidates.values()).map((move) => ({
      ...move,
      mode: 'move' as const,
    })),
    manifestLabel: 'Trade player persistence manifest',
  });
}
