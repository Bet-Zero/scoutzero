/**
 * FILE: src/features/architect/tradeMachine/EntitlementPickRow.jsx
 * PURPOSE: Render a single draft entitlement row in Trade Machine with 3-dot menu.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0/11.1)
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 11.0 - Read-Only Entitlements View
 *  - 2026-01-22: Phase 11.1 - Added selection toggle for entitlement trading
 *  - 2026-01-30: Phase 12.3C - Added PickRow projection with protection/condition visibility
 *  - 2026-02-03: Phase 17 - Added destination dropdown for 3+ team trades
 *  - 2026-02-14: TM-ENTITLEMENTS-ADV-E1 - Added linked/residual indicators
 *  - 2026-02-20: Replaced checkbox with 3-dot menu for trade actions
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.0, 11.1, 12.3C)
 *  - Audit: docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md (Phase 17)
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

/**
 * EntitlementPickRow
 *
 * Renders a single entitlement as a pick row with 3-dot menu for actions.
 * Shows original team logo, year/round, protection details, and kind badge.
 *
 * @param {object} props
 * @param {object} props.entitlement - The EffectiveEntitlement object
 * @param {string} props.teamId - The team ID (holder of this entitlement)
 * @param {boolean} [props.isSelected=false] - Whether this entitlement is selected for trade
 * @param {Function} [props.onToggle] - Callback when entitlement trade is toggled
 * @param {Array} [props.otherTeams] - Array of other teams for trade destinations [{id, teamName, teamCode}]
 * @param {string} [props.currentToTeamId] - Currently selected destination team ID
 * @param {Function} [props.onSetDestination] - Callback when destination is changed (entitlementId, toTeamId)
 * @param {Function} [props.onEdit] - Callback when entitlement edit (modify) is requested
 * @param {Function} [props.onViewDetails] - Callback when view details is requested
 * @param {string|null} [props.openMenu] - ID of currently open menu (for coordinating with other rows)
 * @param {Function} [props.setOpenMenu] - Callback to set open menu ID
 * @param {boolean} [props.isVacuumMode=false] - Whether trade machine is in vacuum mode
 * @param {Function} [props.onRevertEdit] - Callback to revert one edited base entitlement
 * @param {Function} [props.onDeleteSessionPickRight] - Callback to delete one vacuum entitlement
 * @param {boolean} [props.incoming=false] - Whether this is an incoming entitlement (from another team)
 */
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
}) => {
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const entitlementId = entitlement?.id || entitlement?.entitlementId;

  // Click outside handler to close menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        openMenu === entitlementId &&
        !menuRef.current?.contains(e.target) &&
        !buttonRef.current?.contains(e.target)
      ) {
        setOpenMenu?.(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu, entitlementId, setOpenMenu]);

  if (!entitlement) return null;

  // Project entitlement to PickRow for richer display
  const pickRow = projectEntitlementToPickRow(entitlement, {
    teamCode: teamId,
    pickRulesById,
  });
  const pickRowLabel = getPickRowDisplayLabel(pickRow);
  const secondaryText = getPickRowSecondaryText(pickRow);

  const label = formatEntitlementLabel(entitlement);
  const kindTag = getEntitlementKindTag(entitlement.kind);
  const isEncumbered = entitlement.underlyingStatus === 'encumbered';
  const isPooled = entitlement.underlyingStatus === 'pooled';
  const isSessionOnly =
    entitlement?.__vacuumSessionOnly === true ||
    String(entitlementId || '').startsWith('vacuum:');
  const isEditedSession = entitlement?.__vacuumEdited === true;

  // Linked/residual indicators
  const linkedEntitlementIds = entitlement.linkedEntitlementIds;
  const hasLinkedEntitlements =
    Array.isArray(linkedEntitlementIds) && linkedEntitlementIds.length > 0;
  const linkedCount = hasLinkedEntitlements ? linkedEntitlementIds.length : 0;
  const isResidual = !!entitlement.residualOfEntitlementId;

  // DEBUG flags
  const DEBUG_PICKROW =
    import.meta?.env?.VITE_DEBUG_ENTITLEMENT_PICKROWS === 'true';

  // Handle trade to team action
  const handleTradeToTeam = (toTeamId) => {
    if (onToggle) {
      // If already selected to this team, act as cancel
      if (isSelected && currentToTeamId === toTeamId) {
        onToggle(entitlement); // Toggle off
      } else {
        // First toggle on if not selected
        if (!isSelected) {
          onToggle(entitlement);
        }
        // Then set destination
        if (onSetDestination) {
          onSetDestination(entitlementId, toTeamId);
        }
      }
    }
    setOpenMenu?.(null);
  };

  // Handle undo trade
  const handleUndoTrade = () => {
    if (onToggle && isSelected) {
      onToggle(entitlement); // Toggle off
    }
    setOpenMenu?.(null);
  };

  // Handle modify (edit)
  const handleModify = () => {
    if (onEdit) {
      onEdit(entitlement);
    }
    setOpenMenu?.(null);
  };

  // Handle view details
  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(entitlement);
    }
    setOpenMenu?.(null);
  };

  // Find which team this is being traded to (for display)
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
      {/* Main row content */}
      <div className="flex items-center justify-between">
        {/* Left side: Original team logo + Label and badges */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Original team logo (the team whose pick this originally was) */}
          <div className="flex-shrink-0">
            <TeamLogo teamId={pickRow.originalTeam} className="w-5 h-5" />
          </div>

          {/* Two-line layout with year/round and protection details */}
          <div className="flex flex-col min-w-0 flex-1">
            {/* Line 1: Year - Round N */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/90 truncate" title={label}>
                {pickRow.year} - Round {pickRow.round}
              </span>

              {/* Encumbered warning indicator */}
              {isEncumbered && (
                <span
                  className="flex items-center gap-0.5 text-amber-400 flex-shrink-0"
                  title="This pick is encumbered"
                >
                  <AlertTriangle size={12} />
                </span>
              )}

              {/* Pooled entitlement indicator */}
              {isPooled && (
                <span
                  className="flex items-center gap-0.5 text-purple-400 flex-shrink-0"
                  title="Pooled entitlement (multi-team)"
                >
                  <Layers size={12} />
                </span>
              )}

              {/* Linked entitlement indicator */}
              {hasLinkedEntitlements && (
                <span
                  className="flex items-center gap-0.5 text-cyan-400 flex-shrink-0"
                  title={`Linked to ${linkedCount} other entitlement${linkedCount > 1 ? 's' : ''}`}
                >
                  <Link2 size={12} />
                  <span className="text-[9px]">{linkedCount}</span>
                </span>
              )}

              {/* Residual entitlement indicator */}
              {isResidual && (
                <span
                  className="flex items-center gap-0.5 text-teal-400 flex-shrink-0"
                  title="Residual (depends on another entitlement's outcome)"
                >
                  <GitBranch size={12} />
                </span>
              )}

              {/* Debug tooltip when enabled */}
              {DEBUG_PICKROW && pickRow._debug && (
                <span
                  className="flex items-center text-blue-400/50 flex-shrink-0 cursor-help"
                  title={JSON.stringify(pickRow._debug.sourceHints, null, 2)}
                >
                  <Info size={10} />
                </span>
              )}
            </div>

            {/* Line 2: via ABC / via ABC - Protection details — hidden in compact mode */}
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

        {/* Right side: Trade indicator, badges, and menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Trading to indicator (when selected) */}
          {isSelected && tradingToTeam && (
            <span className="text-[10px] text-green-300 flex items-center gap-1">
              →{' '}
              {tradingToTeam.teamName ||
                tradingToTeam.teamCode ||
                tradingToTeam.id}
            </span>
          )}

          {/* Vacuum mode badges */}
          {!compact && isVacuumMode && isSessionOnly && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-900/30 text-purple-300 border border-purple-500/30">
              Session-only
            </span>
          )}
          {!compact && isVacuumMode && isEditedSession && !isSessionOnly && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-900/30 text-amber-300 border border-amber-500/30">
              Edited
            </span>
          )}

          {/* Kind badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${kindTag.colorClass}`}
          >
            {kindTag.label}
          </span>

          {/* 3-dot menu button */}
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

            {/* Dropdown menu */}
            {openMenu === entitlementId && (
              <div
                ref={menuRef}
                className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[10rem] max-w-[14rem] shadow-lg"
              >
                {/* Trade to team options (only when not incoming) */}
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

                {/* Undo Trade (when selected or incoming) */}
                {(isSelected || incoming) && (
                  <button
                    onClick={handleUndoTrade}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[#333]"
                  >
                    Undo Trade
                  </button>
                )}

                {/* Divider */}
                {(otherTeams.length > 0 || isSelected || incoming) && (
                  <div className="border-t border-white/10 my-1" />
                )}

                {/* Modify option (replaces pencil button) */}
                {onEdit && (
                  <button
                    onClick={handleModify}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[#333]"
                  >
                    Modify
                  </button>
                )}

                {/* View Details option */}
                <button
                  onClick={handleViewDetails}
                  className="block w-full text-left px-3 py-1.5 hover:bg-[#333]"
                >
                  View Details
                </button>

                {/* Vacuum mode actions */}
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
                        Revert Edit
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
                        Delete Session Pick
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
