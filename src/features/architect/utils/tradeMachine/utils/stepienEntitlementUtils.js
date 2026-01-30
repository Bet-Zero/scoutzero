/**
 * FILE: stepienEntitlementUtils.js
 * PURPOSE: Convert entitlement objects to Stepien-compatible pick-like objects
 * OWNERSHIP: Trade Machine / Stepien Validation
 * HISTORY:
 *   - 2026-01-30: Created for Phase 12.1 - Stepien Entitlements Migration
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.1)
 *   - docs/team-scrape/return_packages/PST_PHASE_12_STEPIEN_ENTITLEMENTS_PREFLIGHT_RETURN_PACKAGE.md
 */

/**
 * Checks if an entitlement has pooled underlying status.
 * Pooled entitlements do NOT reserve years for Stepien purposes.
 *
 * @param {Object} entitlement - The entitlement object
 * @returns {boolean} - True if entitlement is pooled
 */
export function isPooledEntitlement(entitlement) {
  return entitlement?.underlyingStatus === 'pooled';
}

/**
 * Checks if an entitlement kind is relevant for Stepien year reservation.
 *
 * @param {string} kind - The entitlement kind
 * @returns {boolean} - True if kind reserves year for Stepien
 */
export function isStepienRelevantKind(kind) {
  return ['pick_ownership', 'swap_right', 'conveyance_right'].includes(kind);
}

/**
 * Builds Stepien-compatible "pick-like" objects from entitlements.
 *
 * Conservative Policy:
 * - pick_ownership (round 1, non-pooled) → reserves year ✅
 * - swap_right (round 1, non-pooled) → reserves year ✅
 * - conveyance_right (round 1, non-pooled) → reserves year ✅
 * - Any pooled entitlement → does NOT reserve year ❌
 *
 * @param {Array} entitlementsOut - Array of outgoing entitlement objects
 * @returns {Array} - Array of pick-like objects compatible with reservesYearForStepien()
 */
export function buildStepienOutgoingPicksFromEntitlements(entitlementsOut) {
  if (!Array.isArray(entitlementsOut) || entitlementsOut.length === 0) {
    return [];
  }

  return entitlementsOut
    .filter((ent) => {
      // Only first-round entitlements matter for Stepien
      if (ent.round !== 1 && ent.round !== '1st' && ent.round !== 'first') {
        return false;
      }

      // Only certain kinds reserve years
      if (!isStepienRelevantKind(ent.kind)) {
        return false;
      }

      // Pooled entitlements do NOT reserve years (conservative policy)
      if (isPooledEntitlement(ent)) {
        return false;
      }

      return true;
    })
    .map((ent) => {
      // Convert to pick-like object compatible with reservesYearForStepien()
      // swap_right → isSwap=true, swapType='best_of' (reserves year)
      // conveyance_right → treat as outright pick (reserves year)
      // pick_ownership → outright pick (reserves year)
      const isSwap = ent.kind === 'swap_right';

      return {
        year: ent.seasonYear || ent.year,
        round: 1,
        protection: null, // Entitlements don't carry protection info at this level
        isSwap: isSwap,
        swapType: isSwap ? 'best_of' : undefined,
        // Metadata for debugging
        _source: 'entitlement',
        _entitlementId: ent.id,
        _entitlementKind: ent.kind,
        _underlyingStatus: ent.underlyingStatus,
      };
    });
}

/**
 * Phase 12.2: Builds Stepien BASELINE inventory from team's held entitlements.
 *
 * This converts entitlements the team OWNS (pre-trade) into a set of year reservations.
 * Used as the authoritative source for determining what first-round picks a team controls.
 *
 * Conservative Policy:
 * - pick_ownership (round 1, non-pooled) → reserves year ✅
 * - swap_right (round 1, non-pooled) → reserves year ✅ (best_of)
 * - conveyance_right (round 1, non-pooled) → reserves year ✅
 * - Any pooled entitlement → does NOT reserve year ❌
 *
 * @param {Array} entitlements - Array of entitlement objects the team holds
 * @returns {Array} - Array of baseline pick-like objects for Stepien calculation
 */
export function buildStepienBaselinePicksFromEntitlements(entitlements) {
  if (!Array.isArray(entitlements) || entitlements.length === 0) {
    return [];
  }

  return entitlements
    .filter((ent) => {
      // Only first-round entitlements matter for Stepien
      if (ent.round !== 1 && ent.round !== '1st' && ent.round !== 'first') {
        return false;
      }

      // Only certain kinds reserve years
      if (!isStepienRelevantKind(ent.kind)) {
        return false;
      }

      // Pooled entitlements do NOT reserve years (team doesn't control them)
      if (isPooledEntitlement(ent)) {
        return false;
      }

      return true;
    })
    .map((ent) => {
      // swap_right → isSwap=true, swapType='best_of' (reserves year)
      // conveyance_right → treat as outright pick (reserves year)
      // pick_ownership → outright pick (reserves year)
      const isSwap = ent.kind === 'swap_right';

      return {
        year: ent.seasonYear || ent.year,
        round: 1,
        isSwap: isSwap,
        swapType: isSwap ? 'best_of' : undefined,
        // Metadata for debugging - mark as baseline source
        _source: 'entitlement_baseline',
        _entitlementId: ent.id,
        _kind: ent.kind,
      };
    });
}
