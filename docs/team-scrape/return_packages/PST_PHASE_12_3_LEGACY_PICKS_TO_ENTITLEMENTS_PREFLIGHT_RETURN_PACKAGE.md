# PST Phase 12.3 — Legacy Picks → Entitlements Preflight Return Package

**MODE**: PREFLIGHT (READ-ONLY)  
**DATE**: 2026-01-30  
**STATUS**: COMPLETE

---

## 1. Executive Summary (10 lines max)

The Architect codebase currently operates in **DUAL MODE**:

- **UI**: TradeTeamCard conditionally renders `EntitlementPicksList` (when entitlements exist) OR `OutgoingPicksList` (legacy fallback)
- **Validation**: Stepien rule uses entitlement baseline when `validationEntitlements.length > 0`, otherwise falls back to `draftPicksObligations`
- **Mutation**: Trade execution builds `entitlementsTraded` metadata but does NOT transfer `entitlementIds` between teams
- **Persistence**: Legacy `picksOut` arrays still written to trade payloads; entitlement transfer not wired

**Top 3 Mismatch Risks**:

1. **Mutation gap**: Entitlements shown in UI/receipt but NOT transferred in world snapshots (entitlementIds not updated)
2. **Validation inconsistency**: Stepien baseline may differ between entitlement-mode and legacy-mode teams in same trade
3. **UI fallback flicker**: If entitlements load slowly, UI may temporarily show legacy picks then switch

---

## 2. Firestore Schema Map (Picks vs Entitlements)

| Field / Path                                               | Type               | Read by                                                | Written by                 | Status       | Notes                                          |
| ---------------------------------------------------------- | ------------------ | ------------------------------------------------------ | -------------------------- | ------------ | ---------------------------------------------- |
| `architect_base_teams/{teamId}/draftPicks`                 | BaseTeams          | useTradeMachine (L242), firebaseTeamPlanHelpers (L164) | Team upload scripts        | **ACTIVE**   | Original array, backward compat                |
| `architect_base_teams/{teamId}/draftPicksInventory`        | BaseTeams          | useTradeMachine (L242), firebaseTeamPlanHelpers (L167) | Team upload scripts        | **ACTIVE**   | Alias for draftPicks                           |
| `architect_base_teams/{teamId}/draftPicksObligations`      | BaseTeams          | validateStepien (L165), firebaseTeamPlanHelpers (L169) | Team upload scripts        | **FALLBACK** | Legacy Stepien baseline (when no entitlements) |
| `architect_base_teams/{teamId}/draftPicksContested`        | BaseTeams          | firebaseTeamPlanHelpers (L171)                         | Team upload scripts        | **ACTIVE**   | Swaps/conditionals                             |
| `architect_base_teams/{teamId}/entitlementIds`             | BaseTeams          | entitlementResolver, useTradeMachine (L259)            | Team upload scripts        | **ACTIVE**   | Array of held entitlement IDs                  |
| `architect_base_entitlements/{entId}`                      | BaseEntitlements   | entitlementResolver.ts                                 | PST pipeline scripts       | **ACTIVE**   | Canonical entitlement definitions              |
| `architect_worlds/{worldId}/teams/{teamId}/draftPicks`     | World Snapshot     | (not directly queried)                                 | mutationPipeline           | **UNKNOWN**  | May be stale if not synced                     |
| `architect_worlds/{worldId}/teams/{teamId}/entitlementIds` | World Snapshot     | entitlementResolver (world merge)                      | mutationPipeline (partial) | **ACTIVE**   | Updated in computeTradeResult but incomplete   |
| `architect_worlds/{worldId}/entitlements/{entId}`          | World Entitlements | entitlementResolver (world override)                   | (not yet wired)            | **ACTIVE**   | World-specific entitlement overrides           |

---

## 3. Code Search Results: Legacy Pick Touchpoints

| Surface        | File Path                                                            | Symbol/Function              | Legacy Field(s) Used                                                                | What It Does                                    | Risk | Migration Target                                 |
| -------------- | -------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- | ---- | ------------------------------------------------ |
| **Loader**     | `src/features/architect/hooks/useTradeMachine.js`                    | L238-242                     | `draftAssets.picks`, `draftPicks`, `picks`                                          | Priority chain to load available picks for team | MED  | Remove once entitlements fully wired             |
| **Loader**     | `src/features/architect/hooks/useTradeMachine.js`                    | L558-562                     | `draftAssets.picks`, `draftPicks`, `picks`                                          | Same priority chain for selectTeam()            | MED  | Remove once entitlements fully wired             |
| **State**      | `src/features/architect/hooks/useTradeMachine.js`                    | L313, L316, L545, L655, L669 | `picksOut`                                                                          | Trade slot array for outgoing picks             | HIGH | Replace with `entitlementsOut` only              |
| **Toggle**     | `src/features/architect/hooks/useTradeMachine.js`                    | L473-482                     | `picksOut`                                                                          | togglePick adds/removes from picksOut           | HIGH | Remove when entitlement toggle is sole path      |
| **Edit**       | `src/features/architect/hooks/useTradeMachine.js`                    | L524-529                     | `picksOut[].protection`, etc.                                                       | updatePickField modifies pick properties        | HIGH | N/A (entitlements don't have protection)         |
| **Validate**   | `src/features/architect/hooks/useTradeMachine.js`                    | L729, L796                   | `picksOut`, `outgoingPicks`                                                         | Passes legacy picks to validateTrade()          | HIGH | Pass entitlementsOut only                        |
| **Validation** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | L119-120                     | `picksOut`, `outgoingPicks`                                                         | Reads legacy outgoing picks                     | MED  | Already merged with entitlement picks            |
| **Validation** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | L165                         | `draftPicksObligations`                                                             | Legacy baseline for Stepien (fallback)          | MED  | Remove fallback once all teams have entitlements |
| **Mutation**   | `src/features/architect/utils/mutationPipeline.js`                   | (not found)                  | `picksOut`                                                                          | Trade execution uses picksOut for legacy        | HIGH | Wire entitlement transfer instead                |
| **UI**         | `src/features/architect/tradeMachine/OutgoingPicksList.jsx`          | L17                          | `team.picks`                                                                        | Displays available legacy picks                 | HIGH | Remove component once entitlements universal     |
| **UI**         | `src/features/architect/tradeMachine/TradePickRow.jsx`               | entire file                  | pick object shape                                                                   | Renders individual legacy pick row              | HIGH | Remove component once entitlements universal     |
| **UI**         | `src/features/architect/tradeMachine/TradeTeamCard.jsx`              | L735                         | `picks` prop                                                                        | Passes picks to OutgoingPicksList               | MED  | Conditional already exists (L723-745)            |
| **UI**         | `src/features/architect/tradeMachine/TradeEditor.jsx`                | L72, L153                    | `t.picksOut`                                                                        | Builds trade summary from legacy picks          | HIGH | Replace with entitlementsOut                     |
| **UI**         | `src/features/architect/tradeMachine/TradeExportCapture.jsx`         | L37                          | `t.picksOut`                                                                        | Exports trade data with legacy picks            | MED  | Include entitlementsOut in export                |
| **Utils**      | `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`  | L43                          | `t.picksOut`                                                                        | Computes cache key from picks                   | LOW  | Add entitlementsOut to key                       |
| **Loader**     | `src/features/architect/utils/firebaseTeamPlanHelpers.js`            | L164-171                     | `draftPicks`, `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` | Normalizes team doc from Firestore              | MED  | Keep for backward compat until data cleaned      |
| **Schema**     | `src/schemas/architect.ts`                                           | L260-267                     | `draftPicks`, `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` | Zod schema for BaseTeamDocZ                     | LOW  | Mark as deprecated, keep for compat              |
| **GM Actions** | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`    | L183, L578                   | `draftPicks`, `picksOut`                                                            | Type definitions and empty array defaults       | LOW  | Update types when ready                          |
| **GM State**   | `src/features/architect/GMDashboard/hooks/useArchitectState.ts`      | L126                         | `draftPicks`                                                                        | Type definition                                 | LOW  | Update types when ready                          |

---

## 4. Code Search Results: Entitlement Touchpoints

| File Path                                                                    | How Entitlements Loaded/Resolved                                                                                                               | Where Used Properly                                                                                                    | Where Ignored/Incomplete                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/entitlementResolver.ts`           | Merges base entitlements with world overrides via `resolveEntitlement()`, `resolveEntitlementsForTeam()`, `resolveEntitlementsForTeamWithDb()` | Clean separation, no legacy references                                                                                 | ✅ Fully implemented                                                            |
| `src/features/architect/hooks/useTradeMachine.js`                            | Calls `resolveEntitlementsForTeam()` at L259, L585 for slot 0 and selectTeam()                                                                 | Stores resolved entitlements in `team.entitlements`, manages `entitlementsOut` array                                   | `entitlementsOut` passed to validator but NOT to mutation pipeline for transfer |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js`         | Receives `validationEntitlements` and `entitlementsOut` at L137, L142                                                                          | Uses `buildStepienBaselinePicksFromEntitlements()` and `buildStepienOutgoingPicksFromEntitlements()` for Stepien check | ✅ Properly integrated (Phase 12.1/12.2)                                        |
| `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js` | N/A (utility functions)                                                                                                                        | Converts entitlements to Stepien-compatible picks                                                                      | ✅ Fully implemented                                                            |
| `src/features/architect/tradeMachine/EntitlementPicksList.jsx`               | Receives `entitlements` prop                                                                                                                   | Renders entitlements with selection support                                                                            | ✅ Fully implemented (Phase 11.0/11.1)                                          |
| `src/features/architect/tradeMachine/EntitlementPickRow.jsx`                 | Receives single entitlement                                                                                                                    | Renders row with kind badge, warnings                                                                                  | ✅ Fully implemented                                                            |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx`                      | Receives `entitlementsOut` prop, checks `team.entitlements?.length > 0`                                                                        | Conditionally renders EntitlementPicksList vs OutgoingPicksList                                                        | ✅ Conditional logic works                                                      |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`                  | Receives entitlements from trade slot                                                                                                          | Shows "Entitlements Traded" section with warnings                                                                      | ✅ Fully implemented (Phase 11.2)                                               |
| `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`                  | Receives trade receipt with entitlement metadata                                                                                               | Shows outgoing/incoming entitlements with routing badges                                                               | ✅ Fully implemented (Phase 11.3)                                               |
| `src/features/architect/utils/mutationPipeline.js`                           | L1304-1321                                                                                                                                     | Builds `entitlementsTraded` metadata for event log                                                                     | **INCOMPLETE**: Does not transfer `entitlementIds` between team snapshots       |

---

## 5. "Dual Mode" Mismatch Matrix

| Mismatch Class       | Component A               | Uses                                                                                 | Component B             | Uses                                      | Risk Level   | Notes                                                |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------ | ----------------------- | ----------------------------------------- | ------------ | ---------------------------------------------------- |
| **UI Display**       | TradeTeamCard (picks tab) | `team.entitlements?.length > 0` ? EntitlementPicksList : OutgoingPicksList           | —                       | —                                         | MED          | Conditional switch may cause flicker                 |
| **Stepien Baseline** | validateStepien           | `validationEntitlements.length > 0` ? entitlement baseline : `draftPicksObligations` | —                       | —                                         | HIGH         | Different code paths could produce different results |
| **Outgoing Assets**  | useTradeMachine           | Maintains both `picksOut` AND `entitlementsOut`                                      | validateTrade           | Receives both, merges for Stepien         | MED          | Redundant data structures                            |
| **Trade Payload**    | useTradeMachine L729      | `picksOut` (legacy) + `entitlementsOut` (new)                                        | mutationPipeline        | Reads `entitlementsOut` for metadata ONLY | HIGH         | Entitlement ownership not transferred                |
| **Trade Receipt**    | tradeValidator            | Builds `outgoingEntitlements` + `incomingEntitlements`                               | TradeReceiptPanel       | Displays both correctly                   | LOW          | Observability works                                  |
| **Event Metadata**   | mutationPipeline          | Builds `entitlementsTraded`                                                          | World events collection | Persisted correctly                       | LOW          | Audit trail works                                    |
| **Team Snapshot**    | mutationPipeline          | Does NOT update `entitlementIds` for receiving team                                  | Future reads            | Missing transferred entitlements          | **CRITICAL** | Must fix in Phase 13 or 14                           |

---

## 6. Recommended Migration Order (Short, No Implementation)

1. **Phase 13: Mutation Pipeline Entitlement Transfer** — Wire `entitlementIds` transfer in `computeTradeResult()`. When a team sends entitlements, remove IDs from sender's `entitlementIds` and add to receiver's. This is the **critical gap** that makes entitlement trading incomplete.

2. **Phase 13.1: Validate Mutation Correctness** — Add integration tests verifying that after a trade, `entitlementIds` arrays are correctly updated in world team snapshots.

3. **Phase 14: Remove Legacy Fallbacks in Validation** — Once all base teams have `entitlementIds` populated, remove the `draftPicksObligations` fallback in `validateStepien.js`. Require entitlements for Stepien.

4. **Phase 14.1: UI Cleanup** — Remove `OutgoingPicksList`, `TradePickRow`, and the conditional in `TradeTeamCard`. Always use `EntitlementPicksList`.

5. **Phase 14.2: Trade Payload Cleanup** — Remove `picksOut` from trade slot shape. Only use `entitlementsOut`.

6. **Phase 15: Schema Deprecation** — Mark `draftPicks`, `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` as deprecated in schema. Keep for backward compat but log warnings on access.

7. **Phase 15.1: Test Fixture Cleanup** — Update test fixtures to use entitlement-based structures instead of `picksOut` arrays.

8. **Phase 16: Data Cleanup** — Once confident, remove deprecated fields from Firestore documents during next data pipeline run.

---

## 7. Open Questions / Unknowns

| #   | Question                                                                                               | Impact                                               | Suggested Resolution                               |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| 1   | Does `architect_worlds/{worldId}/teams/{teamId}/draftPicks` get updated during trades, or is it stale? | May cause drift between legacy and entitlement views | Inspect mutationPipeline for draftPicks writes     |
| 2   | Are there any other validation rules (besides Stepien) that use legacy pick fields?                    | Could break if we remove fields prematurely          | Grep for `draftPicks` in `/rules/`                 |
| 3   | Do trade exception flows interact with picks/entitlements?                                             | TPE creation tied to trade mechanics                 | Verify TPE flow doesn't depend on legacy picks     |
| 4   | Are there TypeScript parallel files (`.ts` alongside `.js`) that need alignment?                       | May cause type mismatches                            | Audit `/rules/` for .ts duplicates                 |
| 5   | How should `draftPicksContested` (swaps) map to entitlements?                                          | Swaps are entitlements but also legacy               | Verify swap entitlements cover all contested picks |
| 6   | What happens if a team has BOTH legacy picks AND entitlementIds?                                       | UI chooses one, validation may use both              | Define clear precedence rule                       |

---

## 8. Required File Inspections Summary

| File                                                                 | Legacy Picks Found                                                                  | Entitlements Found                                              | Mode                 | Key Finding                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `src/features/architect/hooks/useTradeMachine.js`                    | `draftAssets.picks`, `draftPicks`, `picks`, `picksOut`                              | `entitlements`, `entitlementsOut`, `resolveEntitlementsForTeam` | **DUAL**             | Maintains both arrays; passes both to validator                               |
| `src/features/architect/utils/mutationPipeline.js`                   | None directly for draft picks                                                       | `entitlementsOut` (L1304) for metadata                          | **PARTIAL**          | Builds event metadata but does NOT transfer entitlementIds                    |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | `outgoingPicks`                                                                     | `entitlementsOut`, `validationEntitlements` (receipt only)      | **DUAL**             | Passes entitlements through to receipt; does not validate them beyond Stepien |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | `picksOut`, `outgoingPicks`, `draftPicksObligations`                                | `validationEntitlements`, `entitlementsOut`                     | **DUAL**             | Conditional baseline selection; merges both outgoing sources                  |
| `src/schemas/architect.ts`                                           | `draftPicks`, `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` | `entitlementIds`, `EntitlementAssetZ`                           | **BOTH ACTIVE**      | Schema defines both; no deprecation markers                                   |
| `src/features/architect/utils/entitlements/entitlementResolver.ts`   | None                                                                                | Full entitlement resolution logic                               | **ENTITLEMENT ONLY** | Clean separation                                                              |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx`              | `picks` prop, `OutgoingPicksList`                                                   | `entitlements`, `entitlementsOut`, `EntitlementPicksList`       | **DUAL**             | Conditional render at L723-745                                                |
| `src/features/architect/tradeMachine/OutgoingPicksList.jsx`          | `team.picks`, `picks` prop                                                          | None                                                            | **LEGACY ONLY**      | To be removed in Phase 14.1                                                   |
| `src/features/architect/tradeMachine/TradePickRow.jsx`               | Full legacy pick object                                                             | None                                                            | **LEGACY ONLY**      | To be removed in Phase 14.1                                                   |
| `src/features/architect/tradeMachine/EntitlementPicksList.jsx`       | None                                                                                | `entitlements`, `selectedEntitlementIds`                        | **ENTITLEMENT ONLY** | Fully implemented                                                             |

---

## 9. Conclusion

The system is in a **controlled dual-mode state** where:

- ✅ Entitlements are loaded and displayed correctly
- ✅ Entitlement selection for trading works
- ✅ Stepien validation uses entitlements when available
- ✅ Trade receipt shows entitlement metadata
- ❌ **CRITICAL GAP**: Entitlement ownership transfer NOT wired in mutation pipeline
- ⚠️ Legacy fallbacks still active for teams without entitlementIds

**Recommended Next Step**: Phase 13 should prioritize wiring `entitlementIds` transfer in `computeTradeResult()` before any cleanup work.

---

**END OF RETURN PACKAGE**
