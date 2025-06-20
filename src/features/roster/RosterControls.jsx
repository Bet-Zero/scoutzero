// src/components/roster/RosterControls.jsx
import React from 'react';
import { teamOptions } from '@/utils/filtering';

const RosterControls = ({
  selectedTeam,
  onTeamChange,
  loadMethod,
  onLoadMethodChange,
  savedRosters = [],
}) => {
  const filteredRosters = savedRosters.filter(
    (r) => r.team?.toLowerCase() === selectedTeam?.toLowerCase()
  );

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Team Selector */}
      <div className="flex gap-2 items-center">
        <label className="text-sm text-white/60">Team:</label>
        <select
          value={selectedTeam}
          onChange={(e) => onTeamChange(e.target.value)}
          className="bg-[#1a1a1a] text-white text-sm px-3 py-1 rounded border border-white/10"
        >
          <option value="">— Select Team —</option>
          {teamOptions.sort().map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
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
