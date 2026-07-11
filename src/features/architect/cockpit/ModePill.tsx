/**
 * FILE: src/features/architect/cockpit/ModePill.tsx
 * PURPOSE: Compact badge showing the active Architect mode + save state.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Mode source order: world boundary kind → sandbox/world classification
 * → emulator vs prod environment flag. Save state is read from the shared
 * Team Plan save-state model surfaced by workspace context.
 */
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import type { ArchitectTeamPlanSaveStatus } from '@/features/architect/GMDashboard/hooks/teamPlanSaveState';

type ModeLabel =
  | 'EMULATOR'
  | 'PROD'
  | 'WORLD'
  | 'SANDBOX'
  | 'BASE'
  | 'LOADING';

type SaveState = ArchitectTeamPlanSaveStatus;

interface ModePillProps {
  context: ArchitectWorkspaceContext;
  isEmulator: boolean;
  /**
   * True on owner-facing review surfaces (VITE_ARCHITECT_REVIEW_MODE). The pill
   * is engineer/production save-state chrome; in review the only states it can
   * ever show are the banned "EMULATOR MODE" environment badge and the anon
   * "Local" save state, both of which the Architect Visual Standard §10 bans on
   * visible surfaces. So the whole pill is suppressed on review surfaces.
   */
  isReviewMode?: boolean;
}

function resolveLabel(context: ArchitectWorkspaceContext, isEmulator: boolean): ModeLabel {
  if (context.status.isLoading || context.status.worldMetadataLoading) {
    return 'LOADING';
  }
  if (context.world.status === 'sandbox') {
    return isEmulator ? 'EMULATOR' : 'SANDBOX';
  }
  if (context.world.status === 'available' || context.world.status === 'loading') {
    return isEmulator ? 'EMULATOR' : 'WORLD';
  }
  return isEmulator ? 'EMULATOR' : 'PROD';
}

function resolveSaveState(context: ArchitectWorkspaceContext): SaveState {
  return context.saveState.status;
}

const MODE_CLASSES: Record<ModeLabel, string> = {
  EMULATOR: 'bg-cockpit-watch/15 text-cockpit-watch border-cockpit-watch/30',
  PROD: 'bg-cockpit-danger/15 text-cockpit-danger border-cockpit-danger/30',
  WORLD: 'bg-cockpit-safe/15 text-cockpit-safe border-cockpit-safe/30',
  SANDBOX: 'bg-cockpit-raised text-cockpit-text-secondary border-cockpit-edge',
  BASE: 'bg-cockpit-info/15 text-cockpit-info border-cockpit-info/30',
  LOADING: 'bg-cockpit-slab text-cockpit-text-muted border-cockpit-edge',
};

const SAVE_CLASSES: Record<SaveState, string> = {
  loading: 'bg-cockpit-text-muted animate-pulse',
  saved: 'bg-cockpit-safe',
  saving: 'bg-cockpit-info animate-pulse',
  'save-failed': 'bg-cockpit-danger',
  'uncommitted-draft': 'bg-cockpit-watch',
  'local-only': 'bg-cockpit-text-muted',
};

const SAVE_LABEL: Record<SaveState, string> = {
  loading: 'Loading',
  saved: 'Saved',
  saving: 'Saving...',
  'save-failed': 'Save failed',
  'uncommitted-draft': 'Draft',
  'local-only': 'Local',
};

export const ModePill = ({
  context,
  isEmulator,
  isReviewMode = false,
}: ModePillProps) => {
  // Owner-facing review surfaces must never show review-build chrome. In review
  // the pill can only ever read "EMULATOR MODE" + "Local" — both banned by §10.
  // Engineer dev and real production render it unchanged.
  if (isReviewMode) return null;
  const label = resolveLabel(context, isEmulator);
  const save = resolveSaveState(context);
  // EMULATOR/PROD are Firebase-environment safety badges for engineers, not
  // product state. Production builds must never show environment scaffolding.
  const isEnvironmentBadge = label === 'EMULATOR' || label === 'PROD';
  const showModeBadge = !isEnvironmentBadge || import.meta.env.DEV;

  return (
    <div className="flex items-center gap-2" data-testid="cockpit-mode-pill">
      {showModeBadge ? (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${MODE_CLASSES[label]}`}
          data-testid="firebase-target-mode-badge"
        >
          {label === 'EMULATOR' ? 'EMULATOR MODE' : label === 'PROD' ? 'PROD MODE' : label}
        </span>
      ) : null}
      <span
        className="inline-flex items-center gap-1.5 text-[11px] text-cockpit-text-secondary"
        aria-label={`Team Plan save state: ${SAVE_LABEL[save]}. ${context.saveState.detail}`}
        title={context.saveState.detail}
        data-testid="cockpit-save-state"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${SAVE_CLASSES[save]}`} />
        <span className="hidden lg:inline">{SAVE_LABEL[save]}</span>
      </span>
    </div>
  );
};
