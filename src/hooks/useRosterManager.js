import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  isTwoWayContract,
  normalizePlayer,
  buildInitialRoster,
} from '@/utils/roster';
import { POSITION_MAP } from '@/utils/roles';
import {
  createRosterProject,
  fetchAllRosterProjects,
  loadRosterProject,
  updateRosterProject,
} from '@/firebase/rosterHelpers';
import { TeamMap } from '@/constants/teamList';

export const emptyRoster = {
  starters: [null, null, null, null, null],
  rotation: [null, null, null, null],
  bench: [null, null, null, null, null, null],
};

export const useRosterManager = (allPlayers = [], isLoading = false) => {
  const [roster, setRoster] = useState(emptyRoster);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loadMethod, setLoadMethod] = useState('current');
  const [savedRosters, setSavedRosters] = useState([]);

  const [rosterName, setRosterName] = useState('');
  const [rosterId, setRosterId] = useState(null);

  const processedPlayers = useMemo(
    () =>
      allPlayers.map((player) => ({
        id: player.id,
        name: (player.display_name || player.name || '').toLowerCase(),
        team: (player.bio?.Team || '').toLowerCase(),
        position:
          POSITION_MAP[player.bio?.Position] || player.bio?.Position || '',
        offenseRoles: [
          player.roles?.offense1?.toLowerCase() || '',
          player.roles?.offense2?.toLowerCase() || '',
        ],
        defenseRoles: [
          player.roles?.defense1?.toLowerCase() || '',
          player.roles?.defense2?.toLowerCase() || '',
        ],
        offenseSubroles: player.subRoles?.offense || [],
        defenseSubroles: player.subRoles?.defense || [],
        shootingProfile: (player.shootingProfile || '').toLowerCase(),
        badges: player.badges || [],
        salary: player.contract?.annual_salaries?.find((s) => s.year === 2025)
          ?.salary,
        freeAgentYear: player.free_agency_year?.toString(),
        freeAgentType: player.free_agent_type?.toLowerCase(),
        contractType: player.contract?.type?.toLowerCase(),
        extension: player.contract?.extension,
        options: player.contract?.options || [],
        original: player,
      })),
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
        setRoster(emptyRoster);
        return;
      }

      if (loadMethod === 'current') {
        if (!selectedTeam) return;
        const rawTeamPlayers = allPlayers.filter(
          (p) => (p.bio?.Team || '').toLowerCase() === selectedTeam.id
        );

        const teamPlayers = rawTeamPlayers
          .filter((p) => !isTwoWayContract(p))
          .sort(
            (a, b) =>
              parseFloat(b.system?.stats?.MP || 0) -
              parseFloat(a.system?.stats?.MP || 0)
          );

        setRoster(buildInitialRoster(teamPlayers));
        return;
      }

      const loaded = await loadRosterProject(loadMethod);
      if (loaded) {
        setSelectedTeam(TeamMap[loaded.team] || null);
        setRosterId(loaded.id);
        setRosterName(loaded.name);
        setRoster({
          starters: idsToPlayers(loaded.starters || []),
          rotation: idsToPlayers(loaded.rotation || []),
          bench: idsToPlayers(loaded.bench || []),
        });
      }
    };

    load();
  }, [selectedTeam, loadMethod, allPlayers, isLoading, idsToPlayers]);

  const addPlayerToSlot = useCallback(
    (player, section, index) => {
      const updated = [...roster[section]];
      updated[index] = normalizePlayer(player);
      setRoster({ ...roster, [section]: updated });
    },
    [roster]
  );

  const addPlayerToNextSlot = useCallback(
    (player) => {
      const normalized = normalizePlayer(player);
      for (const section of ['starters', 'rotation', 'bench']) {
        const index = roster[section].findIndex((p) => p === null);
        if (index !== -1) {
          const updated = [...roster[section]];
          updated[index] = normalized;
          setRoster({ ...roster, [section]: updated });
          return;
        }
      }
    },
    [roster]
  );

  const removePlayer = useCallback(
    (section, index) => {
      const updated = [...roster[section]];
      updated[index] = null;
      setRoster({ ...roster, [section]: updated });
    },
    [roster]
  );

  const saveNewRoster = useCallback(async () => {
    if (!rosterName.trim()) return;
    const created = await createRosterProject(
      rosterName,
      roster.starters.map((p) => (p ? p.id : null)),
      roster.rotation.map((p) => (p ? p.id : null)),
      roster.bench.map((p) => (p ? p.id : null)),
      selectedTeam?.id || ''
    );
    setRosterId(created.id);
    setSavedRosters((prev) => [...prev, created]);
    setRosterName('');
  }, [rosterName, roster, selectedTeam]);

  const updateRoster = useCallback(async () => {
    if (!rosterId) return;
    await updateRosterProject(
      rosterId,
      roster.starters.map((p) => (p ? p.id : null)),
      roster.rotation.map((p) => (p ? p.id : null)),
      roster.bench.map((p) => (p ? p.id : null))
    );
  }, [rosterId, roster]);

  const clearRoster = useCallback(() => {
    setRoster(emptyRoster);
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
        setRoster({
          starters: idsToPlayers(loaded.starters || []),
          rotation: idsToPlayers(loaded.rotation || []),
          bench: idsToPlayers(loaded.bench || []),
        });
      }
    },
    [idsToPlayers]
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
  };
};
