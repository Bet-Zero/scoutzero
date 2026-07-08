/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.tsx
 * PURPOSE: Authoritative selected-player card renderer for the Free Agent Pool surface.
 *          Compact horizontal decision card: identity, prior salary, signing
 *          context, and an always-visible Sign action sized for the selected
 *          deck at the 1280×720 review viewport.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-03-14: Migrated from JSX during TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86 execution.
 *  - 2026-07-07: BZE-222 selected-player pass — vertical trading card reworked
 *    into a horizontal deck card so every selected player keeps its Sign action
 *    on screen at 720p.
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
  isPreviewSigning = false,
  exposureClassification = 'preview-only',
}: FreeAgentCardProps) => {
  const { surfacePlayer: player } = entry;
  const formattedName =
    player.bio?.displayName || player.displayName || player.name || '';
  const nameParts = formattedName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const rawPosition = player.bio?.position || player.formattedPosition || '';

  const formatHeight = (inches: number | string | null | undefined) => {
    if (!inches || inches === 0) return null;
    const numericInches = Number(inches);
    if (Number.isNaN(numericInches)) return inches;
    return `${Math.floor(numericInches / 12)}-${numericInches % 12}`;
  };

  const height =
    formatHeight(player.bio?.height) ||
    player.height ||
    entry.freeAgent.height ||
    '—';
  const weight =
    player.bio?.weight || player.weight || entry.freeAgent.weight || '—';

  const prevSalaryValue = player.previousSalary || player.askingSalary;
  const prevSalary =
    prevSalaryValue != null ? `$${prevSalaryValue.toLocaleString()}` : 'N/A';

  const signingContext = getFreeAgentSigningContext(entry);

  return (
    <div className="flex h-[104px] items-stretch overflow-hidden rounded-md border border-white/10 bg-cockpit-slab transition-colors hover:border-white/30">
      {/* Headshot */}
      <div className="relative w-[84px] shrink-0 bg-cockpit-inlay">
        {player.teamCode && (
          <img
            src={`/assets/logos/${getTeamLogoId(player.teamCode)}.png`}
            className="absolute left-1 top-1 z-0 h-5 w-5 object-contain opacity-30"
            alt=""
          />
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
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/assets/headshots/default.png';
          }}
          alt={formattedName}
          className="relative z-1 h-full w-full object-cover"
        />
      </div>

      {/* Identity + signing context */}
      <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-2">
        <div className="min-w-0">
          <div className="truncate font-anton font-bold uppercase leading-none text-white text-[17px]">
            {firstName} <span className="font-light text-white/70">{lastName}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 whitespace-nowrap font-mono text-[10px] text-white/50">
            <span>{rawPosition || '—'}</span>
            <span className="text-white/25">|</span>
            <span>
              {height} · {weight !== '—' ? `${weight} lbs` : '—'}
            </span>
          </div>
        </div>
        <div
          data-testid="free-agent-card-signing-context"
          className="flex flex-wrap items-center gap-1.5 text-[10px] leading-tight"
        >
          <span className="rounded-sm border border-white/10 bg-black/25 px-1.5 py-0.5 text-white/75">
            {signingContext.rightsLabel}
          </span>
          <span className="rounded-sm border border-cyan-300/15 bg-cyan-400/[0.07] px-1.5 py-0.5 text-cyan-100/85">
            {signingContext.laneLabel}
          </span>
          {signingContext.capHoldLabel && (
            <span className="rounded-sm border border-amber-300/15 bg-amber-400/[0.06] px-1.5 py-0.5 text-amber-100/85">
              {signingContext.capHoldLabel}
            </span>
          )}
        </div>
      </div>

      {/* Prior salary + actions */}
      <div className="flex w-[150px] shrink-0 flex-col items-end justify-between border-l border-white/5 bg-black/20 px-2.5 py-2">
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0 text-left">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
              Previous Salary
            </div>
            <div className="font-mono text-xs text-white/90">{prevSalary}</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(entry.selectionKey);
            }}
            title="Remove from selection"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/70 transition-colors hover:bg-red-500/80 hover:text-white"
          >
            ✕
          </button>
        </div>
        <button
          data-action-exposure-classification={exposureClassification}
          onClick={() => onOpenContractModal(entry)}
          className="w-full rounded bg-green-600 py-1.5 text-[11px] font-bold uppercase leading-none tracking-wider text-white transition-colors hover:bg-green-500"
        >
          Sign Player
          {isPreviewSigning && (
            <span className="mt-0.5 block text-[8px] font-semibold normal-case tracking-normal text-white/85">
              (Preview)
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
