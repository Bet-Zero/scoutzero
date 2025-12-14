import React, { useMemo } from 'react';
import RosterSection from '@/features/roster/RosterSection';
import {
  buildInitialRoster,
  normalizePlayer,
  isTwoWayContract,
} from '@/features/roster/utils';
import { getTeamColors } from '@/shared/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/shared/utils/formatting/teamLogos';
import { TeamMap } from '@/constants/teamList';
import { useParams } from 'react-router-dom';

const RosterVisual = ({
  teamCapSheet,
  playersMap = {},
  teamId: propTeamId,
}) => {
  const { teamId: routeTeamId } = useParams();
  const id =
    propTeamId || teamCapSheet?.teamId || teamCapSheet?.id || routeTeamId || '';
  const teamInfo = TeamMap[id] || {};
  const roster = useMemo(() => {
    if (!teamCapSheet?.players) return null;
    const enriched = teamCapSheet.players.map((p) => {
      // Try multiple keys to find player in map
      const details =
        playersMap[p.name] ||
        playersMap[p.displayName] ||
        playersMap[p.id] ||
        {};
      // Merge player data, prioritizing hydrated team data but preserving enriched details
      return {
        ...details,
        ...p,
        // Ensure bio structure is preserved
        bio: p.bio || details.bio || {},
        // Ensure displayName is available
        name: p.displayName || p.name || details.name || p.id,
        displayName:
          p.displayName || details.bio?.displayName || p.name || p.id,
        // Preserve headshot from details if available
        // Normalize special characters for headshot lookup (e.g., kristaps_porzingis -> kristaps_porziņģis)
        headshot: (() => {
          if (details.headshotUrl) return details.headshotUrl;
          if (p.headshot) return p.headshot;
          const playerId = p.bio?.playerId || p.id || p.player_id || 'default';
          const normalizedId =
            playerId === 'default'
              ? 'default'
              : playerId
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase();
          return `/assets/headshots/${normalizedId}.png`;
        })(),
      };
    });

    // Separate standard and two-way contracts
    const standardPlayers = enriched.filter((p) => !isTwoWayContract(p));
    const twoWayPlayers = enriched.filter((p) => isTwoWayContract(p));
    
    // Sort standard players by minutes
    const sorted = standardPlayers.sort(
      (a, b) =>
        parseFloat(b.MIN ?? b.latestSeasonStats?.MIN ?? 0) -
        parseFloat(a.MIN ?? a.latestSeasonStats?.MIN ?? 0)
    );

    // Build initial roster (up to 15 standard players)
    const roster = buildInitialRoster(sorted);
    
    // Ensure we always have 15 players total by filling with two-way contracts if needed
    const totalPlayers = roster.starters.filter(Boolean).length + 
                        roster.rotation.filter(Boolean).length + 
                        roster.bench.filter(Boolean).length;
    
    if (totalPlayers < 15 && twoWayPlayers.length > 0) {
      // Fill remaining slots with two-way players
      const needed = 15 - totalPlayers;
      const twoWayToAdd = twoWayPlayers.slice(0, needed);
      
      // Add two-way players to bench slots
      const emptyBenchSlots = roster.bench.map((p, i) => p === null ? i : null).filter(i => i !== null);
      
      twoWayToAdd.forEach((player, idx) => {
        if (emptyBenchSlots[idx] !== undefined) {
          roster.bench[emptyBenchSlots[idx]] = normalizePlayer(player);
        }
      });
    }

    return roster;
  }, [teamCapSheet, playersMap]);

  if (!roster) return null;

  const displayName =
    teamInfo.nickname || teamInfo.teamName || teamCapSheet.teamName || id;
  const teamKey = getTeamLogoFilename(id || displayName);
  const { primary, secondary } = getTeamColors(teamKey);

  return (
    <div className="relative max-w-[1100px] mx-auto text-white p-6 flex flex-col items-center overflow-hidden">
      {displayName && (
        <img
          src={`/assets/logos/${teamKey}.png`}
          alt=""
          className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-4 pointer-events-none select-none"
          style={{ zIndex: 0 }}
        />
      )}

      {displayName && (
        <div className="w-full flex justify-center relative z-10 mb-2">
          <h2
            className="text-5xl font-black tracking-wide uppercase relative"
            style={{
              color: '#1e1e1e',
              textShadow: `0 0 10px ${primary}, 0 0 18px ${secondary}`,
              transform: 'translateX(3px)',
            }}
          >
            {displayName}
          </h2>
        </div>
      )}

      <h3 className="text-xl text-neutral-500 font-semibold z-10 mb-8 opacity-90 tracking-wide">
        Team Roster
      </h3>

      <RosterSection players={roster.starters} section="starters" isExport />
      <RosterSection players={roster.rotation} section="rotation" isExport />
      <RosterSection players={roster.bench} section="bench" isExport />
    </div>
  );
};

export default RosterVisual;
