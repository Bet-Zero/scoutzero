import React, { useEffect, useRef } from 'react';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import TeamLogo from '@/components/shared/TeamLogo';
import { getPlayerPositionLabel } from '@/utils/roles';
import { formatSalary } from '@/utils/formatting';
import { getYearsRemaining } from '@/utils/contracts';

const parseYear = (key) => {
  if (typeof key === 'number') return key;
  const match = String(key).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : NaN;
};

const TradePlayerRow = ({
  player,
  included,
  yearKey,
  otherTeams = [],
  playersMap = {},
  onSetPlayerTrade,
  openMenu,
  setOpenMenu,
  setContractPlayer,
  setTpePlayer,
}) => {
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (openMenu === player.name) {
      const handleClick = (e) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(e.target) &&
          buttonRef.current &&
          !buttonRef.current.contains(e.target)
        ) {
          setOpenMenu(null);
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
    return undefined;
  }, [openMenu, player.name, setOpenMenu]);
  const year = parseYear(yearKey);
  const salary =
    player.contract_clean?.salaries_by_year?.[yearKey]?.salary ||
    player.contract?.annual_salaries?.find((s) => parseYear(s.year) === year)
      ?.salary ||
    0;
  const faYear =
    player.contract_clean?.fa_year ?? player.fa_year ?? player.free_agency_year;
  const yearsLeft = getYearsRemaining(faYear, year);
  const hasSalary =
    !!player.contract_clean?.salaries_by_year?.[yearKey]?.salary;
  const isFreeAgent = !hasSalary;
  const formattedSalary = formatSalary(salary);

  const details = playersMap[player.name] || {};

  const headshot =
    player.headshotUrl ||
    player.headshot ||
    details.headshotUrl ||
    details.headshot ||
    `/assets/headshots/${player.id || player.player_id || details.player_id}.png`;

  const rawPosition =
    player.bio?.Position ||
    player.formattedPosition ||
    player.position ||
    player.pos ||
    details.bio?.Position ||
    details.formattedPosition ||
    details.position ||
    details.pos ||
    '';
  const position = getPlayerPositionLabel(rawPosition) || '—';

  const team =
    player.bio?.Team ||
    player.team ||
    player.teamId ||
    player.teamAbbr ||
    details.bio?.Team ||
    details.team ||
    details.teamId ||
    details.teamAbbr;
  const height =
    player.bio?.HT ||
    player.height ||
    player.height_ft_in ||
    details.bio?.HT ||
    details.height ||
    details.height_ft_in ||
    '—';
  const weight =
    player.bio?.WT ||
    player.weight ||
    player.weight_lbs ||
    details.bio?.WT ||
    details.weight ||
    details.weight_lbs ||
    '—';

  return (
    <div
      className={`w-full h-[68px] flex items-center border border-black rounded-sm pr-2 overflow-visible ${
        included ? 'bg-green-800/40' : 'bg-neutral-800'
      }`}
    >
      {/* Position Bar */}
      <div className="h-full w-10 flex flex-col items-center justify-center bg-neutral-800 text-white font-normal text-base font-mono relative">
        <div>{position}</div>
        <div className="absolute right-0 top-0 h-full w-[2px] bg-neutral-950"></div>
      </div>

      {/* Headshot */}
      <div className="h-full w-[70px] bg-[#2a2a2a] flex items-center justify-center overflow-hidden">
        <img
          src={headshot}
          onError={(e) => {
            e.target.src = '/assets/headshots/default.png';
          }}
          alt={player.display_name || details.display_name || player.name}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Main Info */}
      <div className="flex flex-col justify-center ml-3">
        <div className="h-[32px] flex items-center mb-2">
          <PlayerNameMini
            name={player.display_name || details.display_name || player.name}
            scale={0.85}
          />
        </div>
        <div className="flex items-center mt-[0px] mb-0 gap-2 text-white/50 text-[11px]">
          <TeamLogo teamAbbr={team} className="w-5 h-5" />
          <div>
            {height} <span className="text-white/30">|</span> {weight} lbs
          </div>
        </div>
      </div>

      {/* Contract Info */}
      <div className="ml-auto mr-4 flex flex-col items-end whitespace-nowrap">
        <div className="text-white font-semibold text-sm">
          {formattedSalary}
        </div>
        <div className="text-white/60 text-[11px] font-semibold">
          {yearsLeft} YRS
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-2 relative mr-1">
        <button
          ref={buttonRef}
          onClick={() =>
            setOpenMenu(openMenu === player.name ? null : player.name)
          }
          className="text-xs text-blue-400 hover:underline"
        >
          •••
        </button>
        {openMenu === player.name && (
          <div
            ref={menuRef}
            className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[8rem]"
          >
            {otherTeams.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onSetPlayerTrade(player, included ? 'keep' : 'trade');
                  if (!included && isFreeAgent) {
                    onSetPlayerTrade(player, 'signAndTrade', true);
                  }
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-[#333]"
              >
                {`${isFreeAgent ? 'S&T to' : 'Trade to'} ${t.teamName}`}
              </button>
            ))}
            <button
              onClick={() => {
                setContractPlayer(player);
                setOpenMenu(null);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-[#333]"
            >
              Modify Contract
            </button>
            <button
              onClick={() => {
                setTpePlayer(player);
                setOpenMenu(null);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-[#333]"
            >
              Trade Exception
            </button>
            <button
              onClick={() => {
                window.location.href = `/profiles?player=${player.id || player.player_id}`;
              }}
              className="block w-full text-left px-3 py-1 hover:bg-[#333]"
            >
              View Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradePlayerRow;
