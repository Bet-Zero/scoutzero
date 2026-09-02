/**
 * FILE: src/features/architect/GMDashboard/sections/ComparisonSection.tsx
 * PURPOSE: Stage 3C read-only comparison tab — shows committed scenario changes for the active team.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Pure render component. Receives a Stage3ComparisonViewModel and status from the
 * dashboard via useArchitectComparisonViewModel. No mutation authority, no Firestore
 * reads, no new event source. Every displayed value preserves its authority label.
 */

import type {
  Stage3ComparisonViewModel,
  Stage3RosterEntry,
  Stage3CapTotalDelta,
  Stage3TaxApronPostureDelta,
  Stage3UnavailableSummaryEntry,
} from '@/features/architect/comparison/types';
import type { ComparisonViewModelStatus } from '../hooks/useArchitectComparisonViewModel';
import {
  describeCompareFocus,
  type FollowThroughContext,
} from '@/features/architect/cockpit';
import { TeamListFull } from '@/constants/teamList';

const TEAM_NAME_BY_CODE = new Map<string, string>(
  TeamListFull.map((team) => [team.code, team.teamName])
);

interface ComparisonSectionProps {
  status: ComparisonViewModelStatus;
  viewModel: Stage3ComparisonViewModel | null;
  error?: string | null;
  onNavigateToHistory?: (() => void) | null;
  onNavigateToCapSheet?: (() => void) | null;
  onNavigateToRoster?: (() => void) | null;
  /** Follow-through launch context (Slice 5): drives the focused-view banner. */
  followThroughContext?: FollowThroughContext | null;
  /**
   * World create/select control (the shared WorldSelector) surfaced inline on
   * the sandbox empty-state so users aren't dead-ended (SBX-001).
   */
  worldPickerSlot?: React.ReactNode;
}

/** Context-focused banner shown when Compare is launched with follow-through. */
const CompareFocusBanner = ({ context }: { context: FollowThroughContext }) => {
  const focus = describeCompareFocus(context);
  if (!focus) return null;
  return (
    <div
      className="rounded-md border border-cockpit-edge bg-cockpit-slab px-4 py-2"
      data-testid="comparison-focus-banner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-cockpit-text-secondary">
          {focus.heading}
        </span>
      </div>
      {focus.authority === 'unavailable' ? (
        <p className="mt-1 text-[11px] text-cockpit-text-muted">
          Player-level comparison is not available yet. Showing the saved team
          changes below.
        </p>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SectionCard = ({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) => (
  <div
    className="rounded-md border border-cockpit-edge bg-cockpit-slab px-4 py-3 space-y-2"
    data-testid={testId}
  >
    {children}
  </div>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-semibold text-cockpit-text-muted uppercase tracking-wider mb-1">
    {children}
  </h3>
);

const fmtDelta = (v: number | null): string => {
  if (v === null) return '—';
  const abs = Math.abs(v) / 1_000_000;
  return `${v >= 0 ? '+' : '−'}$${abs.toFixed(1)}M`;
};

const RosterList = ({
  entries,
  emptyLabel,
}: {
  entries: Stage3RosterEntry[];
  emptyLabel: string;
}) => {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-cockpit-text-ghost italic">{emptyLabel}</p>
    );
  }
  return (
    <ul className="space-y-0.5">
      {entries.map((entry) => (
        <li
          key={entry.playerId}
          className="text-xs text-cockpit-text-secondary"
        >
          {entry.displayName || 'Player'}
        </li>
      ))}
    </ul>
  );
};

const CapDeltaDisplay = ({ delta }: { delta: Stage3CapTotalDelta }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
    <dt className="text-cockpit-text-muted">Team Salary</dt>
    <dd
      className={`font-mono ${
        delta.teamSalaryDelta === null
          ? 'text-cockpit-text-ghost'
          : delta.teamSalaryDelta > 0
            ? 'text-cockpit-danger'
            : 'text-cockpit-safe'
      }`}
    >
      {fmtDelta(delta.teamSalaryDelta)}
    </dd>
    <dt className="text-cockpit-text-muted">Apron Team Salary</dt>
    <dd className="font-mono">{fmtDelta(delta.apronTeamSalaryDelta)}</dd>
    <dt className="text-cockpit-text-muted">Tax Salary</dt>
    <dd className="font-mono">{fmtDelta(delta.taxSalaryDelta)}</dd>
    <dt className="text-cockpit-text-muted">Cap space</dt>
    <dd
      className={`font-mono ${
        delta.capSpaceDelta === null
          ? 'text-cockpit-text-ghost'
          : delta.capSpaceDelta < 0
            ? 'text-cockpit-danger'
            : 'text-cockpit-safe'
      }`}
    >
      {fmtDelta(delta.capSpaceDelta)}
    </dd>
    <dt className="text-cockpit-text-muted">Tax space</dt>
    <dd
      className={`font-mono ${
        delta.taxSpaceDelta === null
          ? 'text-cockpit-text-ghost'
          : delta.taxSpaceDelta < 0
            ? 'text-cockpit-danger'
            : 'text-cockpit-safe'
      }`}
    >
      {fmtDelta(delta.taxSpaceDelta)}
    </dd>
    <dt className="text-cockpit-text-muted">First apron space</dt>
    <dd className="font-mono">{fmtDelta(delta.firstApronSpaceDelta)}</dd>
    <dt className="text-cockpit-text-muted">Second apron space</dt>
    <dd className="font-mono">{fmtDelta(delta.secondApronSpaceDelta)}</dd>
  </dl>
);

const ApronPostureDisplay = ({
  delta,
}: {
  delta: Stage3TaxApronPostureDelta;
}) => {
  const rows: { label: string; value: boolean | null }[] = [
    { label: 'Crossed first apron', value: delta.crossedFirstApron },
    { label: 'Crossed second apron', value: delta.crossedSecondApron },
    { label: 'Hard cap activated', value: delta.hardCapActivated },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {rows.map(({ label, value }) => (
        <React.Fragment key={label}>
          <dt className="text-cockpit-text-muted">{label}</dt>
          <dd
            className={
              value === null
                ? 'text-cockpit-text-ghost'
                : value
                  ? 'text-cockpit-watch font-semibold'
                  : 'text-cockpit-text-muted'
            }
          >
            {value === null ? '—' : value ? 'Yes' : 'No'}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
};

// Owner-facing names for internal comparison field keys (BZE-209): the raw
// keys stay in the view-model contract, but never print on screen.
const UNAVAILABLE_FIELD_LABELS: Record<string, string> = {
  capTotalDelta: 'Cap totals',
  draftAssetDelta: 'Draft picks',
  seasonComparison: 'Season-to-season comparison',
  exceptionDelta: 'Exceptions',
};

const formatUnavailableFieldLabel = (field: string) =>
  UNAVAILABLE_FIELD_LABELS[field] ??
  // Fallback: split camelCase into words instead of printing a variable name.
  field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());

const presentUnavailableReason = (reason: string) =>
  reason
    .replace(/committed events?/gi, 'saved moves')
    .replace(/current event stream/gi, 'saved moves')
    .replace(/event stream/gi, 'saved moves');

const UnavailableList = ({
  entries,
}: {
  entries: Stage3UnavailableSummaryEntry[];
}) => (
  <ul className="space-y-1">
    {entries.map((entry) => (
      <li
        key={entry.field}
        data-field={entry.field}
        className="text-xs text-cockpit-text-muted"
      >
        <span className="text-cockpit-text-secondary">
          {formatUnavailableFieldLabel(entry.field)}
        </span>
        {' — '}
        {presentUnavailableReason(entry.reason)}
      </li>
    ))}
  </ul>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// Need React in scope for JSX Fragment in ApronPostureDisplay
import React from 'react';

export const ComparisonSection = ({
  status,
  viewModel,
  error,
  onNavigateToHistory,
  onNavigateToCapSheet,
  onNavigateToRoster,
  followThroughContext = null,
  worldPickerSlot = null,
}: ComparisonSectionProps) => {
  if (status === 'sandbox') {
    return (
      <div
        className="rounded-md border border-cockpit-edge bg-cockpit-slab px-4 py-6 text-center space-y-3"
        data-testid="comparison-sandbox-state"
      >
        <p className="text-sm font-semibold text-cockpit-text-secondary">
          Comparison requires a saved world
        </p>
        <p className="text-xs text-cockpit-text-muted">
          Create or select a world below to compare saved changes for this team.
        </p>
        {worldPickerSlot && (
          <div
            className="flex justify-center pt-1"
            data-testid="comparison-sandbox-world-picker"
          >
            {worldPickerSlot}
          </div>
        )}
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div
        className="rounded-md border border-cockpit-edge bg-cockpit-slab px-4 py-6 text-center"
        data-testid="comparison-loading-state"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-cockpit-text-muted italic">
          Loading comparison data…
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="rounded-md border border-cockpit-danger/30 bg-cockpit-danger/10 px-4 py-3 text-sm text-cockpit-danger"
        data-testid="comparison-error-state"
        role="alert"
      >
        Unable to load comparison data{error ? `: ${error}` : '.'}
      </div>
    );
  }

  // Available — viewModel must exist at this point
  if (!viewModel) {
    return (
      <div
        className="rounded-md border border-cockpit-edge bg-cockpit-slab px-4 py-6 text-center"
        data-testid="comparison-available"
      >
        <p className="text-sm text-cockpit-text-muted italic">
          No comparison data available.
        </p>
      </div>
    );
  }

  const { scope, committedEventCount, changedTeams, changedPlayers } =
    viewModel;
  const hasEvents = committedEventCount > 0;

  return (
    <div className="space-y-4" data-testid="comparison-available">
      {followThroughContext ? (
        <CompareFocusBanner context={followThroughContext} />
      ) : null}
      {/* Scope header */}
      <SectionCard testId="comparison-scope">
        <div className="flex flex-wrap items-baseline gap-2 mb-1">
          <h2 className="text-sm font-semibold text-cockpit-text-secondary">
            Saved Move Comparison
          </h2>
          <span className="text-[11px] text-cockpit-text-muted">
            Read-only · Before and after
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {scope.worldName && (
            <span className="text-sm font-semibold text-cockpit-text-secondary">
              {scope.worldName}
            </span>
          )}
          <span className="text-xs text-cockpit-text-muted">
            {TEAM_NAME_BY_CODE.get(scope.teamCode) || scope.teamCode}
            {scope.currentSeason ? ` · ${scope.currentSeason}` : ''}
          </span>
        </div>

        {/* Summary row */}
        <div
          className="flex flex-wrap gap-3 text-xs text-cockpit-text-muted"
          data-testid="comparison-event-count"
        >
          <span>
            <span className="font-semibold text-cockpit-text-secondary">
              {committedEventCount}
            </span>{' '}
            saved move{committedEventCount !== 1 ? 's' : ''}
          </span>
          {changedTeams.teamCodes.length > 0 && (
            <span
              className="text-cockpit-text-muted"
              data-testid="comparison-changed-teams"
            >
              {changedTeams.teamCodes.length} team
              {changedTeams.teamCodes.length !== 1 ? 's' : ''} changed
            </span>
          )}
          {changedPlayers.playerIds.length > 0 && (
            <span
              className="text-cockpit-text-muted"
              data-testid="comparison-changed-players"
            >
              {changedPlayers.playerIds.length} player
              {changedPlayers.playerIds.length !== 1 ? 's' : ''} changed
            </span>
          )}
        </div>

        {/* Navigation — read-only deep links to existing surfaces */}
        <div
          className="flex flex-wrap gap-2 mt-2"
          aria-label="Navigation only — opens existing surfaces"
        >
          {onNavigateToHistory && (
            <button
              type="button"
              onClick={onNavigateToHistory}
              className="text-xs px-2.5 py-1 rounded-md border border-cockpit-edge bg-cockpit-raised hover:bg-cockpit-edge text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              data-testid="comparison-nav-history"
            >
              View History
            </button>
          )}
          {onNavigateToCapSheet && (
            <button
              type="button"
              onClick={onNavigateToCapSheet}
              className="text-xs px-2.5 py-1 rounded-md border border-cockpit-edge bg-cockpit-raised hover:bg-cockpit-edge text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              data-testid="comparison-nav-cap-sheet"
            >
              View Cap Sheet
            </button>
          )}
          {onNavigateToRoster && (
            <button
              type="button"
              onClick={onNavigateToRoster}
              className="text-xs px-2.5 py-1 rounded-md border border-cockpit-edge bg-cockpit-raised hover:bg-cockpit-edge text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              data-testid="comparison-nav-roster"
            >
              View Roster
            </button>
          )}
        </div>
      </SectionCard>

      {/* Multi-season warning */}
      {viewModel.isMultiSeasonComparison && (
        <div
          className="rounded-md border border-cockpit-watch/30 bg-cockpit-watch/10 px-3 py-2 text-xs text-cockpit-watch"
          data-testid="comparison-multi-season-warning"
        >
          This saved world includes a season change. Salary changes include more
          than one season.
        </div>
      )}

      {/* Empty state */}
      {!hasEvents && (
        <SectionCard testId="comparison-empty-state">
          <p className="text-xs text-cockpit-text-muted italic">
            No saved moves in this world yet. Salary and roster changes will
            appear here after a move is saved.
          </p>
        </SectionCard>
      )}

      {/* Roster changes */}
      {hasEvents && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SectionCard testId="comparison-roster-additions">
            <SectionHeading>Additions</SectionHeading>
            <div className="mt-1">
              <RosterList
                entries={viewModel.rosterAdditions}
                emptyLabel="None detected"
              />
            </div>
          </SectionCard>

          <SectionCard testId="comparison-roster-removals">
            <SectionHeading>Removals</SectionHeading>
            <div className="mt-1">
              <RosterList
                entries={viewModel.rosterRemovals}
                emptyLabel="None detected"
              />
            </div>
          </SectionCard>

          <SectionCard testId="comparison-roster-changed">
            <SectionHeading>Contract Changes</SectionHeading>
            <div className="mt-1">
              <RosterList
                entries={viewModel.rosterChangedPlayers}
                emptyLabel="None detected"
              />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Cap total delta */}
      {hasEvents && viewModel.capTotalDelta && (
        <SectionCard testId="comparison-cap-delta">
          <SectionHeading>Salary Changes</SectionHeading>
          <CapDeltaDisplay delta={viewModel.capTotalDelta} />
        </SectionCard>
      )}

      {/* Tax / apron posture delta */}
      {hasEvents && viewModel.taxApronPostureDelta && (
        <SectionCard testId="comparison-apron-delta">
          <SectionHeading>Tax / Apron Status</SectionHeading>
          <ApronPostureDisplay delta={viewModel.taxApronPostureDelta} />
        </SectionCard>
      )}

      {/* Deferred / unavailable summary */}
      {viewModel.unavailableSummary.length > 0 && (
        <SectionCard testId="comparison-unavailable-summary">
          <SectionHeading>Deferred / Unavailable</SectionHeading>
          <p className="text-[11px] text-cockpit-text-ghost mb-1">
            These changes are not part of this comparison yet.
          </p>
          <UnavailableList entries={viewModel.unavailableSummary} />
        </SectionCard>
      )}
    </div>
  );
};
