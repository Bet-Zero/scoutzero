/**
 * FILE: src/features/architect/utils/leagueInvariants.ts
 * PURPOSE: League-wide invariant validation to ensure cross-team consistency.
 *          Prevents duplicate players across teams and validates league-level constraints.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-03: Created per LEAGUE_INTEGRITY_COMPLETION_AUDIT blocking gap resolution
 *
 * LINKS:
 *  - Audit: docs/architect/LEAGUE_INTEGRITY_COMPLETION_AUDIT.md
 *  - Mutation Pipeline: src/features/architect/utils/mutationPipeline.ts
 */

// Wave 32 Step 1: player invariants extracted to submodule
export * from './leagueInvariants.playerInvariants';
// Wave 32 Step 2: entitlement invariants extracted to submodule
export * from './leagueInvariants.entitlementInvariants';
