import { expandPositionGroup } from '@/shared/utils/roles/roleUtils';
import { getPlayerId } from '@/shared/utils/getPlayerId';
import { getCurrentSeasonYear } from '@/shared/utils/contracts/contractUtils';
import { TeamSlugToCode } from '@/constants/teamList';
import type { PlayerFilters } from './playerFilterDefaults';

const shootingProfileRank: Record<string, number> = {
  Elite: 6,
  Plus: 5,
  Capable: 4,
  Willing: 3,
  Hesitant: 2,
  Non: 1,
};

const traitSort = [
  'Defense', 'Energy', 'Feel', 'IQ', 'Passing', 'Playmaking', 'Rebounding', 'Shooting',
];

const CURRENT_YEAR = getCurrentSeasonYear();

export type FilterablePlayer = {
  bio?: {
    displayName?: string | null;
    name?: string | null;
    display?: {
      teamId?: string | null;
      team?: string | null;
      freeAgentYear?: string | number | null;
      freeAgentType?: string | null;
    } | null;
    playerId?: string | null;
    height?: number | null;
    weight?: number | null;
  } | null;
  id?: string | null;
  player_id?: string | null;
  headshotUrl?: string | null;
  formattedPosition?: string | null;
  heightInInches?: number | null;
  weight?: number | null;
  age?: number | null;
  salaryByYear?: Record<string | number, number | null | undefined> | null;
  freeAgentYear?: string | number | null;
  freeAgentType?: string | null;
  birdRightsStatus?: string | null;
  overallGrade?: number | null;
  optionByYear?: Record<string | number, string | null | undefined> | null;
  offenseRole?: string | null;
  defenseRole?: string | null;
  primaryEvaluation?: {
    roles?: { offense2?: string | null; defense2?: string | null } | null;
  } | null;
  currentContractView?: {
    birdRights?: { status?: string | null } | null;
    currentSalary?: number | null;
    freeAgentYear?: string | number | null;
    freeAgentType?: string | null;
    options?: unknown[] | null;
    optionsByYear?: Record<string | number, string | null | undefined> | null;
    salaryByYear?: Record<string | number, number | null | undefined> | null;
    yearsRemaining?: number | null;
  } | null;
  shootingProfile?: string | null;
  subRoles?: { offense?: string[]; defense?: string[] } | null;
  subroles?: { offense?: string[]; defense?: string[] } | null;
  traits?: Record<string, number | null | undefined> | null;
  badges?: string[] | null;
  name?: string | null;
  primaryContract?: {
    freeAgency?: {
      birdRights?: string | null;
      freeAgentYear?: string | number | null;
      freeAgentType?: string | null;
    } | null;
    isExtension?: boolean | null;
    options?: Array<{ year?: string | number | null; type?: string | null }> | null;
    salariesByYear?: Array<{
      option?: string | null;
      salary?: number | string | null;
      season?: string | null;
      voidedByExtension?: boolean | null;
      year?: string | number | null;
    }> | null;
  } | null;
  contracts?: Record<string, NonNullable<FilterablePlayer['primaryContract']>> | null;
  [key: string]: unknown;
};

export function filterPlayers(
  players: FilterablePlayer[] = [],
  filters: PlayerFilters
): FilterablePlayer[] {
  if (!players) return [];
  const selectedPositions = expandPositionGroup(filters.position);

  return players.filter((p) => {
    if (filters.showFreeAgents === false) {
      const teamId = p.bio?.display?.teamId || '';
      const team = p.bio?.display?.team || '';
      if (teamId === 'FREE' || team === 'Free Agent') {
        return false;
      }
    }

    if (filters.nameSearch) {
      const playerName = (p.bio?.displayName || p.bio?.name || '').toLowerCase();
      const searchTerm = filters.nameSearch.toLowerCase();
      if (!playerName.includes(searchTerm)) return false;
    }

    if (filters.team) {
      let teamCode = filters.team;
      if (teamCode.length !== 3) {
        teamCode = TeamSlugToCode[teamCode.toLowerCase() as keyof typeof TeamSlugToCode] || teamCode;
      }
      const playerTeamId = (p.bio?.display?.teamId || '').toUpperCase();
      if (playerTeamId !== teamCode.toUpperCase()) {
        return false;
      }
    }

    if (filters.position && !selectedPositions.includes(p.formattedPosition ?? '')) {
      return false;
    }

    if (
      (p.heightInInches ?? 0) < filters.minHeight ||
      (filters.maxHeight !== null && (p.heightInInches ?? 0) > filters.maxHeight)
    ) {
      return false;
    }

    if (
      (p.weight ?? 0) < filters.minWeight ||
      (filters.maxWeight !== null && (p.weight ?? 0) > filters.maxWeight)
    ) {
      return false;
    }

    if (
      (p.age ?? 0) < filters.minAge ||
      (filters.maxAge !== null && (p.age ?? 0) > filters.maxAge)
    ) {
      return false;
    }

    if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
      const salary = p.salaryByYear?.[filters.salaryYear] ?? null;
      if (typeof salary !== 'number') {
        return filters.includeMissingSalary !== false;
      }
      if (filters.minSalary !== undefined && salary < filters.minSalary) return false;
      if (filters.maxSalary !== undefined && salary > filters.maxSalary) return false;
    }

    if (filters.freeAgentYear) {
      const playerFAYear = p.freeAgentYear;
      if (!playerFAYear || parseInt(String(playerFAYear)) !== parseInt(String(filters.freeAgentYear))) {
        return false;
      }
    }

    if (filters.freeAgentType && p.freeAgentType !== filters.freeAgentType) {
      return false;
    }

    if (filters.birdRights && p.birdRightsStatus !== filters.birdRights) {
      return false;
    }

    if (filters.min_overall_grade !== undefined || filters.max_overall_grade !== undefined) {
      const grade = p.overallGrade;
      if (typeof grade !== 'number') return false;
      if (filters.min_overall_grade !== undefined && grade < filters.min_overall_grade) return false;
      if (filters.max_overall_grade !== undefined && grade > filters.max_overall_grade) return false;
    }

    if (filters.optionTypes?.length > 0) {
      const optionCheckYear = filters.optionYear ?? filters.salaryYear;
      const playerOption = p.optionByYear?.[optionCheckYear] ?? null;
      if (!playerOption || !filters.optionTypes.includes(playerOption)) {
        return false;
      }
    }

    if (
      filters.offenseRole &&
      ![p.offenseRole, p.primaryEvaluation?.roles?.offense2]
        .filter(Boolean)
        .some((role) => (role as string).toLowerCase().includes(filters.offenseRole.toLowerCase()))
    ) {
      return false;
    }

    if (
      filters.defenseRole &&
      ![p.defenseRole, p.primaryEvaluation?.roles?.defense2]
        .filter(Boolean)
        .some((role) => (role as string).toLowerCase().includes(filters.defenseRole.toLowerCase()))
    ) {
      return false;
    }

    if (filters.shootingProfile && p.shootingProfile !== filters.shootingProfile) {
      return false;
    }

    if (filters.subRoles?.offense?.length || filters.subRoles?.defense?.length) {
      if (
        filters.subRoles.offense?.length &&
        !filters.subRoles.offense.every((sub) => (p.subRoles?.offense || []).includes(sub))
      ) {
        return false;
      }
      if (
        filters.subRoles.defense?.length &&
        !filters.subRoles.defense.every((sub) => (p.subRoles?.defense || []).includes(sub))
      ) {
        return false;
      }
    }

    const passesStat = (key: string, min: string, max: string): boolean => {
      const val = parseFloat(String(p[key] ?? 0)) * (key.includes('%') ? 100 : 1);
      return (
        val >= (filters as unknown as Record<string, number>)[`min_${min}`] &&
        val <= (filters as unknown as Record<string, number>)[`max_${max}`]
      );
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

    const passesTrait = (trait: string): boolean => {
      const val = parseFloat(String(p.traits?.[trait] ?? 0));
      const filtersMap = filters as unknown as Record<string, number>;
      return val >= filtersMap[`min_${trait}`] && val <= filtersMap[`max_${trait}`];
    };

    if (
      !passesTrait('Defense') || !passesTrait('Energy') || !passesTrait('Feel') ||
      !passesTrait('IQ') || !passesTrait('Passing') || !passesTrait('Playmaking') ||
      !passesTrait('Rebounding') || !passesTrait('Shooting')
    ) {
      return false;
    }

    if (
      filters.badges?.length &&
      !filters.badges.every((b) => (p.badges || []).includes(b))
    ) {
      return false;
    }

    return true;
  });
}

export function sortPlayers(
  players: FilterablePlayer[] = [],
  sortKey: string,
  sortAsc: boolean = true,
  filters: Partial<PlayerFilters> = {}
): FilterablePlayer[] {
  const salaryYear = filters.salaryYear;
  return [...players].sort((a, b) => {
    const getValue = (player: FilterablePlayer, field: string): string | number => {
      if (traitSort.includes(field)) return (player.traits?.[field] as number | undefined) ?? -1;
      if (
        Object.prototype.hasOwnProperty.call(player, field) &&
        typeof player[field] === 'number'
      ) {
        return player[field] as number;
      }
      switch (field) {
        case 'name':
          return ((player.bio?.displayName || player.name) ?? '').toLowerCase();
        case 'height':
          return typeof player.heightInInches === 'number' ? player.heightInInches : -1;
        case 'weight':
          return typeof player.weight === 'number' ? player.weight : -1;
        case 'age':
          return typeof player.age === 'number' ? player.age : -1;
        case 'salary':
          return (salaryYear !== undefined ? (player.salaryByYear?.[salaryYear] ?? -1) : -1) as number;
        case 'shootingProfile':
          return shootingProfileRank[player.shootingProfile ?? ''] ?? 0;
        case 'yearsRemaining': {
          const faYear = player.freeAgentYear || player.bio?.display?.freeAgentYear;
          const parsed = parseInt(String(faYear), 10);
          return !isNaN(parsed) ? parsed - CURRENT_YEAR : -1;
        }
        case 'totalContract': {
          const contractData =
            player.primaryContract ||
            (player.contracts ? Object.values(player.contracts)[0] : null);
          return Array.isArray(contractData?.salariesByYear)
            ? contractData.salariesByYear.reduce((sum: number, s) => {
                const val =
                  typeof s.salary === 'number'
                    ? s.salary
                    : parseFloat((String(s.salary || '')).replace(/[^0-9.]/g, ''));
                return isNaN(val) ? sum : sum + val;
              }, 0)
            : -1;
        }
        case 'overall': {
          const grade = parseFloat(String(player.overallGrade));
          return isNaN(grade) ? -1 : grade;
        }
        default:
          return -1;
      }
    };

    const valA = getValue(a, sortKey);
    const valB = getValue(b, sortKey);

    let result: number;
    if (typeof valA === 'string' && typeof valB === 'string') {
      result = sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      result = sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    }

    if (result === 0) {
      const nameA = ((a.bio?.displayName || a.name) ?? '').toLowerCase();
      const nameB = ((b.bio?.displayName || b.name) ?? '').toLowerCase();
      result = nameA.localeCompare(nameB);
    }
    if (result === 0) {
      const idA = getPlayerId(a) || '';
      const idB = getPlayerId(b) || '';
      result = idA.localeCompare(idB);
    }
    return result;
  });
}
