import React, { useRef, useEffect } from 'react';
import { formatPick } from '@/utils/architect/tradeHelpers';
import { getPickOptions } from '@/utils/architect/tradeMachine/pickOptions';
import { getTeamColors } from '@/utils/formatting';
import TeamLogo from '@/components/shared/TeamLogo';

const hexToRGBA = (hex, alpha) => {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const TradePickRow = ({
  pick,
  pickObj,
  teamId,
  otherTeams = [],
  rowKey,
  openMenu,
  setOpenMenu,
  onToggle,
  onEdit,
}) => {
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const key = rowKey || `${pick.year}-${pick.round}-${pick.via || ''}`;

  useEffect(() => {
    if (openMenu !== key) return undefined;
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
  }, [openMenu, key, setOpenMenu]);

  const exists = !!pickObj;
  const { primary } = getTeamColors(teamId);

  const rowStyle = exists ? { backgroundColor: hexToRGBA(primary, 0.6) } : {};

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
        exists ? '' : 'bg-white/10'
      }`}
      style={rowStyle}
    >
      <div className="flex items-center">
        <TeamLogo teamId={teamId} className="w-6 h-6 mr-2" />
        <div>
          <div>{formatPick(pickObj || pick)}</div>
          {exists && (
            <div className="w-[140px] text-white/50 mt-1 space-y-1">
              <select
                className="w-[140px] bg-black/30 p-1 rounded w-full"
                value={pickObj.protection || ''}
                onChange={(e) => onEdit(pick, 'protection', e.target.value)}
              >
                {getPickOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setOpenMenu(openMenu === key ? null : key)}
          className="text-blue-400 hover:underline"
        >
          •••
        </button>
        {openMenu === key && (
          <div
            ref={menuRef}
            className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[8rem]"
          >
            {otherTeams.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onToggle(pick);
                  onEdit(pick, 'toTeamId', t.id);
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-[#333]"
              >
                {`Trade to ${t.teamName}`}
              </button>
            ))}
            {exists && (
              <button
                onClick={() => {
                  onToggle(pick);
                  setOpenMenu(null);
                }}
                className="block w-full text-left px-3 py-1 hover:bg-[#333]"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
