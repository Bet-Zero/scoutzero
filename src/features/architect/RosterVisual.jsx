import React, { useMemo } from 'react';
import RosterSection from '@/features/roster/RosterSection';
import { buildInitialRoster, normalizePlayer } from '@/utils/roster';
import { getTeamColors } from '@/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/utils/formatting/teamLogos';

const RosterVisual = ({ teamCapSheet, playersMap = {} }) => {
  const roster = useMemo(() => {
    if (!teamCapSheet?.players) return null;
    const enriched = teamCapSheet.players.map((p) => {
      const details = playersMap[p.name] || {};
      return normalizePlayer({ ...details, ...p });
    });
    return buildInitialRoster(enriched);
  }, [teamCapSheet, playersMap]);

  if (!roster) return null;

  const teamName = teamCapSheet.teamName || '';
  const { primary, secondary } = getTeamColors(teamName);

  return (
    <div className="relative max-w-[1100px] mx-auto text-white p-6 flex flex-col items-center overflow-hidden">
      {teamName && (
        <img
          src={`/assets/logos/${getTeamLogoFilename(teamName)}.png`}
          alt=""
          className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-4 pointer-events-none select-none"
          style={{ zIndex: 0 }}
        />
      )}

      {teamName && (
        <div className="w-full flex justify-center relative z-10 mb-2">
          <h2
            className="text-5xl font-black tracking-wide uppercase relative"
            style={{
              color: '#1e1e1e',
              textShadow: `0 0 10px ${primary}, 0 0 18px ${secondary}`,
              transform: 'translateX(3px)',
            }}
          >
            {teamName}
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
