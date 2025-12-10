import { useMemo } from 'react';
import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile';

export const getPlayerKey = (player) =>
  player?.playerId || player?.id || player?.player_id || player?.name || null;

/**
 * Build a memoized map of playerId -> PlayerRulesProfile
 * so UI layers can consume a single source of truth for CBA rules.
 *
 * @param {Array} players - roster or free agent list
 * @param {Object} teamContext - context for rules evaluation
 * @param {Object} leagueContext - league/year context (simulation date, phase, etc.)
 * @returns {Map} map keyed by playerId/name with PlayerRulesProfile values
 */
export function usePlayerRulesProfiles(players = [], teamContext = {}, leagueContext = {}) {
  return useMemo(() => {
    const profiles = new Map();
    players.forEach((player) => {
      if (!player) return;
      const key = getPlayerKey(player);
      if (!key) return;

      profiles.set(
        key,
        computePlayerRulesProfile(player, teamContext, leagueContext)
      );
    });
    return profiles;
  }, [players, teamContext, leagueContext]);
}

export default usePlayerRulesProfiles;
