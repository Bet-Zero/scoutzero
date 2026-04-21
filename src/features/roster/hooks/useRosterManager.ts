import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  buildInitialRoster,
  createEmptyRoster,
  createMissingRosterPlayer,
  findSalaryForYear,
  getPlayersForSelectedTeam,
  isRosterFull as checkRosterFull,
  isTwoWayContract,
  normalizePlayer,
  normalizeRosterShape,
  type MissingRosterPlayer,
  type NormalizedRosterPlayer,
  type RosterDrawerOriginalPlayer,
  type RosterDrawerPlayer,
  type RosterShape,
  type SelectedRosterTeam,
} from '@/features/roster/utils';
import { POSITION_MAP } from '@/shared/utils/roles';
import {
  normalizeFreeAgentType,
  normalizeTeamCode,
} from '@/shared/utils/filtering';
import {
  createRosterProject,
  fetchAllRosterProjects,
  loadRosterProject,
  updateRosterProject,
  type RosterProject,
  type RosterProjectPlayerId,
} from '@/firebase/rosterHelpers';
import { TeamMap, type TeamEntry, type TeamSlug } from '@/constants/teamList';

type RosterSection = keyof RosterShape;
type RosterPlayer = NormalizedRosterPlayer | MissingRosterPlayer;
type RosterState = RosterShape<RosterPlayer>;

type RosterManagerContract = {
  contractType?: string | null;
  freeAgency?: {
    freeAgentYear?: number | string | null;
    freeAgentType?: string | null;
  } | null;
  isExtension?: boolean | null;
  options?: Array<{ year?: number | string | null; type?: string | null }> | null;
};

export type RosterManagerPlayer = RosterDrawerOriginalPlayer & {
  id: string;
  name?: string | null;
  headshotUrl?: string | null;
  formattedPosition?: string | null;
  team?: string | number | null;
  MIN?: number | string | null;
  latestSeasonStats?: {
    MIN?: number | string | null;
  } | null;
  offenseRole?: string | null;
  defenseRole?: string | null;
  primaryEvaluation?: {
    roles?: {
      offense2?: string | null;
      defense2?: string | null;
    } | null;
  } | null;
  subRoles?: {
    offense?: string[] | null;
    defense?: string[] | null;
  } | null;
  shootingProfile?: string | null;
  badges?: string[] | null;
  primaryContract?: RosterManagerContract | null;
  contracts?: Record<string, RosterManagerContract | null | undefined> | null;
};

export type UseRosterManagerResult = {
  roster: RosterState;
  processedPlayers: Array<RosterDrawerPlayer<RosterManagerPlayer>>;
  selectedTeam: TeamEntry | null;
  setSelectedTeam: Dispatch<SetStateAction<TeamEntry | null>>;
  loadMethod: string;
  setLoadMethod: Dispatch<SetStateAction<string>>;
  addPlayerToSlot: (
    player: RosterManagerPlayer,
    section: RosterSection,
    index: number
  ) => void;
  addPlayerToNextSlot: (player: RosterManagerPlayer) => boolean;
  removePlayer: (section: RosterSection, index: number) => void;
  savedRosters: RosterProject[];
  rosterName: string;
  setRosterName: Dispatch<SetStateAction<string>>;
  saveNewRoster: () => Promise<void>;
  updateRoster: () => Promise<void>;
  rosterId: string | null;
  rosterHasPlayer: (playerId: string | number | null | undefined) => boolean;
  isRosterFull: boolean;
  hasMissingPlayers: boolean;
  missingPlayerCount: number;
  missingPlayerIds: Array<string | number>;
  isSavedRosterSelection: boolean;
};

export const emptyRoster: RosterState = createEmptyRoster();

const rosterSections: RosterSection[] = ['starters', 'rotation', 'bench'];

const getTeamFromSlug = (team: string | null | undefined): TeamEntry | null => {
  if (!team || !Object.prototype.hasOwnProperty.call(TeamMap, team)) {
    return null;
  }

  return TeamMap[team as TeamSlug];
};

const coerceString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const coerceRosterProjectIds = (value: unknown): RosterProjectPlayerId[] =>
  Array.isArray(value)
    ? value.map((item) =>
        item === null || item === undefined
          ? null
          : typeof item === 'string'
            ? item
            : String(item)
      )
    : [];

const getContractValues = (
  player: RosterManagerPlayer
): RosterManagerContract[] =>
  player.contracts
    ? Object.values(player.contracts).filter(
        (contract): contract is RosterManagerContract => Boolean(contract)
      )
    : [];

const serializeRosterSection = (
  section: Array<RosterPlayer | null>
): RosterProjectPlayerId[] =>
  section.map((player) =>
    player?.id !== null && player?.id !== undefined ? String(player.id) : null
  );

export const useRosterManager = (
  allPlayers: readonly RosterManagerPlayer[] = [],
  isLoading = false,
  userId: string | null = null,
  authLoading = false
): UseRosterManagerResult => {
  const [roster, setRoster] = useState<RosterState>(() => createEmptyRoster());
  const [selectedTeam, setSelectedTeam] = useState<TeamEntry | null>(null);
  const [loadMethod, setLoadMethod] = useState<string>('current');
  const [savedRosters, setSavedRosters] = useState<RosterProject[]>([]);
  const [rosterName, setRosterName] = useState<string>('');
  const [rosterId, setRosterId] = useState<string | null>(null);

  const processedPlayers = useMemo(
    () =>
      allPlayers.map<RosterDrawerPlayer<RosterManagerPlayer>>((player) => {
        const contractValues = getContractValues(player);
        const contractData = player.primaryContract || contractValues[0] || null;

        return {
          id: player.id,
          name: (player.bio?.displayName || player.name || '').toLowerCase(),
          team: String(player.bio?.display?.team || '').toLowerCase(),
          teamCode: normalizeTeamCode(
            player.bio?.display?.teamId ||
              player.bio?.display?.team ||
              player.team ||
              player.bio?.team ||
              ''
          ),
          position:
            player.formattedPosition ||
            POSITION_MAP[player.bio?.position || ''] ||
            player.bio?.position ||
            '',
          offenseRoles: [
            player.offenseRole?.toLowerCase() || '',
            player.primaryEvaluation?.roles?.offense2?.toLowerCase() || '',
          ],
          defenseRoles: [
            player.defenseRole?.toLowerCase() || '',
            player.primaryEvaluation?.roles?.defense2?.toLowerCase() || '',
          ],
          offenseSubroles: player.subRoles?.offense || [],
          defenseSubroles: player.subRoles?.defense || [],
          shootingProfile: (player.shootingProfile || '').toLowerCase(),
          badges: player.badges || [],
          salary: findSalaryForYear(player),
          freeAgentYear:
            player.bio?.display?.freeAgentYear?.toString() ||
            contractData?.freeAgency?.freeAgentYear?.toString() ||
            null,
          freeAgentType: normalizeFreeAgentType(
            player.bio?.display?.freeAgentType ||
              contractData?.freeAgency?.freeAgentType ||
              ''
          ),
          contractType: (contractData?.contractType || '').toLowerCase(),
          extension: (() => {
            const extensionContract = contractValues.find(
              (contract) => contract.isExtension
            );
            return extensionContract
              ? {
                  freeAgentYear:
                    extensionContract.freeAgency?.freeAgentYear ?? null,
                }
              : null;
          })(),
          options: contractData?.options || [],
          original: player,
        };
      }),
    [allPlayers]
  );

  const playersMap = useMemo(() => {
    const map: Record<string, RosterManagerPlayer> = {};
    allPlayers.forEach((player) => {
      map[player.id] = player;
    });
    return map;
  }, [allPlayers]);

  const idsToPlayers = useCallback(
    (
      arr: Array<string | { id?: string | number | null } | null | undefined>
    ): Array<RosterPlayer | null> =>
      arr.map((item) => {
        if (!item) return null;
        const id = typeof item === 'string' ? item : item.id;
        const data =
          id !== null && id !== undefined ? playersMap[String(id)] : undefined;
        return data ? normalizePlayer(data) : createMissingRosterPlayer(id);
      }),
    [playersMap]
  );

  useEffect(() => {
    const loadSaved = async (): Promise<void> => {
      if (!userId) {
        setSavedRosters([]);
        return;
      }

      const all = await fetchAllRosterProjects(userId);
      setSavedRosters(all);
    };

    if (authLoading) {
      return;
    }

    void loadSaved();
  }, [userId, authLoading]);

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (authLoading || isLoading || allPlayers.length === 0) return;

      if (loadMethod === 'blank') {
        setRoster(createEmptyRoster());
        setRosterId(null);
        setRosterName('');
        return;
      }

      if (loadMethod === 'current') {
        setRosterId(null);
        setRosterName('');
        if (!selectedTeam) {
          setRoster(createEmptyRoster());
          return;
        }

        const teamPlayers = getPlayersForSelectedTeam(allPlayers, selectedTeam)
          .filter((player) => !isTwoWayContract(player))
          .sort((a, b) => {
            const bMinutes = Number.parseFloat(
              String(b.MIN ?? b.latestSeasonStats?.MIN ?? 0)
            );
            const aMinutes = Number.parseFloat(
              String(a.MIN ?? a.latestSeasonStats?.MIN ?? 0)
            );
            return bMinutes - aMinutes;
          });

        setRoster(normalizeRosterShape(buildInitialRoster(teamPlayers)));
        return;
      }

      if (!userId) {
        return;
      }

      const loaded = await loadRosterProject(loadMethod, userId);
      if (!loaded) return;

      const loadedId = coerceString(loaded.id, loadMethod);
      const loadedName = coerceString(loaded.name);

      setSelectedTeam(getTeamFromSlug(coerceString(loaded.team)));
      setRosterId(loadedId);
      setRosterName(loadedName);
      setRoster(
        normalizeRosterShape({
          starters: idsToPlayers(coerceRosterProjectIds(loaded.starters)),
          rotation: idsToPlayers(coerceRosterProjectIds(loaded.rotation)),
          bench: idsToPlayers(coerceRosterProjectIds(loaded.bench)),
        })
      );
    };

    void load();
  }, [
    selectedTeam,
    loadMethod,
    allPlayers,
    isLoading,
    idsToPlayers,
    userId,
    authLoading,
  ]);

  const addPlayerToSlot = useCallback(
    (player: RosterManagerPlayer, section: RosterSection, index: number): void => {
      const normalizedRoster = normalizeRosterShape(roster);
      const updated = [...normalizedRoster[section]];
      updated[index] = normalizePlayer(player);
      setRoster(
        normalizeRosterShape({ ...normalizedRoster, [section]: updated })
      );
    },
    [roster]
  );

  const addPlayerToNextSlot = useCallback(
    (player: RosterManagerPlayer): boolean => {
      const normalized = normalizePlayer(player);
      const normalizedRoster = normalizeRosterShape(roster);

      for (const section of rosterSections) {
        const index = normalizedRoster[section].findIndex((p) => p === null);
        if (index !== -1) {
          const updated = [...normalizedRoster[section]];
          updated[index] = normalized;
          setRoster(
            normalizeRosterShape({ ...normalizedRoster, [section]: updated })
          );
          return true;
        }
      }

      return false;
    },
    [roster]
  );

  const removePlayer = useCallback(
    (section: RosterSection, index: number): void => {
      const normalizedRoster = normalizeRosterShape(roster);
      const updated = [...normalizedRoster[section]];
      updated[index] = null;
      setRoster(
        normalizeRosterShape({ ...normalizedRoster, [section]: updated })
      );
    },
    [roster]
  );

  const saveNewRoster = useCallback(async (): Promise<void> => {
    const trimmedName = rosterName.trim();
    if (!trimmedName) return;
    if (!userId) {
      throw new Error('No user session.');
    }

    const normalizedRoster = normalizeRosterShape(roster);
    const starters = serializeRosterSection(normalizedRoster.starters);
    const rotation = serializeRosterSection(normalizedRoster.rotation);
    const bench = serializeRosterSection(normalizedRoster.bench);
    const created = await createRosterProject(
      trimmedName,
      userId,
      starters,
      rotation,
      bench,
      selectedTeam?.id || ''
    );

    const createdRoster: RosterProject = {
      id: created.id,
      name: created.name,
      team: created.team,
      starters: created.starters,
      rotation: created.rotation,
      bench: created.bench,
      ownerUid: userId,
    };

    setRosterId(createdRoster.id);
    setLoadMethod(createdRoster.id);
    setSavedRosters((prev) => [...prev, createdRoster]);
    setRosterName(created.name);
  }, [rosterName, roster, selectedTeam, userId]);

  const updateRoster = useCallback(async (): Promise<void> => {
    if (!rosterId) return;
    if (!userId) {
      throw new Error('No user session.');
    }

    const normalizedRoster = normalizeRosterShape(roster);
    const starters = serializeRosterSection(normalizedRoster.starters);
    const rotation = serializeRosterSection(normalizedRoster.rotation);
    const bench = serializeRosterSection(normalizedRoster.bench);
    const trimmedName = rosterName?.trim();
    const team = selectedTeam?.id || '';

    await updateRosterProject(rosterId, userId, {
      starters,
      rotation,
      bench,
      name: trimmedName || undefined,
      team,
    });

    setSavedRosters((prev) =>
      prev.map((item) =>
        item.id === rosterId
          ? {
              ...item,
              name: trimmedName || item.name,
              team,
              starters,
              rotation,
              bench,
            }
          : item
        )
    );
  }, [rosterId, roster, rosterName, selectedTeam, userId]);

  const rosterHasPlayer = useCallback(
    (playerId: string | number | null | undefined): boolean => {
      if (!playerId) return false;

      const normalizedRoster = normalizeRosterShape(roster);
      const allPlayersInRoster = [
        ...normalizedRoster.starters,
        ...normalizedRoster.rotation,
        ...normalizedRoster.bench,
      ].filter((player): player is RosterPlayer => Boolean(player));

      return allPlayersInRoster.some((player) => player.id === playerId);
    },
    [roster]
  );

  const missingPlayerIds = useMemo(() => {
    const normalizedRoster = normalizeRosterShape(roster);
    return [
      ...normalizedRoster.starters,
      ...normalizedRoster.rotation,
      ...normalizedRoster.bench,
    ]
      .filter((player): player is MissingRosterPlayer =>
        Boolean(player?.isMissing)
      )
      .map((player) => player.missingPlayerId || player.id)
      .filter((id): id is string | number => id !== null && id !== undefined);
  }, [roster]);

  return {
    roster,
    processedPlayers,
    selectedTeam,
    setSelectedTeam,
    loadMethod,
    setLoadMethod,
    addPlayerToSlot,
    addPlayerToNextSlot,
    removePlayer,
    savedRosters,
    rosterName,
    setRosterName,
    saveNewRoster,
    updateRoster,
    rosterId,
    rosterHasPlayer,
    isRosterFull: checkRosterFull(roster),
    hasMissingPlayers: missingPlayerIds.length > 0,
    missingPlayerCount: missingPlayerIds.length,
    missingPlayerIds,
    isSavedRosterSelection: loadMethod !== 'current' && loadMethod !== 'blank',
  };
};
