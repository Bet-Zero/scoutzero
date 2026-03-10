# TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E40 — EXECUTION RETURN PACKAGE

## 1. Summary
- The strongest next migration candidate from the current repo state is the draft-pick resolution utility cluster under `src/features/architect/utils/tradeMachine/utils/`.
- The recommended scope contains 3 live JS business-logic files:
  - `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`
  - `src/features/architect/utils/tradeMachine/utils/swapResolution.js`
  - `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`
- It looks worth doing next because it is adjacent to the closed Trade Machine validator slice, still owns live runtime behavior, and is small/coherent enough to migrate without broadening into the larger Architect mutation pipeline.
- Current execution-shape read: still likely one grouped arc, not another long micro-pass chain.

## 2. Closed Scope Confirmation
- Prior closed scope: the E39 validator-adjacent Trade Machine shim-retirement slice documented in `return_packages/trade_machine/TM_VALIDATOR_TS_INTERNAL_SHIM_RETIREMENT_E39_RETURN_PACKAGE.md`.
- This audit did not silently reopen that slice.
- The intentional JS surfaces left behind by E39 were kept out of the next-scope live-business-logic count:
  - `src/features/architect/utils/tradeMachine/index.js`
  - `src/features/architect/utils/tradeMachine/validators/index.js`
  - `src/features/architect/utils/tradeMachine/rules/index.js`
  - `src/features/architect/utils/tradeMachine/utils/index.js`
  - `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
  - `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`
- Those files were treated as intentional public entrypoint, barrel, or constants/message surfaces rather than as reopened E39 business-logic holdouts.

## 3. Candidate Next Scopes

### Candidate A — Draft-Pick Resolution Utility Cluster
- Scope name: Draft-pick resolution utility cluster
- Includes:
  - `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`
  - `src/features/architect/utils/tradeMachine/utils/swapResolution.js`
  - `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`
- Excludes:
  - `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`
  - `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - DARE adapter files under `src/features/architect/utils/entitlements/dare/`
  - `src/features/architect/utils/seasonManager.js`
  - the E39-closed JS entrypoints/barrels/constants surfaces
- Estimated live JS business-logic file count: 3
- Why it is a good next arc:
  - all 3 files still own live JS behavior rather than only re-exporting `.ts`
  - all 3 are runtime- or test-referenced
  - the boundary is narrow and domain-coherent: canonical pick IDs plus swap/conveyance resolution
  - the cluster is adjacent to Trade Machine but also touches season-advance behavior, which makes it meaningful without being repo-wide

### Candidate B — Trade-Context Boundary Module
- Scope name: Trade-context boundary module
- Includes:
  - `src/features/architect/utils/tradeContext/tradeContext.js`
  - `src/features/architect/utils/tradeContext/assertions.js`
  - `src/features/architect/utils/tradeContext/legacy/index.js`
- Excludes:
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/tradeMachine/index.js`
  - cap-totals and sign-and-trade helper dependencies consumed by the module
- Estimated live JS business-logic file count: 3
- Why it is not the best next arc:
  - it is coherent, but the blast radius is higher because it is welded to `mutationPipeline.js` sequencing and many path-sensitive guardrail tests
  - one file (`legacy/index.js`) is intentionally retained legacy compatibility surface rather than clean forward business logic
  - this looks more like a mutation-boundary migration than the next small adjacent utility slice

### Candidate C — Engine/Cache Instrumentation Cluster
- Scope name: Engine/cache instrumentation cluster
- Includes:
  - `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
  - `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
  - `src/features/architect/utils/tradeMachine/engine/validationDebugMonitor.js`
  - `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
  - `src/features/architect/utils/tradeMachine/cache/cacheInvalidationManager.js`
- Excludes:
  - wrapper-only barrels
  - stale or dormant zero-import leftovers called out below
  - the core `tradeValidator.ts` path, which is already TS-backed behind its kept JS entrypoint
- Estimated live JS business-logic file count: 7
- Why it is not a good next arc:
  - the cluster is mostly instrumentation, caching, and debug support rather than the next best business-logic migration slice
  - several nearby JS files in this family are stale or dormant, which makes the boundary feel cleanup-oriented rather than like the next coherent migration arc
  - much of the remaining usage is test-facing rather than central runtime behavior

### Candidate D — Broad Architect Trade Orchestration
- Scope name: Broad Architect trade orchestration
- Includes:
  - `src/features/architect/utils/tradeHelpers.js`
  - `src/features/architect/utils/tradeManager.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/worldManager.js`
- Excludes:
  - `src/features/architect/utils/architectCore.js` as a barrel
  - the separate `tradeContext/` boundary module candidate
  - the E39-closed public Trade Machine JS surfaces
- Estimated live JS business-logic file count: 5
- Why it is not a good next arc:
  - this is the largest and least coherent option
  - it mixes validation consumers, Firestore persistence, world management, season advancement, and shared helpers
  - `mutationPipeline.js` alone is too large to treat as the next clean adjacent slice

### Zero-Import Files Inspected Before Exclusion
- `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`
  - Classification: dormant but intentional
  - Why excluded: no importer evidence was found in runtime or tests, so it does not currently count as a live JS business-logic holdout
- `src/features/architect/utils/tradeMachine/engine/index.js`
  - Classification: wrapper-only
  - Why excluded: pure barrel surface with no external importer evidence
- `src/features/architect/utils/tradeMachine/engine/performanceMonitor.js`
  - Classification: dormant/stale instrumentation
  - Why excluded: exported only through the zero-import engine barrel while the live validation path uses `validationPerformanceMonitor.js`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.debug.js`
  - Classification: stale
  - Why excluded: zero importer evidence and not part of the live validation path
- `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - Classification: stale
  - Why excluded: zero importer evidence and it still references a non-existent engine-local `./validationCacheService.js` path
- `src/features/architect/utils/tradeMachine/cache/index.js`
  - Classification: wrapper-only
  - Why excluded: pure barrel surface with no external importer evidence
- `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
  - Classification: dormant/stale
  - Why excluded: alternate cache manager with no importer evidence on the live validation path
- `src/features/architect/utils/tradeMachine/rules/enforcement.js`
  - Classification: stale
  - Why excluded: duplicate/orphan enforcement implementation superseded by the authoritative rule/enforcer modules
- `src/features/architect/utils/tradeMachine/rules/enforcementValidation.js`
  - Classification: stale
  - Why excluded: duplicate/orphan consolidated enforcement module with no importer evidence

## 4. Recommended Next Scope
- Recommended next migration scope: the draft-pick resolution utility cluster.
- Why it is the best next choice:
  - it is the cleanest nearby set of live JS business-logic files left after the E39 validator-adjacent closeout
  - it has real runtime relevance across Trade Machine, admin pick tooling, `tradeHelpers.js`, and season-advance flows
  - it is materially smaller and less cross-cutting than the trade-context or broad orchestration candidates
  - unlike the engine/cache cluster, it is core business logic rather than mostly instrumentation or stale cleanup residue
- Recommended execution shape: one grouped arc.
- Caveat: `conveyanceResolution.js` is the highest-risk file in the scope because it sits closest to `seasonManager.js` behavior and DARE parity, but current importer/dependency analysis still says the cluster is batchable as one arc.

## 5. Live JS Business-Logic Inventory For Recommended Scope
- `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`
  - Why it belongs in scope: canonical pick-ID generation/normalization is still owned by JS and is used by admin pick tooling, `tradeHelpers.js`, and draft-pick tests
  - Central or peripheral: central
- `src/features/architect/utils/tradeMachine/utils/swapResolution.js`
  - Why it belongs in scope: live swap-resolution logic is still owned by JS and is used by `seasonManager.js`, DARE swap adapters, and dedicated swap tests
  - Central or peripheral: central
- `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`
  - Why it belongs in scope: live conveyance/protection-resolution logic is still owned by JS and is used by `seasonManager.js`, DARE conveyance adapters, and dedicated conveyance tests
  - Central or peripheral: central

## 6. Validation / Inspection Run
- Files changed:
  - `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E40_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`
- Commands and inspection steps used:
  - `rg --files src | rg '\.js$'`
    - Proved the remaining JS footprint around Trade Machine and nearby Architect utilities
  - `find src/features/architect/utils/tradeMachine -maxdepth 2 -type f \( -name '*.js' -o -name '*.ts' \) | sort`
    - Proved which files are still JS-only, paired JS/TS, or kept entrypoint/barrel surfaces
  - targeted `rg -n` importer scans across `src` and `tests`
    - Proved which candidate files are runtime-used, test-used, wrapper-only, or unreferenced
  - targeted `sed -n` reads on candidate files, zero-import files, and DARE adapter files
    - Proved which modules still own live logic vs only re-export or duplicate other implementations
  - `wc -l` on candidate modules
    - Proved relative size and supported the complexity comparison across candidate scopes
  - `npm run typecheck`
    - Proved the current repo still typechecks cleanly
    - Result: PASS
  - `npm run validate:project`
    - Proved the repo structure still satisfies the project schema
    - Result: PASS
  - `npm run test:diff -- --reporter=dot`
    - Proved the current diff did not require broader failing validation; this doc-only audit remained clean under the repo-default targeted test gate
    - Result: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - `npm run test:full`
- Why skipped:
  - this pass was audit/documentation-only
  - targeted inspection plus `typecheck`, `validate:project`, and `test:diff` were sufficient to support scope selection without broadening into unnecessary suites
  - full-suite execution was not requested and is guarded by repo rules

## 7. Complexity / Risk Assessment
- Relative size vs the just-closed validator-adjacent arc:
  - smaller by file count than E39
  - similar to slightly larger by migration effort because this is real business-logic migration, not mostly shim retirement
- Batchable or smaller slices:
  - current evidence says it is still batchable as one grouped arc
  - if it ever needs to split, the most natural fallback seam is `pickIdUtils.js` plus `swapResolution.js` first, then `conveyanceResolution.js`
- Key risks/caveats:
  - `conveyanceResolution.js` overlaps conceptually with the newer DARE protection/conveyance TS stack, so semantic parity needs careful verification
  - `swapResolution.js` and `conveyanceResolution.js` are both consumed by `seasonManager.js`, so season-advance behavior becomes part of the blast radius
  - `pickIdUtils.js` is shared by admin tooling and `tradeHelpers.js`, so import-path cleanup must preserve those surfaces cleanly
  - several nearby JS files are stale, dormant, or wrapper-only; the next arc should avoid accidentally expanding into generic cleanup

## 8. Master Doc Update
- Added `### Validator TS Next-Scope Expansion Audit E40 (2026-03-10)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new entry states that:
  - the E39 validator-adjacent scope remains closed
  - the recommended next migration scope is the draft-pick resolution utility cluster
  - the estimated live JS business-logic count for that scope is 3
  - the current read is that the next arc should likely run as one grouped scope, with `conveyanceResolution.js` as the main dependency-risk file
  - the return package for the audit is `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E40_RETURN_PACKAGE.md`
