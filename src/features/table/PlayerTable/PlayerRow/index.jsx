import React from 'react';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import ShootingProfileMini from '@/features/table/PlayerTable/PlayerRow/ShootingProfileMini';
import RolePill from '@/features/table/PlayerTable/PlayerRow/RolePill';
import OverallGradeBlock from '@/shared/components/ui/grades/OverallGradeBlock';
// PlayerDrawer lifted to parent
import TeamLogo from '@/shared/components/TeamLogo';
import { ChevronDown, ChevronUp } from 'lucide-react';
import AddToListButton from '@/features/lists/AddToListButton';
import { getCurrentSeasonYear, getYearsRemaining } from '@/shared/utils/contracts';

const PlayerRow = ({ player, isExpanded, onToggleExpand }) => {
  return (
    <div 
      className="w-full max-w-[1100px] mx-auto"
    >
      <div className="relative w-full border border-black h-[90px]">
        {/* Add Button - fixed small circle in top-right corner (overlay) */}
        <div className="absolute top-0.5 right-0 z-10">
          <AddToListButton player={player} />
        </div>

        <div className="w-full h-full bg-[#1e1e1e] flex items-center overflow-hidden relative rounded-sm">
          {/* Position */}
          <div className="h-full w-16 flex items-center">
            <div className="text-lg font-semibold text-white/50 w-full text-center tracking-wide uppercase">
              {player.formattedPosition || '—'}
            </div>
            <div className="h-full w-[2px] bg-neutral-950"></div>
          </div>

          {/* Player Image */}
          <div className="h-full w-20 bg-[#2a2a2a] overflow-hidden">
            <img
              src={(() => {
                // Use normalized headshot path for foreign players with accent marks
                if (player.headshotUrl) return player.headshotUrl;
                const playerId = player.bio?.playerId || player.id;
                if (!playerId) return '/assets/headshots/default.png';
                // Normalize special characters (e.g., kristaps_porzingis -> kristaps_porziņģis)
                const normalizedId = playerId
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase();
                return `/assets/headshots/${normalizedId}.png`;
              })()}
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
              <PlayerNameMini name={player.bio?.displayName || player.name} />
            </div>
            <div className="flex items-center gap-2">
              <TeamLogo
                teamAbbr={player.bio?.display?.team}
                className="w-6 h-6"
              />
              <div className="text-[14px] text-white/50 tracking-wide">
                {player.bio?.height
                  ? `${Math.floor(player.bio.height / 12)}-${player.bio.height % 12}`
                  : '—'}{' '}
                <span className="text-white/30">|</span>{' '}
                {player.bio?.weight || '—'} lbs
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
            {(() => {
              const CURRENT_YEAR = getCurrentSeasonYear();
              // Prioritize currentContractView (denormalized), fallback to primaryContract
              const contractView = player.currentContractView;
              const contractData =
                player.primaryContract ||
                (player.contracts ? Object.values(player.contracts)[0] : null);

              // Get free agent info from currentContractView or fallback
              const freeAgentYear =
                contractView?.freeAgentYear ||
                player.bio?.display?.freeAgentYear ||
                contractData?.freeAgency?.freeAgentYear;
              const freeAgentType =
                contractView?.freeAgentType ||
                player.bio?.display?.freeAgentType ||
                contractData?.freeAgency?.freeAgentType;

              // Get current salary from currentContractView or contractData
              let currentSalary = 0;
              if (contractView?.currentSalary) {
                currentSalary = contractView.currentSalary;
              } else if (
                contractView?.salaryByYear &&
                contractView.salaryByYear[CURRENT_YEAR]
              ) {
                currentSalary = contractView.salaryByYear[CURRENT_YEAR];
              } else if (contractData?.salariesByYear) {
                const salaryEntry = contractData.salariesByYear.find(
                  (s) =>
                    s.year === CURRENT_YEAR ||
                    s.season?.startsWith(String(CURRENT_YEAR))
                );
                currentSalary = salaryEntry?.salary ?? 0;
              }

              if (!freeAgentYear && currentSalary === 0) {
                return <div className="text-white/40">—</div>;
              }

              const yearsLeft = freeAgentYear
                ? getYearsRemaining(freeAgentYear, CURRENT_YEAR)
                : (contractView?.yearsRemaining ?? 0);
              const formattedSalary =
                currentSalary > 0
                  ? `$${(currentSalary / 1_000_000).toFixed(1)}M`
                  : '—';

              return (
                <>
                  <div>
                    <span className="text-white">{formattedSalary}</span>
                    {yearsLeft > 0 && (
                      <span className="text-white/40"> / {yearsLeft} YRS</span>
                    )}
                  </div>
                  {freeAgentYear && (
                    <div className="text-white/40">
                      {freeAgentType || 'UFA'} {freeAgentYear}
                    </div>
                  )}
                </>
              );
            })()}
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
            <OverallGradeBlock grade={player.overallGrade} readOnly />
          </div>

          {/* Expand Toggle */}
          <div
            className="absolute bottom-0 right-0 cursor-pointer text-white/20 hover:text-white transition"
            onClick={onToggleExpand}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerRow;
