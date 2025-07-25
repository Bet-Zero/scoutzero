import React, { useState, useRef, useEffect } from 'react';
import { formatPick } from '@/utils/architect/tradeHelpers';
import { getPickOptions } from '@/utils/architect/tradeMachine/pickOptions';
import { getTeamColors } from '@/utils/formatting';

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
  onToggle,
  onEdit,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const exists = !!pickObj;
  const { primary } = getTeamColors(teamId);

  const rowStyle = exists ? { backgroundColor: hexToRGBA(primary, 0.6) } : {};

  return (
    <div
      className={`flex items-start justify-between px-3 py-1 rounded-md text-xs transition-colors ${
        exists ? '' : 'bg-white/10'
      }`}
      style={rowStyle}
    >
      <div>
        <div>{formatPick(pickObj || pick)}</div>
        {exists && (
          <div className="text-white/50 mt-1 space-y-1">
            <select
              className="bg-black/30 p-1 rounded w-full"
              value={pickObj.protection || ''}
              onChange={(e) => onEdit(pick, 'protection', e.target.value)}
            >
              {getPickOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              className="bg-black/30 p-1 rounded w-full"
              value={pickObj.note || ''}
              placeholder="Note"
              onChange={(e) => onEdit(pick, 'note', e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="relative">
        {!exists ? (
          <button
            onClick={() => onToggle(pick)}
            className="text-blue-400 hover:underline"
          >
            •••
          </button>
        ) : (
          <>
            <button
              ref={buttonRef}
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-blue-400 hover:underline"
            >
              •••
            </button>
            {menuOpen && (
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
                      setMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                  >
                    {`Trade to ${t.teamName}`}
                  </button>
                ))}
                <button
                  onClick={() => {
                    onToggle(pick);
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                >
                  Remove
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
