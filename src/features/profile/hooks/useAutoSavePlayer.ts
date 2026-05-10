/**
 * FILE: src/features/profile/hooks/useAutoSavePlayer.ts
 * PURPOSE: Autosave scouting evaluation data to Firestore evaluations/current and denormalized views.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-22: Added saveNow() for explicit modal Save button
 *  - 2026-01-22: Phase 4 - Debounced autosave and guarded in-flight saves
 *  - 2026-01-22: Phase 3 - Added videoExamples to autosave payloads
 *  - 2026-01-21: Phase 2 - Added isSaving/saveError state, made writes resilient with set+merge
 *  - 2026-01-21: Updated by plan `plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-4/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { writeBatch } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { evalRef, seasonRef, playerRef } from '@/data/firestorePaths';
import { normalizeBlurbs } from '@/shared/utils/blurbs';
import type { Blurbs } from '@/shared/utils/blurbs';
import { normalizeVideoExamples } from '@/shared/utils/videoExamples';
import type { NormalizedVideoExamples } from '@/shared/utils/videoExamples';
import type {
  EnrichablePlayerData,
  EnrichedPlayerData,
  PlayerSubRoles,
} from '@/features/roster/utils/enrichPlayerData';
import type { ProfileRoles } from '@/features/profile/hooks/usePlayerProfileState';

const AUTOSAVE_DEBOUNCE_MS = 750;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type SanitizedValue =
  | string
  | number
  | boolean
  | null
  | Date
  | SanitizedValue[]
  | { [key: string]: SanitizedValue };

export type AutoSavePlayerInput = {
  playerId: string;
  player: EnrichedPlayerData<EnrichablePlayerData> | null;
  traits: Record<string, number>;
  roles: ProfileRoles;
  twoWay: number;
  subRoles: PlayerSubRoles;
  badges: string[];
  shootingProfile: string;
  overallGrade: number | null;
  blurbs: Blurbs;
  videoExamples: NormalizedVideoExamples;
  hasChanges: boolean;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
};

type AutoSaveSnapshot = Omit<
  AutoSavePlayerInput,
  'hasChanges' | 'setHasChanges'
>;

type CompleteAutoSaveSnapshot = AutoSaveSnapshot & {
  player: EnrichedPlayerData<EnrichablePlayerData>;
};

type SaveNowOverride = Partial<AutoSaveSnapshot> & {
  hasChanges?: boolean;
};

export type UseAutoSavePlayerResult = {
  isSaving: boolean;
  saveError: string | null;
  saveState: SaveState;
  saveNow: (snapshotOverride?: SaveNowOverride | null) => Promise<void>;
};

const stripUndefinedDeep = (value: unknown): SanitizedValue | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item): item is SanitizedValue => item !== undefined);
  }

  if (typeof value === 'object') {
    const cleaned: Record<string, SanitizedValue> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const cleanedVal = stripUndefinedDeep(val);
      if (cleanedVal !== undefined) {
        cleaned[key] = cleanedVal;
      }
    }
    return cleaned;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return undefined;
};

const sanitizeWriteData = (
  value: Record<string, unknown>
): Record<string, SanitizedValue> => {
  const sanitized = stripUndefinedDeep(value);
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === 'object'
    ? (sanitized as Record<string, SanitizedValue>)
    : {};
};

const isCompleteSnapshot = (
  snapshot: Partial<AutoSaveSnapshot> | null
): snapshot is CompleteAutoSaveSnapshot => {
  return Boolean(
    snapshot?.playerId &&
      snapshot.player &&
      snapshot.traits &&
      snapshot.roles &&
      typeof snapshot.twoWay === 'number' &&
      snapshot.subRoles &&
      Array.isArray(snapshot.badges) &&
      typeof snapshot.shootingProfile === 'string' &&
      snapshot.blurbs &&
      snapshot.videoExamples
  );
};

export const useAutoSavePlayer = ({
  playerId,
  player,
  traits,
  roles,
  twoWay,
  subRoles,
  badges,
  shootingProfile,
  overallGrade,
  blurbs,
  videoExamples,
  hasChanges,
  setHasChanges,
}: AutoSavePlayerInput): UseAutoSavePlayerResult => {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const latestSnapshotRef = useRef<AutoSaveSnapshot | null>(null);
  const changeTokenRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<boolean>(false);
  const performSaveRef = useRef<
    ((snapshotOverride?: SaveNowOverride | null) => Promise<void>) | null
  >(null);
  const saveCompleteResolversRef = useRef<Array<() => void>>([]);

  // Clear error when user makes new changes
  useEffect(() => {
    if (hasChanges && saveError) {
      setSaveError(null);
      setSaveState('idle');
    }
  }, [hasChanges, saveError]);

  useEffect(() => {
    latestSnapshotRef.current = {
      playerId,
      player,
      traits,
      roles,
      twoWay,
      subRoles,
      badges,
      shootingProfile,
      overallGrade,
      blurbs,
      videoExamples,
    };

    if (hasChanges) {
      changeTokenRef.current += 1;
    }
  }, [
    playerId,
    player,
    traits,
    roles,
    twoWay,
    subRoles,
    badges,
    shootingProfile,
    overallGrade,
    blurbs,
    videoExamples,
    hasChanges,
  ]);

  const scheduleSave = useCallback((delay = AUTOSAVE_DEBOUNCE_MS): void => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (isSavingRef.current) {
        pendingSaveRef.current = true;
        return;
      }

      const runSave = performSaveRef.current;
      if (typeof runSave === 'function') {
        void runSave();
      }
    }, delay);
  }, []);

  const performSave = useCallback(async (
    snapshotOverride: SaveNowOverride | null = null
  ): Promise<void> => {
    const snapshot = snapshotOverride
      ? { ...(latestSnapshotRef.current ?? {}), ...snapshotOverride }
      : latestSnapshotRef.current;
    if (!isCompleteSnapshot(snapshot)) return;
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    const saveToken = changeTokenRef.current;
    pendingSaveRef.current = false;
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveState('saving');
    setSaveError(null);

    let didSucceed = false;

    try {
      const normalizedBlurbs = normalizeBlurbs(snapshot.blurbs);
      const normalizedVideoExamples = normalizeVideoExamples(
        snapshot.videoExamples
      );
      const evaluationData = {
        traits: snapshot.traits,
        roles: snapshot.roles,
        subRoles: snapshot.subRoles,
        badges: snapshot.badges,
        shootingProfile: snapshot.shootingProfile,
        overallGrade: snapshot.overallGrade,
        blurbs: normalizedBlurbs,
        videoExamples: normalizedVideoExamples,
        twoWay: snapshot.twoWay,
        meta: {
          lastUpdated: new Date().toISOString(),
          updatedBy: 'user',
          version: '1.0',
        },
      };

      // Strip undefined values to prevent Firestore errors.
      const sanitizedEvaluationData = sanitizeWriteData(evaluationData);

      // Get current season info for denormalized updates.
      const now = new Date();
      const currentYear = now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0);
      const seasonId = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

      // Batch operation to update both locations.
      const batch = writeBatch(db);

      // 1. Save to main evaluations subcollection.
      const evaluationDocRef = evalRef(snapshot.playerId, 'current');
      batch.set(evaluationDocRef, sanitizedEvaluationData, { merge: true });

      // 2. Update denormalized evaluationView in current season.
      const seasonDocRef = seasonRef(snapshot.playerId, seasonId);
      const evaluationView = {
        overallGrade: snapshot.overallGrade,
        roles: {
          offense1: snapshot.roles.offense1 || null,
          offense2: snapshot.roles.offense2 || null,
          defense1: snapshot.roles.defense1 || null,
          defense2: snapshot.roles.defense2 || null,
        },
        shootingProfile: snapshot.shootingProfile,
        twoWay: snapshot.twoWay,
        badges: snapshot.badges,
      };
      const sanitizedEvaluationView = sanitizeWriteData(evaluationView);
      batch.set(
        seasonDocRef,
        {
          evaluationView: sanitizedEvaluationView,
        },
        { merge: true }
      );

      // 3. Update denormalized currentEvaluationView in main document.
      const playerDocRef = playerRef(snapshot.playerId);
      const currentEvaluationView = {
        overallGrade: snapshot.overallGrade,
        roles: {
          offense1: snapshot.roles.offense1 || null,
          offense2: snapshot.roles.offense2 || null,
          defense1: snapshot.roles.defense1 || null,
          defense2: snapshot.roles.defense2 || null,
        },
        subRoles: snapshot.subRoles || undefined,
        shootingProfile: snapshot.shootingProfile,
        twoWay: snapshot.twoWay,
        badges: snapshot.badges || [],
        traits: snapshot.traits || {},
        blurbs: normalizedBlurbs,
        videoExamples: normalizedVideoExamples,
      };
      const sanitizedCurrentEvaluationView = sanitizeWriteData(
        currentEvaluationView
      );
      batch.set(
        playerDocRef,
        {
          currentEvaluationView: sanitizedCurrentEvaluationView,
        },
        { merge: true }
      );

      await batch.commit();

      console.log(`✅ Player evaluation data saved for ${snapshot.playerId}`);
      didSucceed = true;
    } catch (error) {
      console.error('❌ Error saving player evaluation data:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setSaveError(errorMessage);
      setSaveState('error');
      // Do NOT clear hasChanges on error - user should retry.
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      // Resolve any saveNow() callers waiting for this save to finish.
      const resolvers = saveCompleteResolversRef.current;
      saveCompleteResolversRef.current = [];
      resolvers.forEach((resolve) => resolve());
    }

    const hasQueuedChanges =
      pendingSaveRef.current || changeTokenRef.current !== saveToken;

    if (didSucceed && !hasQueuedChanges) {
      setHasChanges(false);
      setSaveState('saved');

      // Reset to idle after brief "Saved" display.
      setTimeout(() => {
        setSaveState((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    }

    if (didSucceed && hasQueuedChanges) {
      setSaveState('saving');
      scheduleSave(AUTOSAVE_DEBOUNCE_MS);
    }
  }, [scheduleSave, setHasChanges]);

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  useEffect(() => {
    if (!playerId || !player || !hasChanges) return;

    setSaveState('saving');
    scheduleSave();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    playerId,
    player,
    traits,
    roles,
    twoWay,
    subRoles,
    badges,
    shootingProfile,
    overallGrade,
    blurbs,
    videoExamples,
    hasChanges,
    scheduleSave,
  ]);

  // saveNow: Immediate save, bypassing debounce. Resolves when complete.
  const saveNow = useCallback(async (
    snapshotOverride: SaveNowOverride | null = null
  ): Promise<void> => {
    // Clear any pending debounce.
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    // Wait for in-flight save to complete using promise queue (no polling).
    if (isSavingRef.current) {
      await new Promise<void>((resolve) => {
        saveCompleteResolversRef.current.push(resolve);
      });
    }

    // Run the save immediately.
    await performSave(snapshotOverride);
  }, [performSave]);

  return { isSaving, saveError, saveState, saveNow };
};

