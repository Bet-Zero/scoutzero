import React, { useEffect } from 'react';
import { getPlayersForTeam } from '@/utils/profileHelpers';

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
    <div className="absolute top-6 left-6">
      <label className="text-white text-sm block mb-1">Select Team</label>
      <select
        className="bg-neutral-800 text-white px-4 py-1 rounded-lg text-sm border border-black shadow mb-2"
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
      >
        <option value="">Select Team</option>
        {teams.map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </select>

      <label className="text-white text-sm block mb-1 mt-2">
        Select Player
      </label>
      <select
        className="bg-neutral-800 text-white px-4 py-1 rounded-lg text-sm border border-black shadow"
        value={selectedPlayer}
        onChange={(e) => setSelectedPlayer(e.target.value)}
      >
        <option value="">Select Player</option>
        {filteredKeys.map((key) => (
          <option key={key} value={key}>
            {playersData[key]?.display_name || playersData[key]?.name || key}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TeamPlayerDropdowns;
