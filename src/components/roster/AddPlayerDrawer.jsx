// src/components/roster/AddPlayerDrawer.jsx
import React, { useState, useMemo, useCallback } from 'react';
import PlayerRowMini from '@/components/roster/PlayerRowMini';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { BadgeList } from '@/constants/badgeList';

const getDefaultFilters = () => ({
  team: '',
  position: '',
  offenseRole: '',
  defenseRole: '',
  subRoles: { offense: [], defense: [] },
  shootingProfile: '',
  badges: [],
  minSalary: undefined,
  maxSalary: undefined,
  freeAgentYear: '',
  freeAgentType: '',
});

const getPositionOptions = (position) => {
  switch (position) {
    case 'group_guard':
      return ['PG', 'SG', 'G'];
    case 'group_wing':
      return ['SG', 'SF', 'G/F'];
    case 'group_forward':
      return ['SF', 'PF', 'F'];
    case 'group_big':
      return ['F/C', 'C'];
    default:
      return position ? [position] : [];
  }
};

const AddPlayerDrawer = ({ onClose, allPlayers, onSelect }) => {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilters());
  const [activeFilterTab, setActiveFilterTab] = useState('basic');
  const [showBadges, setShowBadges] = useState(false);
  const [showSubroles, setShowSubroles] = useState(false);

  const toggleBadge = useCallback((badgeKey) => {
    setFilters((prev) => ({
      ...prev,
      badges: prev.badges.includes(badgeKey)
        ? prev.badges.filter((b) => b !== badgeKey)
        : [...prev.badges, badgeKey],
    }));
  }, []);

  const toggleSubrole = useCallback((roleName) => {
    const roleData = SubRoleMasterList.find((r) => r.name === roleName);
    if (!roleData) return;

    const type = roleData.type;
    setFilters((prev) => ({
      ...prev,
      subRoles: {
        ...prev.subRoles,
        [type]: prev.subRoles[type]?.includes(roleName)
          ? prev.subRoles[type].filter((r) => r !== roleName)
          : [...(prev.subRoles[type] || []), roleName],
      },
    }));
  }, []);

  const filteredPlayers = useMemo(() => {
    const searchTerm = search.toLowerCase();
    const {
      team,
      position,
      offenseRole,
      defenseRole,
      subRoles,
      shootingProfile,
      badges,
      minSalary,
      maxSalary,
      freeAgentYear,
      freeAgentType,
    } = filters;

    const positionOptions = position ? getPositionOptions(position) : null;

    return allPlayers
      .filter((p) => {
        if (searchTerm && !p.name.includes(searchTerm)) return false;
        if (team && p.team !== team.toLowerCase()) return false;
        if (positionOptions && !positionOptions.includes(p.position))
          return false;
        if (
          offenseRole &&
          !p.offenseRoles.some((r) => r.includes(offenseRole.toLowerCase()))
        )
          return false;
        if (
          defenseRole &&
          !p.defenseRoles.some((r) => r.includes(defenseRole.toLowerCase()))
        )
          return false;
        if (
          subRoles.offense.length > 0 &&
          !subRoles.offense.every((sr) => p.offenseSubroles.includes(sr))
        )
          return false;
        if (
          subRoles.defense.length > 0 &&
          !subRoles.defense.every((sr) => p.defenseSubroles.includes(sr))
        )
          return false;
        if (
          shootingProfile &&
          p.shootingProfile !== shootingProfile.toLowerCase()
        )
          return false;
        if (badges.length > 0 && !badges.every((b) => p.badges.includes(b)))
          return false;

        if (minSalary !== undefined || maxSalary !== undefined) {
          const salaryValue =
            typeof p.salary === 'string'
              ? parseFloat(p.salary.replace(/[^0-9.]/g, '')) / 1000000
              : p.salary / 1000000;
          if (
            minSalary !== undefined &&
            (!salaryValue || salaryValue < minSalary)
          )
            return false;
          if (
            maxSalary !== undefined &&
            (!salaryValue || salaryValue > maxSalary)
          )
            return false;
        }

        if (freeAgentYear) {
          if (p.freeAgentYear === freeAgentYear) return true;
          if (p.extension?.free_agency_year?.toString() === freeAgentYear)
            return true;
          const hasOptionYear = p.options.some(
            (opt) => opt.year?.toString() === freeAgentYear
          );
          if (hasOptionYear) return true;
          return false;
        }

        if (freeAgentType) {
          if (p.freeAgentType === freeAgentType) return true;
          if (p.extension?.free_agent_type?.toLowerCase() === freeAgentType)
            return true;
          if (freeAgentType === 'to' || freeAgentType === 'po') {
            return p.options.some(
              (opt) => opt.type?.toLowerCase() === freeAgentType
            );
          }
          if (freeAgentType === '2w') {
            return (
              p.contractType?.includes('two-way') ||
              p.original.status?.toLowerCase() === 'two-way'
            );
          }
          return false;
        }

        return true;
      })
      .map((p) => p.original);
  }, [search, filters, allPlayers]);

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
        <h2 className="text-white font-bold text-lg">Select Player</h2>
        <button onClick={onClose} className="text-white/50 hover:text-red-500">
          <X size={20} />
        </button>
      </div>

      <div className="flex-shrink-0 px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-[#111] text-white px-2 py-1 rounded text-sm placeholder-white/30 border border-white/10"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded ${showFilters ? 'bg-[#222] text-white' : 'text-white/50 hover:text-white'}`}
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="border-b border-white/10">
          <div className="flex border-b border-white/10 text-xs">
            <button
              onClick={() => setActiveFilterTab('basic')}
              className={`flex-1 py-2 font-medium ${activeFilterTab === 'basic' ? 'text-white border-b-2 border-blue-500' : 'text-white/50 hover:text-white'}`}
            >
              Basic
            </button>
            <button
              onClick={() => setActiveFilterTab('roles')}
              className={`flex-1 py-2 font-medium ${activeFilterTab === 'roles' ? 'text-white border-b-2 border-green-500' : 'text-white/50 hover:text-white'}`}
            >
              Roles
            </button>
            <button
              onClick={() => setActiveFilterTab('contract')}
              className={`flex-1 py-2 font-medium ${activeFilterTab === 'contract' ? 'text-white border-b-2 border-indigo-500' : 'text-white/50 hover:text-white'}`}
            >
              Contract
            </button>
          </div>

          {activeFilterTab === 'basic' && (
            <div className="p-2 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-white/70 text-xs">
                    Team
                  </label>
                  <select
                    value={filters.team}
                    onChange={(e) =>
                      setFilters({ ...filters, team: e.target.value })
                    }
                    className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
                  >
                    <option value="">All Teams</option>
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

                <div>
                  <label className="block mb-1 text-white/70 text-xs">
                    Position
                  </label>
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
                <label className="block mb-1 text-white/70 text-xs">
                  Shooting
                </label>
                <select
                  value={filters.shootingProfile}
                  onChange={(e) =>
                    setFilters({ ...filters, shootingProfile: e.target.value })
                  }
                  className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
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

              <div className="border-t border-white/10 my-2"></div>

              <div>
                <button
                  onClick={() => setShowBadges(!showBadges)}
                  className="flex items-center justify-between w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] px-2 py-1 rounded text-xs"
                >
                  <span>Badges</span>
                  {showBadges ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
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
          )}

          {activeFilterTab === 'roles' && (
            <div className="p-2 space-y-3">
              <div>
                <label className="block mb-1 text-white/70 text-xs">
                  Offense Role
                </label>
                <select
                  value={filters.offenseRole}
                  onChange={(e) =>
                    setFilters({ ...filters, offenseRole: e.target.value })
                  }
                  className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
                >
                  <option value="">All Roles</option>
                  <option value="Primary Playmaker">Primary Playmaker</option>
                  <option value="Primary Ball Handler">
                    Primary Ball Handler
                  </option>
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

              <div>
                <label className="block mb-1 text-white/70 text-xs">
                  Defense Role
                </label>
                <select
                  value={filters.defenseRole}
                  onChange={(e) =>
                    setFilters({ ...filters, defenseRole: e.target.value })
                  }
                  className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
                >
                  <option value="">All Roles</option>
                  <option value="Point-of-Attack">Point-of-Attack</option>
                  <option value="Chaser">Chaser</option>
                  <option value="Wing Stopper">Wing Stopper</option>
                  <option value="Off-Ball Helper">Off-Ball Helper</option>
                  <option value="Defensive Playmaker">
                    Defensive Playmaker
                  </option>
                  <option value="Defensive Quarterback">
                    Defensive Quarterback
                  </option>
                  <option value="Switchable Wing">Switchable Wing</option>
                  <option value="Switchable Big">Switchable Big</option>
                  <option value="Mobile Big">Mobile Big</option>
                  <option value="Post Defender">Post Defender</option>
                  <option value="Anchor Big">Anchor Big</option>
                </select>
              </div>

              <div className="border-t border-white/10 my-2"></div>

              <div>
                <button
                  onClick={() => setShowSubroles(!showSubroles)}
                  className="flex items-center justify-between w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] px-2 py-1 rounded text-xs"
                >
                  <span>Subroles</span>
                  {showSubroles ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>
                {showSubroles && (
                  <div className="mt-1 grid grid-cols-1 gap-1">
                    {SubRoleMasterList.map((role) => (
                      <div
                        key={role.name}
                        onClick={() => toggleSubrole(role.name)}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${
                          filters.subRoles[role.type]?.includes(role.name)
                            ? role.isPositive
                              ? 'bg-green-900/50 text-green-100'
                              : 'bg-red-900/50 text-red-100'
                            : role.isPositive
                              ? 'bg-[#2a2a2a] text-green-100 hover:bg-green-900/30'
                              : 'bg-[#2a2a2a] text-red-100 hover:bg-red-900/30'
                        }`}
                      >
                        <span>{role.name}</span>
                        <span>{role.isPositive ? '✓' : '✗'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeFilterTab === 'contract' && (
            <div className="p-2 space-y-3">
              <div>
                <label className="block mb-1 text-white/70 text-xs">
                  Salary ($M)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minSalary ?? ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        minSalary: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-[70px] bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
                  />
                  <span className="text-white/40 text-xs">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxSalary ?? ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxSalary: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-[70px] bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-white/70 text-xs">
                  FA Year
                </label>
                <select
                  value={filters.freeAgentYear}
                  onChange={(e) =>
                    setFilters({ ...filters, freeAgentYear: e.target.value })
                  }
                  className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
                >
                  <option value="">Any</option>
                  {[2025, 2026, 2027, 2028, 2029, 2030, 2031].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-white/70 text-xs">
                  FA Type
                </label>
                <select
                  value={filters.freeAgentType}
                  onChange={(e) =>
                    setFilters({ ...filters, freeAgentType: e.target.value })
                  }
                  className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
                >
                  <option value="">Any Type</option>
                  <option value="UFA">UFA</option>
                  <option value="RFA">RFA</option>
                  <option value="TO">Team Option</option>
                  <option value="PO">Player Option</option>
                  <option value="2W">Two-Way</option>
                  <option value="ETO">Early Termination Option</option>
                </select>
              </div>
            </div>
          )}

          <div className="p-2 border-t border-white/10">
            <button
              onClick={() => setFilters(getDefaultFilters())}
              className="w-full py-1 bg-[#222] text-white/70 hover:text-white rounded text-xs"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map((player) => (
            <PlayerRowMini
              key={player.id}
              player={player}
              onClick={() => onSelect(player)}
            />
          ))
        ) : (
          <div className="text-white/40 text-sm text-center py-6">
            {search || Object.values(filters).some(Boolean)
              ? 'No matching players found.'
              : 'No players available.'}
          </div>
        )}
      </div>
    </>
  );
};

export default AddPlayerDrawer;
