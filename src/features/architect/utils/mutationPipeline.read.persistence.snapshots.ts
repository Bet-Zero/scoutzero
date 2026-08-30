/**
 * Wave 42 Step 1: Snapshot, canonicalization, cap-audit, and write-summary
 * functions extracted from mutationPipeline.read.persistence.ts (lines 107–443).
 *
 * Contains addTeamSnapshot, buildTotalsByTeam, canonicalize helpers,
 * buildCapAuditDiffSummary, buildComputeWritesSummary, buildMutationFailureResult,
 * sanitizeStringList, and collectPlayerTouchIds.
 */

import {
  EMPTY_WRITES_SUMMARY,
  cloneWritesSummary,
  removeUndefinedDeep,
} from './mutationPipeline.helpers';
import { safeCloneForAudit } from './mutationPipeline.read.normalizeData';
import {
  normalizePostComputeTeamSnapshotForPostState,
  backfillCurrentStateBaseTeamPreservedFields,
  materializeCurrentStateTeamForAudit,
  stripComputeOnlyTeamFieldsForPersistence,
} from './mutationPipeline.read.normalizeTeam';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  createCanonicalTeamTotalsSnapshot,
  synchronizeTeamTotalsSnapshot,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { normalizeTeamTpeSchema } from '@/features/architect/utils/persistenceContracts';
import { sanitizeTransientFieldsForPersistence } from '@/features/architect/utils/persistenceContracts/enforcement';
import { getCapSettings } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import type { PostStateCapValidationInput } from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  ArchitectGeneralMutationCommittedTeamUpdate,
  ArchitectMutationPayload,
  ArchitectMutationResult,
  ArchitectMutationTeamUpdate,
  BuildTotalsTeamMap,
  ComputeResultLike,
  CurrentStateTeamPersistenceStripShape,
  CurrentStateTeamRoundTripMaterializable,
  GeneralMutationPersistenceTeamSnapshot,
  MutationBridgePlayerIdSlice,
  MutationBridgePlayerTouchSlice,
  MutationBridgeTeamUpdatesSlice,
  MutationBridgeWritesSlice,
  MutationDiffSummary,
  MutationFailureOverrides,
  MutationTeamMap,
  PostStateTotalsByTeam,
  TeamLike,
  WritesSummaryLike,
} from './mutationPipeline';

// Wave 11 Step 1: dashboard reload normalizers extracted to submodule
export * from './mutationPipeline.read.dashboardNormalizers';

export const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';

export function addTeamSnapshot(
  teamsByCode: MutationTeamMap,
  teamCode: string | null | undefined,
  team: TeamLike | null | undefined
) {
  if (!teamCode || !team || teamsByCode[teamCode]) {
    return;
  }
  teamsByCode[teamCode] = safeCloneForAudit(team);
}

export function extractTeamsByCodeFromComputeResult(
  computeResult: MutationBridgeTeamUpdatesSlice = {},
  worldId: string
): MutationTeamMap {
  const teamsByCode: MutationTeamMap = {};
  for (const update of computeResult.teamUpdates || []) {
    addTeamSnapshot(
      teamsByCode,
      update?.teamCode,
      normalizePostComputeTeamSnapshotForPostState(update?.team, {
        containingTeamCode: update?.teamCode ?? null,
        worldId,
      })
    );
  }
  return teamsByCode;
}

export function buildTotalsByTeam(
  teamsByCode: BuildTotalsTeamMap,
  year: number,
  asOfDate: string | null = null
): PostStateTotalsByTeam {
  const totalsByTeam: PostStateTotalsByTeam = {};
  for (const [teamCode, team] of Object.entries(teamsByCode)) {
    const canonicalTeam = asOfDate
      ? synchronizeTeamTotalsSnapshot(team, year, { asOfDate }) || team
      : team;
    totalsByTeam[teamCode] =
      canonicalTeam?.totals ||
      createCanonicalTeamTotalsSnapshot(team, year, { asOfDate });
  }
  return totalsByTeam;
}

export function prepareGeneralMutationPersistenceTeamSnapshot(
  team: CurrentStateTeamRoundTripMaterializable | null | undefined,
  seasonId: string,
  asOfDate: string | null = null
): GeneralMutationPersistenceTeamSnapshot {
  const persistenceReadyTeam = stripComputeOnlyTeamFieldsForPersistence(
    team as CurrentStateTeamPersistenceStripShape
  );
  const canonicalYear = toEndYear(seasonId);
  const totalsAlignedTeam = Number.isFinite(canonicalYear) && asOfDate
    ? backfillCurrentStateBaseTeamPreservedFields(
        synchronizeTeamTotalsSnapshot(persistenceReadyTeam, canonicalYear, {
          asOfDate,
        }) ||
          persistenceReadyTeam,
        persistenceReadyTeam
      ) || persistenceReadyTeam
    : persistenceReadyTeam;
  const afterSanitize =
    sanitizeTransientFieldsForPersistence(totalsAlignedTeam);
  const afterTpeNormalize = normalizeTeamTpeSchema(afterSanitize);

  return afterTpeNormalize as GeneralMutationPersistenceTeamSnapshot;
}

export function buildGeneralMutationCommittedTeamSnapshot(
  team: CurrentStateTeamRoundTripMaterializable | null | undefined,
  seasonId: string,
  asOfDate: string | null = null
): GeneralMutationPersistenceTeamSnapshot {
  return removeUndefinedDeep(
    prepareGeneralMutationPersistenceTeamSnapshot(team, seasonId, asOfDate)
  ) as GeneralMutationPersistenceTeamSnapshot;
}

export function buildGeneralMutationCommittedTeamUpdates(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  seasonId: string,
  asOfDate: string | null = null
): ArchitectGeneralMutationCommittedTeamUpdate[] {
  if (!Array.isArray(teamUpdates)) {
    return [];
  }

  return teamUpdates.map((update) => ({
    teamCode: update.teamCode,
    team: update?.team
      ? buildGeneralMutationCommittedTeamSnapshot(update.team, seasonId, asOfDate)
      : null,
  }));
}

export function canonicalizeTeamUpdatesWithCanonicalTotals(
  teamUpdates: ArchitectMutationTeamUpdate[] | null | undefined,
  seasonId: string,
  asOfDate: string | null = null
): ArchitectMutationTeamUpdate[] {
  const canonicalYear = toEndYear(seasonId);

  if (!Array.isArray(teamUpdates) || !Number.isFinite(canonicalYear)) {
    return Array.isArray(teamUpdates) ? teamUpdates : [];
  }

  return teamUpdates.map((update) => ({
    ...update,
    team: backfillCurrentStateBaseTeamPreservedFields(
      (asOfDate
        ? synchronizeTeamTotalsSnapshot(update?.team, canonicalYear, {
            asOfDate,
          }) || update?.team
        : update?.team) as CurrentStateTeamRoundTripMaterializable,
      update?.team as CurrentStateTeamRoundTripMaterializable
    ),
  }));
}

export function canonicalizeComputeResultTeamUpdates<T extends ComputeResultLike>(
  result: T,
  seasonId: string,
  asOfDate: string | null = null
): T {
  if (!Array.isArray(result?.teamUpdates) || result.teamUpdates.length === 0) {
    return result;
  }

  return {
    ...result,
    teamUpdates: canonicalizeTeamUpdatesWithCanonicalTotals(
      result.teamUpdates,
      seasonId,
      asOfDate
    ),
  };
}

export function collectMutationPlayerIds(
  payload: Pick<ArchitectMutationPayload, 'playerId' | 'teams'> = {},
  computeResult: MutationBridgePlayerIdSlice = {}
) {
  const playerIds = new Set();

  if (payload.playerId) {
    playerIds.add(String(payload.playerId));
  }

  for (const teamEntry of payload.teams || []) {
    for (const player of teamEntry.sends || []) {
      const playerId = player?.player_id || player?.id || player?.playerId;
      if (playerId) {
        playerIds.add(String(playerId));
      }
    }
  }

  for (const update of computeResult.playerUpdates || []) {
    if (update?.playerId) {
      playerIds.add(String(update.playerId));
    }
  }

  const tradedPlayerIds = Array.isArray(computeResult.metadata?.playersTraded)
    ? computeResult.metadata.playersTraded
    : [];
  for (const playerId of tradedPlayerIds) {
    if (playerId) {
      playerIds.add(String(playerId));
    }
  }

  return Array.from(playerIds);
}

export function buildPostStateRulesContext(
  year: number
): NonNullable<PostStateCapValidationInput['rulesContext']> {
  const capSettingsResult = getCapSettings({ year });
  const minimumTeamSalary = Number(capSettingsResult?.settings?.floor);

  return {
    capSettings: capSettingsResult?.settings || null,
    minimumTeamSalary: Number.isFinite(minimumTeamSalary)
      ? minimumTeamSalary
      : undefined,
    capSettingsSource: capSettingsResult?.source || null,
  };
}

export function buildCapAuditDiffSummary({
  beforeTeamsByCode = {},
  afterTeamsByCode = {},
}: {
  beforeTeamsByCode?: MutationTeamMap;
  afterTeamsByCode?: MutationTeamMap;
}): MutationDiffSummary {
  const teamCodes = Array.from(
    new Set([
      ...Object.keys(beforeTeamsByCode),
      ...Object.keys(afterTeamsByCode),
    ])
  );
  const changedPlayerIds = new Set();
  let deadCapChanged = 0;
  let exceptionsChanged = 0;

  for (const teamCode of teamCodes) {
    const beforeTeam = materializeCurrentStateTeamForAudit(
      beforeTeamsByCode[teamCode]
    );
    const afterTeam = materializeCurrentStateTeamForAudit(
      afterTeamsByCode[teamCode]
    );

    const beforeRoster = new Set((beforeTeam?.roster || []).map(String));
    const afterRoster = new Set((afterTeam?.roster || []).map(String));

    for (const playerId of beforeRoster) {
      if (!afterRoster.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }
    for (const playerId of afterRoster) {
      if (!beforeRoster.has(playerId)) {
        changedPlayerIds.add(playerId);
      }
    }

    if (
      JSON.stringify(beforeTeam?.deadCap || []) !==
      JSON.stringify(afterTeam?.deadCap || [])
    ) {
      deadCapChanged += 1;
    }
    if (
      JSON.stringify(beforeTeam?.exceptions || {}) !==
      JSON.stringify(afterTeam?.exceptions || {})
    ) {
      exceptionsChanged += 1;
    }
  }

  return {
    playersMoved: changedPlayerIds.size,
    deadCapChanged,
    exceptionsChanged,
    teamsTouched: teamCodes.length,
  };
}

export const FREE_AGENCY_MUTATION_TYPES = new Set([
  'signFreeAgent',
  'signAndTrade',
  'storeOfferSheet',
  'matchOfferSheet',
  'declineOfferSheet',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
  'renounceRights',
]);

export function buildComputeWritesSummary(
  computeResult: MutationBridgeWritesSlice = {}
): WritesSummaryLike {
  const teamCodes = (computeResult.teamUpdates || [])
    .map((update) => String(update?.teamCode || '').trim())
    .filter(Boolean);
  const playerIds = collectPlayerTouchIds(computeResult);
  const entitlementIds = (computeResult.entitlementUpdates || [])
    .map((update) => String(update?.entitlementId || '').trim())
    .filter(Boolean);

  return {
    ...cloneWritesSummary(),
    teamsPatched: teamCodes.length,
    teamCodes,
    playersPatched: playerIds.length,
    playerIds,
    entitlementsPatched: entitlementIds.length,
    entitlementIds,
  };
}

export function buildMutationFailureResult(
  error: unknown,
  overrides: MutationFailureOverrides = {}
): ArchitectMutationResult {
  const {
    appliedToLocalState = false,
    persistedToWorld = false,
    eventWritten = false,
    writesSummary = EMPTY_WRITES_SUMMARY,
    ...restOverrides
  } = overrides;

  return {
    success: false,
    error: error as string | Error,
    appliedToLocalState,
    persistedToWorld,
    eventWritten,
    writesSummary: cloneWritesSummary(writesSummary || EMPTY_WRITES_SUMMARY),
    ...restOverrides,
  };
}

export function sanitizeStringList(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((value) => String(value || '').trim()).filter(Boolean);
}

export function collectPlayerTouchIds(
  computeResult: MutationBridgePlayerTouchSlice = {}
): string[] {
  const playerIds = new Set<string>();

  for (const update of computeResult.playerUpdates || []) {
    const playerId = String(update?.playerId || '').trim();
    if (playerId) {
      playerIds.add(playerId);
    }
  }

  for (const deletion of computeResult.playerDeletes || []) {
    const playerId = String(deletion?.playerId || '').trim();
    if (playerId) {
      playerIds.add(playerId);
    }
  }

  return Array.from(playerIds);
}
