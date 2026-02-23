# ENTITLEMENTS_E2E_DEEP_REVIEW_RETURN_PACKAGE

Date: 2026-02-23
Scope: Entitlements lifecycle audit across schema, storage, UI authoring, validation, trade/Stepien, ownership resolution, world persistence, and DARE season advance.

## Ship-Readiness Verdict
⚠️ **Not ship-ready**

Blockers:
1. No enforced **league-wide claim uniqueness** for pick outcomes.
2. Stepien validation computes entitlement baseline but does not use it in consecutive-year legality decisions.
3. Entitlement resolver world fallback chain does not match team/world fallback chain (parent-world drift).
4. Season advance DARE persistence path uses ungated mutator, bypassing exclusivity gate.

## Core Questions (Pass/Fail)
1. Truth & uniqueness (no overlap guarantee): **Fail**.
2. Stepien/trade integration correctness: **Fail**.
3. Editor/authoring UX safety: **Fail**.
4. World persistence consistency: **Fail**.
5. Naming and ID strategy stability: **Partial fail**.
6. Performance and robustness: **Partial fail**.

## 1) System Map
### Data model and identity
- Canonical entitlement schema is `EntitlementAssetZ` in `src/schemas/architect.ts:29`.
- World override schema is partial passthrough `WorldEntitlementOverrideZ` in `src/schemas/architect.ts:65`.
- Team inventory anchor is `entitlementIds` on team docs in `src/schemas/architect.ts:307`.
- Identity key generation is kind-specific in `src/features/architect/utils/entitlements/entitlementIdentity.ts:139`.
- Deterministic IDs are derived from identity key and 32-bit hash in `src/features/architect/utils/entitlements/entitlementIdentity.ts:202` and `src/features/architect/utils/entitlements/entitlementIdentity.ts:311`.

### Firestore collections and paths
- Base entitlements collection constant: `ARCHITECT_BASE_ENTITLEMENTS_PATH` in `src/constants/collections.ts:40`.
- World collection constant: `ARCHITECT_WORLDS_COLLECTION` in `src/constants/collections.ts:57`.
- World entitlements subcollection constant: `ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION` in `src/constants/collections.ts:63`.
- Path helpers for world entitlements: `worldEntitlementsCol` in `src/features/architect/utils/architectFirestorePaths.ts:111`, `worldEntitlementRef` in `src/features/architect/utils/architectFirestorePaths.ts:126`.

### Write and validation surfaces
- Unified save entrypoint: `saveEntitlementFromFormState` in `src/features/architect/admin/saveEntitlementFromFormState.ts:86`.
- Schema validator for documents: `validateEntitlementDocument` in `src/features/architect/utils/entitlements/entitlementWriter.ts:119`.
- World write primitive: `writeWorldEntitlement` in `src/features/architect/utils/entitlements/entitlementWriter.ts:334`.
- Team inventory attach/detach primitives: `attachEntitlementToTeam` in `src/features/architect/utils/entitlements/entitlementWriter.ts:470`, `detachEntitlementFromTeam` in `src/features/architect/utils/entitlements/entitlementWriter.ts:525`.
- Identity move primitive: `moveWorldEntitlement` in `src/features/architect/utils/entitlements/moveWorldEntitlement.ts:66`.
- Per-team exclusivity validator: `validateEntitlementExclusivity` in `src/features/architect/utils/entitlements/entitlementExclusivityValidator.ts:173`.
- Team gate wrapper: `runTeamExclusivityGate` in `src/features/architect/utils/entitlements/runTeamExclusivityGate.ts:88`.

### Ownership resolution and world loading
- Entitlement resolver for team sets: `resolveEntitlementsForTeamWithDb` in `src/features/architect/utils/entitlements/entitlementResolver.ts:190`.
- Entitlement ID lookup path (world/base only): `resolveTeamEntitlementIds` in `src/features/architect/utils/entitlements/entitlementResolver.ts:120`.
- Team data fallback chain (world -> parent world -> base): `getTeam` in `src/features/architect/utils/teamLoader.js:34`.
- World team data utility explicitly depends on that chain in `src/features/architect/utils/worldTeamData.ts:72`.

### UI entrypoints
- Main entitlement modal in Trade Machine: `PickRightWizardModal` usage in `src/features/architect/tradeMachine/TradeEditor.jsx:526`.
- Wizard session + unified save: `useEntitlementEditorSession` in `src/features/architect/admin/useEntitlementEditorSession.ts:197`.
- Advanced JSON editor identity lock: `EntitlementEditorAdvancedTab` in `src/features/architect/admin/EntitlementEditorAdvancedTab.tsx:14`.
- Legacy/full editor shell: `EntitlementEditorModal` in `src/features/architect/admin/EntitlementEditorModal.tsx:42`.

### Trade and Stepien surfaces
- Trade validator orchestration: `validateTrade` in `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`.
- Entitlement routing checks: `validateEntitlementRouting` in `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js:57`.
- Stepien rule check: `validateStepien` in `src/features/architect/utils/tradeMachine/rules/validateStepien.js`.
- Entitlement-to-Stepien transforms and post-trade entitlement computation: `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`.
- Apply-time mutation pipeline gates: `applyWorldMutation` and `validateMutation*` in `src/features/architect/utils/mutationPipeline.js:450` and `src/features/architect/utils/mutationPipeline.js:567`.

### DARE and season advance surfaces
- Season advance calls DARE in `src/features/architect/utils/seasonManager.js:692`.
- DARE resolver entrypoint: `resolveAllDraftAssets` in `src/features/architect/utils/entitlements/dare/dareResolver.ts:198`.
- DARE mutator ungated path: `applyDAREResultsToBatch` in `src/features/architect/utils/entitlements/dare/entitlementMutator.ts:60`.
- DARE mutator gated path exists but is separate: `applyGatedDAREResultsToBatch` in `src/features/architect/utils/entitlements/dare/entitlementMutator.ts:402`.

## 2) E2E Flow Traces
### Flow 1: Create entitlement -> validate -> persist
1. UI submit in `PickRightWizardModal` triggers `handleApply` in `useEntitlementEditorSession` (`src/features/architect/admin/useEntitlementEditorSession.ts:347`).
2. `saveEntitlementFromFormState` builds document (`buildEntitlementDocument`), validates schema, computes deterministic ID (`src/features/architect/admin/saveEntitlementFromFormState.ts:95`, `src/features/architect/admin/saveEntitlementFromFormState.ts:113`).
3. Save-time exclusivity gate checks **holder team only** via `resolveEntitlementsForTeam(...holderTeam)` + `validateEntitlementExclusivity` (`src/features/architect/admin/saveEntitlementFromFormState.ts:136` to `src/features/architect/admin/saveEntitlementFromFormState.ts:145`).
4. World write executes `writeWorldEntitlement` (`src/features/architect/admin/saveEntitlementFromFormState.ts:366`, `src/features/architect/utils/entitlements/entitlementWriter.ts:334`).
5. Storage side effect: writes/merges `architect_worlds/{worldId}/entitlements/{entitlementId}` only (`src/features/architect/utils/entitlements/entitlementWriter.ts:370` to `src/features/architect/utils/entitlements/entitlementWriter.ts:390`).
6. No automatic attach to `teams/{teamCode}.entitlementIds` on create in this chain.

### Flow 2: Edit entitlement -> validate -> persist -> reload
1. Same entrypoint as create; `isEdit` is based on existing `originalEntitlementId` (`src/features/architect/admin/saveEntitlementFromFormState.ts:324`).
2. If identity unchanged: writes same ID via `writeWorldEntitlement` (`src/features/architect/admin/saveEntitlementFromFormState.ts:366`).
3. If identity changed: `moveWorldEntitlement` writes new doc, attempts delete old doc, then detach/attach team references (`src/features/architect/admin/saveEntitlementFromFormState.ts:337`, `src/features/architect/utils/entitlements/moveWorldEntitlement.ts:113` to `src/features/architect/utils/entitlements/moveWorldEntitlement.ts:140`).
4. Reload/read path resolves team entitlement IDs first, then base/override docs (`src/features/architect/utils/entitlements/entitlementResolver.ts:194` to `src/features/architect/utils/entitlements/entitlementResolver.ts:208`).
5. Storage side effect: identity moves can leave partial state if delete/attach/detach fail because move returns success despite warnings.

### Flow 3: Trade entitlement -> holdings update -> Stepien/legality -> world persistence
1. Trade validation runs route checks first with `validateEntitlementRouting` (`src/features/architect/utils/tradeMachine/engine/tradeValidator.js:523`).
2. Per-team validation includes Stepien and exclusivity preflight (`src/features/architect/utils/tradeMachine/engine/tradeValidator.js:628`, `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:648` to `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:719`).
3. `computePostTradeEntitlements` is strict for routing in multi-team contexts (`src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js:179`).
4. Mutation compute builds `entitlementsTraded` and `entitlementUpdates` patches for `holderTeam` (`src/features/architect/utils/mutationPipeline.js:1391` to `src/features/architect/utils/mutationPipeline.js:1468`).
5. Apply-time invariant gates: duplicate entitlement IDs then per-team exclusivity (`src/features/architect/utils/mutationPipeline.js:567` to `src/features/architect/utils/mutationPipeline.js:620`).
6. Storage side effect: holder patches written to world entitlement overrides via merge (`src/features/architect/utils/mutationPipeline.js:2516` to `src/features/architect/utils/mutationPipeline.js:2530`).

### Flow 4: Ownership resolution for protection/conveyance/swap/linked packages
1. Ownership base resolution is from `resolveEntitlementsForTeamWithDb` using team `entitlementIds` + base/world merges (`src/features/architect/utils/entitlements/entitlementResolver.ts:190` to `src/features/architect/utils/entitlements/entitlementResolver.ts:227`).
2. Protection and conveyance outcomes are resolved in DARE via `resolveConveyanceForEntitlement` (`src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts:138`).
3. Swap outcomes are resolved through swap graph ordering in `resolveAllDraftAssets` (`src/features/architect/utils/entitlements/dare/dareResolver.ts:365` to `src/features/architect/utils/entitlements/dare/dareResolver.ts:423`).
4. Linked package semantics are not hard-enforced; they surface as warnings only in trade UX (`src/features/architect/tradeMachine/utils/entitlementWarnings.js:84` to `src/features/architect/tradeMachine/utils/entitlementWarnings.js:101`).

## 3) Issues List
## Bugs / Incorrectness
### Blockers
#### B1. No league-wide no-overlap enforcement for pick outcome claims
Severity: **Blocker**  
Why incorrect: Save and trade gates validate per-team exclusivity or duplicate entitlement IDs, but do not enforce a global claim uniqueness invariant by underlying pick outcome across teams.  
Exact repro path: Create Team A `pick_ownership` for `LAL_2028_1st`; create Team B `pick_ownership` for the same `underlyingPickId` with a different entitlement ID; both saves pass because each save reads only holder-team entitlements.  
Impacted code surface: `src/features/architect/admin/saveEntitlementFromFormState.ts:136`, `src/features/architect/utils/leagueInvariants.ts:441`, `src/features/architect/utils/leagueInvariants.ts:719`, diagnostic-only detection in `src/features/architect/utils/entitlements/entitlementHealthReport.ts:240`.  
Fix strategy: Add a league-wide claim index gate (claim key from `computeEntitlementClaims`) and run it on save, trade apply, and DARE writes; fail closed on validator unavailability.

#### B2. Stepien baseline is computed but ignored in consecutive-year legality
Severity: **Blocker**  
Why incorrect: `validateStepien` builds baseline entitlement years but consecutive-year violation logic uses outgoing years only, so existing reserved/owed years are ignored in the violation check.  
Exact repro path: Team has baseline reservation in year N from `validationEntitlements`; trade out unprotected 1st in year N+1 only; function should detect consecutive owed/control gap but passes because baseline not included in `allStepienRelevant`.  
Impacted code surface: `src/features/architect/utils/tradeMachine/rules/validateStepien.js:188` to `src/features/architect/utils/tradeMachine/rules/validateStepien.js:239`; behavior codified in tests `src/tests/tradeMachine/stepienObligations.test.js:39` to `src/tests/tradeMachine/stepienObligations.test.js:75`.  
Fix strategy: Make Stepien operate on post-trade control/obligation model that combines baseline + outgoing delta, then re-evaluate consecutive-year legality on that resulting state.

#### B3. Entitlement resolver world fallback does not honor parent-world chain
Severity: **Blocker**  
Why incorrect: Team data loaders support `world -> parent world -> base`, but entitlement resolver does `world -> base` only, creating divergent world state interpretation.  
Exact repro path: Child world lacks team snapshot or entitlement IDs; team views can inherit parent via `teamLoader`, but entitlement resolver falls straight to base and misses parent-world entitlement state.  
Impacted code surface: `src/features/architect/utils/entitlements/entitlementResolver.ts:120` to `src/features/architect/utils/entitlements/entitlementResolver.ts:148`, contrasted with `src/features/architect/utils/teamLoader.js:55` to `src/features/architect/utils/teamLoader.js:61`, `src/features/architect/utils/worldTeamData.ts:72`.  
Fix strategy: Reuse one shared fallback resolver for team entitlement IDs and entitlement overrides that recursively checks parent worlds before base.

#### B4. Season advance DARE path bypasses exclusivity-gated mutator
Severity: **Blocker**  
Why incorrect: Season advance writes DARE results through ungated batch mutator, despite a gated mutator existing for exclusivity-safe writes.  
Exact repro path: Run season advance with DARE output that would produce conflicting entitlement claims; `applyDAREResultsToBatch` writes directly without `runTeamExclusivityGate` precheck.  
Impacted code surface: `src/features/architect/utils/seasonManager.js:696`, gated alternative in `src/features/architect/utils/entitlements/dare/entitlementMutator.ts:402`.  
Fix strategy: Replace seasonManager call with `applyGatedDAREResultsToBatch`; pre-resolve current team entitlements for affected teams and block DARE persistence on gate failure.

### Majors
#### M1. World create flow can orphan entitlements (saved doc not attached to team inventory)
Severity: **Major**  
Why incorrect: Resolver depends on team `entitlementIds`; create save writes entitlement doc but does not automatically add ID to team inventory.  
Exact repro path: In world mode create entitlement from wizard and click Apply; reload world; entitlement is absent from resolved team entitlements unless user manually attached ID in Team Inventory section.  
Impacted code surface: write-only create path `src/features/architect/admin/saveEntitlementFromFormState.ts:366`, `src/features/architect/utils/entitlements/entitlementWriter.ts:370`; manual attach UI only in advanced panel `src/features/architect/admin/PickRightWizardModal.tsx:224`, attach primitive `src/features/architect/utils/entitlements/entitlementWriter.ts:470`.  
Fix strategy: On successful create, atomically write entitlement doc and `arrayUnion(entitlementId)` to holder team; enforce in save path, not manual UI.

#### M2. Identity move returns success on partial failure
Severity: **Major**  
Why incorrect: Move operation logs delete failure and ignores attach/detach outcomes, then returns success, allowing silent data divergence.  
Exact repro path: Trigger move where delete or team inventory update fails; caller receives success and new ID while stale old doc and/or stale team references remain.  
Impacted code surface: `src/features/architect/utils/entitlements/moveWorldEntitlement.ts:113` to `src/features/architect/utils/entitlements/moveWorldEntitlement.ts:145`.  
Fix strategy: Use transaction-like semantics (or compensating rollback) and return failure if any write step fails.

#### M3. Advanced editor identity lock is incomplete vs actual identity fields
Severity: **Major**  
Why incorrect: Edit-mode lock list omits fields that participate in identity for swap/conveyance, enabling identity-changing edits despite UI promise that identity is locked.  
Exact repro path: Edit existing `swap_right`, modify `swapTargetDefinition` in Advanced JSON, click Apply; move path can execute due changed deterministic identity. Same risk for conveyance pool/comparator/ranks.  
Impacted code surface: lock list `src/features/architect/admin/EntitlementEditorAdvancedTab.tsx:15`; identity fields include extra keys in `src/features/architect/utils/entitlements/entitlementIdentity.ts:132` to `src/features/architect/utils/entitlements/entitlementIdentity.ts:180`.  
Fix strategy: Lock identity by kind using the same field set as `getEntitlementIdentityKey`, or hard-block identity deltas in edit mode and require duplicate-as-new.

#### M4. Linked/residual package integrity is not enforced as legality
Severity: **Major**  
Why incorrect: Writer checks only local shape/self-reference; cross-doc existence/completeness is not enforced. Trade path emits only warning for missing linked package members.  
Exact repro path: Save entitlement with `linkedEntitlementIds` referencing missing IDs; trade it alone; trade remains legal with warning only.  
Impacted code surface: `src/features/architect/utils/entitlements/entitlementWriter.ts:253`, warning-only behavior `src/features/architect/tradeMachine/utils/entitlementWarnings.js:84`.  
Fix strategy: Add hard validator for linked/residual references (existence, holder compatibility, optional reciprocal linkage) on save and pre-trade validation.

### Minors
#### m1. Conveyance adapter emits `outcome: expired` with “must convey” reason text
Severity: **Minor**  
Why incorrect: Resolution reason implies conveyance, but outcome tag is `expired`; this is semantically confusing for downstream UI/reporting and audit traces.  
Exact repro path: Resolve final-year protected entitlement where trigger occurs; adapter returns `expired` with “pick must convey despite position …”.  
Impacted code surface: `src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts:297` to `src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts:305`.  
Fix strategy: Align outcome enum and reason text (`conveyed_final_year` or consistent `expired` wording), then update adapter consumers/tests.

## 4) Risk Register (Future Footguns)
1. Resolver dedupe can mask corruption. `resolveEntitlementsForTeamWithDb` silently drops duplicates by identity key (`src/features/architect/utils/entitlements/entitlementResolver.ts:292`) instead of surfacing invariant failures.
2. Deterministic ID hash collision risk. Current 8-char 32-bit hash (`src/features/architect/utils/entitlements/entitlementIdentity.ts:311`) can collide at scale; no collision-handling path is present.
3. Pick-slot accounting invariant exists but is not wired into runtime mutation gates. `validatePickSlotAccounting` is implemented in `src/features/architect/utils/leagueInvariants.ts:557` but references are test-only in current code search.
4. String parsing brittleness for pick IDs. Several flows rely on strict `TEAM_YEAR_SUFFIX` parsing; malformed IDs degrade silently and can skew ownership/routing interpretation.
5. Health report is manual/diagnostic. Cross-team ownership conflict detection exists in `entitlementHealthReport` but is not enforced in write pipeline.

## 5) Recommended Fix Plan (Ordered)
1. Add a global entitlement-claim exclusivity gate and enforce it in all write paths.
2. Correct Stepien to use post-trade baseline+delta control model.
3. Align entitlement resolver fallback chain with world team fallback (parent-world aware).
4. Switch season advance DARE persistence to `applyGatedDAREResultsToBatch`.
5. Make create save path atomically attach entitlement ID to holder team inventory.
6. Make identity move atomic and fail on partial write errors.
7. Expand advanced edit identity lock to match identity function fields by kind.
8. Enforce linked/residual reference integrity as blocking validation, not warning-only.
9. Clean up minor semantic mismatches (`expired` vs convey text) and add explicit regression tests.

Schema/data migration notes:
- No mandatory schema field migration required for blockers 1-4, but a backfill job is needed to detect and remediate pre-existing cross-team conflicts and orphaned world entitlement docs.
- Optional hardening migration: add persisted claim keys or entitlement identity version field to support fast global uniqueness checks.

## 6) Verification Checklist
### Manual scenarios (must pass)
1. Two teams cannot save entitlements that claim the same physical pick outcome (including protection partition, swap controller, and conveyance pool/rank overlaps).
2. Protection ladder split claims for one underlier must be partition-valid and non-overlapping.
3. Swap controller duplication for same controller pick is blocked across all teams.
4. Conveyance pool/rank collisions are blocked across all teams.
5. Identity-changing edit moves document ID atomically with no orphan references.
6. Multi-team trade rejects missing `toTeamId`, invalid destinations, self-routing, and unowned entitlement routing.
7. Stepien legality uses baseline control + outgoing delta for conditional firsts and swaps.
8. Child world entitlement resolution matches world team fallback behavior (world -> parent -> base).
9. DARE season advance blocks persistence on exclusivity-validation failure.
10. Base collections remain read-only while world writes proceed.

### Automated test expectations to add/update
1. Save-time cross-team conflict test for same `underlyingPickId` across different teams.
2. Stepien regression test where baseline reservation + single outgoing year must fail.
3. Parent-world entitlement fallback integration test.
4. SeasonManager integration test asserting gated DARE mutator is used.
5. Create-flow persistence test asserting world entitlement doc and team `entitlementIds` update together.
6. Move-flow fault-injection tests for delete/attach/detach failures.
7. Advanced JSON edit-mode lock tests for swapTargetDefinition and conveyance identity fields.
8. Linked package hard-validation tests (missing/mismatched links).

### Validation commands run
- `npm run test:architect`  
  Result: failed, **6 files failed / 27 tests failed / 2406 passed / 3 skipped / 3 todo**, duration ~149s.
- `npm run test:trade`  
  Result: failed, **2 files failed / 3 tests failed / 541 passed / 1 skipped / 3 todo**, duration ~42.6s.

### Commands intentionally skipped
- `npm run test:diff` skipped; user-requested audit plan explicitly called for `test:architect` and `test:trade`, and both were executed.
- Full suite commands (`npm run test`, `npm run test:full`, raw `vitest`) intentionally not run because prompt did not include `RUN FULL SUITE`.

## Unverified / Inconclusive Items
1. Firestore security-rule enforcement was not audited from rules files in this pass; code-level write constraints were inspected in writer/mutator surfaces only.
2. No live emulator mutation scenario was executed end-to-end for parent-world entitlement fallback; conclusion is from code-path comparison between resolver and team loader.
3. Existing failing test baselines indicate broader suite instability; entitlement findings above are from direct code-path tracing, not inferred solely from red tests.

## Return Package Metadata
- Files changed: `return_packages/entitlements/ENTITLEMENTS_E2E_DEEP_REVIEW_RETURN_PACKAGE.md`
- Validation commands actually run: `npm run test:architect`, `npm run test:trade`
- Additional notes: code behavior treated as source of truth where docs/comments conflict.
