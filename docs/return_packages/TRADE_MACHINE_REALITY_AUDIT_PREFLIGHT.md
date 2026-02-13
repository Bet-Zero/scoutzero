# TRADE MACHINE REALITY AUDIT — PREFLIGHT RETURN PACKAGE

**Date:** 2026-02-05
**Mode:** PREFLIGHT (discovery only, no code changed)
**Audit scope:** Gaps A–F as specified in the original prompt

---

## GAP TABLE

| Gap | Label | Status | Root Cause | File : Function | What's Missing | Suggested Fix |
|-----|-------|--------|------------|-----------------|----------------|---------------|
| A | Stepien not enforced for entitlements | STALE WARNING — enforcement IS live | Warning text predates Phase 12.2/13. `validateStepien.js` processes `entitlementsOut` and runs the consecutive-year check on entitlement-derived picks. `useTradeMachine.js:851` populates the field. | `entitlementWarnings.js:72-84` · `computeEntitlementWarnings()` | Nothing missing in enforcement. The warning itself is the artifact. | Delete Warning B (the if-block at lines 72-84). Remove `hasStepienWarning` if dead. |
| B | Entitlements not editable (protections/swaps/conveyance) | JSON-ONLY authoring surface | `EntitlementEditorModal.tsx` is a raw-JSON editor gated behind `VITE_FEATURE_ENTITLEMENT_AUTHORING`. No form UI for structured fields. Schema (`architect.ts`) and persistence (`entitlementWriter.ts`) are both ready. | `EntitlementEditorModal.tsx` · (no form components exist) | Form tabs for: protection ladder tiers (year/condition/action), swap pair (controller pick + target), conveyance ranked-selection (comparator + ranks). | Add tab-based form UI inside `EntitlementEditorModal.tsx`. Write through existing `entitlementWriter.ts` + `validateEntitlementDocument()`. |
| C | Sign-and-Trade is placeholder | BACKEND COMPLETE — UI WIRING BROKEN (3 breaks) | (1) `handleSignAndTrade` defined at `useArchitectActions.ts:708-736` but NOT in the `UseArchitectActionsReturn` interface (lines 244-300) — callers cannot reach it. (2) `GMDashboard.jsx:~427` does not pass `onSignAndTrade` prop to `EditContractModal` — click does nothing. (3) `FreeAgentPool.jsx:handleSignAndTrade` (line 89) calls generic `onSign` and ignores `destinationTeamId` — player is signed but never traded. | `useArchitectActions.ts:244-300` · `GMDashboard.jsx:~427` · `FreeAgentPool.jsx:81-91` | Export, prop, and callback wiring. | (1) Add to interface + return. (2) Pass prop. (3) Rewrite FreeAgentPool handler to call S&T with destination. |
| D | Trade Exceptions unusable (no $ amount/details) + TPE math wrong | DISPLAY BROKEN on reload — math is CORRECT | `ExceptionTracker.jsx:126` destructures `tradeExceptions` from `teamCapSheet`. Phase 64 (`normalizeTeamTpe.js:197-200`) deletes `team.tradeExceptions` before Firestore write and moves data to `team.exceptions.tpe[]`. Post-reload the field is undefined → empty list. In-session: `computeTradeResult` writes to legacy path (line 1347); normalization runs only at persist (line 2430). So TPEs appear briefly after trade, vanish on reload. `TradeExceptionDashboard.jsx:18` (trade receipt) correctly uses `getTeamTpeList()` — only the cap-sheet tracker is broken. TPE math (`tradeUtilities.js:28-40`) is `MAX(0, out−in)` — correct. "Cannot combine" (`validateTradeExceptions.js:70-75`) is enforced. | `ExceptionTracker.jsx:126` · `normalizeTeamTpe.js:217-235` (helper exists, unused here) | Import and use `getTeamTpeList()` instead of raw destructure. | Replace `tradeExceptions = []` destructure with `const tradeExceptions = getTeamTpeList(teamCapSheet);` |
| E | Extensions not reflected in player contract view | CAP MATH CORRECT — voiding indicator NOT set | `contractUtils.js:getContractYearSlice()` merges both `contract` and `futureContract` salariesByYear — so salary totals are right. But `mutationPipeline.js:1742-1785` (extension creation) only sets `isExtensionSeason: true` on new years; it does NOT set `voidedByExtension: true` on overlapping years in the original contract. Schema field exists (`BasePlayerContractYearZ`). Result: duplicate years in contract tables with no visual distinction. | `mutationPipeline.js:1742-1785` · `architect.ts` · contract table render (TBD) | (1) Set `voidedByExtension: true` on overlapping original-contract years during extension mutation. (2) Dim/hide voided rows in contract table. |
| F | Salary matching / receive limits don't respond to apron status | APRON BRANCHING COMPLETE — 2nd-apron TPE rule over-aggressive | All 4 salary-matching branches exist and are correct (`validateSalaryMatching.js`, `salaryMatchingRules.js`, `capUtils.js`). The single bug: `validateTradeExceptions.js:61-64` has an else branch that blocks current-year TPEs for 2nd-apron teams. CBA permits current-year TPEs. `getIncomingCeiling()` (`tradeHelpers.js:156`) and `basicRules.js:validateSecondApronRules` both correctly allow current-year TPEs — only this else branch disagrees. Effect: UI shows legal ceiling, validator rejects. | `validateTradeExceptions.js:61-64` (the else branch) | Delete the else branch. Keep only the `if (hasPriorYearTPE)` violation. |

---

## WHAT WAS SEARCHED / NOT FOUND

All gaps were resolved to exact code locations. No "NOT FOUND" entries. Key search patterns used:

- `signAndTrade` / `sign-and-trade` — 95 files, traced to 3 UI break points
- `tradeExceptions` vs `exceptions.tpe` — traced the Phase 64 canonicalization and the one component that missed it
- `entitlementsOut` / `validationEntitlements` — confirmed population in `useTradeMachine.js:851` and spread in `tradeValidator.js:469`
- `voidedByExtension` — confirmed schema-ready, never written
- `SECOND_APRON_TPE_BLOCKED` — found in `validateTradeExceptions.js:63` and constant definition; confirmed it is the sole source of the over-aggressive block
- `getTeamTpeList` — exists at `normalizeTeamTpe.js:217`, used correctly in `TradeExceptionDashboard.jsx:18` and `useTradeMachine.js:971`, NOT used in `ExceptionTracker.jsx`

---

## SEVERITY RANKING (execution priority)

| Priority | Gaps | Why |
|----------|------|-----|
| P0 — ship first | C, D | S&T is dead from the UI. TPEs vanish on reload. Both are user-visible, both are 1–3 line fixes per file. |
| P1 — next sprint | F | Trade rejects a legal move. UI/validator conflict. Single else-branch delete + 2 tests. |
| P2 — follow-on | A, E | A is cosmetic (stale warning). E is display polish (duplicate rows, not wrong data). |
| P3 — feature work | B | New authoring surface. No existing users blocked. |
