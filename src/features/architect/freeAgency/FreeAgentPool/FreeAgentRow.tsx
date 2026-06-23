/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.tsx
 * PURPOSE: Authoritative row renderer for Free Agent Pool player selection and row actions.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-03-14: Migrated from JSX during TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import React, { useEffect, useRef } from 'react';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import { getPlayerProfileUrl } from '@/shared/utils/routing/playerRouteUtils';
import { TeamCodeMap, type TeamCode } from '@/constants/teamList';
import type { PlayerActionContext } from '@/features/architect/cockpit/playerActionContext';
import { getFreeAgentSigningContext } from './freeAgentSigningContext';
import type { FreeAgentRowProps } from './types';

function getTeamLogoId(teamCode: string | null | undefined): string {
  if (!teamCode || !(teamCode in TeamCodeMap)) {
    return 'default';
  }
  return TeamCodeMap[teamCode as TeamCode].id;
}

export const FreeAgentRow = ({
  entry,
  onSelect,
  isSelected = false,
  standardSigningActionLabel = 'Sign Free Agent (Preview)',
  standardSigningExposureClassification = 'preview-only',
  openMenuSelectionKey,
  setOpenMenuSelectionKey,
  onOpenContractModal,
  onPlayerAction,
  pinnedPlayerIds = [],
}: FreeAgentRowProps) => {
  const { surfacePlayer: player, freeAgent } = entry;
  const faPlayerId =
    entry.playerId ||
    (typeof player.id === 'string' ? player.id : null) ||
    (typeof player.player_id === 'string' ? player.player_id : null) ||
    null;
  const isTargetPinned = faPlayerId
    ? pinnedPlayerIds.includes(faPlayerId)
    : false;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (openMenuSelectionKey === entry.selectionKey) {
      const handleClick = (e: MouseEvent) => {
        const target = e.target as Node | null;
        if (
          menuRef.current &&
          target &&
          !menuRef.current.contains(target) &&
          buttonRef.current &&
          !buttonRef.current.contains(target)
        ) {
          setOpenMenuSelectionKey(null);
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
    return undefined;
  }, [entry.selectionKey, openMenuSelectionKey, setOpenMenuSelectionKey]);
  // Use displayName from player data - the authoritative source
  const formattedName =
    player.bio?.displayName ||
    player.displayName ||
    player.name ||
    freeAgent.name ||
    '';
  const nameParts = formattedName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const rawPosition = player.bio?.position || player.formattedPosition || '';
  const position = getPlayerPositionLabel(rawPosition) || '—';

  const age = player.bio?.age || player.age || null;

  const formatHeight = (inches: number | string | null | undefined) => {
    if (!inches || inches === 0) return null;
    const numericInches = Number(inches);
    if (Number.isNaN(numericInches)) return inches;
    return `${Math.floor(numericInches / 12)}-${numericInches % 12}`;
  };

  const height =
    formatHeight(player.bio?.height) || player.height || freeAgent.height || '—';
  const weight = player.bio?.weight || player.weight || freeAgent.weight || '—';
  const prevSalaryValue =
    freeAgent.previousSalary ?? player.previousSalary ?? null;
  const prevSalary =
    prevSalaryValue != null ? `$${prevSalaryValue.toLocaleString()}` : 'N/A';

  const faType =
    freeAgent.freeAgentType ||
    freeAgent.fa_type ||
    player.bio?.display?.freeAgentType ||
    player.freeAgentType ||
    player.fa_type ||
    'UFA';

  const getTagColor = (type?: string | null) => {
    if (type === 'UFA') return 'bg-blue-500/30 text-white/70';
    if (type === 'RFA') return 'bg-red-600/30 text-white/70';
    if (type === 'PO') return 'bg-green-600/30 text-white/70';
    if (type === 'TO') return 'bg-orange-500/30 text-white/70';
    return 'bg-gray-600 text-white/70';
  };

  // Display the previous year's salary in place of the asking price
  const asking = prevSalary;

  const signingContext = getFreeAgentSigningContext(entry);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(entry)}
      className={`mb-[3px] flex h-[45px] w-full cursor-pointer items-center overflow-visible rounded-sm border border-cockpit-edge pr-2 hover:bg-cockpit-raised focus:outline-none ${
        isSelected ? 'bg-cockpit-raised ring-1 ring-cockpit-info' : 'bg-cockpit-slab'
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
              getTeamLogoId(player.teamCode)
            }.png`}
            alt={player.teamCode}
            className="h-6 w-6 object-contain opacity-80"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>

      {/* Headshot */}
      <div className="flex h-[43px] w-[50px] items-center justify-center overflow-hidden bg-cockpit-inlay">
        <img
          src={
            player.headshotUrl ||
            `/assets/headshots/${
              player.bio?.playerId ||
              player.id ||
              player.player_id ||
              (player.name || freeAgent.name || '')
                .toLowerCase()
                .replace(/['.]/g, '')
                .replace(/\s+/g, '_')
            }.png`
          }
          onError={(e) => {
            e.currentTarget.onerror = null; e.currentTarget.src = '/assets/headshots/default.png';
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
        <div
          data-testid="free-agent-row-signing-context"
          className="ml-3 flex min-w-[220px] max-w-[290px] items-center justify-end gap-1.5 overflow-hidden whitespace-nowrap text-[10px]"
        >
          <span className="min-w-0 truncate rounded-sm border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-white/70">
            {signingContext.rightsLabel}
          </span>
          <span className="min-w-0 truncate rounded-sm border border-cyan-300/15 bg-cyan-400/[0.06] px-1.5 py-0.5 text-cyan-100/80">
            {signingContext.laneLabel}
          </span>
          {signingContext.capHoldLabel && (
            <span className="min-w-0 truncate rounded-sm border border-amber-300/15 bg-amber-400/[0.06] px-1.5 py-0.5 text-amber-100/80">
              {signingContext.capHoldLabel}
            </span>
          )}
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
            setOpenMenuSelectionKey(
              openMenuSelectionKey === entry.selectionKey
                ? null
                : entry.selectionKey
            );
          }}
          className="text-xs text-blue-400 hover:underline"
        >
          •••
        </button>
        {openMenuSelectionKey === entry.selectionKey && (
          <div
            ref={menuRef}
            className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[8rem]"
          >
            <button
              data-action-exposure-classification={
                standardSigningExposureClassification
              }
              onClick={() => {
                onOpenContractModal?.(entry);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-[#333]"
            >
              {standardSigningActionLabel}
            </button>
            <button
              onClick={() => {
                window.location.href = getPlayerProfileUrl(player);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-[#333]"
            >
              View Profile
            </button>
            {onPlayerAction && faPlayerId
              ? (() => {
                  const faContext: PlayerActionContext = {
                    playerId: faPlayerId,
                    playerLabel: formattedName || faPlayerId,
                    sourceRoom: 'fa',
                    isFreeAgentTarget: true,
                  };
                  return (
                    <>
                      <button
                        onClick={() => {
                          setOpenMenuSelectionKey(null);
                          onPlayerAction(
                            isTargetPinned ? 'unpin' : 'pin',
                            faContext
                          );
                        }}
                        className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                        data-testid={`free-agent-row-target-${entry.selectionKey}`}
                      >
                        {isTargetPinned ? 'Remove target' : 'Pin as target'}
                      </button>
                      <button
                        onClick={() => {
                          setOpenMenuSelectionKey(null);
                          onPlayerAction('compare-impact', faContext);
                        }}
                        className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                      >
                        Compare fit
                      </button>
                      <button
                        onClick={() => {
                          setOpenMenuSelectionKey(null);
                          onPlayerAction('guide-next-move', faContext);
                        }}
                        className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                      >
                        Guide path
                      </button>
                    </>
                  );
                })()
              : null}
          </div>
        )}
      </div>
    </div>
  );
};
