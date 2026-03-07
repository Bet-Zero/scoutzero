/**
 * FILE: src/features/profile/hooks/usePlayerNavigation.js
 * PURPOSE: Player selection, team filtering, URL param handling, and keyboard navigation.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import usePlayerDetail from '@/shared/hooks/usePlayerDetail';
import { getPlayersForTeam } from '@/features/profile/utils/profileHelpers';
import {
  getPlayerProfileUrl,
  resolvePlayerProfileTarget,
} from '@/shared/utils/routing/playerRouteUtils';

const areArraysEqual = (a = [], b = []) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const isTextEntryTarget = (target) => {
  if (!(target instanceof Element)) {
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

const usePlayerNavigation = (openModal) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const {
    players: fetchedPlayers,
    loading: isLoading,
    error: listError,
  } = useSimplePlayerData();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [filteredKeys, setFilteredKeys] = useState([]);
  const unresolvedRouteRef = useRef(false);
  const previousSelectedPlayerRef = useRef('');

  const pidParam = searchParams.get('pid') || '';
  const legacyPlayerParam = searchParams.get('player') || '';
  const hasRouteTarget = Boolean(pidParam || legacyPlayerParam || slug);

  // Build lookup map and sorted team list from fetched players
  const { playersData, teams } = useMemo(() => {
    const data = {};
    const teamSet = new Set();
    fetchedPlayers.forEach((p) => {
      data[p.id] = p;
      if (p.bio?.display?.team) teamSet.add(p.bio.display.team);
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

    if (!result.player) {
      unresolvedRouteRef.current = true;
      setSelectedTeam((prev) => (prev ? '' : prev));
      setSelectedPlayer((prev) => (prev ? '' : prev));
      setFilteredKeys((prev) => (prev.length ? [] : prev));
      return;
    }

    const matchedPlayer = result.player;
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
  const handlePrevPlayer = useCallback(() => {
    if (!selectedPlayer || filteredKeys.length === 0) return;
    const currentIndex = filteredKeys.indexOf(selectedPlayer);
    if (currentIndex > 0) setSelectedPlayer(filteredKeys[currentIndex - 1]);
  }, [selectedPlayer, filteredKeys]);

  const handleNextPlayer = useCallback(() => {
    if (!selectedPlayer || filteredKeys.length === 0) return;
    const currentIndex = filteredKeys.indexOf(selectedPlayer);
    if (currentIndex < filteredKeys.length - 1)
      setSelectedPlayer(filteredKeys[currentIndex + 1]);
  }, [selectedPlayer, filteredKeys]);

  // Keyboard arrow navigation (disabled when modal is open)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        openModal ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        isTextEntryTarget(e.target)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') handlePrevPlayer();
      else if (e.key === 'ArrowRight') handleNextPlayer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPlayer, handleNextPlayer, openModal]);

  // Search result selection
  const handleSearchSelect = useCallback((id, team) => {
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
