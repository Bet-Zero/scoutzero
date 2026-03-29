import CapSheet from '@/features/architect/capSheet/CapSheet';
import ExceptionTracker from '@/features/architect/capSheet/ExceptionTracker';
import { DEV_CAP_SHEET_FIXTURE_FLAG } from '@/features/architect/capSheet/devCapSheetFixtures';

type ForwardedCapSheetProps = Pick<
  Parameters<typeof CapSheet>[0],
  | 'teamCapSheet'
  | 'onOpenPlayerContractModal'
  | 'manualCapSheetMutationAuthority'
>;

type CapSheetSectionProps = ForwardedCapSheetProps & {
  currentYear: number;
  playersMap?: Record<string, unknown>;
  onInjectCapSheetFixtures?: (() => void) | null;
  onClearCapSheetFixtures?: (() => void) | null;
  hasInjectedCapSheetFixtures?: boolean;
};

const CapSheetSection = ({
  teamCapSheet,
  currentYear,
  onOpenPlayerContractModal,
  manualCapSheetMutationAuthority,
  playersMap,
  onInjectCapSheetFixtures = null,
  onClearCapSheetFixtures = null,
  hasInjectedCapSheetFixtures = false,
}: CapSheetSectionProps) => {
  if (!teamCapSheet?.players) {
    return <div className="text-white/80 mt-4">Loading cap sheet...</div>;
  }

  const showDevFixturePanel =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(DEV_CAP_SHEET_FIXTURE_FLAG) === 'true';

  return (
    <>
      <section aria-label="Primary current-year cap sheet surface">
        {/* PRIMARY CURRENT-YEAR SURFACE: CapSheet owns the canonical totals
            consumers plus its supporting detail views. */}
        <CapSheet
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onOpenPlayerContractModal={onOpenPlayerContractModal}
          manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
        />
        {showDevFixturePanel && (
          <section
            data-testid="cap-sheet-fixtures-panel"
            className="mt-4 rounded border border-amber-500/30 bg-[#120e09] p-3 text-xs text-amber-100/80 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-amber-200">
                  Cap Sheet Fixtures (DEV)
                </div>
                <div className="text-amber-200/70">
                  Injects one synthetic `futureContract` player and one control
                  player into local in-memory team state only.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="cap-sheet-inject-fixtures-button"
                onClick={() => onInjectCapSheetFixtures?.()}
                className="rounded bg-amber-700/70 hover:bg-amber-600/70 px-3 py-1.5 text-xs font-medium text-amber-100"
              >
                Inject FutureContract Fixture
              </button>
              <button
                type="button"
                data-testid="cap-sheet-clear-fixtures-button"
                onClick={() => onClearCapSheetFixtures?.()}
                disabled={!hasInjectedCapSheetFixtures}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  hasInjectedCapSheetFixtures
                    ? 'bg-neutral-700 hover:bg-neutral-600 text-white'
                    : 'bg-neutral-800 text-white/40 cursor-not-allowed'
                }`}
              >
                Clear Injected Fixtures
              </button>
            </div>
          </section>
        )}
      </section>

      <section aria-label="Adjacent exception presentation surface">
        {/* ADJACENT PRESENTATION SURFACE: Keep exception/TPE/hard-cap display
            separate from the primary current-year totals ownership. */}
        <ExceptionTracker teamCapSheet={teamCapSheet} currentYear={currentYear} />
      </section>
    </>
  );
};

export { CapSheetSection };
