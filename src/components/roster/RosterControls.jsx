import React from 'react';

const TEAMS = [
  'Lakers',
  'Warriors',
  'Celtics',
  'Nuggets',
  'Heat',
  'Bucks',
  'Knicks',
  'Suns',
  '76ers',
  'Clippers',
  'Kings',
  'Mavericks',
  'Grizzlies',
  'Pelicans',
  'Timberwolves',
  'Thunder',
  'Cavaliers',
  'Raptors',
  'Spurs',
  'Bulls',
  'Magic',
  'Hawks',
  'Wizards',
  'Hornets',
  'Jazz',
  'Blazers',
  'Pistons',
  'Pacers',
  'Rockets',
  'Nets',
];

const RosterControls = ({
  selectedTeam,
  onTeamChange,
  loadMethod,
  onLoadMethodChange,
}) => (
  <div className="flex flex-wrap items-center gap-4 mb-6">
    <div className="flex gap-2 items-center">
      <label className="text-sm text-white/60">Team:</label>
      <select
        value={selectedTeam}
        onChange={(e) => onTeamChange(e.target.value)}
        className="bg-[#1a1a1a] text-white text-sm px-3 py-1 rounded border border-white/10"
      >
        <option value="">— Select Team —</option>
        {TEAMS.sort().map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </select>
    </div>

    <div className="flex gap-2 items-center">
      <label className="text-sm text-white/60">Load Roster From:</label>
      <select
        value={loadMethod}
        onChange={(e) => onLoadMethodChange(e.target.value)}
        className="bg-[#1a1a1a] text-white text-sm px-3 py-1 rounded border border-white/10"
      >
        <option value="current">Current NBA Roster</option>
        <option value="blank">Blank Roster</option>
      </select>
    </div>
  </div>
);

export default RosterControls;
