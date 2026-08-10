/**
 * FILE: src/features/architect/GMDashboard/components/WorldSelector.tsx
 * PURPOSE: WorldSelector dropdown for Architect GMDashboard - select, create, branch, rename, archive, and delete worlds
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-20: Created for Phase 2A WorldSelector implementation per docs/architect/ARCHITECT_GAP_ANALYSIS.md
 *  - 2025-12-21: Added permanent deletion via Cloud Function (Phase 4A)
 *  - 2025-12-21: Extracted DeleteWorldModal to separate file
 */
import {
  useState,
  useEffect,
  useCallback,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import type {
  ArchitectActiveWorldOwner,
  ArchitectWorldModeBoundary,
} from '@/features/architect/GMDashboard/hooks/useArchitectState';
import {
  confirmArchitectTeamPlanContextExit,
  type ArchitectTeamPlanSaveState,
  type ArchitectUnsafeContextExitIntent,
} from '@/features/architect/GMDashboard/hooks/teamPlanSaveState';
import {
  listUserWorlds,
  createWorld,
  branchWorld,
  archiveWorld,
  updateWorldMetadata,
  getWorldMetadata,
  purgeWorld,
} from '@/features/architect/utils/worldManager';
import { DeleteWorldModal } from './DeleteWorldModal';
import { resolveContractBaselineWorldCompatibility } from '@/features/architect/utils/contractSource/contractSourceRelease';

type WorldSummaryLike = {
  worldId: string;
  worldName?: string | null;
  description?: string | null;
  isArchived?: boolean;
  contractBaselineVersion?: number;
  contractSourceRelease?: {
    releaseId: string;
    releaseVersion: number;
    releaseDigest: string;
  };
  contractBaselineEffectiveAt?: string;
  contractBaselineSalaryCapYear?: number;
  contractBaselineCoverage?: {
    total: number;
    complete: number;
    needsInput: number;
  };
};

type WorldMetadataLike = {
  worldName?: string | null;
  description?: string | null;
};

type CreateWorldResultLike = {
  worldId: string;
};

type BranchWorldResultLike = {
  worldId: string;
};

type PurgeResultLike = {
  ok?: boolean;
  queued?: boolean;
  message?: string;
};

type ErrorLike = {
  message?: string;
};

type WorldChangeCallback = (worldId: string | null) => void;

type WorldSelectorProps = {
  userId: string | null;
  activeWorldOwner: ArchitectActiveWorldOwner;
  worldModeBoundary: ArchitectWorldModeBoundary;
  saveState?: ArchitectTeamPlanSaveState | null;
  onWorldChange?: WorldChangeCallback;
};

type WorldModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  /** Error surfaced inside the modal (instead of only in the toolbar). */
  error?: string;
  /** Disables submit (e.g. required name not yet entered) + shows a hint. */
  submitDisabled?: boolean;
};

const WORLD_SELECTOR_LABEL = 'Saved World';
const SANDBOX_OPTION_LABEL = 'Sandbox (local preview, no saved world)';
const SANDBOX_HELPER_COPY =
  'Saved worlds are the primary Architect workspace. Sandbox is a local preview only; world date, season advance, and offer sheets require a saved world.';

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function WorldSelector({
  userId,
  activeWorldOwner,
  worldModeBoundary,
  saveState = null,
  onWorldChange,
}: WorldSelectorProps) {
  const { worldId, setActiveWorld } = activeWorldOwner;
  const isWorldBacked = worldModeBoundary.kind === 'world';
  const [worlds, setWorlds] = useState<WorldSummaryLike[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldDescription, setNewWorldDescription] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWorlds = useCallback(async () => {
    if (!userId) {
      setWorlds([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const userWorlds = (await listUserWorlds(userId, {
          includeArchived: false,
        })) as WorldSummaryLike[];
        setWorlds(userWorlds);
        setIsLoading(false);
        return;
      } catch (err) {
        lastError = err;

        if (attempt < 4) {
          await wait(1000 * (attempt + 1));
        }
      }
    }

    console.error('Failed to load worlds:', lastError);
    setError('Failed to load worlds');
    setWorlds([]);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadWorlds();
  }, [loadWorlds]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowActionsMenu(false);
        setShowCreateModal(false);
        setShowBranchModal(false);
        setShowRenameModal(false);
        setShowDeleteModal(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const confirmContextExit = useCallback(
    (intent: ArchitectUnsafeContextExitIntent) =>
      saveState
        ? confirmArchitectTeamPlanContextExit(saveState, intent)
        : true,
    [saveState]
  );

  const commitActiveWorldSelection = useCallback(
    (
      nextWorldId: string | null,
      intent: ArchitectUnsafeContextExitIntent = 'switch-world',
      options: { skipGuard?: boolean } = {}
    ) => {
      if (nextWorldId === worldId) {
        setShowActionsMenu(false);
        return true;
      }

      if (!options.skipGuard && !confirmContextExit(intent)) {
        return false;
      }

      // WorldSelector is a control surface only. Active-world persistence lives
      // in the hook-owned state layer behind activeWorldOwner.
      setActiveWorld(nextWorldId);
      setShowActionsMenu(false);
      onWorldChange?.(nextWorldId);
      return true;
    },
    [confirmContextExit, onWorldChange, setActiveWorld, worldId]
  );

  const clearActiveWorldSelection = useCallback(
    (options?: { skipGuard?: boolean }) => {
      commitActiveWorldSelection(null, 'switch-world', options);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
    },
    [commitActiveWorldSelection]
  );

  const handleWorldSelect = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const newWorldId = event.target.value || null;
      const selected = worlds.find((world) => world.worldId === newWorldId);
      if (selected) {
        const compatibility = resolveContractBaselineWorldCompatibility(selected);
        if (!compatibility.compatible) {
          setError(compatibility.message);
          event.currentTarget.value = worldId || '';
          return;
        }
      }
      setError('');
      const didCommit = commitActiveWorldSelection(newWorldId, 'switch-world');
      if (!didCommit) {
        event.currentTarget.value = worldId || '';
      }
    },
    [commitActiveWorldSelection, worldId, worlds]
  );

  const handleCreateWorld = useCallback(async () => {
    if (!userId || !newWorldName.trim()) return;
    if (!confirmContextExit('create-world')) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { worldId: newWorldId } = (await createWorld({
        name: newWorldName.trim(),
        description: newWorldDescription.trim(),
        userId,
      })) as CreateWorldResultLike;

      await loadWorlds();
      commitActiveWorldSelection(newWorldId, 'create-world', {
        skipGuard: true,
      });

      setNewWorldName('');
      setNewWorldDescription('');
      setShowCreateModal(false);
    } catch (err) {
      const errorLike = err as ErrorLike;
      console.error('Failed to create world:', err);
      setError(errorLike.message || 'Failed to create world');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    userId,
    newWorldName,
    newWorldDescription,
    confirmContextExit,
    commitActiveWorldSelection,
    loadWorlds,
  ]);

  const handleBranchWorld = useCallback(async () => {
    if (!userId || !worldId || !newWorldName.trim()) return;
    if (!confirmContextExit('branch-world')) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { worldId: branchedWorldId } = (await branchWorld(
        worldId,
        newWorldName.trim(),
        newWorldDescription.trim(),
        userId
      )) as BranchWorldResultLike;

      await loadWorlds();
      commitActiveWorldSelection(branchedWorldId, 'branch-world', {
        skipGuard: true,
      });

      setNewWorldName('');
      setNewWorldDescription('');
      setShowBranchModal(false);
    } catch (err) {
      const errorLike = err as ErrorLike;
      console.error('Failed to branch world:', err);
      setError(errorLike.message || 'Failed to branch world');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    userId,
    worldId,
    newWorldName,
    newWorldDescription,
    confirmContextExit,
    commitActiveWorldSelection,
    loadWorlds,
  ]);

  const handleRenameWorld = useCallback(async () => {
    if (!worldId || !newWorldName.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      await updateWorldMetadata(worldId, {
        worldName: newWorldName.trim(),
        description: newWorldDescription.trim(),
      });

      await loadWorlds();

      setNewWorldName('');
      setNewWorldDescription('');
      setShowRenameModal(false);
    } catch (err) {
      console.error('Failed to rename world:', err);
      setError('Failed to rename world');
    } finally {
      setIsSubmitting(false);
    }
  }, [worldId, newWorldName, newWorldDescription, loadWorlds]);

  const handleArchiveWorld = useCallback(async () => {
    if (!userId || !worldId) return;
    if (!confirmContextExit('archive-world')) return;

    const currentWorld = worlds.find((world) => world.worldId === worldId);
    const worldName = currentWorld?.worldName || worldId;

    if (
      !window.confirm(
        `Archive world "${worldName}"? This will hide it from the list. You can restore it later.`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await archiveWorld(worldId, userId);
      clearActiveWorldSelection({ skipGuard: true });

      await loadWorlds();
    } catch (err) {
      console.error('Failed to archive world:', err);
      setError('Failed to archive world');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    clearActiveWorldSelection,
    confirmContextExit,
    loadWorlds,
    userId,
    worldId,
    worlds,
  ]);

  const handleDeleteWorld = useCallback(async () => {
    if (!worldId) return;

    const currentWorld = worlds.find((world) => world.worldId === worldId);
    const worldName = currentWorld?.worldName || worldId;

    if (deleteConfirmText !== 'DELETE' && deleteConfirmText !== worldName) {
      setError('Please type DELETE or the world name to confirm');
      return;
    }
    if (!confirmContextExit('delete-world')) return;

    setIsSubmitting(true);
    setError('');

    try {
      const result = (await purgeWorld(worldId)) as PurgeResultLike;

      if (result.ok) {
        clearActiveWorldSelection({ skipGuard: true });
        await loadWorlds();
      } else if (result.queued) {
        setError(result.message || '');
      } else {
        setError(result.message || 'Failed to delete world');
      }
    } catch (err) {
      const errorLike = err as ErrorLike;
      console.error('Failed to delete world:', err);
      setError(errorLike.message || 'Failed to delete world');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    worldId,
    worlds,
    deleteConfirmText,
    clearActiveWorldSelection,
    confirmContextExit,
    loadWorlds,
  ]);

  const openDeleteModal = useCallback(() => {
    setDeleteConfirmText('');
    setShowDeleteModal(true);
    setShowActionsMenu(false);
  }, []);

  const openRenameModal = useCallback(async () => {
    if (!worldId) return;

    try {
      const metadata = (await getWorldMetadata(worldId)) as WorldMetadataLike;
      setNewWorldName(metadata.worldName || '');
      setNewWorldDescription(metadata.description || '');
      setShowRenameModal(true);
      setShowActionsMenu(false);
    } catch (err) {
      console.error('Failed to load world metadata:', err);
      setError('Failed to load world metadata');
    }
  }, [worldId]);

  const openBranchModal = useCallback(() => {
    const currentWorld = worlds.find((world) => world.worldId === worldId);
    setNewWorldName(
      currentWorld?.worldName
        ? `${currentWorld.worldName} (Branch)`
        : 'New Branch'
    );
    setNewWorldDescription('');
    setShowBranchModal(true);
    setShowActionsMenu(false);
  }, [worldId, worlds]);

  if (!userId) {
    return (
      <div className="text-xs text-white/50 px-2 py-1">
        Sign in to manage worlds
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-xs text-white/50 px-2 py-1">Loading worlds...</div>
    );
  }

  const currentWorld = worlds.find((world) => world.worldId === worldId);
  const currentContractCompatibility = currentWorld
    ? resolveContractBaselineWorldCompatibility(currentWorld)
    : null;

  return (
    <div className="flex items-center gap-2 relative">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <label htmlFor="world-selector" className="text-xs text-white/70">
            {WORLD_SELECTOR_LABEL}
          </label>
          <span
            className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
              isWorldBacked
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-white/10 bg-white/5 text-white/45'
            }`}
          >
            {isWorldBacked ? 'World' : 'Sandbox'}
          </span>
          <select
            id="world-selector"
            value={worldId || ''}
            onChange={handleWorldSelect}
            className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10 min-w-[140px]"
            disabled={isSubmitting}
          >
            <option value="">{SANDBOX_OPTION_LABEL}</option>
            {worlds.map((world) => (
              <option key={world.worldId} value={world.worldId}>
                {world.worldName || world.worldId}
                {!resolveContractBaselineWorldCompatibility(world).compatible
                  ? ' (recreate required)'
                  : ''}
              </option>
            ))}
          </select>
        </div>
        {!isWorldBacked && (
          <span className="text-[10px] text-white/40 pl-0.5">
            {SANDBOX_HELPER_COPY}
          </span>
        )}
        {isWorldBacked && currentContractCompatibility?.compatible && (
          <span
            className="text-[10px] text-emerald-200/70 pl-0.5"
            data-testid="contract-baseline-status"
          >
            Contract baseline ·{' '}
            {currentContractCompatibility.metadata.contractBaselineCoverage.complete}{' '}
            verified ·{' '}
            {currentContractCompatibility.metadata.contractBaselineCoverage.needsInput}{' '}
            need source details · release{' '}
            {currentContractCompatibility.metadata.contractSourceRelease.releaseVersion}
          </span>
        )}
        {isWorldBacked &&
          currentContractCompatibility &&
          !currentContractCompatibility.compatible && (
            <span
              className="text-[10px] text-red-300 pl-0.5"
              data-testid="contract-baseline-recreate"
            >
              {currentContractCompatibility.message}
            </span>
          )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setNewWorldName('');
            setNewWorldDescription('');
            setShowCreateModal(true);
          }}
          className="px-2 py-1 text-xs bg-green-600/80 hover:bg-green-600 text-white rounded transition-colors"
          disabled={isSubmitting}
          title="Create new world"
        >
          + New
        </button>

        {isWorldBacked && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
              disabled={isSubmitting}
              title="World actions"
            >
              <span className="flex flex-col gap-0.5 items-center">
                <span className="w-1 h-1 bg-current rounded-full" />
                <span className="w-1 h-1 bg-current rounded-full" />
                <span className="w-1 h-1 bg-current rounded-full" />
              </span>
            </button>

            {showActionsMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded shadow-lg z-50 min-w-[140px]">
                <button
                  type="button"
                  onClick={openBranchModal}
                  className="w-full px-3 py-2 text-xs text-left text-white hover:bg-white/10 transition-colors"
                >
                  Branch
                </button>
                <button
                  type="button"
                  onClick={openRenameModal}
                  className="w-full px-3 py-2 text-xs text-left text-white hover:bg-white/10 transition-colors"
                >
                  Rename
                </button>
                <hr className="border-white/10 my-1" />
                <button
                  type="button"
                  onClick={handleArchiveWorld}
                  className="w-full px-3 py-2 text-xs text-left text-yellow-500 hover:bg-white/10 transition-colors"
                >
                  Archive
                </button>
                <button
                  type="button"
                  onClick={openDeleteModal}
                  className="w-full px-3 py-2 text-xs text-left text-red-500 hover:bg-red-900/20 transition-colors font-medium"
                >
                  Delete Permanently
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toolbar error: only when no name-entry modal is open (those show their
          own inline error so a failure isn't hidden behind the dialog). */}
      {error && !showCreateModal && !showBranchModal && !showRenameModal && (
        <span className="text-xs text-red-400 ml-2">{error}</span>
      )}

      {showCreateModal && (
        <WorldModal
          title="Create New World"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateWorld}
          isSubmitting={isSubmitting}
          submitLabel="Create"
          error={error}
          submitDisabled={!newWorldName.trim()}
        >
          <div className="space-y-3">
            <div>
              <label
                htmlFor="create-world-name"
                className="block text-xs text-white/70 mb-1"
              >
                World Name
              </label>
              <input
                id="create-world-name"
                type="text"
                value={newWorldName}
                onChange={(event) => setNewWorldName(event.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white"
                placeholder="My Offseason Plan"
              />
            </div>
            <div>
              <label
                htmlFor="create-world-description"
                className="block text-xs text-white/70 mb-1"
              >
                Description (optional)
              </label>
              <textarea
                id="create-world-description"
                value={newWorldDescription}
                onChange={(event) => setNewWorldDescription(event.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white resize-none"
                placeholder="What's this scenario about?"
                rows={2}
              />
            </div>
          </div>
        </WorldModal>
      )}

      {showBranchModal && (
        <WorldModal
          title="Branch World"
          onClose={() => setShowBranchModal(false)}
          onSubmit={handleBranchWorld}
          isSubmitting={isSubmitting}
          submitLabel="Branch"
          error={error}
          submitDisabled={!newWorldName.trim()}
        >
          <div className="space-y-3">
            <p className="text-xs text-white/70">
              Create a new branch from{' '}
              <span className="font-medium">
                {currentWorld?.worldName || worldId}
              </span>
            </p>
            <div>
              <label
                htmlFor="branch-world-name"
                className="block text-xs text-white/70 mb-1"
              >
                Branch Name
              </label>
              <input
                id="branch-world-name"
                type="text"
                value={newWorldName}
                onChange={(event) => setNewWorldName(event.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white"
                placeholder="Alternative scenario"
              />
            </div>
            <div>
              <label
                htmlFor="branch-world-description"
                className="block text-xs text-white/70 mb-1"
              >
                Description (optional)
              </label>
              <textarea
                id="branch-world-description"
                value={newWorldDescription}
                onChange={(event) => setNewWorldDescription(event.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white resize-none"
                placeholder="How is this different?"
                rows={2}
              />
            </div>
          </div>
        </WorldModal>
      )}

      {showRenameModal && (
        <WorldModal
          title="Rename World"
          onClose={() => setShowRenameModal(false)}
          onSubmit={handleRenameWorld}
          isSubmitting={isSubmitting}
          submitLabel="Save"
          error={error}
          submitDisabled={!newWorldName.trim()}
        >
          <div className="space-y-3">
            <div>
              <label
                htmlFor="rename-world-name"
                className="block text-xs text-white/70 mb-1"
              >
                World Name
              </label>
              <input
                id="rename-world-name"
                type="text"
                value={newWorldName}
                onChange={(event) => setNewWorldName(event.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white"
                placeholder="World name"
              />
            </div>
            <div>
              <label
                htmlFor="rename-world-description"
                className="block text-xs text-white/70 mb-1"
              >
                Description (optional)
              </label>
              <textarea
                id="rename-world-description"
                value={newWorldDescription}
                onChange={(event) => setNewWorldDescription(event.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white resize-none"
                placeholder="Description"
                rows={2}
              />
            </div>
          </div>
        </WorldModal>
      )}

      {showDeleteModal && (
        <DeleteWorldModal
          worldName={
            worlds.find((world) => world.worldId === worldId)?.worldName ||
            worldId
          }
          confirmText={deleteConfirmText}
          setConfirmText={setDeleteConfirmText}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
            setError('');
          }}
          onDelete={handleDeleteWorld}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}

      {showActionsMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowActionsMenu(false)}
        />
      )}
    </div>
  );
}

function WorldModal({
  title,
  children,
  onClose,
  onSubmit,
  isSubmitting,
  submitLabel,
  error,
  submitDisabled = false,
}: WorldModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl p-4 w-80 max-w-[90vw]">
        <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>

        {children}

        {/* Inline feedback so a failure or a missing name is never silent. */}
        {error ? (
          <p
            className="mt-3 text-xs text-red-400"
            role="alert"
            data-testid="world-modal-error"
          >
            {error}
          </p>
        ) : submitDisabled ? (
          <p className="mt-3 text-xs text-white/40" data-testid="world-modal-hint">
            Enter a name to continue.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600"
            disabled={isSubmitting || submitDisabled}
          >
            {isSubmitting ? 'Working...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
