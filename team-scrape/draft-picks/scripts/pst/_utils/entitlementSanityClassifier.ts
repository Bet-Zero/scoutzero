/**
 * FILE: team-scrape/draft-picks/scripts/pst/_utils/entitlementSanityClassifier.ts
 * PURPOSE: Pure logic for deterministic classification of entitlement sanity audit rows.
 *          Produces verdicts (OK/WARN/ERROR) with reasons and suggested actions.
 * OWNERSHIP: PST Audit (Phase 12.3E)
 * HISTORY: Created 2026-02-01
 * LINKS: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
 */

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type SanityVerdict = 'OK' | 'WARN' | 'ERROR';

export type SanityClassification =
  // A) pick_ownership classifications
  | 'OWNERSHIP_MISSING_UNDERLYING'
  | 'OWNERSHIP_OWNER_MISMATCH'
  | 'OWNERSHIP_WITH_POOL_RULES'
  | 'OWNERSHIP_NORMAL'
  // B) conveyance_right classifications
  | 'CONVEYANCE_RANKED_NO_UNDERLYING'
  | 'CONVEYANCE_MISSING_UNDERLYING'
  | 'CONVEYANCE_NORMAL'
  // C) swap_right classifications
  | 'SWAP_POOL_METADATA_MISSING'
  | 'SWAP_NORMAL'
  // D) protection metadata classifications
  | 'PROTECTION_RULES_MISSING'
  // Global fallback
  | 'INSUFFICIENT_CONTEXT_FOR_CLASSIFICATION';

export interface SanityResult {
  verdict: SanityVerdict;
  classification: SanityClassification;
  reasons: string[];
  suggestedNextAction?: string;
  debug?: {
    hasUnderlyingPickId: boolean;
    hasPickRules: boolean;
    hasLedgerPick: boolean;
    hasRankedConveyance: boolean;
    hasPool: boolean;
  };
}

export type EntitlementKind =
  | 'pick_ownership'
  | 'conveyance_right'
  | 'swap_right';

export interface EntitlementInput {
  id: string;
  kind: EntitlementKind;
  holderTeam: string;
  seasonYear: number;
  round: number;
  description: string;
  underlyingPickId?: string;
  poolUnderlyingPickIds?: string[];
  swapControllerPickId?: string;
  receivesComparator?: string;
  receivesRank?: number[];
}

export interface LedgerPickInput {
  pickId: string;
  owner: string;
  originalTeam: string;
  ownershipSource?: string;
}

export interface PickRuleProfileInput {
  pickId: string;
  protections?: any[];
  swaps?: any[];
  conveyance?: any[];
  selectionSpecs?: any[];
}

export interface ClassifierInput {
  entitlement: EntitlementInput;
  ledgerPick?: LedgerPickInput | null;
  pickRuleProfile?: PickRuleProfileInput | null;
  targetTeamCode: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Detects if the pick rules or entitlement indicate ranked conveyance
 * (least/most/nth favorable selection from a pool)
 */
function detectRankedConveyance(
  entitlement: EntitlementInput,
  pickRuleProfile?: PickRuleProfileInput | null
): boolean {
  // Check entitlement for ranked indicators
  if (
    entitlement.receivesComparator === 'more_favorable' ||
    entitlement.receivesComparator === 'less_favorable' ||
    entitlement.receivesComparator === 'middle'
  ) {
    return true;
  }

  if (entitlement.receivesRank && entitlement.receivesRank.length > 0) {
    return true;
  }

  const descLower = entitlement.description.toLowerCase();
  if (
    descLower.includes('least favorable') ||
    descLower.includes('most favorable') ||
    descLower.includes('less favorable') ||
    descLower.includes('more favorable')
  ) {
    return true;
  }

  // Check pick rules for ranked patterns
  if (pickRuleProfile) {
    const swapsRanked = pickRuleProfile.swaps?.some(
      (s) =>
        s.mostLeast === 'least_favorable' ||
        s.mostLeast === 'most_favorable' ||
        s.description?.toLowerCase().includes('least favorable') ||
        s.description?.toLowerCase().includes('most favorable')
    );

    const specsRanked = pickRuleProfile.selectionSpecs?.some(
      (s) => s.order === 'least' || s.order === 'most' || s.rank != null
    );

    const convRanked = pickRuleProfile.conveyance?.some(
      (c) =>
        c.description?.toLowerCase().includes('least favorable') ||
        c.description?.toLowerCase().includes('most favorable')
    );

    if (swapsRanked || specsRanked || convRanked) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if the pick rules indicate a pool of picks (for swap or conveyance)
 */
function detectPoolIndicators(
  entitlement: EntitlementInput,
  pickRuleProfile?: PickRuleProfileInput | null
): boolean {
  // Check entitlement for pool indicators
  if (
    entitlement.poolUnderlyingPickIds &&
    entitlement.poolUnderlyingPickIds.length > 0
  ) {
    return true;
  }

  // Check pick rules for pool indicators
  if (pickRuleProfile) {
    const swapsWithPool = pickRuleProfile.swaps?.some(
      (s) => s.pool && s.pool.length > 0
    );
    const specsWithPool = pickRuleProfile.selectionSpecs?.some(
      (s) => s.pool && s.pool.length > 0
    );

    if (swapsWithPool || specsWithPool) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if the entitlement description mentions protection
 */
function detectProtectionMention(entitlement: EntitlementInput): boolean {
  const descLower = entitlement.description.toLowerCase();
  return (
    descLower.includes('[protected]') ||
    descLower.includes('protected') ||
    descLower.includes('top ') ||
    descLower.includes('lottery')
  );
}

// =====================================================
// MAIN CLASSIFIER FUNCTION
// =====================================================

/**
 * Classifies a single entitlement row and returns a deterministic verdict.
 * This is a pure function with no side effects.
 */
export function classifyEntitlement(input: ClassifierInput): SanityResult {
  const { entitlement, ledgerPick, pickRuleProfile, targetTeamCode } = input;

  const hasUnderlyingPickId = !!entitlement.underlyingPickId;
  const hasPickRules = !!pickRuleProfile;
  const hasLedgerPick = !!ledgerPick;
  const hasRankedConveyance = detectRankedConveyance(
    entitlement,
    pickRuleProfile
  );
  const hasPool = detectPoolIndicators(entitlement, pickRuleProfile);

  const debug = {
    hasUnderlyingPickId,
    hasPickRules,
    hasLedgerPick,
    hasRankedConveyance,
    hasPool,
  };

  // =====================================================
  // A) pick_ownership entitlements
  // =====================================================
  if (entitlement.kind === 'pick_ownership') {
    // A.1: underlyingPickId missing → ERROR
    if (!hasUnderlyingPickId) {
      return {
        verdict: 'ERROR',
        classification: 'OWNERSHIP_MISSING_UNDERLYING',
        reasons: [
          'pick_ownership entitlement is missing underlyingPickId',
          'Cannot determine which pick is owned without an underlyingPickId',
        ],
        suggestedNextAction:
          'Add underlyingPickId to the entitlement or reclassify as conveyance_right/swap_right',
        debug,
      };
    }

    // A.2: ledger pick exists AND ledger.owner !== targetTeamCode → ERROR
    if (hasLedgerPick && ledgerPick!.owner !== targetTeamCode) {
      return {
        verdict: 'ERROR',
        classification: 'OWNERSHIP_OWNER_MISMATCH',
        reasons: [
          `Ledger shows owner="${ledgerPick!.owner}" but entitlement holder is "${targetTeamCode}"`,
          'pick_ownership implies current ownership, but ledger disagrees',
        ],
        suggestedNextAction: `Verify if ${targetTeamCode} actually owns this pick or if this should be a conveyance_right`,
        debug,
      };
    }

    // A.3: pick rules indicate ranked conveyance or pool AND entitlement is pick_ownership → WARN
    if (hasUnderlyingPickId && (hasRankedConveyance || hasPool)) {
      return {
        verdict: 'WARN',
        classification: 'OWNERSHIP_WITH_POOL_RULES',
        reasons: [
          'Underlying pick is governed by ranked conveyance or pool selection rules',
          'Ownership represents current holder until resolution',
        ],
        suggestedNextAction:
          'Ensure conveyance or swap rights are modeled separately via conveyance_right or swap_right entitlements',
        debug,
      };
    }

    // A.4: otherwise → OK
    return {
      verdict: 'OK',
      classification: 'OWNERSHIP_NORMAL',
      reasons: [
        'pick_ownership with valid underlyingPickId and consistent ledger ownership',
      ],
      debug,
    };
  }

  // =====================================================
  // B) conveyance_right entitlements
  // =====================================================
  if (entitlement.kind === 'conveyance_right') {
    // B.1: ranked conveyance detected AND underlyingPickId missing → WARN (intentional)
    if (hasRankedConveyance && !hasUnderlyingPickId) {
      return {
        verdict: 'WARN',
        classification: 'CONVEYANCE_RANKED_NO_UNDERLYING',
        reasons: [
          'Ranked conveyance (least/most favorable) intentionally lacks underlyingPickId',
          'The specific pick is determined at resolution time from a pool',
        ],
        suggestedNextAction:
          'No action needed - this is expected behavior for ranked conveyance rights',
        debug,
      };
    }

    // B.2: not ranked AND underlyingPickId missing → ERROR
    if (!hasRankedConveyance && !hasUnderlyingPickId) {
      // Check if this has poolUnderlyingPickIds - that's also acceptable
      if (
        entitlement.poolUnderlyingPickIds &&
        entitlement.poolUnderlyingPickIds.length > 0
      ) {
        return {
          verdict: 'OK',
          classification: 'CONVEYANCE_NORMAL',
          reasons: ['conveyance_right with poolUnderlyingPickIds specified'],
          debug,
        };
      }

      return {
        verdict: 'ERROR',
        classification: 'CONVEYANCE_MISSING_UNDERLYING',
        reasons: [
          'conveyance_right is missing underlyingPickId and is not a ranked conveyance',
          'Non-ranked conveyance rights should specify which pick(s) they apply to',
        ],
        suggestedNextAction:
          'Add underlyingPickId or poolUnderlyingPickIds to the entitlement',
        debug,
      };
    }

    // B.3: otherwise → OK
    return {
      verdict: 'OK',
      classification: 'CONVEYANCE_NORMAL',
      reasons: ['conveyance_right with valid structure'],
      debug,
    };
  }

  // =====================================================
  // C) swap_right entitlements
  // =====================================================
  if (entitlement.kind === 'swap_right') {
    // C.1: pool indicators present BUT missing pool metadata → WARN
    if (hasPool) {
      const hasPoolMetadata =
        (entitlement.poolUnderlyingPickIds &&
          entitlement.poolUnderlyingPickIds.length > 0) ||
        !!entitlement.swapControllerPickId;

      if (!hasPoolMetadata) {
        return {
          verdict: 'WARN',
          classification: 'SWAP_POOL_METADATA_MISSING',
          reasons: [
            'Swap right operates on a pool of picks but entitlement lacks poolUnderlyingPickIds or swapControllerPickId',
            'Pool metadata helps clarify which picks are in the swap selection',
          ],
          suggestedNextAction:
            'Add poolUnderlyingPickIds or swapControllerPickId to the entitlement',
          debug,
        };
      }
    }

    // C.2: otherwise → OK
    return {
      verdict: 'OK',
      classification: 'SWAP_NORMAL',
      reasons: ['swap_right with valid structure'],
      debug,
    };
  }

  // =====================================================
  // D) Protection metadata check (applies to all kinds)
  // =====================================================
  if (
    detectProtectionMention(entitlement) &&
    hasUnderlyingPickId &&
    !hasPickRules
  ) {
    return {
      verdict: 'WARN',
      classification: 'PROTECTION_RULES_MISSING',
      reasons: [
        'Entitlement description mentions protection but no pick rule profile exists',
        'Protection details may not be available for structured display',
      ],
      suggestedNextAction:
        'Verify architect_basePickRules seeding includes this pick',
      debug,
    };
  }

  // =====================================================
  // Global fallback: insufficient context
  // =====================================================
  return {
    verdict: 'WARN',
    classification: 'INSUFFICIENT_CONTEXT_FOR_CLASSIFICATION',
    reasons: [
      `Unable to fully classify entitlement kind="${entitlement.kind}"`,
      'This may be a new entitlement kind or missing classification logic',
    ],
    suggestedNextAction:
      'Review entitlement structure and update classifier if needed',
    debug,
  };
}

/**
 * Batch classify multiple entitlements (utility wrapper)
 */
export function classifyEntitlements(
  inputs: ClassifierInput[]
): Array<{ input: ClassifierInput; result: SanityResult }> {
  return inputs.map((input) => ({
    input,
    result: classifyEntitlement(input),
  }));
}
