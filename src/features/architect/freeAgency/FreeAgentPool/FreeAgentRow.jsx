import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import { getPlayerProfileUrl } from '@/shared/utils/routing/playerRouteUtils';
import { TeamCodeMap } from '@/constants/teamList';

const FreeAgentRow = ({
  player = {},
  askInfo = {},
  onSelect,
  isSelected = false,
  openMenu,
  setOpenMenu,
  onSign,
}) => {
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (openMenu === askInfo.name) {
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
  }, [openMenu, askInfo.name, setOpenMenu]);
  // Use displayName from player data - the authoritative source
  const formattedName =
    player.bio?.displayName ||
    player.displayName ||
    player.name ||
    askInfo.name ||
    '';
  const nameParts = formattedName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const rawPosition = player.bio?.position || player.formattedPosition || '';
  const position = getPlayerPositionLabel(rawPosition) || '—';

  const age = player.bio?.age || player.age || null;

  const formatHeight = (inches) => {
    if (!inches || inches === 0) return null;
    if (isNaN(inches)) return inches; // Return as-is if not a number (e.g. "6-5")
    return `${Math.floor(inches / 12)}-${inches % 12}`;
  };

  const height =
    formatHeight(player.bio?.height) || player.height || askInfo.height || '—';
  const weight = player.bio?.weight || player.weight || askInfo.weight || '—';
  const prevSalaryValue =
    askInfo.previousSalary ?? player.previousSalary ?? null;
  const prevSalary =
    prevSalaryValue != null ? `$${prevSalaryValue.toLocaleString()}` : 'N/A';

  const faType =
    askInfo.freeAgentType ||
    askInfo.fa_type ||
    player.bio?.display?.freeAgentType ||
    player.freeAgentType ||
    player.fa_type ||
    'UFA';

  const getTagColor = (type) => {
    if (type === 'UFA') return 'bg-blue-500/30 text-white/70';
    if (type === 'RFA') return 'bg-red-600/30 text-white/70';
    if (type === 'PO') return 'bg-green-600/30 text-white/70';
    if (type === 'TO') return 'bg-orange-500/30 text-white/70';
    return 'bg-gray-600 text-white/70';
  };

  // Display the previous year's salary in place of the asking price
  const asking = prevSalary;

  const rights = askInfo.birdRights;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className={`w-full h-[45px] rounded-sm flex items-center border border-black mb-[3px] pr-2 overflow-visible hover:bg-neutral-700 cursor-pointer focus:outline-none ${
        isSelected ? 'bg-neutral-700 ring-1 ring-lakers' : 'bg-neutral-800'
      }`}
    >
      {/* Position */}
      <div className="w-[45px] flex items-center justify-center text-white/60 text-sm font-semibold">
        {position}
      </div>

      {/* Team Logo */}
      <div className="w-[50px] flex items-center justify-center ml-1">
        {player.teamCode && (
          <img
            src={`/assets/logos/${
              TeamCodeMap[player.teamCode]?.id || 'default'
            }.png`}
            alt={player.teamCode}
            className="h-6 w-6 object-contain opacity-80"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
      </div>

      {/* Headshot */}
      <div className="h-[43px] w-[50px] bg-[#2a2a2a] flex items-center justify-center overflow-hidden">
        <img
          src={
            player.headshotUrl ||
            `/assets/headshots/${
              player.bio?.playerId ||
              player.id ||
              player.player_id ||
              (player.name || askInfo.name || '')
                .toLowerCase()
                .replace(/['.]/g, '')
                .replace(/\s+/g, '_')
            }.png`
          }
          onError={(e) => {
            e.target.src = '/assets/headshots/default.png';
          }}
          alt={formattedName}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Name + Rights */}
      <div className="flex items-center ml-3 flex-1 justify-between mr-2">
        <div
          className="flex items-center text-white font-anton font-bold uppercase tracking-normal leading-none whitespace-nowrap overflow-visible"
          style={{ fontSize: '17px', maxWidth: '300px' }}
        >
          <span>
            {firstName}{' '}
            <span className="text-white/70 font-light">{lastName}</span>
          </span>
          {age && (
            <span
              className="text-white/50 font-light ml-2"
              style={{ fontSize: '12px' }}
            >
              ({age})
            </span>
          )}
        </div>
        <div className="flex items-center justify-end text-white/50 text-[13px] gap-2 whitespace-nowrap">
          <span>{rights}</span>
        </div>
      </div>

      {/* Aligned Stats Block */}
      <div className="flex items-center justify-end text-white/50 text-[13px] w-[290px] mr-3 whitespace-nowrap tabular-nums">
        {/* FA Type */}
        <span
          className={`w-[44px] text-center px-1.5 py-[2px] rounded text-[12px] font-semibold ${getTagColor(faType)}`}
        >
          {faType}
        </span>

        {/* Spacer between FA Type and Height/Weight */}
        <div className="ml-6 flex items-center gap-[8px]">
          <span className="w-[32px] text-right">{height}</span>
          <span className="text-white/30">|</span>
          <span className="w-[56px] text-left">
            {weight !== '—' ? `${weight} lbs` : weight}
          </span>
        </div>

        {/* Spacer between Height/Weight and Salary */}
        <span className="ml-10 w-[78px] text-right">{asking}</span>
      </div>

      {/* Options */}
      <div className="flex items-center relative">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenu(openMenu === askInfo.name ? null : askInfo.name);
          }}
          className="text-xs text-blue-400 hover:underline"
        >
          •••
        </button>
        {openMenu === askInfo.name && (
          <div
            ref={menuRef}
            className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[8rem]"
          >
            <button
              onClick={() => {
                onSign?.(askInfo);
                setOpenMenu(null);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-[#333]"
            >
              Sign Free Agent
            </button>
            <button
              onClick={() => {
                window.location.href = getPlayerProfileUrl(player);
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

FreeAgentRow.propTypes = {
  player: PropTypes.object,
  askInfo: PropTypes.object,
  onSelect: PropTypes.func,
  isSelected: PropTypes.bool,
  openMenu: PropTypes.string,
  setOpenMenu: PropTypes.func,
  onSign: PropTypes.func,
};

export default FreeAgentRow;
