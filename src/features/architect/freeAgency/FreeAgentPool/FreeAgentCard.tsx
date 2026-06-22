/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.tsx
 * PURPOSE: Authoritative selected-player card renderer for the Free Agent Pool surface.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-03-14: Migrated from JSX during TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import React from 'react';
import { TeamCodeMap, type TeamCode } from '@/constants/teamList';
import { getFreeAgentSigningContext } from './freeAgentSigningContext';
import type { FreeAgentCardProps } from './types';

function getTeamLogoId(teamCode: string | null | undefined): string {
  if (!teamCode || !(teamCode in TeamCodeMap)) {
    return 'default';
  }
  return TeamCodeMap[teamCode as TeamCode].id;
}

export const FreeAgentCard = ({
  entry,
  onOpenContractModal,
  onRemove,
}: FreeAgentCardProps) => {
  const { surfacePlayer: player } = entry;
  // Logic from FreeAgentRow to format name/headshot
  const formattedName =
    player.bio?.displayName || player.displayName || player.name || '';
  const nameParts = formattedName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const rawPosition = player.bio?.position || player.formattedPosition || '';
  // Simple mapping if utils not available, or just render raw.
  // Assuming getPlayerPositionLabel isn't strictly needed for the simplified card or we can key off raw.
  // Let's try to match row style but keep it simple.

  const formatHeight = (inches: number | string | null | undefined) => {
    if (!inches || inches === 0) return null;
    const numericInches = Number(inches);
    if (Number.isNaN(numericInches)) return null;
    return `${Math.floor(numericInches / 12)}-${numericInches % 12}`;
  };

  const height = formatHeight(player.bio?.height) || player.height || '—';
  const weight = player.bio?.weight || player.weight || '—';

  const prevSalaryValue = player.previousSalary || player.askingSalary;
  const prevSalary =
    prevSalaryValue != null ? `$${prevSalaryValue.toLocaleString()}` : 'N/A';

  const signingContext = getFreeAgentSigningContext(entry);
  const rights = signingContext.rightsLabel;

  return (
    <div className="w-[180px] bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden flex flex-col relative group hover:border-white/30 transition-colors">
      {/* Remove Button (top right) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(entry.selectionKey);
        }}
        className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/50 hover:bg-red-500/80 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>

      {/* Headshot Area */}
      <div className="h-[140px] w-full bg-[#151515] relative flex items-end justify-center pt-2">
        {/* Team Logo Background/Overlay */}
        {player.teamCode && (
          <div className="absolute top-2 left-2 opacity-20 z-0">
            <img
              src={`/assets/logos/${getTeamLogoId(player.teamCode)}.png`}
              className="h-8 w-8 object-contain"
              alt=""
            />
          </div>
        )}

        <img
          src={
            player.headshotUrl ||
            `/assets/headshots/${
              player.bio?.playerId ||
              player.id ||
              player.player_id ||
              (player.name || '')
                .toLowerCase()
                .replace(/['.]/g, '')
                .replace(/\s+/g, '_')
            }.png`
          }
          onError={(e) => {
            e.currentTarget.onerror = null; e.currentTarget.src = '/assets/headshots/default.png';
          }}
          alt={formattedName}
          className="h-full object-contain relative z-1"
        />

        {/* Name Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8">
          <div className="font-anton font-bold uppercase text-white text-lg leading-none">
            {firstName} <span className="text-white/70 block">{lastName}</span>
          </div>
          <div className="text-[10px] text-white/60 font-mono mt-1 flex justify-between">
            <span>{rawPosition}</span>
            <span>{rights !== 'None' ? rights : ''}</span>
          </div>
        </div>
      </div>

      {/* Info Body */}
      <div className="p-3 bg-[#1a1a1a] flex-1 flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs text-white/50 border-b border-white/5 pb-2">
          <span>
            {height} | {weight}lbs
          </span>
        </div>
        <div className="text-center py-1">
          <div className="text-[10px] uppercase text-white/40 font-semibold mb-0.5">
            Previous Salary
          </div>
          <div className="text-sm font-mono text-white/90">{prevSalary}</div>
        </div>

        <div
          data-testid="free-agent-card-signing-context"
          className="rounded-md border border-white/10 bg-black/20 px-2 py-2 text-[10px] leading-tight text-white/60"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="uppercase tracking-wider text-white/35">Rights</span>
            <span className="truncate text-white/85">{signingContext.rightsLabel}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="uppercase tracking-wider text-white/35">Lane</span>
            <span className="truncate text-cyan-100/90">
              {signingContext.laneLabel}
            </span>
          </div>
          {signingContext.capHoldLabel && (
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="uppercase tracking-wider text-white/35">Cap</span>
              <span className="truncate text-amber-100/90">
                {signingContext.capHoldLabel}
              </span>
            </div>
          )}
        </div>

        <button
          data-action-exposure-classification="preview-only"
          onClick={() => onOpenContractModal(entry)}
          className="w-full mt-auto bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider py-2 rounded transition-colors"
        >
          Sign Player (Preview)
        </button>
      </div>
    </div>
  );
};
