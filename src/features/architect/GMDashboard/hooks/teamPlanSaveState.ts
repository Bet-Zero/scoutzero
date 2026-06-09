/**
 * FILE: src/features/architect/GMDashboard/hooks/teamPlanSaveState.ts
 * PURPOSE: Shared Architect Team Plan save-state truth model.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

export type ArchitectTeamPlanSaveStatus =
  | 'loading'
  | 'saved'
  | 'saving'
  | 'save-failed'
  | 'uncommitted-draft'
  | 'local-only';

export type ArchitectTeamPlanDraftSource =
  | 'trade-machine'
  | 'draft-position-editor'
  | 'unknown';

export interface ArchitectTeamPlanSaveState {
  status: ArchitectTeamPlanSaveStatus;
  label: string;
  detail: string;
  worldId: string | null;
  isDurableWorldMode: boolean;
  isLocalOnly: boolean;
  isSaved: boolean;
  isSaving: boolean;
  hasSaveError: boolean;
  lastSavedAt: string | null;
  lastSaveError: string | null;
  hasUncommittedDraft: boolean;
  draftSources: ArchitectTeamPlanDraftSource[];
  isViewingPersistedPlanTruth: boolean;
  isViewingLocalWhatIf: boolean;
}

export type ArchitectUnsafeContextExitIntent =
  | 'switch-world'
  | 'create-world'
  | 'branch-world'
  | 'archive-world'
  | 'delete-world'
  | 'switch-season'
  | 'leave-architect';

export interface ArchitectTeamPlanSaveStateInput {
  worldId?: string | null;
  isLoading?: boolean;
  worldMetadataLoading?: boolean;
  isSaving?: boolean;
  lastSavedAt?: string | null;
  lastSaveError?: string | null;
  hasStagedTradeDraft?: boolean;
  draftSources?: ArchitectTeamPlanDraftSource[];
}

const STATUS_LABEL: Record<ArchitectTeamPlanSaveStatus, string> = {
  loading: 'Loading',
  saved: 'Saved',
  saving: 'Saving...',
  'save-failed': 'Save failed',
  'uncommitted-draft': 'Draft',
  'local-only': 'Local',
};

const uniqueDraftSources = (
  inputSources: ArchitectTeamPlanDraftSource[],
  hasStagedTradeDraft: boolean
): ArchitectTeamPlanDraftSource[] => {
  const sources = new Set(inputSources);
  if (hasStagedTradeDraft) {
    sources.add('trade-machine');
  }
  return Array.from(sources);
};

const INTENT_DETAIL: Record<ArchitectUnsafeContextExitIntent, string> = {
  'switch-world': 'Switching worlds will leave the current Team Plan context.',
  'create-world':
    'Creating a world will switch you into a new Team Plan context.',
  'branch-world': 'Branching will switch you into the new Team Plan branch.',
  'archive-world':
    'Archiving this world will leave the current Team Plan context.',
  'delete-world':
    'Deleting this world will leave the current Team Plan context.',
  'switch-season': 'Switching seasons can hide staged or local work.',
  'leave-architect': 'Leaving Architect can discard or hide this work.',
};

const includesDraftSource = (
  saveState: ArchitectTeamPlanSaveState,
  source: ArchitectTeamPlanDraftSource
) => saveState.draftSources.includes(source);

export function deriveArchitectTeamPlanSaveState({
  worldId = null,
  isLoading = false,
  worldMetadataLoading = false,
  isSaving = false,
  lastSavedAt = null,
  lastSaveError = null,
  hasStagedTradeDraft = false,
  draftSources = [],
}: ArchitectTeamPlanSaveStateInput): ArchitectTeamPlanSaveState {
  const normalizedWorldId = worldId?.trim() || null;
  const normalizedSaveError = lastSaveError?.trim() || null;
  const normalizedLastSavedAt = lastSavedAt?.trim() || null;
  const isDurableWorldMode = Boolean(normalizedWorldId);
  const effectiveDraftSources = uniqueDraftSources(
    draftSources,
    hasStagedTradeDraft
  );
  const hasUncommittedDraft = effectiveDraftSources.length > 0;
  const isLoadingSaveTruth = Boolean(isLoading || worldMetadataLoading);

  let status: ArchitectTeamPlanSaveStatus;
  let detail: string;

  if (isLoadingSaveTruth) {
    status = 'loading';
    detail = 'Team Plan save state is loading.';
  } else if (!isDurableWorldMode) {
    status = 'local-only';
    detail =
      'Sandbox/base mode is local what-if state and is not durable Team Plan truth.';
  } else if (normalizedSaveError) {
    status = 'save-failed';
    detail = normalizedSaveError;
  } else if (isSaving) {
    status = 'saving';
    detail = 'World-mode Team Plan mutation is saving.';
  } else if (hasUncommittedDraft) {
    status = 'uncommitted-draft';
    detail = 'Local draft work is staged and not committed.';
  } else {
    status = 'saved';
    detail = 'Active world Team Plan is saved durable truth.';
  }

  const isSaved = status === 'saved';
  const isLocalOnly = !isDurableWorldMode;
  const isViewingPersistedPlanTruth = isSaved;

  return {
    status,
    label: STATUS_LABEL[status],
    detail,
    worldId: normalizedWorldId,
    isDurableWorldMode,
    isLocalOnly,
    isSaved,
    isSaving: status === 'saving',
    hasSaveError: status === 'save-failed',
    lastSavedAt: normalizedLastSavedAt,
    lastSaveError: normalizedSaveError,
    hasUncommittedDraft,
    draftSources: effectiveDraftSources,
    isViewingPersistedPlanTruth,
    isViewingLocalWhatIf: !isViewingPersistedPlanTruth,
  };
}

export function getArchitectTeamPlanUnsafeContextExitWarnings(
  saveState: ArchitectTeamPlanSaveState,
  intent: ArchitectUnsafeContextExitIntent
): string[] {
  const warnings: string[] = [];

  if (includesDraftSource(saveState, 'trade-machine')) {
    warnings.push('A staged trade draft is not applied.');
  } else if (saveState.hasUncommittedDraft) {
    warnings.push('Local draft work is staged and not committed.');
  }

  if (saveState.hasSaveError) {
    warnings.push(
      saveState.lastSaveError
        ? `The last Team Plan save failed: ${saveState.lastSaveError}`
        : 'The last Team Plan save failed.'
    );
  }

  if (saveState.isSaving) {
    warnings.push('A Team Plan save is still in progress.');
  }

  if (saveState.isLocalOnly && intent !== 'leave-architect') {
    warnings.push(
      'Sandbox/base mode is local what-if state and is not durable Team Plan truth.'
    );
  }

  return warnings;
}

export function shouldGuardArchitectTeamPlanContextExit(
  saveState: ArchitectTeamPlanSaveState,
  intent: ArchitectUnsafeContextExitIntent
): boolean {
  return (
    getArchitectTeamPlanUnsafeContextExitWarnings(saveState, intent).length > 0
  );
}

export function buildArchitectTeamPlanContextExitMessage(
  saveState: ArchitectTeamPlanSaveState,
  intent: ArchitectUnsafeContextExitIntent
): string | null {
  const warnings = getArchitectTeamPlanUnsafeContextExitWarnings(
    saveState,
    intent
  );
  if (!warnings.length) return null;

  return [
    'Architect has Team Plan work that may not be durable saved truth.',
    '',
    INTENT_DETAIL[intent],
    '',
    ...warnings.map((warning) => `- ${warning}`),
    '',
    'Continue anyway?',
  ].join('\n');
}

export function confirmArchitectTeamPlanContextExit(
  saveState: ArchitectTeamPlanSaveState,
  intent: ArchitectUnsafeContextExitIntent,
  confirmFn?: (message: string) => boolean
): boolean {
  const message = buildArchitectTeamPlanContextExitMessage(saveState, intent);
  if (!message) return true;

  const resolvedConfirm =
    confirmFn ??
    (typeof window !== 'undefined' ? window.confirm.bind(window) : null);

  return resolvedConfirm ? resolvedConfirm(message) : true;
}
