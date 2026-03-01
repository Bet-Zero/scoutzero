import { toSeasonKey } from '@/features/architect/utils/seasonFormat';

export const DEV_SNT_INJECTOR_MARKER = '__tmDevSyntheticSnt';
export const DEV_SNT_INJECTOR_FLAG = 'hz.dev.injectSntPlayers';

export function isSyntheticSntPlayer(player) {
  return Boolean(player?.[DEV_SNT_INJECTOR_MARKER]);
}

export function stripSyntheticSntPlayers(players = []) {
  return (players || []).filter((player) => !isSyntheticSntPlayer(player));
}

function resolveEndYear(yearKey) {
  if (Number.isFinite(yearKey)) return Number(yearKey);
  if (typeof yearKey === 'string') {
    const trimmed = yearKey.trim();
    if (/^\d{4}$/.test(trimmed)) {
      return Number(trimmed);
    }
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      const [, suffix] = trimmed.split('-');
      const startYear = Number(trimmed.slice(0, 4));
      const endYear = Math.floor(startYear / 100) * 100 + Number(suffix);
      return endYear > startYear ? endYear : endYear + 100;
    }
  }
  return new Date().getFullYear();
}

export function buildSyntheticSntPlayers(team, yearKey) {
  const sourceTeamCode = team?.teamCode || team?.abbreviation || team?.id || null;
  const endYear = resolveEndYear(yearKey);
  const season = toSeasonKey(endYear);
  const sourceSuffix = String(sourceTeamCode || 'team').toUpperCase();

  const eligibleId = `tm-dev-snt-eligible-${sourceSuffix}`;
  const ineligibleId = `tm-dev-snt-ineligible-${sourceSuffix}`;

  const sharedFields = {
    teamCode: sourceTeamCode,
    teamId: sourceTeamCode,
    teamAbbr: sourceTeamCode,
    [DEV_SNT_INJECTOR_MARKER]: true,
  };

  return [
    {
      ...sharedFields,
      id: eligibleId,
      player_id: eligibleId,
      playerId: eligibleId,
      name: 'TM DEV S&T Eligible',
      displayName: 'TM DEV S&T Eligible',
      salary: 18_000_000,
      freeAgentYear: endYear,
      rightsRenounced: false,
      bio: {
        displayName: 'TM DEV S&T Eligible',
        playerId: eligibleId,
        position: 'G',
        team: sourceTeamCode,
      },
      contract: null,
      primaryContract: null,
      __tmDevSntProfile: 'eligible',
    },
    {
      ...sharedFields,
      id: ineligibleId,
      player_id: ineligibleId,
      playerId: ineligibleId,
      name: 'TM DEV S&T Ineligible',
      displayName: 'TM DEV S&T Ineligible',
      salary: 12_000_000,
      freeAgentYear: endYear + 2,
      rightsRenounced: false,
      bio: {
        displayName: 'TM DEV S&T Ineligible',
        playerId: ineligibleId,
        position: 'F',
        team: sourceTeamCode,
      },
      contract: {
        salariesByYear: [{ season, salary: 12_000_000, capHit: 12_000_000 }],
      },
      primaryContract: {
        salariesByYear: [{ season, salary: 12_000_000, capHit: 12_000_000 }],
      },
      __tmDevSntProfile: 'ineligible',
    },
  ];
}

export function injectSyntheticSntPlayersIntoTeams(teams = [], yearKey) {
  const targetIndex = (teams || []).findIndex((slot) => slot?.team);
  if (targetIndex < 0) return teams;

  return teams.map((slot, index) => {
    if (index !== targetIndex || !slot?.team) return slot;
    const cleanedPlayers = stripSyntheticSntPlayers(slot.team.players || []);
    const syntheticPlayers = buildSyntheticSntPlayers(slot.team, yearKey);

    return {
      ...slot,
      team: {
        ...slot.team,
        players: [...cleanedPlayers, ...syntheticPlayers],
      },
    };
  });
}

export function clearSyntheticSntPlayersFromTeams(teams = []) {
  return (teams || []).map((slot) => {
    if (!slot?.team) return slot;
    return {
      ...slot,
      team: {
        ...slot.team,
        players: stripSyntheticSntPlayers(slot.team.players || []),
      },
    };
  });
}

export function hasSyntheticSntPlayers(teams = []) {
  return (teams || []).some((slot) =>
    (slot?.team?.players || []).some((player) => isSyntheticSntPlayer(player))
  );
}
