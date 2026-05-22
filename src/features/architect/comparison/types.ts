/**
 * FILE: src/features/architect/comparison/types.ts
 * PURPOSE: Stage 3 scenario comparison view model and authority label types.
 * OWNERSHIP: Feature: architect/comparison
 *
 * Every comparison field carries an explicit authority label so the UI can
 * present the source of each value without inventing deltas.
 * No Firestore reads, no React, no writes, no mutation authority.
 */

export type Stage3AuthorityLabel =
  | 'committed-world'
  | 'committed-world / event-derived'
  | 'deferred'
  | 'unavailable';

export interface Stage3RosterEntry {
  playerId: string;
  displayName: string | null;
  authority: 'committed-world / event-derived';
}

export interface Stage3CapTotalDelta {
  /** Delta in total cap allocations (after − before). Null if data is missing. */
  totalCapAllocationsDelta: number | null;
  /** Delta in cap space (after − before). Null if data is missing. */
  capSpaceDelta: number | null;
  /** Delta in tax space (after − before). Null if data is missing. */
  taxSpaceDelta: number | null;
  authority: 'committed-world / event-derived';
}

export interface Stage3TaxApronPostureDelta {
  /** True if the team was below the first apron before and is at or above it after. */
  crossedFirstApron: boolean | null;
  /** True if the team was below the second apron before and is above it after. */
  crossedSecondApron: boolean | null;
  /** True if the team was not hard-capped before and became hard-capped after. */
  hardCapActivated: boolean | null;
  authority: 'committed-world / event-derived';
}

export interface Stage3ExceptionDelta {
  status: 'deferred';
  reason: string;
}

export interface Stage3CommittedEventReference {
  eventId: string;
  mutationType: string;
  occurredAt: string | null;
  authority: 'committed-world';
}

export interface Stage3UnavailableSummaryEntry {
  field: string;
  reason: string;
}

export interface Stage3ChangedTeamsSummary {
  teamCodes: string[];
  authority: 'committed-world / event-derived';
}

export interface Stage3ChangedPlayersSummary {
  playerIds: string[];
  authority: 'committed-world / event-derived';
}

export interface Stage3ComparisonScope {
  teamCode: string;
  worldId: string;
  worldName: string | null;
  baselineSeason: string | null;
  currentSeason: string | null;
  authority: 'committed-world';
}

export interface Stage3ComparisonViewModel {
  scope: Stage3ComparisonScope;
  /** Players appearing in acquisition-type events who are currently on roster. */
  rosterAdditions: Stage3RosterEntry[];
  /** Players appearing in removal-type events who are no longer on roster. */
  rosterRemovals: Stage3RosterEntry[];
  /** Players appearing in contract-modification events who are still on roster. */
  rosterChangedPlayers: Stage3RosterEntry[];
  /** Cap allocation delta from earliest event baseline to latest event after-state. */
  capTotalDelta: Stage3CapTotalDelta | null;
  /** Tax/apron posture delta. Null if apron boolean data is absent. */
  taxApronPostureDelta: Stage3TaxApronPostureDelta | null;
  /** Exception delta is always deferred in Stage 3. */
  exceptionDelta: Stage3ExceptionDelta;
  /** All teams that appear in committed events or world metadata modifiedTeams. */
  changedTeams: Stage3ChangedTeamsSummary;
  /** All players that appear across all committed event playerIds. */
  changedPlayers: Stage3ChangedPlayersSummary;
  committedEventCount: number;
  committedEventReferences: Stage3CommittedEventReference[];
  /** True when the event stream includes season-advance events. */
  isMultiSeasonComparison: boolean;
  /** Fields that cannot be shown authoritatively. Always shown to the user. */
  unavailableSummary: Stage3UnavailableSummaryEntry[];
}
