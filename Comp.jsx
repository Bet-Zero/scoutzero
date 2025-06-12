// src/components/roster/AddPlayerDrawer.jsx
import React, { useState, useMemo, useEffect } from 'react';
import PlayerRowMini from '@/components/roster/PlayerRowMini';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { BadgeList } from '@/constants/badgeList';
import { expandPositionGroup } from '@/utils/roles';
import { getDefaultAddPlayerFilters } from '@/utils/filtering';

const POSITION_OPTIONS = [
  { value: "", label: "All Positions" },
  { value: "group_guard", label: "Guards" },
  { value: "group_wing", label: "Wings" },
  { value: "group_forward", label: "Forwards" },
  { value: "group_big", label: "Bigs" },
  { value: "PG", label: "PG" },
  { value: "SG", label: "SG" },
  { value: "SF", label: "SF" },
  { value: "PF", label: "PF" },
  { value: "C", label: "C" },
  { value: "G", label: "G" },
  { value: "F", label: "F" },
  { value: "G/F", label: "G/F" },
  { value: "F/C", label: "F/C" }
];


const AddPlayerDrawer = ({ isOpen, onClose, allPlayers, onSelect }) => {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(getDefaultAddPlayerFilters());
  const [showSubroles, setShowSubroles] = useState(false);
  const [showBadges, setShowBadges] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setFilters(getDefaultAddPlayerFilters());
      setShowFilters(false);
      setShowSubroles(false);
      setShowBadges(false);
    }
  }, [isOpen]);

  const filteredPlayers = useMemo(() => {
    const selectedPositions = expandPositionGroup(filters.position);

    return allPlayers.filter((p) => {
      // Search filter
      if (search && !(p.display_name || p.name || '').toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // Team filter
      if (filters.team && (p.bio?.Team || "").toLowerCase() !== filters.team.toLowerCase()) {
        return false;
      }

      // Position filter
      if (filters.position && !selectedPositions.includes(p.bio?.Position || "")) {
        return false;
      }

      // Offense role filter
      if (filters.offenseRole && ![p.roles?.offense1, p.roles?.offense2]
        .filter(Boolean)
        .some(role => role.toLowerCase().includes(filters.offenseRole.toLowerCase()))) {
        return false;
      }

      // Defense role filter
      if (filters.defenseRole && ![p.roles?.defense1, p.roles?.defense2]
        .filter(Boolean)
        .some(role => role.toLowerCase().includes(filters.defenseRole.toLowerCase()))) {
        return false;
      }

      // Subroles filter
      if ((filters.subRoles?.offense?.length || filters.subRoles?.defense?.length)) {
        if (filters.subRoles.offense?.length &&
          !filters.subRoles.offense.every(sub => (p.subRoles?.offense || []).includes(sub))) {
          return false;
        }
        if (filters.subRoles.defense?.length &&
          !filters.subRoles.defense.every(sub => (p.subRoles?.defense || []).includes(sub))) {
          return false;
        }
      }

      // Shooting profile filter
      if (filters.shootingProfile && p.shootingProfile !== filters.shootingProfile) {
        return false;
      }

      // Badges filter
      if (filters.badges?.length && !filters.badges.every(b => (p.badges || []).includes(b))) {
        return false;
      }

      // Contract filters
      if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
        const salary = p.contract?.annual_salaries?.find(s => s.year === 2025)?.salary;
        const salaryValue = typeof salary === 'string' 
          ? parseFloat(salary.replace(/[^0-9.]/g, '')) / 1000000
          : salary / 1000000;
        
        if (filters.minSalary !== undefined && (!salaryValue || salaryValue < filters.minSalary)) {
          return false;
        }
        if (filters.maxSalary !== undefined && (!salaryValue || salaryValue > filters.maxSalary)) {
          return false;
        }
      }

      // Free agent year
      if (filters.freeAgentYear && p.free_agency_year !== filters.freeAgentYear) {
        return false;
      }

      // Free agent type
      if (filters.freeAgentType && p.free_agent_type !== filters.freeAgentType) {
        return false;
      }

      return true;
    });
  }, [search, allPlayers, filters]);

  const toggleSubrole = (role) => {
    const roleData = SubRoleMasterList.find(r => r.name === role);
    if (!roleData) return;

    const type = roleData.type;
    setFilters(prev => ({
      ...prev,
      subRoles: {
        ...prev.subRoles,
        [type]: prev.subRoles?.[type]?.includes(role)
          ? prev.subRoles[type].filter(r => r !== role)
          : [...(prev.subRoles?.[type] || []), role]
      }
    }));
  };

  const toggleBadge = (badgeKey) => {
    setFilters(prev => ({
      ...prev,
      badges: prev.badges.includes(badgeKey)
        ? prev.badges.filter(b => b !== badgeKey)
        : [...prev.badges, badgeKey]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="w-[300px] h-screen bg-[#1a1a1a] border-r border-white/10 fixed left-0 top-0 z-40 flex flex-col">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <h2 className="text-white font-bold text-lg">Select Player</h2>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-red-500"
        >
          <X size={20} />
        </button>
      </div>

      {/* Always-visible filters */}
      <div className="px-3 py-2 border-b border-white/10 space-y-2">
        {/* Search */}
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#111] text-white px-2 py-1 rounded text-sm placeholder-white/30 border border-white/10 focus:outline-none"
        />

        {/* Team and Position - side by side */}
        <div className="flex gap-2">
          {/* Team */}
          <div className="flex-1">
            <select
              value={filters.team}
              onChange={(e) => setFilters({...filters, team: e.target.value})}
              className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
            >
              <option value="">All Teams</option>
              {["Hawks", "Celtics", "Nets", "Hornets", "Bulls", "Cavaliers", "Mavericks",
                "Nuggets", "Pistons", "Warriors", "Rockets", "Pacers", "Clippers", "Lakers",
                "Grizzlies", "Heat", "Bucks", "Timberwolves", "Pelicans", "Knicks", "Thunder",
                "Magic", "76ers", "Suns", "Blazers", "Kings", "Spurs", "Raptors", "Jazz", "Wizards"
              ].sort().map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          {/* Position */}
          <div className="flex-1">
            <select
              value={filters.position}
              onChange={(e) => setFilters({...filters, position: e.target.value})}
              className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
            >
              {POSITION_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter Toggle Button */}
      <div className="px-3 py-2 border-b border-white/10">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs ${
            showFilters ? 'bg-[#222] text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          <span>Advanced Filters</span>
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Offense Role */}
          <div>
            <label className="block mb-1 text-white/70 text-xs">Offense Role</label>
            <select
              value={filters.offenseRole}
              onChange={(e) => setFilters({...filters, offenseRole: e.target.value})}
              className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
            >
              <option value="">All Roles</option>
              <option value="Primary Playmaker">Primary Playmaker</option>
              <option value="Primary Ball Handler">Primary Ball Handler</option>
              <option value="Secondary Creator">Secondary Creator</option>
              <option value="Scorer">Scorer</option>
              <option value="Shooter">Shooter</option>
              <option value="Floor Spacer">Floor Spacer</option>
              <option value="Off-Ball Scorer">Off-Ball Scorer</option>
              <option value="Off-Ball Mover">Off-Ball Mover</option>
              <option value="Connector">Connector</option>
              <option value="Versatile Big">Versatile Big</option>
              <option value="Post Hub">Post Hub</option>
              <option value="Post Scorer">Post Scorer</option>
              <option value="Stretch Big">Stretch Big</option>
              <option value="Play Finisher">Play Finisher</option>
            </select>
          </div>

          {/* Defense Role */}
          <div>
            <label className="block mb-1 text-white/70 text-xs">Defense Role</label>
            <select
              value={filters.defenseRole}
              onChange={(e) => setFilters({...filters, defenseRole: e.target.value})}
              className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
            >
              <option value="">All Roles</option>
              <option value="Point-of-Attack">Point-of-Attack</option>
              <option value="Chaser">Chaser</option>
              <option value="Wing Stopper">Wing Stopper</option>
              <option value="Off-Ball Helper">Off-Ball Helper</option>
              <option value="Defensive Playmaker">Defensive Playmaker</option>
              <option value="Defensive Quarterback">Defensive Quarterback</option>
              <option value="Switchable Wing">Switchable Wing</option>
              <option value="Switchable Big">Switchable Big</option>
              <option value="Mobile Big">Mobile Big</option>
              <option value="Post Defender">Post Defender</option>
              <option value="Anchor Big">Anchor Big</option>
            </select>
          </div>

          {/* Shooting Profile */}
          <div>
            <label className="block mb-1 text-white/70 text-xs">Shooting Profile</label>
            <select
              value={filters.shootingProfile}
              onChange={(e) => setFilters({...filters, shootingProfile: e.target.value})}
              className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
            >
              <option value="">All Profiles</option>
              <option value="Elite">Elite</option>
              <option value="Plus">Plus</option>
              <option value="Capable">Capable</option>
              <option value="Willing">Willing</option>
              <option value="Hesitant">Hesitant</option>
              <option value="Non">Non-Shooter</option>
            </select>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-1"></div>

          {/* Subroles */}
          <div>
            <button
              onClick={() => setShowSubroles(!showSubroles)}
              className="flex items-center justify-between w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] px-2 py-1 rounded text-xs"
            >
              <span>Subroles</span>
              {showSubroles ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showSubroles && (
              <div className="mt-1 grid grid-cols-1 gap-1">
                {SubRoleMasterList.map(role => (
                  <div
                    key={role.name}
                    onClick={() => toggleSubrole(role.name)}
                    className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${
                      filters.subRoles[role.type]?.includes(role.name)
                        ? role.isPositive 
                            ? "bg-green-900/50 text-green-100"
                            : "bg-red-900/50 text-red-100"
                        : role.isPositive
                            ? "bg-[#2a2a2a] text-green-100 hover:bg-green-900/30"
                            : "bg-[#2a2a2a] text-red-100 hover:bg-red-900/30"
                    }`}
                  >
                    <span>{role.name}</span>
                    <span>{role.isPositive ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-1"></div>

          {/* Badges */}
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
                {BadgeList.map(badge => (
                  <label 
                    key={badge.key}
                    className={`flex items-center gap-1 px-1 py-0.5 rounded text-xs ${
                      filters.badges.includes(badge.key)
                        ? 'bg-yellow-500/80 text-black'
                        : 'bg-[#2a2a2a] text-white/70 hover:bg-[#3a3a3a]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.badges.includes(badge.key)}
                      onChange={() => toggleBadge(badge.key)}
                      className="hidden"
                    />
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Contract Filters */}
          <div className="pt-2">
            <div className="text-xs text-white/70 mb-1">Contract Filters</div>
            <div className="grid grid-cols-2 gap-2">
              {/* Salary Range */}
              <div>
                <label className="block mb-1 text-white/70 text-xs">Salary ($M)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minSalary ?? ''}
                    onChange={(e) => setFilters({...filters, minSalary: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxSalary ?? ''}
                    onChange={(e) => setFilters({...filters, maxSalary: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
                  />
                </div>
              </div>

              {/* Free Agent Year */}
              <div>
                <label className="block mb-1 text-white/70 text-xs">FA Year</label>
                <select
                  value={filters.freeAgentYear}
                  onChange={(e) => setFilters({...filters, freeAgentYear: e.target.value})}
                  className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
                >
                  <option value="">Any</option>
                  {[2025, 2026, 2027, 2028].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Free Agent Type */}
              <div>
                <label className="block mb-1 text-white/70 text-xs">FA Type</label>
                <select
                  value={filters.freeAgentType}
                  onChange={(e) => setFilters({...filters, freeAgentType: e.target.value})}
                  className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs border border-white/10"
                >
                  <option value="">Any</option>
                  <option value="UFA">UFA</option>
                  <option value="RFA">RFA</option>
                  <option value="TO">Team Option</option>
                  <option value="PO">Player Option</option>
                  <option value="2W">Two-Way</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="pt-2">
            <button
              onClick={() => setFilters(getDefaultAddPlayerFilters())}
              className="w-full py-1 bg-[#222] text-white/70 hover:text-white rounded text-xs"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Filtered Player List */}
      <div className="flex-1 overflow-y-auto">
        {filteredPlayers.map((player) => (
          <PlayerRowMini
            key={player.id}
            player={player}
            onClick={() => {
              onSelect(player);
              onClose();
            }}
          />
        ))}

        {filteredPlayers.length === 0 && (
          <div className="text-white/40 text-sm text-center py-6">
            No matching players found.
          </div>
        )}
      </div>
    </div>
  );
};

export default AddPlayerDrawer;