/**
 * FILE: src/features/architect/tradeMachine/EntitlementPickRow.jsx
 * PURPOSE: Render a single draft entitlement row in Trade Machine with toggle selection.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0/11.1)
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 11.0 - Read-Only Entitlements View
 *  - 2026-01-22: Phase 11.1 - Added selection toggle for entitlement trading
 *  - 2026-01-30: Phase 12.3C - Added PickRow projection with protection/condition visibility
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.0, 11.1, 12.3C)
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
import { AlertTriangle, Check, Info } from 'lucide-react';

/**
 * EntitlementPickRow
 *
 * Renders a single entitlement as a selectable pick row.
 * Shows description, kind badge, encumbered warning, and selection checkbox.
 *
 * @param {object} props
 * @param {object} props.entitlement - The EffectiveEntitlement object
 * @param {string} props.teamId - The team ID (for potential styling)
 * @param {boolean} [props.isSelected=false] - Phase 11.1: Whether this entitlement is selected for trade
 * @param {Function} [props.onToggle] - Phase 11.1: Callback when entitlement is toggled
 */
const EntitlementPickRow = ({
  entitlement,
  teamId,
  isSelected = false,
  onToggle,
}) => {
  if (!entitlement) return null;

  // Phase 12.3C: Project entitlement to PickRow for richer display
  const pickRow = projectEntitlementToPickRow(entitlement, {
    teamCode: teamId,
  });
  const pickRowLabel = getPickRowDisplayLabel(pickRow);
  const secondaryText = getPickRowSecondaryText(pickRow);

  const label = formatEntitlementLabel(entitlement);
  const kindTag = getEntitlementKindTag(entitlement.kind);
  const isEncumbered = entitlement.underlyingStatus === 'encumbered';

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
    });
  }

  // Phase 11.1: Handle row click to toggle selection
  const handleClick = () => {
    if (onToggle) {
      onToggle(entitlement);
    }
  };

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${
        isSelected
          ? 'bg-blue-900/40 border-blue-500/50'
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

          {/* Line 2: Protection/conditions text (muted) */}
          {secondaryText && (
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
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${kindTag.colorClass}`}
        >
          {kindTag.label}
        </span>
      </div>
    </div>
  );
};

export default EntitlementPickRow;
