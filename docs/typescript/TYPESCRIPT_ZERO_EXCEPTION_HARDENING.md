# TypeScript Zero-Exception Hardening Plan

## Control Panel

- Mode: CONTINUOUS EXECUTION
- Purpose: eliminate all remaining legacy TypeScript exceptions and get as close
  as practical to "perfect TypeScript."
- Baseline: the previous TypeScript hardening contract is complete. Its
  exception tables are now treated as the starting backlog for this stricter
  plan, not as accepted final debt.
- Root strict invariant: root strict mode already passes as of the 2026-04-25
  final package. Do not re-litigate root strict unless `tsconfig.json`,
  compiler posture, or validation regresses.
- Execution rule: start at `Current Cursor`, complete the next executable item
  in `Active Work Queue`, update this plan and a return package, commit the safe
  checkpoint, then continue unless a real blocker applies.
- Setup constraint: this setup step is documentation-only. Future work queue
  phases may edit source when their phase is active.
- Full-suite guard: do not run `npm run test:full`, `npm test`, `npm run test`,
  or raw `vitest` unless the user prompt contains the exact phrase
  `RUN FULL SUITE`.
- Completion rule: no final verdict of `DONE`, `COMPLETE`, or
  `ZERO-EXCEPTION TYPESCRIPT HARDENING COMPLETE` is allowed unless every
  zero-exception hard-stop gate below passes.

### Zero-Exception Hard-Stop Gates

An allowed unavoidable boundary is a third-party or tooling surface that cannot
be honestly typed locally without replacing upstream/tool behavior. Internal
legacy compatibility, convenience, or "tests only" are not enough by themselves.

| Gate | Required end state | Hard stop |
| --- | --- | --- |
| Gate 1 - Zero runtime escapes | Runtime code has zero internal `any`, `as any`, `Record<string, any>`, or `as unknown as` markers. Only explicitly impossible third-party boundaries may remain, and they must be quarantined behind typed wrappers or runtime guards. | Any internal runtime marker remains, or any boundary exception lacks a precise owner, risk, and follow-up. |
| Gate 2 - Zero `z.any()` | `z.any()` is fully removed from schemas and runtime code. | Any `z.any()` remains anywhere in `src/`, including canonical schemas. |
| Gate 3 - Opaque schema escape honesty | Every `z.unknown()`, `.passthrough()`, and `.catchall()` is either replaced by a real schema or justified as truly opaque external data with downstream narrowing proof. | Any schema escape is retained for convenience, legacy round-tripping, or incomplete knowledge without a field-specific justification. |
| Gate 4 - Typed test fixtures and mocks | Test fixtures and mocks use typed builders instead of broad state bags wherever practical. Negative fixtures and SDK mocks stay local and explicit. | A central mock, integration harness, or repeated fixture bag hides runtime contract truth behind broad `any`/cast patterns. |
| Gate 5 - Practical JS/CJS/MJS conversion | Remaining JS/CJS/MJS files are classified into convert/delete/keep, and every practical internal script is converted to TypeScript. Only truly unavoidable config/tooling files remain. | Any practical internal JS-like file remains unconverted, unclassified, or stale. |
| Gate 6 - No false final closure | Final exception tables are empty or contain only unavoidable third-party/tooling boundaries. | Any table still contains internal legacy debt, broad bags, or schema placeholders. |

## Current Cursor

- Cursor ID: TS-ZERO-001
- Status: TODO
- Current objective: Phase 1 - eliminate the 9 true runtime escape markers
  carried forward from `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`.
- Current files / areas:
  - `src/schemas/players_v2.ts`
  - `src/schemas/architect.ts`
  - `src/features/architect/utils/tradeMachine/engine/validationUtils.ts`
  - `src/features/architect/utils/tradeContext/types.ts`
- Next action: open the four current files, replace the listed markers with
  truthful runtime/schema types, and update this plan plus a Phase 1 return
  package before committing.
- Stop condition: the old 9-row runtime exception inventory no longer contains
  any internal runtime escape marker, or any remaining marker is proven to be an
  unavoidable third-party boundary under Gate 1.
- Last updated: 2026-04-26 by Codex

## Mission Completion Status

| Gate | Status | Last Evidence | Notes |
| --- | --- | --- | --- |
| Root strict regression invariant | PASS | `TS-HARDENING-GATE-005-FINAL-COMPLETION-2026-04-25.md` recorded root strict passing with `"strict": true`. | Do not reopen unless compiler posture regresses. |
| Gate 1 - Zero runtime escapes | FAIL | `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md` lists 9 true runtime escape markers. | Phase 1 starts here. |
| Gate 2 - Zero `z.any()` | FAIL | Prior schema table lists `z.any()` and `z.record(..., z.any())` in `players_v2.ts` and `architect.ts`. | Phase 2 must remove all `z.any()` sites. |
| Gate 3 - Opaque schema escape honesty | FAIL | Prior schema scan found 36 `z.unknown()`/passthrough/catchall/`z.any()` hits classified under the older, looser standard. | Must re-audit and replace or justify each opaque escape under the stricter standard. |
| Gate 4 - Typed test fixtures and mocks | FAIL | Gate 5 test/mock classification found 630 raw hits with high-volume UI harness and SDK mock clusters. | Phase 3 begins with the highest-hit files and adds typed builders where practical. |
| Gate 5 - Practical JS/CJS/MJS conversion | FAIL | Gate 6 inventory classified 38 JS-like files as intentional config/scripts under the older standard. | Phase 4 must reclassify into convert/delete/keep and convert practical internal scripts. |
| Gate 6 - No false final closure | FAIL | Gates 1-5 are not yet satisfied under the stricter contract. | No final DONE verdict is allowed. |

Current mission verdict: `TASK INCOMPLETE - ZERO-EXCEPTION HARDENING NOT FINISHED`

## Active Work Queue

| ID | Status | Scope | Objective | Required validation | Return package |
| --- | --- | --- | --- | --- | --- |
| TS-ZERO-001 | TODO | Phase 1: 9 true runtime escape markers from the prior exception table | Eliminate the old runtime exception inventory by replacing internal `any`, `as any`, `Record<string, any>`, `as unknown as`, and schema-owned `z.any()` markers with honest types or schemas. Do not mark complete while any of the 9 markers remains as internal debt. | Runtime escape scan; `npm run typecheck`; `npm run test:diff -- --reporter=dot`; schema validation if schema files change. | `return_packages/typescript/TS-ZERO-001-RUNTIME-ESCAPES-<YYYY-MM-DD>.md` |
| TS-ZERO-002 | TODO | Phase 2: `src/schemas/players_v2.ts`, `src/schemas/architect.ts` | Replace every `z.any()` and `z.record(..., z.any())` in the player and Architect schemas with real schemas. Use `z.unknown()` only for truly opaque external data, and only with field-level justification and downstream narrowing proof. | Schema escape scan; `npm run typecheck`; `npm run schema:check`; `npm run test:diff -- --reporter=dot`. | `return_packages/typescript/TS-ZERO-002-SCHEMA-ANY-REMOVAL-<YYYY-MM-DD>.md` |
| TS-ZERO-003 | TODO | Phase 3: highest-hit test harness/mock files from `TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md` | Tighten broad test state bags into typed builders, starting with `useArchitectActions.freeAgency.test.tsx`, `tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`, `capSheet.transactionMatrix.behavior.test.tsx`, `tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`, and the `mutationPipeline.*` high-hit cluster. Extend this phase with the next files until practical broad bags are gone. | Test/mock escape scan; `npm run typecheck`; relevant scoped tests such as `npm run test:architect -- --reporter=dot` or `npm run test:trade -- --reporter=dot`; `npm run test:diff -- --reporter=dot` when uncertain. | `return_packages/typescript/TS-ZERO-003-TYPED-TEST-BUILDERS-<YYYY-MM-DD>.md` |
| TS-ZERO-004 | TODO | Phase 4: all remaining JS/CJS/MJS files | Reclassify JS-like files into convert/delete/keep under the stricter standard. Convert all practical internal scripts to TypeScript and leave only truly unavoidable config/tooling files. | JS-like inventory scan; `npm run typecheck`; `npm run validate:project`; `npm run test:diff -- --reporter=dot` for script or structural changes. | `return_packages/typescript/TS-ZERO-004-JS-CONVERSION-<YYYY-MM-DD>.md` |
| TS-ZERO-005 | TODO | Phase 5: final zero-exception audit | Run the final audit only after Phases 1-4 are complete. Prove all zero-exception gates pass and that remaining exception tables are empty or contain only unavoidable third-party/tooling boundaries. | Gate 1-5 scans; `npm run typecheck`; `npm run validate:project`; `npm run lint:md`; `npm run test:diff -- --reporter=dot`; root strict regression check only if compiler posture changed. | `return_packages/typescript/TS-ZERO-005-FINAL-AUDIT-<YYYY-MM-DD>.md` |

### Phase 1 Seed Runtime Marker Inventory

These rows come from the prior completed plan and must be eliminated under the
stricter zero-exception contract.

| Prior file / line | Marker | Existing reason | Zero-exception disposition |
| --- | --- | --- | --- |
| `src/schemas/players_v2.ts:134` | `z.any()` | Legacy player contract option payloads. | Replace with real option payload schema or a field-specific opaque external schema under Phase 2. |
| `src/schemas/players_v2.ts:211` | `z.record(z.string(), z.any())` | Historical contract-map entries. | Replace record values with a real contract payload schema. |
| `src/schemas/players_v2.ts:237` | `z.any()` | Evaluation score slot legacy payloads. | Replace with a real generated-evaluation payload schema. |
| `src/schemas/players_v2.ts:253` | `z.any()` | Current-contract option payloads. | Replace with a real current-contract option schema. |
| `src/schemas/players_v2.ts:274` | `z.record(z.string(), z.any())` | Legacy ingestion metadata. | Replace values with typed metadata union or `z.unknown()` only if truly opaque external data. |
| `src/schemas/players_v2.ts:313` | `z.record(z.string(), z.any())` | Duplicate/index-style legacy player records. | Replace with typed extra-record schema or remove if stale. |
| `src/schemas/architect.ts:151` | `z.record(z.string(), z.any())` | Dynamic Architect exception metadata. | Replace with typed exception metadata schema. |
| `src/features/architect/utils/tradeMachine/engine/validationUtils.ts:12` | `any[]` | Heterogeneous validator tuple constraint. | Replace with a safer variadic tuple abstraction or isolate behind a proven third-party impossibility claim. |
| `src/features/architect/utils/tradeContext/types.ts:18` | `Record<string, any>` | Legacy trade-context snapshot bridge. | Replace with typed validator output maps or a field-level unknown carrier with narrowing. |

## Completed Work Log

| Date | ID | Summary | Files changed | Validation | Return package |
| --- | --- | --- | --- | --- | --- |
| 2026-04-26 | TS-ZERO-SETUP | Created the zero-exception living plan and setup return package without source changes. | `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`; `return_packages/typescript/TS-ZERO-EXCEPTION-HARDENING-SETUP-2026-04-26.md` | `npm run validate:project` PASS; `npm run lint:md` PASS; `npm run test:diff -- --reporter=dot` PASS; `git diff --check` PASS. | `return_packages/typescript/TS-ZERO-EXCEPTION-HARDENING-SETUP-2026-04-26.md` |

## Validation Ledger

| Date | Command | Result | Evidence / notes |
| --- | --- | --- | --- |
| 2026-04-26 | `npm run validate:project` | PASS | Project schema validator reported all validations passed. |
| 2026-04-26 | `npm run lint:md` | PASS | Markdown lint exited 0 after adding the new plan and return package. |
| 2026-04-26 | `npm run test:diff -- --reporter=dot` | PASS | After staging the docs-only diff, the runner selected FAST for support-file changes and ran `npm run test:fast -- --reporter=dot`; 12 files and 57 tests passed. |
| 2026-04-26 | `git diff --check` | PASS | No whitespace errors reported. |
| 2026-04-26 | Source changes | SKIPPED | Explicitly skipped because the setup step must not edit source. |
| 2026-04-26 | `npm run build` | SKIPPED | No UI, route, component, or runtime behavior changed. |
| 2026-04-26 | `npm run test:full` | SKIPPED | The prompt did not contain the required exact phrase `RUN FULL SUITE`. |

## Known Blockers / Deferred Debt

| ID | Severity | Area | Description | Why deferred/blocking | Resume trigger |
| --- | --- | --- | --- | --- | --- |
| None | - | - | No setup blocker. The known zero-exception debt is active work in `Active Work Queue`, not deferred debt. | N/A | Start TS-ZERO-001. |

## Return Package Index

| Date | Work ID | Return package | Purpose |
| --- | --- | --- | --- |
| 2026-04-26 | TS-ZERO-SETUP | `return_packages/typescript/TS-ZERO-EXCEPTION-HARDENING-SETUP-2026-04-26.md` | Setup evidence for the new zero-exception TypeScript hardening plan. |
