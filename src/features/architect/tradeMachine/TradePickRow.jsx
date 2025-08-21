// src/features/architect/tradeMachine/TradePickRow.jsx

import React, { useRef, useEffect, useState } from 'react';
import { formatPick } from '@/utils/architect/tradeHelpers';
import { getPickOptions } from '@/utils/architect/tradeMachine/utils/pickOptions';
import { getTeamColors } from '@/utils/formatting';
import TeamLogo from '@/components/shared/TeamLogo';

/**
 * Utility: #RRGGBB -> rgba(r,g,b,a)
 */
const hexToRGBA = (hex, alpha) => {
  if (!hex) return `rgba(255,255,255,${alpha ?? 0.08})`;
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha ?? 0.08})`;
};

function TradePickRow({
  pick,
  pickObj,
  teamId,
  otherTeams = [],
  onToggle,
  onEdit,
  openMenu,
  setOpenMenu,
  menuKey,
}) {
  const exists = !!pickObj;
  const { primary } = getTeamColors(teamId) || {};
  const rowStyle = exists ? { backgroundColor: hexToRGBA(primary, 0.12) } : {};
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // Generate a stable key if parent didn't supply one
  const autoKey =
    menuKey ||
    `${teamId || 't'}-${pick?.year || 'y'}-${pick?.round || 'r'}-${
      pick?.originalTeamId || pick?.teamId || 'o'
    }`;

  // Local fallback menu state if parent doesn't manage it
  const [localOpen, setLocalOpen] = useState(null);
  const isManaged =
    typeof openMenu !== 'undefined' && typeof setOpenMenu === 'function';
  const isOpen = isManaged ? openMenu === autoKey : localOpen === autoKey;
  const setOpen = (val) => (isManaged ? setOpenMenu(val) : setLocalOpen(val));

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!isOpen) return;
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
        exists ? '' : 'bg-white/10'
      }`}
      style={rowStyle}
    >
      {/* Left: logo + label + controls */}
      <div className="flex items-center gap-2">
        <TeamLogo
          teamId={pick?.originalTeamId || pick?.teamId || teamId}
          className="w-4 h-4"
        />
        <div className="flex flex-col">
          <div className="text-white/90">
            {formatPick(pickObj || pick)}
            {!exists && (
              <span className="ml-2 italic text-white/40">(not selected)</span>
            )}
          </div>

          {exists && (
            <div className="w-[160px] text-white/60 mt-1 space-y-1">
              {/* Protection select */}
              <select
                className="w-full bg-black/30 p-1 rounded"
                value={pickObj.protection || ''}
                onChange={(e) => onEdit(pick, 'protection', e.target.value)}
              >
                {getPickOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Swap rights toggle */}
              <label className="flex items-center gap-1 text-white/80 select-none">
                <input
                  type="checkbox"
                  checked={!!pickObj.isSwap}
                  onChange={(e) => onEdit(pick, 'isSwap', e.target.checked)}
                />
                Swap rights
              </label>

              {/* Swap partner select */}
              {pickObj.isSwap && (
                <select
                  className="w-full bg-black/30 p-1 rounded"
                  value={pickObj.swapWithTeamId || ''}
                  onChange={(e) =>
                    onEdit(pick, 'swapWithTeamId', e.target.value)
                  }
                >
                  <option value="">Choose swap partner…</option>
                  {otherTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teamName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: actions menu */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setOpen(isOpen ? null : autoKey)}
          className="text-blue-400 hover:underline px-2 py-1"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          •••
        </button>

        {isOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-7 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[10rem] shadow-lg"
            role="menu"
          >
            {/* Undo destination */}
            {exists && pickObj?.toTeamId && (
              <button
                onClick={() => {
                  onEdit(pick, 'toTeamId', null);
                  setOpen(null);
                }}
                className="block w-full text-left px-3 py-2 hover:bg-[#333]"
                role="menuitem"
              >
                Undo trade destination
              </button>
            )}

            {/* Send to team */}
            {otherTeams.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onToggle(pick);
                  onEdit(pick, 'toTeamId', t.id);
                  setOpen(null);
                }}
                className="block w-full text-left px-3 py-2 hover:bg-[#333]"
                role="menuitem"
              >
                {`Trade to ${t.teamName}`}
              </button>
            ))}

            {/* Remove */}
            {exists && (
              <button
                onClick={() => {
                  onToggle(pick);
                  setOpen(null);
                }}
                className="block w-full text-left px-3 py-2 hover:bg-[#333]"
                role="menuitem"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TradePickRow;
