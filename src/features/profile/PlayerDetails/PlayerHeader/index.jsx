import React from 'react';
import PlayerName from './ProfilePlayerName';
import PlayerPosition from './ProfilePlayerPosition';
import TeamLogo from '@/components/shared/TeamLogo';
import PlayerHeadshot from '@/components/shared/PlayerHeadshot';
import { POSITION_MAP } from '@/utils/roles';

const PlayerHeader = ({ player, selectedPlayer }) => {
  const getAbbreviatedPosition = (position) => {
    if (!position) return 'N/A';
    return POSITION_MAP[position] || position;
  };

  const thisYear = 2025;
  const totalYears = player.contract?.annual_salaries?.length;
  const currentYearSalaryObj = player.contract?.annual_salaries?.find(
    (s) => s.year === thisYear
  );
  const currentSalary = currentYearSalaryObj?.salary;
  const contractSummary =
    currentSalary && totalYears
      ? `$${(currentSalary / 1_000_000).toFixed(1)}M / ${totalYears} yrs`
      : '—';

  const freeAgentType = player.free_agent_type; // now from top-level
  const freeAgencyYear = player.free_agency_year;
  const freeAgencyDisplay =
    freeAgencyYear && freeAgentType
      ? `${freeAgencyYear} (${freeAgentType})`
      : freeAgencyYear || 'N/A';

  return (
    <div className="h-[220px] w-full max-w-[750px] flex items-center gap-4">
      <div className="flex w-[300px] justify-between">
        <div className="flex flex-col justify-center">
          <PlayerName name={player.display_name || player.name || 'Unknown'} />
          <div className="flex items-center gap-4 mt-4">
            <TeamLogo teamAbbr={player.bio?.Team} />
            <div className="h-[2.5rem] w-[2px] bg-black" />
            <PlayerPosition
              position={getAbbreviatedPosition(player.bio?.Position)}
              className="text-5xl"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center">
        <PlayerHeadshot playerId={selectedPlayer} />
      </div>
      <div className="w-[230px] h-[190px] bg-[#1f1f1f] rounded-2xl shadow-lg text-white text-[13px] font-thin px-4 py-3 flex flex-col relative top-[0.11rem] justify-center">
        <div className="space-y-[2px]">
          <p>
            <span className="font-bold">HT</span>: {player.bio?.HT || 'N/A'}
          </p>
          <p>
            <span className="font-bold">WT</span>: {player.bio?.WT || 'N/A'}
          </p>
          <p>
            <span className="font-bold">AGE</span>: {player.bio?.AGE || 'N/A'}
          </p>
          <p>
            <span className="font-bold">YEARS PRO</span>:{' '}
            {player.bio?.['Years Pro'] || 'N/A'}
          </p>
        </div>
        <div className="h-6" />
        <div className="space-y-[2px]">
          <p>
            <span className="font-bold">TEAM</span>: {player.bio?.Team || 'N/A'}
          </p>
          <p>
            <span className="font-bold">CONTRACT</span>: {contractSummary}
          </p>
          <p>
            <span className="font-bold">FREE AGENT</span>: {freeAgencyDisplay}
          </p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PlayerHeader);
