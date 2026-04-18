/**
 * FILE: src/features/profile/hooks/usePlayerNavigation.ts
 * PURPOSE: Player selection, team filtering, URL param handling, and keyboard navigation.
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import type { SimplePlayer } from '@/shared/hooks/useSimplePlayerData';
import usePlayerDetail from '@/shared/hooks/usePlayerDetail';
import type { PlayerV2 } from '@/schemas/players_v2';
import { getPlayersForTeam } from '@/features/profile/utils/profileHelpers';
import {
  getPlayerProfileUrl,
  getPlayerRouteId,
  resolvePlayerProfileTarget,
} from '@/shared/utils/routing/playerRouteUtils';

type PlayersDataMap = Record<string, SimplePlayer>;

export type UsePlayerNavigationResult = {
  isLoading: boolean;
  isEmpty: boolean;
  listError: string | null;
  playersData: PlayersDataMap;
  teams: string[];
  selectedTeam: string;
  setSelectedTeam: Dispatch<SetStateAction<string>>;
  selectedPlayer: string;
  setSelectedPlayer: Dispatch<SetStateAction<string>>;
  filteredKeys: string[];
  setFilteredKeys: Dispatch<SetStateAction<string[]>>;
  detailedPlayer: PlayerV2 | null;
  detailLoading: boolean;
  detailError: string | null;
  handlePrevPlayer: () => void;
  handleNextPlayer: () => void;
  handleSearchSelect: (id: string, team: string) => void;
};

const areArraysEqual = (
  a: readonly string[] = [],
  b: readonly string[] = []
): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const isTextEntryTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
};

const usePlayerNavigation = (
  openModal: unknown
): UsePlayerNavigationResult => {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug = '' } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const {
    players: fetchedPlayers,
    loading: isLoading,
    error: listError,
  } = useSimplePlayerData();
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [filteredKeys, setFilteredKeys] = useState<string[]>([]);
  const unresolvedRouteRef = useRef<boolean>(false);
  const previousSelectedPlayerRef = useRef<string>('');

  const pidParam = searchParams.get('pid') || '';
  const legacyPlayerParam = searchParams.get('player') || '';
  const hasRouteTarget = Boolean(pidParam || legacyPlayerParam || slug);

  // Build lookup map and sorted team list from fetched players
  const { playersData, teams } = useMemo(() => {
    const data: PlayersDataMap = {};
    const teamSet = new Set<string>();
    fetchedPlayers.forEach((player) => {
      data[player.id] = player;
      const team = player.bio?.display?.team;
      if (team) teamSet.add(team);
    });
    return { playersData: data, teams: Array.from(teamSet).sort() };
  }, [fetchedPlayers]);

  // Fetch full player data for the selected player
  const {
    player: detailedPlayer,
    loading: detailLoading,
    error: detailError,
  } = usePlayerDetail(selectedPlayer);

  // Resolve player selection from canonical pid, legacy player, or unique slug.
  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!hasRouteTarget) {
      unresolvedRouteRef.current = false;
      return;
    }

    const result = resolvePlayerProfileTarget(fetchedPlayers, {
      pid: pidParam,
      legacyPlayer: legacyPlayerParam,
      slug,
    });

    const matchedId = getPlayerRouteId(result.player);
    const matchedPlayer = matchedId ? playersData[matchedId] : null;

    if (!matchedPlayer) {
      unresolvedRouteRef.current = true;
      setSelectedTeam((prev) => (prev ? '' : prev));
      setSelectedPlayer((prev) => (prev ? '' : prev));
      setFilteredKeys((prev) => (prev.length ? [] : prev));
      return;
    }

    const nextTeam = matchedPlayer.bio?.display?.team || '';
    const nextFilteredKeys = getPlayersForTeam(playersData, nextTeam);
    unresolvedRouteRef.current = false;

    setSelectedTeam((prev) => (prev === nextTeam ? prev : nextTeam));
    setSelectedPlayer((prev) =>
      prev === matchedPlayer.id ? prev : matchedPlayer.id
    );
    setFilteredKeys((prev) =>
      areArraysEqual(prev, nextFilteredKeys) ? prev : nextFilteredKeys
    );
  }, [
    fetchedPlayers,
    hasRouteTarget,
    isLoading,
    legacyPlayerParam,
    pidParam,
    playersData,
    slug,
  ]);

  // Keep the browser URL aligned to the selected player after in-page navigation.
  useEffect(() => {
    const previousSelectedPlayer = previousSelectedPlayerRef.current;
    previousSelectedPlayerRef.current = selectedPlayer;

    if (!selectedPlayer) {
      if (previousSelectedPlayer && !unresolvedRouteRef.current) {
        const currentUrl = `${location.pathname}${location.search}`;
        if (currentUrl !== '/profiles') {
          navigate('/profiles', { replace: true });
        }
      }
      return;
    }

    const selectedPlayerData = playersData[selectedPlayer];
    if (!selectedPlayerData) {
      return;
    }

    const nextUrl = getPlayerProfileUrl(selectedPlayerData);
    const currentUrl = `${location.pathname}${location.search}`;

    if (nextUrl !== currentUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [
    location.pathname,
    location.search,
    navigate,
    playersData,
    selectedPlayer,
  ]);

  // Prev/Next navigation
  const handlePrevPlayer = useCallback((): void => {
    if (!selectedPlayer || filteredKeys.length === 0) return;
    const currentIndex = filteredKeys.indexOf(selectedPlayer);
    if (currentIndex > 0) setSelectedPlayer(filteredKeys[currentIndex - 1]);
  }, [selectedPlayer, filteredKeys]);

  const handleNextPlayer = useCallback((): void => {
    if (!selectedPlayer || filteredKeys.length === 0) return;
    const currentIndex = filteredKeys.indexOf(selectedPlayer);
    if (currentIndex < filteredKeys.length - 1)
      setSelectedPlayer(filteredKeys[currentIndex + 1]);
  }, [selectedPlayer, filteredKeys]);

  // Keyboard arrow navigation (disabled when modal is open)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        openModal ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isTextEntryTarget(event.target)
      ) {
        return;
      }
      if (event.key === 'ArrowLeft') handlePrevPlayer();
      else if (event.key === 'ArrowRight') handleNextPlayer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPlayer, handleNextPlayer, openModal]);

  // Search result selection
  const handleSearchSelect = useCallback((id: string, team: string): void => {
    if (!id) return;
    setSelectedTeam(team);
    setSelectedPlayer(id);
    const filtered = getPlayersForTeam(playersData, team);
    setFilteredKeys(filtered);
  }, [playersData]);

  return {
    isLoading,
    isEmpty: !isLoading && !listError && fetchedPlayers.length === 0,
    listError,
    playersData,
    teams,
    selectedTeam,
    setSelectedTeam,
    selectedPlayer,
    setSelectedPlayer,
    filteredKeys,
    setFilteredKeys,
    detailedPlayer,
    detailLoading,
    detailError,
    handlePrevPlayer,
    handleNextPlayer,
    handleSearchSelect,
  };
};

export default usePlayerNavigation;
