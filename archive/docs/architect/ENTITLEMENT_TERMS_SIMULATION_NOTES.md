# Entitlement Terms Simulation Notes

**Created:** 2026-02-05
**Scope:** TM-5 Entitlement Terms Integration

## What Is Simulated Now

- Entitlement terms are normalized via `entitlementTerms.ts` and attached to trade payloads.
- Trade Machine entitlement rows, summary cards, and export capture show concise `termsShort` text.
- Trade receipts include `terms`, `termsShort`, and `draftKey` for audit/debug.
- Stepien validation reads authored terms conservatively:
  - Protection ladders do not bypass consecutive-year checks.
  - Swap rights use parsed swapType (worst_of does not reserve year).
  - Conveyance terms trigger warnings and are treated as reserving the year.

## What Is Deferred

- Full ladder-accurate Stepien exemptions (tier-by-tier protection logic).
- Conveyance pool resolution and ranked selection simulation inside Trade Machine validation.
- Swap pool resolution or multi-team swap graph simulation inside validation.
