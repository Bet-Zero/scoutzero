// src/features/ranker/hooks/useRankerSession.js
// Hook for managing ranker session persistence with local-first architecture.
// - All users: Local draft in sessionStorage (crash/refresh safe)
// - Owner only: Explicit "Save to Firestore" action
// Does NOT write to Firestore during ranking for any user.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { isOwnerUid } from '@/config/ownerConfig';
import {
  createRankerSession,
  updateRankerSession,
  getRankerSession,
  queryAllRankerSessions,
  deleteRankerSession,
  deserializeSkippedPairs,
} from '@/firebase/rankerHelpers';
import {
  loadLocalDraft,
  saveLocalDraftImmediate,
  saveLocalDraftDebounced,
  clearLocalDraft,
  hasLocalDraft,
  flushPendingDraftSave,
  createInitialDraft,
} from '@/features/ranker/utils/rankerLocalDraft';
import { createClosureCache } from '@/features/ranker/utils/rankingEngine';

/**
 * Hook for managing ranker session persistence.
 * Local-first: All users get sessionStorage persistence.
 * Firestore save is owner-only and explicit (not automatic).
 * @returns {Object} Session management methods and state
 */
export function useRankerSession() {
  const { userId, loading: authLoading } = useAuth();
  const isOwner = isOwnerUid(userId);

  // Local draft state
  const [localDraft, setLocalDraft] = useState(() => loadLocalDraft());
  const [hasLocalSession, setHasLocalSession] = useState(() => hasLocalDraft());

  // Firestore session state (for owner's saved sessions)
  const [firestoreSessionId, setFirestoreSessionId] = useState(null);
  const [firestoreSessions, setFirestoreSessions] = useState([]);
  const [loadingFirestore, setLoadingFirestore] = useState(false);

  // Save status
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error' | null
  const [error, setError] = useState(null);

  // Refs for debounce control
  const localSaveTimeoutRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localSaveTimeoutRef.current) {
        clearTimeout(localSaveTimeoutRef.current);
      }
    };
  }, []);

  // ─── Local Draft Operations ───────────────────────────────────────────────────

  /**
   * Create a new local draft (overwrites any existing).
   * @param {Object} params
   * @param {string[]} params.playerPoolIds - Array of player IDs
   * @param {string} [params.name] - Optional session name
   */
  const createLocalDraft = useCallback(({ playerPoolIds, name }) => {
    const draft = createInitialDraft({ playerPoolIds, name });
    saveLocalDraftImmediate(draft);
    setLocalDraft(draft);
    setHasLocalSession(true);
    setFirestoreSessionId(null); // New draft, no Firestore association
  }, []);

  /**
   * Update local draft with debounce.
   * Call on every user action (select, skip, undo, setup completion).
   * @param {Object} patch - Fields to update
   */
  const updateLocalDraft = useCallback((patch) => {
    // Immediately update React state
    setLocalDraft((prev) => {
      const updated = { ...prev, ...patch };
      // Debounced save to sessionStorage
      saveLocalDraftDebounced(updated);
      return updated;
    });
  }, []);

  /**
   * Update local draft immediately (no debounce).
   * Use for critical saves like marking finished.
   * @param {Object} patch - Fields to update
   */
  const updateLocalDraftNow = useCallback((patch) => {
    setLocalDraft((prev) => {
      const updated = { ...prev, ...patch };
      saveLocalDraftImmediate(updated);
      return updated;
    });
  }, []);

  /**
   * Load and hydrate local draft for resumption.
   * Rebuilds closure cache from results.
   * @returns {Object|null} Hydrated draft data or null
   */
  const loadAndHydrateLocalDraft = useCallback(() => {
    const draft = loadLocalDraft();
    if (!draft) return null;

    // Rebuild closure cache from stored results
    const closureCache = createClosureCache();
    if (draft.results && draft.results.length > 0) {
      closureCache.rebuild(draft.results);
    }

    setLocalDraft(draft);
    setHasLocalSession(true);

    // If there's an associated Firestore session ID, restore it
    if (draft.firestoreSessionId) {
      setFirestoreSessionId(draft.firestoreSessionId);
    }

    return {
      ...draft,
      closureCache,
      // skippedPairs already converted to Set by loadLocalDraft
    };
  }, []);

  /**
   * Clear local draft.
   */
  const deleteLocalDraft = useCallback(() => {
    flushPendingDraftSave();
    clearLocalDraft();
    setLocalDraft(null);
    setHasLocalSession(false);
    setFirestoreSessionId(null);
  }, []);

  // ─── Owner-Only Firestore Operations ──────────────────────────────────────────

  /**
   * Fetch saved Firestore sessions for the owner.
   * Non-owners get empty array.
   */
  const fetchFirestoreSessions = useCallback(async () => {
    if (!userId || !isOwner) {
      setFirestoreSessions([]);
      return [];
    }

    setLoadingFirestore(true);
    try {
      const sessions = await queryAllRankerSessions(userId, 20);
      setFirestoreSessions(sessions);
      return sessions;
    } catch (err) {
      console.error('[useRankerSession] fetchFirestoreSessions error:', err);
      setFirestoreSessions([]);
      return [];
    } finally {
      setLoadingFirestore(false);
    }
  }, [userId, isOwner]);

  /**
   * Save current local draft to Firestore (owner only).
   * Creates new doc or updates existing if firestoreSessionId is set.
   * @returns {Promise<string|null>} Firestore session ID or null on failure
   */
  const saveToFirestore = useCallback(async () => {
    if (!userId) {
      setError('Not authenticated');
      return null;
    }
    if (!isOwner) {
      setError('Not authorized to save to Firestore');
      return null;
    }
    if (!localDraft) {
      setError('No local draft to save');
      return null;
    }

    // Flush any pending local saves first
    flushPendingDraftSave();
    saveLocalDraftImmediate(localDraft);

    setSaveStatus('saving');
    setError(null);

    try {
      // Prepare data for Firestore
      const firestoreData = {
        name: localDraft.name,
        playerPoolIds: localDraft.playerPoolIds,
        setupData: localDraft.setupData,
        results: localDraft.results || [],
        skippedPairs: Array.isArray(localDraft.skippedPairs)
          ? localDraft.skippedPairs
          : localDraft.skippedPairs instanceof Set
            ? Array.from(localDraft.skippedPairs)
            : [],
        anchorDone: localDraft.anchorDone || false,
        isFinished: localDraft.isFinished || false,
        adjustments: localDraft.adjustments,
      };

      let savedId;

      if (firestoreSessionId) {
        // Update existing session
        await updateRankerSession(firestoreSessionId, userId, firestoreData);
        savedId = firestoreSessionId;
      } else {
        // Create new session
        savedId = await createRankerSession({
          userId,
          ...firestoreData,
        });
        setFirestoreSessionId(savedId);

        // Store the Firestore ID in local draft for association
        const updatedDraft = { ...localDraft, firestoreSessionId: savedId };
        saveLocalDraftImmediate(updatedDraft);
        setLocalDraft(updatedDraft);
      }

      setSaveStatus('saved');

      // Reset status after a delay
      setTimeout(() => setSaveStatus(null), 2000);

      return savedId;
    } catch (err) {
      console.error('[useRankerSession] saveToFirestore error:', err);
      setError(err.message);
      setSaveStatus('error');
      return null;
    }
  }, [userId, isOwner, localDraft, firestoreSessionId]);

  /**
   * Load a Firestore session into local draft (owner only).
   * @param {string} sessionId - Firestore session document ID
   * @returns {Promise<Object|null>} Hydrated session data or null
   */
  const loadFromFirestore = useCallback(
    async (sessionId) => {
      if (!userId) {
        setError('Not authenticated');
        return null;
      }
      if (!isOwner) {
        setError('Not authorized to load from Firestore');
        return null;
      }

      setLoadingFirestore(true);
      setError(null);

      try {
        const doc = await getRankerSession(sessionId, userId);

        // Rebuild closure cache
        const closureCache = createClosureCache();
        if (doc.results && doc.results.length > 0) {
          closureCache.rebuild(doc.results);
        }

        // Convert to local draft format
        const draft = {
          name: doc.name,
          playerPoolIds: doc.playerPoolIds,
          setupData: doc.setupData,
          results: doc.results || [],
          skippedPairs: deserializeSkippedPairs(doc.skippedPairs),
          anchorDone: doc.anchorDone || false,
          isFinished: doc.isFinished || false,
          adjustments: doc.adjustments,
          draftUpdatedAt: Date.now(),
          firestoreSessionId: sessionId,
        };

        // Save to local storage and state
        saveLocalDraftImmediate(draft);
        setLocalDraft(draft);
        setHasLocalSession(true);
        setFirestoreSessionId(sessionId);

        return {
          ...draft,
          closureCache,
        };
      } catch (err) {
        console.error('[useRankerSession] loadFromFirestore error:', err);
        setError(err.message);
        return null;
      } finally {
        setLoadingFirestore(false);
      }
    },
    [userId, isOwner]
  );

  /**
   * Delete a Firestore session (owner only).
   * @param {string} sessionId - Session document ID
   */
  const deleteFirestoreSession = useCallback(
    async (sessionId) => {
      if (!userId || !isOwner) return;

      try {
        await deleteRankerSession(sessionId, userId);

        // If deleting currently associated session, clear association
        if (sessionId === firestoreSessionId) {
          setFirestoreSessionId(null);
          // Update local draft to remove association
          if (localDraft) {
            const updatedDraft = { ...localDraft, firestoreSessionId: null };
            saveLocalDraftImmediate(updatedDraft);
            setLocalDraft(updatedDraft);
          }
        }

        // Refresh sessions list
        await fetchFirestoreSessions();
      } catch (err) {
        console.error('[useRankerSession] deleteFirestoreSession error:', err);
        throw err;
      }
    },
    [userId, isOwner, firestoreSessionId, localDraft, fetchFirestoreSessions]
  );

  // ─── Convenience Actions ──────────────────────────────────────────────────────

  /**
   * Mark local draft as finished.
   */
  const markFinished = useCallback(() => {
    updateLocalDraftNow({ isFinished: true });
  }, [updateLocalDraftNow]);

  /**
   * Save adjustments to local draft.
   * @param {Array<{id: string}>} ranking - Adjusted ranking array
   */
  const saveAdjustments = useCallback(
    (ranking) => {
      const adjustments = ranking.map((p) => p.id);
      updateLocalDraftNow({ adjustments });
    },
    [updateLocalDraftNow]
  );

  /**
   * Clear all session state (local and Firestore references).
   */
  const clearSession = useCallback(() => {
    flushPendingDraftSave();
    clearLocalDraft();
    setLocalDraft(null);
    setHasLocalSession(false);
    setFirestoreSessionId(null);
    setError(null);
    setSaveStatus(null);
  }, []);

  return {
    // Auth state
    userId,
    authLoading,
    isOwner,

    // Local draft state
    localDraft,
    hasLocalSession,

    // Firestore state (owner only)
    firestoreSessionId,
    firestoreSessions,
    loadingFirestore,

    // Status
    saveStatus,
    error,

    // Local draft actions (all users)
    createLocalDraft,
    updateLocalDraft,
    updateLocalDraftNow,
    loadAndHydrateLocalDraft,
    deleteLocalDraft,
    markFinished,
    saveAdjustments,
    clearSession,

    // Firestore actions (owner only)
    saveToFirestore,
    loadFromFirestore,
    fetchFirestoreSessions,
    deleteFirestoreSession,

    // Legacy compatibility - autosave now updates local draft
    autosave: updateLocalDraft,
    saveNow: updateLocalDraftNow,
  };
}

export default useRankerSession;
