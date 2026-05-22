/**
 * FILE: src/features/architect/comparison/index.ts
 * PURPOSE: Public API for the Stage 3 scenario comparison module.
 * OWNERSHIP: Feature: architect/comparison
 */

export type {
  Stage3AuthorityLabel,
  Stage3RosterEntry,
  Stage3CapTotalDelta,
  Stage3TaxApronPostureDelta,
  Stage3ExceptionDelta,
  Stage3CommittedEventReference,
  Stage3UnavailableSummaryEntry,
  Stage3ChangedTeamsSummary,
  Stage3ChangedPlayersSummary,
  Stage3ComparisonScope,
  Stage3ComparisonViewModel,
} from './types';

export type { EventRowForRoster, RosterDeltaResult } from './rosterDelta';
export { deriveRosterDelta } from './rosterDelta';

export type { CapDeltaResult } from './capDelta';
export { deriveCapDelta } from './capDelta';

export type { EventRowForSeasonCheck, SeasonMismatchResult } from './seasonMismatch';
export { detectSeasonMismatch } from './seasonMismatch';

export type {
  ComparisonEventRow,
  DeriveComparisonViewModelInput,
} from './deriveComparisonViewModel';
export { deriveComparisonViewModel } from './deriveComparisonViewModel';
