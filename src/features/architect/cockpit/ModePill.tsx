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
  EMULATOR: 'bg-amber-400/15 text-amber-200 border-amber-300/30',
  PROD: 'bg-rose-500/15 text-rose-200 border-rose-300/30',
  WORLD: 'bg-emerald-500/15 text-emerald-200 border-emerald-300/30',
  SANDBOX: 'bg-white/10 text-white/70 border-white/20',
  BASE: 'bg-sky-500/15 text-sky-200 border-sky-300/30',
  LOADING: 'bg-white/5 text-white/50 border-white/10',
};

const SAVE_CLASSES: Record<SaveState, string> = {
  loading: 'bg-white/40 animate-pulse',
  saved: 'bg-cockpit-safe',
  saving: 'bg-cockpit-info animate-pulse',
  'save-failed': 'bg-cockpit-danger',
  'uncommitted-draft': 'bg-amber-300',
  'local-only': 'bg-white/40',
};

const SAVE_LABEL: Record<SaveState, string> = {
  loading: 'Loading',
  saved: 'Saved',
  saving: 'Saving...',
  'save-failed': 'Save failed',
  'uncommitted-draft': 'Draft',
  'local-only': 'Local',
};

export const ModePill = ({ context, isEmulator }: ModePillProps) => {
  const label = resolveLabel(context, isEmulator);
  const save = resolveSaveState(context);

  return (
    <div className="flex items-center gap-2" data-testid="cockpit-mode-pill">
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${MODE_CLASSES[label]}`}
        data-testid="firebase-target-mode-badge"
      >
        {label === 'EMULATOR' ? 'EMULATOR MODE' : label === 'PROD' ? 'PROD MODE' : label}
      </span>
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
