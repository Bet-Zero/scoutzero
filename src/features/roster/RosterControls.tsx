// src/features/roster/RosterControls.tsx
import React from 'react';
import { TeamListFull, TeamMap } from '@/constants/teamList';

const RosterControls = ({
  selectedTeam,
  onTeamChange,
  loadMethod,
  onLoadMethodChange,
  savedRosters = [],
  teamSelectionDisabled = false,
}) => {
  const filteredRosters = savedRosters.filter((r) => {
    if (selectedTeam) {
      return r.team === selectedTeam.id || !r.team;
    }
    return true;
  });

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Team Selector */}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2 items-center">
          <label className="text-sm text-white/60">Team:</label>
          <select
            value={selectedTeam?.id || ''}
            onChange={(e) => onTeamChange(TeamMap[e.target.value])}
            disabled={teamSelectionDisabled}
            title={
              teamSelectionDisabled
                ? 'Switch roster mode to Current NBA Roster or Blank Roster to change teams.'
                : 'Select team'
            }
            className="bg-[#1a1a1a] text-white text-sm px-3 py-1 rounded border border-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">— Select Team —</option>
            {TeamListFull.map((team) => (
              <option key={team.id} value={team.id}>
                {team.teamName}
              </option>
            ))}
          </select>
        </div>
        {teamSelectionDisabled && (
          <div className="text-xs text-white/40">
            Saved rosters keep their saved team. Switch roster mode first to
            change teams.
          </div>
        )}
      </div>

      {/* Roster Selector */}
      <div className="flex gap-2 items-center">
        <label className="text-sm text-white/60">Roster:</label>
        <select
          value={loadMethod}
          onChange={(e) => onLoadMethodChange(e.target.value)}
          className="bg-[#1a1a1a] text-white text-sm px-3 py-1 rounded border border-white/10"
        >
          <option value="current">Current NBA Roster</option>
          <option value="blank">Blank Roster</option>
          {filteredRosters.length > 0 && (
            <>
              <option disabled>──────</option>
              {filteredRosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    </div>
  );
};

export default RosterControls;
