/**
 * FILE: src/features/architect/GMDashboard/sections/CapSheetSection.tsx
 * PURPOSE: Publish the dashboard shell's cap-sheet handoff into the selected-year and adjacent current-season surfaces.
 * OWNERSHIP: Feature: architect/GMDashboard (cap sheet section)
 *
 * ARCHITECT OWNERSHIP:
 * - Section-level shell for selected-year cap-table viewing.
 * - Owns selectedYear and shell-level current-vs-selected season framing only.
 * - Forwards upstream mutation callbacks into CapSheet without becoming a write authority.
 * - Keeps adjacent current-season authority surfaces separate from selected-year totals.
 */
import { useEffect, useState } from 'react';
import { CapSheet } from '@/features/architect/capSheet/CapSheet';
import { ExceptionTracker } from '@/features/architect/capSheet/ExceptionTracker';
import {
  DEV_CAP_SHEET_FIXTURE_BOUNDARY,
  DEV_CAP_SHEET_FIXTURE_FLAG,
  DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
  DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
} from '@/features/architect/capSheet/devCapSheetFixtures';

type ForwardedCapSheetProps = Pick<
  Parameters<typeof CapSheet>[0],
  | 'teamCapSheet'
  | 'asOfDate'
  | 'onOpenPlayerContractModal'
  | 'manualCapSheetMutationAuthority'
  | 'highlightPlayerId'
  | 'highlightPlayerIds'
  | 'onPlayerAction'
  | 'pinnedPlayerIds'
>;

type DevFixtureAction = (() => unknown) | null;

type CapSheetDevFixtureControls = {
  injectLocalFixtures?: DevFixtureAction;
  clearLocalFixtures?: DevFixtureAction;
  hasInjectedLocalFixtures?: boolean;
  localStateOwner?: typeof DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER;
  syntheticCoverageBoundary?: typeof DEV_CAP_SHEET_FIXTURE_BOUNDARY;
  runtimeBoundary?: typeof DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY;
  injectFixtures?: DevFixtureAction;
  clearFixtures?: DevFixtureAction;
  hasInjectedFixtures?: boolean;
};

type CapSheetSectionProps = ForwardedCapSheetProps & {
  currentYear: number;
  containingTeamCode: string;
  worldId?: string | null;
  worldLineage?: readonly string[];
  playersMap?: Record<string, unknown>;
  capSheetDevFixtureControls?: CapSheetDevFixtureControls | null;
  onInjectCapSheetFixtures?: DevFixtureAction;
  onClearCapSheetFixtures?: DevFixtureAction;
  hasInjectedCapSheetFixtures?: boolean;
};

const CAP_SHEET_SECTION_SURFACE_LABELS = {
  shellYearTruth: 'Cap sheet shell year-truth surface',
  primary: 'Primary selected-year cap sheet surface',
  adjacent: 'Adjacent current-season authority surface',
  adjacentDetail: 'Cap sheet current-season exception authority surface',
  devFixtures: 'Cap sheet development fixture controls',
} as const;

const formatSeasonLabel = (endYear: number) =>
  `${endYear - 1}-${String(endYear % 100).padStart(2, '0')}`;

const resolveTeamPlanLabel = (
  teamCapSheet: ForwardedCapSheetProps['teamCapSheet']
) => {
  const source = (teamCapSheet || {}) as {
    teamName?: string | null;
    name?: string | null;
    teamCode?: string | null;
    abbreviation?: string | null;
    id?: string | number | null;
  };

  return (
    source.teamName ||
    source.name ||
    source.teamCode ||
    source.abbreviation ||
    (source.id != null ? String(source.id) : 'Active team')
  );
};

const CapSheetSection = ({
  teamCapSheet,
  currentYear,
  containingTeamCode,
  worldId = null,
  worldLineage = [],
  asOfDate = null,
  onOpenPlayerContractModal,
  manualCapSheetMutationAuthority,
  playersMap,
  onInjectCapSheetFixtures = null,
  onClearCapSheetFixtures = null,
  hasInjectedCapSheetFixtures = false,
  capSheetDevFixtureControls = null,
  highlightPlayerId = null,
  highlightPlayerIds = [],
  onPlayerAction = null,
  pinnedPlayerIds = [],
}: CapSheetSectionProps) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  // BZE-229 (owner-approved): the exceptions / hard-cap readout is collapsed by
  // default to match the Full Cap Table, so the cap table lands a full 18-man
  // roster with no hidden scroll. Hard-cap and apron status still surface
  // universally in the TopBar cap meter + Team Plan alerts.
  const [showExceptions, setShowExceptions] = useState(false);

  useEffect(() => {
    setSelectedYear(currentYear);
  }, [currentYear]);

  if (!teamCapSheet?.players) {
    return (
      <div className="mt-4 text-sm text-cockpit-text-secondary">
        Loading cap sheet…
      </div>
    );
  }

  const showDevFixturePanel =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(DEV_CAP_SHEET_FIXTURE_FLAG) === 'true';
  const injectLocalDevFixtures =
    capSheetDevFixtureControls?.injectLocalFixtures ??
    capSheetDevFixtureControls?.injectFixtures ??
    onInjectCapSheetFixtures;
  const clearLocalDevFixtures =
    capSheetDevFixtureControls?.clearLocalFixtures ??
    capSheetDevFixtureControls?.clearFixtures ??
    onClearCapSheetFixtures;
  const hasInjectedLocalDevFixtures =
    capSheetDevFixtureControls?.hasInjectedLocalFixtures ??
    capSheetDevFixtureControls?.hasInjectedFixtures ??
    hasInjectedCapSheetFixtures;
  const localFixtureStateOwner =
    capSheetDevFixtureControls?.localStateOwner ??
    DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER;
  const syntheticCoverageBoundary =
    capSheetDevFixtureControls?.syntheticCoverageBoundary ??
    DEV_CAP_SHEET_FIXTURE_BOUNDARY;
  const fixtureRuntimeBoundary =
    capSheetDevFixtureControls?.runtimeBoundary ??
    DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY;
  const isViewingCurrentYear = selectedYear === currentYear;
  const currentSeasonLabel = formatSeasonLabel(currentYear);
  const selectedSeasonLabel = formatSeasonLabel(selectedYear);
  const teamPlanLabel = resolveTeamPlanLabel(teamCapSheet);
  // A restrained neutral strip that matches the canonical Full Cap Table: the
  // status meaning rides on a narrow dot + eyebrow accent, never a colored band
  // wash (visual standard §3 — color is meaning, not decoration). Future-year
  // views keep a subtle watch tint because the disclosure itself is the caution
  // (figures are projected; caps/exceptions stay current-season).
  const shellTruthToneClasses = isViewingCurrentYear
    ? 'border-cockpit-edge bg-cockpit-slab'
    : 'border-cockpit-watch/25 bg-cockpit-watch/[0.06]';
  const shellTruthDotClass = isViewingCurrentYear
    ? 'bg-cockpit-info'
    : 'bg-cockpit-watch';
  const shellTruthEyebrowClass = isViewingCurrentYear
    ? 'text-cockpit-info/90'
    : 'text-cockpit-watch/90';
  // (chip row removed in BZE-209 — season + boundary now read as one sentence)
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-2">
      <section
        aria-label={CAP_SHEET_SECTION_SURFACE_LABELS.shellYearTruth}
        data-testid="cap-sheet-shell-year-truth-panel"
        data-team-plan-label={teamPlanLabel}
        className={`flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border px-3 py-1.5 ${shellTruthToneClasses}`}
      >
        {/* SECTION HANDOFF / SHELL TRUTH SURFACE: The dashboard seam owns
            selectedYear and top-level year signaling. Copy stays in plain GM
            language (BZE-209) while still distinguishing current-season view
            from a future-year view. Single-line strip — the review viewport
            budget belongs to the cap table itself (BZE-216). */}
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] ${shellTruthEyebrowClass}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${shellTruthDotClass}`}
          />
          Showing {selectedSeasonLabel}
        </span>
        <p className="min-w-0 text-[11px] leading-snug text-cockpit-text-secondary">
          {isViewingCurrentYear
            ? `All figures on this page are for the current season, ${currentSeasonLabel}.`
            : `Salary figures below are for ${selectedSeasonLabel}. Hard cap, exceptions, and trade exceptions always reflect the current season (${currentSeasonLabel}).`}
        </p>
      </section>

      <section
        aria-label={CAP_SHEET_SECTION_SURFACE_LABELS.primary}
        className="min-h-0 flex-1"
      >
        {/* PRIMARY FEATURE SURFACE: CapSheet owns selected-year cap-table
            composition, canonical totals consumers, and supporting detail. */}
        <CapSheet
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          asOfDate={asOfDate}
          selectedYear={selectedYear}
          onSelectedYearChange={setSelectedYear}
          onOpenPlayerContractModal={onOpenPlayerContractModal}
          manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
          highlightPlayerId={highlightPlayerId}
          highlightPlayerIds={highlightPlayerIds}
          onPlayerAction={onPlayerAction}
          pinnedPlayerIds={pinnedPlayerIds}
        />
      </section>

      <section
        aria-label={CAP_SHEET_SECTION_SURFACE_LABELS.adjacent}
        className="shrink-0"
      >
        {/* ADJACENT CURRENT-SEASON AUTHORITY SURFACE: Keep exception/TPE/
            hard-cap display separate from the selected-year cap-table owner.
            Collapsed by default (BZE-229) behind a one-line toggle so the cap
            table keeps the review-viewport budget, matching the Full Cap Table. */}
        <button
          type="button"
          data-testid="cap-sheet-exceptions-toggle"
          aria-expanded={showExceptions}
          onClick={() => setShowExceptions((prev) => !prev)}
          className="flex w-full items-center gap-1.5 rounded-md border border-cockpit-edge bg-cockpit-slab px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cockpit-text-muted transition-colors hover:text-cockpit-text-secondary"
        >
          <span aria-hidden="true" className="text-cockpit-text-ghost">
            {showExceptions ? '▾' : '▸'}
          </span>
          Exceptions &amp; Hard Cap
        </button>
        {showExceptions && (
          <div className="mt-1.5">
            <ExceptionTracker
              teamCapSheet={teamCapSheet}
              currentYear={currentYear}
              containingTeamCode={containingTeamCode}
              worldId={worldId}
              worldLineage={worldLineage}
              selectedYear={selectedYear}
              surfaceLabel={CAP_SHEET_SECTION_SURFACE_LABELS.adjacentDetail}
            />
          </div>
        )}
      </section>

      {showDevFixturePanel && (
        <aside
          aria-label={CAP_SHEET_SECTION_SURFACE_LABELS.devFixtures}
          data-testid="cap-sheet-fixtures-panel"
          className="mt-4 rounded border border-amber-500/30 bg-[#120e09] p-3 text-xs text-amber-100/80 space-y-3"
        >
          {/* DEV-ONLY SUPPORT SURFACE: Fixture controls intentionally live
              outside the authoritative cap-table and adjacent authority
              surfaces so test scaffolding does not read like feature truth. */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-amber-200">
                Cap Sheet Fixtures (DEV)
              </div>
              <div className="text-amber-200/70">
                Injects one synthetic `futureContract` player and one control
                player through the local DEV fixture state owner only.
              </div>
              <div className="mt-1 text-amber-200/55">
                Local owner: {localFixtureStateOwner.ownerLabel}. Scope:{' '}
                {localFixtureStateOwner.stateScope}. Persistence:{' '}
                {localFixtureStateOwner.persistence}.
              </div>
              <div
                data-testid="cap-sheet-fixtures-boundary-note"
                className="mt-1 text-amber-200/55"
              >
                {syntheticCoverageBoundary.intentLabel}: one `futureContract`
                probe plus one no-`futureContract` control. Not
                representative of{' '}
                {syntheticCoverageBoundary.notModeledSeams.join(', ')}.
              </div>
              <div
                data-testid="cap-sheet-fixtures-runtime-note"
                className="mt-1 text-amber-200/55"
              >
                DEV only via `{fixtureRuntimeBoundary.activationFlag}`.
                Activation: {fixtureRuntimeBoundary.activationRequirement}.
                Persistence: {fixtureRuntimeBoundary.persistence}. These
                controls {fixtureRuntimeBoundary.committedWorldRelationship}.
              </div>
            </div>
          </div>
          {hasInjectedLocalDevFixtures && (
            <div
              data-testid="cap-sheet-fixtures-active-note"
              className="rounded border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-amber-100/80"
            >
              Synthetic DEV fixture players are active in local team state.
              Clear them before evaluating real-data cap-table behavior.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="cap-sheet-inject-fixtures-button"
              onClick={() => injectLocalDevFixtures?.()}
              className="rounded bg-amber-700/70 hover:bg-amber-600/70 px-3 py-1.5 text-xs font-medium text-amber-100"
            >
              Inject FutureContract Fixture
            </button>
            <button
              type="button"
              data-testid="cap-sheet-clear-fixtures-button"
              onClick={() => clearLocalDevFixtures?.()}
              disabled={!hasInjectedLocalDevFixtures}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                hasInjectedLocalDevFixtures
                  ? 'bg-neutral-700 hover:bg-neutral-600 text-white'
                  : 'bg-neutral-800 text-white/40 cursor-not-allowed'
              }`}
            >
              Clear Injected Fixtures
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

export { CapSheetSection };
