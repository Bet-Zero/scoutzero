/**
 * FILE: stepienEntitlementUtils.ts
 * PURPOSE: Convert entitlement objects to Stepien-compatible pick-like objects
 * OWNERSHIP: Trade Machine / Stepien Validation
 * HISTORY:
 *   - 2026-01-30: Created for Phase 12.1 - Stepien Entitlements Migration
 *   - 2026-03-09: Migrated to TypeScript for E28
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.1)
 *   - docs/team-scrape/return_packages/PST_PHASE_12_STEPIEN_ENTITLEMENTS_PREFLIGHT_RETURN_PACKAGE.md
 */

import { normalizeEntitlementTerms } from '@/features/architect/utils/entitlements/entitlementTerms';

type StepienRelevantKind =
  | 'pick_ownership'
  | 'swap_right'
  | 'conveyance_right';

type StepienEntitlementId = string | null | undefined;
type StepienYearLike = number | string | null | undefined;
type StepienRoundLike = number | string | null | undefined;

interface StepienEntitlementLike extends Record<string, unknown> {
  id?: StepienEntitlementId;
  entitlementId?: StepienEntitlementId;
  kind?: string;
  round?: StepienRoundLike;
  seasonYear?: StepienYearLike;
  year?: StepienYearLike;
  underlyingStatus?: string;
  fromTeamId?: string;
  toTeamId?: string | null;
  holderTeam?: string;
}

interface StepienOutgoingEntitlementPick {
  year: StepienYearLike;
  round: 1;
  protection: null;
  isSwap: boolean;
  swapType?: string;
  _source: 'entitlement';
  _entitlementId?: StepienEntitlementId;
  _entitlementKind?: string;
  _underlyingStatus?: string;
  _termsRole?: string;
  _termsProtection: string | null;
  _hasProtectionLadder: boolean;
}

interface StepienBaselineEntitlementPick {
  year: StepienYearLike;
  round: 1;
  isSwap: boolean;
  swapType?: string;
  _source: 'entitlement_baseline';
  _entitlementId?: StepienEntitlementId;
  _kind?: string;
  _termsRole?: string;
  _termsProtection: string | null;
  _hasProtectionLadder: boolean;
}

interface ComputePostTradeEntitlementsParams {
  currentEntitlements?: StepienEntitlementLike[];
  entitlementsOut?: StepienEntitlementLike[];
  allTeamsEntitlementsOut?: StepienEntitlementLike[][];
  teamId?: string;
  tradeParticipantIds?: Set<string> | null;
}

function isFirstRoundEntitlement(round: StepienRoundLike): boolean {
  return round === 1 || round === '1st' || round === 'first';
}

function getEntitlementId(entitlement: StepienEntitlementLike): StepienEntitlementId {
  return entitlement.entitlementId || entitlement.id;
}

/**
 * Checks if an entitlement has pooled underlying status.
 * Pooled entitlements do NOT reserve years for Stepien purposes.
 */
export function isPooledEntitlement(
  entitlement: StepienEntitlementLike | null | undefined
): boolean {
  return entitlement?.underlyingStatus === 'pooled';
}

/**
 * Checks if an entitlement kind is relevant for Stepien year reservation.
 */
export function isStepienRelevantKind(
  kind: string | null | undefined
): kind is StepienRelevantKind {
  return ['pick_ownership', 'swap_right', 'conveyance_right'].includes(
    kind as StepienRelevantKind
  );
}

/**
 * Builds Stepien-compatible "pick-like" objects from entitlements.
 */
export function buildStepienOutgoingPicksFromEntitlements(
  entitlementsOut: StepienEntitlementLike[] | null | undefined
): StepienOutgoingEntitlementPick[] {
  if (!Array.isArray(entitlementsOut) || entitlementsOut.length === 0) {
    return [];
  }

  return entitlementsOut
    .filter((ent) => {
      if (!isFirstRoundEntitlement(ent.round)) {
        return false;
      }

      if (!isStepienRelevantKind(ent.kind)) {
        return false;
      }

      if (isPooledEntitlement(ent)) {
        return false;
      }

      return true;
    })
    .map((ent) => {
      const terms = normalizeEntitlementTerms(ent);
      const protectionText =
        terms.protectionLadder?.currentTier?.condition || null;
      const isSwap = ent.kind === 'swap_right';
      const swapType = isSwap ? terms.swap?.swapType || 'best_of' : undefined;

      return {
        year: ent.seasonYear || ent.year,
        round: 1,
        protection: null as any,
        isSwap: isSwap,
        swapType,
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
 */
export function buildStepienBaselinePicksFromEntitlements(
  entitlements: StepienEntitlementLike[] | null | undefined
): StepienBaselineEntitlementPick[] {
  if (!Array.isArray(entitlements) || entitlements.length === 0) {
    return [];
  }

  return entitlements
    .filter((ent) => {
      if (!isFirstRoundEntitlement(ent.round)) {
        return false;
      }

      if (!isStepienRelevantKind(ent.kind)) {
        return false;
      }

      if (isPooledEntitlement(ent)) {
        return false;
      }

      return true;
    })
    .map((ent) => {
      const terms = normalizeEntitlementTerms(ent);
      const protectionText =
        terms.protectionLadder?.currentTier?.condition || null;
      const isSwap = ent.kind === 'swap_right';
      const swapType = isSwap ? terms.swap?.swapType || 'best_of' : undefined;

      return {
        year: ent.seasonYear || ent.year,
        round: 1,
        isSwap: isSwap,
        swapType,
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
 */
export function computePostTradeEntitlements({
  currentEntitlements = [],
  entitlementsOut = [],
  allTeamsEntitlementsOut = [],
  teamId,
  tradeParticipantIds = null,
}: ComputePostTradeEntitlementsParams): StepienEntitlementLike[] {
  const outIds = new Set(
    entitlementsOut.map((entitlement) => getEntitlementId(entitlement)).filter(Boolean)
  );

  const postTrade = currentEntitlements.filter((entitlement) => {
    const entitlementId = getEntitlementId(entitlement);
    return !outIds.has(entitlementId);
  });

  const incomingEntitlementIds = new Set<StepienEntitlementId>();

  for (const otherTeamEntitlements of allTeamsEntitlementsOut) {
    for (const ent of otherTeamEntitlements) {
      const fromTeamId = ent.fromTeamId;
      const toTeamId = ent.toTeamId;

      if (fromTeamId === teamId) continue;

      if (!toTeamId) {
        if (allTeamsEntitlementsOut.length === 1) {
          // 2-team broadcast fallback — still OK
        } else {
          const entId = getEntitlementId(ent) || 'unknown';
          throw new Error(
            `Pick Exclusivity: Entitlement "${entId}" from ${fromTeamId} has no destination team (toTeamId missing in multi-team trade)`
          );
        }
      }

      if (toTeamId && tradeParticipantIds && !tradeParticipantIds.has(toTeamId)) {
        const entId = getEntitlementId(ent) || 'unknown';
        throw new Error(
          `Pick Exclusivity: Entitlement "${entId}" routed to "${toTeamId}" which is not a trade participant`
        );
      }

      if (toTeamId === teamId || (!toTeamId && allTeamsEntitlementsOut.length === 1)) {
        const entId = getEntitlementId(ent);
        if (entId && incomingEntitlementIds.has(entId)) {
          throw new Error(
            `Pick Exclusivity: Entitlement "${entId}" routed to ${teamId} more than once (routing conflict)`
          );
        }
        if (entId) incomingEntitlementIds.add(entId);

        postTrade.push({
          ...ent,
          holderTeam: teamId,
        });
      }
    }
  }

  return postTrade;
}
