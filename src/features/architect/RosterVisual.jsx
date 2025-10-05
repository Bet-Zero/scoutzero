import React, { useMemo } from 'react';
import RosterSection from '@/features/roster/RosterSection';
import {
  buildInitialRoster,
  normalizePlayer,
  isTwoWayContract,
} from '@/utils/roster';
import { getTeamColors } from '@/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/utils/formatting/teamLogos';
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
      const details = playersMap[p.name] || {};
      return { ...details, ...p };
    });

    const filtered = enriched.filter((p) => !isTwoWayContract(p));
    const sorted = filtered.sort(
      (a, b) =>
        parseFloat(b.MIN ?? b.latestSeasonStats?.MIN ?? 0) -
        parseFloat(a.MIN ?? a.latestSeasonStats?.MIN ?? 0)
    );

    return buildInitialRoster(sorted);
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
