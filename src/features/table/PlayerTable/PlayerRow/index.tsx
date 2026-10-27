import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerNameMini } from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import { ShootingProfileMini } from '@/features/table/PlayerTable/PlayerRow/ShootingProfileMini';
import { RolePill } from '@/features/table/PlayerTable/PlayerRow/RolePill';
import { OverallGradeBlock } from '@/shared/components/ui/grades/OverallGradeBlock';
// PlayerDrawer lifted to parent
import { TeamLogo } from '@/shared/components/TeamLogo';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AddToListButton } from '@/features/lists/AddToListButton';
import {
  getCurrentSeasonYear,
  getYearsRemaining,
} from '@/shared/utils/contracts';
import { getPlayerProfileUrl } from '@/shared/utils/routing/playerRouteUtils';
import type { SimplePlayer } from '@/shared/hooks/useSimplePlayerData';
import { useMediaQuery, PHONE_MEDIA_QUERY } from '@/shared/hooks/useMediaQuery';

type PlayerRowProps = {
  player: SimplePlayer;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Active table sort; picks the stat shown in the phone layout. */
  sortBy?: string;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getHeadshotSrc = (player: SimplePlayer) => {
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
};

const getContractSummary = (player: SimplePlayer) => {
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
        String(s.season ?? '').startsWith(String(CURRENT_YEAR))
    );
    currentSalary = toNumber(salaryEntry?.salary);
  }

  if (!freeAgentYear && currentSalary === 0) {
    return null;
  }

  const yearsLeft = freeAgentYear
    ? getYearsRemaining(toNumber(freeAgentYear), CURRENT_YEAR)
    : (contractView?.yearsRemaining ?? 0);
  const formattedSalary =
    currentSalary > 0
      ? `$${(currentSalary / 1_000_000).toFixed(1)}M`
      : '—';

  return { formattedSalary, yearsLeft, freeAgentYear, freeAgentType };
};

const formatHeight = (inches?: number | null) =>
  inches ? `${Math.floor(inches / 12)}-${inches % 12}` : '—';

// Phones show one stat: the one the table is sorted by, else PPG.
const PHONE_STAT_BY_SORT: Record<string, { label: string; field: 'PPG' | 'RPG' | 'APG' | 'age' }> = {
  REB: { label: 'RPG', field: 'RPG' },
  AST: { label: 'APG', field: 'APG' },
  age: { label: 'AGE', field: 'age' },
};
const DEFAULT_PHONE_STAT = { label: 'PPG', field: 'PPG' } as const;

const PlayerRow = ({
  player,
  isExpanded,
  onToggleExpand,
  sortBy,
}: PlayerRowProps) => {
  const navigate = useNavigate();

  const handleNameClick = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
  ) => {
    // Prevent row expand/collapse toggle
    event.stopPropagation();
    const profileUrl = getPlayerProfileUrl(player);
    navigate(profileUrl);
  };

  const isPhone = useMediaQuery(PHONE_MEDIA_QUERY);
  const contract = getContractSummary(player);
  const phoneStat = PHONE_STAT_BY_SORT[sortBy ?? ''] ?? DEFAULT_PHONE_STAT;
  const phoneStatValue = player[phoneStat.field];
  const displayName = player.bio?.displayName || player.name;

  const expandToggle = (
    <div
      className="absolute bottom-0 right-0 cursor-pointer text-white/20 hover:text-white transition"
      onClick={(e) => {
        // The phone row toggles on tap too; don't let this click toggle twice.
        e.stopPropagation();
        onToggleExpand();
      }}
      role="button"
      tabIndex={0}
      aria-label={isExpanded ? 'Collapse player details' : 'Expand player details'}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand();
        }
      }}
    >
      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={16} />}
    </div>
  );

  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div className="relative w-full border border-black h-[90px]">
        {/* Add Button - fixed small circle in top-right corner (overlay) */}
        <div className="absolute top-0.5 right-0 z-10">
          <AddToListButton player={player} />
        </div>

        {isPhone ? (
          // Phone layout: the desktop strip is ~1100px wide, so show the essentials
          // (name, team, contract, roles, grade, one stat); the drawer has the rest.
          // Tapping anywhere on the row opens the drawer; the chevron alone is too small a target.
          <div
            className="w-full h-full bg-[#1e1e1e] flex items-center overflow-hidden relative rounded-sm cursor-pointer"
            onClick={onToggleExpand}
          >
            <div className="relative h-full w-[64px] shrink-0 bg-[#2a2a2a] overflow-hidden">
              <img
                src={getHeadshotSrc(player)}
                onError={(e) => {
                  e.currentTarget.onerror = null; e.currentTarget.src = '/assets/headshots/default.png';
                }}
                alt={player.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] font-semibold text-white/80 text-center tracking-wide uppercase leading-4">
                {player.formattedPosition || '—'}
              </div>
            </div>

            <div className="flex-1 min-w-0 pl-2.5 pr-1 flex flex-col justify-center gap-1">
              <div
                className="truncate text-[15px] font-semibold leading-tight text-white cursor-pointer hover:underline"
                onClick={handleNameClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleNameClick(e);
                  }
                }}
              >
                {displayName}
              </div>
              <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-white/50">
                <TeamLogo
                  teamAbbr={player.bio?.display?.team}
                  className="w-4 h-4 shrink-0"
                />
                <span className="truncate">
                  {contract ? (
                    <>
                      <span className="text-white/80">{contract.formattedSalary}</span>
                      {contract.yearsLeft > 0 && ` / ${contract.yearsLeft} YRS`}
                    </>
                  ) : (
                    formatHeight(player.bio?.height)
                  )}
                </span>
              </div>
              <div className="flex gap-1 min-w-0 overflow-hidden">
                <span className="truncate rounded-full border border-purple-500 bg-purple-900/40 px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wide text-white/80">
                  {player.offenseRole || '—'}
                </span>
                {player.defenseRole && (
                  <span className="truncate rounded-full border border-blue-500 bg-blue-900/40 px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wide text-white/80">
                    {player.defenseRole}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 mr-7 flex flex-col items-center justify-center gap-1">
              <OverallGradeBlock grade={player.overallGrade} readOnly size="compact" />
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-[9px] text-gray-400">{phoneStat.label}</span>
                <span className="text-xs font-bold text-white">
                  {typeof phoneStatValue === 'number'
                    ? phoneStat.field === 'age'
                      ? Math.floor(phoneStatValue)
                      : phoneStatValue.toFixed(1)
                    : '—'}
                </span>
              </div>
            </div>

            {expandToggle}
          </div>
        ) : (
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
              src={getHeadshotSrc(player)}
              onError={(e) => {
                e.currentTarget.onerror = null; e.currentTarget.src = '/assets/headshots/default.png';
              }}
              alt={player.name}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Name + Team Info */}
          <div className="ml-3 flex flex-col justify-center w-[140px]">
            <div
              className="h-[50px] mb-2 cursor-pointer hover:underline"
              onClick={handleNameClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNameClick(e);
                }
              }}
            >
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
            {contract ? (
              <>
                <div>
                  <span className="text-white">{contract.formattedSalary}</span>
                  {contract.yearsLeft > 0 && (
                    <span className="text-white/40"> / {contract.yearsLeft} YRS</span>
                  )}
                </div>
                {contract.freeAgentYear && (
                  <div className="text-white/40">
                    {contract.freeAgentType || 'UFA'} {contract.freeAgentYear}
                  </div>
                )}
              </>
            ) : (
              <div className="text-white/40">—</div>
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
            <OverallGradeBlock grade={player.overallGrade} readOnly />
          </div>

          {expandToggle}
        </div>
        )}
      </div>
    </div>
  );
};

/**
 * Memoized PlayerRow for react-window.
 * Uses react-window's areEqual comparison pattern for optimal virtualization perf.
 * Row only rerenders when player data, isExpanded, or onToggleExpand changes.
 */
export const MemoizedPlayerRow = React.memo(PlayerRow, (prevProps, nextProps) => {
  // react-window areEqual pattern: return true if props are equal (skip rerender)
  return (
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.player === nextProps.player &&
    prevProps.onToggleExpand === nextProps.onToggleExpand &&
    prevProps.sortBy === nextProps.sortBy
  );
});

