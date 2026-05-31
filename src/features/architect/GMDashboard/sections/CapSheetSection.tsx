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
  | 'onOpenPlayerContractModal'
  | 'manualCapSheetMutationAuthority'
  | 'highlightPlayerId'
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

const CapSheetSection = ({
  teamCapSheet,
  currentYear,
  onOpenPlayerContractModal,
  manualCapSheetMutationAuthority,
  playersMap,
  onInjectCapSheetFixtures = null,
  onClearCapSheetFixtures = null,
  hasInjectedCapSheetFixtures = false,
  capSheetDevFixtureControls = null,
  highlightPlayerId = null,
}: CapSheetSectionProps) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);

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
  const shellTruthToneClasses = isViewingCurrentYear
    ? 'border-sky-400/20 bg-sky-500/[0.06] text-sky-100'
    : 'border-amber-400/20 bg-amber-500/[0.06] text-amber-100';
  const shellTruthEyebrowClass = isViewingCurrentYear
    ? 'text-sky-300/80'
    : 'text-amber-300/80';
  const shellTruthChipClass = isViewingCurrentYear
    ? 'border-sky-300/20 bg-sky-500/10 text-sky-100/90'
    : 'border-amber-300/20 bg-amber-500/10 text-amber-100/90';

  return (
    <>
      <section
        aria-label={CAP_SHEET_SECTION_SURFACE_LABELS.shellYearTruth}
        data-testid="cap-sheet-shell-year-truth-panel"
        className={`mb-4 rounded-lg border px-4 py-3 ${shellTruthToneClasses}`}
      >
        {/* SECTION HANDOFF / SHELL TRUTH SURFACE: The dashboard seam owns
            selectedYear, top-level year-truth signaling, and separation
            between the authoritative feature surfaces below. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div
              className={`text-[10px] uppercase tracking-[0.25em] ${shellTruthEyebrowClass}`}
            >
              {isViewingCurrentYear
                ? 'Current-Season Alignment'
                : 'Selected-Year Totals View'}
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/80">
              {isViewingCurrentYear
                ? `The main cap sheet and the adjacent hard-cap, exception, and TPE surface are both aligned to ${currentSeasonLabel}.`
                : `The main cap sheet is showing ${selectedSeasonLabel} totals and detail, while adjacent hard-cap, exception, and TPE authority remains on ${currentSeasonLabel} only.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-medium">
            <span
              className={`rounded-full border px-2.5 py-1 ${shellTruthChipClass}`}
            >
              Cap table: {selectedSeasonLabel}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 ${shellTruthChipClass}`}
            >
              Adjacent authority:{' '}
              {isViewingCurrentYear
                ? currentSeasonLabel
                : `${currentSeasonLabel} only`}
            </span>
          </div>
        </div>
      </section>

      <section aria-label={CAP_SHEET_SECTION_SURFACE_LABELS.primary}>
        {/* PRIMARY FEATURE SURFACE: CapSheet owns selected-year cap-table
            composition, canonical totals consumers, and supporting detail. */}
        <CapSheet
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          selectedYear={selectedYear}
          onSelectedYearChange={setSelectedYear}
          onOpenPlayerContractModal={onOpenPlayerContractModal}
          manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
          highlightPlayerId={highlightPlayerId}
        />
      </section>

      <section aria-label={CAP_SHEET_SECTION_SURFACE_LABELS.adjacent}>
        {/* ADJACENT CURRENT-SEASON AUTHORITY SURFACE: Keep exception/TPE/
            hard-cap display separate from the selected-year cap-table owner. */}
        <ExceptionTracker
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          selectedYear={selectedYear}
          surfaceLabel={CAP_SHEET_SECTION_SURFACE_LABELS.adjacentDetail}
        />
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
    </>
  );
};

export { CapSheetSection };
