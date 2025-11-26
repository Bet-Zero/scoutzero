import { useEffect } from 'react';
import { setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { evalRef, seasonRef, playerRef } from '@/data/firestorePaths';

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
  useEffect(() => {
    if (!playerId || !player || !hasChanges) return;

    const saveData = async () => {
      try {
        const evaluationData = {
          traits,
          roles,
          subRoles,
          badges,
          shootingProfile,
          overallGrade,
          blurbs,
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
          twoWay, // Update the denormalized copy too!
          badges,
        };
        batch.update(seasonDocRef, {
          evaluationView,
        });

        // 3. Update denormalized currentEvaluationView in main document
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
          badges: badges || [],
          traits: traits || {},
        };
        batch.update(playerDocRef, {
          currentEvaluationView,
        });

        await batch.commit();

        console.log(`✅ Player evaluation data saved for ${playerId}`);
        setHasChanges(false);
      } catch (error) {
        console.error('❌ Error saving player evaluation data:', error);
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
};

export default useAutoSavePlayer;
