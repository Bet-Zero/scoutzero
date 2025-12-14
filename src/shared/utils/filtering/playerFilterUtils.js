import { expandPositionGroup } from '@/shared/utils/roles';

const shootingProfileRank = {
  Elite: 6,
  Plus: 5,
  Capable: 4,
  Willing: 3,
  Hesitant: 2,
  Non: 1,
};

const traitSort = [
  'Defense',
  'Energy',
  'Feel',
  'IQ',
  'Passing',
  'Playmaking',
  'Rebounding',
  'Shooting',
];

export function filterPlayers(players = [], filters) {
  if (!players) return [];
  const selectedPositions = expandPositionGroup(filters.position);

  return players.filter((p) => {
    // Filter free agents if showFreeAgents is false
    if (filters.showFreeAgents === false) {
      const teamId = p.bio?.display?.teamId || '';
      const team = p.bio?.display?.team || '';
      if (teamId === 'FREE' || team === 'Free Agent') {
        return false;
      }
    }

    if (filters.nameSearch) {
      const playerName = (
        p.bio?.displayName ||
        p.bio?.name ||
        ''
      ).toLowerCase();
      const searchTerm = filters.nameSearch.toLowerCase();
      if (!playerName.includes(searchTerm)) return false;
    }

    if (
      filters.team &&
      (p.bio?.display?.team || '').toLowerCase() !== filters.team.toLowerCase()
    ) {
      return false;
    }

    if (filters.position && !selectedPositions.includes(p.formattedPosition)) {
      return false;
    }

    if (
      p.heightInInches < filters.minHeight ||
      (filters.maxHeight !== null && p.heightInInches > filters.maxHeight)
    ) {
      return false;
    }

    if (
      p.weight < filters.minWeight ||
      (filters.maxWeight !== null && p.weight > filters.maxWeight)
    ) {
      return false;
    }

    if (
      p.age < filters.minAge ||
      (filters.maxAge !== null && p.age > filters.maxAge)
    ) {
      return false;
    }

    if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
      const salary = p.salaryByYear?.[filters.salaryYear] ?? null;
      if (typeof salary !== 'number') return false;
      if (filters.minSalary !== undefined && salary < filters.minSalary)
        return false;
      if (filters.maxSalary !== undefined && salary > filters.maxSalary)
        return false;
    }

    if (
      filters.freeAgentYear &&
      parseInt(p.freeAgentYear || 0) !== parseInt(filters.freeAgentYear)
    ) {
      return false;
    }

    if (filters.freeAgentType && p.freeAgentType !== filters.freeAgentType) {
      return false;
    }

    if (
      filters.offenseRole &&
      ![p.offenseRole, p.primaryEvaluation?.roles?.offense2]
        .filter(Boolean)
        .some((role) =>
          role.toLowerCase().includes(filters.offenseRole.toLowerCase())
        )
    ) {
      return false;
    }

    if (
      filters.defenseRole &&
      ![p.defenseRole, p.primaryEvaluation?.roles?.defense2]
        .filter(Boolean)
        .some((role) =>
          role.toLowerCase().includes(filters.defenseRole.toLowerCase())
        )
    ) {
      return false;
    }

    if (
      filters.shootingProfile &&
      p.shootingProfile !== filters.shootingProfile
    ) {
      return false;
    }

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

    const passesStat = (key, min, max) => {
      const val = parseFloat(p[key] ?? 0) * (key.includes('%') ? 100 : 1);
      return val >= filters[`min_${min}`] && val <= filters[`max_${max}`];
    };

    if (
      !passesStat('PTS', 'PPG', 'PPG') ||
      !passesStat('REB', 'RPG', 'RPG') ||
      !passesStat('AST', 'APG', 'APG') ||
      !passesStat('FG%', 'FGP', 'FGP') ||
      !passesStat('3PT%', 'TPP', 'TPP') ||
      !passesStat('FT%', 'FTP', 'FTP') ||
      !passesStat('eFG%', 'eFGP', 'eFGP') ||
      !passesStat('MIN', 'MIN', 'MIN') ||
      !passesStat('GP', 'G', 'G')
    ) {
      return false;
    }

    const passesTrait = (trait) => {
      const val = parseFloat(p.traits?.[trait] ?? 0);
      return val >= filters[`min_${trait}`] && val <= filters[`max_${trait}`];
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

    if (
      filters.badges?.length &&
      !filters.badges.every((b) => p.badges.includes(b))
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Check if a player has a $0.0M contract indicating training camp invite or non-guaranteed deal
 */
function _checkForZeroContract(player) {
  // Check current year salary from contract subcollection
  const currentYear = 2025;

  // Prioritize currentContractView (denormalized)
  if (player.currentContractView) {
    const salary =
      player.currentContractView.currentSalary ||
      player.currentContractView.salaryByYear?.[currentYear];
    if (salary === 0 || salary === null || salary === undefined) {
      return true;
    }
  }

  // Get contract data from v2 structure
  const contractData =
    player.primaryContract ||
    (player.contracts ? Object.values(player.contracts)[0] : null);

  // Check salariesByYear array in v2 structure
  if (contractData?.salariesByYear) {
    const currentSalary = contractData.salariesByYear.find(
      (s) => s.year === currentYear || s.season?.startsWith(String(currentYear))
    );
    if (
      currentSalary &&
      (currentSalary.salary === 0 ||
        currentSalary.salary === '0' ||
        currentSalary.salary === '$0.0M')
    ) {
      return true;
    }
  }

  // Check salaryByYear mapping (enriched data)
  if (player.salaryByYear?.[currentYear] === 0) {
    return true;
  }

  return false;
}

/**
 * Determine if a player is likely new (not in last year's 531 established players)
 * by checking for lack of established data that veterans would have
 */
function _isLikelyNewPlayer(player) {
  // Players with existing grades/traits are likely established (from previous 531)
  if (player.traits && Object.keys(player.traits).length > 0) {
    return false;
  }

  // Players with roles assigned are likely established
  // Note: enrichPlayerData spreads these from evaluations subcollection
  if (player.offenseRole && player.offenseRole !== '—') {
    return false;
  }

  // Players with substantial stats history are likely established
  // Stats are enriched from seasons subcollection
  if (player.GP && player.GP > 20) {
    return false;
  }

  // Players with established minutes per game are likely not training camp invites
  if (player.MIN && player.MIN > 15) {
    return false;
  }

  // If player has overall grade, they're established
  if (player.overallGrade) {
    return false;
  }

  // If none of the above, likely a new/training camp player
  return true;
}

export function sortPlayers(
  players = [],
  sortKey,
  sortAsc = true,
  filters = {}
) {
  const salaryYear = filters.salaryYear;
  return [...players].sort((a, b) => {
    const getValue = (player, field) => {
      if (traitSort.includes(field)) return player.traits?.[field] ?? -1;
      // Stats are enriched from seasons subcollection and spread to top level
      if (Object.prototype.hasOwnProperty.call(player, field) && typeof player[field] === 'number')
        return player[field];
      switch (field) {
        case 'name':
          return (player.bio?.displayName || player.name || '').toLowerCase();
        case 'height':
          return player.heightInInches;
        case 'weight':
          return player.weight;
        case 'age':
          return player.age;
        case 'salary':
          return player.salaryByYear?.[salaryYear] ?? -1;
        case 'shootingProfile':
          return shootingProfileRank[player.shootingProfile] ?? 0;
        case 'yearsRemaining':
          return (
            parseInt(
              player.freeAgentYear || player.bio?.display?.freeAgentYear
            ) - 2024 || -1
          );
        case 'totalContract': {
          // Contract data is in contracts subcollection
          const contractData =
            player.primaryContract ||
            (player.contracts ? Object.values(player.contracts)[0] : null);
          return Array.isArray(contractData?.salariesByYear)
            ? contractData.salariesByYear.reduce((sum, s) => {
                const val =
                  typeof s.salary === 'number'
                    ? s.salary
                    : parseFloat((s.salary || '').replace(/[^0-9.]/g, ''));
                return isNaN(val) ? sum : sum + val;
              }, 0)
            : -1;
        }
        case 'overall':
          return parseFloat(player.overallGrade) ?? -1;
        default:
          return -1;
      }
    };

    const valA = getValue(a, sortKey);
    const valB = getValue(b, sortKey);

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });
}
