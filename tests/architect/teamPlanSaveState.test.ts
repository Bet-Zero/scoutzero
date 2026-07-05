import { describe, expect, it } from 'vitest';
import { deriveArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import {
  buildArchitectTeamPlanContextExitMessage,
  confirmArchitectTeamPlanContextExit,
  deriveArchitectTeamPlanSaveState,
  getArchitectTeamPlanUnsafeContextExitWarnings,
  shouldGuardArchitectTeamPlanContextExit,
} from '@/features/architect/GMDashboard/hooks/teamPlanSaveState';

describe('Architect Team Plan save-state truth', () => {
  it('marks active world mode as saved durable plan truth when no draft or save error exists', () => {
    const state = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      lastSavedAt: '2026-06-09T22:00:00.000Z',
    });

    expect(state.status).toBe('saved');
    expect(state.isSaved).toBe(true);
    expect(state.isDurableWorldMode).toBe(true);
    expect(state.isViewingPersistedPlanTruth).toBe(true);
    expect(state.isViewingLocalWhatIf).toBe(false);
  });

  it('marks world persistence in progress as saving and not persisted truth yet', () => {
    const state = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      isSaving: true,
    });

    expect(state.status).toBe('saving');
    expect(state.isSaving).toBe(true);
    expect(state.isSaved).toBe(false);
    expect(state.isViewingPersistedPlanTruth).toBe(false);
  });

  it('represents failed world persistence separately from generic loading state', () => {
    const state = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      lastSaveError: 'Failed to save changes',
    });

    expect(state.status).toBe('save-failed');
    expect(state.hasSaveError).toBe(true);
    expect(state.lastSaveError).toBe('Failed to save changes');
    expect(state.isSaved).toBe(false);
  });

  it('does not label staged trade work as saved durable plan truth', () => {
    const state = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      hasStagedTradeDraft: true,
    });

    expect(state.status).toBe('uncommitted-draft');
    expect(state.hasUncommittedDraft).toBe(true);
    expect(state.draftSources).toEqual(['trade-machine']);
    expect(state.isSaved).toBe(false);
    expect(state.isViewingPersistedPlanTruth).toBe(false);
  });

  it('marks sandbox/base mode as local-only even when there is no staged draft', () => {
    const state = deriveArchitectTeamPlanSaveState({
      worldId: null,
    });

    expect(state.status).toBe('local-only');
    expect(state.isLocalOnly).toBe(true);
    expect(state.isDurableWorldMode).toBe(false);
    expect(state.isSaved).toBe(false);
  });

  it('exposes save state through top-level workspace context', () => {
    const context = deriveArchitectWorkspaceContext({
      worldId: 'world_123',
      hasStagedTradeDraft: true,
      isSaving: false,
    });

    expect(context.saveState.status).toBe('uncommitted-draft');
    expect(context.saveState.hasUncommittedDraft).toBe(true);
    expect(context.saveState.draftSources).toContain('trade-machine');
  });

  it('does not guard safe durable world context switches', () => {
    const state = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      lastSavedAt: '2026-06-09T22:00:00.000Z',
    });

    expect(shouldGuardArchitectTeamPlanContextExit(state, 'switch-world')).toBe(
      false
    );
    expect(
      buildArchitectTeamPlanContextExitMessage(state, 'switch-world')
    ).toBeNull();
  });

  it('builds plain-language guard warnings for staged trade drafts', () => {
    const state = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      hasStagedTradeDraft: true,
    });

    expect(shouldGuardArchitectTeamPlanContextExit(state, 'switch-world')).toBe(
      true
    );
    expect(
      getArchitectTeamPlanUnsafeContextExitWarnings(state, 'switch-world')
    ).toContain('A trade in progress has not been applied to your plan.');
    expect(
      buildArchitectTeamPlanContextExitMessage(state, 'switch-world')
    ).toContain('Switching worlds will leave the current Team Plan context.');
  });

  it('guards save-failed and saving states before leaving Architect', () => {
    const failedState = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      lastSaveError: 'Permission denied',
    });
    const savingState = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      isSaving: true,
    });

    expect(
      buildArchitectTeamPlanContextExitMessage(failedState, 'leave-architect')
    ).toContain('The last Team Plan save failed: Permission denied');
    expect(
      buildArchitectTeamPlanContextExitMessage(savingState, 'leave-architect')
    ).toContain('A Team Plan save is still in progress.');
  });

  it('guards local-only sandbox switching without prompting on browser leave alone', () => {
    const state = deriveArchitectTeamPlanSaveState({ worldId: null });

    expect(shouldGuardArchitectTeamPlanContextExit(state, 'switch-world')).toBe(
      true
    );
    expect(
      shouldGuardArchitectTeamPlanContextExit(state, 'leave-architect')
    ).toBe(false);
  });

  it('returns the user confirmation result for unsafe context exits', () => {
    const state = deriveArchitectTeamPlanSaveState({
      worldId: 'world_123',
      hasStagedTradeDraft: true,
    });
    const confirmCalls: string[] = [];

    const didConfirm = confirmArchitectTeamPlanContextExit(
      state,
      'switch-world',
      (message) => {
        confirmCalls.push(message);
        return false;
      }
    );

    expect(didConfirm).toBe(false);
    expect(confirmCalls[0]).toContain('A trade in progress has not been applied to your plan.');
  });
});
