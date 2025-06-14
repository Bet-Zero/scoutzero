// src/features/profile/TeamPlayerDropdowns.jsx

import React, { useEffect } from 'react';
import { getPlayersForTeam } from '@/utils/profileHelpers';
import DropdownGroup from '@/components/shared/DropdownGroup';
import { styles } from '@/constants/styles';

const TeamPlayerDropdowns = ({
  teams,
  playersData,
  selectedTeam,
  setSelectedTeam,
  selectedPlayer,
  setSelectedPlayer,
  filteredKeys,
  setFilteredKeys,
}) => {
  useEffect(() => {
    if (!selectedTeam) {
      setFilteredKeys([]);
      setSelectedPlayer('');
      return;
    }
    const filtered = getPlayersForTeam(playersData, selectedTeam);
    setFilteredKeys(filtered);
    setSelectedPlayer(filtered[0] || '');
  }, [selectedTeam, playersData, setFilteredKeys, setSelectedPlayer]);

  return (
    <div className="absolute top-6 left-6 flex flex-col gap-3">
      <DropdownGroup label="Select Team">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className={styles.select}
        >
          <option value="">Select Team</option>
          {teams.map((team, index) => (
            <option key={`team-${index}-${team}`} value={team}>
              {team}
            </option>
          ))}
        </select>
      </DropdownGroup>

      <DropdownGroup label="Select Player">
        <select
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          className={styles.select}
          disabled={!selectedTeam}
        >
          <option value="">Select Player</option>
          {filteredKeys.map((key, index) => (
            <option key={`player-${index}-${key}`} value={key}>
              {playersData[key]?.display_name || playersData[key]?.name || key}
            </option>
          ))}
        </select>
      </DropdownGroup>
    </div>
  );
};

export default TeamPlayerDropdowns;
