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
  getLeague,
} from '@/features/architect/utils/teamLoader';
import { getDoc } from 'firebase/firestore';
import {
  worldPlayerRef,
  worldOfferSheetAuthorizationRef,
  worldTeamRef,
} from '@/features/architect/utils/architectFirestorePaths';
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
import { toCurrentStateTeam } from './mutationPipeline.read.normalizeTeam';
import { loadWorldGovernedOptionAuthority } from '@/features/architect/utils/optionDecisions';
import { loadWorldGovernedExtensionAuthority } from '@/features/architect/utils/extensions';
import { loadWorldGovernedWaiverAuthority } from '@/features/architect/utils/waivers';
import { mutationSnapshotDigest } from './mutationPipeline.snapshotDigest';
import {
  GovernedOfferSheetAuthorizationZ,
  GovernedOfferSheetEvidenceZ,
  GovernedOfferSheetLifecycleZ,
  type GovernedOfferSheetLifecycle,
} from '@/schemas/governedOfferSheet';
import { buildGovernedOfferSheetAuthorization } from '@/features/architect/utils/offerSheets';
import {
  attachGovernedTradeSalaryBasisToRoster,
  loadWorldGovernedTradeSalaryBasisEntries,
  resolveTradeSalaryBasisPlayerId,
} from '@/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { LIVE_GOVERNED_TRADE_SALARY_AUTHORITY } from '@/features/architect/utils/tradeContext/tradeContext.payloadNormalization';

// Wave 48 Step 1: lineage helpers extracted to submodule
export * from './mutationPipeline.read.stateLoader.lineage';
import {
  mergeLineageOverridePlayers,
  toLineageOverrideMergePlayer,
  resolveWorldLineage,
  getFirstExplicitWorldPlayerOverrideFromLineage,
  getWorldTeamSnapshotLineageReceipt,
  getWorldPlayerSnapshotLineageReceipt,
  getSnapshotRosterMembership,
  getSnapshotPlayersMembership,
  getSnapshotCapHoldMembership,
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
  MutationCurrentStatePlayerIngress,
  MutationCurrentStateTradeTeamIngress,
  MutationDocumentSnapshotReceipt,
  MutationPayloadLike,
  NormalizedMutationSalaryRow,
  PlayerDeleteLike,
  StoreOfferSheetOwnershipCandidate,
  SupportedComputeMutationType,
} from './mutationPipeline';

type TeamLineageReceipt = Awaited<
  ReturnType<typeof getWorldTeamSnapshotLineageReceipt>
>;

type StoreOfferSheetOwnershipCandidateWithReceipt =
  StoreOfferSheetOwnershipCandidate & {
    lineageReceipt: TeamLineageReceipt;
  };

function requireStableTeamLineageReceipt({
  before,
  after,
  teamCode,
}: {
  before: TeamLineageReceipt;
  after: TeamLineageReceipt;
  teamCode: string;
}): void {
  const beforeIdentity = {
    sourceWorldId: before.source?.snapshotWorldId ?? null,
    sourceDigest: before.source?.snapshotDigest ?? null,
    checkedSnapshots: before.checkedSnapshots,
  };
  const afterIdentity = {
    sourceWorldId: after.source?.snapshotWorldId ?? null,
    sourceDigest: after.source?.snapshotDigest ?? null,
    checkedSnapshots: after.checkedSnapshots,
  };
  if (
    mutationSnapshotDigest(beforeIdentity) !==
    mutationSnapshotDigest(afterIdentity)
  ) {
    throw new Error(
      `Team snapshot for ${teamCode} changed while the Offer Sheet creation state was loading. Reload and try again.`
    );
  }
}

function toOfferSheetCreationTeamReceipt(
  receipt: TeamLineageReceipt,
  worldId: string
): MutationDocumentSnapshotReceipt {
  const [local, ...ancestorLineage] = receipt.checkedSnapshots;
  if (!local || local.worldId !== worldId) {
    throw new Error(
      'Offer Sheet creation could not retain its exact Team lineage receipt.'
    );
  }
  return Object.freeze({
    exists: local.exists,
    digest: local.digest,
    sourceWorldId: receipt.source?.snapshotWorldId ?? null,
    sourceDigest: receipt.source?.snapshotDigest ?? null,
    sourceLineage: Object.freeze(
      local.exists ? [] : ancestorLineage.map((entry) => Object.freeze(entry))
    ),
  });
}

export async function resolveStoreOfferSheetAuthority({
  worldId,
  offeringTeamCode,
  playerId,
}: {
  worldId: string;
  offeringTeamCode: string;
  playerId: string;
}) {
  const lineageWorldIds = await resolveWorldLineage(worldId);
  const offeringLineageBefore = await getWorldTeamSnapshotLineageReceipt(
    lineageWorldIds,
    offeringTeamCode
  );
  const offeringTeam = await getTeam(worldId, offeringTeamCode).then((team) =>
    toCurrentStateTeam(
      team as MutationCurrentStateOfferSheetTeamIngress | null,
      'signing'
    )
  );

  if (!offeringTeam) {
    throw new Error(
      `storeOfferSheet requires an authoritative offering team snapshot for ${offeringTeamCode}.`
    );
  }

  const ownershipCandidates = (
    await Promise.all(
      AUTHORITATIVE_WORLD_TEAM_CODES.map(async (teamCode) => {
        const lineageReceipt = await getWorldTeamSnapshotLineageReceipt(
          lineageWorldIds,
          teamCode
        );
        const snapshotEntry = lineageReceipt.source;
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
        const capHoldMatch = getSnapshotCapHoldMembership(
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
          capHoldMatch,
          snapshotPlayer,
          lineageReceipt,
        } as StoreOfferSheetOwnershipCandidateWithReceipt;
      })
    )
  ).filter(Boolean) as StoreOfferSheetOwnershipCandidateWithReceipt[];

  const rosterOwners = ownershipCandidates.filter(
    (candidate) => candidate.rosterMatch === true
  );
  const playersOwners = ownershipCandidates.filter(
    (candidate) => candidate.playersMatch === true
  );
  const capHoldOwners = ownershipCandidates.filter(
    (candidate) => candidate.capHoldMatch === true
  );

  let resolvedOwner: StoreOfferSheetOwnershipCandidateWithReceipt | null = null;

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
  } else if (capHoldOwners.length === 1) {
    resolvedOwner = capHoldOwners[0];
  } else if (capHoldOwners.length > 1) {
    throw new Error(
      `Strict storeOfferSheet ownership is ambiguous for ${playerId}: multiple cap-hold rights owners found (${capHoldOwners
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

  if (
    overrideEntry &&
    !resolvedOwner.snapshotPlayer &&
    !resolvedOwner.capHoldMatch
  ) {
    throw new Error(
      `Strict storeOfferSheet source truth requires a home-team snapshot player for ${playerId} on ${resolvedOwner.teamCode} before applying override truth.`
    );
  }

  // BZE-283 authority is source-owned. Team snapshots and player overrides are
  // user-writable, so neither may author or replace the authenticated RFA/QO
  // evidence used to permit an Offer Sheet. Always read that evidence from the
  // immutable base player, while retaining world state for ownership and the
  // player's mutable display/contract fields.
  const immutableBasePlayer = toCurrentStatePlayer(
    await getPlayer(null, resolvedOwner.teamCode, playerId)
  );
  const sourcePlayer = resolvedOwner.snapshotPlayer || immutableBasePlayer;
  const sourceGovernedOfferSheetEvidence =
    immutableBasePlayer?.rfaContext?.governedEvidence;

  const canonicalPlayer = overrideEntry
    ? normalizeCurrentStatePlayerSnapshot(
        mergeLineageOverridePlayers(
          toLineageOverrideMergePlayer(sourcePlayer),
          toLineageOverrideMergePlayer(overrideEntry.player)
        )
      )
    : sourcePlayer;

  if (!canonicalPlayer) {
    throw new Error(
      `Strict storeOfferSheet source truth could not resolve player ${playerId} from authoritative home team ${resolvedOwner.teamCode}.`
    );
  }

  const [offeringLineageAfter, homeLineageAfter] = await Promise.all([
    getWorldTeamSnapshotLineageReceipt(lineageWorldIds, offeringTeamCode),
    getWorldTeamSnapshotLineageReceipt(lineageWorldIds, resolvedOwner.teamCode),
  ]);
  requireStableTeamLineageReceipt({
    before: offeringLineageBefore,
    after: offeringLineageAfter,
    teamCode: offeringTeamCode,
  });
  requireStableTeamLineageReceipt({
    before: resolvedOwner.lineageReceipt,
    after: homeLineageAfter,
    teamCode: resolvedOwner.teamCode,
  });

  return {
    team: offeringTeam,
    player: {
      ...canonicalPlayer,
      ...(canonicalPlayer.rfaContext ||
      sourceGovernedOfferSheetEvidence !== undefined
        ? {
            rfaContext: {
              ...(canonicalPlayer.rfaContext || {}),
              governedEvidence: sourceGovernedOfferSheetEvidence,
            },
          }
        : {}),
      teamCode: resolvedOwner.teamCode,
      teamName: resolvedOwner.team.teamName || canonicalPlayer.teamName || null,
    },
    teamCode: offeringTeamCode,
    homeTeam: resolvedOwner.team,
    offerSheetCreationSnapshots: Object.freeze({
      homeTeamCode: resolvedOwner.teamCode,
      offeringTeamCode,
      homeTeam: toOfferSheetCreationTeamReceipt(homeLineageAfter, worldId),
      offeringTeam: toOfferSheetCreationTeamReceipt(
        offeringLineageAfter,
        worldId
      ),
    }),
  };
}

function findRawOfferSheetById(
  offerSheets: unknown,
  offerSheetId: string
): Record<string, unknown> | null {
  if (!Array.isArray(offerSheets)) {
    return null;
  }
  return (
    (offerSheets as Array<Record<string, unknown>>).find(
      (sheet) =>
        Boolean(sheet) &&
        (String(sheet.id || '') === offerSheetId ||
          String(sheet.dedupKey || '') === offerSheetId)
    ) || null
  );
}

function requireImmutableOfferSheetResolutionAuthority({
  worldId,
  offerSheetId,
  homeTeamCode,
  offeringTeamCode,
  homeSheet,
  offeringSheet,
  immutableBasePlayer,
  authorizationDocument,
}: {
  worldId: string;
  offerSheetId: string;
  homeTeamCode: string;
  offeringTeamCode: string;
  homeSheet: Record<string, unknown> | null;
  offeringSheet: Record<string, unknown> | null;
  immutableBasePlayer: unknown;
  authorizationDocument: {
    exists: () => boolean;
    data: () => unknown;
  };
}) {
  const homeLifecycle = GovernedOfferSheetLifecycleZ.safeParse(
    homeSheet?.governedLifecycle
  );
  const offeringLifecycle = GovernedOfferSheetLifecycleZ.safeParse(
    offeringSheet?.governedLifecycle
  );
  const dedupKey = String(homeSheet?.dedupKey || '').trim();
  if (
    !homeLifecycle.success ||
    !offeringLifecycle.success ||
    homeLifecycle.data.status !== 'pending-match' ||
    offeringLifecycle.data.status !== 'pending-match' ||
    String(homeSheet?.id || '').trim() !== offerSheetId ||
    String(offeringSheet?.id || '').trim() !== offerSheetId ||
    String(offeringSheet?.dedupKey || '').trim() !== dedupKey ||
    mutationSnapshotDigest(homeLifecycle.data) !==
      mutationSnapshotDigest(offeringLifecycle.data)
  ) {
    throw new Error(
      'Offer Sheet resolution requires two identical pending mirrors before immutable authorization can be verified.'
    );
  }

  const expectedAuthorization = buildGovernedOfferSheetAuthorization({
    lifecycle: homeLifecycle.data,
    offerSheetId,
    dedupKey,
  });
  const storedAuthorization = authorizationDocument.exists()
    ? GovernedOfferSheetAuthorizationZ.safeParse(authorizationDocument.data())
    : null;
  if (
    !storedAuthorization?.success ||
    mutationSnapshotDigest(storedAuthorization.data) !==
      mutationSnapshotDigest(expectedAuthorization) ||
    storedAuthorization.data.worldId !== worldId ||
    storedAuthorization.data.homeTeamId !== homeTeamCode ||
    storedAuthorization.data.offeringTeamId !== offeringTeamCode
  ) {
    throw new Error(
      'Offer Sheet resolution authorization does not match the immutable creation anchor.'
    );
  }

  const basePlayer = toCurrentStatePlayer(
    immutableBasePlayer as MutationCurrentStatePlayerIngress | null
  );
  const immutableEvidence = GovernedOfferSheetEvidenceZ.safeParse(
    basePlayer?.rfaContext?.governedEvidence
  );
  if (
    !immutableEvidence.success ||
    mutationSnapshotDigest(immutableEvidence.data) !==
      expectedAuthorization.immutableEvidenceDigest
  ) {
    throw new Error(
      'Offer Sheet resolution authorization does not match immutable base evidence.'
    );
  }

  return Object.freeze({
    authorization: localDocumentSnapshotReceipt(authorizationDocument),
    immutableEvidenceDigest: expectedAuthorization.immutableEvidenceDigest,
  });
}

function localDocumentSnapshotReceipt(snapshot: {
  exists: () => boolean;
  data: () => unknown;
}) {
  const exists = snapshot.exists();
  return Object.freeze({
    exists,
    digest: exists ? mutationSnapshotDigest(snapshot.data()) : null,
  });
}

function requireStableLocalSnapshotReceipt({
  before,
  after,
  label,
}: {
  before: Readonly<{ exists: boolean; digest: string | null }>;
  after: Readonly<{ exists: boolean; digest: string | null }>;
  label: string;
}): void {
  if (before.exists !== after.exists || before.digest !== after.digest) {
    throw new Error(
      `${label} changed while the Offer Sheet resolution state was loading. Reload and try again.`
    );
  }
}

function rawTeamPlayerId(player: Record<string, unknown>): string {
  const bio =
    player.bio && typeof player.bio === 'object'
      ? (player.bio as Record<string, unknown>)
      : {};
  return String(
    player.id || player.player_id || player.playerId || bio.playerId || ''
  ).trim();
}

function rawRosterEntryId(entry: unknown): string {
  if (typeof entry === 'string') {
    return entry.trim();
  }
  if (entry && typeof entry === 'object') {
    const record = entry as Record<string, unknown>;
    return String(
      record.playerId || record.player_id || record.id || ''
    ).trim();
  }
  return '';
}

/**
 * BZE-191: one-click match/decline atomically MOVE the offer-sheet player, so
 * the shared resolution outcome needs the player's record on the home-team
 * snapshot. RFA targets are frequently free agents whose rights the home team
 * holds only through an unsigned cap hold (storeOfferSheet resolves ownership
 * "without rostering the player"), so the player is absent from home.players.
 * Materialize the player from authoritative truth and inject it onto the home
 * snapshot — mirroring the cap-hold rights resolution storeOfferSheet already
 * uses — without altering the proven outcome/guard logic. When the player is
 * already present this is a no-op, so the legacy finalize paths are unchanged.
 */
async function ensureOfferSheetPlayerOnHomeTeamSnapshot({
  worldId,
  homeTeam,
  offeringTeam,
  homeTeamCode,
  offerSheetId,
  payloadPlayerId,
}: {
  worldId: string;
  homeTeam: MutationCurrentStateOfferSheetTeamIngress | null;
  offeringTeam: MutationCurrentStateOfferSheetTeamIngress | null;
  homeTeamCode: string;
  offerSheetId: string;
  payloadPlayerId: string | null | undefined;
}): Promise<MutationCurrentStateOfferSheetTeamIngress | null> {
  if (!homeTeam) {
    return homeTeam;
  }

  const offerSheet =
    findRawOfferSheetById(homeTeam.incomingOfferSheets, offerSheetId) ||
    findRawOfferSheetById(offeringTeam?.offerSheets, offerSheetId);
  const playerId = String(payloadPlayerId || offerSheet?.playerId || '').trim();
  if (!playerId) {
    return homeTeam;
  }

  const existingPlayers = Array.isArray(homeTeam.players)
    ? homeTeam.players
    : [];
  if (
    existingPlayers.some(
      (player) =>
        Boolean(player) &&
        typeof player === 'object' &&
        rawTeamPlayerId(player as Record<string, unknown>) === playerId
    )
  ) {
    return homeTeam;
  }

  let resolvedPlayer: Record<string, unknown> | null = null;
  try {
    resolvedPlayer = (await getPlayer(
      worldId,
      homeTeamCode,
      playerId
    )) as Record<string, unknown>;
  } catch {
    // Fall through with the home team unchanged; the outcome's fail-closed
    // "player not found" guard then reports the real missing-truth error.
    return homeTeam;
  }
  if (!resolvedPlayer) {
    return homeTeam;
  }

  const injectedPlayer = {
    ...resolvedPlayer,
    teamCode: homeTeamCode,
    teamName: homeTeam.teamName || resolvedPlayer.teamName || null,
  };
  const existingRoster = Array.isArray(homeTeam.roster) ? homeTeam.roster : [];
  const rosterHasPlayer = existingRoster.some(
    (entry) => rawRosterEntryId(entry) === playerId
  );

  return {
    ...homeTeam,
    players: [...existingPlayers, injectedPlayer],
    roster: rosterHasPlayer ? existingRoster : [...existingRoster, playerId],
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

async function loadGovernedPlayerOperationSnapshotReceipts({
  worldId,
  teamCode,
  playerId,
}: {
  worldId: string;
  teamCode: string;
  playerId: string;
}) {
  const lineageWorldIds = await resolveWorldLineage(worldId);
  const ancestorWorldIds = lineageWorldIds.slice(1);
  const [teamDocument, playerDocument] = await Promise.all([
    getDoc(worldTeamRef(worldId, teamCode)),
    getDoc(worldPlayerRef(worldId, teamCode, playerId)),
  ]);
  const teamExists = teamDocument.exists();
  const playerExists = playerDocument.exists();
  const teamDigest = teamExists
    ? mutationSnapshotDigest(teamDocument.data())
    : null;
  const playerDigest = playerExists
    ? mutationSnapshotDigest(playerDocument.data())
    : null;
  const [ancestorTeamResolution, ancestorPlayerResolution] = await Promise.all([
    teamExists
      ? Promise.resolve({ source: null, checkedSnapshots: [] })
      : getWorldTeamSnapshotLineageReceipt(ancestorWorldIds, teamCode),
    playerExists
      ? Promise.resolve({ source: null, checkedSnapshots: [] })
      : getWorldPlayerSnapshotLineageReceipt(
          ancestorWorldIds,
          teamCode,
          playerId
        ),
  ]);
  return {
    team: {
      exists: teamExists,
      digest: teamDigest,
      sourceWorldId: teamExists
        ? worldId
        : (ancestorTeamResolution.source?.snapshotWorldId ?? null),
      sourceDigest: teamExists
        ? teamDigest
        : (ancestorTeamResolution.source?.snapshotDigest ?? null),
      sourceLineage: ancestorTeamResolution.checkedSnapshots,
    },
    player: {
      exists: playerExists,
      digest: playerDigest,
      sourceWorldId: playerExists
        ? worldId
        : (ancestorPlayerResolution.source?.overrideWorldId ?? null),
      sourceDigest: playerExists
        ? playerDigest
        : (ancestorPlayerResolution.source?.snapshotDigest ?? null),
      sourceLineage: ancestorPlayerResolution.checkedSnapshots,
    },
  };
}

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

      const tradeContext = payload.tradeCtx;
      const requiresGovernedSalaryBasis =
        tradeContext?.source === 'tradeMachine';
      const worldAsOfDate = String(
        payload.asOfDate ?? tradeContext?.asOfDate ?? ''
      ).slice(0, 10);
      const salaryCapYear = toEndYear(tradeContext?.yearKey);
      const [teamStates, worldTeams] = await Promise.all([
        Promise.all(teamCodes.map((code: string) => getTeam(worldId, code))),
        requiresGovernedSalaryBasis && worldAsOfDate && salaryCapYear !== null
          ? getLeague(worldId)
          : Promise.resolve([]),
      ]);
      const normalizedTeams = teamCodes.map((code, i) => ({
        teamCode: code,
        team: toCurrentStateTeam(
          (teamStates[i] as MutationCurrentStateTradeTeamIngress | null) ||
            null,
          'trade'
        ),
      }));
      if (!requiresGovernedSalaryBasis) {
        return { teams: normalizedTeams };
      }
      normalizedTeams.forEach(({ team }) => {
        if (!team) return;
        Object.defineProperty(team, LIVE_GOVERNED_TRADE_SALARY_AUTHORITY, {
          value: true,
          enumerable: false,
        });
      });

      if (!worldAsOfDate || salaryCapYear === null) {
        return { teams: normalizedTeams };
      }

      await Promise.all(
        normalizedTeams.map(async ({ teamCode, team }) => {
          if (!team) return;
          const rosterPlayers = Array.isArray(team.players) ? team.players : [];
          const rosterPlayerIds = rosterPlayers
            .map((player) => resolveTradeSalaryBasisPlayerId(player))
            .filter(Boolean);
          const entries = await loadWorldGovernedTradeSalaryBasisEntries({
            worldId,
            teamId: String(teamCode).toUpperCase(),
            rosterPlayerIds,
            worldTeams,
            worldAsOfDate,
            salaryCapYear,
          });
          team.players = attachGovernedTradeSalaryBasisToRoster(
            rosterPlayers,
            entries
          );
        })
      );
      return {
        teams: normalizedTeams,
      };
    }

    case 'signFreeAgent': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const signingSnapshots =
        await loadGovernedPlayerOperationSnapshotReceipts({
          worldId,
          teamCode: String(teamCode),
          playerId: String(playerId),
        });
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
      let signingPriorTeamSnapshot = null;
      if (homeTeamCode && homeTeamCode !== teamCode) {
        const [loadedHomeTeam, priorSnapshots] = await Promise.all([
          getTeam(worldId, homeTeamCode),
          loadGovernedPlayerOperationSnapshotReceipts({
            worldId,
            teamCode: String(homeTeamCode),
            playerId: String(playerId),
          }),
        ]);
        homeTeam = toCurrentStateTeam(
          loadedHomeTeam as MutationCurrentStateOfferSheetTeamIngress | null,
          'offerSheetMirror'
        );
        signingPriorTeamSnapshot = priorSnapshots.team;
      }

      return {
        team: toCurrentStateTeam(
          team as MutationCurrentStateOfferSheetTeamIngress | null,
          'signing'
        ),
        player: toCurrentStatePlayer(player),
        teamCode,
        homeTeam,
        signingTeamSnapshot: signingSnapshots.team,
        signingPlayerSnapshot: signingSnapshots.player,
        signingPriorTeamSnapshot,
      };
    }

    case 'waivePlayer': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      const contractId = payload.contractId;
      if (!teamCode || !playerId || !contractId) {
        throw new Error(
          'Governed waiver requires teamCode, playerId, and contractId.'
        );
      }
      const snapshotReceipts =
        await loadGovernedPlayerOperationSnapshotReceipts({
          worldId,
          teamCode,
          playerId,
        });
      const [team, player] = (await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ])) as [LoadedMutationTeam, LoadedMutationPlayer];
      const waiverAuthority = await loadWorldGovernedWaiverAuthority({
        worldId,
        contractId: String(contractId),
        overlays: Array.isArray(team?.contractEventLedgers)
          ? team.contractEventLedgers
          : [],
      });
      return {
        team: toCurrentStateTeam(
          team as MutationCurrentStateBaseTeamIngress | null,
          'playerOps'
        ),
        player: toCurrentStatePlayer(player),
        teamCode,
        waiverAuthority,
        waiverTeamSnapshot: snapshotReceipts.team,
        waiverPlayerSnapshot: snapshotReceipts.player,
      };
    }

    case 'extendPlayer': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      const contractId = payload.contractId;
      if (!teamCode || !playerId || !contractId) {
        throw new Error(
          'Governed extension requires teamCode, playerId, and contractId.'
        );
      }
      const snapshotReceipts =
        await loadGovernedPlayerOperationSnapshotReceipts({
          worldId,
          teamCode,
          playerId,
        });
      const [team, player] = (await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ])) as [LoadedMutationTeam, LoadedMutationPlayer];
      const extensionAuthority = await loadWorldGovernedExtensionAuthority({
        worldId,
        contractId: String(contractId),
        overlays: Array.isArray(team?.contractEventLedgers)
          ? team.contractEventLedgers
          : [],
      });
      return {
        team: toCurrentStateTeam(
          team as MutationCurrentStateBaseTeamIngress | null,
          'playerOps'
        ),
        player: toCurrentStatePlayer(player),
        teamCode,
        extensionAuthority,
        extensionTeamSnapshot: snapshotReceipts.team,
        extensionPlayerSnapshot: snapshotReceipts.player,
      };
    }

    case 'optionDecision': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      const contractId = payload.contractId;
      if (!teamCode || !playerId || !contractId) {
        throw new Error(
          'Governed option decision requires teamCode, playerId, and contractId.'
        );
      }
      const [team, player] = (await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ])) as [LoadedMutationTeam, LoadedMutationPlayer];
      const optionAuthority = await loadWorldGovernedOptionAuthority({
        worldId,
        teamId: teamCode,
        contractId: String(contractId),
        overlays: Array.isArray(team?.contractEventLedgers)
          ? team.contractEventLedgers
          : [],
      });
      return {
        team: toCurrentStateTeam(
          team as MutationCurrentStateBaseTeamIngress | null,
          'playerOps'
        ),
        player: toCurrentStatePlayer(player),
        teamCode,
        optionAuthority,
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

      // Capture the exact local documents before and after merged state loading.
      // The double read closes the gap between teamLoader's merged snapshot and
      // the raw receipt later checked inside the persistence transaction.
      const [homeTeamDocumentBefore, offeringTeamDocumentBefore] =
        await Promise.all([
          getDoc(worldTeamRef(worldId, homeTeamCode)),
          getDoc(worldTeamRef(worldId, offeringTeamCode)),
        ]);
      const homeTeamReceiptBefore = localDocumentSnapshotReceipt(
        homeTeamDocumentBefore
      );
      const offeringTeamReceiptBefore = localDocumentSnapshotReceipt(
        offeringTeamDocumentBefore
      );
      const homeTeamDataBefore = homeTeamDocumentBefore.exists()
        ? homeTeamDocumentBefore.data()
        : {};
      const offeringTeamDataBefore = offeringTeamDocumentBefore.exists()
        ? offeringTeamDocumentBefore.data()
        : {};
      const rawHomeOfferSheet = findRawOfferSheetById(
        (homeTeamDataBefore as Record<string, unknown>).incomingOfferSheets,
        offerSheetId
      );
      const rawOfferingOfferSheet = findRawOfferSheetById(
        (offeringTeamDataBefore as Record<string, unknown>).offerSheets,
        offerSheetId
      );
      const rawOfferSheet = rawHomeOfferSheet || rawOfferingOfferSheet;
      const resolutionPlayerId = String(
        payload.playerId || rawOfferSheet?.playerId || ''
      ).trim();
      const [
        homePlayerDocumentBefore,
        offeringPlayerDocumentBefore,
        authorizationDocument,
        immutableBasePlayer,
      ] = resolutionPlayerId
        ? await Promise.all([
            getDoc(worldPlayerRef(worldId, homeTeamCode, resolutionPlayerId)),
            getDoc(
              worldPlayerRef(worldId, offeringTeamCode, resolutionPlayerId)
            ),
            getDoc(worldOfferSheetAuthorizationRef(worldId, offerSheetId)),
            getPlayer(null, homeTeamCode, resolutionPlayerId),
          ])
        : [null, null, null, null];
      if (!authorizationDocument) {
        throw new Error(
          'Offer Sheet resolution requires a stable player identity for immutable authorization.'
        );
      }
      const immutableAuthority = requireImmutableOfferSheetResolutionAuthority({
        worldId,
        offerSheetId,
        homeTeamCode,
        offeringTeamCode,
        homeSheet: rawHomeOfferSheet,
        offeringSheet: rawOfferingOfferSheet,
        immutableBasePlayer,
        authorizationDocument,
      });

      const [homeTeamRaw, offeringTeamRaw] = await Promise.all([
        getTeam(worldId, homeTeamCode),
        getTeam(worldId, offeringTeamCode),
      ]);

      // BZE-191: match/decline are now atomic resolutions that move the player,
      // so they require the full resolution team snapshot (players + rosters),
      // identical to the legacy two-step finalize path. RFA targets are often
      // free agents whose rights the home team holds only via an unsigned cap
      // hold, so the player may be absent from the home snapshot — materialize
      // and inject it before normalizing the resolution state.
      const homeTeam = await ensureOfferSheetPlayerOnHomeTeamSnapshot({
        worldId,
        homeTeam:
          (homeTeamRaw as MutationCurrentStateOfferSheetTeamIngress | null) ||
          null,
        offeringTeam:
          (offeringTeamRaw as MutationCurrentStateOfferSheetTeamIngress | null) ||
          null,
        homeTeamCode,
        offerSheetId,
        payloadPlayerId: payload.playerId as string | null | undefined,
      });

      const [
        homeTeamDocument,
        offeringTeamDocument,
        homePlayerDocument,
        offeringPlayerDocument,
      ] = await Promise.all([
        getDoc(worldTeamRef(worldId, homeTeamCode)),
        getDoc(worldTeamRef(worldId, offeringTeamCode)),
        resolutionPlayerId
          ? getDoc(worldPlayerRef(worldId, homeTeamCode, resolutionPlayerId))
          : Promise.resolve(null),
        resolutionPlayerId
          ? getDoc(
              worldPlayerRef(worldId, offeringTeamCode, resolutionPlayerId)
            )
          : Promise.resolve(null),
      ]);
      const homeTeamReceipt = localDocumentSnapshotReceipt(homeTeamDocument);
      const offeringTeamReceipt =
        localDocumentSnapshotReceipt(offeringTeamDocument);
      const homePlayerReceipt = homePlayerDocument
        ? localDocumentSnapshotReceipt(homePlayerDocument)
        : { exists: false, digest: null };
      const offeringPlayerReceipt = offeringPlayerDocument
        ? localDocumentSnapshotReceipt(offeringPlayerDocument)
        : { exists: false, digest: null };
      requireStableLocalSnapshotReceipt({
        before: homeTeamReceiptBefore,
        after: homeTeamReceipt,
        label: `Team snapshot for ${homeTeamCode}`,
      });
      requireStableLocalSnapshotReceipt({
        before: offeringTeamReceiptBefore,
        after: offeringTeamReceipt,
        label: `Team snapshot for ${offeringTeamCode}`,
      });
      requireStableLocalSnapshotReceipt({
        before: homePlayerDocumentBefore
          ? localDocumentSnapshotReceipt(homePlayerDocumentBefore)
          : { exists: false, digest: null },
        after: homePlayerReceipt,
        label: `Player snapshot for ${resolutionPlayerId} on ${homeTeamCode}`,
      });
      requireStableLocalSnapshotReceipt({
        before: offeringPlayerDocumentBefore
          ? localDocumentSnapshotReceipt(offeringPlayerDocumentBefore)
          : { exists: false, digest: null },
        after: offeringPlayerReceipt,
        label: `Player snapshot for ${resolutionPlayerId} on ${offeringTeamCode}`,
      });

      return {
        homeTeam: toCurrentStateTeam(homeTeam, 'offerSheetResolution'),
        offeringTeam: toCurrentStateTeam(
          (offeringTeamRaw as MutationCurrentStateOfferSheetTeamIngress | null) ||
            null,
          'offerSheetResolution'
        ),
        offerSheetId,
        offerSheetResolutionSnapshots: {
          playerId: resolutionPlayerId,
          homeTeamCode,
          offeringTeamCode,
          homeTeam: homeTeamReceipt,
          offeringTeam: offeringTeamReceipt,
          homePlayer: homePlayerReceipt,
          offeringPlayer: offeringPlayerReceipt,
          authorization: immutableAuthority.authorization,
          immutableEvidenceDigest: immutableAuthority.immutableEvidenceDigest,
        },
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
  signingDate,
  governedLifecycle,
}: {
  offerSheet: ArchitectMutationOfferSheet;
  signingTeam: string;
  signedUsing: string;
  timestamp: number;
  signingDate?: string;
  governedLifecycle?: GovernedOfferSheetLifecycle;
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

  const resolutionEvent = governedLifecycle?.events.at(-1);
  const matchRestriction =
    governedLifecycle && resolutionEvent?.eventKind === 'offer-sheet-matched'
      ? {
          restrictionVersion: 1 as const,
          lifecycleId: governedLifecycle.ledgerId,
          eventId: resolutionEvent.eventId,
          matchedAt: resolutionEvent.executedAt,
          restrictedUntil: resolutionEvent.restrictionsUntil,
          offeringTeamId: governedLifecycle.offeringTeamId,
          playerTradeConsentRequired:
            resolutionEvent.playerTradeConsentRequired,
          offeringTeamTradeBarred: resolutionEvent.offeringTeamTradeBarred,
          signAndTradeBarred: resolutionEvent.signAndTradeBarred,
        }
      : undefined;

  const normalizedContract = normalizeContractForWorld({
    contractType: 'Standard',
    signedUsing,
    signingTeam,
    signingDate: signingDate || new Date(timestamp).toISOString(),
    contractLength: contractYearsCandidate,
    years: contractYearsCandidate,
    totalValue,
    salariesByYear,
    freeAgency: undefined,
    rfaOfferSheet: undefined,
    rfaOfferSheetOnly: undefined,
    rfaOfferSheetStatus: undefined,
    tradeRestrictions: matchRestriction
      ? [
          `Matched Offer Sheet: player consent required and offering team trade barred through ${matchRestriction.restrictedUntil}`,
          `Matched Offer Sheet: contract amendment and sign-and-trade barred through ${matchRestriction.restrictedUntil}`,
        ]
      : undefined,
    offerSheetMatchRestriction: matchRestriction,
  }) as ArchitectMutationContract | null;

  return removeUndefinedDeep(normalizedContract) as ArchitectMutationContract;
}
