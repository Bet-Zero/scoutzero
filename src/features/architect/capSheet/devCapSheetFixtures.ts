import { toSeasonCode } from '@/features/architect/utils/seasonFormat';

export const DEV_CAP_SHEET_FIXTURE_FLAG = 'hz.dev.capSheetFixtures';
export const DEV_CAP_SHEET_FIXTURE_MARKER = '__hzDevCapSheetFixture';
export const DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD =
  '__hzDevCapSheetFixtureBoundary';

export const DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER = {
  ownerLabel: 'useArchitectActions capSheetDevTools',
  stateKind: 'dev-synthetic-local-state',
  stateScope: 'local in-memory dashboard teamCapSheet state',
  writePath: 'setTeamCapSheetSafe',
  persistence: 'none',
  committedWorldRelationship: 'never-persists',
} as const;

export const DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY = {
  surfaceKind: 'dev-fixture-control-surface',
  visibility: 'dev-only',
  activationFlag: DEV_CAP_SHEET_FIXTURE_FLAG,
  activationRequirement:
    'requires-local-dev-build-and-explicit-local-intent-flag',
  authoritative: false,
  persistence: 'none',
  committedWorldRelationship: 'must-never-read-as-committed-world-state',
} as const;

export const DEV_CAP_SHEET_FIXTURE_BOUNDARY = {
  boundaryKind: 'dev-synthetic-fixture',
  intentLabel: 'Bounded futureContract seam probe',
  stateKind: 'dev-synthetic-local-state',
  authoritative: false,
  committedWorldRelationship:
    'must-never-read-as-committed-world-state',
  modeledSeams: [
    'futureContract future-season row visibility',
    'no-futureContract control row',
  ],
  notModeledSeams: [
    'real options',
    'guarantee complexity',
    'minimum-contract reimbursement',
    'irregular real-data contract overlaps',
  ],
} as const;

const DEV_CAP_SHEET_FIXTURE_ID_PREFIX = 'hz-dev-cap-fixture';

type DevCapSheetFixtureBoundaryMetadata = typeof DEV_CAP_SHEET_FIXTURE_BOUNDARY & {
  scenario: 'futureContractProbe' | 'noFutureContractControl';
};

type FixturePlayer = {
  id?: string | null;
  player_id?: string | null;
  playerId?: string | null;
  name?: string | null;
  displayName?: string | null;
  position?: string | null;
  contract?: unknown;
  futureContract?: unknown;
  bio?: unknown;
  [DEV_CAP_SHEET_FIXTURE_MARKER]?: boolean;
  [DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD]?:
    | DevCapSheetFixtureBoundaryMetadata
    | boolean;
};

type TeamCapSheetLike = {
  teamCode?: string | null;
  abbreviation?: string | null;
  id?: string | null;
  players?: FixturePlayer[] | null;
  roster?: unknown[] | null;
};

function resolveTeamCode(teamCapSheet: TeamCapSheetLike): string {
  const rawTeamCode =
    teamCapSheet?.teamCode || teamCapSheet?.abbreviation || teamCapSheet?.id;
  if (!rawTeamCode) return 'TEAM';
  return String(rawTeamCode).toUpperCase();
}

function getFixtureIdsForTeam(teamCode: string): [string, string] {
  const normalized = String(teamCode || 'TEAM').toUpperCase();
  return [
    `${DEV_CAP_SHEET_FIXTURE_ID_PREFIX}-future-${normalized}`,
    `${DEV_CAP_SHEET_FIXTURE_ID_PREFIX}-control-${normalized}`,
  ];
}

function isFixtureId(rawId: unknown): boolean {
  return (
    typeof rawId === 'string' &&
    rawId.startsWith(DEV_CAP_SHEET_FIXTURE_ID_PREFIX)
  );
}

function getPlayerId(player: FixturePlayer): string | null {
  const rawId = player?.id || player?.player_id || player?.playerId || null;
  if (!rawId) return null;
  return String(rawId);
}

export function isDevCapSheetFixturePlayer(player: FixturePlayer): boolean {
  return Boolean(
    player?.[DEV_CAP_SHEET_FIXTURE_MARKER] ||
      player?.[DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD] ||
      isFixtureId(getPlayerId(player))
  );
}

export function buildCapSheetFixturePlayers(
  teamCapSheet: TeamCapSheetLike,
  currentYear: number
): FixturePlayer[] {
  const teamCode = resolveTeamCode(teamCapSheet);
  const [futureFixtureId, controlFixtureId] = getFixtureIdsForTeam(teamCode);
  const currentSeason = toSeasonCode(currentYear);
  const nextSeason = toSeasonCode(currentYear + 1);
  const secondFutureSeason = toSeasonCode(currentYear + 2);

  const sharedFields = {
    teamCode,
    teamId: teamCode,
    teamAbbr: teamCode,
    [DEV_CAP_SHEET_FIXTURE_MARKER]: true,
  };
  const fixtureBoundary = {
    ...DEV_CAP_SHEET_FIXTURE_BOUNDARY,
    authoritative: false,
  } as const;

  return [
    {
      ...sharedFields,
      [DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD]: {
        ...fixtureBoundary,
        scenario: 'futureContractProbe',
      },
      id: futureFixtureId,
      player_id: futureFixtureId,
      playerId: futureFixtureId,
      name: 'CAP DEV FutureContract Fixture',
      displayName: 'CAP DEV FutureContract Fixture',
      position: 'F',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          {
            season: currentSeason,
            salary: 14_000_000,
            capHit: 14_000_000,
            guaranteed: true,
          },
        ],
      },
      futureContract: {
        extension: true,
        salariesByYear: [
          {
            season: nextSeason,
            salary: 16_000_000,
            capHit: 16_000_000,
            guaranteed: true,
            isExtensionSeason: true,
          },
          {
            season: secondFutureSeason,
            salary: 18_000_000,
            capHit: 18_000_000,
            guaranteed: true,
            isExtensionSeason: true,
          },
        ],
      },
      bio: {
        playerId: futureFixtureId,
        displayName: 'CAP DEV FutureContract Fixture',
        position: 'F',
      },
    },
    {
      ...sharedFields,
      [DEV_CAP_SHEET_FIXTURE_BOUNDARY_FIELD]: {
        ...fixtureBoundary,
        scenario: 'noFutureContractControl',
      },
      id: controlFixtureId,
      player_id: controlFixtureId,
      playerId: controlFixtureId,
      name: 'CAP DEV Control Fixture',
      displayName: 'CAP DEV Control Fixture',
      position: 'G',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          {
            season: currentSeason,
            salary: 7_500_000,
            capHit: 7_500_000,
            guaranteed: true,
          },
        ],
      },
      futureContract: null,
      bio: {
        playerId: controlFixtureId,
        displayName: 'CAP DEV Control Fixture',
        position: 'G',
      },
    },
  ];
}

export function injectCapSheetFixtures<TTeamCapSheet extends TeamCapSheetLike>(
  teamCapSheet: TTeamCapSheet,
  currentYear: number
): TTeamCapSheet {
  if (!teamCapSheet) return teamCapSheet;

  const teamCode = resolveTeamCode(teamCapSheet);
  const fixtureIds = new Set(getFixtureIdsForTeam(teamCode));
  const existingPlayers = Array.isArray(teamCapSheet.players)
    ? teamCapSheet.players
    : [];
  const existingRoster = Array.isArray(teamCapSheet.roster)
    ? teamCapSheet.roster
    : [];

  const cleanedPlayers = existingPlayers.filter((player) => {
    if (isDevCapSheetFixturePlayer(player)) return false;
    const playerId = getPlayerId(player);
    return !fixtureIds.has(String(playerId || ''));
  });
  const fixturePlayers = buildCapSheetFixturePlayers(teamCapSheet, currentYear);
  const cleanedRoster = existingRoster.filter(
    (rawId) => !fixtureIds.has(String(rawId))
  );
  const fixtureRoster = fixturePlayers
    .map((player) => getPlayerId(player))
    .filter((id): id is string => Boolean(id));

  return {
    ...teamCapSheet,
    players: [...cleanedPlayers, ...fixturePlayers],
    roster: [...cleanedRoster, ...fixtureRoster],
  } as TTeamCapSheet;
}

export function clearCapSheetFixtures<TTeamCapSheet extends TeamCapSheetLike>(
  teamCapSheet: TTeamCapSheet
): TTeamCapSheet {
  if (!teamCapSheet) return teamCapSheet;

  const existingPlayers = Array.isArray(teamCapSheet.players)
    ? teamCapSheet.players
    : [];
  const existingRoster = Array.isArray(teamCapSheet.roster)
    ? teamCapSheet.roster
    : [];

  const filteredPlayers = existingPlayers.filter(
    (player) => !isDevCapSheetFixturePlayer(player)
  );
  const filteredRoster = existingRoster.filter((rawId) => !isFixtureId(rawId));

  return {
    ...teamCapSheet,
    players: filteredPlayers,
    roster: filteredRoster,
  } as TTeamCapSheet;
}

export function hasInjectedCapSheetFixtures<TTeamCapSheet extends TeamCapSheetLike>(
  teamCapSheet: TTeamCapSheet | null | undefined
): boolean {
  if (!teamCapSheet) return false;

  const players = Array.isArray(teamCapSheet.players) ? teamCapSheet.players : [];
  const roster = Array.isArray(teamCapSheet.roster) ? teamCapSheet.roster : [];

  return (
    players.some((player) => isDevCapSheetFixturePlayer(player)) ||
    roster.some((rawId) => isFixtureId(rawId))
  );
}
