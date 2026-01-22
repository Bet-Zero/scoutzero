/**
 * FILE: src/features/architect/tradeMachine/utils/entitlementWarnings.js
 * PURPOSE: Compute non-blocking warnings for entitlement trades
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.2)
 *
 * HISTORY:
 *  - 2026-01-22: Created for Phase 11.2 - Entitlement UX + Warnings
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.2)
 *  - Preflight: docs/team-scrape/PST_PHASE_11_2_ENTITLEMENT_UX_WARNINGS_PREFLIGHT_RETURN_PACKAGE.md
 */

/**
 * Compute non-blocking warnings for entitlements being traded.
 *
 * Warning A: Encumbered pick_ownership traded without linked swap_right
 * Warning B: First-round entitlement traded (Stepien not enforced)
 *
 * @param {Array} entitlementsOut - Array of entitlement objects being traded by one team
 * @returns {Array<string>} - Array of warning message strings (deduped)
 */
export function computeEntitlementWarnings(entitlementsOut) {
  if (!Array.isArray(entitlementsOut) || entitlementsOut.length === 0) {
    return [];
  }

  const warnings = [];
  const outgoingIds = new Set(
    entitlementsOut.map((e) => e.id || e.entitlementId)
  );

  // Track if we've already emitted each warning type (one per team, not spammy)
  let hasEncumberedWarning = false;
  let hasStepienWarning = false;

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

    // Warning B: First-round entitlement traded (Stepien not enforced)
    if (
      !hasStepienWarning &&
      entitlement.round === 1 &&
      ['pick_ownership', 'conveyance_right', 'swap_right'].includes(
        entitlement.kind
      )
    ) {
      warnings.push(
        '⚠️ First-round entitlement traded. Stepien Rule not yet enforced for entitlements.'
      );
      hasStepienWarning = true;
    }
  }

  return warnings;
}

/**
 * Get a display label for entitlement kind.
 * @param {string} kind - The entitlement kind
 * @returns {object} - { label, colorClass }
 */
export function getEntitlementKindBadge(kind) {
  switch (kind) {
    case 'pick_ownership':
      return { label: 'Own', colorClass: 'bg-blue-600/30 text-blue-300' };
    case 'conveyance_right':
      return {
        label: 'Conditional',
        colorClass: 'bg-purple-600/30 text-purple-300',
      };
    case 'swap_right':
      return {
        label: 'Swap Option',
        colorClass: 'bg-amber-600/30 text-amber-300',
      };
    default:
      return {
        label: kind || 'Unknown',
        colorClass: 'bg-white/10 text-white/60',
      };
  }
}
