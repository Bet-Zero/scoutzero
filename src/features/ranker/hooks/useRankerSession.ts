// src/features/ranker/hooks/useRankerSession.ts
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
  type RankerSession,
} from '@/firebase/rankerHelpers';
import { createList, saveList } from '@/firebase/listHelpers';
import {
  loadLocalDraft,
  saveLocalDraftImmediate,
  saveLocalDraftDebounced,
  clearLocalDraft,
  hasLocalDraft,
  flushPendingDraftSave,
  createInitialDraft,
  type LoadedRankerDraft,
  type RankerDraftPatch,
} from '@/features/ranker/utils/rankerLocalDraft';
import { createClosureCache, type ClosureCache } from '@/features/ranker/utils/rankingEngine';
import { createRankerListFromRanking } from '@/features/ranker/utils/saveAsListBridge';

type SaveStatus = 'saving' | 'saved' | 'error' | null;
type RankerListItem = string | { id?: string | null };
type RankerDraftState = Omit<LoadedRankerDraft, 'skippedPairs'> & {
  skippedPairs: Set<string> | string[];
};
export type HydratedRankerDraft = RankerDraftState & {
  closureCache: ClosureCache;
};
type SavedListMeta = {
  listId: string;
  listName: string;
};

type CreateLocalDraftParams = {
  playerPoolIds: string[];
  name?: string | null;
};

type RankerFirestoreData = {
  name?: string;
  playerPoolIds: string[];
  setupData: RankerDraftState['setupData'];
  results: RankerDraftState['results'];
  skippedPairs: string[];
  anchorDone: boolean;
  isFinished: boolean;
  adjustments: string[] | null;
  savedListId?: string;
};

export type UseRankerSessionResult = {
  userId: string | null;
  authLoading: boolean;
  isOwner: boolean;
  localDraft: RankerDraftState | null;
  hasLocalSession: boolean;
  firestoreSessionId: string | null;
  firestoreSessions: RankerSession[];
  loadingFirestore: boolean;
  saveStatus: SaveStatus;
  listSaveStatus: SaveStatus;
  savedListMeta: SavedListMeta | null;
  error: string | null;
  createLocalDraft: (params: CreateLocalDraftParams) => void;
  updateLocalDraft: (patch: RankerDraftPatch) => void;
  updateLocalDraftNow: (patch: RankerDraftPatch) => void;
  loadAndHydrateLocalDraft: () => HydratedRankerDraft | null;
  deleteLocalDraft: () => void;
  markFinished: () => void;
  saveAdjustments: (ranking: Array<{ id: string }>) => void;
  clearSession: () => void;
  saveToFirestore: () => Promise<string | null>;
  saveAsList: (
    currentRanking: RankerListItem[]
  ) => Promise<SavedListMeta | null>;
  loadFromFirestore: (sessionId: string) => Promise<HydratedRankerDraft | null>;
  fetchFirestoreSessions: () => Promise<RankerSession[]>;
  deleteFirestoreSession: (sessionId: string) => Promise<void>;
  autosave: (patch: RankerDraftPatch) => void;
  saveNow: (patch: RankerDraftPatch) => void;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const serializeDraftSkippedPairs = (
  skippedPairs: RankerDraftState['skippedPairs'] | null | undefined
): string[] => {
  if (Array.isArray(skippedPairs)) return skippedPairs;
  if (skippedPairs instanceof Set) return Array.from(skippedPairs);
  return [];
};

const buildFirestoreData = (
  draft: RankerDraftState
): RankerFirestoreData => {
  const data: RankerFirestoreData = {
    name: draft.name || undefined,
    playerPoolIds: draft.playerPoolIds,
    setupData: draft.setupData,
    results: draft.results || [],
    skippedPairs: serializeDraftSkippedPairs(draft.skippedPairs),
    anchorDone: draft.anchorDone || false,
    isFinished: draft.isFinished || false,
    adjustments: draft.adjustments,
  };

  if (draft.savedListId) {
    data.savedListId = draft.savedListId;
  }

  return data;
};

/**
 * Hook for managing ranker session persistence.
 * Local-first: All users get sessionStorage persistence.
 * Firestore save is owner-only and explicit (not automatic).
 */
export function useRankerSession(): UseRankerSessionResult {
  const { userId, loading: authLoading } = useAuth();
  const isOwner = isOwnerUid(userId);

  // Local draft state
  const [localDraft, setLocalDraft] = useState<RankerDraftState | null>(() =>
    loadLocalDraft()
  );
  const [hasLocalSession, setHasLocalSession] = useState<boolean>(() =>
    hasLocalDraft()
  );

  // Firestore session state (for owner's saved sessions)
  const [firestoreSessionId, setFirestoreSessionId] = useState<string | null>(null);
  const [firestoreSessions, setFirestoreSessions] = useState<RankerSession[]>([]);
  const [loadingFirestore, setLoadingFirestore] = useState<boolean>(false);

  // Save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [listSaveStatus, setListSaveStatus] = useState<SaveStatus>(null);
  const [savedListMeta, setSavedListMeta] = useState<SavedListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for debounce control
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localSaveTimeoutRef.current) {
        clearTimeout(localSaveTimeoutRef.current);
      }
    };
  }, []);

  // Local Draft Operations

  const createLocalDraft = useCallback(
    ({ playerPoolIds, name }: CreateLocalDraftParams): void => {
      const draft = createInitialDraft({ playerPoolIds, name });
      saveLocalDraftImmediate(draft);
      setLocalDraft(draft);
      setHasLocalSession(true);
      setFirestoreSessionId(null);
    },
    []
  );

  const updateLocalDraft = useCallback((patch: RankerDraftPatch): void => {
    setLocalDraft((prev) => {
      if (!prev) return prev;
      const updated: RankerDraftState = {
        ...prev,
        ...patch,
        skippedPairs: patch.skippedPairs ?? prev.skippedPairs,
      };
      saveLocalDraftDebounced(updated);
      return updated;
    });
  }, []);

  const updateLocalDraftNow = useCallback((patch: RankerDraftPatch): void => {
    setLocalDraft((prev) => {
      if (!prev) return prev;
      const updated: RankerDraftState = {
        ...prev,
        ...patch,
        skippedPairs: patch.skippedPairs ?? prev.skippedPairs,
      };
      saveLocalDraftImmediate(updated);
      return updated;
    });
  }, []);

  const loadAndHydrateLocalDraft = useCallback((): HydratedRankerDraft | null => {
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
    };
  }, []);

  const deleteLocalDraft = useCallback((): void => {
    flushPendingDraftSave();
    clearLocalDraft();
    setLocalDraft(null);
    setHasLocalSession(false);
    setFirestoreSessionId(null);
  }, []);

  // Owner-Only Firestore Operations

  const fetchFirestoreSessions = useCallback(async (): Promise<RankerSession[]> => {
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

  const saveToFirestore = useCallback(async (): Promise<string | null> => {
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
      const firestoreData = buildFirestoreData(localDraft);
      let savedId: string;

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
      setError(getErrorMessage(err));
      setSaveStatus('error');
      return null;
    }
  }, [userId, isOwner, localDraft, firestoreSessionId]);

  const loadFromFirestore = useCallback(
    async (sessionId: string): Promise<HydratedRankerDraft | null> => {
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
        const draft: RankerDraftState = {
          name: doc.name,
          playerPoolIds: doc.playerPoolIds,
          setupData: doc.setupData ?? null,
          results: doc.results || [],
          skippedPairs: deserializeSkippedPairs(doc.skippedPairs),
          anchorDone: doc.anchorDone || false,
          isFinished: doc.isFinished || false,
          adjustments: doc.adjustments ?? null,
          draftUpdatedAt: Date.now(),
          firestoreSessionId: sessionId,
          savedListId: doc.savedListId ?? null,
          savedListName: null,
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
        setError(getErrorMessage(err));
        return null;
      } finally {
        setLoadingFirestore(false);
      }
    },
    [userId, isOwner]
  );

  const deleteFirestoreSession = useCallback(
    async (sessionId: string): Promise<void> => {
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

  // Convenience Actions

  const markFinished = useCallback((): void => {
    updateLocalDraftNow({ isFinished: true });
  }, [updateLocalDraftNow]);

  const saveAdjustments = useCallback(
    (ranking: Array<{ id: string }>): void => {
      const adjustments = ranking.map((p) => p.id);
      updateLocalDraftNow({ adjustments });
    },
    [updateLocalDraftNow]
  );

  const clearSession = useCallback((): void => {
    flushPendingDraftSave();
    clearLocalDraft();
    setLocalDraft(null);
    setHasLocalSession(false);
    setFirestoreSessionId(null);
    setError(null);
    setSaveStatus(null);
    setListSaveStatus(null);
    setSavedListMeta(null);
  }, []);

  const saveAsList = useCallback(
    async (currentRanking: RankerListItem[]): Promise<SavedListMeta | null> => {
      if (!isOwner || !userId || !localDraft) return null;

      setListSaveStatus('saving');
      setError(null);

      try {
        const saved = await createRankerListFromRanking({
          isOwner,
          userId,
          sessionName: localDraft.name,
          poolIds: localDraft.playerPoolIds,
          adjustments: localDraft.adjustments,
          currentRanking,
          createListFn: createList,
          saveListFn: saveList,
        });

        if (!saved) {
          setListSaveStatus('error');
          return null;
        }

        const draftPatch = {
          savedListId: saved.listId,
          savedListName: saved.listName,
        };
        const updatedDraft = { ...localDraft, ...draftPatch };
        saveLocalDraftImmediate(updatedDraft);
        setLocalDraft(updatedDraft);

        if (firestoreSessionId) {
          try {
            await updateRankerSession(firestoreSessionId, userId, {
              savedListId: saved.listId,
            });
          } catch (sessionLinkError) {
            console.warn(
              '[useRankerSession] List created, but failed to link session:',
              sessionLinkError
            );
          }
        }

        setSavedListMeta(saved);
        setListSaveStatus('saved');
        setTimeout(() => setListSaveStatus(null), 2000);
        return saved;
      } catch (err) {
        console.error('[useRankerSession] saveAsList error:', err);
        setError(getErrorMessage(err));
        setListSaveStatus('error');
        return null;
      }
    },
    [isOwner, userId, localDraft, firestoreSessionId]
  );

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
    listSaveStatus,
    savedListMeta,
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
    saveAsList,
    loadFromFirestore,
    fetchFirestoreSessions,
    deleteFirestoreSession,

    // Legacy compatibility - autosave now updates local draft
    autosave: updateLocalDraft,
    saveNow: updateLocalDraftNow,
  };
}

