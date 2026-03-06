/**
 * FILE: src/features/profile/hooks/useAutoSavePlayer.js
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

import { useEffect, useState, useRef, useCallback } from 'react';
import { writeBatch } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { evalRef, seasonRef, playerRef } from '@/data/firestorePaths';
import { normalizeBlurbs } from '@/shared/utils/blurbs';
import { normalizeVideoExamples } from '@/shared/utils/videoExamples';

const AUTOSAVE_DEBOUNCE_MS = 750;

/**
 * Recursively strips undefined values from objects and arrays.
 * Firestore does not support undefined field values.
 * @param {*} value - Any value to sanitize
 * @returns {*} - Value with undefined fields removed
 */
const stripUndefinedDeep = (value) => {
  if (value === undefined) return undefined; // Signal removal
  if (value === null) return null; // Preserve null

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }

  if (value instanceof Date || typeof value !== 'object') {
    return value;
  }

  // Plain object: recursively clean
  const cleaned = {};
  for (const [key, val] of Object.entries(value)) {
    const cleanedVal = stripUndefinedDeep(val);
    if (cleanedVal !== undefined) {
      cleaned[key] = cleanedVal;
    }
  }
  return cleaned;
};

/**
 * @typedef {Object} AutoSaveStatus
 * @property {boolean} isSaving - True while save is in progress
 * @property {string|null} saveError - Error message if save failed, null otherwise
 * @property {'idle'|'saving'|'saved'|'error'} saveState - Current save state for UI
 */

const useAutoSavePlayer = ({
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
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const latestSnapshotRef = useRef(null);
  const changeTokenRef = useRef(0);
  const debounceTimeoutRef = useRef(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const performSaveRef = useRef(null);
  const saveCompleteResolversRef = useRef([]);

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

  const scheduleSave = useCallback((delay = AUTOSAVE_DEBOUNCE_MS) => {
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

  const performSave = useCallback(async () => {
    const snapshot = latestSnapshotRef.current;
    if (!snapshot?.playerId || !snapshot?.player) return;
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

      // Strip undefined values to prevent Firestore errors
      const sanitizedEvaluationData = stripUndefinedDeep(evaluationData);

      // Get current season info for denormalized updates
      const now = new Date();
      const currentYear = now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0);
      const seasonId = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

      // Batch operation to update both locations
      const batch = writeBatch(db);

      // 1. Save to main evaluations subcollection
      const evaluationDocRef = evalRef(snapshot.playerId, 'current');
      batch.set(evaluationDocRef, sanitizedEvaluationData, { merge: true });

      // 2. Update denormalized evaluationView in current season
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
      const sanitizedEvaluationView = stripUndefinedDeep(evaluationView);
      batch.set(
        seasonDocRef,
        {
          evaluationView: sanitizedEvaluationView,
        },
        { merge: true }
      );

      // 3. Update denormalized currentEvaluationView in main document
      // Use set with merge to handle missing docs gracefully
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
      const sanitizedCurrentEvaluationView = stripUndefinedDeep(
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
      const errorMessage = error?.message || 'Unknown error';
      setSaveError(errorMessage);
      setSaveState('error');
      // Do NOT clear hasChanges on error - user should retry
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      // Resolve any saveNow() callers waiting for this save to finish
      const resolvers = saveCompleteResolversRef.current;
      saveCompleteResolversRef.current = [];
      resolvers.forEach((resolve) => resolve());
    }

    const hasQueuedChanges =
      pendingSaveRef.current || changeTokenRef.current !== saveToken;

    if (didSucceed && !hasQueuedChanges) {
      setHasChanges(false);
      setSaveState('saved');

      // Reset to idle after brief "Saved" display
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

  // saveNow: Immediate save, bypassing debounce. Returns promise that resolves when complete.
  const saveNow = useCallback(async () => {
    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    // Wait for in-flight save to complete using promise queue (no polling)
    if (isSavingRef.current) {
      await new Promise((resolve) => {
        saveCompleteResolversRef.current.push(resolve);
      });
    }

    // Run the save immediately
    await performSave();
  }, [performSave]);

  return { isSaving, saveError, saveState, saveNow };
};

export default useAutoSavePlayer;
