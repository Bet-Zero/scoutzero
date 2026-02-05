import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  isTwoWayContract,
  normalizePlayer,
  buildInitialRoster,
  normalizeRosterShape,
  createEmptyRoster,
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

export const useRosterManager = (allPlayers = [], isLoading = false) => {
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
          salary: contractData?.salariesByYear?.find(
            (s) => s.year === 2025 || s.season?.startsWith('2025')
          )?.salary,
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
    allPlayers.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [allPlayers]);

  const idsToPlayers = useCallback(
    (arr) =>
      arr.map((item) => {
        if (!item) return null;
        const id = typeof item === 'string' ? item : item.id;
        const data = playersMap[id];
        return data ? normalizePlayer(data) : null;
      }),
    [playersMap]
  );

  useEffect(() => {
    const loadSaved = async () => {
      const all = await fetchAllRosterProjects();
      setSavedRosters(all);
    };
    loadSaved();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (isLoading || allPlayers.length === 0) return;

      if (loadMethod === 'blank') {
        setRoster(createEmptyRoster());
        setRosterId(null);
        setRosterName('');
        return;
      }

      if (loadMethod === 'current') {
        setRosterId(null);
        setRosterName('');
        if (!selectedTeam) return;
        // Match by team name (full name like "Los Angeles Lakers") or team slug
        const rawTeamPlayers = allPlayers.filter((p) => {
          const playerTeam = (p.bio?.display?.team || '').toLowerCase();
          const teamNameMatch =
            playerTeam === selectedTeam.teamName?.toLowerCase();
          const teamIdMatch = playerTeam === selectedTeam.id;
          // Also check if player team contains team nickname (e.g., "lakers" in "los angeles lakers")
          const nicknameMatch =
            selectedTeam.nickname &&
            playerTeam.includes(selectedTeam.nickname.toLowerCase());
          return teamNameMatch || teamIdMatch || nicknameMatch;
        });

        const teamPlayers = rawTeamPlayers
          .filter((p) => !isTwoWayContract(p))
          .sort(
            (a, b) =>
              parseFloat(b.MIN ?? b.latestSeasonStats?.MIN ?? 0) -
              parseFloat(a.MIN ?? a.latestSeasonStats?.MIN ?? 0)
          );

        setRoster(normalizeRosterShape(buildInitialRoster(teamPlayers)));
        return;
      }

      const loaded = await loadRosterProject(loadMethod);
      if (loaded) {
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
      }
    };

    load();
  }, [selectedTeam, loadMethod, allPlayers, isLoading, idsToPlayers]);

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
          return;
        }
      }
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
    const normalizedRoster = normalizeRosterShape(roster);
    const created = await createRosterProject(
      trimmedName,
      normalizedRoster.starters.map((p) => (p ? p.id : null)),
      normalizedRoster.rotation.map((p) => (p ? p.id : null)),
      normalizedRoster.bench.map((p) => (p ? p.id : null)),
      selectedTeam?.id || ''
    );
    setRosterId(created.id);
    setLoadMethod(created.id);
    setSavedRosters((prev) => [...prev, created]);
    setRosterName(created.name);
  }, [rosterName, roster, selectedTeam, setLoadMethod]);

  const updateRoster = useCallback(async () => {
    if (!rosterId) return;
    const normalizedRoster = normalizeRosterShape(roster);
    const trimmedName = rosterName?.trim();
    await updateRosterProject(
      rosterId,
      {
        starters: normalizedRoster.starters.map((p) => (p ? p.id : null)),
        rotation: normalizedRoster.rotation.map((p) => (p ? p.id : null)),
        bench: normalizedRoster.bench.map((p) => (p ? p.id : null)),
        name: trimmedName || undefined,
        team: selectedTeam?.id || '',
      }
    );
    setSavedRosters((prev) =>
      prev.map((item) =>
        item.id === rosterId
          ? {
              ...item,
              name: trimmedName || item.name,
              team: selectedTeam?.id || '',
              starters: normalizedRoster.starters.map((p) => (p ? p.id : null)),
              rotation: normalizedRoster.rotation.map((p) => (p ? p.id : null)),
              bench: normalizedRoster.bench.map((p) => (p ? p.id : null)),
            }
          : item
      )
    );
  }, [rosterId, roster, rosterName, selectedTeam]);

  const clearRoster = useCallback(() => {
    setRoster(createEmptyRoster());
    setLoadMethod('blank');
    setRosterId(null);
    setRosterName('');
  }, []);

  const loadRoster = useCallback(
    async (id) => {
      const loaded = await loadRosterProject(id);
      if (loaded) {
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
      }
    },
    [idsToPlayers]
  );

  const rosterHasPlayer = useCallback(
    (playerId) => {
      if (!playerId) return false;
      const normalizedRoster = normalizeRosterShape(roster);
      const allPlayersInRoster = [
        ...normalizedRoster.starters,
        ...normalizedRoster.rotation,
        ...normalizedRoster.bench,
      ].filter(Boolean);
      return allPlayersInRoster.some((p) => p.id === playerId);
    },
    [roster]
  );

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
    clearRoster,
    loadRoster,
    rosterId,
    setRosterId,
    rosterHasPlayer,
  };
};
