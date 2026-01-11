// src/features/architect/tradeMachine/TradePickRow.jsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { formatPick } from '@/features/architect/utils/tradeHelpers';
import { getPickOptions } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities';
import { getTeamColors } from '@/shared/utils/formatting';
import TeamLogo from '@/shared/components/TeamLogo';

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

/**
 * Handles swap toggle state changes.
 * - When enabled: sets swapType to 'best_of' if not already set
 * - When disabled: clears swapWithTeamId and swapType
 */
const handleSwapToggle = (checked, pick, pickObj, onEdit) => {
  onEdit(pick, 'isSwap', checked);
  if (checked) {
    // Default to best_of when enabling swap
    if (!pickObj.swapType) {
      onEdit(pick, 'swapType', 'best_of');
    }
  } else {
    // Clear swap-related fields when disabling
    onEdit(pick, 'swapWithTeamId', null);
    onEdit(pick, 'swapType', null);
  }
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
  const setOpen = useCallback(
    (val) => {
      if (isManaged) {
        setOpenMenu(val);
      } else {
        setLocalOpen(val);
      }
    },
    [isManaged, setOpenMenu, setLocalOpen]
  );

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
  }, [isOpen, setOpen]);

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
          teamId={pick?.originalTeam || pick?.originalTeamId || pick?.teamId || pick?.owner || teamId}
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
                  onChange={(e) => handleSwapToggle(e.target.checked, pick, pickObj, onEdit)}
                />
                Swap rights
              </label>

              {/* Swap type select - shown only when isSwap is true */}
              {pickObj.isSwap && (
                <select
                  className="w-full bg-black/30 p-1 rounded"
                  value={pickObj.swapType || 'best_of'}
                  onChange={(e) => onEdit(pick, 'swapType', e.target.value)}
                >
                  <option value="best_of">Best of (default)</option>
                  <option value="worst_of">Worst of</option>
                </select>
              )}

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
            className="absolute right-0 top-7 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[10rem] shadow-lg max-h-[400px] overflow-y-auto"
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

            {/* Protection options */}
            <div className="border-t border-white/10 px-3 py-1">
              <div className="text-white/50 text-[10px] uppercase mb-1">Protection</div>
              {getPickOptions().map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onEdit(pick, 'protection', opt.value || null);
                    setOpen(null);
                  }}
                  className={`block w-full text-left px-2 py-1.5 hover:bg-[#333] rounded ${
                    (pickObj || pick)?.protection === opt.value
                      ? 'bg-[#444] text-white'
                      : 'text-white/80'
                  }`}
                  role="menuitem"
                >
                  {opt.label || 'None'}
                </button>
              ))}
            </div>

            {/* Swap controls */}
            <div className="border-t border-white/10 px-3 py-1">
              <div className="text-white/50 text-[10px] uppercase mb-1">Swap Rights</div>
              <button
                onClick={() => {
                  const currentSwap = !!(pickObj || pick)?.isSwap;
                  handleSwapToggle(!currentSwap, pick, pickObj || pick, onEdit);
                  setOpen(null);
                }}
                className={`block w-full text-left px-2 py-1.5 hover:bg-[#333] rounded ${
                  (pickObj || pick)?.isSwap
                    ? 'bg-[#444] text-white'
                    : 'text-white/80'
                }`}
                role="menuitem"
              >
                {(pickObj || pick)?.isSwap ? '✓ Swap rights enabled' : 'Enable swap rights'}
              </button>
              {(pickObj || pick)?.isSwap && (
                <>
                  <div className="text-white/40 text-[10px] mt-1 mb-0.5 px-2">Swap Type</div>
                  <button
                    onClick={() => {
                      onEdit(pick, 'swapType', 'best_of');
                      setOpen(null);
                    }}
                    className={`block w-full text-left px-2 py-1.5 hover:bg-[#333] rounded ${
                      (pickObj || pick)?.swapType === 'best_of' || !(pickObj || pick)?.swapType
                        ? 'bg-[#444] text-white'
                        : 'text-white/80'
                    }`}
                    role="menuitem"
                  >
                    {(pickObj || pick)?.swapType === 'best_of' || !(pickObj || pick)?.swapType ? '✓ ' : ''}Best of
                  </button>
                  <button
                    onClick={() => {
                      onEdit(pick, 'swapType', 'worst_of');
                      setOpen(null);
                    }}
                    className={`block w-full text-left px-2 py-1.5 hover:bg-[#333] rounded ${
                      (pickObj || pick)?.swapType === 'worst_of'
                        ? 'bg-[#444] text-white'
                        : 'text-white/80'
                    }`}
                    role="menuitem"
                  >
                    {(pickObj || pick)?.swapType === 'worst_of' ? '✓ ' : ''}Worst of
                  </button>
                  {otherTeams.length > 0 && (
                    <>
                      <div className="text-white/40 text-[10px] mt-1 mb-0.5 px-2">Swap Partner</div>
                      <button
                        onClick={() => {
                          onEdit(pick, 'swapWithTeamId', null);
                          setOpen(null);
                        }}
                        className={`block w-full text-left px-2 py-1.5 hover:bg-[#333] rounded ${
                          !(pickObj || pick)?.swapWithTeamId
                            ? 'bg-[#444] text-white'
                            : 'text-white/80'
                        }`}
                        role="menuitem"
                      >
                        {!(pickObj || pick)?.swapWithTeamId ? '✓ ' : ''}None
                      </button>
                      {otherTeams.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            onEdit(pick, 'swapWithTeamId', t.id);
                            setOpen(null);
                          }}
                          className={`block w-full text-left px-2 py-1.5 hover:bg-[#333] rounded ${
                            (pickObj || pick)?.swapWithTeamId === t.id
                              ? 'bg-[#444] text-white'
                              : 'text-white/80'
                          }`}
                          role="menuitem"
                        >
                          {(pickObj || pick)?.swapWithTeamId === t.id ? '✓ ' : ''}{t.teamName}
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Send to team */}
            <div className="border-t border-white/10">
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
            </div>

            {/* Remove */}
            {exists && (
              <div className="border-t border-white/10">
                <button
                  onClick={() => {
                    onToggle(pick);
                    setOpen(null);
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-[#333] text-red-400"
                  role="menuitem"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TradePickRow;
