# Architect Ship Readiness Master

## Current Readiness Snapshot

- Snapshot date: `2026-02-14` (UTC)
- Status: **NOT READY (P0 preflight)**
- Readiness summary:
  - Architect routes, feature map, state spine, and persistence seams are fully mapped in P0 preflight.
  - World-scoped mutation persistence is centralized and no base-team/base-player write path was found in audited Architect mutation code.
  - Core ship blockers remain in trade apply freshness/persistence wiring and data-source consistency for world overlays.

## P0 Preflight

- `return_packages/architect/ARCH_P0_PREFLIGHT_REALITY_MAP.md`
- `return_packages/architect/ARCH_P0_GAP_ANALYSIS.md`
- `return_packages/architect/ARCH_P0_VALIDATION_EVIDENCE.md`

## Current Known Blockers (Severity-Ordered)

1. `SEV-1` Trade apply does not enforce fresh validation state before commit (`src/features/architect/tradeMachine/TradeEditor.jsx` lines 373-410).
2. `SEV-1` Trade apply performs optimistic local mutation before non-awaited world persistence (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts` lines 742-775).
3. `SEV-1` Base-centric player sourcing can desync world overlay state from FA/trade displays (`src/features/architect/hooks/useArchitectPlayerData.js` lines 1-30; `src/features/architect/utils/teamLoader.js` lines 34-71, 211-257).
4. `SEV-2` Dashboard modal sign/re-sign wiring is inconsistent with authoritative mutation path (`src/features/architect/GMDashboard/GMDashboard.jsx` line 430; `src/shared/components/EditContractModal.jsx` lines 119-140, 664-693).
5. `SEV-2` Typecheck gate fails with Architect source typing issue (`src/features/architect/utils/entitlements/entitlementResolver.ts:97`).

## Next Execution-Ready Workstream Pointers

1. Trade apply integrity hardening (`G-01`, `G-02`) from `return_packages/architect/ARCH_P0_GAP_ANALYSIS.md`.
2. World-overlay player source alignment for FA/trade UI (`G-03`) from `return_packages/architect/ARCH_P0_GAP_ANALYSIS.md`.
3. Modal action-path cleanup and offer-sheet validator switch dedup (`G-04`, `G-05`).
4. Typecheck stabilization for Architect entitlements path (`G-06`) and supporting typed tests.
