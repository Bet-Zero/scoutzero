/**
 * FILE: src/features/architect/tradeMachine/utils/entitlementWarnings.ts
 * PURPOSE: Compute non-blocking warnings for entitlement trades
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.2, E67)
 *
 * HISTORY:
 *  - 2026-01-22: Created for Phase 11.2 - Entitlement UX + Warnings
 *  - 2026-02-14: TM-ENTITLEMENTS-ADV-E1 - Added W1 (linked package), W2 (swap conflict)
 *  - 2026-03-12: E67 - Migrated to TypeScript authority with JS shim compatibility
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.2)
 *  - Preflight: docs/team-scrape/PST_PHASE_11_2_ENTITLEMENT_UX_WARNINGS_PREFLIGHT_RETURN_PACKAGE.md
 */

type EntitlementBadge = {
  label: string;
  colorClass: string;
};

type WarningEntitlementLike = {
  id?: string | null;
  entitlementId?: string | null;
  kind?: string | null;
  underlyingStatus?: string | null;
  coveredByEntitlementIds?: string[] | null;
  linkedEntitlementIds?: string[] | null;
  swapControllerPickId?: string | null;
  underlyingPickId?: string | null;
};

/**
 * Compute non-blocking warnings for entitlements being traded.
 *
 * Warning A: Encumbered pick_ownership traded without linked swap_right
 * Warning W1: Linked entitlements not all included in trade (linkedEntitlementIds)
 * Warning W2: Swap uses a controller pick that is also moving outbound
 *
 * @param {Array} entitlementsOut - Array of entitlement objects being traded by one team
 * @param {Array} [allTeamsEntitlementsOut] - Optional: all entitlements moving out across all teams (for W1)
 * @returns {Array<string>} - Array of warning message strings (deduped)
 */
export function computeEntitlementWarnings(
  entitlementsOut: WarningEntitlementLike[] | null | undefined,
  allTeamsEntitlementsOut: WarningEntitlementLike[] | null = null
): string[] {
  if (!Array.isArray(entitlementsOut) || entitlementsOut.length === 0) {
    return [];
  }

  const warnings: string[] = [];
  const outgoingIds = new Set(
    entitlementsOut.map((e) => e.id || e.entitlementId)
  );

  // For W1, use all teams' entitlements if provided, otherwise just this team's
  const allOutgoingIds = allTeamsEntitlementsOut
    ? new Set(allTeamsEntitlementsOut.map((e) => e.id || e.entitlementId))
    : outgoingIds;

  // Track if we've already emitted each warning type (one per team, not spammy)
  let hasEncumberedWarning = false;
  let hasLinkedPackageWarning = false;
  let hasSwapControllerConflictWarning = false;

  for (const entitlement of entitlementsOut) {
    // Warning A: Encumbered pick_ownership without linked swap_right
    if (
      !hasEncumberedWarning &&
      entitlement.kind === 'pick_ownership' &&
      entitlement.underlyingStatus === 'encumbered'
    ) {
      const coveredBy = entitlement.coveredByEntitlementIds;

      if (Array.isArray(coveredBy) && coveredBy.length > 0) {
        // Check if ANY of the coveredByEntitlementIds are also being traded as swap_right
        const hasLinkedSwapRightOutgoing = coveredBy.some((coveredId) => {
          const linked = entitlementsOut.find(
            (oe) =>
              (oe.id === coveredId || oe.entitlementId === coveredId) &&
              oe.kind === 'swap_right'
          );
          return !!linked;
        });

        if (!hasLinkedSwapRightOutgoing) {
          warnings.push(
            '⚠️ Encumbered pick traded without linked swap right. Recipient may not receive expected value.'
          );
          hasEncumberedWarning = true;
        }
      } else {
        // Fallback: no coveredByEntitlementIds, always warn
        warnings.push(
          '⚠️ Encumbered pick traded without linked swap right. Recipient may not receive expected value.'
        );
        hasEncumberedWarning = true;
      }
    }

    // Warning W1: Linked entitlements not all included in trade
    // This checks linkedEntitlementIds - if an entitlement has linked IDs, ensure they're all moving
    if (
      !hasLinkedPackageWarning &&
      Array.isArray(entitlement.linkedEntitlementIds) &&
      entitlement.linkedEntitlementIds.length > 0
    ) {
      const linkedIds = entitlement.linkedEntitlementIds;
      const missingLinkedIds = linkedIds.filter(
        (id) => !allOutgoingIds.has(id)
      );

      if (missingLinkedIds.length > 0) {
        warnings.push(
          '⚠️ This pick right is linked to other pick rights not included in the trade.'
        );
        hasLinkedPackageWarning = true;
      }
    }

    // Warning W2: Swap controller conflict
    // If a swap_right uses a swapControllerPickId tied to a pick_ownership that is also outgoing
    if (
      !hasSwapControllerConflictWarning &&
      entitlement.kind === 'swap_right' &&
      entitlement.swapControllerPickId
    ) {
      const controllerPickId = entitlement.swapControllerPickId;

      // Check if any outgoing pick_ownership references this controller pick
      const controllerEntitlement = entitlementsOut.find(
        (oe) =>
          oe.kind === 'pick_ownership' &&
          oe.underlyingPickId === controllerPickId
      );

      if (controllerEntitlement) {
        warnings.push(
          '⚠️ This swap uses a controller pick that is also being moved in this trade.'
        );
        hasSwapControllerConflictWarning = true;
      }
    }
  }

  return warnings;
}

/**
 * Get a display label for entitlement kind.
 * @param {string} kind - The entitlement kind
 * @returns {object} - { label, colorClass }
 */
export function getEntitlementKindBadge(
  kind: string | null | undefined
): EntitlementBadge {
  switch (kind) {
    case 'pick_ownership':
      return { label: 'Own', colorClass: 'bg-cockpit-info/20 text-cockpit-info' };
    case 'conveyance_right':
      return {
        label: 'Conditional',
        colorClass: 'bg-cockpit-info/20 text-cockpit-info',
      };
    case 'swap_right':
      return {
        label: 'Swap Option',
        colorClass: 'bg-cockpit-watch/20 text-cockpit-watch',
      };
    default:
      return {
        label: kind || 'Unknown',
        colorClass: 'bg-cockpit-raised text-cockpit-text-secondary',
      };
  }
}
