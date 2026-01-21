# PST Draft Picks Scripts

## PURPOSE

Phase-based scripts for PST draft pick scraping, normalization, entitlement generation, and Firestore delivery.

## ENTRY POINTS

- `npm run pst:entitlements` — Build entitlement assets JSON (Phase 8).
- `npm run pst:push:base-entitlements` — Push base entitlements to Firestore (Phase 10).
- `npm run pst:patch:base-teams-entitlements` — Patch base teams with entitlementIds (Phase 10).
- `npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_10_validate_firestore_entitlements.ts` — Validate Firestore writes and resolver behavior (Phase 10).

## STRUCTURE

- Phase scripts: `pst_phase_*` for deterministic pipeline steps.
- Validators: `pst_validate_*` for regression and data integrity checks.
- Helpers: `pst_*_utils.ts` for shared logic.

## LINKS

- Plan: `plans/pst-phase-10-firestore-entitlements/plan.md`
- Master Doc: `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`
- Phase 8 Entitlements: `docs/team-scrape/PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md`
