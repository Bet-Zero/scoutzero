/**
 * FILE: src/features/architect/tradeMachine/EntitlementPicksList.jsx
 * PURPOSE: Render a list of entitlements for a team in Trade Machine (read-only).
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0)
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 11.0 - Read-Only Entitlements View
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.0)
 */

import React, { useMemo } from 'react';
import EntitlementPickRow from './EntitlementPickRow';
import { getKindSortPriority } from '@/features/architect/utils/entitlements/formatEntitlement';

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
 */
export const EntitlementPicksList = ({
  entitlements = [],
  teamId,
  showPooled = false,
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

  if (sortedEntitlements.length === 0) {
    return (
      <div>
        <h4 className="text-sm text-white/70 mb-1">
          Draft Assets (Entitlements)
        </h4>
        <div className="text-xs text-white/40 px-1">
          No draft entitlements available
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm text-white/70 mb-1">
        Draft Assets (Entitlements)
      </h4>
      <div className="space-y-3 max-h-[375px] overflow-y-auto pr-1">
        {Array.from(groupedByYear.entries()).map(([year, yearEntitlements]) => (
          <div key={year} className="space-y-1">
            {/* Year header */}
            <div className="text-[10px] text-white/50 uppercase tracking-wide px-1 pt-1">
              {year}
            </div>
            {/* Entitlement rows for this year */}
            {yearEntitlements.map((entitlement) => (
              <EntitlementPickRow
                key={
                  entitlement.id ||
                  `${entitlement.seasonYear}-${entitlement.round}-${entitlement.kind}`
                }
                entitlement={entitlement}
                teamId={teamId}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntitlementPicksList;
