# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E42 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration candidate from the actual current repo state is the `tradeContext` boundary module under `src/features/architect/utils/tradeContext/`.
- Confirmed current estimate for that scope: 3 live JS business-logic files.
- It looks worth doing next because it is the smallest nearby live JS boundary still sitting directly on the post-trade snapshot and validation path after E39 and E41.
- Current execution-shape read: likely split into a core sub-arc for `tradeContext.js` plus `assertions.js`, with `legacy/index.js` handled as a compatibility-wrapper follow-up decision.

## 2. Closed Scope Confirmation
- E39 remains closed as the validator-adjacent Trade Machine shim-retirement scope documented in `return_packages/trade_machine/TM_VALIDATOR_TS_INTERNAL_SHIM_RETIREMENT_E39_RETURN_PACKAGE.md`.
- E41 remains complete as the draft-pick resolution utility arc documented in `return_packages/trade_machine/TM_VALIDATOR_TS_DRAFT_PICK_RESOLUTION_ARC_E41_RETURN_PACKAGE.md`.
- This audit avoided silently reopening E39 by re-checking and excluding the intentionally kept JS entrypoint/barrel/constants surfaces:
  - `src/features/architect/utils/tradeMachine/index.js`
  - `src/features/architect/utils/tradeMachine/validators/index.js`
  - `src/features/architect/utils/tradeMachine/rules/index.js`
  - `src/features/architect/utils/tradeMachine/utils/index.js`
  - `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
  - `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`
- This audit avoided silently reopening E41 by re-checking `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`, `src/features/architect/utils/tradeMachine/utils/swapResolution.js`, and `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` and confirming they are now shim-only compatibility re-exports with TS authoritative peers already in place.

## 3. Candidate Next Scopes

### Candidate A — `tradeContext` Boundary Module
- Scope name: `tradeContext` boundary module
- Includes:
  - `src/features/architect/utils/tradeContext/tradeContext.js`
  - `src/features/architect/utils/tradeContext/assertions.js`
  - `src/features/architect/utils/tradeContext/legacy/index.js`
- Excludes:
  - `src/features/architect/utils/tradeContext/index.js`
  - `src/features/architect/utils/tradeContext/types.js`
  - `src/features/architect/utils/mutationPipeline.js`
- Estimated live JS business-logic file count: 3
- Usage classification:
  - `tradeContext.js`: runtime + tests
  - `assertions.js`: runtime + tests
  - `legacy/index.js`: tests + compatibility surface, not on the mutation hot path
- Why it is a good next arc:
  - it is the smallest remaining adjacent JS boundary that still performs live business logic on the canonical snapshot → validate → context flow
  - `mutationPipeline.js` imports the `tradeContext` barrel for `buildPostTradeTeamsSnapshot`, `validatePostTradeSnapshotForContext`, and the assertion helpers, so this scope is on a real runtime path rather than only a test harness
  - the boundary is coherent: post-trade snapshot building, context validation, and shape assertions live together already
- Why it is not a trivial arc:
  - `tradeContext.js` is materially larger than the E41 files and owns fail-closed apply-time routing, sign-and-trade preflight, entitlement transfer shaping, and cap-total recomputation
  - `legacy/index.js` is a compatibility wrapper rather than core mutation-path logic, which makes it the natural split seam

### Candidate B — Validator Instrumentation / Cache Support Cluster
- Scope name: validator instrumentation / cache support cluster
- Includes:
  - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
  - `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
  - `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
- Excludes:
  - `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
  - `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
  - `src/features/architect/utils/tradeMachine/engine/performanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
- Estimated live JS business-logic file count: 4
- Usage classification:
  - all 4 included files are live through `validationUtils.ts`, tests, or public debug exports
  - the excluded residue is adjacent but awkward because it mixes alternate cache implementations, test-facing monitors, and stale factory/debug paths
- Why it is not the best next arc:
  - it is not the next clean business-logic slice; it is a mixed support-layer migration with active and stale pieces interleaved
  - the main runtime path already splits between `validationCacheService.js` and other nearby files that still depend on `validationCache.js`, so the clean cutoff is weaker than the `tradeContext` boundary

### Candidate C — Season-Manager-Adjacent Helper Family
- Scope name: season-manager-adjacent helper family
- Includes:
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
  - `src/features/architect/utils/exceptionHistory/historyHelpers.js`
  - `src/features/architect/utils/entitlements/seasonManagerProjection.js`
- Excludes:
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`
- Estimated live JS business-logic file count: 3
- Usage classification:
  - all 3 files are runtime + test used
- Why it is not the best next arc:
  - the three files are all live, but the family mixes cap-hold reasoning, TPE history logging, and entitlement projection, so it reads as a broader season/offseason support bundle rather than the next tight validator-adjacent slice
  - this cluster is more cross-domain than `tradeContext`, and its natural blast radius immediately pulls in `seasonManager.js`, DARE flows, and cap-sheet/offseason behavior

### Zero-Import Files Inspected Before Exclusion
- `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - Classification: dormant read-only validation wrapper
  - Exclusion reason: no runtime or test importer evidence was found
- `src/features/architect/utils/tradeMachine/engine/index.js`
  - Classification: barrel surface
  - Exclusion reason: no external importer evidence and no business logic beyond re-exports
- `src/features/architect/utils/tradeMachine/engine/performanceMonitor.js`
  - Classification: alternate / stale performance helper
  - Exclusion reason: zero importer evidence and the live wrapped-validator path uses `validationPerformanceMonitor.js`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.debug.js`
  - Classification: stale debug helper
  - Exclusion reason: zero importer evidence and not part of the live validator path
- `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - Classification: stale alternate factory
  - Exclusion reason: zero importer evidence and it still references a non-live local `./validationCacheService.js` path
- `src/features/architect/utils/tradeMachine/cache/index.js`
  - Classification: barrel surface
  - Exclusion reason: no external importer evidence and no business logic beyond re-exports
- `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
  - Classification: stale alternate cache manager
  - Exclusion reason: zero importer evidence on the live validator path
- `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
  - Classification: stale orphan enforcement module
  - Exclusion reason: zero importer evidence and no connection to the current validator or mutation path

## 4. Recommended Next Scope
- Recommended next migration scope: the `tradeContext` boundary module.
- Confirmed live JS business-logic count for the recommended scope: 3 files.
- Why it is the best next choice:
  - it is the most coherent remaining JS slice that still sits directly on the trade apply and validation boundary
  - it is smaller and cleaner than the season-manager-adjacent family
  - it has a much stronger business-logic boundary than the instrumentation/cache cluster, which is partly support code and partly stale residue
  - it preserves the closure of E39 and E41 because it does not depend on reopening the intentionally kept validator entrypoints or the E41 shim-only files
- Recommended execution shape: split into two sub-arcs.
- Recommended split:
  - core sub-arc: `src/features/architect/utils/tradeContext/tradeContext.js` plus `src/features/architect/utils/tradeContext/assertions.js`
  - follow-up decision: `src/features/architect/utils/tradeContext/legacy/index.js`
- Why the split makes sense:
  - `tradeContext.js` and `assertions.js` are the live mutation-path core
  - `legacy/index.js` is still real JS behavior, but it is a deprecated compatibility wrapper exercised mainly through tests and compatibility expectations rather than the canonical mutation path

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/tradeContext/tradeContext.js`
  - Why it belongs in scope: it owns post-trade snapshot construction, apply-time fail-closed routing and sign-and-trade preflight, post-trade cap-total recomputation, and validated-context construction
  - Central or peripheral: central
- `src/features/architect/utils/tradeContext/assertions.js`
  - Why it belongs in scope: it provides the runtime shape assertions used at the mutation boundary to protect snapshot/context contracts
  - Central or peripheral: central
- `src/features/architect/utils/tradeContext/legacy/index.js`
  - Why it belongs in scope: it still contains live wrapper behavior that builds a snapshot, stamps a timestamp, and delegates to the canonical validation path through the public compatibility surface
  - Central or peripheral: peripheral

## 6. Validation / Inspection Run
- Files changed:
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E42_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- Commands and inspection steps used:
  - `sed -n` reads of the E39, E40, and E41 return packages plus `docs/architect/TRADE_MACHINE_MASTER.md`
  - targeted `rg --files` scans across `src/features/architect/utils/tradeMachine`, `src/features/architect/utils/tradeContext`, and nearby `src/features/architect/utils` folders
  - targeted `rg -n` importer scans across `src` and `tests` for `tradeContext`, validator instrumentation/cache files, season-manager-adjacent helpers, and E41 shim paths
  - targeted `sed -n` file reads on candidate files and zero-import files to classify business logic vs shims/barrels/stale residue
  - `wc -l` size checks on candidate families to compare likely arc size
  - `npm run typecheck`
  - `npm run validate:project`
  - `npm run test:diff -- --reporter=dot`
- What they proved:
  - the E39-closed JS entrypoints/constants remain intentionally kept surfaces, not reopened business logic
  - the E41 `.js` files remain shim-only compatibility surfaces with TS authoritative peers already in place
  - `tradeContext` is the strongest next boundary from actual importer and file-content evidence
  - the validator instrumentation/cache family is live but cut by mixed active vs stale residue
  - the season-manager-adjacent helper family is live but broader and more cross-domain than the `tradeContext` slice
- Results:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - `npm run test:diff -- --reporter=dot`: PASS
  - diff-runner detail: selected `FAST` tier and ran `npm run test:fast` successfully (`4` files, `28` tests)
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - `npm run test:full`
- Why they were skipped:
  - this pass was audit/documentation-only
  - the required proof set plus targeted inspection was sufficient to support scope selection
  - broad suites were not needed to resolve any remaining uncertainty
  - full-suite execution is guarded and was not requested with `RUN FULL SUITE`

## 7. Complexity / Risk Assessment
- Relative size vs E41: larger.
- Why larger:
  - E41 was a 3-file utility cluster with clean helper boundaries
  - the recommended `tradeContext` scope is also 3 files by count, but the core file is much larger and sits directly on the mutation boundary
- Batchable or smaller slices:
  - current repo evidence says this is better handled as smaller slices, not another one-pass grouped arc
  - the cleanest split is core `tradeContext.js` plus `assertions.js` first, then a separate decision on `legacy/index.js`
- Key risks and caveats:
  - `tradeContext.js` owns fail-closed apply-time behavior, so even type-only migration mistakes could affect routing or sign-and-trade preflight semantics
  - `mutationPipeline.js` imports the `tradeContext` barrel directly, so the blast radius includes trade apply behavior rather than only standalone helper tests
  - the public `tradeContext` barrel currently re-exports `legacy/index.js`, so legacy compatibility expectations need explicit handling rather than silent removal
  - the scope is still coherent, but it is no longer the kind of low-risk grouped helper arc that E41 was

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E42 (2026-03-10)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new entry states that:
  - the E39 validator-adjacent scope remains closed
  - the E41 draft-pick resolution scope remains complete
  - the recommended next migration scope is the `tradeContext` boundary module
  - the confirmed live JS business-logic count for that scope is 3
  - the current recommendation is to split the next arc into a core `tradeContext.js` plus `assertions.js` pass and a separate legacy-wrapper follow-up decision
