/**
 * FILE: src/features/architect/utils/mutationPipeline.read.stateLoader.ts
 * PURPOSE: State-loading entry point — resolveStoreOfferSheetAuthority,
 *          loadStateForMutation, and offer-sheet lifecycle helpers.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 5 Step 4: Extracted from mutationPipeline.read.ts (L929-end).
 * Wave 48 Step 1: Lineage helpers extracted to submodule.
 */

import {
  getTeam,
  getPlayer,
} from '@/features/architect/utils/teamLoader';
import {
  normalizeContractForWorld,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';

import {
  AUTHORITATIVE_WORLD_TEAM_CODES,
  normalizeCurrentStatePlayerSnapshot,
  removeUndefinedDeep,
  toCurrentStatePlayer,
} from './mutationPipeline.helpers';
import {
  toCurrentStateTeam,
} from './mutationPipeline.read.normalizeTeam';

// Wave 48 Step 1: lineage helpers extracted to submodule
export * from './mutationPipeline.read.stateLoader.lineage';
import {
  mergeLineageOverridePlayers,
  toLineageOverrideMergePlayer,
  resolveWorldLineage,
  getFirstExplicitWorldTeamSnapshotFromLineage,
  getFirstExplicitWorldPlayerOverrideFromLineage,
  getSnapshotRosterMembership,
  getSnapshotPlayersMembership,
} from './mutationPipeline.read.stateLoader.lineage';

import type {
  ArchitectMutationContract,
  ArchitectMutationOfferSheet,
  ArchitectMutationPlayerRecord,
  LoadedMutationCurrentStateByType,
  LoadedMutationPlayer,
  LoadedMutationTeam,
  MutationCurrentState,
  MutationCurrentStateBaseTeamIngress,
  MutationCurrentStateOfferSheetTeamIngress,
  MutationCurrentStateTradeTeamIngress,
  MutationPayloadLike,
  NormalizedMutationSalaryRow,
  PlayerDeleteLike,
  StoreOfferSheetOwnershipCandidate,
  SupportedComputeMutationType,
} from './mutationPipeline';

export async function resolveStoreOfferSheetAuthority({
  worldId,
  offeringTeamCode,
  playerId,
}: {
  worldId: string;
  offeringTeamCode: string;
  playerId: string;
}) {
  const [offeringTeam, lineageWorldIds] = await Promise.all([
    getTeam(worldId, offeringTeamCode).then((team) =>
      toCurrentStateTeam(
        team as MutationCurrentStateOfferSheetTeamIngress | null,
        'signing'
      )
    ),
    resolveWorldLineage(worldId),
  ]);

  if (!offeringTeam) {
    throw new Error(
      `storeOfferSheet requires an authoritative offering team snapshot for ${offeringTeamCode}.`
    );
  }

  const ownershipCandidates = (
    await Promise.all(
      AUTHORITATIVE_WORLD_TEAM_CODES.map(async (teamCode) => {
        const snapshotEntry =
          await getFirstExplicitWorldTeamSnapshotFromLineage(
            lineageWorldIds,
            teamCode
          );
        if (!snapshotEntry) {
          return null;
        }

        const rosterMatch = getSnapshotRosterMembership(
          snapshotEntry.team,
          playerId
        );
        const { playersMatch, snapshotPlayer } = getSnapshotPlayersMembership(
          snapshotEntry.team,
          playerId
        );

        if (
          rosterMatch !== null &&
          playersMatch !== null &&
          rosterMatch !== playersMatch
        ) {
          throw new Error(
            `Strict storeOfferSheet ownership conflict for ${playerId}: ${teamCode} snapshot roster membership disagrees with players[] membership.`
          );
        }

        return {
          teamCode,
          snapshotWorldId: snapshotEntry.snapshotWorldId,
          team: snapshotEntry.team,
          rosterMatch,
          playersMatch,
          snapshotPlayer,
        } as StoreOfferSheetOwnershipCandidate;
      })
    )
  ).filter(Boolean) as StoreOfferSheetOwnershipCandidate[];

  const rosterOwners = ownershipCandidates.filter(
    (candidate) => candidate.rosterMatch === true
  );
  const playersOwners = ownershipCandidates.filter(
    (candidate) => candidate.playersMatch === true
  );

  let resolvedOwner: StoreOfferSheetOwnershipCandidate | null = null;

  if (rosterOwners.length === 1) {
    resolvedOwner = rosterOwners[0];
  } else if (rosterOwners.length > 1) {
    throw new Error(
      `Strict storeOfferSheet ownership is ambiguous for ${playerId}: multiple roster owners found (${rosterOwners
        .map((candidate) => candidate.teamCode)
        .join(', ')}).`
    );
  } else if (playersOwners.length === 1) {
    resolvedOwner = playersOwners[0];
  } else if (playersOwners.length > 1) {
    throw new Error(
      `Strict storeOfferSheet ownership is ambiguous for ${playerId}: multiple players[] owners found (${playersOwners
        .map((candidate) => candidate.teamCode)
        .join(', ')}).`
    );
  } else {
    throw new Error(
      `Strict storeOfferSheet ownership could not resolve an authoritative home team for ${playerId} from world snapshots.`
    );
  }

  if (resolvedOwner.teamCode === offeringTeamCode) {
    throw new Error(
      `storeOfferSheet requires a distinct home team. Player ${playerId} resolves to offering team ${offeringTeamCode}.`
    );
  }

  const overrideEntry = await getFirstExplicitWorldPlayerOverrideFromLineage(
    lineageWorldIds,
    resolvedOwner.teamCode,
    playerId
  );

  if (overrideEntry && !resolvedOwner.snapshotPlayer) {
    throw new Error(
      `Strict storeOfferSheet source truth requires a home-team snapshot player for ${playerId} on ${resolvedOwner.teamCode} before applying override truth.`
    );
  }

  const canonicalPlayer = overrideEntry
    ? normalizeCurrentStatePlayerSnapshot(
        mergeLineageOverridePlayers(
          toLineageOverrideMergePlayer(resolvedOwner.snapshotPlayer),
          toLineageOverrideMergePlayer(overrideEntry.player)
        )
      )
    : resolvedOwner.snapshotPlayer;

  if (!canonicalPlayer) {
    throw new Error(
      `Strict storeOfferSheet source truth could not resolve player ${playerId} from authoritative home team ${resolvedOwner.teamCode}.`
    );
  }

  return {
    team: offeringTeam,
    player: {
      ...canonicalPlayer,
      teamCode: resolvedOwner.teamCode,
      teamName: resolvedOwner.team.teamName || canonicalPlayer.teamName || null,
    },
    teamCode: offeringTeamCode,
    homeTeam: resolvedOwner.team,
  };
}


// ==============================================================================
// MAIN ENTRY POINT
// ==============================================================================

/**
 * Apply a mutation to an Architect world.
 *
 * This is the public entrypoint for general / point-in-time Architect world mutations.
 * It is not the single entrypoint for every committed-write operation in Architect;
 * season/world transitions remain in seasonManager.ts.
 * General mutations flow through: READ → COMPUTE → VALIDATE → PERSIST → POST-UPDATE
 *
 * @param {MutationInput} input - Mutation parameters
 * @returns {Promise<MutationResult>} - Result of the mutation
 */
// ==============================================================================
// PHASE 1: READ - Load state for mutation
// ==============================================================================

/**
 * Load required state for a mutation.
 * Uses teamLoader to respect world → parent → base fallback chain.
 *
 * @param {string} worldId
 * @param {MutationType} mutationType
 * @param {Object} payload
 * @returns {Promise<Object>} Current state needed for mutation
 */
export async function loadStateForMutation<
  TMutationType extends SupportedComputeMutationType,
>(
  worldId: string,
  mutationType: TMutationType,
  payload: MutationPayloadLike
): Promise<LoadedMutationCurrentStateByType[TMutationType]>;
export async function loadStateForMutation(
  worldId: string,
  mutationType: string,
  payload: MutationPayloadLike
): Promise<MutationCurrentState> {
  switch (mutationType) {
    case 'executeTrade': {
      // Load all teams involved in trade
      const teamCodes: string[] = (payload.teams || []).map(
        (teamTrade, index) => {
          const code = teamTrade.teamCode || teamTrade.team?.teamCode;
          if (!code) {
            throw new Error(
              `Missing teamCode for trade entry at index ${index}. Payload: ${JSON.stringify(teamTrade)}`
            );
          }
          return String(code);
        }
      );

      const teamStates = await Promise.all(
        teamCodes.map((code: string) => getTeam(worldId, code))
      );
      return {
        teams: teamCodes.map((code, i) => ({
          teamCode: code,
          team: toCurrentStateTeam(
            (teamStates[i] as MutationCurrentStateTradeTeamIngress | null) ||
              null,
            'trade'
          ),
        })),
      };
    }

    case 'signFreeAgent': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const [team, player] = (await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ])) as [LoadedMutationTeam, LoadedMutationPlayer];

      // For RFA finalization, we may need to clean up the home team's incomingOfferSheets
      const homeTeamCode = (player.teamCode || player.contract?.signingTeam) as
        | string
        | null
        | undefined;
      let homeTeam = null;
      if (homeTeamCode && homeTeamCode !== teamCode) {
        homeTeam = toCurrentStateTeam(
          (await getTeam(
            worldId,
            homeTeamCode
          )) as MutationCurrentStateOfferSheetTeamIngress | null,
          'offerSheetMirror'
        );
      }

      return {
        team: toCurrentStateTeam(
          team as MutationCurrentStateOfferSheetTeamIngress | null,
          'signing'
        ),
        player: toCurrentStatePlayer(player),
        teamCode,
        homeTeam,
      };
    }

    case 'waivePlayer': // fallthrough
    case 'extendPlayer': // fallthrough
    case 'optionDecision': {
      // Load single team and player
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;

      if (!teamCode) {
        throw new Error(`Missing teamCode in payload for ${mutationType}`);
      }
      if (!playerId) {
        throw new Error(`Missing playerId in payload for ${mutationType}`);
      }

      const team = await getTeam(worldId, teamCode);
      const player = await getPlayer(worldId, teamCode, playerId);
      return {
        team: toCurrentStateTeam(
          team as MutationCurrentStateBaseTeamIngress | null,
          'playerOps'
        ),
        player: toCurrentStatePlayer(player),
        teamCode,
      };
    }

    case 'storeOfferSheet': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const authority = await resolveStoreOfferSheetAuthority({
        worldId,
        offeringTeamCode: String(teamCode),
        playerId: String(playerId),
      });
      return {
        ...authority,
        team: authority.team,
        homeTeam: authority.homeTeam,
      };
    }

    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet': {
      // Match / decline / finalizeMatched are home-team actions.
      // finalizeDeclined is an offering-team action and must load the explicit homeTeamCode.
      const homeTeamCode =
        mutationType === 'finalizeDeclinedOfferSheet'
          ? (payload.homeTeamCode as string | null | undefined) ||
            (payload.teamCode as string | null | undefined)
          : (payload.teamCode as string | null | undefined) ||
            (payload.homeTeamCode as string | null | undefined);
      const offeringTeamCode = payload.offeringTeamCode as
        | string
        | null
        | undefined;
      const offerSheetId = payload.offerSheetId as string | null | undefined;

      if (!homeTeamCode) throw new Error(`Missing homeTeamCode`);
      if (!offeringTeamCode) throw new Error(`Missing offeringTeamCode`);
      if (!offerSheetId) throw new Error(`Missing offerSheetId`);

      const [homeTeam, offeringTeam] = await Promise.all([
        getTeam(worldId, homeTeamCode),
        getTeam(worldId, offeringTeamCode),
      ]);
      const isOfferSheetMirrorMutation =
        mutationType === 'matchOfferSheet' ||
        mutationType === 'declineOfferSheet';

      return {
        homeTeam: isOfferSheetMirrorMutation
          ? toCurrentStateTeam(
              (homeTeam as MutationCurrentStateOfferSheetTeamIngress | null) ||
                null,
              'offerSheetMirror'
            )
          : toCurrentStateTeam(
              (homeTeam as MutationCurrentStateOfferSheetTeamIngress | null) ||
                null,
              'offerSheetResolution'
            ),
        offeringTeam: isOfferSheetMirrorMutation
          ? toCurrentStateTeam(
              (offeringTeam as MutationCurrentStateOfferSheetTeamIngress | null) ||
                null,
              'offerSheetMirror'
            )
          : toCurrentStateTeam(
              (offeringTeam as MutationCurrentStateOfferSheetTeamIngress | null) ||
                null,
              'offerSheetResolution'
            ),
        offerSheetId,
      };
    }

    case 'signAndTrade': {
      const { teamCode, destinationTeamCode, playerId } = payload;
      if (!teamCode) throw new Error('Missing source teamCode');
      if (!destinationTeamCode) throw new Error('Missing destinationTeamCode');
      if (!playerId) throw new Error('Missing playerId');

      const [team, destinationTeam, player] = await Promise.all([
        getTeam(worldId, teamCode as string),
        getTeam(worldId, destinationTeamCode as string),
        getPlayer(worldId, teamCode as string, playerId as string),
      ]);

      return {
        team: toCurrentStateTeam(
          (team as MutationCurrentStateTradeTeamIngress | null) || null,
          'trade'
        ),
        destinationTeam: toCurrentStateTeam(
          (destinationTeam as MutationCurrentStateTradeTeamIngress | null) ||
            null,
          'trade'
        ),
        player: toCurrentStatePlayer(player || null),
        teamCode: teamCode as string,
      };
    }

    case 'renounceRights': {
      // Renounce rights: player may only exist in team's players array or cap holds
      // (free agents with cap holds might not have a base player record)
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;

      if (!teamCode) {
        throw new Error(`Missing teamCode in payload for renounceRights`);
      }
      if (!playerId) {
        throw new Error(`Missing playerId in payload for renounceRights`);
      }

      const team = toCurrentStateTeam(
        (await getTeam(
          worldId,
          teamCode
        )) as MutationCurrentStateBaseTeamIngress | null,
        'playerOps'
      );
      if (!team) {
        throw new Error(`Team ${teamCode} not found for renounceRights`);
      }

      // Try to find player in team's players array first (prioritize ID match)
      const playerInTeam = (team.players || []).find((p) => {
        const pid = p.player_id || p.id;
        // Prioritize exact ID match
        if (pid && pid === playerId) return true;
        // Fall back to name match only if ID isn't available
        if (!pid && p.name === playerId) return true;
        return false;
      });

      // If found in team, use that data
      if (playerInTeam) {
        return { team, player: playerInTeam, teamCode };
      }

      // Try to find in cap holds
      const capHold = (team.capHolds || []).find(
        (h) => h.playerId === playerId || h.playerName === playerId
      );

      if (capHold) {
        // Build minimal player object from cap hold
        // Use 'None' for bird rights since we're renouncing (will be cleared anyway)
        return {
          team,
          player: {
            player_id: capHold.playerId as string | null,
            name: capHold.playerName as string | null,
            displayName: capHold.playerName as string | null,
            contract: { birdRights: { status: 'None' } },
          },
          teamCode,
        };
      }

      // Finally, try base player collection
      try {
        const player = toCurrentStatePlayer(
          await getPlayer(worldId, teamCode, playerId)
        );
        return { team, player, teamCode };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- rethrows with context
      } catch (_err) {
        throw new Error(
          `Player ${playerId} not found in team roster, cap holds, or base collection`
        );
      }
    }

    case 'setDeadCap': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = toCurrentStateTeam(
        (await getTeam(
          worldId,
          teamCode
        )) as MutationCurrentStateBaseTeamIngress | null,
        'manualCap'
      );
      return { team, teamCode };
    }

    case 'setExceptions': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = toCurrentStateTeam(
        (await getTeam(
          worldId,
          teamCode
        )) as MutationCurrentStateBaseTeamIngress | null,
        'manualCap'
      );
      return { team, teamCode };
    }

    default:
      throw new Error(`Unknown mutation type: ${mutationType}`);
  }
}

export function withDefaultPlayerDeletes<T>(
  result: T & { playerDeletes?: PlayerDeleteLike[] }
): Omit<T, 'playerDeletes'> & { playerDeletes: PlayerDeleteLike[] } {
  return {
    ...result,
    playerDeletes: Array.isArray(result.playerDeletes)
      ? result.playerDeletes
      : [],
  };
}

export type MutationPlayerIdCarrier = Pick<
  ArchitectMutationPlayerRecord,
  'player_id' | 'playerId' | 'id'
>;






export function matchesOfferSheetIdentity(
  offerSheet: ArchitectMutationOfferSheet | null | undefined,
  offerSheetId: string,
  dedupKey?: string | null
) {
  if (!offerSheet) {
    return false;
  }

  const normalizedDedupKey = String(dedupKey || '').trim();
  return (
    String(offerSheet.id || '') === offerSheetId ||
    (normalizedDedupKey.length > 0 &&
      String(offerSheet.dedupKey || '') === normalizedDedupKey)
  );
}

export function removeOfferSheetEntries(
  entries: ArchitectMutationOfferSheet[] | null | undefined,
  offerSheetId: string,
  dedupKey?: string | null
): ArchitectMutationOfferSheet[] {
  const normalizedOfferSheetId = String(offerSheetId || '').trim();
  const normalizedDedupKey = String(dedupKey || '').trim();

  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter((entry) => {
    const entryId = String(entry.id || '').trim();
    const entryDedupKey = String(entry.dedupKey || '').trim();

    if (normalizedOfferSheetId && entryId === normalizedOfferSheetId) {
      return false;
    }

    if (normalizedDedupKey && entryDedupKey === normalizedDedupKey) {
      return false;
    }

    return true;
  });
}

export function buildNormalizedOfferSheetFinalContract({
  offerSheet,
  signingTeam,
  signedUsing,
  timestamp,
}: {
  offerSheet: ArchitectMutationOfferSheet;
  signingTeam: string;
  signedUsing: string;
  timestamp: number;
}) {
  const salariesByYear = (offerSheet.salariesByYear || [])
    .map(normalizeSalaryRow)
    .filter((row): row is NormalizedMutationSalaryRow => row != null);
  const contractYearsCandidate =
    Number(offerSheet.contractYears) || salariesByYear.length;

  if (
    salariesByYear.length === 0 ||
    !Number.isFinite(contractYearsCandidate) ||
    contractYearsCandidate <= 0
  ) {
    return null;
  }

  const computedTotalValue = salariesByYear.reduce(
    (sum, row) => sum + (Number(row.salary ?? row.capHit) || 0),
    0
  );
  const explicitTotalValue = Number(offerSheet.totalValue);
  const totalValue =
    Number.isFinite(explicitTotalValue) && explicitTotalValue > 0
      ? explicitTotalValue
      : computedTotalValue > 0
        ? computedTotalValue
        : undefined;

  const normalizedContract = normalizeContractForWorld({
    contractType: 'Standard',
    signedUsing,
    signingTeam,
    signingDate: new Date(timestamp).toISOString(),
    contractLength: contractYearsCandidate,
    years: contractYearsCandidate,
    totalValue,
    salariesByYear,
    freeAgency: undefined,
    rfaOfferSheet: undefined,
    rfaOfferSheetOnly: undefined,
    rfaOfferSheetStatus: undefined,
  }) as ArchitectMutationContract | null;

  return removeUndefinedDeep(normalizedContract) as ArchitectMutationContract;
}


