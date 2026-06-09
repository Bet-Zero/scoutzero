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
