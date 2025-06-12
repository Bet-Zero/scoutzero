import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BadgeList } from '@/constants/badgeList';
import { shootingProfiles } from '@/utils/roles';

const TEAMS = [
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
];

const BasicFilters = ({ filters, setFilters }) => {
  const [showBadges, setShowBadges] = useState(false);

  const toggleBadge = (badgeKey) => {
    setFilters((prev) => ({
      ...prev,
      badges: prev.badges.includes(badgeKey)
        ? prev.badges.filter((b) => b !== badgeKey)
        : [...prev.badges, badgeKey],
    }));
  };

  return (
    <div className="p-2 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block mb-1 text-white/70 text-xs">Team</label>
          <select
            value={filters.team}
            onChange={(e) => setFilters({ ...filters, team: e.target.value })}
            className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
          >
            <option value="">All Teams</option>
            {TEAMS.sort().map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 text-white/70 text-xs">Position</label>
          <select
            value={filters.position}
            onChange={(e) =>
              setFilters({ ...filters, position: e.target.value })
            }
            className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
          >
            <option value="">All Positions</option>
            <option value="group_guard">Guards (PG/SG/G)</option>
            <option value="group_wing">Wings (SG/SF/G/F)</option>
            <option value="group_forward">Forwards (SF/PF/F)</option>
            <option value="group_big">Bigs (F/C/C)</option>
            <option value="PG">Point Guard</option>
            <option value="SG">Shooting Guard</option>
            <option value="SF">Small Forward</option>
            <option value="PF">Power Forward</option>
            <option value="C">Center</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block mb-1 text-white/70 text-xs">Shooting</label>
        <select
          value={filters.shootingProfile}
          onChange={(e) =>
            setFilters({ ...filters, shootingProfile: e.target.value })
          }
          className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
        >
          <option value="">All Profiles</option>
          {shootingProfiles.map((profile) => (
            <option key={profile} value={profile}>
              {profile}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-white/10 my-2" />

      <div>
        <button
          onClick={() => setShowBadges(!showBadges)}
          className="flex items-center justify-between w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] px-2 py-1 rounded text-xs"
        >
          <span>Badges</span>
          {showBadges ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showBadges && (
          <div className="mt-1 grid grid-cols-2 gap-1">
            {BadgeList.map((badge) => (
              <label
                key={badge.key}
                className={`flex items-center gap-1 px-1 py-0.5 rounded text-xs cursor-pointer ${
                  filters.badges.includes(badge.key)
                    ? 'bg-yellow-500/80 text-black'
                    : 'bg-[#2a2a2a] text-white/70 hover:bg-[#3a3a3a]'
                }`}
                onClick={() => toggleBadge(badge.key)}
              >
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BasicFilters;
