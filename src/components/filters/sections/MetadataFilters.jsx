import React from 'react';
import { expandPositionGroup } from '@/utils/roles';

const MetadataFilters = ({ filters, setFilters }) => {
  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-white text-sm">
        {/* Team */}
        <div className="flex flex-col" style={{ maxWidth: '200px' }}>
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Team
          </label>
          <select
            value={filters.team || ''}
            onChange={(e) => update('team', e.target.value)}
            className="bg-[#2a2a2a] p-2 rounded w-[125px]"
          >
            <option value="">All</option>
            {[
              'Hawks',
              'Celtics',
              'Nets',
              'Hornets',
              'Bulls',
              'Cavaliers',
              'Mavericks',
              'Nuggets',
              'Pistons',
              'Warriors',
              'Rockets',
              'Pacers',
              'Clippers',
              'Lakers',
              'Grizzlies',
              'Heat',
              'Bucks',
              'Timberwolves',
              'Pelicans',
              'Knicks',
              'Thunder',
              'Magic',
              '76ers',
              'Suns',
              'Blazers',
              'Kings',
              'Spurs',
              'Raptors',
              'Jazz',
              'Wizards',
            ]
              .sort()
              .map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
          </select>
        </div>

        {/* Position */}
        <div className="flex flex-col" style={{ maxWidth: '200px' }}>
          <label className="mb-1 text-white/50 text-[11px] uppercase tracking-wide">
            Position
          </label>
          <select
            value={filters.position || ''}
            onChange={(e) => update('position', e.target.value)}
            className="bg-[#2a2a2a] p-2 rounded w-[80px]"
          >
            <option value="">All</option>
            <option value="Guard">Guard</option>
            <option value="Wing">Wing</option>
            <option value="Forward">Forward</option>
            <option value="Big">Big</option>
            <option value="Center">Center</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default MetadataFilters;
