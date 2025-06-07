import React, { useEffect } from 'react';

const TeamPlayerSelector = ({
  teams,
  playersData,
  selectedTeam,
  setSelectedTeam,
  selectedPlayer,
  setSelectedPlayer,
}) => {
  // Auto-select first player when team changes
  useEffect(() => {
    if (selectedTeam) {
      const teamPlayers = Object.entries(playersData).filter(
        ([, p]) => p.Team === selectedTeam
      );

      if (teamPlayers.length > 0) {
        setSelectedPlayer(teamPlayers[0][0]); // Set to first player's ID
      }
    }
  }, [selectedTeam, playersData, setSelectedPlayer]);

  return (
    <div className="flex gap-4 mb-4">
      <select
        value={selectedTeam}
        onChange={(e) => {
          setSelectedTeam(e.target.value);
        }}
        className="bg-neutral-800 text-white px-4 py-2 rounded"
      >
        <option value="">Select Team</option>
        {teams.map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </select>

      <select
        value={selectedPlayer}
        onChange={(e) => setSelectedPlayer(e.target.value)}
        className="bg-neutral-800 text-white px-4 py-2 rounded"
        disabled={!selectedTeam}
      >
        {Object.entries(playersData)
          .filter(([, p]) => p.Team === selectedTeam)
          .map(([id, p]) => (
            <option key={id} value={id}>
              {p.Name}
            </option>
          ))}
      </select>
    </div>
  );
};

export default TeamPlayerSelector;
