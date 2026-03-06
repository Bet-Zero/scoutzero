/**
 * FILE: src/features/profile/hooks/usePlayerNavigation.js
 * PURPOSE: Player selection, team filtering, URL param handling, and keyboard navigation.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import usePlayerDetail from '@/shared/hooks/usePlayerDetail';
import { getPlayersForTeam } from '@/features/profile/utils/profileHelpers';

const usePlayerNavigation = (openModal) => {
  const [searchParams] = useSearchParams();
  const { players: fetchedPlayers, loading: isLoading } = useSimplePlayerData();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [filteredKeys, setFilteredKeys] = useState([]);

  const initialPidProcessedRef = useRef(false);

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
  const { player: detailedPlayer, loading: detailLoading } =
    usePlayerDetail(selectedPlayer);

  // Handle initial pid query param from URL
  useEffect(() => {
    if (initialPidProcessedRef.current || isLoading || fetchedPlayers.length === 0) {
      return;
    }

    const pidFromUrl = searchParams.get('pid');
    if (!pidFromUrl) {
      initialPidProcessedRef.current = true;
      return;
    }

    const matchedPlayer = fetchedPlayers.find(
      (p) => p.id === pidFromUrl || p.bio?.playerId === pidFromUrl
    );

    if (matchedPlayer) {
      const team = matchedPlayer.bio?.display?.team || '';
      setSelectedTeam(team);
      setSelectedPlayer(matchedPlayer.id);
      const filtered = fetchedPlayers
        .filter((p) => p.bio?.display?.team === team)
        .map((p) => p.id);
      setFilteredKeys(filtered);
    }

    initialPidProcessedRef.current = true;
  }, [searchParams, fetchedPlayers, isLoading]);

  // Prev/Next navigation
  const handlePrevPlayer = useCallback(() => {
    if (!selectedTeam || !selectedPlayer) return;
    const currentIndex = filteredKeys.indexOf(selectedPlayer);
    if (currentIndex > 0) setSelectedPlayer(filteredKeys[currentIndex - 1]);
  }, [selectedTeam, selectedPlayer, filteredKeys]);

  const handleNextPlayer = useCallback(() => {
    if (!selectedTeam || !selectedPlayer) return;
    const currentIndex = filteredKeys.indexOf(selectedPlayer);
    if (currentIndex < filteredKeys.length - 1)
      setSelectedPlayer(filteredKeys[currentIndex + 1]);
  }, [selectedTeam, selectedPlayer, filteredKeys]);

  // Keyboard arrow navigation (disabled when modal is open)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (openModal) return;
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
    handlePrevPlayer,
    handleNextPlayer,
    handleSearchSelect,
  };
};

export default usePlayerNavigation;
