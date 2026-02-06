/**
 * FILE: src/features/architect/tradeMachine/EntitlementPicksList.jsx
 * PURPOSE: Render a list of entitlements for a team in Trade Machine (read-only).
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0)
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 11.0 - Read-Only Entitlements View
 *  - 2026-02-03: Phase 17 - Added multi-team destination routing support
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.0)
 *  - Audit: docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md (Phase 17)
 */

import React, { useMemo } from 'react';
import EntitlementPickRow from './EntitlementPickRow';
import { getKindSortPriority } from '@/features/architect/utils/entitlements/formatEntitlement';
import { EntitlementEditorCreateButton } from '@/features/architect/admin/EntitlementEditorCreateButton';

/**
 * EntitlementPicksList
 *
 * Renders a list of entitlements for a team.
 * Filters out pooled entitlements by default and sorts by year, round, then kind priority.
 *
 * @param {object} props
 * @param {Array} props.entitlements - Array of EffectiveEntitlement objects
 * @param {string} props.teamId - The team ID
 * @param {boolean} [props.showPooled=false] - Whether to show pooled entitlements
 * @param {Function} [props.onToggleEntitlement] - Phase 11.1: Callback when entitlement is toggled
 * @param {Array} [props.selectedEntitlementIds] - Phase 11.1: Array of selected entitlement IDs
 * @param {string} [props.emptyStateHint] - Phase 14: Optional hint to show in empty state
 * @param {Array} [props.otherTeams] - Phase 17: Array of other teams for destination dropdown
 * @param {Array} [props.entitlementsOut] - Phase 17: Current outgoing entitlements with toTeamId
 * @param {Function} [props.onSetDestination] - Phase 17: Callback when destination is changed
 * @param {Function} [props.onEditEntitlement] - TM-4: Callback when entitlement edit is requested
 * @param {Function} [props.onCreateEntitlement] - TM-7: Callback when entitlement create is requested
 */
export const EntitlementPicksList = ({
  entitlements = [],
  teamId,
  showPooled = false,
  // Phase 11.1: Selection support for entitlement trading
  onToggleEntitlement,
  selectedEntitlementIds = [],
  // Phase 12.3B: Pre-fetched pick rules for structured derivation
  pickRulesById = {},
  // Phase 14: Empty state hint for debugging
  emptyStateHint,
  // Phase 17: Multi-team destination routing
  otherTeams = [],
  entitlementsOut = [],
  onSetDestination,
  onEditEntitlement,
  // TM-7: Create entitlement callback
  onCreateEntitlement,
}) => {
  // Filter and sort entitlements
  const sortedEntitlements = useMemo(() => {
    if (!Array.isArray(entitlements) || entitlements.length === 0) {
      return [];
    }

    // Filter out pooled entitlements unless showPooled is true
    const filtered = showPooled
      ? entitlements
      : entitlements.filter((e) => e.underlyingStatus !== 'pooled');

    // Sort by:
    // 1) seasonYear (ascending)
    // 2) round (1 then 2)
    // 3) kind priority (pick_ownership, conveyance_right, swap_right)
    return [...filtered].sort((a, b) => {
      // Year ascending
      const yearA = a.seasonYear || 0;
      const yearB = b.seasonYear || 0;
      if (yearA !== yearB) return yearA - yearB;

      // Round ascending (1 before 2)
      const roundA = a.round || 0;
      const roundB = b.round || 0;
      if (roundA !== roundB) return roundA - roundB;

      // Kind priority
      const kindPriorityA = getKindSortPriority(a.kind);
      const kindPriorityB = getKindSortPriority(b.kind);
      return kindPriorityA - kindPriorityB;
    });
  }, [entitlements, showPooled]);

  // Group by year for visual grouping
  const groupedByYear = useMemo(() => {
    const groups = new Map();
    for (const entitlement of sortedEntitlements) {
      const year = entitlement.seasonYear || 'Unknown';
      if (!groups.has(year)) {
        groups.set(year, []);
      }
      groups.get(year).push(entitlement);
    }
    return groups;
  }, [sortedEntitlements]);

  // Phase 17: Build lookup for current toTeamId per entitlement
  const toTeamIdByEntitlement = useMemo(() => {
    const map = {};
    for (const e of entitlementsOut) {
      const id = e.id || e.entitlementId;
      if (id) {
        map[id] = e.toTeamId || null;
      }
    }
    return map;
  }, [entitlementsOut]);

  if (sortedEntitlements.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm text-white/70">
            Draft Assets (Entitlements)
          </h4>
          {onCreateEntitlement && (
            <EntitlementEditorCreateButton onClick={onCreateEntitlement} size="sm" />
          )}
        </div>
        <div className="text-xs text-white/40 px-1">
          No entitlements loaded.
          {emptyStateHint && (
            <span className="block mt-1 text-white/30 text-[10px]">
              {emptyStateHint}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm text-white/70">
          Draft Assets (Entitlements)
        </h4>
        {onCreateEntitlement && (
          <EntitlementEditorCreateButton onClick={onCreateEntitlement} size="sm" />
        )}
      </div>
      <div className="space-y-3 max-h-[375px] overflow-y-auto pr-1">
        {Array.from(groupedByYear.entries()).map(([year, yearEntitlements]) => (
          <div key={year} className="space-y-1">
            {/* Year header */}
            <div className="text-[10px] text-white/50 uppercase tracking-wide px-1 pt-1">
              {year}
            </div>
            {/* Entitlement rows for this year */}
            {yearEntitlements.map((entitlement) => {
              // Phase 11.1: Compute isSelected for this entitlement
              const entitlementId = entitlement.id || entitlement.entitlementId;
              const isSelected = selectedEntitlementIds.includes(entitlementId);

              return (
                <EntitlementPickRow
                  key={
                    entitlement.id ||
                    `${entitlement.seasonYear}-${entitlement.round}-${entitlement.kind}`
                  }
                  entitlement={entitlement}
                  teamId={teamId}
                  // Phase 11.1: Pass selection state and toggle handler
                  isSelected={isSelected}
                  onToggle={onToggleEntitlement}
                  // Phase 12.3B: Pass pick rules for structured derivation
                  pickRulesById={pickRulesById}
                  // Phase 17: Pass multi-team destination props
                  otherTeams={otherTeams}
                  currentToTeamId={toTeamIdByEntitlement[entitlementId]}
                  onSetDestination={onSetDestination}
                  onEdit={onEditEntitlement}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntitlementPicksList;
