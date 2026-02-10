# TRADE MACHINE MASTER AUDIT

**Created:** 2026-02-05
**SSOT for:** Trade Machine gap tracking, phased execution plan, and CBA-correctness status

---

## Reality Audit (2026-02-05)

Six feature areas were audited. Each finding below is read-confirmed against source code — no assumptions, no agent-only inferences.

### A — Stepien Rule / Entitlements

**Finding:** Enforcement IS live. Warning text is stale.

`validateStepien.js` reads `team.entitlementsOut` (line 145), converts to pick-like objects via `buildStepienOutgoingPicksFromEntitlements()`, and includes them in the consecutive-year check (lines 197-216). The payload is populated by `useTradeMachine.js:851` and preserved through the spread at `tradeValidator.js:469`.

The warning "Stepien Rule not yet enforced for entitlements" in `entitlementWarnings.js:81` was written before Phase 12.2/13 completed the entitlements integration. It is a non-blocking advisory and is simply wrong.

**Action:** Remove Warning B. Phase 1.

---

### B — Entitlement Authoring Surface

**Finding:** Schema and persistence are complete. UI is JSON-editor only.

`EntitlementEditorModal.tsx` provides raw JSON editing behind feature flag `VITE_FEATURE_ENTITLEMENT_AUTHORING`. The schema (`architect.ts`) already defines `protectionMeta`, `swapControllerPickId`, `swapTargetDefinition`, `receivesComparator`, `receivesRank`, `poolUnderlyingPickIds`. `entitlementWriter.ts` has `writeWorldEntitlement()` and `validateEntitlementDocument()`.

No form-based authoring surface exists for protection ladders, swap definitions, or conveyance conditions.

**Action:** Add form tabs (Protection / Swap / Conveyance) inside `EntitlementEditorModal.tsx`. Phase 4.

---

### C — Sign-and-Trade

**Finding:** Backend is production-ready. UI has 3 wiring breaks.

`computeSignAndTradeResult` (`mutationPipeline.js:3151-3292`) is a fully-implemented 3-step atomic operation: sign → validate → trade. `validateSignAndTrade.js` enforces 8 rules. All 15 unit tests pass.

The handler `handleSignAndTrade` (`useArchitectActions.ts:708-736`) correctly constructs the payload and calls `persistMutation('signAndTrade', ...)`. But it is not exported in the `UseArchitectActionsReturn` interface (lines 244-300), so no caller can invoke it.

`GMDashboard.jsx` renders `EditContractModal` without an `onSignAndTrade` prop. Click produces no effect.

`FreeAgentPool.jsx:handleSignAndTrade` (line 89) calls the generic `onSign` and discards `destinationTeamId`. Player gets signed; trade never fires.

**Action:** (1) Export handler. (2) Wire prop in GMDashboard. (3) Fix FreeAgentPool callback. Phase 1.

---

### D — Trade Exceptions Display / TPE Math

**Finding:** Display broken on reload. Math is correct. "Cannot combine" is enforced.

`ExceptionTracker.jsx:126` reads `teamCapSheet.tradeExceptions`. Phase 64 normalization (`normalizeTeamTpe.js`) deletes this field before Firestore write and moves TPEs to `team.exceptions.tpe[]`. The helper `getTeamTpeList()` (same file, line 217) reads the canonical location with legacy fallback — it exists and is used correctly by `TradeExceptionDashboard.jsx:18` and `useTradeMachine.js:971`. ExceptionTracker does not use it.

In-session behavior: `computeTradeResult` writes to the legacy path (line 1347); normalization is deferred to `persistWorldMutation` (line 2430). Immediately after a trade, the legacy field is populated in memory, so TPEs appear. After reload they are gone. This explains intermittency.

TPE math: `createTPE` (`tradeUtilities.js:28-40`) computes `MAX(0, outgoing − incoming)`. Correct.

**Action:** Import `getTeamTpeList` in `ExceptionTracker.jsx`, replace destructure. Phase 1.

---

### E — Extensions in Contract View

**Finding:** Cap math is correct. Voiding indicator is schema-ready but never written.

`getContractYearSlice()` (`contractUtils.js:76-100`) merges both `contract.salariesByYear` and `futureContract.salariesByYear`, flagging extension rows with `isExtensionSeason: true`. CapSheet uses this for salary totals — numbers are right.

The extension mutation (`mutationPipeline.js:1742-1785`) adds years to `player.futureContract` but does not mark overlapping years on `player.contract` with `voidedByExtension: true`. The field exists on `BasePlayerContractYearZ` in `architect.ts`.

Result: contract tables show both the original year and the extension year for overlapping seasons with no visual distinction.

**Action:** Set `voidedByExtension` in mutation; dim voided rows in render. Phase 2.

---

### F — Salary Matching / Apron-Dependent Receive Limits

**Finding:** All 4 apron branches are complete and correct. One over-aggressive TPE block exists.

`validateSalaryMatching.js` branches correctly on under-cap / first-apron / second-apron / over-cap-below-first. `salaryMatchingRules.js` Band tiers are present and wired. `capUtils.js:getTeamApronStatus()` uses correct `>=` / `>` semantics per CBA Art VII Sec 2(f).

`getIncomingCeiling()` (`tradeHelpers.js:119-173`) correctly adds TPE value to the ceiling, filtering only prior-year TPEs for 2nd-apron teams. `basicRules.js:validateSecondApronRules` also correctly blocks only prior-year TPEs.

The single bug: `validateTradeExceptions.js:61-64` has an else branch that fires when no prior-year TPE is found but a second-apron team has any TPE at all. It pushes `SECOND_APRON_TPE_BLOCKED`, rejecting current-year TPEs that CBA permits. This creates a UI/validator conflict: the ceiling display shows room, the validator rejects.

**Action:** Delete the else branch. Add 2 tests (current-year allowed, prior-year blocked). Phase 3.

---

## Execution Log

### TM-1 — Gap C + Gap D Fixpack (2026-02-05) — COMPLETE

| Gap                       | Status                                                                                  | Return Package                             |
| ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| C (Sign-and-Trade wiring) | Fixed — handler exported, prop wired in GMDashboard + FreeAgencySection + FreeAgentPool | `return_packages/PHASE_TM_1_FIXPACK_P0.md` |
| D (TPE vanish on reload)  | Fixed — ExceptionTracker now uses `getTeamTpeList()`                                    | `return_packages/PHASE_TM_1_FIXPACK_P0.md` |

Tests: 19/19 target tests pass. 2603/2669 full suite (66 failures are pre-existing, none in TM-1 files).

Known follow-up: `handleSignAndTrade` payload may send `contract: null` on first real UI-triggered S&T due to `ensureContractStructure` expecting `salariesByYear` while EditContractModal passes `salaries`. Needs pipeline trace — out of TM-1 scope.

---

## Phased Execution Plan

### Phase 1 — Surgical Wiring (Gap A + C + D)

All changes are 1–3 lines per file. No new abstractions. No logic changes — only wiring and one import swap.

| #   | File                             | Change                                                                 |
| --- | -------------------------------- | ---------------------------------------------------------------------- |
| 1   | `entitlementWarnings.js:72-84`   | Delete Warning B if-block. Remove `hasStepienWarning` if dead.         |
| 2   | `useArchitectActions.ts:244-300` | Add `handleSignAndTrade` to interface + return object.                 |
| 3   | `GMDashboard.jsx:~427`           | Add `onSignAndTrade={actions.handleSignAndTrade}` prop.                |
| 4   | `FreeAgentPool.jsx:81-91`        | Rewrite to call `onSignAndTrade(player, contract, destinationTeamId)`. |
| 5   | `ExceptionTracker.jsx:126`       | Import `getTeamTpeList`; replace destructure with its return value.    |

**Tests:** `signAndTrade.test.js`, TPE lifecycle tests, entitlementWarning tests (if any).

---

### Phase 2 — Extension Voiding (Gap E)

| #   | File                        | Change                                                                                                                                                            |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `mutationPipeline.js:~1757` | After building `rawFutureContract`, iterate `player.contract.salariesByYear`. Set `voidedByExtension: true` on any entry whose season overlaps an extension year. |
| 2   | Contract table render (TBD) | Dim or hide rows where `voidedByExtension === true`.                                                                                                              |

**Tests:** Extension mutation tests. Visual regression on contract table.

---

### Phase 3 — Second Apron TPE Correction (Gap F) — SHIPPED 2026-02-05

| #   | File                                     | Change                                                                                                                          |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `validateTradeExceptions.js:61-64`       | Else branch deleted. `SECOND_APRON_TPE_BLOCKED` import removed. Only `if (hasPriorYearTPE)` remains.                            |
| 2   | `tests/trade/secondApron_tpeBan.test.js` | Second test rewritten: asserts `tradeExceptions` rule passes and no TPE violation fires for current-year TPE on 2nd-apron team. |

**Result:** 3/3 tests pass. `getIncomingCeiling` and validator now agree.

---

### Phase 3.1 — Extensions Display (Gap E) — SHIPPED 2026-02-05

| #   | File                                                            | Change                                                                                              |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | `mutationPipeline.js` (`computeExtensionResult`)                | Overlapping original years marked `voidedByExtension: true` before extension rows are concatenated. |
| 2   | `PlayerContractMini.jsx`                                        | Voided rows rendered with `opacity-30 line-through` and "Voided" label.                             |
| 3   | `tests/architect/extension_voidedByExtension.test.js`           | 3 unit tests: overlap detected, no-overlap clean, season-string format.                             |
| 4   | `tests/architect/PlayerContractMini.voidedByExtension.test.jsx` | 4 render tests: label present/absent, CSS classes, salary hidden for voided.                        |

**Result:** 7/7 tests pass.

---

### Phase 3.2 — Stale Stepien Warning Removal (Gap A) — SHIPPED 2026-02-05

| #   | File                     | Change                                                             |
| --- | ------------------------ | ------------------------------------------------------------------ |
| 1   | `entitlementWarnings.js` | Warning B block, `hasStepienWarning` flag, and JSDoc line removed. |

**Result:** No test references the removed message. Stepien enforcement (`validateStepien.js`) untouched.

---

### TM-4 — Entitlement Authoring (2026-02-05) — COMPLETE

| Area                | Status | Notes                                                                                     |
| ------------------- | ------ | ----------------------------------------------------------------------------------------- |
| Form-based editor   | ✅     | Tabbed editor (Basics, Protection, Swap, Conveyance, Advanced JSON) replaces JSON-only UI |
| Trade Machine entry | ✅     | Edit icon on entitlement rows opens modal                                                 |
| Persistence         | ✅     | Writes to world overrides via `writeWorldEntitlement()`                                   |
| Display refresh     | ✅     | Updated protection/swap/conveyance details appear in Trade Machine rows                   |
| Validation          | ✅     | Schema + ladder validation blocks invalid saves                                           |

Return package: `return_packages/PHASE_TM_4_ENTITLEMENT_AUTHORING_EXECUTION.md`

---

### TM-5 — Entitlement Terms Simulation + Trade Machine Integration (2026-02-05) — COMPLETE

| Area                  | Status | Notes                                                                             |
| --------------------- | ------ | --------------------------------------------------------------------------------- |
| Terms normalization   | ✅     | `entitlementTerms.ts` normalizes ladders/swaps/conveyance and produces `draftKey` |
| Trade payload/receipt | ✅     | Outgoing/incoming entitlements carry `terms`, `termsShort`, `draftKey`            |
| UI display            | ✅     | Trade rows, summary, and export show concise `termsShort`                         |
| Stepien integration   | ✅     | Conservative ladder handling, swapType parsing, conveyance warnings               |

Return package: `return_packages/PHASE_TM-5_ENTITLEMENT_SIMULATION_INTEGRATION.md`

---

### TM-6 — Entitlement Editing + Terms Integration MVP (2026-02-05) — COMPLETE

| Area                | Status | Notes                                                                               |
| ------------------- | ------ | ----------------------------------------------------------------------------------- |
| Edit entry point    | ✅     | Already wired in TM-4/5 — click pencil icon on entitlement row opens modal          |
| SwapType visibility | ✅     | `formatEntitlementTermsShort()` now shows "Swap best (2028)" or "Swap worst (2028)" |
| Pooled indicator    | ✅     | Purple Layers icon shows on pooled entitlements in Trade Machine rows               |
| Stepien warnings    | ✅     | Specific messages with tier count and pool size replace vague "conservatively" text |
| Terms everywhere    | ✅     | Row, summary, receipt, export all use same `termsShort` format                      |

**Files changed:**

- `entitlementTerms.ts:263-268` — Added swapType label to formatEntitlementTermsShort()
- `EntitlementPickRow.jsx:27,73,179-188` — Added Layers import, isPooled check, pooled indicator JSX
- `validateStepien.js:149-181` — Improved warning message specificity with tier count and pool size

**Tests added:**

- `src/tests/entitlements/entitlementTermsShort.test.ts` — swapType visibility (7 cases)
- `src/tests/architect/entitlementPickRowDisplay.test.jsx` — pooled/encumbered indicators
- `src/tests/tradeMachine/stepienObligations.test.js` — TM-6 warning message tests (5 cases)
- `src/tests/architect/entitlementEditorModal.test.tsx` — TM-6 edit flow integration tests

**Out of scope (deferred to TM-7+):**

- Full ladder outcome resolution (tier-by-tier ownership simulation)
- Full conveyance pool resolution (ranked selection simulation)
- Full multi-team swap graph resolution

Return package: `return_packages/PHASE_TM_6_ENTITLEMENT_AUTHORING_MVP.md`

---

### Phase 4 — Entitlement Authoring Surface (Gap B) — SHIPPED 2026-02-05

| #   | File                                                                        | Change                                                               |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `src/features/architect/admin/EntitlementEditorModal.tsx` + tab components  | Replaced JSON-only modal with tabbed form + Advanced JSON.           |
| 2   | `src/features/architect/utils/entitlements/entitlementWriter.ts`            | Added validation for kind-specific fields + protection ladder tiers. |
| 3   | `src/features/architect/tradeMachine/EntitlementPickRow.jsx`                | Added edit icon entry point.                                         |
| 4   | `src/features/architect/hooks/useTradeMachine.js`                           | Added `applyEntitlementOverrideUpdate()` to refresh local state.     |
| 5   | `src/features/architect/utils/entitlements/entitlementPickRowProjection.js` | Display ladder + swap/conveyance details.                            |
| 6   | `src/features/architect/utils/entitlements/dare/protectionLadderFactory.ts` | Prefer `protectionLadder` override when present.                     |

**Tests:** `entitlementEditorModal.test.tsx`, `entitlementPickRowDisplay.test.jsx`

---

### TM-8 — Pick Editor UX Overhaul (P0 Wizard Layer) — SHIPPED 2026-02-05

**Goal:** Make entitlement editing obvious and guided so a random user can create/edit protections, swaps, and conveyance rights without understanding schema or typing pick IDs.

**What Changed:**

| #   | File                                                                      | Change                                                                                                                               |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `src/features/architect/admin/PickRightWizardModal.tsx`                   | New wizard modal — default entrypoint from pencil icon and "New Pick Right" button. Wraps existing tabbed editor as "Advanced" mode. |
| 2   | `src/features/architect/admin/PickSelector.tsx`                           | New Team/Year/Round dropdown component that generates canonical pick IDs via `generatePickId()`. No manual typing required.          |
| 3   | `src/features/architect/admin/PlainEnglishPreview.tsx`                    | New plain-English + termsShort + validity indicator preview panel.                                                                   |
| 4   | `src/features/architect/admin/pickRightWizardDraft.ts`                    | New localStorage draft helpers (save/load/clear/hasDraft).                                                                           |
| 5   | `src/features/architect/admin/PickRightWizardSteps/WizardStepIntent.tsx`  | Step 1: "What are you doing?" — 4 cards for pick ownership, swap, conveyance, or advanced editor.                                    |
| 6   | `src/features/architect/admin/PickRightWizardSteps/WizardStepDetails.tsx` | Step 2: Kind-specific inputs using PickSelector + protection templates + swap type radios + conveyance pool management.              |
| 7   | `src/features/architect/admin/PickRightWizardSteps/WizardStepReview.tsx`  | Step 3: Review + Apply/Save Draft with full field summary and PlainEnglishPreview.                                                   |
| 8   | `src/features/architect/tradeMachine/TradeEditor.jsx`                     | Replaced `EntitlementEditorModal` render with `PickRightWizardModal` (~3 lines changed).                                             |

**How to Use the Wizard:**

1. Click the pencil icon on any entitlement row (or "New Pick Right" button) — the wizard opens instead of the raw tabbed editor.
2. **Step 1 (create mode only):** Choose what you're doing — protect a pick, create a swap, create a conveyance, or jump to advanced editor.
3. **Step 2:** Fill in details using dropdown selectors. For protections, pick a template (e.g., "Top 3 → Unprotected") to auto-fill the ladder.
4. **Step 3:** Review the plain-English preview and termsShort. Save Draft (localStorage only) or Apply (writes to Firestore world override).
5. The "Open Advanced Editor" link is always visible to switch to the full tabbed form with all fields.

**Feature Flag:** `VITE_FEATURE_ENTITLEMENT_AUTHORING=true` — same flag gates both the wizard and the advanced editor. If disabled, the modal shows "Feature Disabled".

**Draft vs Apply:**

- **Save Draft**: Stores wizard form state in `localStorage` keyed by `pickrightdraft:{worldId}:{entitlementId|new}`. Does NOT write to Firestore. If a draft exists when the wizard opens, a "Restore Draft?" prompt appears.
- **Apply**: Writes via existing `writeWorldEntitlement()` path (world override in `architect_worlds/{worldId}/entitlements/`). On success, the draft is cleared automatically.

**Pick ID Generation:** Uses existing `generatePickId()` from `pickIdUtils.js`. Canonical format: `{TEAM}_{YEAR}_{ROUND}` (e.g., `BOS_2027_1`). The `PickSelector` component generates this from dropdowns; an "Advanced: edit raw pick ID" toggle provides direct text input for power users.

**Tests:** `pickRightWizard.test.tsx`, `pickRightWizardDraft.test.ts`, `pickSelector.test.tsx` (25+ test cases covering wizard flows, draft persistence, and pick ID selector behavior).

**No Breaking Changes:** The existing `EntitlementEditorModal` component is fully preserved. The wizard wraps it and delegates to the same `useEntitlementEditorState` hook, `buildEntitlementDocument`, `validateEntitlementDocument`, and `writeWorldEntitlement` paths. No trade validation logic was modified.

---

### TM-9B — Draft v2 Test Fix (2026-02-10) — COMPLETE

**Goal:** Fix 2 failing unit tests in `pickRightWizardDraft.test.ts` by updating assertions/fixtures to match the current v2 draft envelope format used by `saveDraft()` / `loadDraft()`.

**What Changed:**

| #   | File                                               | Change                                                                                                                                                                      |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/tests/architect/pickRightWizardDraft.test.ts` | Added `mockWizardModel` fixture. Updated all `saveDraft()` calls to include `wizardModel` (4-param signature). Updated assertions for v2 envelope. Added v1 migration test. |

**Root Cause:** Tests were written for v1 flat formState format but production code had already been upgraded to v2 envelope format (`{ version: 2, wizardModel, formState }`) during TM-9 Wizard Translation Layer implementation. Tests called `saveDraft()` with only 3 parameters (missing `wizardModel`) and expected `loadDraft()` to return raw `formState` instead of v2 envelope shape.

**V2 Envelope Format:**

```typescript
type DraftEnvelope = {
  version: 2;
  wizardModel: WizardModel; // Wizard UI state
  formState: EntitlementFormState; // Schema-layer form state
};
```

**localStorage key format:** `pickrightdraft:{worldId}:{entitlementId}`

**Test Results:**

- `pickRightWizardDraft.test.ts`: ✅ **11/11 tests pass** (was 8/10 before fix — 2 failures resolved)
- `wizardTranslation.test.ts` + `pickRightWizard.test.tsx`: ✅ **60/60 tests pass** (no regressions)
- Production build: ✅ succeeds (30.79s)

**No Production Code Changes:** ✅ Zero changes to draft persistence logic. Runtime behavior unchanged. All wizard UI functionality preserved.

Return package: `return_packages/trade_machine/TM_9B_EXECUTION_RETURN_PACKAGE.md`

---

### TM-10: Wizard Common Presets (2026-02-10)

**Problem:** The wizard showed 6 protection templates that included niche patterns (Top 3, Top 5 → Top 3, converts-to-2nd). Users needed the most common NBA protections front and center, with Advanced Editor as the escape hatch for custom ladders.

**Solution:** Introduced `WIZARD_PRESETS` — a curated 5-item preset list for the wizard, separate from the full `PROTECTION_TEMPLATES` used by Advanced Editor.

**Wizard presets (exactly 5):**

| Preset | Schema Mapping |
|--------|---------------|
| Unprotected | Empty ladder — pick conveys regardless |
| Top 4 protected → Unprotected next year | 2-tier: Y0 "Top 4" roll, Y1 "Unprotected" cancel |
| Top 10 protected → Unprotected next year | 2-tier: Y0 "Top 10" roll, Y1 "Unprotected" cancel |
| Lottery protected (Top 14) → Unprotected next year | 2-tier: Y0 "Lottery" roll, Y1 "Unprotected" cancel |
| Lottery → Top 10 → Unprotected | 3-tier: Y0 "Lottery" roll, Y1 "Top 10" roll, Y2 "Unprotected" cancel |

**Swap labels:** "Swap most favorable" (best_of) / "Swap least favorable" (worst_of).

**Microcopy:** "These are the most common NBA protections. For custom protections or special rules, open Advanced Editor."

**Files changed:**

- `ProtectionLadderTemplates.ts` — added `WIZARD_PRESETS` export
- `WizardStepDetails.tsx` — imports `WIZARD_PRESETS`; updated swap labels
- `pickEditorCopy.ts` — added `swapBestOf`/`swapWorstOf` labels + updated help text
- `wizardTranslation.test.ts` — 8 new tests for preset list, ladder output, validation pipeline

**Test Results:**

- `wizardTranslation.test.ts`: ✅ **45/45 tests pass** (8 new TM-10 tests)
- `pickRightWizardDraft.test.ts`: ✅ **11/11 tests pass**
- `pickSelector.test.tsx`: ✅ **10/10 tests pass**
- Production build: ✅ succeeds

**No schema changes.** Advanced Editor unchanged. `PROTECTION_TEMPLATES` preserved as-is.

Return package: `return_packages/trade_machine/TM-10_WIZARD_COMMON_PRESETS_RETURN_PACKAGE.md`

---

## Key Invariants (do not regress)

1. **Stepien IS enforced on entitlements.** `validateStepien.js` processes `entitlementsOut`. Do not remove or gate this path.
2. **TPE canonical location is `team.exceptions.tpe[]`.** Do not write to `team.tradeExceptions` in any new code. Use `getTeamTpeList()` for reads.
3. **Second apron semantics: salary `>` secondApron (strict).** First apron: salary `>=` firstApron. Per CBA Art VII Sec 2(f).
4. **S&T is atomic.** Signing failure must short-circuit before trade computation. Do not decouple.
5. **Extension years use `futureContract`.** `getContractYearSlice()` is the SSOT for merging. Do not bypass it.
