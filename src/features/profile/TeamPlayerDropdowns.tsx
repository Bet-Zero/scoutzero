// src/features/profile/TeamPlayerDropdowns.tsx

import React, { useEffect } from 'react';
import { getPlayersForTeam } from '@/features/profile/utils/profileHelpers';
import { styles } from '@/constants/styles';
import type { PlayersDataMap } from './utils/profileHelpers';
import type { ProfileSetter } from './profileUiTypes';

type TeamPlayerDropdownsProps = {
  teams: string[];
  playersData: PlayersDataMap;
  selectedTeam: string;
  setSelectedTeam: ProfileSetter<string>;
  selectedPlayer: string;
  setSelectedPlayer: ProfileSetter<string>;
  filteredKeys: string[];
  setFilteredKeys: ProfileSetter<string[]>;
};

export const TeamPlayerDropdowns = ({
  teams,
  playersData,
  selectedTeam,
  setSelectedTeam,
  selectedPlayer,
  setSelectedPlayer,
  filteredKeys,
  setFilteredKeys,
}: TeamPlayerDropdownsProps) => {
  useEffect(() => {
    const filtered = getPlayersForTeam(playersData, selectedTeam);
    setFilteredKeys(filtered);
    if (selectedTeam && !filtered.includes(selectedPlayer)) {
      setSelectedPlayer(filtered[0] || '');
    }
  }, [
    selectedTeam,
    playersData,
    selectedPlayer,
    setFilteredKeys,
    setSelectedPlayer,
  ]);

  const handlePlayerChange = (id: string) => {
    setSelectedPlayer(id);
    if (id && !selectedTeam) {
      const team = playersData[id]?.bio?.display?.team || '';
      if (team) setSelectedTeam(team);
    }
  };

  return (
    <div className="flex flex-col gap-1 mt-[2px]">
      <select
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
        className={styles.select}
      >
        <option value="">All Teams</option>
        {teams.map((team: string, index: number) => (
          <option key={`team-${index}-${team}`} value={team}>
            {team}
          </option>
        ))}
      </select>

      <select
        value={selectedPlayer}
        onChange={(e) => handlePlayerChange(e.target.value)}
        className={styles.select}
      >
        <option value="">Select Player</option>
        {filteredKeys.map((key: string, index: number) => (
          <option key={`player-${index}-${key}`} value={key}>
            {playersData[key]?.bio?.displayName || playersData[key]?.name || key}
          </option>
        ))}
      </select>
    </div>
  );
};

