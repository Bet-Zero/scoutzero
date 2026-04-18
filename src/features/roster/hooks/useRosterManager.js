import { useEffect, useState, useMemo, useCallback } from 'react';
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
} from '@/firebase/rosterHelpers';
import { TeamMap } from '@/constants/teamList';

export const emptyRoster = createEmptyRoster();

export const useRosterManager = (
  allPlayers = [],
  isLoading = false,
  userId = null,
  authLoading = false
) => {
  const [roster, setRoster] = useState(() => createEmptyRoster());
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loadMethod, setLoadMethod] = useState('current');
  const [savedRosters, setSavedRosters] = useState([]);
  const [rosterName, setRosterName] = useState('');
  const [rosterId, setRosterId] = useState(null);

  const processedPlayers = useMemo(
    () =>
      allPlayers.map((player) => {
        const contractData =
          player.primaryContract ||
          (player.contracts ? Object.values(player.contracts)[0] : null);

        return {
          id: player.id,
          name: (player.bio?.displayName || player.name || '').toLowerCase(),
          team: (player.bio?.display?.team || '').toLowerCase(),
          teamCode: normalizeTeamCode(
            player.bio?.display?.teamId ||
              player.bio?.display?.team ||
              player.team ||
              player.bio?.team ||
              ''
          ),
          position:
            player.formattedPosition ||
            POSITION_MAP[player.bio?.position] ||
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
          extension: (player.contracts
            ? Object.values(player.contracts)
            : []
          ).find((c) => c.isExtension),
          options: contractData?.options || [],
          original: player,
        };
      }),
    [allPlayers]
  );

  const playersMap = useMemo(() => {
    const map = {};
    allPlayers.forEach((player) => {
      map[player.id] = player;
    });
    return map;
  }, [allPlayers]);

  const idsToPlayers = useCallback(
    (arr) =>
      arr.map((item) => {
        if (!item) return null;
        const id = typeof item === 'string' ? item : item.id;
        const data = playersMap[id];
        return data ? normalizePlayer(data) : createMissingRosterPlayer(id);
      }),
    [playersMap]
  );

  useEffect(() => {
    const loadSaved = async () => {
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

    loadSaved();
  }, [userId, authLoading]);

  useEffect(() => {
    const load = async () => {
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
          .sort(
            (a, b) =>
              parseFloat(b.MIN ?? b.latestSeasonStats?.MIN ?? 0) -
              parseFloat(a.MIN ?? a.latestSeasonStats?.MIN ?? 0)
          );

        setRoster(normalizeRosterShape(buildInitialRoster(teamPlayers)));
        return;
      }

      if (!userId) {
        return;
      }

      const loaded = await loadRosterProject(loadMethod, userId);
      if (!loaded) return;

      setSelectedTeam(TeamMap[loaded.team] || null);
      setRosterId(loaded.id);
      setRosterName(loaded.name);
      setRoster(
        normalizeRosterShape({
          starters: idsToPlayers(loaded.starters || []),
          rotation: idsToPlayers(loaded.rotation || []),
          bench: idsToPlayers(loaded.bench || []),
        })
      );
    };

    load();
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
    (player, section, index) => {
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
    (player) => {
      const normalized = normalizePlayer(player);
      const normalizedRoster = normalizeRosterShape(roster);

      for (const section of ['starters', 'rotation', 'bench']) {
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
    (section, index) => {
      const normalizedRoster = normalizeRosterShape(roster);
      const updated = [...normalizedRoster[section]];
      updated[index] = null;
      setRoster(
        normalizeRosterShape({ ...normalizedRoster, [section]: updated })
      );
    },
    [roster]
  );

  const saveNewRoster = useCallback(async () => {
    const trimmedName = rosterName.trim();
    if (!trimmedName) return;
    if (!userId) {
      throw new Error('No user session.');
    }

    const normalizedRoster = normalizeRosterShape(roster);
    const created = await createRosterProject(
      trimmedName,
      userId,
      normalizedRoster.starters.map((player) => (player ? player.id : null)),
      normalizedRoster.rotation.map((player) => (player ? player.id : null)),
      normalizedRoster.bench.map((player) => (player ? player.id : null)),
      selectedTeam?.id || ''
    );

    setRosterId(created.id);
    setLoadMethod(created.id);
    setSavedRosters((prev) => [...prev, created]);
    setRosterName(created.name);
  }, [rosterName, roster, selectedTeam, userId]);

  const updateRoster = useCallback(async () => {
    if (!rosterId) return;
    if (!userId) {
      throw new Error('No user session.');
    }

    const normalizedRoster = normalizeRosterShape(roster);
    const trimmedName = rosterName?.trim();

    await updateRosterProject(rosterId, userId, {
      starters: normalizedRoster.starters.map((player) =>
        player ? player.id : null
      ),
      rotation: normalizedRoster.rotation.map((player) =>
        player ? player.id : null
      ),
      bench: normalizedRoster.bench.map((player) =>
        player ? player.id : null
      ),
      name: trimmedName || undefined,
      team: selectedTeam?.id || '',
    });

    setSavedRosters((prev) =>
      prev.map((item) =>
        item.id === rosterId
          ? {
              ...item,
              name: trimmedName || item.name,
              team: selectedTeam?.id || '',
              starters: normalizedRoster.starters.map((player) =>
                player ? player.id : null
              ),
              rotation: normalizedRoster.rotation.map((player) =>
                player ? player.id : null
              ),
              bench: normalizedRoster.bench.map((player) =>
                player ? player.id : null
              ),
            }
          : item
        )
    );
  }, [rosterId, roster, rosterName, selectedTeam, userId]);

  const rosterHasPlayer = useCallback(
    (playerId) => {
      if (!playerId) return false;

      const normalizedRoster = normalizeRosterShape(roster);
      const allPlayersInRoster = [
        ...normalizedRoster.starters,
        ...normalizedRoster.rotation,
        ...normalizedRoster.bench,
      ].filter(Boolean);

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
      .filter((player) => player?.isMissing)
      .map((player) => player.missingPlayerId || player.id);
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
