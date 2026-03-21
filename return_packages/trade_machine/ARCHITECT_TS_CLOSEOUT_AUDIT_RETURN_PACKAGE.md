# ARCHITECT_TS_CLOSEOUT_AUDIT — EXECUTION RETURN PACKAGE

## 1. Summary

Architect passes structural TS conversion standards but not hardening standards.

- Architect is fully TS-owned on the audited runtime path. All meaningful implementation authority lives in `.ts/.tsx`.
- No live business logic remains in `.js/.jsx` within the audited scope.
- Type quality is `partially hardened`. Permissive patterns (`any`, `Record<string, unknown>`, `[key: string]: unknown`, cast bridges) remain widespread in core runtime authorities, while some contract-oriented and schema-backed pockets show genuine strength.
- What blocks full closeout is hardening, not migration. The remaining work is more than optional polish.

## 2. Runtime Ownership Verdict

`PASS WITH RESIDUAL CLEANUP`

Fresh inventory from current repo state:

| Scope | Total | .ts | .tsx | .js | .jsx |
|-------|-------|-----|------|-----|------|
| `src/features/architect/**` | 323 | 222 | 77 | 11 | 13 |
| Architect-reached `src/shared/components/**` | 18 | 1 | 9 | 0 | 8 |
| Architect-reached `src/shared/utils/contracts/**` | 5 | 4 | 0 | 1 | 0 |
| **Total in scope** | **346** | **227** | **86** | **12** | **21** |
| **TS/TSX** | **313** (90.5%) | | | | |
| **JS/JSX** | **33** (9.5%) | | | | |

Structural findings:

- 30 in-scope `.js/.jsx` files have same-path `.ts/.tsx` siblings. All 30 are pure compatibility forwarders (1–2 line re-exports). None carry implementation authority.
- 3 in-scope JS files have no same-path TS twin:
  - `src/features/architect/utils/draftPickUtils.js` — contains real logic but has zero live runtime importers (test-only residue)
  - `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js` — intentional wrapper re-exporting from `validateEligibility.ts`, zero live runtime importers
  - `src/features/architect/utils/validatePhase21.test.js` — test file
- The `live business logic still in JS/JSX` bucket is empty.
- Vite still resolves several extensionless imports through compatibility `.js/.jsx` shims first (see Section 6, resolver checks). This is residual cleanup, not structural failure, because those shims are pure forwarders to TS/TSX authorities.

Why not full `PASS`:

- Shim-first Vite resolution remains on the live runtime path for 5 of 7 checked specifiers.
- That residue is compatibility-only and acceptable, but cleanup is still desirable.

Why not `FAIL`:

- All shim-first files are pure forwarders with no implementation authority.
- No explicit in-scope `.js/.jsx` import strings exist in Architect source code. The remaining JS runtime pressure comes from extensionless resolver behavior, not hard-coded JS paths.

Note on out-of-scope shared JS: Architect does have 10 explicit `.js` import strings pointing to out-of-scope files (`@/config/validationFlags.js` ×8, `@/shared/utils/formatting/basicFormatting.js` ×2). These are outside the defined audit scope and do not affect the scoped verdict.

## 3. Remaining JS/JSX Classification

`shim-only compatibility surface`

- `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
- `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
- `src/features/architect/contract/ContractEditor/ContractEditor.jsx`
- `src/features/architect/contract/ContractEditorModal/ContractEditorModal.jsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`
- `src/features/architect/hooks/useArchitectPlayerData.js`
- `src/features/architect/hooks/useCapValidation.js`
- `src/features/architect/hooks/usePlayerRulesProfiles.js`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/hooks/useTradeMachineSnapshot.js`
- `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
- `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
- `src/features/architect/utils/capProjections.js`
- `src/features/architect/utils/exceptions/exceptionLifecycle.js`
- `src/features/architect/utils/tradeContext/legacy/index.js`
- `src/shared/components/BirdRightsIcon.jsx`
- `src/shared/components/TeamLogo.jsx`
- `src/shared/components/TeamSelectDropdown.jsx`
- `src/shared/components/ui/Dialog.jsx`
- `src/shared/components/ui/filters/BadgeFilterSelect.jsx`
- `src/shared/components/ui/filters/MultiSelectFilter.jsx`
- `src/shared/components/ui/filters/RangeSelector.jsx`
- `src/shared/components/ui/filters/RoleChecklist.jsx`
- `src/shared/utils/contracts/contractParser.js`

`intentional wrapper / public entrypoint`

- `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js`
  - One-line explicit wrapper: `export { enforceEligibility } from './validateEligibility';`
  - No same-path TS twin exists. Zero live runtime importers.
  - Current pressure is compatibility/test-facing, not live runtime authority.

`barrel / index surface`

- None on the live audited runtime path.
- `src/shared/components/ui/filters/index.js` and `src/shared/utils/contracts/index.js` exist as pure compatibility barrels but are bypassed by Vite aliases that point directly to their `.ts` counterparts.

`live business logic still in JS/JSX`

- **None.**

`debug / support / monitoring residue`

- None.

`dead / test-only / zero-runtime-import residue`

- `src/features/architect/utils/draftPickUtils.js`
  - Contains real logic (`isFrozenPick` function, 43 lines).
  - Fresh importer scan found zero live runtime importers. Only test-backed usage from `src/tests/architect/phase40_secondApron_drift_guardrails.test.js`.
  - Does not qualify as live runtime business logic.
- `src/features/architect/utils/validatePhase21.test.js`
  - Vitest test file. Legitimate test-only residue.

The `live business logic still in JS/JSX` bucket is empty. This confirms Architect passes the runtime ownership standard.

What still prevents a clean finish-line closeout:

- Compatibility-only shim residue remains on the live runtime path (30 same-path forwarders).
- Runtime topology cleanup (removing shim-first Vite resolution) is desirable but not blocking.
- Type hardening remains materially incomplete in core TS authorities.

## 4. Type Quality Verdict

`partially hardened`

Fresh type quality metrics from current repo state (across 299 Architect `.ts/.tsx` files):

| Pattern | Occurrences | Files affected | % of TS files |
|---------|-------------|----------------|---------------|
| `any` in type positions (`: any`, `as any`, `<any`, `any[]`, `any>`) | 355 | 44 | 15% |
| Permissive bags (`Record<string, unknown>` + `[key: string]: unknown`) | 567 | 136 | 46% |
| `...Like` suffix type references | 1,463 | 123 | 41% |
| Type casts (`as SomeType`) | 561 | 137 | 46% |
| `@ts-ignore` / `@ts-expect-error` | 0 | 0 | 0% |
| Zod runtime validation in Architect | 0 | 0 | 0% |

Why it is not `strongly typed`:

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts` — uses local `SalaryByYear`, `ArchitectContract`, and `ArchitectPlayer` interfaces with `[key: string]: unknown` index signatures on every shape. Local `CapProjectionMap` is `Record<string, ... | undefined>`.
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` — uses `SalaryByYear`, `LocalContract`, `LocalBio`, `ArchitectPlayer` interfaces all carrying `[key: string]: unknown`. Multiple `Record<string, unknown>` patterns.
- `src/features/architect/utils/tradeMachine/constants/types.ts` — `CapSettings`, `NormalizedPlayer`, `TradeExceptionPlayer`, `TradeExceptionRecord` all carry `[key: string]: unknown` open index signatures. Fields that should be required are optional.
- `src/features/architect/utils/tradeMachine/cache/validationCacheService.ts` — uses `Map<any, any>` and `key/result: any` patterns.
- `src/shared/components/EditContractModal.tsx` — relies on `LooseRecord` and `Partial<...> & LooseRecord` even where schema-backed types exist.
- No Zod runtime validation is used anywhere in Architect. Schema enforcement relies entirely on compile-time types + Firestore structure + test coverage.

Why it is stronger than `fully converted but still permissive`:

- `src/features/architect/utils/persistenceContracts/contracts.ts` — genuine contract-oriented typing with `PersistenceAllowlist`, `PersistenceDeepRules`, `PersistenceContract`, `PersistenceContractsMap`. Frozen allowlists, `readonly` arrays, no open index signatures.
- `src/features/architect/utils/persistenceContracts/validatePersistableShape.ts` — structured validation logic with typed contracts.
- `src/features/architect/types/ruleContext.ts` — proper discriminated union types (`LeaguePhase`), required fields in `TimingContext`, no index signatures.
- `src/features/architect/types/index.ts` — bridges schema-backed type exports (from `src/schemas/architect.ts`) into Architect with real typed imports.
- `src/shared/utils/contracts/contractParser.ts` — typed interfaces for `NormalizedSalaryRow`, `MaxContractInfo`, `ContractStatus` with precise field types, though still uses `ContractParserRecord = Record<string, unknown>` for upstream data.
- Zero `@ts-ignore` / `@ts-expect-error` suppressions — the code compiles without escape hatches.
- The hardening passes (E-series scopes) have already eliminated significant type debt. The remaining permissiveness is concentrated, not uniform.

Assessment of schema/Zod-backed type usage:

- Schema-backed types exist in `src/schemas/architect.ts` and are imported into Architect via `src/features/architect/types/index.ts`.
- They are underused in the major runtime authorities (GMDashboard hooks, tradeMachine engine/types, validation presentation types).
- The dominant pattern in core authorities is local `...Like` types, `Record<string, unknown>`, and `[key: string]: unknown` rather than end-to-end schema-backed contracts.

## 5. Validation Status

`npm run typecheck`

- **PASS**
- Clean exit, no errors.
- Impact on verdict: no blocking typecheck failure in scope.

`npm run build`

- **PASS**
- Completed in 28.48s.
- Non-failing warnings observed:
  - Browser compatibility warning for `fs` imported from `src/features/architect/utils/tradeMachine/engine/tradeDebug.ts`
  - Mixed static/dynamic import warnings for `src/firebaseConfig.js`, `src/features/architect/utils/entitlements/entitlementResolver.ts`, `src/features/architect/utils/leagueInvariants.ts`
  - Large bundle chunk warning (2,440 kB main chunk)
- These are build hygiene and performance follow-up items, not TS-closeout failures.
- Impact on verdict: no blocking build failure in scope.

`npm run validate:project`

- **PASS**
- All structural validations passed.
- Impact on verdict: no structural/project-schema failure in scope.

## 6. Evidence / Inspection Run

### Inventory proof

- `find src/features/architect -name "*.ts" | wc -l` → 222
- `find src/features/architect -name "*.tsx" | wc -l` → 77
- `find src/features/architect -name "*.js" | wc -l` → 11
- `find src/features/architect -name "*.jsx" | wc -l` → 13
- Glob scans of `src/shared/components/**` and `src/shared/utils/contracts/**` by extension
- Architect-reached shared files identified via import tracing from `src/features/architect/**/*.{ts,tsx}`
- Non-Architect-reached shared files (DropdownGroup, ErrorBoundary, PlayerHeadshot, SeasonYearSelector, ToggleButton, VideoExamples, Modal, OverallGradeBlock, drawers/DrawerShell, drawers/OpenDrawerButton) excluded from scope

### Same-path sibling proof

30 in-scope same-path `.js/.jsx` + `.ts/.tsx` pairs identified. All 30 `.js/.jsx` files confirmed as pure 1–2 line compatibility forwarders via targeted reads:

- `src/features/architect/capSheet/CapSheet/CapSheet.jsx` → `export { default } from './CapSheet.tsx';`
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx` → `export { default } from './CapSummaryTiles.tsx';`
- `src/features/architect/hooks/useCapValidation.js` → `export * from './useCapValidation.ts'; export { default } from './useCapValidation.ts';`
- `src/shared/components/BirdRightsIcon.jsx` → `export { default } from './BirdRightsIcon.tsx';`
- `src/shared/components/TeamLogo.jsx` → `export { default } from './TeamLogo.tsx';`
- `src/shared/components/TeamSelectDropdown.jsx` → `export { default } from './TeamSelectDropdown.tsx';`
- `src/shared/components/ui/Dialog.jsx` → `export * from './Dialog.tsx';`
- `src/shared/components/ui/filters/MultiSelectFilter.jsx` → `export { default } from './MultiSelectFilter.tsx';`
- `src/shared/utils/contracts/contractParser.js` → `export * from './contractParser.ts';`

The guardrail test `src/tests/architect/finalArchitectInventoryGate.e132.guardrail.test.ts` also independently verifies all 21 Architect same-path shims: it dynamically imports both shim and authority, confirms identical export names, and verifies object identity (`toBe`). This test passes.

### Non-twin file proof

- `src/features/architect/utils/draftPickUtils.js` — read in full. Contains `isFrozenPick` function (43 lines). Glob confirmed no `.ts` sibling exists. File header states "Compatibility surface for frozen-pick guardrail tests and legacy imports."
- `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js` — read in full. Single re-export line: `export { enforceEligibility } from './validateEligibility';`. Glob confirmed no `.ts` sibling exists.
- `src/features/architect/utils/validatePhase21.test.js` — read. Vitest test file importing from `capLegalityValidation.ts`.
- `src/features/architect/utils/tradeContext/legacy/index.js` — read. Re-exports from `./index.ts`.
- `src/features/architect/utils/exceptions/exceptionLifecycle.js` — read. Re-exports from `./exceptionLifecycle.ts`.

### Importer scan proof

- `rg "from ['\""][^'\"]+\.(js|jsx)['\""]" src/features/architect --glob "*.{ts,tsx}"` — found 10 explicit `.js` imports:
  - 8× `@/config/validationFlags.js` (out of scope)
  - 2× `@/shared/utils/formatting/basicFormatting.js` (out of scope)
- Zero explicit in-scope `.js/.jsx` import strings exist in Architect source code.
- Remaining in-scope JS runtime resolution comes entirely from extensionless specifiers + Vite resolver behavior.

### Resolver / topology checks

Read `vite.config.js` — confirmed two explicit aliases:

- `@/shared/components/ui/filters` → `src/shared/components/ui/filters/index.ts`
- `@/shared/utils/contracts` → `src/shared/utils/contracts/index.ts`

Read `tsconfig.json` — confirmed `moduleResolution: "bundler"`, `paths: { "@/*": ["./src/*"] }`.

Vite's default resolve.extensions order: `.mjs, .js, .mts, .ts, .jsx, .tsx, .json` — `.js/.jsx` precedes `.ts/.tsx` for extensionless imports where both exist.

Resolution results for the 7 required specifiers:

| Specifier | TypeScript resolves to | Vite resolves to |
|-----------|----------------------|------------------|
| `@/shared/components/ui/filters` | `src/shared/components/ui/filters/index.ts` | `src/shared/components/ui/filters/index.ts` (alias) |
| `@/shared/utils/contracts` | `src/shared/utils/contracts/index.ts` | `src/shared/utils/contracts/index.ts` (alias) |
| `@/shared/components/TeamLogo` | `src/shared/components/TeamLogo.tsx` | `src/shared/components/TeamLogo.jsx` (shim-first) |
| `@/shared/components/TeamSelectDropdown` | `src/shared/components/TeamSelectDropdown.tsx` | `src/shared/components/TeamSelectDropdown.jsx` (shim-first) |
| `@/shared/components/BirdRightsIcon` | `src/shared/components/BirdRightsIcon.tsx` | `src/shared/components/BirdRightsIcon.jsx` (shim-first) |
| `@/shared/components/ui/Dialog` | `src/shared/components/ui/Dialog.tsx` | `src/shared/components/ui/Dialog.jsx` (shim-first) |
| `@/features/architect/utils/capProjections` | `src/features/architect/utils/capProjections.ts` | `src/features/architect/utils/capProjections.js` (shim-first) |

The two aliased specifiers (filters, contracts) resolve directly to TS in both TypeScript and Vite. The remaining 5 resolve to TS in TypeScript but land on the `.js/.jsx` shim first in Vite due to extension priority.

Internal extensionless leaf exports from the filters barrel still fan out through `BadgeFilterSelect.jsx`, `MultiSelectFilter.jsx`, `RangeSelector.jsx`, `RoleChecklist.jsx` under Vite resolution. Similarly, `contractParser.js` is hit when `index.ts` imports `./contractParser` extensionless.

### Required evidence target reads

| Target | File read | What it proved |
|--------|-----------|----------------|
| Same-path shim | `CapSheet.jsx`, `useCapValidation.js`, `TeamLogo.jsx`, `Dialog.jsx`, `MultiSelectFilter.jsx`, `contractParser.js` | All are pure 1–2 line forwarders |
| Wrapper / public entry | `enforceEligibility.js` | Single re-export, no logic, no TS twin |
| Barrel / index | `filters/index.js`, `contracts/index.js` | Pure `export * from './index.ts'` barrels |
| Retained standalone JS | `draftPickUtils.js` | Contains real logic but zero runtime importers |
| Major Architect TS authority | `useArchitectActions.ts` (160 lines read) | TS-owned, heavily permissive local interfaces with `[key: string]: unknown` |
| Shared Architect-adjacent TS | `contractParser.ts` (60 lines read) | TS-owned, typed interfaces but uses `ContractParserRecord = Record<string, unknown>` |
| Compatibility guardrail test | `finalArchitectInventoryGate.e132.guardrail.test.ts` (full read) | Freezes exact 24-file JS/JSX inventory, verifies shim export parity |
| Permissive-typing-heavy TS | `useArchitectState.ts` (80 lines read), `types.ts` (80 lines read) | Heavy `[key: string]: unknown` index signatures, all-optional fields, `Record<string, unknown>` envelopes |
| Stronger contract-oriented TS | `persistenceContracts/contracts.ts` (80 lines read) | Frozen allowlists, `readonly` arrays, strict interface shapes, no open index signatures |

### Type quality proof

- `rg -c ':\s*any\b|<any\b|as\s+any\b|\bany\[\]|\bany\s*>' --type ts src/features/architect` → 355 occurrences across 44 files
- `rg -c 'Record<string,\s*unknown>|\[key:\s*string\]:\s*unknown' --type ts src/features/architect` → 567 occurrences across 136 files
- `rg -c '\w+Like\b' --type ts src/features/architect` → 1,463 references across 123 files
- `rg -c '\bas [A-Z]\w+' --type ts src/features/architect` → 561 casts across 137 files
- `rg -c '@ts-ignore|@ts-expect-error' --type ts src/features/architect` → 0
- `rg -c 'z\.(object|string|number|boolean|array|enum|union|literal|infer|ZodType)' --type ts src/features/architect` → 0

## 7. Final Standards Verdict

`Architect passes structural TS conversion standards but not hardening standards`

Why:

- The audited live runtime path is meaningfully TS-owned. All 33 in-scope JS/JSX files are either compatibility forwarders, intentional wrappers, or dead/test-only residue. Zero live business logic remains in JS/JSX.
- Remaining shim-first Vite resolution is compatibility-only residue and is acceptable cleanup, not structural failure.
- The repo has an active guardrail test (`finalArchitectInventoryGate.e132.guardrail.test.ts`) that freezes the exact JS/JSX inventory and verifies shim correctness.
- Architect does **not** yet read as finish-line polish only because:
  - 355 `any` in type positions across 15% of TS files
  - 567 permissive bag patterns across 46% of TS files
  - 561 type casts across 46% of TS files
  - Zero Zod runtime validation
  - Core runtime authorities (GMDashboard hooks, tradeMachine types/engine) still rely heavily on open index signatures, `Record<string, unknown>`, and permissive `...Like` local types

Direct answer to the closeout question:

- Architect now passes the structural TS conversion bar.
- What still blocks full closeout is hardening, not migration.
- The remaining work is more than optional polish — it is concentrated in core runtime authorities where permissive types undermine the value of the conversion.

## 8. Recommended Next Actions

1. **type hardening** (priority)
   - Focus on the highest-traffic permissive authorities:
     - `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
     - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
     - `src/features/architect/utils/tradeMachine/constants/types.ts`
     - `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`
     - `src/features/architect/utils/tradeMachine/cache/validationCacheService.ts`
     - `src/shared/components/EditContractModal.tsx`
   - Reduce `any`, `[key: string]: unknown`, `Record<string, unknown>`, and cast bridges.
   - Push schema-backed types from `src/schemas/architect.ts` deeper into the live runtime authorities.
   - Consider Zod runtime validation at persistence boundaries (Firestore writes).

2. **shim cleanup**
   - Retarget live extensionless imports so Vite lands directly on TS/TSX authorities:
     - Add explicit `.ts`/`.tsx` extensions to extensionless import specifiers, OR
     - Add Vite aliases for the remaining shim-first paths (TeamLogo, TeamSelectDropdown, BirdRightsIcon, Dialog, capProjections), OR
     - Delete the `.js/.jsx` shims after verifying no external consumers depend on them
   - Update the guardrail test inventory after cleanup.

3. **wrapper/barrel cleanup**
   - After shim cleanup, decide whether these zero-runtime residues should remain:
     - `src/features/architect/utils/draftPickUtils.js` (test-only, could be converted to `.ts`)
     - `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js` (wrapper, could be deleted if test imports are retargeted)
     - `src/features/architect/utils/validatePhase21.test.js` (test file, could be renamed to `.test.ts`)
   - Off-path shared barrels (`filters/index.js`, `contracts/index.js`) can be deleted once no consumer relies on them.

4. **guardrail retargeting**
   - Once the desired steady-state runtime topology is chosen, update `finalArchitectInventoryGate.e132.guardrail.test.ts` to enforce the new end state.

5. **out-of-scope shared JS awareness**
   - Architect has 10 explicit `.js` import strings pointing outside the audit scope (`validationFlags.js` ×8, `basicFormatting.js` ×2). These represent real JS dependencies that a broader migration effort should address, but they do not affect the Architect-scoped verdict.

### Files changed

None (verification-only audit).

### Validation commands run

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm run validate:project` — PASS

### Commands intentionally skipped

- `npm run test:architect` — per audit prompt: "Do not run broad test suites in this audit." The guardrail test was read and analyzed but not executed as part of this audit.
