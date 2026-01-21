/**
 * FILE: src/features/architect/tradeMachine/EntitlementPickRow.jsx
 * PURPOSE: Render a single draft entitlement as a read-only row in Trade Machine.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0)
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 11.0 - Read-Only Entitlements View
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.0)
 */

import React from 'react';
import {
  formatEntitlementLabel,
  getEntitlementKindTag,
} from '@/features/architect/utils/entitlements/formatEntitlement';
import { AlertTriangle } from 'lucide-react';

/**
 * EntitlementPickRow
 *
 * Renders a single entitlement as a read-only pick row.
 * Shows description, kind badge, and encumbered warning if applicable.
 *
 * @param {object} props
 * @param {object} props.entitlement - The EffectiveEntitlement object
 * @param {string} props.teamId - The team ID (for potential styling)
 */
const EntitlementPickRow = ({ entitlement, teamId }) => {
  if (!entitlement) return null;

  const label = formatEntitlementLabel(entitlement);
  const kindTag = getEntitlementKindTag(entitlement.kind);
  const isEncumbered = entitlement.underlyingStatus === 'encumbered';

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md text-xs bg-[#1c1c1c] border border-white/10 hover:border-white/20 transition-colors">
      {/* Left side: Label and badges */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Main description */}
        <span className="text-white/90 truncate" title={label}>
          {label}
        </span>

        {/* Encumbered warning indicator */}
        {isEncumbered && (
          <span
            className="flex items-center gap-0.5 text-amber-400"
            title="This pick is encumbered"
          >
            <AlertTriangle size={12} />
          </span>
        )}
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
