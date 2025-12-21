/**
 * FILE: src/features/architect/GMDashboard/components/WorldSelector.jsx
 * PURPOSE: WorldSelector dropdown for Architect GMDashboard - select, create, branch, rename, archive, and delete worlds
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-20: Created for Phase 2A WorldSelector implementation per ARCHITECT_GAP_ANALYSIS.md
 *  - 2025-12-21: Added permanent deletion via Cloud Function (Phase 4A)
 *
 * LINKS:
 *  - worldManager API: src/features/architect/utils/worldManager.js
 *  - GMDashboard integration: src/features/architect/GMDashboard/GMDashboard.jsx
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  listUserWorlds,
  createWorld,
  branchWorld,
  updateWorldMetadata,
  getWorldMetadata,
  purgeWorld,
} from '@/features/architect/utils/worldManager';

// ==============================================================================
// CONSTANTS
// ==============================================================================

/** localStorage key pattern for persisting active worldId */
const getWorldStorageKey = (userId) => `architect.activeWorldId.${userId}`;

// ==============================================================================
// COMPONENT
// ==============================================================================

/**
 * WorldSelector - Dropdown and controls for managing Architect worlds
 *
 * @param {Object} props
 * @param {string|null} props.userId - Current user ID (required for world operations)
 * @param {string|null} props.worldId - Currently selected world ID
 * @param {Function} props.setWorldId - Setter to update worldId in parent state
 * @param {Function} [props.onWorldChange] - Optional callback when world changes
 */
export function WorldSelector({ userId, worldId, setWorldId, onWorldChange }) {
  // State for worlds list
  const [worlds, setWorlds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // State for modals/dialogs
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Form state
  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldDescription, setNewWorldDescription] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref to track if initial load has restored from localStorage
  const hasRestoredFromStorage = useRef(false);

  // ===========================================================================
  // LOAD WORLDS
  // ===========================================================================

  const loadWorlds = useCallback(async () => {
    if (!userId) {
      setWorlds([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const userWorlds = await listUserWorlds(userId, { includeArchived: false });
      setWorlds(userWorlds);
    } catch (err) {
      console.error('Failed to load worlds:', err);
      setError('Failed to load worlds');
      setWorlds([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load worlds on mount and when userId changes
  useEffect(() => {
    loadWorlds();
  }, [loadWorlds]);

  // ===========================================================================
  // RESTORE FROM LOCALSTORAGE
  // ===========================================================================

  useEffect(() => {
    if (!userId || hasRestoredFromStorage.current || isLoading) return;

    const storageKey = getWorldStorageKey(userId);
    const storedWorldId = localStorage.getItem(storageKey);

    if (storedWorldId && worlds.length > 0) {
      // Verify the stored world still exists
      const worldExists = worlds.some((w) => w.worldId === storedWorldId);

      if (worldExists && !worldId) {
        setWorldId(storedWorldId);
        hasRestoredFromStorage.current = true;
      } else if (!worldExists) {
        // Stored world no longer exists, clear it
        localStorage.removeItem(storageKey);
      }
    }

    // Mark as restored even if nothing was restored
    hasRestoredFromStorage.current = true;
    // Note: setWorldId is a stable React setState function, but included for completeness
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, worldId, worlds, isLoading]);

  // ===========================================================================
  // PERSIST TO LOCALSTORAGE
  // ===========================================================================

  useEffect(() => {
    if (!userId) return;

    const storageKey = getWorldStorageKey(userId);

    if (worldId) {
      localStorage.setItem(storageKey, worldId);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [userId, worldId]);

  // ===========================================================================
  // ESCAPE KEY HANDLER
  // ===========================================================================

  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
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

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleWorldSelect = useCallback(
    (e) => {
      const newWorldId = e.target.value || null;
      setWorldId(newWorldId);
      setShowActionsMenu(false);

      if (onWorldChange) {
        onWorldChange(newWorldId);
      }
    },
    [setWorldId, onWorldChange]
  );

  const handleCreateWorld = useCallback(async () => {
    if (!userId || !newWorldName.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { worldId: newWorldId } = await createWorld({
        name: newWorldName.trim(),
        description: newWorldDescription.trim(),
        userId,
      });

      // Refresh worlds list
      await loadWorlds();

      // Select the new world
      setWorldId(newWorldId);

      // Reset form and close modal
      setNewWorldName('');
      setNewWorldDescription('');
      setShowCreateModal(false);

      if (onWorldChange) {
        onWorldChange(newWorldId);
      }
    } catch (err) {
      console.error('Failed to create world:', err);
      setError('Failed to create world');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    userId,
    newWorldName,
    newWorldDescription,
    loadWorlds,
    setWorldId,
    onWorldChange,
  ]);

  const handleBranchWorld = useCallback(async () => {
    if (!userId || !worldId || !newWorldName.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { worldId: branchedWorldId } = await branchWorld(
        worldId,
        newWorldName.trim(),
        newWorldDescription.trim(),
        userId
      );

      // Refresh worlds list
      await loadWorlds();

      // Select the branched world
      setWorldId(branchedWorldId);

      // Reset form and close modal
      setNewWorldName('');
      setNewWorldDescription('');
      setShowBranchModal(false);

      if (onWorldChange) {
        onWorldChange(branchedWorldId);
      }
    } catch (err) {
      console.error('Failed to branch world:', err);
      setError('Failed to branch world');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    userId,
    worldId,
    newWorldName,
    newWorldDescription,
    loadWorlds,
    setWorldId,
    onWorldChange,
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

      // Refresh worlds list
      await loadWorlds();

      // Reset form and close modal
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
    if (!worldId) return;

    // Find world name for confirmation
    const currentWorld = worlds.find((w) => w.worldId === worldId);
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
      await updateWorldMetadata(worldId, { isArchived: true });

      // Refresh worlds list
      await loadWorlds();

      // Clear selection since archived world is hidden
      setWorldId(null);
      setShowActionsMenu(false);

      if (onWorldChange) {
        onWorldChange(null);
      }
    } catch (err) {
      console.error('Failed to archive world:', err);
      setError('Failed to archive world');
    } finally {
      setIsSubmitting(false);
    }
  }, [worldId, worlds, loadWorlds, setWorldId, onWorldChange]);

  const handleDeleteWorld = useCallback(async () => {
    if (!worldId) return;

    const currentWorld = worlds.find((w) => w.worldId === worldId);
    const worldName = currentWorld?.worldName || worldId;

    // Validate confirmation text
    if (deleteConfirmText !== 'DELETE' && deleteConfirmText !== worldName) {
      setError('Please type DELETE or the world name to confirm');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await purgeWorld(worldId);

      if (result.ok) {
        // Refresh worlds list
        await loadWorlds();

        // Clear selection
        setWorldId(null);
        setShowDeleteModal(false);
        setDeleteConfirmText('');
        setShowActionsMenu(false);

        if (onWorldChange) {
          onWorldChange(null);
        }
      } else if (result.queued) {
        // Deletion started but timed out - show message and suggest retry
        setError(result.message);
      } else {
        setError(result.message || 'Failed to delete world');
      }
    } catch (err) {
      console.error('Failed to delete world:', err);
      setError(err.message || 'Failed to delete world');
    } finally {
      setIsSubmitting(false);
    }
  }, [worldId, worlds, deleteConfirmText, loadWorlds, setWorldId, onWorldChange]);

  const openDeleteModal = useCallback(() => {
    setDeleteConfirmText('');
    setShowDeleteModal(true);
    setShowActionsMenu(false);
  }, []);

  const openRenameModal = useCallback(async () => {
    if (!worldId) return;

    try {
      const metadata = await getWorldMetadata(worldId);
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
    const currentWorld = worlds.find((w) => w.worldId === worldId);
    setNewWorldName(currentWorld?.worldName ? `${currentWorld.worldName} (Branch)` : 'New Branch');
    setNewWorldDescription('');
    setShowBranchModal(true);
    setShowActionsMenu(false);
  }, [worldId, worlds]);

  // ===========================================================================
  // RENDER - NO USER
  // ===========================================================================

  if (!userId) {
    return (
      <div className="text-xs text-white/50 px-2 py-1">
        Sign in to manage worlds
      </div>
    );
  }

  // ===========================================================================
  // RENDER - LOADING
  // ===========================================================================

  if (isLoading) {
    return (
      <div className="text-xs text-white/50 px-2 py-1">Loading worlds...</div>
    );
  }

  // ===========================================================================
  // RENDER - MAIN
  // ===========================================================================

  const currentWorld = worlds.find((w) => w.worldId === worldId);

  return (
    <div className="flex items-center gap-2 relative">
      {/* World Dropdown */}
      <div className="flex items-center gap-1">
        <label htmlFor="world-selector" className="text-xs text-white/70">World</label>
        <select
          id="world-selector"
          value={worldId || ''}
          onChange={handleWorldSelect}
          className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10 min-w-[140px]"
          disabled={isSubmitting}
        >
          <option value="">No World Selected</option>
          {worlds.map((world) => (
            <option key={world.worldId} value={world.worldId}>
              {world.worldName || world.worldId}
            </option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Create World Button */}
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

        {/* Actions Menu (only if world selected) */}
        {worldId && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
              disabled={isSubmitting}
              title="World actions"
            >
              {/* Three vertical dots icon using CSS */}
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

      {/* Error Display */}
      {error && (
        <span className="text-xs text-red-400 ml-2">{error}</span>
      )}

      {/* Create World Modal */}
      {showCreateModal && (
        <WorldModal
          title="Create New World"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateWorld}
          isSubmitting={isSubmitting}
          submitLabel="Create"
        >
          <div className="space-y-3">
            <div>
              <label htmlFor="create-world-name" className="block text-xs text-white/70 mb-1">
                World Name
              </label>
              <input
                id="create-world-name"
                type="text"
                value={newWorldName}
                onChange={(e) => setNewWorldName(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white"
                placeholder="My Offseason Plan"
              />
            </div>
            <div>
              <label htmlFor="create-world-description" className="block text-xs text-white/70 mb-1">
                Description (optional)
              </label>
              <textarea
                id="create-world-description"
                value={newWorldDescription}
                onChange={(e) => setNewWorldDescription(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white resize-none"
                placeholder="What's this scenario about?"
                rows={2}
              />
            </div>
          </div>
        </WorldModal>
      )}

      {/* Branch World Modal */}
      {showBranchModal && (
        <WorldModal
          title="Branch World"
          onClose={() => setShowBranchModal(false)}
          onSubmit={handleBranchWorld}
          isSubmitting={isSubmitting}
          submitLabel="Branch"
        >
          <div className="space-y-3">
            <p className="text-xs text-white/70">
              Create a new branch from{' '}
              <span className="font-medium">{currentWorld?.worldName || worldId}</span>
            </p>
            <div>
              <label htmlFor="branch-world-name" className="block text-xs text-white/70 mb-1">
                Branch Name
              </label>
              <input
                id="branch-world-name"
                type="text"
                value={newWorldName}
                onChange={(e) => setNewWorldName(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white"
                placeholder="Alternative scenario"
              />
            </div>
            <div>
              <label htmlFor="branch-world-description" className="block text-xs text-white/70 mb-1">
                Description (optional)
              </label>
              <textarea
                id="branch-world-description"
                value={newWorldDescription}
                onChange={(e) => setNewWorldDescription(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white resize-none"
                placeholder="How is this different?"
                rows={2}
              />
            </div>
          </div>
        </WorldModal>
      )}

      {/* Rename World Modal */}
      {showRenameModal && (
        <WorldModal
          title="Rename World"
          onClose={() => setShowRenameModal(false)}
          onSubmit={handleRenameWorld}
          isSubmitting={isSubmitting}
          submitLabel="Save"
        >
          <div className="space-y-3">
            <div>
              <label htmlFor="rename-world-name" className="block text-xs text-white/70 mb-1">
                World Name
              </label>
              <input
                id="rename-world-name"
                type="text"
                value={newWorldName}
                onChange={(e) => setNewWorldName(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white"
                placeholder="World name"
              />
            </div>
            <div>
              <label htmlFor="rename-world-description" className="block text-xs text-white/70 mb-1">
                Description (optional)
              </label>
              <textarea
                id="rename-world-description"
                value={newWorldDescription}
                onChange={(e) => setNewWorldDescription(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1 text-sm text-white resize-none"
                placeholder="Description"
                rows={2}
              />
            </div>
          </div>
        </WorldModal>
      )}

      {/* Delete World Modal */}
      {showDeleteModal && (
        <DeleteWorldModal
          worldName={worlds.find((w) => w.worldId === worldId)?.worldName || worldId}
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

      {/* Click outside handler for actions menu */}
      {showActionsMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowActionsMenu(false)}
        />
      )}
    </div>
  );
}

// ==============================================================================
// WORLD MODAL COMPONENT
// ==============================================================================

/**
 * Reusable modal for world operations
 */
function WorldModal({
  title,
  children,
  onClose,
  onSubmit,
  isSubmitting,
  submitLabel,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl p-4 w-80 max-w-[90vw]">
        <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>

        {children}

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
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Working...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// DELETE WORLD MODAL COMPONENT
// ==============================================================================

/**
 * Confirmation modal for permanent world deletion
 * Requires user to type "DELETE" or the world name to confirm
 */
function DeleteWorldModal({
  worldName,
  confirmText,
  setConfirmText,
  onClose,
  onDelete,
  isSubmitting,
  error,
}) {
  const isConfirmValid = confirmText === 'DELETE' || confirmText === worldName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] border border-red-900/50 rounded-lg shadow-xl p-4 w-96 max-w-[90vw]">
        {/* Warning Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg">!</span>
          </div>
          <h3 className="text-sm font-semibold text-red-400">Delete World Permanently</h3>
        </div>

        {/* Warning Message */}
        <div className="bg-red-900/20 border border-red-900/50 rounded p-3 mb-4">
          <p className="text-xs text-red-300 mb-2">
            <strong>⚠️ This action is irreversible!</strong>
          </p>
          <p className="text-xs text-white/80">
            You are about to permanently delete <strong className="text-white">"{worldName}"</strong>{' '}
            and all its data including:
          </p>
          <ul className="text-xs text-white/70 mt-2 ml-3 list-disc">
            <li>All team snapshots</li>
            <li>All player overrides</li>
            <li>World metadata and history</li>
          </ul>
        </div>

        {/* Confirmation Input */}
        <div className="mb-4">
          <label htmlFor="delete-confirm" className="block text-xs text-white/70 mb-1">
            Type <strong className="text-red-400">DELETE</strong> or{' '}
            <strong className="text-red-400">{worldName}</strong> to confirm:
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full bg-[#0d0d0d] border border-red-900/50 rounded px-2 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
            placeholder="Type confirmation..."
            autoComplete="off"
            autoFocus
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/30 border border-red-900 rounded p-2 mb-4">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            disabled={isSubmitting || !isConfirmValid}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin">⏳</span> Deleting...
              </span>
            ) : (
              'Delete Permanently'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
