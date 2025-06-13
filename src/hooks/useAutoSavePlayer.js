import { useEffect } from 'react';
import { savePlayerData } from '@/firebaseHelpers';

const useAutoSavePlayer = ({
  playerId,
  player,
  traits,
  roles,
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
      await savePlayerData(playerId, {
        ...player,
        traits,
        roles,
        subRoles,
        badges,
        shootingProfile,
        overall_grade: overallGrade,
        blurbs,
      });
      setHasChanges(false);
    };

    saveData();
  }, [
    playerId,
    player,
    traits,
    roles,
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
