/**
 * FILE: src/features/profile/hooks/useAutoSavePlayer.js
 * PURPOSE: Autosave scouting evaluation data to Firestore evaluations/current and denormalized views.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-21: Phase 2 - Added isSaving/saveError state, made writes resilient with set+merge
 *  - 2026-01-21: Updated by plan `plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import { useEffect, useState, useCallback } from 'react';
import { writeBatch } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { evalRef, seasonRef, playerRef } from '@/data/firestorePaths';
import { normalizeBlurbs } from '@/shared/utils/blurbs';

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
  hasChanges,
  setHasChanges,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  // Clear error when user makes new changes
  useEffect(() => {
    if (hasChanges && saveError) {
      setSaveError(null);
      setSaveState('idle');
    }
  }, [hasChanges, saveError]);

  useEffect(() => {
    if (!playerId || !player || !hasChanges) return;

    const saveData = async () => {
      setIsSaving(true);
      setSaveState('saving');
      setSaveError(null);

      try {
        const normalizedBlurbs = normalizeBlurbs(blurbs);
        const evaluationData = {
          traits,
          roles,
          subRoles,
          badges,
          shootingProfile,
          overallGrade,
          blurbs: normalizedBlurbs,
          twoWay,
          meta: {
            lastUpdated: new Date().toISOString(),
            updatedBy: 'user',
            version: '1.0',
          },
        };

        // Get current season info for denormalized updates
        const now = new Date();
        const currentYear = now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0);
        const seasonId = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

        // Batch operation to update both locations
        const batch = writeBatch(db);

        // 1. Save to main evaluations subcollection
        const evaluationDocRef = evalRef(playerId, 'current');
        batch.set(evaluationDocRef, evaluationData, { merge: true });

        // 2. Update denormalized evaluationView in current season
        const seasonDocRef = seasonRef(playerId, seasonId);
        const evaluationView = {
          overallGrade,
          roles: {
            offense1: roles.offense1 || null,
            offense2: roles.offense2 || null,
            defense1: roles.defense1 || null,
            defense2: roles.defense2 || null,
          },
          shootingProfile,
          twoWay,
          badges,
        };
        batch.set(
          seasonDocRef,
          {
            evaluationView,
          },
          { merge: true }
        );

        // 3. Update denormalized currentEvaluationView in main document
        // Use set with merge to handle missing docs gracefully
        const playerDocRef = playerRef(playerId);
        const currentEvaluationView = {
          overallGrade,
          roles: {
            offense1: roles.offense1 || null,
            offense2: roles.offense2 || null,
            defense1: roles.defense1 || null,
            defense2: roles.defense2 || null,
          },
          subRoles: subRoles || undefined,
          shootingProfile,
          twoWay,
          badges: badges || [],
          traits: traits || {},
          blurbs: normalizedBlurbs,
        };
        batch.set(
          playerDocRef,
          {
            currentEvaluationView,
          },
          { merge: true }
        );

        await batch.commit();

        console.log(`✅ Player evaluation data saved for ${playerId}`);
        setHasChanges(false);
        setSaveState('saved');

        // Reset to idle after brief "Saved" display
        setTimeout(() => {
          setSaveState((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 2000);
      } catch (error) {
        console.error('❌ Error saving player evaluation data:', error);
        const errorMessage = error?.message || 'Unknown error';
        setSaveError(errorMessage);
        setSaveState('error');
        // Do NOT clear hasChanges on error - user should retry
      } finally {
        setIsSaving(false);
      }
    };

    saveData();
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
    hasChanges,
    setHasChanges,
  ]);

  return { isSaving, saveError, saveState };
};

export default useAutoSavePlayer;
