/**
 * FILE: src/features/architect/comparison/deriveComparisonViewModel.ts
 * PURPOSE: Aggregator — derives the Stage 3 comparison view model from committed event rows.
 * OWNERSHIP: Feature: architect/comparison
 *
 * Pure function. All inputs are plain data; no Firestore reads, no React, no state.
 * Authority is preserved on every output field.
 *
 * Event ordering: assumes committedEventRows are ordered newest-first (desc by occurredAt),
 * as returned by useWorldTeamEvents. The function sorts internally for safety.
 */

import type {
  Stage3CommittedEventReference,
  Stage3ComparisonViewModel,
  Stage3UnavailableSummaryEntry,
} from './types';
import { deriveRosterDelta } from './rosterDelta';
import { deriveCapDelta } from './capDelta';
import { detectSeasonMismatch } from './seasonMismatch';

type GenericRecord = Record<string, unknown>;

export type ComparisonEventRow = {
  id: string;
  eventId: string | null;
  occurredAt: string | null;
  mutationType: string | null;
  category?: string | null;
  playerIds: string[];
  teamCodes: string[];
  teamsInvolved: string[];
  beforeTotalsByTeam: GenericRecord;
  afterTotalsByTeam: GenericRecord;
};

export interface DeriveComparisonViewModelInput {
  worldId: string;
  worldName: string | null;
  teamCode: string;
  baselineSeason: string | null;
  currentSeason: string | null;
  /** Committed event rows for this world and team. Any ordering is accepted. */
  committedEventRows: ComparisonEventRow[];
  /**
   * Player IDs currently on the active team's roster.
   * Caller derives this from teamCapSheet.players using their ID normalization.
   */
  currentRosterPlayerIds: string[];
  /** From WorldMetadata.modifiedTeams. Best-effort; may be incomplete. */
  worldModifiedTeams?: string[] | null;
}

const EXCEPTION_DELTA_DEFERRED = {
  status: 'deferred' as const,
  reason:
    'Exception changes cannot be compared reliably yet after multiple moves.',
};

const DRAFT_UNAVAILABLE = {
  field: 'draftAssetDelta',
  reason: 'Draft pick changes are not part of this comparison yet.',
};

/** Sort events chronologically (oldest first) by occurredAt ISO string. */
function sortChronological(rows: ComparisonEventRow[]): ComparisonEventRow[] {
  return [...rows].sort((a, b) => {
    const at = a.occurredAt ?? '';
    const bt = b.occurredAt ?? '';
    if (at < bt) return -1;
    if (at > bt) return 1;
    return 0;
  });
}

export function deriveComparisonViewModel(
  input: DeriveComparisonViewModelInput
): Stage3ComparisonViewModel {
  const {
    worldId,
    worldName,
    teamCode,
    baselineSeason,
    currentSeason,
    committedEventRows,
    currentRosterPlayerIds,
    worldModifiedTeams,
  } = input;

  const unavailableSummary: Stage3UnavailableSummaryEntry[] = [];

  // Sort chronologically so index 0 is earliest, index N-1 is most recent.
  const sorted = sortChronological(committedEventRows);
  const committedEventCount = sorted.length;

  // Committed event references (deduplicated by eventId)
  const seenEventIds = new Set<string>();
  const committedEventReferences: Stage3CommittedEventReference[] = [];
  for (const row of sorted) {
    if (row.eventId && !seenEventIds.has(row.eventId)) {
      seenEventIds.add(row.eventId);
      committedEventReferences.push({
        eventId: row.eventId,
        mutationType: row.mutationType ?? 'unknown',
        occurredAt: row.occurredAt,
        authority: 'committed-world',
      });
    }
  }

  // Changed teams: accumulate from event teamsInvolved / teamCodes + world metadata
  const changedTeamCodesSet = new Set<string>();
  for (const row of sorted) {
    for (const code of [...(row.teamsInvolved ?? []), ...(row.teamCodes ?? [])]) {
      if (typeof code === 'string' && code.trim()) {
        changedTeamCodesSet.add(code.trim());
      }
    }
  }
  if (Array.isArray(worldModifiedTeams)) {
    for (const code of worldModifiedTeams) {
      if (typeof code === 'string' && code.trim()) {
        changedTeamCodesSet.add(code.trim());
      }
    }
  }

  // Changed players: accumulate all playerIds across all events
  const changedPlayerIdsSet = new Set<string>();
  for (const row of sorted) {
    for (const id of row.playerIds ?? []) {
      if (typeof id === 'string' && id.trim()) {
        changedPlayerIdsSet.add(id.trim());
      }
    }
  }

  // Roster delta
  const { rosterAdditions, rosterRemovals, rosterChangedPlayers } =
    deriveRosterDelta(sorted, currentRosterPlayerIds);

  // Cap delta: earliest event before-totals vs most recent event after-totals
  let capTotalDelta = null;
  let taxApronPostureDelta = null;

  if (sorted.length > 0) {
    const earliestEvent = sorted[0];
    const mostRecentEvent = sorted[sorted.length - 1];

    const capResult = deriveCapDelta(
      earliestEvent.beforeTotalsByTeam,
      mostRecentEvent.afterTotalsByTeam,
      teamCode
    );
    capTotalDelta = capResult.capTotalDelta;
    taxApronPostureDelta = capResult.taxApronPostureDelta;

    if (capTotalDelta === null) {
      unavailableSummary.push({
        field: 'capTotalDelta',
        reason:
          'A starting cap baseline is not available for this team yet.',
      });
    }
  } else {
    unavailableSummary.push({
      field: 'capTotalDelta',
      reason:
        'No saved moves in this season yet, so there is no cap change to show.',
    });
  }

  // Season mismatch detection
  const { hasMismatch, seasonAdvanceEventCount } = detectSeasonMismatch(sorted);
  if (hasMismatch) {
    unavailableSummary.push({
      field: 'seasonComparison',
      reason: `This season has been advanced ${seasonAdvanceEventCount} time(s), so cap changes span multiple seasons.`,
    });
  }

  // Draft delta is always deferred in Stage 3
  unavailableSummary.push(DRAFT_UNAVAILABLE);

  return {
    scope: {
      teamCode,
      worldId,
      worldName,
      baselineSeason,
      currentSeason,
      authority: 'committed-world',
    },
    rosterAdditions,
    rosterRemovals,
    rosterChangedPlayers,
    capTotalDelta,
    taxApronPostureDelta,
    exceptionDelta: EXCEPTION_DELTA_DEFERRED,
    changedTeams: {
      teamCodes: Array.from(changedTeamCodesSet),
      authority: 'committed-world / event-derived',
    },
    changedPlayers: {
      playerIds: Array.from(changedPlayerIdsSet),
      authority: 'committed-world / event-derived',
    },
    committedEventCount,
    committedEventReferences,
    isMultiSeasonComparison: hasMismatch,
    unavailableSummary,
  };
}
