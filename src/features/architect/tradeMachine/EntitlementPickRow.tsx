/**
 * FILE: src/features/architect/tradeMachine/EntitlementPickRow.tsx
 * PURPOSE: Render a single draft entitlement row in Trade Machine with 3-dot menu.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0/11.1)
 */

import React, { useEffect, useRef } from 'react';
import {
  formatEntitlementLabel,
  getEntitlementKindTag,
} from '@/features/architect/utils/entitlements/formatEntitlement';
import {
  projectEntitlementToPickRow,
  getPickRowDisplayLabel,
  getPickRowSecondaryText,
} from '@/features/architect/utils/entitlements/entitlementPickRowProjection';
import { AlertTriangle, Info, Layers, Link2, GitBranch } from 'lucide-react';
import TeamLogo from '@/shared/components/TeamLogo';

type EntitlementLike = {
  id?: string | number;
  entitlementId?: string | number;
  kind?: string;
  seasonYear?: number;
  round?: number;
  underlyingStatus?: string;
  linkedEntitlementIds?: Array<string | number>;
  residualOfEntitlementId?: string | number | null;
  __vacuumSessionOnly?: boolean;
  __vacuumEdited?: boolean;
  [key: string]: unknown;
};

type TeamOptionLike = {
  id?: string;
  teamName?: string;
  teamCode?: string;
  [key: string]: unknown;
};

type PickRowLike = {
  originalTeam?: string;
  year?: string | number;
  round?: string | number;
  _debug?: {
    sourceHints?: unknown;
  };
  [key: string]: unknown;
};

interface EntitlementPickRowProps {
  entitlement: EntitlementLike;
  teamId: string;
  isSelected?: boolean;
  onToggle?: ((entitlement: EntitlementLike) => void) | null;
  pickRulesById?: Record<string, unknown>;
  otherTeams?: TeamOptionLike[];
  currentToTeamId?: string | null;
  onSetDestination?: ((
    entitlementId: string | number | undefined,
    toTeamId: string | undefined
  ) => void) | null;
  onEdit?: ((entitlement: EntitlementLike) => void) | null;
  onViewDetails?: ((entitlement: EntitlementLike) => void) | null;
  openMenu?: string | number | null;
  setOpenMenu?: ((menuId: string | number | null) => void) | null;
  isVacuumMode?: boolean;
  onRevertEdit?: ((entitlement: EntitlementLike) => void) | null;
  onDeleteSessionPickRight?: ((entitlement: EntitlementLike) => void) | null;
  compact?: boolean;
  incoming?: boolean;
}

const EntitlementPickRow = ({
  entitlement,
  teamId,
  isSelected = false,
  onToggle,
  pickRulesById = {},
  otherTeams = [],
  currentToTeamId = null,
  onSetDestination,
  onEdit,
  onViewDetails,
  openMenu = null,
  setOpenMenu,
  isVacuumMode = false,
  onRevertEdit,
  onDeleteSessionPickRight,
  compact = false,
  incoming = false,
}: EntitlementPickRowProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const entitlementId = entitlement?.id || entitlement?.entitlementId;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        openMenu === entitlementId &&
        !menuRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpenMenu?.(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu, entitlementId, setOpenMenu]);

  if (!entitlement) return null;

  const pickRow = projectEntitlementToPickRow(entitlement as never, {
    teamCode: teamId,
    pickRulesById,
  } as never) as PickRowLike;
  const pickRowLabel = getPickRowDisplayLabel(pickRow as never);
  const secondaryText = getPickRowSecondaryText(pickRow as never);

  const label = formatEntitlementLabel(entitlement as never);
  const kindTag = getEntitlementKindTag(entitlement.kind as never);
  const isEncumbered = entitlement.underlyingStatus === 'encumbered';
  const isPooled = entitlement.underlyingStatus === 'pooled';
  const isSessionOnly =
    entitlement?.__vacuumSessionOnly === true ||
    String(entitlementId || '').startsWith('vacuum:');
  const isEditedSession = entitlement?.__vacuumEdited === true;

  const linkedEntitlementIds = entitlement.linkedEntitlementIds;
  const hasLinkedEntitlements =
    Array.isArray(linkedEntitlementIds) && linkedEntitlementIds.length > 0;
  const linkedCount = hasLinkedEntitlements ? linkedEntitlementIds.length : 0;
  const isResidual = !!entitlement.residualOfEntitlementId;

  const DEBUG_PICKROW =
    import.meta?.env?.VITE_DEBUG_ENTITLEMENT_PICKROWS === 'true';

  const handleTradeToTeam = (toTeamId?: string) => {
    if (onToggle) {
      if (isSelected && currentToTeamId === toTeamId) {
        onToggle(entitlement);
      } else {
        if (!isSelected) {
          onToggle(entitlement);
        }
        if (onSetDestination) {
          onSetDestination(entitlementId, toTeamId);
        }
      }
    }
    setOpenMenu?.(null);
  };

  const handleUndoTrade = () => {
    if (onToggle && isSelected) {
      onToggle(entitlement);
    }
    setOpenMenu?.(null);
  };

  const handleModify = () => {
    if (onEdit) {
      onEdit(entitlement);
    }
    setOpenMenu?.(null);
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(entitlement);
    }
    setOpenMenu?.(null);
  };

  const tradingToTeam = otherTeams.find((t) => t.id === currentToTeamId);

  return (
    <div
      className={`flex flex-col px-3 py-2 rounded-md text-xs border transition-colors ${
        isSelected
          ? 'bg-green-800/40 border-green-500/50'
          : incoming
            ? 'bg-neutral-700 border-white/10'
            : 'bg-[#1c1c1c] border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <TeamLogo teamId={pickRow.originalTeam} className="w-5 h-5" />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-white/90 truncate" title={label}>
                {pickRow.year} - Round {pickRow.round}
              </span>

              {isEncumbered && (
                <span
                  className="flex items-center gap-0.5 text-amber-400 flex-shrink-0"
                  title="This pick is encumbered"
                >
                  <AlertTriangle size={12} />
                </span>
              )}

              {isPooled && (
                <span
                  className="flex items-center gap-0.5 text-purple-400 flex-shrink-0"
                  title="Pooled entitlement (multi-team)"
                >
                  <Layers size={12} />
                </span>
              )}

              {hasLinkedEntitlements && (
                <span
                  className="flex items-center gap-0.5 text-cyan-400 flex-shrink-0"
                  title={`Linked to ${linkedCount} other entitlement${linkedCount > 1 ? 's' : ''}`}
                >
                  <Link2 size={12} />
                  <span className="text-[9px]">{linkedCount}</span>
                </span>
              )}

              {isResidual && (
                <span
                  className="flex items-center gap-0.5 text-teal-400 flex-shrink-0"
                  title="Residual (depends on another entitlement's outcome)"
                >
                  <GitBranch size={12} />
                </span>
              )}

              {DEBUG_PICKROW && pickRow._debug && (
                <span
                  className="flex items-center text-blue-400/50 flex-shrink-0 cursor-help"
                  title={JSON.stringify(pickRow._debug.sourceHints, null, 2)}
                >
                  <Info size={10} />
                </span>
              )}
            </div>

            {!compact && (pickRowLabel || secondaryText) && (
              <span
                className="text-white/50 text-[10px] truncate"
                title={[pickRowLabel, secondaryText]
                  .filter(Boolean)
                  .join(' - ')}
              >
                {pickRowLabel && pickRowLabel.startsWith('via ')
                  ? secondaryText
                    ? `${pickRowLabel} - ${secondaryText}`
                    : pickRowLabel
                  : secondaryText || ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isSelected && tradingToTeam && (
            <span className="text-[10px] text-green-300 flex items-center gap-1">
              →{' '}
              {tradingToTeam.teamName ||
                tradingToTeam.teamCode ||
                tradingToTeam.id}
            </span>
          )}

          {!compact && isVacuumMode && isSessionOnly && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-900/30 text-purple-300 border border-purple-500/30">
              Session-only
            </span>
          )}
          {!compact && isVacuumMode && isEditedSession && !isSessionOnly && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-900/30 text-amber-300 border border-amber-500/30">
              Edited (this session)
            </span>
          )}

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${kindTag.colorClass}`}
          >
            {kindTag.label}
          </span>

          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() =>
                setOpenMenu?.(openMenu === entitlementId ? null : entitlementId)
              }
              className="text-xs text-blue-400 hover:underline px-1"
            >
              •••
            </button>

            {openMenu === entitlementId && (
              <div
                ref={menuRef}
                className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[10rem] max-w-[14rem] shadow-lg"
              >
                {!incoming &&
                  otherTeams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTradeToTeam(t.id)}
                      className="block w-full text-left px-3 py-1.5 hover:bg-[#333] truncate"
                    >
                      {isSelected && currentToTeamId === t.id
                        ? 'Cancel Trade'
                        : `Trade to ${t.teamName || t.teamCode || t.id}`}
                    </button>
                  ))}

                {(isSelected || incoming) && (
                  <button
                    onClick={handleUndoTrade}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[#333]"
                  >
                    Undo Trade
                  </button>
                )}

                {(otherTeams.length > 0 || isSelected || incoming) && (
                  <div className="border-t border-white/10 my-1" />
                )}

                {onEdit && (
                  <button
                    onClick={handleModify}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[#333]"
                  >
                    Modify
                  </button>
                )}

                <button
                  onClick={handleViewDetails}
                  className="block w-full text-left px-3 py-1.5 hover:bg-[#333]"
                >
                  View Details
                </button>

                {isVacuumMode && (isEditedSession || isSessionOnly) && (
                  <>
                    <div className="border-t border-white/10 my-1" />
                    {isEditedSession && !isSessionOnly && onRevertEdit && (
                      <button
                        onClick={() => {
                          onRevertEdit(entitlement);
                          setOpenMenu?.(null);
                        }}
                        className="block w-full text-left px-3 py-1.5 hover:bg-[#333] text-amber-300"
                      >
                        Revert this edit
                      </button>
                    )}
                    {isSessionOnly && onDeleteSessionPickRight && (
                      <button
                        onClick={() => {
                          onDeleteSessionPickRight(entitlement);
                          setOpenMenu?.(null);
                        }}
                        className="block w-full text-left px-3 py-1.5 hover:bg-[#333] text-red-300"
                      >
                        Delete this session pick right
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntitlementPickRow;
