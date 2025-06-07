import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import PlayerRow from '@/components/table/PlayerRow';
import FilterPanel from '@/components/filters/FilterPanel';
import ActiveFiltersDisplay from '@/components/filters/ActiveFiltersDisplay';
import ViewControls from '@/components/filters/sections/ViewControls';
import { Filter, SortAsc, Search } from 'lucide-react';
import debounce from 'lodash.debounce';
import parseHeight from '../../../utils/parseHeight.js';
import parseWeight from '../../../utils/parseWeight.js';
import convertAnnualSalaries from '../../../utils/convertAnnualSalaries.js';
import expandPositionGroup from '../../../utils/expandPositionGroup.js';
import sortPlayers from '../../../utils/sortPlayers.js';

const positionAbbreviations = {
  'Point Guard': 'PG',
  'Shooting Guard': 'SG',
  Guard: 'G',
  'Small Forward': 'SF',
  'Power Forward': 'PF',
  Forward: 'F',
  Center: 'C',
  'Forward-Center': 'F/C',
  'Guard-Forward': 'G/F',
  'Forward-Guard': 'F',
  'Center-Forward': 'C',
};


const getDefaultFilters = () => ({
  nameSearch: '',
  nameOrder: 'az',
  sortBy: '',
  sortAsc: false,
  team: '',
  position: '',
  minHeight: 0,
  maxHeight: null,
  minWeight: 0,
  maxWeight: null,
  minAge: 0,
  maxAge: null,
  minSalary: undefined,
  maxSalary: undefined,
  salaryYear: 2025,
  freeAgentYear: '',
  freeAgentType: '',
  birdRights: '',
  offenseRole: '',
  defenseRole: '',
  subRoles: { offense: [], defense: [] },
  shootingProfile: '',
  min_PPG: 0,
  max_PPG: 50,
  min_RPG: 0,
  max_RPG: 20,
  min_APG: 0,
  max_APG: 20,
  min_FGP: 0,
  max_FGP: 100,
  min_TPP: 0,
  max_TPP: 100,
  min_FTP: 0,
  max_FTP: 100,
  min_eFGP: 0,
  max_eFGP: 100,
  min_MIN: 0,
  max_MIN: 48,
  min_G: 0,
  max_G: 82,
  min_Defense: 0,
  max_Defense: 100,
  min_Energy: 0,
  max_Energy: 100,
  min_Feel: 0,
  max_Feel: 100,
  min_IQ: 0,
  max_IQ: 100,
  min_Passing: 0,
  max_Passing: 100,
  min_Playmaking: 0,
  max_Playmaking: 100,
  min_Rebounding: 0,
  max_Rebounding: 100,
  min_Shooting: 0,
  max_Shooting: 100,
  badges: [],
});


const PlayerTable = () => {
  const [filters, setFilters] = useState(getDefaultFilters());
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Debounced filter updates
  const debouncedSetFilters = useMemo(
    () => debounce(setFilters, 300),
    [setFilters]
  );

  // Debounced search specifically for name search
  const debouncedSearchUpdate = useMemo(
    () =>
      debounce((searchValue) => {
        setFilters((prev) => ({ ...prev, nameSearch: searchValue }));
      }, 200),
    []
  );

  const processPlayerData = useCallback((playerData) => {
    const rawPosition = playerData.bio?.Position;
    const formattedPosition =
      positionAbbreviations[rawPosition] || rawPosition || '—';

    const salaryMap = convertAnnualSalaries(
      playerData.contract?.annual_salaries || []
    );

    return {
      ...playerData,
      formattedPosition,
      heightInInches: parseHeight(playerData.bio?.HT),
      weight: parseWeight(playerData.bio?.WT || 0),
      age: parseInt(playerData.bio?.AGE || 0),
      headshotUrl: `/assets/headshots/${playerData.player_id}.png`,
      offenseRole: playerData.roles?.offense1 || '—',
      defenseRole: playerData.roles?.defense1 || '—',
      shootingProfile: playerData.shootingProfile || '—',
      subRoles: {
        offense: playerData.subRoles?.offense || [],
        defense: playerData.subRoles?.defense || [],
      },
      traits: playerData.traits || {},
      badges: playerData.badges || [],
      salaryByYear: salaryMap,
      PPG: playerData.system?.stats?.PTS ?? null,
      RPG: playerData.system?.stats?.TRB ?? null,
      APG: playerData.system?.stats?.AST ?? null,
      ...playerData.system?.stats,
    };
  }, []);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'players'));
        const fetchedPlayers = querySnapshot.docs.map((doc) =>
          processPlayerData(doc.data())
        );
        setPlayers(fetchedPlayers);
      } catch (err) {
        console.error('Error fetching players:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [processPlayerData]);

  const filteredPlayers = useMemo(() => {
    const selectedPositions = expandPositionGroup(filters.position);

    const filtered = players.filter((p) => {
        // Name search filter
        if (filters.nameSearch) {
          const playerName = (p.display_name || p.name || '').toLowerCase();
          const searchTerm = filters.nameSearch.toLowerCase();
          if (!playerName.includes(searchTerm)) {
            return false;
          }
        }

        // Early exit for basic filters
        if (
          filters.team &&
          (p.bio?.Team || '').toLowerCase() !== filters.team.toLowerCase()
        ) {
          return false;
        }

        if (
          filters.position &&
          !selectedPositions.includes(p.formattedPosition)
        ) {
          return false;
        }

        // Height filter
        if (
          p.heightInInches < filters.minHeight ||
          (filters.maxHeight !== null && p.heightInInches > filters.maxHeight)
        ) {
          return false;
        }

        // Weight filter
        if (
          p.weight < filters.minWeight ||
          (filters.maxWeight !== null && p.weight > filters.maxWeight)
        ) {
          return false;
        }

        // Age filter
        if (
          p.age < filters.minAge ||
          (filters.maxAge !== null && p.age > filters.maxAge)
        ) {
          return false;
        }

        // Salary filter
        if (
          filters.minSalary !== undefined ||
          filters.maxSalary !== undefined
        ) {
          const salary = p.salaryByYear?.[filters.salaryYear] ?? null;
          if (typeof salary !== 'number') return false;
          if (filters.minSalary !== undefined && salary < filters.minSalary)
            return false;
          if (filters.maxSalary !== undefined && salary > filters.maxSalary)
            return false;
        }

        // Free agent filters
        if (
          filters.freeAgentYear &&
          parseInt(p.free_agency_year || 0) !== parseInt(filters.freeAgentYear)
        ) {
          return false;
        }

        if (
          filters.freeAgentType &&
          p.free_agent_type !== filters.freeAgentType
        ) {
          return false;
        }

        // Role filters
        if (
          filters.offenseRole &&
          ![p.roles?.offense1, p.roles?.offense2]
            .filter(Boolean)
            .some((role) =>
              role.toLowerCase().includes(filters.offenseRole.toLowerCase())
            )
        ) {
          return false;
        }

        if (
          filters.defenseRole &&
          ![p.roles?.defense1, p.roles?.defense2]
            .filter(Boolean)
            .some((role) =>
              role.toLowerCase().includes(filters.defenseRole.toLowerCase())
            )
        ) {
          return false;
        }

        // Shooting profile
        if (
          filters.shootingProfile &&
          p.shootingProfile !== filters.shootingProfile
        ) {
          return false;
        }

        // Subroles filter
        if (
          filters.subRoles?.offense?.length ||
          filters.subRoles?.defense?.length
        ) {
          if (
            filters.subRoles.offense?.length &&
            !filters.subRoles.offense.every((sub) =>
              p.subRoles.offense.includes(sub)
            )
          ) {
            return false;
          }

          if (
            filters.subRoles.defense?.length &&
            !filters.subRoles.defense.every((sub) =>
              p.subRoles.defense.includes(sub)
            )
          ) {
            return false;
          }
        }

        // Stats filters
        const passesStat = (key, min, max) => {
          const val = parseFloat(p[key] ?? 0) * (key.includes('%') ? 100 : 1);
          return val >= filters[`min_${min}`] && val <= filters[`max_${max}`];
        };

        if (
          !passesStat('PTS', 'PPG', 'PPG') ||
          !passesStat('TRB', 'RPG', 'RPG') ||
          !passesStat('AST', 'APG', 'APG') ||
          !passesStat('FG%', 'FGP', 'FGP') ||
          !passesStat('3P%', 'TPP', 'TPP') ||
          !passesStat('FT%', 'FTP', 'FTP') ||
          !passesStat('eFG%', 'eFGP', 'eFGP') ||
          !passesStat('MP', 'MIN', 'MIN') ||
          !passesStat('G', 'G', 'G')
        ) {
          return false;
        }

        // Traits filters
        const passesTrait = (trait) => {
          const val = parseFloat(p.traits?.[trait] ?? 0);
          return (
            val >= filters[`min_${trait}`] && val <= filters[`max_${trait}`]
          );
        };

        if (
          !passesTrait('Defense') ||
          !passesTrait('Energy') ||
          !passesTrait('Feel') ||
          !passesTrait('IQ') ||
          !passesTrait('Passing') ||
          !passesTrait('Playmaking') ||
          !passesTrait('Rebounding') ||
          !passesTrait('Shooting')
        ) {
          return false;
        }

        // Badges filter
        if (
          filters.badges?.length &&
          !filters.badges.every((b) => p.badges.includes(b))
        ) {
          return false;
        }

        return true;
      });
    return sortPlayers(filtered, filters);
  }, [players, filters]);

  const handleSearchChange = (e) => {
    debouncedSearchUpdate(e.target.value);
  };

  if (loading)
    return (
      <div className="text-white text-center mt-8">Loading players...</div>
    );

  return (
    <div className="flex flex-col items-center bg-black gap-1 mt-4 min-h-screen">
      <div className="w-full max-w-[1100px] mx-auto">
        {/* Header Section */}
        <div className="mb-2 border-b border-gray-800 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Player Database
              </h1>
              <p className="text-gray-400 text-sm">
                {filteredPlayers.length} players • NBA 2024-25 Season
              </p>
            </div>

            {/* Search and Controls */}
            <div className="flex items-center gap-4">
              {/* Search Bar */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search players..."
                  onChange={handleSearchChange}
                  className="pl-10 pr-4 py-2 text-sm bg-black border border-gray-700 rounded-md text-white placeholder-gray-00 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 transition-all duration-200"
                />
              </div>

              <div className="h-6 w-px bg-gray-700"></div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${
                    showFilters
                      ? 'bg-gray-700 text-white border border-gray-600'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  <Filter size={14} />
                  Filters
                </button>

                <button
                  onClick={() => setShowSort(!showSort)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${
                    showSort
                      ? 'bg-gray-700 text-white border border-gray-600'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  <SortAsc size={14} />
                  Sort
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        <ActiveFiltersDisplay
          filters={filters}
          setFilters={debouncedSetFilters}
          getDefaultFilters={getDefaultFilters}
          excludeFromDisplay={['nameSearch']}
        />

        {/* Filter Panel - Fixed positioning and z-index */}
        {showFilters && (
          <div className="mb-4">
            <FilterPanel
              filters={filters}
              setFilters={debouncedSetFilters}
              getDefaultFilters={getDefaultFilters}
              onClose={() => setShowFilters(false)}
            />
          </div>
        )}

        {/* View Controls - Sort Menu */}
        {showSort && (
          <div className="mb-4">
            <ViewControls filters={filters} setFilters={debouncedSetFilters} />
          </div>
        )}
      </div>

      {/* Player List */}
      <div className="w-full max-w-[1100px] mx-auto relative z-10">
        {filteredPlayers.map((player) => (
          <PlayerRow
            key={`${player.player_id}_${player.bio?.Team || 'unknown'}`}
            player={{ id: player.player_id, ...player }}
          />
        ))}
      </div>
    </div>
  );
};

export default PlayerTable;
