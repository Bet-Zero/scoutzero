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
const CompareFocusBanner = ({
  context,
}: {
  context: FollowThroughContext;
}) => {
  const focus = describeCompareFocus(context);
  if (!focus) return null;
  return (
    <div
      className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-2"
      data-testid="comparison-focus-banner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-white/80">
          {focus.heading}
        </span>
        <span
          className="inline-flex items-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55"
          data-testid="comparison-focus-authority"
        >
          {focus.authorityLabel}
        </span>
      </div>
      {focus.authority === 'unavailable' ? (
        <p className="mt-1 text-[11px] text-white/40">
          Player-level comparison is not available yet. Showing the committed
          team/event view below.
        </p>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const AuthorityChip = ({ label }: { label: string }) => (
  <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-white/5 text-white/40 border-white/10 uppercase tracking-wide">
    {label}
  </span>
);

const SectionCard = ({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) => (
  <div
    className="rounded-md border border-white/10 bg-white/[0.015] px-4 py-3 space-y-2"
    data-testid={testId}
  >
    {children}
  </div>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
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
    return <p className="text-xs text-white/30 italic">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-0.5">
      {entries.map((entry) => (
        <li key={entry.playerId} className="text-xs text-white/70 font-mono">
          {entry.playerId}
        </li>
      ))}
    </ul>
  );
};

const CapDeltaDisplay = ({
  delta,
}: {
  delta: Stage3CapTotalDelta;
}) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
    <dt className="text-white/50">Cap allocation</dt>
    <dd
      className={`font-mono ${
        delta.totalCapAllocationsDelta === null
          ? 'text-white/30'
          : delta.totalCapAllocationsDelta > 0
            ? 'text-rose-300'
            : 'text-green-300'
      }`}
    >
      {fmtDelta(delta.totalCapAllocationsDelta)}
    </dd>
    <dt className="text-white/50">Cap space</dt>
    <dd
      className={`font-mono ${
        delta.capSpaceDelta === null
          ? 'text-white/30'
          : delta.capSpaceDelta < 0
            ? 'text-rose-300'
            : 'text-green-300'
      }`}
    >
      {fmtDelta(delta.capSpaceDelta)}
    </dd>
    <dt className="text-white/50">Tax space</dt>
    <dd
      className={`font-mono ${
        delta.taxSpaceDelta === null
          ? 'text-white/30'
          : delta.taxSpaceDelta < 0
            ? 'text-rose-300'
            : 'text-green-300'
      }`}
    >
      {fmtDelta(delta.taxSpaceDelta)}
    </dd>
  </dl>
);

const ApronPostureDisplay = ({ delta }: { delta: Stage3TaxApronPostureDelta }) => {
  const rows: { label: string; value: boolean | null }[] = [
    { label: 'Crossed first apron', value: delta.crossedFirstApron },
    { label: 'Crossed second apron', value: delta.crossedSecondApron },
    { label: 'Hard cap activated', value: delta.hardCapActivated },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {rows.map(({ label, value }) => (
        <React.Fragment key={label}>
          <dt className="text-white/50">{label}</dt>
          <dd
            className={
              value === null
                ? 'text-white/30'
                : value
                  ? 'text-amber-300 font-semibold'
                  : 'text-white/40'
            }
          >
            {value === null ? '—' : value ? 'Yes' : 'No'}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
};

const UnavailableList = ({
  entries,
}: {
  entries: Stage3UnavailableSummaryEntry[];
}) => (
  <ul className="space-y-1">
    {entries.map((entry) => (
      <li key={entry.field} className="text-xs text-white/40">
        <span className="font-mono text-white/30">{entry.field}</span>
        {' — '}
        {entry.reason}
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
        className="rounded-md border border-white/10 bg-white/[0.015] px-4 py-6 text-center space-y-3"
        data-testid="comparison-sandbox-state"
      >
        <p className="text-sm font-semibold text-white/60">
          Comparison requires a committed world
        </p>
        <p className="text-xs text-white/40">
          Create or select a world below to compare committed scenario changes
          for this team.
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
        className="rounded-md border border-white/10 bg-white/[0.015] px-4 py-6 text-center"
        data-testid="comparison-loading-state"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-white/50 italic">
          Loading comparison data…
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="rounded-md border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
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
        className="rounded-md border border-white/10 bg-white/[0.015] px-4 py-6 text-center"
        data-testid="comparison-available"
      >
        <p className="text-sm text-white/40 italic">
          No comparison data available.
        </p>
      </div>
    );
  }

  const { scope, committedEventCount, changedTeams, changedPlayers } = viewModel;
  const hasEvents = committedEventCount > 0;

  return (
    <div className="space-y-4" data-testid="comparison-available">
      {followThroughContext ? (
        <CompareFocusBanner context={followThroughContext} />
      ) : null}
      {/* Scope header */}
      <SectionCard testId="comparison-scope">
        <div className="flex flex-wrap items-baseline gap-2 mb-1">
          <h2 className="text-sm font-semibold text-white/80">
            Committed Scenario Comparison
          </h2>
          <span className="text-[11px] text-white/40">
            Read-only · Event-derived
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <AuthorityChip label="Committed world" />
          {scope.worldName && (
            <span className="text-sm font-semibold text-white/80">
              {scope.worldName}
            </span>
          )}
          <span className="text-xs text-white/40">
            {scope.teamCode}
            {scope.currentSeason ? ` · ${scope.currentSeason}` : ''}
          </span>
        </div>

        {/* Summary row */}
        <div
          className="flex flex-wrap gap-3 text-xs text-white/50"
          data-testid="comparison-event-count"
        >
          <span>
            <span className="font-semibold text-white/70">{committedEventCount}</span>
            {' '}committed event{committedEventCount !== 1 ? 's' : ''}
          </span>
          {changedTeams.teamCodes.length > 0 && (
            <span
              className="text-white/40"
              data-testid="comparison-changed-teams"
            >
              {changedTeams.teamCodes.length} team{changedTeams.teamCodes.length !== 1 ? 's' : ''} changed
            </span>
          )}
          {changedPlayers.playerIds.length > 0 && (
            <span
              className="text-white/40"
              data-testid="comparison-changed-players"
            >
              {changedPlayers.playerIds.length} player{changedPlayers.playerIds.length !== 1 ? 's' : ''} touched
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
              className="text-xs px-2.5 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              data-testid="comparison-nav-history"
            >
              View History
            </button>
          )}
          {onNavigateToCapSheet && (
            <button
              type="button"
              onClick={onNavigateToCapSheet}
              className="text-xs px-2.5 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              data-testid="comparison-nav-cap-sheet"
            >
              View Cap Sheet
            </button>
          )}
          {onNavigateToRoster && (
            <button
              type="button"
              onClick={onNavigateToRoster}
              className="text-xs px-2.5 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
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
          className="rounded-md border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
          data-testid="comparison-multi-season-warning"
        >
          Multi-season comparison — this world includes season-advance events.
          Cap delta accumulates across multiple seasons.
        </div>
      )}

      {/* Empty state */}
      {!hasEvents && (
        <SectionCard testId="comparison-empty-state">
          <p className="text-xs text-white/40 italic">
            No committed events in this world yet. Cap baseline and roster delta
            will appear here once mutations are committed.
          </p>
        </SectionCard>
      )}

      {/* Roster changes */}
      {hasEvents && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SectionCard testId="comparison-roster-additions">
            <SectionHeading>Additions</SectionHeading>
            <AuthorityChip label="event-derived" />
            <div className="mt-1">
              <RosterList
                entries={viewModel.rosterAdditions}
                emptyLabel="None detected"
              />
            </div>
          </SectionCard>

          <SectionCard testId="comparison-roster-removals">
            <SectionHeading>Removals</SectionHeading>
            <AuthorityChip label="event-derived" />
            <div className="mt-1">
              <RosterList
                entries={viewModel.rosterRemovals}
                emptyLabel="None detected"
              />
            </div>
          </SectionCard>

          <SectionCard testId="comparison-roster-changed">
            <SectionHeading>Contract Changes</SectionHeading>
            <AuthorityChip label="event-derived" />
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
          <div className="flex items-center gap-2 mb-2">
            <SectionHeading>Cap Allocation Delta</SectionHeading>
            <AuthorityChip label="event-derived" />
          </div>
          <CapDeltaDisplay delta={viewModel.capTotalDelta} />
        </SectionCard>
      )}

      {/* Tax / apron posture delta */}
      {hasEvents && viewModel.taxApronPostureDelta && (
        <SectionCard testId="comparison-apron-delta">
          <div className="flex items-center gap-2 mb-2">
            <SectionHeading>Tax / Apron Posture</SectionHeading>
            <AuthorityChip label="event-derived" />
          </div>
          <ApronPostureDisplay delta={viewModel.taxApronPostureDelta} />
        </SectionCard>
      )}

      {/* Deferred / unavailable summary */}
      {viewModel.unavailableSummary.length > 0 && (
        <SectionCard testId="comparison-unavailable-summary">
          <SectionHeading>Deferred / Unavailable</SectionHeading>
          <p className="text-[11px] text-white/30 mb-1">
            These deltas are not surfaced in this read-only comparison.
          </p>
          <UnavailableList entries={viewModel.unavailableSummary} />
        </SectionCard>
      )}
    </div>
  );
};
