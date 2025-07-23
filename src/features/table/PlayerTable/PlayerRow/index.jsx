import React, { useState } from 'react';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import ShootingProfileMini from '@/features/table/PlayerTable/PlayerRow/ShootingProfileMini';
import RolePill from '@/features/table/PlayerTable/PlayerRow/RolePill';
import OverallGradeBlock from '@/components/shared/ui/grades/OverallGradeBlock';
import PlayerDrawer from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer';
import TeamLogo from '@/components/shared/TeamLogo';
import { ChevronDown, ChevronUp } from 'lucide-react';
import AddToListButton from '@/features/lists/AddToListButton';
import { getCurrentSeasonYear, getYearsRemaining } from '@/utils/contracts';

const PlayerRow = ({ player, ranking = '—' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const nameParts = (
    player.display_name ||
    player.name ||
    'Unknown Player'
  ).split(' ');
  const firstName = nameParts[0]?.toUpperCase() || '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase() || '';

  return (
    <div className="relative w-full max-w-[1100px] border border-black mx-auto mb-2">
      {/* Add Button - fixed small circle in top-right corner (overlay) */}
      <div className="absolute top-0.5 right-0 z-10">
        <AddToListButton player={player} />
      </div>

      <div className="w-full h-[90px] bg-[#1e1e1e] flex items-center overflow-hidden relative rounded-sm">
        {/* Position */}
        <div className="h-full w-16 flex items-center">
          <div className="text-lg font-semibold text-white/50 w-full text-center tracking-wide uppercase">
            {player.formattedPosition || '—'}
          </div>
          <div className="h-full w-[2px] bg-neutral-950"></div>
        </div>

        {/* Player Image */}
        <div className="h-full w-20 bg-[#2a2a2a] flex items-center justify-center overflow-hidden">
          <img
            src={
              player.headshotUrl || `/assets/headshots/${player.player_id}.png`
            }
            onError={(e) => {
              e.target.src = '/assets/headshots/default.png';
            }}
            alt={player.name}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Name + Team Info */}
        <div className="ml-3 flex flex-col justify-center w-[140px]">
          <div className="h-[50px] mb-2">
            <PlayerNameMini name={player.display_name || player.name} />
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo teamAbbr={player.bio?.Team} className="w-6 h-6" />
            <div className="text-[14px] text-white/50 tracking-wide">
              {player.bio?.HT || '—'} <span className="text-white/30">|</span>{' '}
              {player.bio?.WT || '—'} lbs
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="flex gap-2 ml-[140px] mr-3 items-center">
          <RolePill
            label={player.offenseRole || '—'}
            colorClass="border-purple-500 text-white/80"
            bgClass="bg-purple-900/40"
          />
          {player.defenseRole && (
            <RolePill
              label={player.defenseRole}
              colorClass="border-blue-500 text-white/80"
              bgClass="bg-blue-900/40"
            />
          )}
        </div>

        {/* Contract Info */}
        <div className="ml-0 border-l border-[#333] text-[11px] tracking-wide w-[140px] leading-tight text-center break-words">
          {player.contract?.annual_salaries && player.free_agency_year ? (
            (() => {
              const CURRENT_YEAR = getCurrentSeasonYear();

              const currentSalary =
                player.contract.annual_salaries.find(
                  (s) => s.year === CURRENT_YEAR
                )?.salary ??
                player.contract.extension?.annual_salaries?.find(
                  (s) => s.year === CURRENT_YEAR
                )?.salary ??
                0;

              const yearsLeft = getYearsRemaining(
                player.fa_year ?? player.free_agency_year,
                CURRENT_YEAR
              );
              const formattedSalary = `$${(currentSalary / 1_000_000).toFixed(1)}M`;

              return (
                <>
                  <div>
                    <span className="text-white">{formattedSalary}</span>
                    <span className="text-white/40"> / {yearsLeft} YRS</span>
                  </div>
                  <div className="text-white/40">
                    {player.free_agent_type || 'UFA'} {player.free_agency_year}
                  </div>
                </>
              );
            })()
          ) : (
            <div className="text-white/40">Two-Way</div>
          )}
        </div>

        {/* Divider */}
        <div className="h-4/5 w-px bg-[#444444] ml-1 mr-3"></div>

        {/* Stats */}
        <div className="flex items-center">
          <div className="w-28 h-10 rounded-md bg-[#2a2a2a] flex items-center">
            {[
              { label: 'PPG', value: player.PPG },
              { label: 'RPG', value: player.RPG },
              { label: 'APG', value: player.APG },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="w-1/3 h-9 mx-0.5 rounded bg-[#222222] flex flex-col items-center justify-center"
              >
                <span className="text-[9px] text-gray-400">{label}</span>
                <span className="text-xs font-bold text-white">
                  {typeof value === 'number' ? value.toFixed(1) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-4/5 w-px bg-[#444444] ml-3"></div>

        {/* Shooting Profile */}
        <div className="flex items-center justify-center ml-3">
          <ShootingProfileMini value={player.shootingProfile} />
        </div>

        {/* Divider */}
        <div className="h-4/5 w-px bg-[#444444] mx-3"></div>

        {/* Grade Block */}
        <div className="flex items-center justify-center">
          <OverallGradeBlock grade={player.overall_grade} readOnly />
        </div>

        {/* Expand Toggle */}
        <div
          className="absolute bottom-0 right-0 cursor-pointer text-white/20 hover:text-white transition"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Drawer */}
      {isExpanded && (
        <div className="relative z-10">
          <PlayerDrawer player={player} />
        </div>
      )}
    </div>
  );
};

export default PlayerRow;
