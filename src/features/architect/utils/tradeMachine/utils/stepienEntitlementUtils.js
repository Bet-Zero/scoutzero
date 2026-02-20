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

import { normalizeEntitlementTerms } from '@/features/architect/utils/entitlements/entitlementTerms';

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
      const terms = normalizeEntitlementTerms(ent);
      const protectionText =
        terms.protectionLadder?.currentTier?.condition || null;
      // Convert to pick-like object compatible with reservesYearForStepien()
      // swap_right → isSwap=true, swapType='best_of' (reserves year)
      // conveyance_right → treat as outright pick (reserves year)
      // pick_ownership → outright pick (reserves year)
      const isSwap = ent.kind === 'swap_right';
      const swapType = isSwap ? terms.swap?.swapType || 'best_of' : undefined;

      return {
        year: ent.seasonYear || ent.year,
        round: 1,
        protection: null, // Entitlements don't carry protection info at this level
        isSwap: isSwap,
        swapType,
        // Metadata for debugging
        _source: 'entitlement',
        _entitlementId: ent.id,
        _entitlementKind: ent.kind,
        _underlyingStatus: ent.underlyingStatus,
        _termsRole: terms.swap?.role,
        _termsProtection: protectionText,
        _hasProtectionLadder: terms.hasProtectionLadder,
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
      const terms = normalizeEntitlementTerms(ent);
      const protectionText =
        terms.protectionLadder?.currentTier?.condition || null;
      // swap_right → isSwap=true, swapType='best_of' (reserves year)
      // conveyance_right → treat as outright pick (reserves year)
      // pick_ownership → outright pick (reserves year)
      const isSwap = ent.kind === 'swap_right';
      const swapType = isSwap ? terms.swap?.swapType || 'best_of' : undefined;

      return {
        year: ent.seasonYear || ent.year,
        round: 1,
        isSwap: isSwap,
        swapType,
        // Metadata for debugging - mark as baseline source
        _source: 'entitlement_baseline',
        _entitlementId: ent.id,
        _kind: ent.kind,
        _termsRole: terms.swap?.role,
        _termsProtection: protectionText,
        _hasProtectionLadder: terms.hasProtectionLadder,
      };
    });
}

/**
 * TM-PICKS-E1: Compute a team's effective entitlements after a trade.
 *
 * Takes the team's current entitlements, removes those being traded out,
 * and adds those being traded in (from other teams in the trade).
 *
 * STRICT MODE (TM-EXCL-E2): If any outgoing entitlement is missing `toTeamId`,
 * or has an invalid `toTeamId`, this function throws. The caller (tradeValidator)
 * catches the throw and maps it to a blocking Pick Exclusivity failure.
 *
 * @param {Object} params
 * @param {Array} params.currentEntitlements - Team's pre-trade entitlement inventory
 * @param {Array} params.entitlementsOut - Entitlements this team is sending out
 * @param {Array} params.allTeamsEntitlementsOut - All teams' outgoing entitlements (for computing incoming)
 * @param {string} params.teamId - This team's ID (for routing incoming entitlements)
 * @param {Set} [params.tradeParticipantIds] - Set of all team IDs in the trade (for strict validation)
 * @returns {Array} - Post-trade entitlement array
 * @throws {Error} If strict routing validation fails (missing toTeamId, invalid destination, duplicates)
 */
export function computePostTradeEntitlements({
  currentEntitlements = [],
  entitlementsOut = [],
  allTeamsEntitlementsOut = [],
  teamId,
  tradeParticipantIds = null,
}) {
  // IDs being sent out by this team
  const outIds = new Set(
    entitlementsOut.map((e) => e.entitlementId || e.id).filter(Boolean)
  );

  // Start with current minus outgoing
  const postTrade = currentEntitlements.filter((ent) => {
    const id = ent.entitlementId || ent.id;
    return !outIds.has(id);
  });

  // TM-EXCL-E2: Track entitlements routed to this team to detect duplicates
  const incomingEntitlementIds = new Set();

  // Add incoming: entitlements from other teams routed to this team
  for (const otherTeamEntitlements of allTeamsEntitlementsOut) {
    for (const ent of otherTeamEntitlements) {
      const fromTeamId = ent.fromTeamId;
      const toTeamId = ent.toTeamId;

      // Skip entitlements from this team (they're outgoing, not incoming)
      if (fromTeamId === teamId) continue;

      // TM-EXCL-E2: Strict mode — validate toTeamId
      if (!toTeamId) {
        // For backward compatibility with 2-team broadcasts: only allow if exactly 1 other team's entitlements
        if (allTeamsEntitlementsOut.length === 1) {
          // 2-team broadcast fallback — still OK
        } else {
          // 3+ team trade with missing toTeamId — this is a routing failure
          const entId = ent.entitlementId || ent.id || 'unknown';
          throw new Error(
            `Pick Exclusivity: Entitlement "${entId}" from ${fromTeamId} has no destination team (toTeamId missing in multi-team trade)`
          );
        }
      }

      // TM-EXCL-E2: If tradeParticipantIds provided, validate destination is in the trade
      if (
        toTeamId &&
        tradeParticipantIds &&
        !tradeParticipantIds.has(toTeamId)
      ) {
        const entId = ent.entitlementId || ent.id || 'unknown';
        throw new Error(
          `Pick Exclusivity: Entitlement "${entId}" routed to "${toTeamId}" which is not a trade participant`
        );
      }

      // Include if routed to this team (or broadcast in 2-team trade with no toTeamId)
      if (
        toTeamId === teamId ||
        (!toTeamId && allTeamsEntitlementsOut.length === 1)
      ) {
        // TM-EXCL-E2: Detect duplicate routing (same entitlement moved to same team twice)
        const entId = ent.entitlementId || ent.id;
        if (entId && incomingEntitlementIds.has(entId)) {
          throw new Error(
            `Pick Exclusivity: Entitlement "${entId}" routed to ${teamId} more than once (routing conflict)`
          );
        }
        if (entId) incomingEntitlementIds.add(entId);

        postTrade.push({
          ...ent,
          holderTeam: teamId, // Reflect new ownership
        });
      }
    }
  }

  return postTrade;
}
