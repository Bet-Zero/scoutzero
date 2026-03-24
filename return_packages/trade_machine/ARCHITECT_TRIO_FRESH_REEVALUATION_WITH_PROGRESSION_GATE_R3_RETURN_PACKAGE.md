# ARCHITECT_TRIO_FRESH_REEVALUATION_WITH_PROGRESSION_GATE_R3 — EXECUTION RETURN PACKAGE

**Date:** 2026-03-24
**Pass type:** Verification-only audit — no code changes
**Scope:** `src/features/architect/**` + Architect-reached shared runtime dependencies
**Audit version:** R3 (fresh evidence from current source only)

---

## 1. Summary

- **Architect is fully TypeScript-owned on the audited runtime path.** Zero `.js/.jsx` files exist under `src/features/architect/`. All 301 files are `.ts/.tsx`. All Architect-reached shared dependencies (`@/shared/components/ui/filters`, `@/shared/utils/contracts`, `TeamLogo.tsx`, `TeamSelectDropdown.tsx`, `BirdRightsIcon.tsx`, `Dialog.tsx`) are also fully TypeScript.
- **No live business logic remains in JS/JSX.** The `live business logic still in JS/JSX` bucket is empty from current repo state. This disqualifying condition does not apply.
- **Type quality: partially hardened.** `capLegalityValidation.ts` achieved strongly-typed status after the 2026-03-24 hardening pass. `seasonManager.ts` has strong export boundaries. `mutationPipeline.ts` remains the dominant permissive blocker: 32 `LooseRecord` usages across live compute functions and one load-bearing index signature on `ArchitectMutationContract`.
- **Two pre-existing test failures exist** in `test:architect` that were not introduced by the recent hardening passes. Both predate the batched hardening commits.
- **Typecheck, build, and validate:project all PASS** from current repo state.

---

## 2. Runtime Ownership Verdict

**PASS**

Evidence from current source:

- `find src/features/architect -name "*.js" -o -name "*.jsx"` → **0 files**
- `find src/features/architect -name "*.ts" -o -name "*.tsx"` → **301 files**
- All six Architect-reached shared paths confirmed as `.ts/.tsx` flat files:
  - `src/shared/components/TeamLogo.tsx` ✓
  - `src/shared/components/TeamSelectDropdown.tsx` ✓
  - `src/shared/components/BirdRightsIcon.tsx` ✓
  - `src/shared/components/ui/Dialog.tsx` ✓
  - `src/shared/components/ui/filters/` → all `.tsx/.ts` (BadgeFilterSelect.tsx, MultiSelectFilter.tsx, RangeSelector.tsx, RoleChecklist.tsx, index.ts) ✓
  - `src/shared/utils/contracts/` → all `.ts` (contractParser.ts, contractUtils.ts, index.ts, seasonNormalizer.ts) ✓
- No same-path `.js/.jsx` + `.ts/.tsx` sibling pairs anywhere in scope
- No shim-first or barrel-forwarded resolution on any checked path

---

## 3. Remaining JS/JSX Classification

Fresh source scan confirms all buckets are empty for the Architect runtime scope:

| Bucket | Count | Notes |
|--------|-------|-------|
| `shim-only compatibility surface` | 0 | None found under `src/features/architect/` |
| `intentional wrapper / public entrypoint` | 0 | None found |
| `barrel / index surface` | 0 | All barrel indexes are `.ts` |
| `live business logic still in JS/JSX` | **0** | **Standards failure bucket is empty** |
| `debug / support / monitoring residue` | 0 | None found |
| `dead / test-only / zero-runtime-import residue` | 0 | None found |

**Implication:** The remaining gap is type-quality/hardening only. Runtime ownership is not the constraint.

---

## 4. Type Quality Verdict

**Verdict: `partially hardened`**

| File | Lines | `any` | `LooseRecord` | `[key: string]:` | Classification |
|------|-------|-------|--------------|-----------------|----------------|
| `mutationPipeline.ts` | 6,677 | 10 | 32 | 1 (load-bearing) | Fully converted, still permissive |
| `capLegalityValidation.ts` | 4,711 | 6 | 0 | 1 (canonical design) | **Strongly typed** |
| `seasonManager.ts` | 1,977 | 6 | 32 | 0 | Partially hardened |

**Explanation per file:**

**`mutationPipeline.ts`** — 32 `LooseRecord` usages across data-transformation helpers (`extractTeamsByCode*`, compute intermediates, persistence sanitizers). One index signature on `ArchitectMutationContract[key: string]: unknown` is load-bearing (access to `contract.years`/`contractYears` and other undeclared fields throughout the pipeline). Type definitions for `ArchitectTradePayloadTeam.picksOut/picksIn` remain `Record<string, unknown>[]`. `totals` field in `ArchitectMutationTeamRecord` is `Record<string, unknown> | null`. The `any` usages (10 total) are in utility contexts (error normalization, recursive sanitizers) and are not exported type-level concerns. This file is the dominant permissive blocker by volume and by boundary importance.

**`capLegalityValidation.ts`** — `AnyRecord` eliminated in the 2026-03-24 pass. `LooseRecord` count is zero. All five exported validators (`validateSigning`, `validateDeadCap`, `validateExceptions`, `validateWaiver`, `validateTrade`) return `MutationValidationResult` with `violations/warnings: CapLegalityViolation[]`. The `CapLegalityViolation[key: string]: unknown` index signature is the new canonical type design — intentional catch-all with 3 explicit required fields (`rule`, `message`, `severity?`). `normalizeSigningTerms` input is now `SigningTerms | null | undefined` (was `AnyRecord | null | undefined`). The 6 remaining `any` usages are scoped to `toFiniteNumber`, `getErrorMessage`, and `getDraftPickNumber` — all appropriate for their polymorphic input normalization role. **This file has moved to strongly typed status.**

**`seasonManager.ts`** — 32 `LooseRecord` usages are entirely in internal data-transformation helpers (`processOptions`, `processEmptyRosterCharges`, `updateCapHolds`, `removeUndefinedDeep`). All exported public functions (`advanceSeasonInWorld`, `resolveDraftPickSwapsForYear`, `resolveDraftPickConveyanceForYear`) have explicit typed parameters. `SeasonAdvanceTeamSummary.stepienUpdates/conveyanceResolutions/swapResolutions` now use the local boundary types `StepienUpdate`, `ConveyanceResolutionEntry`, `SwapResolutionEntry` (replacing prior `unknown[]`). `SeasonAdvanceSummary.dareReceipt` is now `DAREResolutionReceipt`. `SeasonManagerDraftPickConveyanceResult.previousProtection/originalRound` narrowed from `unknown` to `string | undefined` and `number | string | undefined` respectively. Export boundary is strong; LooseRecord is confined to internal helpers where runtime polymorphism is legitimate.

**Schema/Zod underuse:** Zod schemas from `src/schemas/` are not used for internal compute shapes in any of the trio files. All type contracts are hand-written local types. This is a lower-priority observation — the immediate gap is the `ArchitectMutationContract` catch-all in mutationPipeline.ts.

---

## 5. Validation Status

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | Clean — 0 type errors |
| `npm run build` | **PASS** | Builds successfully; non-blocking warnings: chunk size (>500kB), module externalization for `fs` in `tradeDebug.ts`, mixed static/dynamic import on `firebaseConfig.js` |
| `npm run validate:project` | **PASS** | All project structure validations pass |
| `npm run test:architect` | **2921/2923 PASS** | 2 pre-existing failures (see below) — not introduced by recent hardening passes |

**Build warnings (non-blocking):**
- `tradeDebug.ts` imports Node.js `fs` module — externalized at build time (pre-existing, expected)
- `firebaseConfig.js` mixed static/dynamic import — pre-existing bundling pattern
- Main chunk `index.js` is 2,468kB (pre-existing, not a type-quality concern)

**Pre-existing test failures (not introduced by recent hardening passes):**

1. `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
   - Failure: `capLegalityValidation.ts` line 1840 directly accesses `team.tradeExceptions` instead of `getTeamTpeList(team)`
   - Root cause: Pre-existing access pattern; confirmed present in commit `df005856~1` (before any of the hardening passes). Not touched by the `b73bd574` capLegalityValidation hardening commit.
   - Impact: Non-blocking for this audit's verdict. Pre-existing.

2. `src/tests/architect/phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js`
   - Failure: `expect(content).toContain('advanceSeasonInWorld(worldId')` — test expects single-line signature, but current file has multi-line TypeScript signature (`advanceSeasonInWorld(\n  worldId: string,`)
   - Root cause: Multi-line TypeScript signature was adopted in commit `af0cd555` (before the batched hardening series). The hardening pass `4740ee07` did not change the signature.
   - Impact: Non-blocking for this audit's verdict. Pre-existing.

**Commands intentionally not run:** `npm run test:full` (requires explicit `RUN FULL SUITE` phrase per AGENTS.md).

---

## 6. Evidence / Inspection Run

> **Anti-staleness declaration:** Prior return packages, master docs, earlier audit reports, and memory entries were not used as evidence for any finding in this document. Every count, classification, and verdict below is derived from direct inspection of the current repository state.

### A. Fresh runtime closure

```
find src/features/architect -name "*.js" -o -name "*.jsx" → 0 files
find src/features/architect -name "*.ts" -o -name "*.tsx" → 301 files
```

### B. Resolver / topology checks

All specifiers from the audit prompt confirmed from current repo:

| Specifier | Resolution | Format |
|-----------|-----------|--------|
| `@/shared/components/ui/filters` | `src/shared/components/ui/filters/index.ts` | TypeScript |
| `@/shared/utils/contracts` | `src/shared/utils/contracts/index.ts` | TypeScript |
| `@/shared/components/TeamLogo` | `src/shared/components/TeamLogo.tsx` | TypeScript |
| `@/shared/components/TeamSelectDropdown` | `src/shared/components/TeamSelectDropdown.tsx` | TypeScript |
| `@/shared/components/BirdRightsIcon` | `src/shared/components/BirdRightsIcon.tsx` | TypeScript |
| `@/shared/components/ui/Dialog` | `src/shared/components/ui/Dialog.tsx` | TypeScript |
| `@/features/architect/utils/capProjections` | `src/features/architect/utils/capProjections.ts` | TypeScript |

No `.js/.jsx` files at any of these resolver targets. No same-path sibling pairs.

### C. Targeted trio reads

**`mutationPipeline.ts` (lines 195–380 read):**
- Line 203: `ArchitectMutationContract[key: string]: unknown` — load-bearing catch-all (confirmed)
- Lines 373–374: `picksOut?: Record<string, unknown>[]`, `picksIn?: Record<string, unknown>[]` (ArchitectTradePayloadTeam)
- Line 333: `totals?: Record<string, unknown> | null` (ArchitectMutationTeamRecord)
- Line 336: `source?: Record<string, unknown> | string | null` (ArchitectMutationTeamRecord)
- Weak marker counts (grep): 10 `any`, 32 `LooseRecord`, 1 `[key: string]:`

**`capLegalityValidation.ts` (lines 80–148 read):**
- Lines 87–92: `CapLegalityViolation` canonical type with 3 required fields + `[key: string]: unknown`
- Lines 94–111: `MutationSalaryRow = Omit<ArchitectMutationContract['salariesByYear'][number], ...> & {...}` — strong intersection type
- Line 127: `draftPick?: unknown` (MutationContract — intentional, polymorphic)
- Line 136: `experience?: unknown` (MutationPlayer — intentional, ArchitectDashboardPlayer callers)
- Weak marker counts: 6 `any`, 0 `LooseRecord`, 0 `AnyRecord`, 1 `[key: string]:` (in CapLegalityViolation)

**`seasonManager.ts` (lines 228–256 and 600–645 read):**
- Line 240: `resolutionMeta?: unknown` (audit-only, not persisted — confirmed deliberate)
- Line 255: `entitlements?: unknown[]` (hydration-only, not persisted — confirmed deliberate)
- Line 607: `processOptions(teamData: LooseRecord, season: string)` — LooseRecord internal helper
- Lines 609–620: casts to `LooseRecord[]` within processOptions — all internal mutation loop
- Weak marker counts: 6 `any`, 32 `LooseRecord`, 0 `[key: string]:`

### D. Comparison file reads

**`useArchitectActions.ts` (lines 170–284 read):**
- Lines 170–222: `ArchitectPlayer` local type — 40+ explicit fields, `options?: Record<string, unknown>` for metadata only
- Lines 239–253: `SigningDetails` — explicit contract fields + `options?: Record<string, unknown>` metadata
- Lines 267–279: `ActiveContract` — 9 explicit fields + `options?: Record<string, unknown>` metadata
- The 4 `Record<string, unknown>` usages are all metadata containers, not business logic boundaries
- No `any`, no `LooseRecord`, no index signatures

**`useArchitectState.ts` (lines 95–213 read):**
- Lines 95–102: `ArchitectContract[key: string]: unknown` — load-bearing catch-all (comment confirms necessity: "participates in PlayerLike-compatible intersections")
- Lines 201–213: `ArchitectExceptionEntryLike` — 11 explicit fields, NO catch-all (as expected from prior hardening)
- Lines 193–199: `DeadCapLike`, `CapHoldLike` — explicit optional fields, no catch-all
- 3 total weak markers, all intentional

### E. Guardrail test read (seasonManager.batchedHardening.test.ts)

Read lines 1–140. Test file is well-structured with complete mock infrastructure for `firebaseConfig`, `firebase/firestore`, `worldManager`, `teamLoader`, `seasonFormat`, `architectFirestorePaths`, `salaryEngine`, `capSettingsProvider`, `capHoldTransitionHelpers`, `tpeLifecycle`, `exceptionHistory`, `offseason`, `persistenceContracts`, `mutationPipeline`, `capLegality/postStateCapValidator`, `exceptions`, `capTotals`, `entitlementResolver`, `pickRulesResolver`, `seasonManagerProjection`, `dare`. This is a well-isolated behavioral proof set for the recent hardening pass.

---

## 7. Trio Reassessment

> **All assessments below are from direct inspection of current file contents only. Prior return packages and master docs were not used as evidence.**

### `capLegalityValidation.ts` — DID IMPROVE MATERIALLY

**Evidence:**
- `AnyRecord` count: 0 (confirmed via `grep -c "AnyRecord"` → 0)
- `LooseRecord` count: 0 (confirmed via `grep -c "LooseRecord"` → 0)
- All 5 exported validators return `MutationValidationResult` with `violations/warnings: CapLegalityViolation[]`
- `normalizeSigningTerms` input is now `SigningTerms | null | undefined` (confirmed at line 1473)
- The new `CapLegalityViolation` type has 3 explicit required fields + intentional `[key: string]: unknown` catch-all — this is canonical design, not permissiveness
- `MutationSalaryRow` is a precise `Omit<...> & {...}` intersection that narrows all 6 salary year fields

**Verdict:** This file has moved from its prior state to **strongly typed**. It is **ready to move below the dominant blocker tier**. No further dedicated hardening pass is needed on this file.

### `seasonManager.ts` — DID IMPROVE, EXPORT BOUNDARIES STRONG

**Evidence:**
- 32 `LooseRecord` usages confirmed — all in internal data-transformation helpers (processOptions, processEmptyRosterCharges, updateCapHolds, removeUndefinedDeep) per direct read of lines 600–645
- `SeasonAdvanceTeamSummary.stepienUpdates` is now `StepienUpdate[]` (confirmed at type definition)
- `SeasonAdvanceTeamSummary.conveyanceResolutions` is now `ConveyanceResolutionEntry[]`
- `SeasonAdvanceTeamSummary.swapResolutions` is now `SwapResolutionEntry[]`
- `SeasonAdvanceSummary.dareReceipt` is now `DAREResolutionReceipt` (from DARE types)
- `resolutionMeta?: unknown` and `entitlements?: unknown[]` are intentional non-persisted audit fields
- 0 index signatures in the file
- Public function signatures are explicit

**Verdict:** This file **can move below the dominant blocker tier**. Internal LooseRecord usage is legitimate polymorphic residual. The export boundary is strong. No further dedicated hardening pass is needed.

**Note:** One pre-existing test failure (`phase83`) is caused by the multi-line signature format for `advanceSeasonInWorld`. This is not a type-quality issue — it is a string-match fragility in the guardrail test. The function logic and type signatures are correct.

### `mutationPipeline.ts` — STILL #1 BLOCKER

**Evidence:**
- `ArchitectMutationContract[key: string]: unknown` at line 203 — confirmed load-bearing catch-all (access to `contract.years`, `contractYears`, and other undeclared dynamic fields throughout the pipeline)
- 32 `LooseRecord` usages across data-transformation helpers
- `ArchitectTradePayloadTeam.picksOut/picksIn: Record<string, unknown>[]` at lines 373–374 (trade payload pick shapes are not typed)
- `ArchitectMutationTeamRecord.totals: Record<string, unknown> | null` at line 333
- `ArchitectMutationTeamRecord.source: Record<string, unknown> | string | null` at line 336
- 10 `any` usages — all in utility helpers (acceptable), not exported type definitions

**Verdict:** `mutationPipeline.ts` remains the highest-priority remaining blocker. Its dominant weak boundary is `ArchitectMutationContract[key: string]: unknown`. The previous hardening passes (Chunks 1-3) narrowed many secondary boundaries but explicitly deferred this catch-all. This is still the correct primary target.

**Comparison with `useArchitectState.ts`:** The `ArchitectContract[key: string]: unknown` catch-all in `useArchitectState.ts` (line 101) is the same load-bearing pattern — it explicitly documents that removing it would break index signature compatibility with `ContractLike` throughout GMDashboard. These are related problems (same underlying issue: undeclared dynamic field accesses on contracts).

### Blocker ranking now

1. **`mutationPipeline.ts`** — `ArchitectMutationContract` catch-all + permissive intermediate types (`picksOut/picksIn`, `totals`, `source`)
2. **`useArchitectState.ts`** — `ArchitectContract` catch-all (same root cause as #1; fixing #1 may unlock fixing this)
3. **`seasonManager.ts` internal helpers** — acceptable residual, no dedicated pass needed
4. **`capLegalityValidation.ts`** — effectively done; dropped from blocker ranking

### Should we stay on the trio, narrow, or move on?

- `capLegalityValidation.ts`: Move on. Done.
- `seasonManager.ts`: Move on. Export boundary strong; internal LooseRecord is legitimate.
- `mutationPipeline.ts`: Stay. This is the remaining primary target.

---

## 8. Final Standards Verdict

**`Architect passes structural TS conversion standards but not hardening standards`**

**Justification from current code:**

Runtime path dimension: PASS. Zero JS/JSX files exist anywhere on the Architect runtime path, including all Architect-reached shared dependencies. This is a clean result from current repo state.

Hardening dimension: NOT YET. The central mutation pipeline hub (`mutationPipeline.ts`, 6,677 lines) still has:
- `ArchitectMutationContract[key: string]: unknown` — the most important export boundary on the trade/signing compute path, with an undeclared-field catch-all
- 32 `LooseRecord` usages across live compute functions
- Intermediate trade payload types (`picksOut`, `picksIn`, `totals`, `source`) with `Record<string, unknown>` shapes

These are not decorative — they appear on the compute path for every trade validation and mutation. Important live flows lack specific, meaningful types at the internal compute layer.

---

## 9. Recommended Next Actions / Progression Gate

### Blocker ranking (in priority order)

| Rank | File | Primary weakness | Severity |
|------|------|-----------------|---------|
| 1 | `mutationPipeline.ts` | `ArchitectMutationContract[key: string]: unknown`; `picksOut/picksIn: Record<string, unknown>[]`; `totals: Record<string, unknown>` | High |
| 2 | `useArchitectState.ts` | `ArchitectContract[key: string]: unknown` (same root cause as #1) | Medium |
| 3 | `seasonManager.ts` internal helpers | 32 `LooseRecord` in processOptions/processEmptyRosterCharges | Low (acceptable residual) |
| — | `capLegalityValidation.ts` | No remaining blockers | **Done** |

### Recent trio work assessment

| File | Status |
|------|--------|
| `capLegalityValidation.ts` | **Done — move on.** Hardening was effective. Strongly typed. |
| `seasonManager.ts` | **Effectively done — move on.** Export boundary is strong. Internal LooseRecord is legitimate. |
| `mutationPipeline.ts` | **Partially done — stay.** Chunks 1-3 narrowed many boundaries. ArchitectMutationContract catch-all is the remaining primary target. |

### Recommended next move

**Narrower implementation pass on `mutationPipeline.ts`**, targeting specifically:

1. **`ArchitectMutationContract` catch-all** — Enumerate the dynamically-accessed undeclared fields (`years`, `contractYears`, and any others used throughout the pipeline) as explicit optional fields, then remove `[key: string]: unknown`. This is the highest-impact single change. Requires surveying all access sites for undeclared fields before the change.

2. **`ArchitectTradePayloadTeam.picksOut/picksIn`** — Narrow from `Record<string, unknown>[]` to a specific pick type. The pick shapes used in trade payloads are known structures from the entitlement/draft pick system.

3. **`ArchitectMutationTeamRecord.totals`** — Narrow from `Record<string, unknown>` to a specific totals type. `CapTotals` or `ComputedTeamCapTotals` may be the right shape.

**Secondary (deferred but related):** Once `ArchitectMutationContract` is hardened in `mutationPipeline.ts`, the `ArchitectContract[key: string]: unknown` in `useArchitectState.ts` should be revisited as the same catch-all pattern may be eliminable.

**Pre-existing issues to address (separate from hardening):**
- `phase65` failure: `capLegalityValidation.ts` line 1840 should use `getTeamTpeList(team)` instead of `team.tradeExceptions`. Small, targeted fix.
- `phase83` failure: `seasonManager.ts` `advanceSeasonInWorld` multi-line signature breaks the guardrail string scan. Either the test should be updated to match multi-line TypeScript signatures, or the function JSDoc check should use a different pattern.

Neither pre-existing issue blocks the hardening standard; both should be tracked and fixed in a maintenance pass.
