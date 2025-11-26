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

  const formatHeight = (inches) => {
    if (!inches || inches === 0) return 'N/A';
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}-${remainingInches}`;
  };

  const thisYear = 2025;
  
  // Get contract data from contracts subcollection (v2 structure only)
  const contractData = player.primaryContract ||
    (player.contracts ? Object.values(player.contracts)[0] : null);
  const totalYears = contractData?.contractLength;
  const currentYearSalaryObj = contractData?.salariesByYear?.find(
    (s) => s.year === thisYear || s.season?.startsWith(String(thisYear))
  );
  const currentSalary = currentYearSalaryObj?.salary;
  const contractSummary =
    currentSalary && totalYears
      ? `$${(currentSalary / 1_000_000).toFixed(1)}M / ${totalYears} yrs`
      : '—';

  // Get free agency info from bio.display or contract subcollection (v2 structure only)
  const freeAgency = contractData?.freeAgency || {};
  const freeAgentType =
    player.bio?.display?.freeAgentType ?? freeAgency.freeAgentType;
  const freeAgentYear =
    player.bio?.display?.freeAgentYear ?? freeAgency.freeAgentYear;
  const freeAgencyDisplay =
    freeAgentYear && freeAgentType
      ? `${freeAgentYear} (${freeAgentType})`
      : freeAgentYear || 'N/A';

  return (
    <div className="h-[220px] w-full max-w-[750px] flex items-center gap-4">
      <div className="flex w-[300px] justify-between">
        <div className="flex flex-col justify-center">
          <PlayerName name={player.bio?.displayName || player.name || 'Unknown'} />
          <div className="flex items-center gap-4 mt-4">
            <TeamLogo teamAbbr={player.bio?.display?.team} />
            <div className="h-[2.5rem] w-[2px] bg-black" />
            <PlayerPosition
              position={getAbbreviatedPosition(player.bio?.position)}
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
            <span className="font-bold">HT</span>: {formatHeight(player.bio?.height)}
          </p>
          <p>
            <span className="font-bold">WT</span>: {player.bio?.weight || 'N/A'}
          </p>
          <p>
            <span className="font-bold">AGE</span>: {(() => {
              // Calculate age from DOB if age field is missing
              if (player.bio?.age) return player.bio.age;
              if (player.bio?.dob) {
                try {
                  const birthDate = new Date(player.bio.dob);
                  if (!isNaN(birthDate.getTime())) {
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                    }
                    return age >= 0 ? age : 'N/A';
                  }
                } catch {}
              }
              return 'N/A';
            })()}
          </p>
          <p>
            <span className="font-bold">YEARS PRO</span>:{' '}
            {player.bio?.display?.yearsPro ?? 'N/A'}
          </p>
          {player.bio?.draft?.pick && (
            <p>
              <span className="font-bold">DRAFTED</span>:{' '}
              {player.bio.draft.year} Rd {player.bio.draft.round} Pick {player.bio.draft.pick}
            </p>
          )}
        </div>
        <div className="h-6" />
        <div className="space-y-[2px]">
          <p>
            <span className="font-bold">TEAM</span>: {player.bio?.display?.team || 'N/A'}
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
