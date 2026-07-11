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
import React, { useEffect, useRef, useState } from 'react';
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
  // The pool list is a scroll container, so a downward menu on the last
  // visible rows would clip. Flip upward when the space below is short.
  const [menuOpensUp, setMenuOpensUp] = useState(false);

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
      <div className="w-[45px] shrink-0 flex items-center justify-center text-cockpit-text-secondary text-sm font-semibold">
        {position}
      </div>

      {/* Team Logo */}
      <div className="w-[50px] shrink-0 flex items-center justify-center ml-1">
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

      {/* Headshot — a uniform silhouette sits behind every cell; a real photo
          loads on top and covers it, and a missing photo (review fixtures) just
          falls through to the same silhouette, so every no-photo row matches. */}
      <div className="relative flex h-[43px] w-[50px] shrink-0 items-center justify-center overflow-hidden bg-cockpit-inlay">
        <svg
          viewBox="0 0 50 43"
          className="absolute inset-0 h-full w-full text-cockpit-text-ghost"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="25" cy="15" r="9.5" />
          <path d="M7 43c0-10.5 8-16.5 18-16.5s18 6 18 16.5z" />
        </svg>
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
            e.currentTarget.style.display = 'none';
          }}
          alt={formattedName}
          className="relative h-full w-full object-cover"
        />
      </div>

      {/* Name + Rights */}
      <div className="flex min-w-0 items-center ml-3 flex-1 justify-between mr-2">
        <div
          className="flex min-w-0 flex-1 items-center text-white font-anton font-bold uppercase tracking-normal leading-none whitespace-nowrap"
          style={{ fontSize: '17px' }}
        >
          <span className="truncate">
            {firstName}{' '}
            <span className="text-cockpit-text-secondary font-light">{lastName}</span>
          </span>
          {age && (
            <span
              className="shrink-0 text-cockpit-text-muted font-light ml-2"
              style={{ fontSize: '12px' }}
            >
              ({age})
            </span>
          )}
        </div>
        <div
          data-testid="free-agent-row-signing-context"
          className="ml-3 flex max-w-[290px] shrink-0 items-center justify-end gap-1.5 overflow-hidden whitespace-nowrap text-[10px]"
        >
          <span className="min-w-0 truncate rounded-sm border border-cockpit-edge bg-cockpit-raised px-1.5 py-0.5 text-cockpit-text-secondary">
            {signingContext.rightsLabel}
          </span>
          {/* The signing-lane chip ("Bird rights path", "Option decision") is
              internal routing speak — the rights chip and the PO/TO column
              already say everything a GM needs (BZE-209). Lane data still
              drives signing logic; it just doesn't print here. */}
          {signingContext.capHoldLabel && (
            <span className="min-w-0 truncate rounded-sm border border-cockpit-watch/25 bg-cockpit-watch/10 px-1.5 py-0.5 text-cockpit-watch">
              {signingContext.capHoldLabel}
            </span>
          )}
        </div>
      </div>

      {/* Aligned Stats Block */}
      <div className="flex shrink-0 items-center justify-end text-cockpit-text-muted text-[13px] w-[290px] mr-3 whitespace-nowrap tabular-nums">
        {/* FA Type */}
        <span
          className={`w-[44px] text-center px-1.5 py-[2px] rounded text-[12px] font-semibold ${getTagColor(faType)}`}
        >
          {faType}
        </span>

        {/* Spacer between FA Type and Height/Weight */}
        <div className="ml-6 flex items-center gap-[8px]">
          <span className="w-[32px] text-right">{height}</span>
          <span className="text-cockpit-text-ghost">|</span>
          <span className="w-[56px] text-left">
            {weight !== '—' ? `${weight} lbs` : weight}
          </span>
        </div>

        {/* Spacer between Height/Weight and Salary */}
        <span className="ml-10 w-[78px] text-right">{asking}</span>
      </div>

      {/* Options */}
      <div className="flex shrink-0 items-center relative">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            const buttonRect = e.currentTarget.getBoundingClientRect();
            const scrollBoundary =
              e.currentTarget.closest('ul')?.getBoundingClientRect().bottom ??
              window.innerHeight;
            setMenuOpensUp(scrollBoundary - buttonRect.bottom < 160);
            setOpenMenuSelectionKey(
              openMenuSelectionKey === entry.selectionKey
                ? null
                : entry.selectionKey
            );
          }}
          className="text-xs text-cockpit-text-muted hover:text-cockpit-text-primary"
        >
          •••
        </button>
        {openMenuSelectionKey === entry.selectionKey && (
          <div
            ref={menuRef}
            className={`absolute right-0 ${menuOpensUp ? 'bottom-5' : 'top-5'} bg-cockpit-raised border border-cockpit-edge rounded z-20 text-xs min-w-[8rem]`}
          >
            <button
              data-action-exposure-classification={
                standardSigningExposureClassification
              }
              onClick={() => {
                onOpenContractModal?.(entry);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
            >
              {standardSigningActionLabel}
            </button>
            <button
              onClick={() => {
                window.location.href = getPlayerProfileUrl(player);
              }}
              className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
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
                        className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
                        data-testid={`free-agent-row-target-${entry.selectionKey}`}
                      >
                        {isTargetPinned ? 'Remove target' : 'Pin as target'}
                      </button>
                      <button
                        onClick={() => {
                          setOpenMenuSelectionKey(null);
                          onPlayerAction('compare-impact', faContext);
                        }}
                        className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
                      >
                        Compare fit
                      </button>
                      <button
                        onClick={() => {
                          setOpenMenuSelectionKey(null);
                          onPlayerAction('guide-next-move', faContext);
                        }}
                        className="block w-full text-left px-3 py-1 hover:bg-cockpit-edge"
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
