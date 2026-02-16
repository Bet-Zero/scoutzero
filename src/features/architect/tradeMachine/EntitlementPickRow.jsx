/**
 * FILE: src/features/architect/tradeMachine/EntitlementPickRow.jsx
 * PURPOSE: Render a single draft entitlement row in Trade Machine with toggle selection.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0/11.1)
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 11.0 - Read-Only Entitlements View
 *  - 2026-01-22: Phase 11.1 - Added selection toggle for entitlement trading
 *  - 2026-01-30: Phase 12.3C - Added PickRow projection with protection/condition visibility
 *  - 2026-02-03: Phase 17 - Added destination dropdown for 3+ team trades
 *  - 2026-02-14: TM-ENTITLEMENTS-ADV-E1 - Added linked/residual indicators
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.0, 11.1, 12.3C)
 *  - Audit: docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md (Phase 17)
 */

import React from 'react';
import {
  formatEntitlementLabel,
  getEntitlementKindTag,
} from '@/features/architect/utils/entitlements/formatEntitlement';
import {
  projectEntitlementToPickRow,
  getPickRowDisplayLabel,
  getPickRowSecondaryText,
} from '@/features/architect/utils/entitlements/entitlementPickRowProjection';
import {
  AlertTriangle,
  Check,
  Info,
  Pencil,
  Layers,
  Link2,
  GitBranch,
} from 'lucide-react';

/**
 * EntitlementPickRow
 *
 * Renders a single entitlement as a selectable pick row.
 * Shows description, kind badge, encumbered warning, and selection checkbox.
 * Phase 17: Shows destination dropdown when in multi-team trade and selected.
 *
 * @param {object} props
 * @param {object} props.entitlement - The EffectiveEntitlement object
 * @param {string} props.teamId - The team ID (for potential styling)
 * @param {boolean} [props.isSelected=false] - Phase 11.1: Whether this entitlement is selected for trade
 * @param {Function} [props.onToggle] - Phase 11.1: Callback when entitlement is toggled
 * @param {Array} [props.otherTeams] - Phase 17: Array of other teams for destination dropdown [{id, name, teamCode}]
 * @param {string} [props.currentToTeamId] - Phase 17: Currently selected destination team ID
 * @param {Function} [props.onSetDestination] - Phase 17: Callback when destination is changed (entitlementId, toTeamId)
 * @param {Function} [props.onEdit] - TM-4: Callback when entitlement edit is requested
 * @param {boolean} [props.isVacuumMode=false] - Whether trade machine is in vacuum mode
 * @param {Function} [props.onRevertEdit] - Callback to revert one edited base entitlement
 * @param {Function} [props.onDeleteSessionPickRight] - Callback to delete one vacuum entitlement
 */
const EntitlementPickRow = ({
  entitlement,
  teamId,
  isSelected = false,
  onToggle,
  // Phase 12.3B: Pre-fetched pick rules for structured derivation
  pickRulesById = {},
  // Phase 17: Multi-team destination selection
  otherTeams = [],
  currentToTeamId = null,
  onSetDestination,
  onEdit,
  isVacuumMode = false,
  onRevertEdit,
  onDeleteSessionPickRight,
  compact = false,
}) => {
  if (!entitlement) return null;

  // Phase 12.3C: Project entitlement to PickRow for richer display
  // Phase 12.3B: Pass pickRulesById for structured rule-aware derivation
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
    String(entitlement?.id || entitlement?.entitlementId || '').startsWith(
      'vacuum:'
    );
  const isEditedSession = entitlement?.__vacuumEdited === true;

  // TM-ENTITLEMENTS-ADV-E1: Linked/residual indicators
  const linkedEntitlementIds = entitlement.linkedEntitlementIds;
  const hasLinkedEntitlements =
    Array.isArray(linkedEntitlementIds) && linkedEntitlementIds.length > 0;
  const linkedCount = hasLinkedEntitlements ? linkedEntitlementIds.length : 0;
  const isResidual = !!entitlement.residualOfEntitlementId;

  // Phase 17: Determine if destination dropdown should be shown
  const isMultiTeamTrade = otherTeams.length > 1;
  const showDestinationDropdown =
    isSelected && isMultiTeamTrade && onSetDestination;
  const needsDestination = isSelected && isMultiTeamTrade && !currentToTeamId;

  // DEBUG: entitlement identity + underlying slot (toggle with VITE_DEBUG_ENTITLEMENTS=true)
  const DEBUG_ENT = import.meta?.env?.VITE_DEBUG_ENTITLEMENTS === 'true';
  const DEBUG_PICKROW =
    import.meta?.env?.VITE_DEBUG_ENTITLEMENT_PICKROWS === 'true';
  if (DEBUG_ENT) {
    console.log('[ENT_ROW]', {
      teamId,
      id: entitlement.id,
      kind: entitlement.kind,
      seasonYear: entitlement.seasonYear,
      round: entitlement.round,
      underlyingPickId: entitlement.underlyingPickId,
      underlyingStatus: entitlement.underlyingStatus,
      description: entitlement.description,
      label,
      coveredByEntitlementIds: entitlement.coveredByEntitlementIds,
      pickRow,
      currentToTeamId,
      isMultiTeamTrade,
    });
  }

  // Phase 11.1: Handle row click to toggle selection
  const handleClick = () => {
    if (onToggle) {
      onToggle(entitlement);
    }
  };

  // Phase 17: Handle destination change
  const handleDestinationChange = (e) => {
    e.stopPropagation(); // Prevent row click
    const entitlementId = entitlement.id || entitlement.entitlementId;
    if (onSetDestination) {
      onSetDestination(entitlementId, e.target.value || null);
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(entitlement);
    }
  };

  const handleRevertEdit = (e) => {
    e.stopPropagation();
    if (onRevertEdit) {
      onRevertEdit(entitlement);
    }
  };

  const handleDeleteSessionPickRight = (e) => {
    e.stopPropagation();
    if (onDeleteSessionPickRight) {
      onDeleteSessionPickRight(entitlement);
    }
  };

  return (
    <div
      className={`flex flex-col px-3 py-2 rounded-md text-xs border transition-colors ${
        isSelected
          ? needsDestination
            ? 'bg-amber-900/30 border-amber-500/50' // Warning state: selected but no destination
            : 'bg-blue-900/40 border-blue-500/50'
          : 'bg-[#1c1c1c] border-white/10 hover:border-white/20'
      } ${onToggle ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
      role={onToggle ? 'button' : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') handleClick();
            }
          : undefined
      }
    >
      {/* Main row content */}
      <div className="flex items-center justify-between">
        {/* Left side: Checkbox + Label and badges */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Phase 11.1: Selection checkbox */}
          {onToggle && (
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                isSelected
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-white/30 bg-transparent'
              }`}
            >
              {isSelected && <Check size={12} className="text-white" />}
            </div>
          )}

          {/* Phase 12.3C: Two-line layout with year/round and protection details */}
          <div className="flex flex-col min-w-0 flex-1">
            {/* Line 1: Year Round — Label */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/90 truncate" title={label}>
                {pickRow.year} R{pickRow.round} — {pickRowLabel}
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

              {/* TM-6: Pooled entitlement indicator */}
              {isPooled && (
                <span
                  className="flex items-center gap-0.5 text-purple-400 flex-shrink-0"
                  title="Pooled entitlement (multi-team)"
                >
                  <Layers size={12} />
                </span>
              )}

              {/* TM-ENTITLEMENTS-ADV-E1: Linked entitlement indicator */}
              {hasLinkedEntitlements && (
                <span
                  className="flex items-center gap-0.5 text-cyan-400 flex-shrink-0"
                  title={`Linked to ${linkedCount} other entitlement${linkedCount > 1 ? 's' : ''}`}
                >
                  <Link2 size={12} />
                  <span className="text-[9px]">{linkedCount}</span>
                </span>
              )}

              {/* TM-ENTITLEMENTS-ADV-E1: Residual entitlement indicator */}
              {isResidual && (
                <span
                  className="flex items-center gap-0.5 text-teal-400 flex-shrink-0"
                  title="Residual (depends on another entitlement's outcome)"
                >
                  <GitBranch size={12} />
                </span>
              )}

              {/* Phase 12.3C: Debug tooltip when VITE_DEBUG_ENTITLEMENT_PICKROWS=true */}
              {DEBUG_PICKROW && pickRow._debug && (
                <span
                  className="flex items-center text-blue-400/50 flex-shrink-0 cursor-help"
                  title={JSON.stringify(pickRow._debug.sourceHints, null, 2)}
                >
                  <Info size={10} />
                </span>
              )}
            </div>

            {/* Line 2: Protection/conditions text (muted) — hidden in compact mode */}
            {!compact && secondaryText && (
              <span
                className="text-white/50 text-[10px] truncate"
                title={secondaryText}
              >
                {secondaryText}
              </span>
            )}
          </div>
        </div>

        {/* Right side: Kind badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
          {onEdit && (
            <button
              type="button"
              onClick={handleEdit}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white"
              aria-label="Edit entitlement"
              title="Edit entitlement"
            >
              <Pencil size={12} />
            </button>
          )}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${kindTag.colorClass}`}
          >
            {kindTag.label}
          </span>
        </div>
      </div>

      {isVacuumMode && (isEditedSession || isSessionOnly) && (
        <div
          className="mt-2 pt-2 border-t border-white/10 flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          {isEditedSession && !isSessionOnly && onRevertEdit && (
            <button
              type="button"
              className="text-[10px] text-amber-300 hover:text-amber-200 underline"
              onClick={handleRevertEdit}
            >
              Revert this edit
            </button>
          )}
          {isSessionOnly && onDeleteSessionPickRight && (
            <button
              type="button"
              className="text-[10px] text-red-300 hover:text-red-200 underline"
              onClick={handleDeleteSessionPickRight}
            >
              Delete this session pick right
            </button>
          )}
        </div>
      )}

      {/* Phase 17: Destination dropdown for multi-team trades */}
      {showDestinationDropdown && (
        <div
          className="mt-2 pt-2 border-t border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex items-center gap-2 text-[10px]">
            <span
              className={needsDestination ? 'text-amber-400' : 'text-white/60'}
            >
              Send to:
            </span>
            <select
              value={currentToTeamId || ''}
              onChange={handleDestinationChange}
              className={`flex-1 px-2 py-1 rounded text-xs bg-[#2a2a2a] border ${
                needsDestination
                  ? 'border-amber-500/50 text-amber-200'
                  : 'border-white/20 text-white'
              } focus:outline-none focus:border-blue-500`}
            >
              <option value="">Select destination...</option>
              {otherTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teamName || t.name || t.teamCode || t.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
};

export default EntitlementPickRow;
