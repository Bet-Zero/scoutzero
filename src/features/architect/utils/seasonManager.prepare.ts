/** Shared deterministic season preparation. No database reads, authority promotion or publication. */
import { DraftReviewSeasonReceiptZ } from '@/schemas/draftReviewSeason';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from './capLegality/postStateCapValidator';
import { createCanonicalTeamTotalsSnapshot } from './capTotals';
import type { buildSyntheticFreezeEvents } from './draftReview/seasonEvidence';
import { compactSyntheticSeasonEventTotals } from './draftReview/seasonTotals';
import { mutationSnapshotDigest } from './mutationPipeline.snapshotDigest';
import {
  assertPersistableOrThrow,
  normalizeTeamTpeSchema,
  PERSISTENCE_CONTRACTS,
} from './persistenceContracts';
import { sanitizeTransientFieldsForPersistence } from './persistenceContracts/enforcement';
import type { SeasonAdvanceAuthority } from './seasonManager.authority';
import { isNonEmptyString } from './seasonManager.draftResolution';
import {
  buildSeasonAdvanceFocusTeamSnapshot,
  safeCloneForAudit,
  type PostStateCapTotalsByTeam,
  type PostStateTeamSnapshots,
  type SeasonAdvanceCommittedMetadata,
  type SeasonAdvanceCommittedTeamSnapshot,
  type SeasonAdvanceExpiredTpe,
  type SeasonAdvanceFocusTeamSnapshot,
  type SeasonAdvanceRequest,
  type SeasonAdvanceSummary,
} from './seasonManager.helpers';
import {
  assertFirestoreDocumentSize,
  assertThirtyTeamLeague,
  buildPreparedSeasonAdvanceTeam,
  buildSeasonTransitionManifest,
  resolveCompleteOptionAuthority,
  type PreparedSeasonAdvanceTeam,
} from './seasonManager.history';
import {
  processTeamSeasonTransitionWithOptions,
  removeUndefinedDeep,
  toSeasonTransitionTeam,
  type DraftResolutionContext,
} from './seasonManager.teamTransition.core';
import type { LoadedWorldTeamCapSheet } from './worldTeamData';
const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';
const SEASON_ADVANCE_MUTATION_TYPE = 'seasonAdvance';
export async function prepareSeasonAdvance(args: {
  worldId: string;
  worldMeta: Record<string, unknown>;
  teams: LoadedWorldTeamCapSheet[];
  authority: SeasonAdvanceAuthority;
  operationId: string;
  occurredAt: string;
  optionDecisions: NonNullable<SeasonAdvanceRequest['optionDecisions']>;
  focusTeamCode: string | null;
  worldLineage: string[];
  draftReview: {
    freezeEvents: ReturnType<typeof buildSyntheticFreezeEvents>;
  } | null;
}) {
  const {
    worldId,
    worldMeta,
    teams,
    authority,
    operationId,
    occurredAt,
    optionDecisions,
    focusTeamCode,
    worldLineage,
    draftReview,
  } = args;
  const {
    fromSeason,
    toSeason,
    fromSalaryCapYear: fromYear,
    toSalaryCapYear: toYear,
    metadataAsOfDate: targetAsOfDate,
  } = authority;
  const draftYear = fromYear;
  const transitionId = `seasonAdvance__${fromSeason}__${toSeason}`;
  const eventId = transitionId;
  const authorityDigest = mutationSnapshotDigest(authority);
  const governedTeams: Record<string, unknown>[] = teams.map((team) => ({
    ...team,
  }));
  assertThirtyTeamLeague(governedTeams);
  if (focusTeamCode && !teams.some((team) => team.teamCode === focusTeamCode)) {
    throw new Error(
      `Focus team ${focusTeamCode} is not in the governed league.`
    );
  }
  const optionReferences = resolveCompleteOptionAuthority({
    teams: governedTeams,
    optionDecisions,
    toSeason,
    transitionEffectiveAt: authority.transitionEffectiveAt,
  });

  const preAdvanceMetadataDigest = mutationSnapshotDigest(worldMeta);
  const updatedTeams: string[] = [];
  let focusTeamSnapshot: SeasonAdvanceFocusTeamSnapshot | null = null;
  const beforeTeamsByCode: PostStateTeamSnapshots = {};
  const afterTeamsByCode: PostStateTeamSnapshots = {};
  const beforeTotalsByTeam: PostStateCapTotalsByTeam = {};
  const afterTotalsByTeam: PostStateCapTotalsByTeam = {};
  const summary: SeasonAdvanceSummary = {
    exercisedOptions: [],
    declinedOptions: [],
    expiredContracts: [],
    transitionedExceptions: [],
    stepienUpdates: [],
    expiredTPEs: [],
    // Phase 5: Track draft pick resolutions
    conveyanceResolutions: [],
    swapResolutions: [],
  };
  const preparedTeams: PreparedSeasonAdvanceTeam[] = [];

  for (const team of teams) {
    const transitionTeam = toSeasonTransitionTeam(team);
    const teamCode = transitionTeam.teamCode;
    if (!isNonEmptyString(teamCode)) {
      throw new Error(
        'Encountered team without teamCode during season advance'
      );
    }

    const draftResolutionContext: DraftResolutionContext = {
      draftYear,
      worldId,
      fromYear,
      toYear,
      transitionEffectiveAt: authority.transitionEffectiveAt,
      capProjections: authority.targetCapProjections,
      preserveDraftEntitlements: true,
    };

    const { committedTeam, teamSummary } =
      await processTeamSeasonTransitionWithOptions(
        transitionTeam,
        fromSeason,
        toSeason,
        optionDecisions,
        draftResolutionContext
      );

    if (teamSummary.exercisedOptions.length > 0) {
      summary.exercisedOptions.push(...teamSummary.exercisedOptions);
    }
    if (teamSummary.declinedOptions.length > 0) {
      summary.declinedOptions.push(...teamSummary.declinedOptions);
    }
    if (teamSummary.expiredContracts.length > 0) {
      summary.expiredContracts.push(...teamSummary.expiredContracts);
    }
    if (teamSummary.transitionedExceptions.length > 0) {
      summary.transitionedExceptions.push(
        ...teamSummary.transitionedExceptions
      );
    }
    if (teamSummary.stepienUpdates.length > 0) {
      summary.stepienUpdates.push(...teamSummary.stepienUpdates);
    }
    if (teamSummary.expiredTPEs?.length > 0) {
      // Embellish with team info for global summary
      summary.expiredTPEs.push(
        ...teamSummary.expiredTPEs.map(
          (tpe): SeasonAdvanceExpiredTpe => ({
            ...tpe,
            teamCode,
          })
        )
      );
    }
    if (!committedTeam) {
      throw new Error(
        `Season Advance did not prepare a committed state for ${teamCode}.`
      );
    }

    const beforeTeam = safeCloneForAudit(team) as Record<string, unknown>;
    const provisionalCommitted = safeCloneForAudit(
      committedTeam
    ) as SeasonAdvanceCommittedTeamSnapshot & Record<string, unknown>;
    const beforeTotals = createCanonicalTeamTotalsSnapshot(team, toYear, {
      asOfDate: authority.transitionEffectiveAt,
      capProjections: authority.targetCapProjections,
    });
    const afterTotals = createCanonicalTeamTotalsSnapshot(
      provisionalCommitted,
      toYear,
      {
        asOfDate: authority.transitionEffectiveAt,
        capProjections: authority.targetCapProjections,
      }
    );
    const committedWithTotals = {
      ...provisionalCommitted,
      totals: afterTotals,
    };
    const afterSanitize =
      sanitizeTransientFieldsForPersistence(committedWithTotals);
    const normalizedTeam = normalizeTeamTpeSchema(
      afterSanitize as SeasonAdvanceCommittedTeamSnapshot
    ) as SeasonAdvanceCommittedTeamSnapshot & Record<string, unknown>;
    assertPersistableOrThrow({
      obj: normalizedTeam,
      contract: PERSISTENCE_CONTRACTS.TEAM,
      label: 'TEAM',
    });
    const safeCommittedTeam = removeUndefinedDeep(normalizedTeam);

    beforeTeamsByCode[teamCode] = beforeTeam as PostStateTeamSnapshots[string];
    afterTeamsByCode[teamCode] = safeCloneForAudit(
      safeCommittedTeam
    ) as PostStateTeamSnapshots[string];
    beforeTotalsByTeam[teamCode] = beforeTotals;
    afterTotalsByTeam[teamCode] = afterTotals;
    preparedTeams.push(
      buildPreparedSeasonAdvanceTeam({
        worldId,
        transitionId,
        teamCode,
        beforeTeam,
        committedTeam: safeCommittedTeam,
        beforeTotals,
        afterTotals,
        authority,
        authorityDigest,
        optionDecisions,
        optionReferences,
        ...(draftReview
          ? {
              draftReviewFreezeEvent: draftReview.freezeEvents.find(
                (event) => event.originalPick.originalTeam === teamCode
              ),
            }
          : {}),
      })
    );
    if (focusTeamCode === teamCode) {
      const safeTeam = buildSeasonAdvanceFocusTeamSnapshot(safeCommittedTeam);
      focusTeamSnapshot = safeCloneForAudit(
        safeTeam
      ) as SeasonAdvanceFocusTeamSnapshot;
    }
    updatedTeams.push(teamCode);
  }

  const governedAmounts = Object.fromEntries(
    authority.targetInputManifest.systemLevels.map((input) => [
      input.levelId,
      input.amount,
    ])
  );
  // Season advance intentionally reuses the shared post-state final-artifact
  // validator after all 30 governed team and book snapshots are prepared.
  const postStateValidation = validatePostStateCapLegality({
    operationId,
    mutationType: SEASON_ADVANCE_MUTATION_TYPE,
    worldId,
    worldLineage,
    year: toYear,
    toYear,
    beforeTeamsByCode,
    afterTeamsByCode,
    beforeTotalsByTeam,
    afterTotalsByTeam,
    rulesContext: {
      capSettings: {
        salaryCap: governedAmounts['salary-cap'],
        floor: governedAmounts['minimum-team-salary'],
        luxuryTax: governedAmounts['tax-level'],
        firstApron: governedAmounts['first-apron'],
        secondApron: governedAmounts['second-apron'],
      },
      minimumTeamSalary: governedAmounts['minimum-team-salary'],
      capSettingsSource: `governed:${authority.targetInputManifest.registry.registryId}@v${authority.targetInputManifest.registry.registryVersion}`,
    },
  });

  if (!postStateValidation.valid) {
    return {
      success: false as const,
      error: 'Post-state cap validation failed for season advance',
      violations: postStateValidation.violations,
      warnings: postStateValidation.warnings || [],
    };
  }

  const teamCodes = updatedTeams.slice();
  const committedMetadata: SeasonAdvanceCommittedMetadata = {
    currentSeason: toSeason,
    currentYear: toYear,
    asOfDate: targetAsOfDate,
    lastModifiedTeams: teamCodes,
  };
  const diffSummary = {
    teamsAdvanced: teamCodes.length,
    optionsDecisionsCount: Object.keys(optionDecisions || {}).length,
    resolvedConveyances: summary.conveyanceResolutions.length,
    resolvedSwaps: summary.swapResolutions.length,
  };
  const eventPayload = {
    eventId,
    type: SEASON_ADVANCE_MUTATION_TYPE,
    timestamp: occurredAt,
    seasonId: toSeason,
    metadata: {
      type: SEASON_ADVANCE_MUTATION_TYPE,
      timestamp: occurredAt,
      fromSeason,
      toSeason,
      teamsInvolved: teamCodes,
      seasonTransitionId: transitionId,
      seasonHistoryIds: preparedTeams.map(
        (team) => team.historyRecord.historyId
      ),
      transitionEffectiveAt: authority.transitionEffectiveAt,
      governedSeasonInputManifest: authority.targetInputManifest,
      entitlementBoundary: authority.entitlementBoundary,
      contractEventIds: preparedTeams.flatMap(
        (team) => team.teamRecord.contractEventIds
      ),
      ...(draftReview
        ? {
            draftReviewSeasonReceipt: DraftReviewSeasonReceiptZ.parse({
              scope: 'synthetic-review-only',
              operationId,
              worldId,
              transitionId,
              fromSeason,
              toSeason,
              effectiveAt: authority.transitionEffectiveAt,
              releaseId: draftReview.freezeEvents[0].releaseId,
              releaseSha256: draftReview.freezeEvents[0].releaseSha256,
              entitlementState: 'preserved-exactly',
              entitlementStateDigests: Object.fromEntries(
                preparedTeams.map((team) => [
                  team.teamCode,
                  team.teamRecord.entitlementStateDigest,
                ])
              ),
              salaryBookHistory: Object.fromEntries(
                preparedTeams.map((team) => [
                  team.teamCode,
                  {
                    historyId: team.historyRecord.historyId,
                    beforeTotalsDigest: mutationSnapshotDigest(
                      team.historyRecord.beforeTotals
                    ),
                    afterTotalsDigest: mutationSnapshotDigest(
                      team.historyRecord.afterTotals
                    ),
                  },
                ])
              ),
              freezeEvents: draftReview.freezeEvents,
            }),
          }
        : {}),
    },
    teamsAffected: teamCodes,
    schemaVersion: CAP_AUDIT_EVENT_SCHEMA_VERSION,
    validatorVersion: POST_STATE_CAP_VALIDATOR_VERSION,
    operationId,
    mutationType: SEASON_ADVANCE_MUTATION_TYPE,
    occurredAt,
    worldId,
    teamCodes,
    playerIds: [] as string[],
    // The full books remain in each immutable history record in this same
    // transaction, with exact digests above. Avoid duplicating all30 detailed
    // ledgers inside the single synthetic event's Firestore document.
    beforeTotalsByTeam: draftReview
      ? compactSyntheticSeasonEventTotals(beforeTotalsByTeam)
      : beforeTotalsByTeam,
    afterTotalsByTeam: draftReview
      ? compactSyntheticSeasonEventTotals(afterTotalsByTeam)
      : afterTotalsByTeam,
    valid: postStateValidation.valid,
    violations: postStateValidation.violations,
    warnings: postStateValidation.warnings,
    diffSummary,
    mutationMetadata: {
      mutationType: SEASON_ADVANCE_MUTATION_TYPE,
      category: 'offseason',
      worldId,
      teams: teamCodes,
      players: [] as string[],
    },
  };
  const afterEventSanitize =
    sanitizeTransientFieldsForPersistence(eventPayload);
  assertPersistableOrThrow({
    obj: afterEventSanitize,
    contract: PERSISTENCE_CONTRACTS.EVENT,
    label: 'EVENT',
  });
  const safeEvent = removeUndefinedDeep(afterEventSanitize);
  assertFirestoreDocumentSize(safeEvent, 'Season Advance event');
  const manifest = buildSeasonTransitionManifest({
    transitionId,
    operationId,
    eventId,
    worldId,
    occurredAt,
    authority,
    authorityDigest,
    preAdvanceMetadataDigest,
    teams: preparedTeams,
  });

  return {
    success: true as const,
    preparedTeams,
    committedMetadata,
    safeEvent,
    manifest,
    summary,
    updatedTeams,
    focusTeamSnapshot,
    preAdvanceMetadataDigest,
    teamCodes,
  };
}
