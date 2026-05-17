/**
 * Wave 37 Step 1: Types and private helper functions extracted from
 * seasonManager.ts (lines 129–428).
 *
 * Contains all exported/private type definitions, the committed-state
 * builder constants, and the small utility functions that advanceSeasonInWorld
 * delegates to.
 */

import { getCapSettings } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import { removeUndefinedDeep } from './seasonManager.teamTransition';
import type {
  PostStateCapValidationInput,
  PostStateCapValidationIssue,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  OffseasonAppliedChangesSummary,
  OffseasonOptionDecisionMap,
  OffseasonTeamCapSheet,
} from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import type { TeamHistoryCapSheetLike } from '@/features/architect/history/TeamHistoryTab/types';
import type { LoadedWorldTeamCapSheet } from '@/features/architect/utils/worldTeamData';
import type { DAREResolutionReceipt } from '@/features/architect/utils/entitlements/dare';

// ============================================================
// Private type aliases
// ============================================================

type SeasonAdvancePreservedPersistenceFields = {
  city?: string | null;
  conference?: string | null;
  division?: string | null;
  source?: unknown;
  lastUpdated?: unknown;
  version?: unknown;
  mergedAt?: unknown;
  _meta?: unknown;
};

type SeasonAdvancePersistedTeamSnapshot = Pick<
  LoadedWorldTeamCapSheet,
  | 'teamCode'
  | 'teamName'
  | 'season'
  | 'abbreviation'
  | 'players'
  | 'roster'
  | 'capHolds'
  | 'deadCap'
  | 'draftPicks'
  | 'draftPicksInventory'
  | 'draftPicksObligations'
  | 'draftPicksContested'
  | 'entitlementIds'
  | 'offerSheets'
  | 'incomingOfferSheets'
  | 'exceptions'
  | 'totals'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
  | 'hardCapped'
> &
  Pick<OffseasonTeamCapSheet, 'exceptionHistory'> &
  SeasonAdvancePreservedPersistenceFields;

// Internal alias for the post-state validator's before/after team maps.
export type PostStateTeamSnapshots = NonNullable<
  PostStateCapValidationInput['beforeTeamsByCode']
>;

// These three types are also defined in seasonManager.teamTransition.ts.
// They stay here because SeasonAdvanceTeamSummary (a public type) references them.
export type StepienUpdate = { pickId: string; year: number; status: string; reason: string };
export type ConveyanceResolutionEntry = { pickId?: string; year?: number; outcome?: string; position?: number };
export type SwapResolutionEntry = { pickId?: string; year?: number; resolvedOwner?: string | null; resolvedPosition?: number | null };

// ============================================================
// Exported types
// ============================================================

export type SeasonAdvanceRequest = {
  fromSeason?: string;
  toSeason?: string;
  optionDecisions?: OffseasonOptionDecisionMap;
  focusTeamCode?: string;
};

export type SeasonAdvanceFocusTeamSnapshot = Pick<
  SeasonAdvancePersistedTeamSnapshot,
  | 'teamCode'
  | 'teamName'
  | 'season'
  | 'abbreviation'
  | 'players'
  | 'roster'
  | 'capHolds'
  | 'deadCap'
  | 'draftPicks'
  | 'offerSheets'
  | 'incomingOfferSheets'
  | 'exceptions'
  | 'exceptionHistory'
  | 'totals'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
  | 'hardCapped'
> &
  Pick<
    TeamHistoryCapSheetLike,
    'waivedContracts' | 'mleHistory' | 'pickLog' | 'currentPicks' | 'historyTimeline'
  >;

export type SeasonAdvanceCommittedTeamSnapshot = SeasonAdvancePersistedTeamSnapshot &
  Partial<SeasonAdvanceFocusTeamSnapshot>;

export type SeasonAdvanceExpiredTpe =
  OffseasonAppliedChangesSummary['expiredTPEs'][number] & {
    teamCode?: string;
  };

export type PostStateCapTotalsByTeam = NonNullable<
  PostStateCapValidationInput['beforeTotalsByTeam']
>;

export type SeasonAdvanceTeamSummary = Pick<
  OffseasonAppliedChangesSummary,
  | 'exercisedOptions'
  | 'declinedOptions'
  | 'expiredContracts'
  | 'transitionedExceptions'
> & {
  expiredTPEs: SeasonAdvanceExpiredTpe[];
  stepienUpdates: StepienUpdate[];
  conveyanceResolutions: ConveyanceResolutionEntry[];
  swapResolutions: SwapResolutionEntry[];
};

export type SeasonAdvanceSummary = SeasonAdvanceTeamSummary & {
  dareReceipt?: DAREResolutionReceipt;
  dareWriteCount?: number;
  dareError?: string;
};

export type SeasonAdvanceDraftResolutionInfo = {
  draftYear: number;
  hadPositions: boolean;
  resolvedConveyances?: number;
  resolvedSwaps?: number;
};

export type SeasonAdvanceCommittedMetadata = {
  currentSeason: string;
  currentYear: number;
  lastModifiedTeams: string[];
};

export type SeasonAdvanceCommittedEvent = {
  eventId: string;
  occurredAt: string;
};

/**
 * Commit-time season-advance artifact returned to the dashboard layer.
 * This guarantees the metadata/event written by the authoritative batch plus
 * an optional focus-team snapshot captured from that same commit window.
 * It does not replace the broader read-stack reload that may still be needed
 * for league-wide/world-visible reconciliation after season advance.
 */
export type SeasonAdvanceCommittedState = {
  metadata: SeasonAdvanceCommittedMetadata;
  event: SeasonAdvanceCommittedEvent;
  focusTeamCode?: string;
  focusTeamSnapshot?: SeasonAdvanceFocusTeamSnapshot | null;
};

export type SeasonAdvanceSuccessResult = {
  success: true;
  fromSeason: string;
  toSeason: string;
  updatedTeams: string[];
  summary: SeasonAdvanceSummary;
  draftResolutionInfo: SeasonAdvanceDraftResolutionInfo;
  committedState: SeasonAdvanceCommittedState;
};

export type SeasonAdvanceFailureResult = {
  success: false;
  error: string;
  worldSeason?: string;
  attemptedFromSeason?: string;
  attemptedToSeason?: string;
  violations?: PostStateCapValidationIssue[];
  warnings?: PostStateCapValidationIssue[];
};

type SeasonAdvanceResultBase = {
  toSeason?: string;
  summary?: SeasonAdvanceSummary;
  error?: string;
  violations?: PostStateCapValidationIssue[];
  warnings?: PostStateCapValidationIssue[];
};

export type SeasonAdvanceResult =
  | (SeasonAdvanceSuccessResult & SeasonAdvanceResultBase)
  | (SeasonAdvanceFailureResult & SeasonAdvanceResultBase);

// ============================================================
// Private committed-state builder helpers
// ============================================================

type BuildSeasonAdvanceCommittedStateParams = {
  metadata: SeasonAdvanceCommittedMetadata;
  event: SeasonAdvanceCommittedEvent;
  focusTeamCode: string | null;
  focusTeamSnapshot: SeasonAdvanceFocusTeamSnapshot | null;
};

export function buildSeasonAdvanceCommittedState({
  metadata,
  event,
  focusTeamCode,
  focusTeamSnapshot,
}: BuildSeasonAdvanceCommittedStateParams): SeasonAdvanceCommittedState {
  return {
    metadata,
    event,
    focusTeamCode: focusTeamCode ?? undefined,
    focusTeamSnapshot: focusTeamCode ? focusTeamSnapshot : null,
  };
}

const FOCUS_TEAM_SNAPSHOT_KEYS = [
  'teamCode',
  'teamName',
  'season',
  'abbreviation',
  'players',
  'roster',
  'capHolds',
  'deadCap',
  'draftPicks',
  'offerSheets',
  'incomingOfferSheets',
  'exceptions',
  'exceptionHistory',
  'totals',
  'hardCapLevel',
  'hardCapReason',
  'hardCapTriggeredBy',
  'hardCapped',
  'waivedContracts',
  'mleHistory',
  'pickLog',
  'currentPicks',
  'historyTimeline',
] as const satisfies readonly (keyof SeasonAdvanceFocusTeamSnapshot)[];

function copyFocusTeamSnapshotField<
  K extends keyof SeasonAdvanceFocusTeamSnapshot,
>(
  source: SeasonAdvanceCommittedTeamSnapshot,
  target: Partial<SeasonAdvanceFocusTeamSnapshot>,
  key: K
) {
  const value = source[key];
  if (value !== undefined) {
    target[key] = value as SeasonAdvanceFocusTeamSnapshot[K];
  }
}

export function buildSeasonAdvanceFocusTeamSnapshot(
  team: SeasonAdvanceCommittedTeamSnapshot
): SeasonAdvanceFocusTeamSnapshot {
  const snapshot: Partial<SeasonAdvanceFocusTeamSnapshot> = {};

  for (const key of FOCUS_TEAM_SNAPSHOT_KEYS) {
    copyFocusTeamSnapshotField(team, snapshot, key);
  }

  return removeUndefinedDeep(snapshot) as SeasonAdvanceFocusTeamSnapshot;
}

// ============================================================
// Small utility functions
// ============================================================

export function generateSeasonAdvanceOperationId(timestamp = Date.now()) {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `op_${timestamp}_${randomSuffix}`;
}

export function safeCloneForAudit(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
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

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}
