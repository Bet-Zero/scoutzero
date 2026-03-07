import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';
import { normalizeTeamCode } from '@/shared/utils/filtering';
import { expandPositionGroup } from '@/shared/utils/roles';
import {
  getPlayerFreeAgentType,
  isPlayerTwoWay,
  playerHasOptionType,
} from '@/shared/utils/filtering';

export const findSalaryForYear = (
  player,
  salaryYear = DEFAULT_SALARY_YEAR
) => {
  if (!player) return null;

  const year = Number(salaryYear);
  const contractData =
    player.primaryContract ||
    player.contract ||
    (player.contracts ? Object.values(player.contracts)[0] : null) ||
    null;

  if (player.currentContractView?.salaryByYear?.[year] != null) {
    return player.currentContractView.salaryByYear[year];
  }

  if (!Array.isArray(contractData?.salariesByYear)) return null;

  const salaryEntry = contractData.salariesByYear.find(
    (season) =>
      season?.year === year || season?.season?.startsWith?.(String(year))
  );

  return salaryEntry?.salary ?? null;
};

export const hasActiveAddPlayerFilters = (filters = {}) => {
  if (!filters) return false;

  return Boolean(
    filters.team ||
      filters.position ||
      filters.offenseRole ||
      filters.defenseRole ||
      filters.shootingProfile ||
      filters.contractFeature ||
      filters.freeAgentYear ||
      filters.freeAgentStatus ||
      (Array.isArray(filters.badges) && filters.badges.length > 0) ||
      (Array.isArray(filters.subRoles?.offense) &&
        filters.subRoles.offense.length > 0) ||
      (Array.isArray(filters.subRoles?.defense) &&
        filters.subRoles.defense.length > 0) ||
      filters.minSalary !== undefined ||
      filters.maxSalary !== undefined ||
      filters.minHeight !== undefined ||
      filters.maxHeight !== undefined ||
      filters.minWeight !== undefined ||
      filters.maxWeight !== undefined ||
      filters.minAge !== undefined ||
      filters.maxAge !== undefined ||
      filters.min_PPG !== undefined ||
      filters.max_PPG !== undefined ||
      filters.min_RPG !== undefined ||
      filters.max_RPG !== undefined ||
      filters.min_APG !== undefined ||
      filters.max_APG !== undefined ||
      filters.min_FGP !== undefined ||
      filters.max_FGP !== undefined ||
      filters.min_TPP !== undefined ||
      filters.max_TPP !== undefined ||
      filters.min_FTP !== undefined ||
      filters.max_FTP !== undefined ||
      filters.min_eFGP !== undefined ||
      filters.max_eFGP !== undefined ||
      filters.min_MIN !== undefined ||
      filters.max_MIN !== undefined ||
      filters.min_G !== undefined ||
      filters.max_G !== undefined
  );
};

export const filterRosterDrawerPlayers = (
  allPlayers = [],
  search = '',
  filters = {}
) => {
  const searchTerm = search.toLowerCase();
  const {
    team,
    position,
    offenseRole,
    defenseRole,
    subRoles = { offense: [], defense: [] },
    shootingProfile,
    badges = [],
    minSalary,
    maxSalary,
    freeAgentYear,
    freeAgentStatus,
    contractFeature,
    minHeight,
    maxHeight,
    minWeight,
    maxWeight,
    minAge,
    maxAge,
  } = filters;

  const positionOptions = position ? expandPositionGroup(position) : null;
  const normalizedTeam = normalizeTeamCode(team);
  const normalizedFreeAgentStatus = freeAgentStatus || '';

  return allPlayers
    .filter((p) => {
      if (searchTerm && !p.name.includes(searchTerm)) return false;

      const playerTeamCode =
        p.teamCode ||
        normalizeTeamCode(
          p.team ||
            p.original?.bio?.display?.teamId ||
            p.original?.bio?.display?.team ||
            ''
        );
      if (normalizedTeam && playerTeamCode !== normalizedTeam) return false;

      if (positionOptions && !positionOptions.includes(p.position))
        return false;

      if (
        offenseRole &&
        !p.offenseRoles.some((r) => r.includes(offenseRole.toLowerCase()))
      ) {
        return false;
      }

      if (
        defenseRole &&
        !p.defenseRoles.some((r) => r.includes(defenseRole.toLowerCase()))
      ) {
        return false;
      }

      if (
        subRoles.offense.length > 0 &&
        !subRoles.offense.every((sr) => p.offenseSubroles.includes(sr))
      ) {
        return false;
      }

      if (
        subRoles.defense.length > 0 &&
        !subRoles.defense.every((sr) => p.defenseSubroles.includes(sr))
      ) {
        return false;
      }

      if (
        shootingProfile &&
        p.shootingProfile !== shootingProfile.toLowerCase()
      ) {
        return false;
      }

      if (badges.length > 0 && !badges.every((b) => p.badges.includes(b))) {
        return false;
      }

      if (minSalary !== undefined || maxSalary !== undefined) {
        const salaryValue =
          typeof p.salary === 'string'
            ? parseFloat(p.salary.replace(/[^0-9.]/g, '')) / 1000000
            : p.salary / 1000000;

        if (minSalary !== undefined && (!salaryValue || salaryValue < minSalary)) {
          return false;
        }

        if (maxSalary !== undefined && (!salaryValue || salaryValue > maxSalary)) {
          return false;
        }
      }

      if (freeAgentYear) {
        const matchesFreeAgentYear =
          p.freeAgentYear === freeAgentYear ||
          p.extension?.freeAgentYear?.toString() === freeAgentYear ||
          p.options.some((opt) => opt.year?.toString() === freeAgentYear);

        if (!matchesFreeAgentYear) return false;
      }

      if (normalizedFreeAgentStatus) {
        const playerFaType = getPlayerFreeAgentType(p.original);
        if (playerFaType !== normalizedFreeAgentStatus) return false;
      }

      if (contractFeature) {
        if (contractFeature === 'two_way') {
          if (!isPlayerTwoWay(p)) return false;
        } else if (!playerHasOptionType(p, contractFeature)) {
          return false;
        }
      }

      const heightVal = p.original?.bio?.height;
      const weightVal = p.original?.bio?.weight;
      const ageVal = p.original?.bio?.age;
      if (minHeight !== undefined && (heightVal == null || heightVal < minHeight)) {
        return false;
      }
      if (maxHeight !== undefined && (heightVal == null || heightVal > maxHeight)) {
        return false;
      }
      if (minWeight !== undefined && (weightVal == null || weightVal < minWeight)) {
        return false;
      }
      if (maxWeight !== undefined && (weightVal == null || weightVal > maxWeight)) {
        return false;
      }
      if (minAge !== undefined && (ageVal == null || ageVal < minAge)) {
        return false;
      }
      if (maxAge !== undefined && (ageVal == null || ageVal > maxAge)) {
        return false;
      }

      const ss = p.original?.currentSeasonStats ?? {};
      const passStatFilter = (field, minKey, maxKey) => {
        const lo = filters[minKey];
        const hi = filters[maxKey];
        if (lo === undefined && hi === undefined) return true;
        const val =
          parseFloat(ss[field] ?? 0) * (field.includes('%') ? 100 : 1);
        if (lo !== undefined && val < lo) return false;
        if (hi !== undefined && val > hi) return false;
        return true;
      };

      if (!passStatFilter('PTS', 'min_PPG', 'max_PPG')) return false;
      if (!passStatFilter('REB', 'min_RPG', 'max_RPG')) return false;
      if (!passStatFilter('AST', 'min_APG', 'max_APG')) return false;
      if (!passStatFilter('FG%', 'min_FGP', 'max_FGP')) return false;
      if (!passStatFilter('3PT%', 'min_TPP', 'max_TPP')) return false;
      if (!passStatFilter('FT%', 'min_FTP', 'max_FTP')) return false;
      if (!passStatFilter('eFG%', 'min_eFGP', 'max_eFGP')) return false;
      if (!passStatFilter('MIN', 'min_MIN', 'max_MIN')) return false;
      if (!passStatFilter('GP', 'min_G', 'max_G')) return false;

      return true;
    })
    .map((p) => p.original);
};

export const getPlayersForSelectedTeam = (allPlayers = [], selectedTeam) => {
  if (!selectedTeam) return [];

  const selectedTeamCode = normalizeTeamCode(
    selectedTeam.teamId || selectedTeam.code || selectedTeam.id || ''
  );

  return allPlayers.filter((player) => {
    const playerTeamCode = normalizeTeamCode(
      player.bio?.display?.teamId ||
        player.bio?.display?.team ||
        player.team ||
        player.bio?.team ||
        ''
    );
    const playerTeamName = (player.bio?.display?.team || '').toLowerCase();

    const teamNameMatch =
      playerTeamName === selectedTeam.teamName?.toLowerCase();
    const nicknameMatch =
      selectedTeam.nickname &&
      playerTeamName.includes(selectedTeam.nickname.toLowerCase());

    return playerTeamCode === selectedTeamCode || teamNameMatch || nicknameMatch;
  });
};
