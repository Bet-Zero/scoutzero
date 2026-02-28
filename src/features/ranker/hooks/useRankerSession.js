// src/features/ranker/hooks/useRankerSession.js
// Hook for managing ranker session persistence with autosave.
// Handles create/load/save/resume flows and closure cache reconstruction.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  createRankerSession,
  updateRankerSession,
  getRankerSession,
  queryIncompleteRankerSessions,
  deleteRankerSession,
  serializeSkippedPairs,
  deserializeSkippedPairs,
  serializeAdjustments,
} from '@/firebase/rankerHelpers';
import { createClosureCache } from '@/features/ranker/utils/rankingEngine';

// Autosave debounce delay (ms)
const AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Hook for managing ranker session persistence.
 * @returns {Object} Session management methods and state
 */
export function useRankerSession() {
  const { userId, loading: authLoading } = useAuth();

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [sessionDoc, setSessionDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // For querying incomplete sessions
  const [incompleteSessions, setIncompleteSessions] = useState([]);
  const [loadingIncomplete, setLoadingIncomplete] = useState(false);

  // Autosave control refs
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const changeTokenRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Query for incomplete sessions belonging to current user.
   */
  const fetchIncompleteSessions = useCallback(async () => {
    if (!userId) {
      setIncompleteSessions([]);
      return [];
    }

    setLoadingIncomplete(true);
    try {
      const sessions = await queryIncompleteRankerSessions(userId, 5);
      setIncompleteSessions(sessions);
      return sessions;
    } catch (err) {
      console.error('[useRankerSession] fetchIncompleteSessions error:', err);
      setIncompleteSessions([]);
      return [];
    } finally {
      setLoadingIncomplete(false);
    }
  }, [userId]);

  /**
   * Create a new session and return session ID.
   * @param {Object} params
   * @param {string[]} params.playerPoolIds - Array of player IDs
   * @param {string} [params.name] - Optional session name
   * @param {Object|null} [params.setupData] - Optional initial setup data
   * @returns {Promise<string>} New session ID
   */
  const createSession = useCallback(
    async ({ playerPoolIds, name, setupData = null }) => {
      if (!userId) {
        throw new Error('Cannot create session without user.');
      }

      setLoading(true);
      setError(null);

      try {
        const newId = await createRankerSession({
          userId,
          name,
          playerPoolIds,
          setupData,
        });

        // Load the created doc to get server timestamps
        const doc = await getRankerSession(newId, userId);
        setSessionId(newId);
        setSessionDoc(doc);
        return newId;
      } catch (err) {
        console.error('[useRankerSession] createSession error:', err);
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  /**
   * Load an existing session by ID.
   * Returns hydrated state with closure cache for continuation.
   * @param {string} id - Session document ID
   * @returns {Promise<Object>} Hydrated session state
   */
  const loadSession = useCallback(
    async (id) => {
      if (!userId) {
        throw new Error('Cannot load session without user.');
      }

      setLoading(true);
      setError(null);

      try {
        const doc = await getRankerSession(id, userId);
        setSessionId(id);
        setSessionDoc(doc);

        // Rebuild closure cache from stored results
        const closureCache = createClosureCache();
        if (doc.results && doc.results.length > 0) {
          closureCache.rebuild(doc.results);
        }

        // Convert skippedPairs array back to Set
        const skippedPairs = deserializeSkippedPairs(doc.skippedPairs);

        return {
          ...doc,
          skippedPairs,
          closureCache,
        };
      } catch (err) {
        console.error('[useRankerSession] loadSession error:', err);
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  /**
   * Internal save function (called after debounce).
   */
  const performSave = useCallback(
    async (patch, token) => {
      if (!sessionId || !userId) return;
      if (isSavingRef.current) {
        // Queue for retry
        pendingSaveRef.current = { patch, token };
        return;
      }

      isSavingRef.current = true;

      try {
        await updateRankerSession(sessionId, userId, patch);

        // Update local doc cache
        setSessionDoc((prev) => (prev ? { ...prev, ...patch } : prev));
      } catch (err) {
        console.error('[useRankerSession] performSave error:', err);
        // Don't throw — autosave failures shouldn't crash the UI
      } finally {
        isSavingRef.current = false;

        // Process any pending save that queued while we were saving
        if (pendingSaveRef.current && pendingSaveRef.current.token >= token) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          performSave(pending.patch, pending.token);
        }
      }
    },
    [sessionId, userId]
  );

  /**
   * Debounced autosave function.
   * Call this with state changes and it will batch + debounce writes.
   * @param {Object} patch - Fields to update
   */
  const autosave = useCallback(
    (patch) => {
      if (!sessionId || !userId) return;

      // Increment change token
      const token = ++changeTokenRef.current;

      // Clear any pending timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Serialize skippedPairs if present
      const serializedPatch = { ...patch };
      if (patch.skippedPairs !== undefined) {
        serializedPatch.skippedPairs = serializeSkippedPairs(
          patch.skippedPairs
        );
      }

      // Schedule debounced save
      saveTimeoutRef.current = setTimeout(() => {
        performSave(serializedPatch, token);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [sessionId, userId, performSave]
  );

  /**
   * Force immediate save (no debounce).
   * Use for critical saves like marking finished or saving adjustments.
   * @param {Object} patch - Fields to update
   */
  const saveNow = useCallback(
    async (patch) => {
      if (!sessionId || !userId) return;

      // Clear any pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Serialize skippedPairs if present
      const serializedPatch = { ...patch };
      if (patch.skippedPairs !== undefined) {
        serializedPatch.skippedPairs = serializeSkippedPairs(
          patch.skippedPairs
        );
      }

      const token = ++changeTokenRef.current;
      await performSave(serializedPatch, token);
    },
    [sessionId, userId, performSave]
  );

  /**
   * Save adjustments (canonical final ranking).
   * @param {Array<{id: string}>} ranking - Adjusted ranking array
   */
  const saveAdjustments = useCallback(
    async (ranking) => {
      const adjustments = serializeAdjustments(ranking);
      await saveNow({ adjustments });
    },
    [saveNow]
  );

  /**
   * Mark session as finished.
   */
  const markFinished = useCallback(async () => {
    await saveNow({ isFinished: true });
  }, [saveNow]);

  /**
   * Delete a session.
   * @param {string} [id] - Session ID (defaults to current session)
   */
  const deleteSession = useCallback(
    async (id) => {
      const targetId = id || sessionId;
      if (!targetId || !userId) return;

      try {
        await deleteRankerSession(targetId, userId);

        // If deleting current session, clear state
        if (targetId === sessionId) {
          setSessionId(null);
          setSessionDoc(null);
        }

        // Refresh incomplete sessions list
        await fetchIncompleteSessions();
      } catch (err) {
        console.error('[useRankerSession] deleteSession error:', err);
        throw err;
      }
    },
    [sessionId, userId, fetchIncompleteSessions]
  );

  /**
   * Clear current session state (without deleting from Firestore).
   */
  const clearSession = useCallback(() => {
    setSessionId(null);
    setSessionDoc(null);
    setError(null);

    // Clear any pending saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  return {
    // Auth state
    userId,
    authLoading,

    // Session state
    sessionId,
    sessionDoc,
    loading,
    error,

    // Incomplete sessions
    incompleteSessions,
    loadingIncomplete,
    fetchIncompleteSessions,

    // Actions
    createSession,
    loadSession,
    autosave,
    saveNow,
    saveAdjustments,
    markFinished,
    deleteSession,
    clearSession,

    // Utility: check if there's an active session
    hasActiveSession: !!sessionId,
  };
}

export default useRankerSession;
