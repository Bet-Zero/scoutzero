# TypeScript Hardening — Self-Extending Master Plan

> Historical status: completed TypeScript campaign record.
> Current status: TypeScript migration and hardening are complete in this repo.
> Reopen only if a TypeScript maintenance gate regresses.
> Current entry point: [docs/typescript/README.md](typescript/README.md)

## Control Panel

- Mode: CONTINUOUS EXECUTION
- Governing completion contract: `docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md`
- Execution rule: Start at `Current Cursor`, complete the next unchecked item in `Active Work Queue`, update this document, write a return package, then continue unless blocked.
- Completion rule: Do not declare `TYPESCRIPT HARDENING COMPLETE` unless every gate in the governing completion contract passes.
- If any hard-stop gate fails, final verdict must be `PHASE COMPLETE — HARDENING STILL INCOMPLETE` or `TASK INCOMPLETE — HARDENING NOT FINISHED`.
- Do not skip ahead unless the cursor item is blocked and the blocker is recorded in `Known Blockers / Deferred Debt`.

## Current Cursor

- Cursor ID: NO ACTIVE CURSOR — COMPLETION GATES PASSED
- Status: COMPLETE
- Current objective: TypeScript hardening completion gates have all passed with current evidence.
- Current files / areas: completion gate evidence, `return_packages/typescript/`, `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`
- Next action: None. Re-open this plan only if a future regression changes a hard-stop gate.
- Stop condition: Gates 1-8 all pass and the final completion return package exists.
- Last updated: 2026-04-25 by Codex

## Mission Completion Status

| Gate | Status | Last Evidence | Notes |
| --- | --- | --- | --- |
| Gate 1 — Root strict mode | PASS | `tsconfig.json` read 2026-04-25 has `"strict": true`; `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false` exited 0 | Root strict mode is enabled and the exact root strict compiler command passes. |
| Gate 2 — Runtime type escape audit | PASS | Contract scan 2026-04-25 found 80 hits: 9 true type escapes are listed in `Gate 2 Runtime Escape Exception Table`; 71 are false-positive prose/string-literal matches | Runtime-source true escape markers are either removed or exception-listed with owner/follow-up. Schema-owned exceptions are intentionally carried into Gate 7 for schema-specific classification. |
| Gate 3 — Declaration/shim honesty | PASS | Contract scan 2026-04-25 found 2 justified vendor declaration hits and 0 `any` declarations; see `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md` | The remaining `.d.ts` declarations are typed vendor boundaries for `lodash.debounce` and `react-window`, not ambient `any` shims. |
| Gate 4 — Runtime boundary honesty | PASS | Boundary scan 2026-04-25 found 307 candidate hits, all classified by boundary family in `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md` | True storage/JSON/search-param boundaries are validated or exception-listed; `params`/JSDoc overmatches are false positives. |
| Gate 5 — Test/mock type integrity | PASS | Contract scan 2026-04-25 found 630 raw hits, all classified in `docs/typescript/TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md` | Remaining test-side markers are assertion false positives, negative boundary fixtures, SDK mock boundaries, UI harness state bags, validator result bags, or source-scan guardrails. |
| Gate 6 — JS/CJS/MJS classification | PASS | Contract inventory 2026-04-25 found 38 classified JS-like files after deleting 3 tracked zero-byte Vitest temp files; see `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md` | Remaining files are intentional config or intentional Node scripts outside runtime app code. |
| Gate 7 — Schema escape audit | PASS | Contract scan 2026-04-25 found 36 schema escape hits, all classified in `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md` | Remaining schema escapes are localized Firestore/source-data passthrough or legacy compatibility surfaces. |
| Gate 8 — Evidence package | PASS | `return_packages/typescript/TS-HARDENING-GATE-005-FINAL-COMPLETION-2026-04-25.md` | Final evidence package records Gates 1-8 passing and the allowed completion verdict. |

Current mission verdict: TYPESCRIPT HARDENING COMPLETE

## Active Work Queue

| ID | Status | Scope | Objective | Required validation | Return package |
| --- | --- | --- | --- | --- | --- |
| TS-HARDENING-061 | COMPLETE | `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`, completion gates | Re-open/reconcile Step 61 final closeout against the completion contract and append the next numbered hardening steps if any gate fails. | Completion-contract gate checks; Gate 1 exact compiler command and Gates 2-7 scans run on 2026-04-25. | `return_packages/typescript/TS-HARDENING-061-RECONCILIATION-2026-04-25.md` |
| TS-HARDENING-GATE-001 | COMPLETE | `tsconfig.json`, repo-wide TypeScript project | Satisfy Gate 1 by enabling root strict mode and making root strict `tsc` pass without weakening contracts. | `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false` PASS; `npm run validate:project` PASS; `npm run test:diff -- --reporter=dot` PASS. | `return_packages/typescript/TS-HARDENING-GATE-001-ROOT-STRICT-2026-04-25.md` |
| TS-HARDENING-GATE-002 | COMPLETE | `src/**/*.ts`, `src/**/*.tsx`, `src/**/*.d.ts` excluding `src/tests/**` | Complete the runtime type escape audit and remove or exception-list every remaining runtime escape. | Gate 2 audit command PASS by classification; `npm run typecheck` PASS; targeted `npm run test:node -- --reporter=dot ...` PASS. | `return_packages/typescript/TS-HARDENING-GATE-002-RUNTIME-ESCAPES-2026-04-25.md` |
| TS-HARDENING-GATE-003 | COMPLETE | `src/**/*.d.ts`, runtime boundary families, schema files | Complete declaration/shim, runtime boundary, JS-like file, and schema escape audits needed for Gates 3, 4, 6, and 7. | Gate 3 scan PASS; Gate 4 boundary scan PASS by classification; Gate 6 inventory PASS after cleanup/classification; Gate 7 schema scan PASS by classification; `npm run typecheck` PASS. | `return_packages/typescript/TS-HARDENING-GATE-003-BOUNDARY-SCHEMA-2026-04-25.md` |
| TS-HARDENING-GATE-004 | COMPLETE | `tests/**/*.ts`, `src/tests/**/*.ts`, `src/tests/**/*.tsx` | Complete the test/mock type integrity audit and remove or exception-list every remaining test-side escape. | Gate 5 audit command PASS by classification; `npm run typecheck` PASS; `npm run validate:project` PASS; `npm run lint:md` PASS. | `return_packages/typescript/TS-HARDENING-GATE-004-TEST-MOCKS-2026-04-25.md` |
| TS-HARDENING-GATE-005 | COMPLETE | `return_packages/typescript/`, completion docs | Produce the final completion evidence package only after Gates 1-7 pass. | Full completion-contract evidence package PASS; root strict and scoped strict probes PASS; gate scans PASS by classification. | `return_packages/typescript/TS-HARDENING-GATE-005-FINAL-COMPLETION-2026-04-25.md` |

## Completed Work Log

| Date | ID | Summary | Files changed | Validation | Return package |
| --- | --- | --- | --- | --- | --- |
| 2026-04-25 | TS-HARDENING-CONTINUOUS-SETUP | Added the continuous execution control sections and seeded the work queue around the contract-failing Step 61 closeout posture. | `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`; `return_packages/typescript/TS-HARDENING-CONTINUOUS-SETUP-2026-04-25.md` | `npm run validate:project` PASS; `npm run test:diff -- --reporter=dot` PASS. | `return_packages/typescript/TS-HARDENING-CONTINUOUS-SETUP-2026-04-25.md` |
| 2026-04-25 | TS-HARDENING-061 | Reconciled the stale Step 61 final closeout against the hard completion contract, proved the mission is still incomplete, and appended Steps 62-66 for the failing gates. | `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`; `return_packages/typescript/TS-HARDENING-061-RECONCILIATION-2026-04-25.md` | Completion-contract scans run; `npm run validate:project` PASS; `npm run test:diff -- --reporter=dot` PASS. | `return_packages/typescript/TS-HARDENING-061-RECONCILIATION-2026-04-25.md` |
| 2026-04-25 | TS-HARDENING-GATE-001 | Enabled root TypeScript strict mode and resolved the repo-wide strict fallout across runtime UI, scraper/staging scripts, and guardrail tests without broadening contracts. | `tsconfig.json`; filters/ranker/profile/table/tier-maker surfaces; scraper/staging scripts; strict test fixtures; `src/types/vendor-ui.d.ts` | `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false` PASS; `npm run validate:project` PASS; `npm run test:diff -- --reporter=dot` PASS. | `return_packages/typescript/TS-HARDENING-GATE-001-ROOT-STRICT-2026-04-25.md` |
| 2026-04-25 | TS-HARDENING-GATE-002 | Removed narrow runtime escape markers across filters, roster cards, Architect helpers, cap legality validation, trade-machine debug shaping, and utility JSDoc; documented every remaining true Gate 2 marker in the exception table. | runtime source helpers/components; `src/tests/architect/myct_step2_guardrails.test.ts`; `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md` | Gate 2 scan PASS by classification; `npm run typecheck` PASS; targeted `npm run test:node -- --reporter=dot ...` PASS. | `return_packages/typescript/TS-HARDENING-GATE-002-RUNTIME-ESCAPES-2026-04-25.md` |
| 2026-04-25 | TS-HARDENING-GATE-003 | Classified declaration, runtime-boundary, JS-like file, and schema escape gates; deleted tracked zero-byte Vitest timestamp files from the JS inventory. | `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`; `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`; deleted `vitest*.timestamp-*.mjs` temp files | Gate 3/4/6/7 scans PASS by classification; `npm run typecheck` PASS; `npm run validate:project` PASS; `npm run lint:md` PASS. | `return_packages/typescript/TS-HARDENING-GATE-003-BOUNDARY-SCHEMA-2026-04-25.md` |
| 2026-04-25 | TS-HARDENING-GATE-004 | Classified the Gate 5 test/mock scan by false-positive assertions, negative boundary fixtures, SDK mocks, UI harness state bags, validator result bags, and source-scan guardrails. | `docs/typescript/TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md`; `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md` | Gate 5 scan PASS by classification; `npm run typecheck` PASS; `npm run validate:project` PASS; `npm run lint:md` PASS. | `return_packages/typescript/TS-HARDENING-GATE-004-TEST-MOCKS-2026-04-25.md` |
| 2026-04-25 | TS-HARDENING-GATE-005 | Produced the final TypeScript hardening completion evidence package after all hard-stop gates passed with current evidence. | `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`; `return_packages/typescript/TS-HARDENING-GATE-005-FINAL-COMPLETION-2026-04-25.md` | Root strict PASS; shared strict probe PASS; Architect strict probe PASS; Gates 2-7 scans PASS by classification; `npm run validate:project` PASS; `npm run lint:md` PASS; `git diff --check` PASS. | `return_packages/typescript/TS-HARDENING-GATE-005-FINAL-COMPLETION-2026-04-25.md` |

## Validation Ledger

| Date | Command | Result | Evidence / notes |
| --- | --- | --- | --- |
| 2026-04-25 | `npm run validate:project` | PASS | Project schema validator reported all validations passed. |
| 2026-04-25 | `npm run test:diff -- --reporter=dot` | PASS | Diff runner selected FAST support-file scope and ran `npm run test:fast -- --reporter=dot`; 12 files and 57 tests passed. |
| 2026-04-25 | `npm run typecheck` | SKIPPED | Skipped because this setup changed only docs/return-package files and did not touch TS/TSX source. |
| 2026-04-25 | `npm run build` | SKIPPED | Skipped because this setup made no UI, route, or component changes. |
| 2026-04-25 | Source-code hardening | SKIPPED | Explicitly skipped because this setup run must not perform source-code hardening. |
| 2026-04-25 | `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false` | PASS | Exact root compiler command exited 0 under current root config, but Gate 1 still fails because `tsconfig.json` has `"strict": false`. |
| 2026-04-25 | Gate 2 runtime escape scan | FAIL | Completion-contract scan found 121 unclassified hits. Exact command is recorded in the Step 61 return package. |
| 2026-04-25 | Gate 3 declaration scan | PASS | Completion-contract declaration scan found 0 hits. Exact command is recorded in the Step 61 return package. |
| 2026-04-25 | Gate 4 boundary candidate scan | FAIL | Completion-contract boundary scan found 307 hits requiring classification, validation proof, or exception listing. Exact command is recorded in the Step 61 return package. |
| 2026-04-25 | Gate 5 test/mock escape scan | FAIL | Completion-contract scan found 630 unclassified hits. Exact command is recorded in the Step 61 return package. |
| 2026-04-25 | `rg --files -g '*.js' -g '*.jsx' -g '*.cjs' -g '*.mjs' -g '!node_modules/**' -g '!dist/**' -g '!archive/**'` | FAIL | Gate 6 JS-like inventory found 41 unclassified files. |
| 2026-04-25 | Gate 7 schema escape scan | FAIL | Completion-contract schema scan found 36 unclassified hits. Exact command is recorded in the Step 61 return package. |
| 2026-04-25 | `npm run validate:project` | PASS | Project schema validator reported all validations passed after the Step 61 reconciliation docs/return-package update. |
| 2026-04-25 | `npm run test:diff -- --reporter=dot` | PASS | Diff runner selected FAST support-file scope and ran `npm run test:fast -- --reporter=dot`; 12 files and 57 tests passed. |
| 2026-04-25 | `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false` | PASS | Exact root strict compiler command exited 0 with `"strict": true` in `tsconfig.json`. |
| 2026-04-25 | `npm run validate:project` | PASS | Project schema validator reported all validations passed after adding typed helper/declaration files and root strict fixes. |
| 2026-04-25 | `npm run test:diff -- --reporter=dot` | PASS | Diff runner selected FAST support-file scope and ran `npm run test:fast -- --reporter=dot`; 12 files and 57 tests passed. |
| 2026-04-25 | `npm run lint:md` | PASS | Markdown lint passed after the Step 62 plan and return-package updates. |
| 2026-04-25 | Gate 2 runtime escape scan | PASS | Completion-contract scan found 80 hits: 9 true type escapes are listed in the Gate 2 exception table, and the remaining 71 hits are false-positive prose/string-literal matches. |
| 2026-04-25 | `npm run typecheck` | PASS | Root TypeScript compatibility check passed after Step 63 runtime escape removals and guardrail update. |
| 2026-04-25 | `npm run test:diff -- --reporter=dot` | FAIL | Diff runner unexpectedly selected guarded `npm run test:full` because of a pre-existing shared/config diff and failed after 379.05s on `src/tests/architect/myct_step2_guardrails.test.ts`, whose source-scan expectation still required the removed `as any`. The guardrail was updated and targeted validation below passed. |
| 2026-04-25 | `npm run test:node -- --reporter=dot src/tests/architect/myct_step2_guardrails.test.ts src/tests/architect/finalSharedFilterBlockers.behavior.test.tsx src/tests/tradeMachine/validationUtils.contract.test.ts tests/contractSalaryUtils.test.ts src/tests/architect/phase86_league_invariants.test.ts src/tests/architect/useTradeMachine.compatibility.guardrail.test.ts` | PASS | Targeted node validation passed: 5 files and 52 tests passed. |
| 2026-04-25 | `npm run lint:md` | PASS | Markdown lint passed after the Step 63 plan and return-package updates. |
| 2026-04-25 | `git diff --check` | PASS | No whitespace errors reported for the Step 63 diff. |
| 2026-04-25 | Gate 3 declaration scan | PASS | Scan found two justified `declare module` hits in `src/types/vendor-ui.d.ts` and zero declaration-layer `any` hits; details in `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`. |
| 2026-04-25 | Gate 4 boundary candidate scan | PASS | Scan found 307 candidate hits, all classified by boundary family in `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`. |
| 2026-04-25 | Gate 6 JS-like inventory | PASS | Inventory found 38 classified JS/CJS/MJS files after deleting 3 tracked zero-byte Vitest timestamp files. |
| 2026-04-25 | Gate 7 schema escape scan | PASS | Scan found 36 schema escape hits, all classified in `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`. |
| 2026-04-25 | `npm run typecheck` | PASS | Root TypeScript check passed after Step 64 documentation and JS-temp cleanup. |
| 2026-04-25 | `npm run validate:project` | PASS | Project schema validator reported all validations passed after adding the Step 64 evidence doc and deleting tracked temp files. |
| 2026-04-25 | `npm run lint:md` | PASS | Markdown lint passed after the Step 64 evidence, plan, and return-package updates. |
| 2026-04-25 | `git diff --check` | PASS | No whitespace errors reported for the Step 64 diff. |
| 2026-04-25 | Targeted tests | SKIPPED | Step 64 changed docs and deleted zero-byte temp files only; no runtime boundary implementation changed. |
| 2026-04-25 | Gate 5 test/mock escape scan | PASS | Scan found 630 raw hits, all classified in `docs/typescript/TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md`. |
| 2026-04-25 | `npm run typecheck` | PASS | Root TypeScript check passed after Step 65 test/mock classification docs. |
| 2026-04-25 | `npm run validate:project` | PASS | Project schema validator reported all validations passed after adding the Step 65 evidence doc. |
| 2026-04-25 | `npm run lint:md` | PASS | Markdown lint passed after the Step 65 evidence and plan updates. |
| 2026-04-25 | `git diff --check` | PASS | No whitespace errors reported for the Step 65 diff. |
| 2026-04-25 | Targeted tests | SKIPPED | Step 65 added classification documentation only and did not change runtime or test implementation. |
| 2026-04-25 | `rg -n '"strict"\s*:\s*true' tsconfig.json` | PASS | Output included `8:    "strict": true,`. |
| 2026-04-25 | `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false` | PASS | Exact root strict compiler command exited 0 with no output. |
| 2026-04-25 | `./node_modules/.bin/tsc -p tsconfig.shared-boundaries-strict.json --noEmit --pretty false` | PASS | Shared-boundaries strict probe exited 0 with no output. |
| 2026-04-25 | `./node_modules/.bin/tsc -p tsconfig.architect-strict.json --noEmit --pretty false` | PASS | Architect strict probe exited 0 with no output. |
| 2026-04-25 | Gate 2 runtime escape scan | PASS | Final scan found 80 hits; all true escapes are listed in this document's Gate 2 exception table and false positives are classified. |
| 2026-04-25 | Gate 3 declaration scan | PASS | Final scan found 2 justified vendor declaration hits and no declaration-layer `any` hits. |
| 2026-04-25 | Gate 4 boundary candidate scan | PASS | Final scan found 307 candidates, all classified by boundary family in `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`. |
| 2026-04-25 | Gate 5 test/mock escape scan | PASS | Final scan found 630 raw hits, all classified in `docs/typescript/TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md`. |
| 2026-04-25 | Gate 6 JS-like inventory | PASS | Final inventory found 38 classified JS/CJS/MJS files. |
| 2026-04-25 | Gate 7 schema escape scan | PASS | Final scan found 36 schema escape hits, all classified in `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`. |
| 2026-04-25 | `npm run validate:project` | PASS | Project schema validator reported all validations passed during final Gate 8 evidence collection. |
| 2026-04-25 | `npm run lint:md` | PASS | Markdown lint passed after the final Step 66 evidence-package edits. |
| 2026-04-25 | `git diff --check` | PASS | No whitespace errors reported after the final Step 66 evidence-package edits. |
| 2026-04-25 | Targeted tests | SKIPPED | Step 66 changed only documentation and return-package evidence after the compiler, gate-audit, project-validation, markdown-lint, and whitespace gates passed. |
| 2026-04-25 | `npm run build` | SKIPPED | Step 66 made no UI, route, component, or runtime source changes. |
| 2026-04-25 | `npm run test:full` | SKIPPED | Full suite was skipped because the prompt did not contain the required exact phrase `RUN FULL SUITE`. |

## Known Blockers / Deferred Debt

| ID | Severity | Area | Description | Why deferred/blocking | Resume trigger |
| --- | --- | --- | --- | --- | --- |
| None | - | - | No known TypeScript hardening blockers remain after Gate 8 evidence package. | N/A | Re-open only if a future regression changes a hard-stop gate. |

## Return Package Index

| Date | Work ID | Return package | Purpose |
| --- | --- | --- | --- |
| 2026-04-25 | TS-HARDENING-CONTINUOUS-SETUP | `return_packages/typescript/TS-HARDENING-CONTINUOUS-SETUP-2026-04-25.md` | Continuous execution setup and non-completion evidence for the current TypeScript hardening plan. |
| 2026-04-25 | TS-HARDENING-061 | `return_packages/typescript/TS-HARDENING-061-RECONCILIATION-2026-04-25.md` | Step 61 completion-contract reconciliation and non-completion evidence. |
| 2026-04-25 | TS-HARDENING-GATE-001 | `return_packages/typescript/TS-HARDENING-GATE-001-ROOT-STRICT-2026-04-25.md` | Gate 1 root strict-mode enablement evidence. |
| 2026-04-25 | TS-HARDENING-GATE-002 | `return_packages/typescript/TS-HARDENING-GATE-002-RUNTIME-ESCAPES-2026-04-25.md` | Gate 2 runtime escape audit, removals, exceptions, and validation evidence. |
| 2026-04-25 | TS-HARDENING-GATE-003 | `return_packages/typescript/TS-HARDENING-GATE-003-BOUNDARY-SCHEMA-2026-04-25.md` | Gate 3, 4, 6, and 7 classification and validation evidence. |
| 2026-04-25 | TS-HARDENING-GATE-004 | `return_packages/typescript/TS-HARDENING-GATE-004-TEST-MOCKS-2026-04-25.md` | Gate 5 test/mock escape classification and validation evidence. |
| 2026-04-25 | TS-HARDENING-GATE-005 | `return_packages/typescript/TS-HARDENING-GATE-005-FINAL-COMPLETION-2026-04-25.md` | Final Gates 1-8 TypeScript hardening completion evidence package. |

## Gate 2 Runtime Escape Exception Table

The 2026-04-25 Gate 2 scan has 80 matches. The table below lists every true type escape marker that remains; the other 71 matches are false-positive prose, comments, UI text, or string-literal domain values such as `"any"`.

| File | Line | Marker | Reason necessary | Why safe | Owner / follow-up |
| --- | ---: | --- | --- | --- | --- |
| `src/schemas/players_v2.ts` | 134 | `z.any()` | Legacy player contract `options` array accepts mixed option payloads from historical source data. | Contained inside the canonical Zod schema instead of a broad TypeScript cast. | Gate 7 must classify or narrow this schema escape. |
| `src/schemas/players_v2.ts` | 211 | `z.record(z.string(), z.any())` | Historical contract-map entries can contain variant legacy contract payloads. | Contained inside the canonical schema and not leaked as an ambient declaration. | Gate 7 must classify or narrow this schema escape. |
| `src/schemas/players_v2.ts` | 237 | `z.any()` | Evaluation score slot accepts legacy generated evaluation payloads that are not normalized yet. | Schema-owned and localized to the player schema review surface. | Gate 7 must classify or narrow this schema escape. |
| `src/schemas/players_v2.ts` | 253 | `z.any()` | Current-contract options payload is mixed across older player documents. | Nullable/optional field remains schema-local until schema audit decides the final contract. | Gate 7 must classify or narrow this schema escape. |
| `src/schemas/players_v2.ts` | 274 | `z.record(z.string(), z.any())` | Player `meta` allows legacy ingestion metadata with unknown value shapes. | Metadata stays isolated under schema parsing and is not used as a typed runtime contract. | Gate 7 must classify or narrow this schema escape. |
| `src/schemas/players_v2.ts` | 313 | `z.record(z.string(), z.any())` | Duplicate/index-style legacy player records preserve extra unknown fields during migration. | Schema-local passthrough surface, not a root runtime cast. | Gate 7 must classify or narrow this schema escape. |
| `src/schemas/architect.ts` | 151 | `z.record(z.string(), z.any())` | Architect exception extra fields preserve dynamic exception metadata pending schema review. | Contained in the Architect schema layer and validated around known keys elsewhere. | Gate 7 must classify or narrow this schema escape. |
| `src/features/architect/utils/tradeMachine/engine/validationUtils.ts` | 12 | `any[]` | Validator wrapper must accept heterogeneous validator argument tuples while preserving each validator's own `Parameters<T[K]>` and `ReturnType<T[K]>`. | The `any` is limited to the generic variadic tuple constraint; wrapped validators still preserve concrete parameter and return types at call sites. | Architect trade-validator owner; revisit only if a TypeScript-safe heterogeneous validator-map abstraction replaces it. |
| `src/features/architect/utils/tradeContext/types.ts` | 18 | `Record<string, any>` | Legacy trade-context snapshot paths still require an any-valued carrier for compatibility with validator output bags. | The bridge type is centralized and downstream code narrows validator output before live trade-apply use. | Gate 4 trade-context boundary audit should either replace this bridge or carry a runtime-boundary exception. |

**How this doc works:** When the user says "keep working on `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`," find the first step below with status `TODO` or `IN PROGRESS`, do it, then update the status to `DONE` (or leave it `IN PROGRESS` with a note if blocked or partial). One step per session unless a step is truly trivial or the current step explicitly allows a tightly coupled same-session batch. Do not skip ahead. Do not invent unrelated work. If a checkpoint, review, or strictness measurement reveals additional work that is still inside this document's mission, append new numbered steps to this same document immediately after the checkpoint that discovered it and continue. Do not close this plan while substantial mission-area debt remains.

**Mission statement (non-negotiable):** The mission of this document is to drive the repo to **complete TypeScript hardening across the full project**. This plan is not complete when a bounded phase ends. It is complete only when the repo is materially hardened end-to-end and no substantial hardening backlog remains inside the mission area.

**What counts as complete hardening for this plan:**

- No repo-wide declaration-layer dishonesty remains (no fake ambient module shims masking real TS/TSX exports).
- Shared/runtime boundaries are honestly typed and validated where appropriate.
- Architect/runtime boundaries are honestly typed and validated where appropriate.
- High-value typed tests and mocks reinforce runtime contracts rather than broadly bypassing them.
- Strictness readiness is no longer blocked by a large, known, mission-area backlog.
- Final review truthfully supports a completion-level verdict for the mission, not merely a phase-level win.

**Hard anti-loophole rules (REQUIRED — do not violate):**

1. **No fake completion:** Do not mark this plan complete if any step, checkpoint, review, return package, or strictness measurement states that a substantial remaining phase is still required inside this plan's mission.
2. **No separate-plan escape hatch:** Do not recommend or create a separate follow-on plan for work that is still inside the mission of this document. If more work is needed, append new numbered steps to this same plan and continue.
3. **Verdict must match closure:** If the most honest repo verdict is anything less than true completion of the mission (for example `PASS WITH DEBT`, `CONCERN`, or equivalent), this plan must remain open unless the remaining debt is explicitly outside scope by user instruction.
4. **Checkpoint extension rule:** If a checkpoint reveals broader remaining work than expected, the agent must add new numbered steps immediately after the checkpoint rather than closing the plan or deferring to a future plan.
5. **Final closeout gate:** The final closeout step may be marked `DONE` only if all of the following are true:
   - no substantial hardening backlog remains inside the mission area;
   - no baseline/review/probe says a dedicated follow-up is still required for mission-area work;
   - remaining issues are explicitly minor, optional, or user-declared out of scope;
   - the final review supports a completion-level verdict.

**Commit & status hygiene (REQUIRED — do not skip):**

1. Use the commit message specified in each step. Never use generic placeholder text.
2. BEFORE committing source changes, edit this file to change the step's `**Status:** TODO` line to `**Status:** DONE` and append a one-line completion note with today's date.
3. Include the plan-doc update in the same commit as the step's work.
4. If you cannot complete the step in one session, change the status to `IN PROGRESS` and add a brief note describing where you left off.
5. If a step is blocked on a real product-direction decision, mark it `BLOCKED`, ask the user one plain-language question, and stop. Do not widen the step to stay busy.
6. If a checkpoint forces the plan to extend, update the flow summary near the top of this document in the same commit that adds the new steps.

**Background context (read before starting any step):**

- The repo-wide TypeScript migration is structurally complete in runtime app code, but the original post-migration hardening audit returned **CONCERN** rather than PASS.
- The first hardening phase removed the largest declaration-layer lie (`src/global-shims.d.ts`), hardened the shared/runtime strict probe from `244` errors to `0`, hardened a planned set of Architect/base-data ingress points, and improved central Firebase mock truth.
- That phase did **not** complete the full mission. The Architect/test strict probe still reports a large remaining backlog and the earlier phase incorrectly treated that as a separate follow-on plan instead of extending this master plan.
- This rewritten master plan absorbs the already-completed hardening work and explicitly continues from there. The earlier phase is now part of this document's history, not a reason to close the mission.
- Root TypeScript still runs with `strict: false`, so root `npm run typecheck` remains only a compatibility gate, never sufficient proof of hardening.
- Active strict probes exist and must be used as mission progress instruments:
  - `tsconfig.shared-boundaries-strict.json`
  - `tsconfig.architect-strict.json`
- The remaining large mission-area backlog is concentrated in Architect runtime contracts, Architect dashboard/action adapter contracts, mutation-pipeline carrier contracts, and the highest-value Architect persistence / trade / season harnesses.

**Plan continuity invariant (applies to the entire doc):**

- This is one self-extending master plan, not a series of disconnected phase plans.
- Completing one step never throws the document off route; it only advances the plan to the next numbered step.
- Reviews, audits, cleanup loops, checkpoint decisions, and strictness assessments are allowed only if they explicitly reconnect to the next numbered step.
- New phases discovered by evidence must be appended to this same plan.
- The plan ends only when the mission ends.

**Current planned flow:**

- Steps 1–13: completed hardening foundation phase (baseline, execution map, declaration cleanup, shared/runtime hardening, initial Architect ingress hardening, initial typed-test hardening, strictness checkpoint)
- Steps 14–15: reset the master-plan truth and turn the remaining Architect/test backlog into an execution map inside this same plan
- Steps 16–18: normalize the highest-leverage Architect runtime carrier and adapter contracts
- Steps 19–21: harden the highest-value remaining Architect persistence / trade / season test harnesses and central supporting mocks/fixtures
- Step 22: reassess strictness readiness after the Architect normalization wave
- Steps 23–24: harden the next persistence/world/cap truth clusters exposed by the master checkpoint
- Step 25: reassess post-wave readiness and split the remaining Architect/test debt into the next bounded waves
- Steps 26–27: harden the remaining exception/parity guardrail cluster, then the remaining integration/normalization harness cluster
- Step 28: reassess final-review readiness after the exception/parity and integration/normalization waves, then extend the plan again from the remaining backlog
- Steps 29–30: harden the next Architect/trade guardrail cluster and the next trade validator/unit truth cluster exposed by the Step 28 checkpoint
- Step 31: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 32–33: harden the next Architect DARE/trade-apply cluster, then the next trade-rule/TPE unit cluster exposed by the Step 31 checkpoint
- Step 34: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 35–36: harden the next Architect dead-cap/season-state cluster, then the next trade aftermath/snapshot cluster exposed by the Step 34 checkpoint
- Step 37: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 38–39: harden the next mutation-owner/persistence cluster, then the next cap-sheet/timing/consent cluster exposed by the Step 37 checkpoint
- Step 40: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 41–42: harden the next Architect sign-and-trade/mutation guardrail cluster, then the next roster/rule validation cluster exposed by the Step 40 checkpoint
- Step 43: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 44–45: harden the next Architect reactivity/CBA guardrail cluster, then the next offseason/DARE/preflight truth cluster exposed by the Step 43 checkpoint
- Step 46: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 47–48: harden the next runtime-owner boundary cluster, then the next remaining trade/Architect test truth cluster exposed by the Step 46 checkpoint
- Step 49: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 50–51: reserved for final review and closeout only after a later checkpoint proves the mission-level completion gates are actually satisfied
- Steps 62–66: completion-contract gate closure sequence added after the 2026-04-25 Step 61 reconciliation; Step 62 now satisfies Gate 1, and Step 63 continues with Gate 2 runtime escape classification.

**Universal constraints (apply to every step):**

- Discovery steps are doc-only unless the step explicitly allows source edits.
- Prefer the narrowest truthful fix. Do not widen types to make TypeScript quiet.
- `any` is not an acceptable escape hatch except at a truly unavoidable third-party boundary, and even there it must be localized and documented.
- At data boundaries (Firestore, JSON parsing, route params, local/session storage, external scraper inputs), use truthful runtime guards or Zod where appropriate. Cast + validation is acceptable; cast alone is not.
- Keep validation scoped. Use the cheapest approved commands that actually prove the touched area. Always append `--reporter=dot` to test scripts.
- `npm run typecheck` is a compatibility gate only; it is never sufficient by itself as evidence of hardening progress.
- Use the strict probe that matches the surface being hardened: `tsconfig.shared-boundaries-strict.json` for shared/runtime work, `tsconfig.architect-strict.json` for Architect/test work, and both when declaration-layer changes cross those surfaces.
- Do not run the full suite unless the prompt contains the exact phrase `RUN FULL SUITE`.
- If a step reveals duplicated utilities, duplicated schemas, or product/policy inconsistencies that are real but not in scope, record them in the Follow-up section at the bottom rather than widening the step.
- If a step removes a legacy shim or broad declaration, fix the downstream call sites or imports that break. Those breakages are the point.
- This plan is about **hardening trust**, not aesthetics. Do not spend time on style-only cleanup.

---

## Phase History — Completed foundation work (Steps 1-13)

The following steps are already complete and remain part of this master plan's history. They do not close the mission by themselves.

## Step 1 — Create the post-migration hardening evidence baseline

**Status:** DONE

Completed 2026-04-21: Created `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md` with live inventory, compiler posture, dishonesty-marker counts, strict-probe baselines, and audit risk themes.

---

## Step 2 — Turn the audit into a tracked execution map

**Status:** DONE

Completed 2026-04-21: Created `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md` with ordered declaration, shared/runtime, Architect, typed-test, and strict-prep waves mapped to Steps 3-12.

---

## Step 3 — Remove dishonest ambient shims that mask real module types

**Status:** DONE

Completed 2026-04-21: Deleted `src/global-shims.d.ts`, removed the fake ambient module contracts, and fixed the downstream shared UI, cap totals, TPE, trade-context, and guardrail-test contracts exposed by real module types.

---

## Step 4 — Re-audit the declaration layer and classify what remains

**Status:** DONE

Completed 2026-04-21: Classified the three remaining project `.d.ts` files, confirmed there are no remaining live `declare module` shims, removed the stale strict-probe include for deleted `src/global-shims.d.ts`, and recorded `PlayerNameMini.d.ts` as the only suspicious local declaration bridge.

---

## Step 5 — Harden shared data boundaries before widening Architect work

**Status:** DONE

Completed 2026-04-21: Added runtime schema parsing for shared player Firestore reads, guarded Tier Maker session-storage restore, and typed the route/list/roster/table surfaces required for the shared strict probe to pass.

---

## Step 6 — Harden Architect/base-data Firestore boundaries (wave 1)

**Status:** DONE

Completed 2026-04-21: Added Architect Firestore boundary guards and routed `subscribeArchitectPlayerData`, `loadArchitectBasePlayer`, and `teamLoader` through record/player/team normalization; root typecheck, project validation, and targeted `teamLoader` tests pass.

---

## Step 7 — Harden Architect/base-data Firestore boundaries (wave 2) and classify what can defer

**Status:** DONE

Completed 2026-04-21: Hardened `worldManager.ts` world metadata reads and `firebaseTeamPlanHelpers.ts` base team/player/free-agent reads with runtime boundary readers, then added the Architect Boundary Review classification to the baseline.

---

## Step 8 — Reduce typed-test dishonesty in the highest-value mocks and suites

**Status:** DONE

Completed 2026-04-21: Typed the shared Firebase mock, replaced trade-persistence bag fixtures with explicit fixture contracts, tightened the free-agency harness away from repeated fixture `as any` casts, and improved the first selected Architect suites.

---

## Step 9 — Review test typing posture and classify what remains

**Status:** DONE

Completed 2026-04-21: Added the baseline `Test Typing Review` with updated test-only marker counts, Step 8 deltas, a classified remainder list, and a plain-language conclusion that central mocks improved materially but Architect action/trade/cap harnesses still dominate the typed-bypass debt.

---

## Step 10 — Checkpoint: reassess strict-mode readiness with evidence

**Status:** DONE

Completed 2026-04-21: Added the baseline `Strictness Checkpoint`; the shared strict probe moved from `244` errors to `0`, while the Architect strict probe shifted from `2,567` to `2,632`.

**Important correction:** In the earlier bounded-phase version of this plan, Step 10 treated the remaining Architect/test backlog as a reason to create a separate follow-on plan. Under this self-extending master-plan contract, that outcome no longer permits closure. It instead forces this document to continue with new numbered steps.

---

## Step 11 — Strict-prep wave decision correction

**Status:** DONE

Completed 2026-04-21: The earlier bounded-phase plan skipped a strict-prep wave because the remaining Architect/test debt was too broad for one narrow pass. Under this master-plan rewrite, that result is preserved as evidence, but it no longer authorizes closure or a separate follow-on plan.

---

## Step 12 — Final hardening review from the foundation phase

**Status:** DONE

Completed 2026-04-21: Created `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md` with resolved, deferred, follow-up, and architecture-decision classifications plus a `PASS WITH DEBT` verdict.

**Important correction:** `PASS WITH DEBT` is a valid phase result, but under this master-plan contract it is not a completion verdict for the mission. The plan therefore remains open.

---

## Step 13 — Absorb the former closeout into this master plan

**Status:** DONE

Completed 2026-04-22: The previous closeout language has been superseded by this self-extending master-plan rewrite. The former claim that a separate next-phase plan was warranted is now treated as a checkpoint discovery that extends this same document rather than ending it.

---

## Step 14 — Reset the master-plan truth and create the remaining-work baseline

**Status:** DONE

Completed 2026-04-22: Added the `Master Plan Resume Baseline` with live shared/Architect strict-probe counts, current Architect hotspot files/error families, a plain-language blocker summary, and an explicit correction that the earlier `PASS WITH DEBT` verdict was phase-level only.

**Goal:** Create a truthful post-Step-13 baseline that explicitly records what remains inside the mission after the completed foundation phase, so the master plan resumes from the real remaining backlog rather than the old false closeout.

**Instructions:**
Update `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md` with a new section named `Master Plan Resume Baseline`.

That section must include:

1. The current strict-probe counts for:
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. A concise statement that the shared/runtime probe is now green and that the mission-area backlog is now concentrated in Architect runtime contracts and Architect tests.
3. Updated top Architect strict hotspots by file and error family.
4. A plain-language statement of what is still preventing full project type hardening.
5. A short explanation that `PASS WITH DEBT` from the earlier final review is now treated as an intermediate phase result, not a mission-complete result.

Do not change source files in this step.

**Constraints specific to this step:**

- This step is doc-only.
- Use live repo evidence, not old summaries as truth.
- The output must make it impossible for later steps to pretend the mission is done before the Architect/test backlog is addressed.

**Done when:** The baseline doc has a `Master Plan Resume Baseline` section that truthfully resets the plan around the remaining mission backlog. Commit message: `docs: reset TypeScript hardening master-plan baseline`.

---

## Step 15 — Convert the remaining Architect/test backlog into an execution map inside this same plan

**Status:** DONE

Completed 2026-04-22: Added `Master Plan Remaining Waves` to the execution map with live Architect strict hotspots, support-layer dependencies, and a Step 16-22 continuation order.

**Goal:** Turn the remaining Architect runtime + test strict backlog into a concrete execution map for the next hardening waves inside this same document.

**Instructions:**
Update `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md` with a new section named `Master Plan Remaining Waves`.

Using the current Architect strict-probe output and live file inspection, group the remaining mission-area backlog into these buckets:

1. **Architect runtime contract-normalization hotspots**
   - `src/features/architect/utils/mutationPipeline.ts`
   - `src/features/architect/GMDashboard/**`
   - `src/features/architect/hooks/useTradeMachine.ts`
   - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
2. **Architect persistence / offer-sheet / season harnesses**
   - `tests/architect/seasonManager.test.ts`
   - `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
   - `tests/architect/offerSheetPersistence.test.ts`
   - the next strongest trade/cap integration harnesses by live strict count
3. **Architect remaining mock / fixture / compatibility layers**
   - any central helper or fixture files that still amplify test-side dishonesty or assignability churn
4. **Strict-prep families that remain after runtime/test normalization**
   - only if the evidence suggests a later focused cluster may still be needed

For each file or tight file group, record:

- path
- why it still matters
- whether it is runtime-critical, test-critical, or support-critical
- dominant current error families
- recommended wave order
- recommended validation commands

End the new section with a `Recommended continuation order` that maps directly to Steps 16–22 below.

Do not change source files in this step.

**Constraints specific to this step:**

- Keep the map centered on the remaining mission backlog. Do not reopen already-hardened shared/runtime work unless the live evidence says it regressed.
- Favor central contract owners over low-value leaf tests.
- This map must feed the next execution waves without requiring user decisions.

**Done when:** The execution map doc contains a truthful remaining-wave map for the Architect/runtime/test hardening backlog and the next steps below can execute directly from it. Commit message: `docs: map remaining TypeScript hardening waves`.

---

## Step 16 — Normalize the highest-leverage Architect runtime contract owners (wave 1)

**Status:** DONE

Progress note 2026-04-22: Landed the isolated `SeasonAdvanceModal.tsx` null-to-undefined cleanup that cleared that 2-error pocket under `tsconfig.architect-strict.json`, but the broader `GMDashboard` / `useArchitectActions` / `mutationPipeline` runtime-carrier normalization attempt was reverted after it regressed the root compatibility gate. Resume from the current live hotspot cluster (`mutationPipeline.ts`: 55, `useArchitectActions.ts`: 22, `GMDashboard.tsx`: 5, `SeasonAdvanceModal.tsx`: 0).

Completed 2026-04-22: Normalized the dashboard/action runtime adapter wave, manual cap-sheet payload handoffs, dev fixture generics, and trade-machine team lookup contracts while keeping root typecheck green. Architect strict probe moved from the Step 16 resume count of `2,632` to `2,549`; `useArchitectActions.ts`, `GMDashboard.tsx`, cap-sheet handoffs, and `useTradeMachine.ts` no longer appear in the runtime hotspot list. Remaining runtime work is concentrated in `mutationPipeline.ts` and `TradeEditor.tsx` for Step 17.

**Goal:** Reduce the most central Architect runtime assignability/nullability debt by normalizing the contract owners that many downstream consumers depend on.

**Instructions:**
Use Step 15's remaining-wave map and begin with the highest-leverage runtime contract owners. Likely first-wave targets include:

- `src/features/architect/utils/mutationPipeline.ts`
- one tightly coupled dashboard/action adapter cluster that directly feeds it or receives its outputs

For the chosen wave:

1. Identify the concrete contract disagreements causing the dominant strict errors.
2. Normalize the runtime carrier types truthfully rather than layering more casts on top.
3. Fix downstream consumers that rely on the old dishonest contract.
4. Keep runtime behavior stable unless a behavior difference was only possible because the type contract was false.

Validation after each meaningful batch:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant Architect/runtime suites with `--reporter=dot`

**Constraints specific to this step:**

- This is a contract-normalization step, not a broad logic rewrite.
- Do not widen types to preserve false compatibility.
- If a product/architecture choice is truly required, ask one plain-language question and stop.

**Done when:** The first runtime contract-owner wave is normalized, the downstream consumers compile truthfully, and the Architect strict probe shows a meaningful reduction in the targeted error families. Commit message: `refactor: normalize architect runtime contracts wave 1`.

---

## Step 17 — Normalize the next Architect runtime contract owners (wave 2)

**Status:** DONE

Completed 2026-04-22: Normalized the remaining trade-editor/team-card runtime display adapters around nullable hook team and entitlement payloads, tightened current-state normalizers in `mutationPipeline.ts`, and recorded the Architect strict probe delta from `2,549` to `2,501`; `TradeEditor.tsx` / child trade-machine UI files no longer appear in the Architect strict output, while remaining runtime debt is concentrated in `mutationPipeline.ts` for Step 18 classification.

**Goal:** Continue Architect runtime contract normalization through the next highest-leverage cluster exposed by Step 16 and the execution map.

**Instructions:**
Use the next wave from Step 15 and continue with the next highest-leverage contract cluster. Likely targets include:

- the remaining `GMDashboard/**` adapter surfaces
- `useTradeMachine.ts`
- `useArchitectActions.ts`
- any tight runtime bridge identified by the map as still central after Step 16

For the chosen wave:

1. Normalize the carrier/adapter contracts.
2. Remove casts or bag types that were only hiding disagreements.
3. Fix the consuming runtime surfaces truthfully.
4. Re-run the Architect strict probe and record the wave delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant Architect/runtime suites with `--reporter=dot`

**Constraints specific to this step:**

- Keep the wave bounded to the chosen cluster.
- Do not drift into unrelated low-value tests just because they also error.
- If Step 16 already collapses this cluster more than expected, record that and tighten the scope rather than over-expanding.

**Done when:** The second runtime contract wave is complete and the plan records the strict-probe delta plus what runtime hotspots remain. Commit message: `refactor: normalize architect runtime contracts wave 2`.

---

## Step 18 — Review runtime contract posture and classify the remaining runtime backlog

**Status:** DONE

Completed 2026-04-22: Added the baseline `Runtime Contract Review` with the
confirmed `2,501` Architect-strict count, runtime-vs-test concentration
breakdown, remaining runtime classification, and a recommendation to shift the
next wave to the highest-value test harnesses while keeping
`mutationPipeline.ts` as the next bounded runtime candidate.

**Goal:** After the first two runtime normalization waves, classify what Architect runtime debt remains and decide whether more runtime normalization is still needed before pushing harder on tests.

**Instructions:**
Append a `Runtime Contract Review` section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

Include:

1. Updated Architect strict-probe counts after Steps 16–17.
2. Which runtime hotspots were materially improved.
3. Which remaining runtime backlog is:
   - `Immediate next-wave candidate`
   - `Safe to defer until tests are tightened`
   - `Needs product/architecture decision`
4. A plain-language recommendation for whether the next wave should prioritize tests, more runtime normalization, or a mixed runtime/test cluster.

**Constraints specific to this step:**

- This is a review/classification step.
- Do not launch a third runtime wave inside this step; classify it instead.

**Done when:** The baseline doc truthfully records the runtime contract posture after the first normalization waves and the next priority is unambiguous. Commit message: `docs: review architect runtime contract posture`.

---

## Step 19 — Harden the highest-value remaining Architect persistence / season / offer-sheet harnesses (wave 1)

**Status:** DONE

Completed 2026-04-22: Hardened `tests/helpers/architectTestHelpers.ts` and `tests/architect/seasonManager.test.ts` with truthful helper contracts, typed mock readers, and explicit season-advance success/failure narrowing; Architect strict moved from `2,501` to `2,403`, while both targeted files fell to `0` strict errors.

**Goal:** Make the most important remaining Architect tests enforce the newly normalized runtime contracts instead of bypassing them with broad fixtures and compatibility casts.

**Instructions:**
Use Step 15's map and Step 18's recommendation. Start with the highest-value remaining test harness cluster, likely among:

- `tests/architect/seasonManager.test.ts`
- `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
- `tests/architect/offerSheetPersistence.test.ts`

For the chosen cluster:

1. Remove unnecessary `any`, `as any`, and bag fixtures.
2. Replace fake carrier shapes with truthful fixture contracts tied to the current runtime types.
3. Keep deliberately invalid test inputs explicit rather than hiding them inside permissive casts.
4. Update any shared fixture helpers needed by the selected cluster.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant test scripts with `--reporter=dot`

**Constraints specific to this step:**

- Focus on high-value harnesses only.
- Do not try to cleanse the entire test tree in one pass.
- If a runtime export/type tweak is needed to let the tests become truthful, that is allowed.

**Done when:** The first selected high-value Architect test cluster is materially more truthful and the strict probe drops meaningfully in its targeted files/error families. Commit message: `test: harden architect persistence harnesses wave 1`.

---

## Step 20 — Harden the next highest-value Architect test cluster (wave 2)

**Status:** DONE

Completed 2026-04-22: Hardened `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts` and `tests/architect/offerSheetPersistence.test.ts` around typed mutation fixtures and required result helpers; the Architect strict probe dropped from `2,403` to `2,228`, both target files cleared from the strict output, and the narrow node test run passed for both harnesses.

**Goal:** Continue test-harness tightening through the next most central Architect cluster after Step 19.

**Instructions:**
Use the next cluster from the execution map and continue with the next highest-value remaining test hotspot.

For the chosen cluster:

1. Tighten fixtures, mocks, and helper contracts.
2. Remove broad typed bypasses where a truthful narrow contract can be used.
3. Keep test behavior the same unless the old behavior depended on a dishonest harness.
4. Re-run the Architect strict probe and record the delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant test scripts with `--reporter=dot`

**Constraints specific to this step:**

- Keep the wave bounded to one tight cluster.
- Do not drift into opportunistic cleanup of low-value leaf suites.

**Done when:** The second selected Architect test cluster is materially more truthful and the plan records the resulting strict-probe delta plus the remaining test hotspots. Commit message: `test: harden architect persistence harnesses wave 2`.

---

## Step 21 — Review typed-test posture again and classify what remains

**Status:** DONE

Completed 2026-04-22: Added the baseline `Master Plan Test Review` with live test-side marker counts, current Architect-strict test concentration, the Step 19-20 harness improvements, and a classification that keeps the next wave centered on cap/world/persistence truth while deferring the broader exception/parity guardrails.

**Goal:** Re-measure the Architect test layer after the new harness waves and classify what test debt remains inside the mission.

**Instructions:**
Append a `Master Plan Test Review` section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

Include:

1. Updated test-side marker counts.
2. Which central Architect harnesses were materially improved in Steps 19–20.
3. Which remaining test backlog is:
   - `Immediate next-wave candidate`
   - `Safe to defer only if runtime strictness is otherwise mission-complete`
   - `Needs architecture-contract decision`
4. A plain-language conclusion on whether the high-value test layer is now mostly reinforcing runtime truth.

**Constraints specific to this step:**

- This is a measurement/classification step.
- Do not widen into another cleanup wave here.

**Done when:** The repo has a truthful post-wave review of the remaining Architect test debt and the next priority is clear. Commit message: `docs: review architect typed-test posture`.

---

## Step 22 — Master checkpoint: reassess full-project hardening readiness

**Status:** DONE

Completed 2026-04-22: Re-ran the root, shared-strict, and architect-strict probes; shared remains green while Architect improved to `2,228`, but the backlog is still broad across `168` files and dominated by test clusters. Added the `Master Hardening Checkpoint`, then extended this same plan with Steps 23-25 for the next persistence/world/cap waves instead of allowing any completion path.

**Goal:** Re-run the mission-level measurements after the runtime and test normalization waves and determine whether the project is now actually close to complete hardening or whether another numbered wave must be appended.

**Instructions:**
This is the master checkpoint for the mission, not an exit ramp.

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Record the current counts and compare them to both:
   - the original baseline
   - the Step 14 master-plan resume baseline
3. Identify whether the remaining backlog is now:
   - small and localized enough for one final bounded wave,
   - still broad enough to require multiple additional waves,
   - blocked on a real product/architecture decision.
4. Append a `Master Hardening Checkpoint` section to the baseline doc that answers, plainly:
   - Are we now close to complete project hardening?
   - If not, exactly what remains?
   - What is the next highest-leverage wave?

Then do one of the following:

- If substantial mission-area backlog remains, append new numbered steps to this same plan immediately after Step 22 and update the flow summary near the top.
- If only a small final bounded wave remains, set up that final bounded wave as Steps 23–24 and continue.
- Only if the mission-level completion gates are truly satisfied may the plan proceed to the final review/closeout steps already at the bottom.

**Constraints specific to this step:**

- This step may not declare the mission complete by itself.
- If any substantial mission-area backlog remains, the plan must extend.
- Do not write "separate follow-on plan required" here. Extend this plan instead.

**Done when:** The baseline doc has a `Master Hardening Checkpoint` section and, if needed, this plan has been extended with the next numbered wave(s) inside the same document. Commit message: `docs: record master TypeScript hardening checkpoint`.

---

## Step 23 — Harden the remaining persistence/world truth cluster (wave 3)

**Status:** DONE

Completed 2026-04-22: Hardened truthful persisted world/team readers plus the `mutationPipeline.tradePersistenceTruth`, `worldManager`, and `teamLoader` harnesses; the Architect strict probe dropped from `2,228` to `2,050`, none of the Step 23 files still appear in that output, and the targeted node run passed `87 / 87` tests.

**Goal:** Tighten the highest-leverage remaining persistence/world test harnesses that still sit closest to the hardened runtime readers and mutation carriers.

**Instructions:**
Use the Step 22 master checkpoint and the Step 21 test review. Focus this wave on the current persistence/world truth cluster, starting with:

- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- `tests/architect/worldManager.test.ts`
- `tests/architect/teamLoader.test.ts`
- only the minimum supporting mock/helper readers needed to make those harnesses truthful

For the chosen cluster:

1. Replace bag-shaped persisted team/world snapshots with truthful helper-backed fixtures.
2. Align mock snapshot readers with the current hardened reader/runtime contracts instead of broad object assumptions.
3. Remove typed bypasses that only exist to paper over persistence-shape disagreement.
4. Keep runtime behavior the same unless the previous harness shape depended on false persistence truth.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/architect/mutationPipeline.tradePersistenceTruth.test.ts tests/architect/worldManager.test.ts tests/architect/teamLoader.test.ts`

**Constraints specific to this step:**

- Keep the wave bounded to the persistence/world truth cluster.
- Do not drift into cap legality, renounce rights, or exception parity in this step.
- Runtime helper edits are allowed only when they are the minimum needed to make the selected harnesses truthful.

**Done when:** The persistence/world truth cluster is materially more truthful, the targeted tests pass, and the Architect strict probe shows a meaningful drop in those files. Commit message: `test: harden architect persistence truth wave 3`.

---

## Step 24 — Harden the cap legality / rights persistence cluster (wave 4)

**Status:** DONE

Completed 2026-04-22: Hardened the `capLegalityValidation` and `renounceRights` harnesses around truthful cap/rules fixtures, required violation/warning readers, and persisted-state payload guards; the Architect strict probe dropped from `2,050` to `1,914`, neither Step 24 file still appears in that output, and the targeted node run passed `248 / 248` tests.

**Goal:** Tighten the next highest-value cap/rules persistence harnesses after the world/persistence truth cluster.

**Instructions:**
Use the next hotspot cluster from the Step 22 checkpoint. Focus on:

- `tests/architect/capLegalityValidation.test.ts`
- `tests/architect/renounceRights.test.ts`
- the minimum supporting cap/rights helpers or runtime contract nips required to keep those harnesses truthful

For the chosen cluster:

1. Remove raw persisted-state assumptions and broad typed bypasses.
2. Normalize fixture/state builders around the current cap legality and renounce-rights contracts.
3. Keep behavior unchanged unless the old harness depended on a dishonest shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/architect/capLegalityValidation.test.ts tests/architect/renounceRights.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to cap legality / renounce-rights truth.
- Do not widen into the exception/parity guardrail suites yet.

**Done when:** The cap legality / rights persistence cluster is materially more truthful and the plan records the resulting strict-probe delta plus what still remains. Commit message: `test: harden architect cap and rights harnesses`.

---

## Step 25 — Post-wave checkpoint: classify the remaining exception/parity backlog

**Status:** DONE

Completed 2026-04-22: Re-ran the root compatibility gate plus the shared and Architect strict probes, confirmed the shared probe remains green while Architect strict sits at `1,914`, and classified the remaining backlog as two more bounded waves rather than one last cleanup pass or an architecture blocker.

**Goal:** Re-run the mission-level measurements after Steps 23-24 and decide whether the remaining exception/parity/integration debt is one final bounded wave or still broad enough to require multiple additional waves.

**Instructions:**
Append a `Post-Step-24 Hardening Checkpoint` section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint.
3. Classify whether the remaining backlog is now:
   - one bounded exception/parity wave,
   - still multiple waves,
   - blocked on a real architecture decision.
4. Append the next numbered steps to this same plan immediately after Step 25 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the post-wave checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-wave architect hardening checkpoint`.

---

## Step 26 — Harden the exception lifecycle / parity guardrail cluster (wave 5)

**Status:** DONE

Completed 2026-04-22: Hardened the `phase76` exception lifecycle parity, `phase74` room exception, and `exceptionManagement` harnesses around truthful exception fixtures plus required violation/team-update readers; the Architect strict probe dropped from `1,914` to `1,730`, none of the Step 26 files still appear in that output, and the targeted node run passed `59 / 59` tests.

**Goal:** Tighten the remaining exception/parity guardrail harnesses that now dominate the Architect strict backlog after the cap-legality / rights wave.

**Instructions:**
Focus this wave on the tightest remaining exception/parity cluster:

- `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts`
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts`
- `src/tests/architect/exceptionManagement.test.ts`
- only the minimum supporting helper/runtime edits required to make those harnesses truthful

For the chosen cluster:

1. Replace raw optional exception snapshots and parity assumptions with required-reader helpers.
2. Align fixture builders with the current exception lifecycle and season-advance contracts instead of bag-shaped state.
3. Keep runtime behavior unchanged unless a harness depended on a dishonest contract.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts src/tests/architect/exceptionManagement.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to exception lifecycle / parity truth.
- Do not widen into the broader integration/normalization suites in this step.

**Done when:** The exception/parity guardrail cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect exception parity guardrails`.

---

## Step 27 — Harden the remaining integration / normalization harness cluster (wave 6)

**Status:** DONE

Completed 2026-04-23: Hardened the planned integration/normalization harness cluster across `contractNormalization`, `schemaAdapter`, `integration`, `e2e-workflows`, and the Phase 13 entitlement guardrail; Step 27 validation passed with root typecheck green, the targeted node pack at `100 / 100`, and Architect strict reduced from `1,730` to `1,502`.

**Goal:** Tighten the next highest-leverage integration/normalization harnesses after the exception/parity cluster is reduced.

**Instructions:**
Focus this wave on:

- `tests/architect/contractNormalization.test.ts`
- `tests/architect/integration.test.ts`
- `tests/architect/e2e-workflows.test.ts`
- `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts`
- `tests/architect/schemaAdapter.test.ts`
- any tiny follow-up helper fixups from the earlier cap-legality/rights wave only if they are required to keep this cluster truthful

For the chosen cluster:

1. Remove broad typed bypasses and raw optional integration-state assumptions.
2. Align normalization/integration fixtures with the current runtime contracts.
3. Keep runtime behavior unchanged unless an assertion depended on a dishonest shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/architect/contractNormalization.test.ts tests/architect/integration.test.ts tests/architect/e2e-workflows.test.ts src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts tests/architect/schemaAdapter.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the integration/normalization cluster.
- Do not reopen the already-cleared persistence/world/cap truth harnesses except for minimal shared helper truth.

**Done when:** The integration/normalization cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect integration normalization harnesses`.

---

## Step 28 — Post-wave checkpoint: reassess final-review readiness

**Status:** DONE

Completed 2026-04-23: Re-ran the root/shared/architect probes after Steps 26-27, confirmed root/shared remain green while Architect strict still sits at `1,502`, and extended the plan with new bounded waves instead of routing dishonestly to final review.

**Goal:** Re-run the mission-level measurements after Steps 26-27 and decide whether the plan is honestly ready for final review or still needs more numbered waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 25 post-wave checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 28 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-exception architect hardening checkpoint`.

---

## Step 29 — Harden the next Architect / trade guardrail cluster (wave 7)

**Status:** DONE

Completed 2026-04-23: Hardened the planned Phase 17 / Phase 5 / Phase 55 / Phase 61 / Phase 79 guardrail cluster, kept root typecheck green, passed the bounded node pack at `100 / 100`, and reduced Architect strict from `1,502` to `1,336` without reopening `mutationPipeline.ts` beyond test-driven guardrail truth.

**Goal:** Tighten the next highest-leverage Architect/trade guardrail cluster now that the integration/normalization wave is clear.

**Instructions:**
Focus this wave on:

- `src/tests/architect/phase17_entitlement_routing_guardrail.test.ts`
- `src/tests/tradeMachine/phase5DraftPositions.test.ts`
- `src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts`
- `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts`
- `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts`
- any tiny `src/features/architect/utils/mutationPipeline.ts` contract-owner fixups that are directly required to keep this cluster truthful

For the chosen cluster:

1. Remove raw optional update/validation assumptions and stale fixture shapes.
2. Tighten entitlement-routing, draft-position, allowlist, and totals/persistence expectations around the live runtime contracts.
3. Keep any `mutationPipeline.ts` edits narrowly coupled to the failing guardrail cluster rather than reopening a broad runtime wave.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/phase17_entitlement_routing_guardrail.test.ts src/tests/tradeMachine/phase5DraftPositions.test.ts src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the Architect/trade guardrail cluster.
- Do not widen into the remaining trade validator/unit tests except for minimal shared helper truth that this cluster directly requires.

**Done when:** The guardrail cluster is materially more truthful, any coupled `mutationPipeline.ts` fixups stay bounded, and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect trade guardrail truth cluster`.

---

## Step 30 — Harden the next trade validator / unit truth cluster (wave 8)

**Status:** DONE

Completed 2026-04-23: Hardened the planned validator/unit truth cluster across `validatorContractCleanup`, `validatorTrustFixes`, `consent_and_reacq`, and `extension_voidedByExtension`; kept root typecheck green, passed the bounded node pack at `21 / 21`, and reduced Architect strict from `1,336` to `1,212` without widening into the DARE/e2e backlog.

**Goal:** Tighten the remaining high-value trade validator/unit harnesses that still dominate the post-Step-28 backlog outside the Architect guardrail cluster.

**Instructions:**
Focus this wave on:

- `tests/trade/validatorContractCleanup.test.ts`
- `tests/trade/validatorTrustFixes.test.ts`
- `tests/trade/consent_and_reacq.test.ts`
- `tests/architect/extension_voidedByExtension.test.ts`
- any tiny shared trade-rule helper truth fixups that are directly required to keep this cluster honest

For the chosen cluster:

1. Remove broad bag/object assumptions and default `never[]` / implicit-any fixture traps.
2. Align validator and rule-envelope assertions with the live trade validation contracts.
3. Keep behavior unchanged unless a test was only passing because it depended on a dishonest shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/trade/validatorContractCleanup.test.ts tests/trade/validatorTrustFixes.test.ts tests/trade/consent_and_reacq.test.ts tests/architect/extension_voidedByExtension.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the validator/unit truth cluster.
- Do not widen into the larger DARE/e2e smoke surfaces unless a tiny helper truth fix is required to make these files honest.

**Done when:** The validator/unit cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden trade validator truth cluster`.

---

## Step 31 — Post-wave checkpoint: reassess final-review readiness again

**Status:** DONE

Completed 2026-04-23: Re-ran the root/shared/architect probes after Steps 29-30, confirmed root/shared remain green while Architect strict now sits at `1,212`, and extended the plan again into one bounded Architect DARE/trade-apply wave plus one bounded trade-rule/TPE unit wave instead of routing dishonestly to final review.

**Goal:** Re-run the mission-level measurements after Steps 29-30 and decide whether the plan is honestly ready for final review or still needs more numbered waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 28 checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 31 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-guardrail hardening checkpoint`.

---

## Step 32 — Harden the next Architect DARE / trade-apply truth cluster (wave 9)

**Status:** DONE

Completed 2026-04-23: Hardened the planned Architect DARE / trade-apply cluster across `phaseD3_true_e2e_gate_guardrails`, `phaseD_e2e_trade_then_advance_smoke`, `signAndTrade`, `phase57_forbid_validateTrade_in_compute_guardrail`, and `phase49_tpe_exception_history_logging_guardrails`; kept root typecheck green, passed the bounded node pack at `83 / 83`, and reduced Architect strict from `1,212` to `1,079` without widening into the remaining trade-rule / TPE unit backlog.

**Goal:** Tighten the next highest-leverage Architect/test cluster now that the validator/unit wave is clear and the remaining backlog is led by DARE, sign-and-trade, and trade-apply guardrails.

**Instructions:**
Focus this wave on:

- `src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts`
- `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts`
- `src/tests/architect/signAndTrade.test.ts`
- `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts`
- `src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`
- any tiny `src/features/architect/utils/mutationPipeline.ts` fixups that are directly required to keep this cluster truthful

For the chosen cluster:

1. Remove stale trade-apply fixtures, raw optional validated-context reads, and any remaining legacy executeTrade assumptions.
2. Keep DARE/smoke and sign-and-trade assertions aligned with the live trade-apply and validated-trade-context contracts.
3. Keep `mutationPipeline.ts` edits tightly coupled to this cluster rather than reopening a broad runtime wave.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts src/tests/architect/signAndTrade.test.ts src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the Architect DARE / trade-apply cluster.
- Do not widen into the remaining trade-rule unit tests except for tiny shared truth fixups that this cluster directly requires.

**Done when:** The Architect DARE / trade-apply cluster is materially more truthful, any coupled runtime fixups stay bounded, and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect dare trade apply cluster`.

---

## Step 33 — Harden the next trade-rule / TPE unit cluster (wave 10)

**Status:** DONE

Completed 2026-04-23: Hardened the planned trade-rule / TPE unit cluster, kept root typecheck green, passed the bounded node pack at `30 / 30`, and reduced Architect strict from `1,079` to `944`.

**Goal:** Tighten the next highest-value trade-rule / TPE unit cluster exposed by the Step 31 checkpoint after the Architect DARE/trade-apply wave is clear.

**Instructions:**
Focus this wave on:

- `tests/trade/tpe_creation_expiry_usage.test.ts`
- `tests/trade/secondApronBoundary.test.ts`
- `tests/trade/timingEnforcement_authoritative.test.ts`
- `tests/trade/reacquisition_bar.test.ts`
- `tests/trade/tpe_absorption_fail_closed.test.ts`
- `tests/trade/validation_caching.test.ts`
- any tiny shared trade-rule helper truth fixups that are directly required to keep this cluster honest

For the chosen cluster:

1. Remove implicit-any fixture builders, `never[]` defaults, and stale TPE/second-apron assumption bags.
2. Keep TPE lifecycle, timing, reacquisition, and second-apron assertions aligned with the live rule contracts.
3. Keep behavior unchanged unless a test only passed because it depended on a dishonest fixture shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/trade/tpe_creation_expiry_usage.test.ts tests/trade/secondApronBoundary.test.ts tests/trade/timingEnforcement_authoritative.test.ts tests/trade/reacquisition_bar.test.ts tests/trade/tpe_absorption_fail_closed.test.ts tests/trade/validation_caching.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the trade-rule / TPE unit cluster.
- Do not widen back into the Architect DARE/e2e cluster except for tiny shared rule truth that this cluster directly requires.

**Done when:** The trade-rule / TPE unit cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden trade rule tpe truth cluster`.

---

## Step 34 — Post-wave checkpoint: reassess final-review readiness again

**Status:** DONE

Completed 2026-04-23: Root compatibility and shared strict stayed green, Architect strict dropped again to `944`, and the plan was extended with another Architect season-state wave, another trade-aftermath wave, and a follow-up checkpoint instead of routing to final review.

**Goal:** Re-run the mission-level measurements after Steps 32-33 and decide whether the plan is honestly ready for final review or still needs more numbered waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 31 checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 34 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-dare hardening checkpoint`.

---

## Step 35 — Harden the next Architect dead-cap / season-state truth cluster (wave 11)

**Status:** DONE

Completed 2026-04-23: Hardened the planned Architect dead-cap / season-state cluster, kept root typecheck green, passed the bounded node pack at `85 / 85`, and reduced Architect strict from `944` to `823`.

**Goal:** Tighten the next highest-value Architect season-state / dead-cap cluster exposed by the Step 34 checkpoint while keeping runtime-owner edits tightly bounded.

**Instructions:**
Focus this wave on:

- `src/tests/architect/deadCapManagement.test.ts`
- `src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts`
- `src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.ts`
- `src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.ts`
- `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.ts`
- `src/tests/tradeMachine/seasonSwapResolution.test.ts`
- any tiny `src/features/architect/utils/mutationPipeline.ts` or season/exception helper truth fixups directly required to keep this cluster honest

For the chosen cluster:

1. Remove implicit-any fixture builders, stale dead-cap / season-state bag fixtures, and optional-read chains that hide required mutation or persistence results.
2. Keep dead-cap, TPE expiry/history, room-exception, season-swap, and free-agency assertions aligned with the live Architect mutation and persistence contracts.
3. Keep runtime-owner edits tightly coupled to this cluster; do not reopen a broad `mutationPipeline.ts` hardening wave unless the touched tests directly force it.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/deadCapManagement.test.ts src/tests/architect/freeAgency_fixpack_e1.pipeline.behavior.test.ts src/tests/architect/phase53_seasonAdvance_tpe_expiry_history_integration.test.ts src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.ts src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.ts src/tests/tradeMachine/seasonSwapResolution.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the Architect dead-cap / season-state cluster.
- Do not widen into the residual trade aftermath unit tests except for tiny shared truth fixups that this cluster directly requires.

**Done when:** The Architect dead-cap / season-state cluster is materially more truthful, any coupled runtime fixups stay bounded, and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect dead cap season truth cluster`.

---

## Step 36 — Harden the next trade aftermath / snapshot truth cluster (wave 12)

**Status:** DONE

Completed 2026-04-24: Hardened the planned trade aftermath / snapshot cluster, kept root typecheck green, passed the bounded node pack at `42 / 42`, and reduced Architect strict from `823` to `709`.

**Goal:** Tighten the next highest-value residual trade aftermath / snapshot cluster exposed by the Step 34 checkpoint after the next Architect season-state wave is clear.

**Instructions:**
Focus this wave on:

- `tests/trade/twoWayPlayers_snapshot.test.ts`
- `tests/architect/tradeManager.test.ts`
- `tests/trade/secondApron_tpeBan.test.ts`
- `tests/trade/signAndTrade_completeness.test.ts`
- `tests/trade/timingGates_softEnforcement.test.ts`
- `tests/trade/poisonPill_average.test.ts`
- `tests/trade/tradeKicker_proration.test.ts`
- `tests/trade/tradeKicker_zeroGuarantee.test.ts`
- any tiny shared trade-rule helper truth fixups directly required to keep this cluster honest

For the chosen cluster:

1. Remove implicit-any builders, `never[]` defaults, and stale aftermath/snapshot bag fixtures.
2. Keep snapshot, second-apron TPE-ban, sign-and-trade completeness, timing soft-enforcement, and poison-pill / kicker assertions aligned with the live trade-rule contracts.
3. Keep behavior unchanged unless a test only passed because it depended on a dishonest fixture shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/trade/twoWayPlayers_snapshot.test.ts tests/architect/tradeManager.test.ts tests/trade/secondApron_tpeBan.test.ts tests/trade/signAndTrade_completeness.test.ts tests/trade/timingGates_softEnforcement.test.ts tests/trade/poisonPill_average.test.ts tests/trade/tradeKicker_proration.test.ts tests/trade/tradeKicker_zeroGuarantee.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the trade aftermath / snapshot cluster.
- Do not widen back into the Architect dead-cap / season-state cluster except for tiny shared truth fixups that this cluster directly requires.

**Done when:** The trade aftermath / snapshot cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden trade aftermath snapshot truth cluster`.

---

## Step 37 — Post-wave checkpoint: reassess final-review readiness again

**Status:** DONE

Completed 2026-04-24: Re-ran the mission checkpoints, confirmed shared strict remains green while Architect strict still sits at `709`, and extended the master plan with Steps 38-40 for the next bounded runtime/test truth waves.

**Goal:** Re-run the mission-level measurements after Steps 35-36 and decide whether the plan is honestly ready for final review or still needs more numbered waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 34 checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 37 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-season-state hardening checkpoint`.

---

## Step 38 — Harden the next Architect mutation-owner / persistence truth cluster (wave 13)

**Status:** DONE

Completed 2026-04-24: Hardened the planned mutation-owner / persistence cluster, kept root typecheck green, passed the bounded node pack at `56 / 56`, and reduced Architect strict from `709` to `624` with no remaining hits in the Step 38 target files.

**Goal:** Tighten the highest-leverage remaining Architect runtime-owner and persistence truth cluster exposed by the Step 37 checkpoint without reopening a broad repo-wide runtime pass.

**Instructions:**
Focus this wave on:

- `src/features/architect/utils/mutationPipeline.ts`
- `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.ts`
- `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.ts`
- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.ts`
- any tiny supporting persistence/offer-sheet/helper truth fixups directly required to keep this cluster honest

For the chosen cluster:

1. Remove nullable/optional carrier reads, stale persistence fixture bags, and contract-shape shortcuts that no longer match the authoritative mutation pipeline state.
2. Keep `mutationPipeline.ts` edits tightly coupled to the selected persistence/DARE guardrail surfaces; do not reopen a broad trade/apply wave beyond what these tests directly force.
3. Keep persistence and offer-sheet assertions aligned with the live mutation carrier contracts rather than compatibility fallbacks.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.ts src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.ts src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the mutation-owner / persistence cluster.
- Do not widen into general season-management or cap-legality cleanup except for tiny shared truth fixups that these files directly require.

**Done when:** The mutation-owner / persistence cluster is materially more truthful, any coupled runtime-owner edits stay bounded, and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect mutation persistence truth cluster`.

---

## Step 39 — Harden the next cap-sheet / timing / consent truth cluster (wave 14)

**Status:** DONE

Completed 2026-04-24: Hardened the planned cap-sheet / timing / consent truth
cluster, kept root typecheck green, passed the bounded UI pack at `23 / 23`
and node pack at `102 / 102`, and reduced Architect strict from `624` to `511`
with no remaining hits in the Step 39 target files.

**Goal:** Tighten the next mixed UI/runtime/test cluster exposed by the Step 37 checkpoint after the mutation-owner / persistence wave is clear.

**Instructions:**
Focus this wave on:

- `src/shared/components/EditContractModal.tsx`
- `src/tests/architect/capSheet_exception_wiring.behavior.test.tsx`
- `tests/architect/ruleContextTiming.test.ts`
- `tests/architect/seasonHelpers.test.ts`
- `tests/trade/consent_and_birdVeto.test.ts`
- `tests/trade/frozenPick_consequences.test.ts`
- `src/tests/tradeMachine/swapResolution.test.ts`
- any tiny shared season-format / timing / pick-rule helper truth fixups directly required to keep this cluster honest

For the chosen cluster:

1. Remove implicit-any builders, stale cap-sheet/timing/pick fixtures, and optional reads that hide required contract wiring.
2. Keep `EditContractModal`, cap-sheet exception wiring, rule-context timing, season-helper, consent, frozen-pick, and swap-resolution assertions aligned with the live season/timing/trade-rule contracts.
3. Keep behavior unchanged unless a test only passed because it depended on a dishonest fixture or optional-chain shortcut.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:ui -- --reporter=dot src/tests/architect/capSheet_exception_wiring.behavior.test.tsx`
- `npm run test:node -- --reporter=dot tests/architect/ruleContextTiming.test.ts tests/architect/seasonHelpers.test.ts tests/trade/consent_and_birdVeto.test.ts tests/trade/frozenPick_consequences.test.ts src/tests/tradeMachine/swapResolution.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the cap-sheet / timing / consent cluster.
- Do not reopen the mutation-owner / persistence cluster except for tiny shared truth fixups that this wave directly requires.

**Done when:** The cap-sheet / timing / consent cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden cap sheet timing consent truth cluster`.

---

## Step 40 — Post-wave checkpoint: reassess final-review readiness once more

**Status:** DONE

Completed 2026-04-24: Re-ran the root/shared/architect probes after Steps 38-39,
confirmed root and shared strict remain green while Architect strict still sits
at `511`, and extended the master plan with Steps 41-43 for the next bounded
guardrail and roster/rule truth waves.

**Goal:** Re-run the mission-level measurements after Steps 38-39 and decide whether the plan is honestly close to final review or still needs more numbered waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 37 checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 40 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-mutation-cluster hardening checkpoint`.

---

## Step 41 — Harden the next Architect sign-and-trade / mutation guardrail truth cluster (wave 15)

**Status:** DONE

Completed 2026-04-24: Hardened the planned sign-and-trade / mutation
guardrail cluster, kept root typecheck green, passed the bounded node pack at
55 / 55, and reduced Architect strict from 511 to 439 with no remaining hits in
the Step 41 target files.

**Goal:** Tighten the next high-value Architect sign-and-trade, mutation,
canonical TPE, and persistence-guardrail cluster exposed by the Step 40
checkpoint without reopening broad runtime-owner work.

**Instructions:**
Focus this wave on:

- `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.ts`
- `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.ts`
- `src/tests/architect/mutationPipeline.tradeSatHandoffContract.test.ts`
- `src/tests/architect/mutationPipeline.tradeSatHandoffClosure.test.ts`
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- `src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.ts`
- any tiny mutation-pipeline, trade-context, or TPE helper truth fixups directly required to keep this cluster honest

For the chosen cluster:

1. Remove optional-chain shortcuts, implicit-any fixtures, stale sign-and-trade
   bags, and compatibility TPE reads that hide the live mutation/trade carrier
   contracts.
2. Keep assertions aligned with canonical sign-and-trade, TPE, persistence, and
   mutation-handoff contracts.
3. Keep runtime edits tightly coupled to these guardrails; do not widen into
   general offseason, DARE, or roster-rule cleanup except for tiny shared truth
   fixups that these files directly require.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.ts src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.ts src/tests/architect/mutationPipeline.tradeSatHandoffContract.test.ts src/tests/architect/mutationPipeline.tradeSatHandoffClosure.test.ts src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts src/tests/architect/phase60_mutation_persist_no_internal_leaks_guardrail.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the sign-and-trade / mutation guardrail cluster.
- Do not use casts to preserve legacy trade-exception reads; the point is to
  keep canonical TPE and mutation-persistence truth visible.

**Done when:** The sign-and-trade / mutation guardrail cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect sign and trade guardrail cluster`.

---

## Step 42 — Harden the next roster / rule validation truth cluster (wave 16)

**Status:** DONE

Completed 2026-04-24: Hardened the planned roster / rule validation truth
cluster, kept root typecheck green, passed the bounded node pack at 73 / 73,
and reduced Architect strict from 439 to 367 with no remaining hits in the Step
42 target files.

**Goal:** Tighten the next trade roster-window, roster-legality, player-rules,
cash-ledger, and timing/input validation cluster exposed by the Step 40
checkpoint.

**Instructions:**
Focus this wave on:

- `tests/trade/rosterWindow_softEnforcement.test.ts`
- `tests/trade/rosterLegality_validateTrade.test.ts`
- `tests/architect/playerRulesProfile.test.ts`
- `tests/trade/cashLedger_season_tracking.test.ts`
- `tests/trade/jan15_offseason_timing.test.ts`
- `tests/trade/input_validation.test.ts`
- `tests/trade/roster_twoWay_enforcement.test.ts`
- any tiny trade-rule, player-rules, or roster helper truth fixups directly required to keep this cluster honest

For the chosen cluster:

1. Remove implicit-any builders, `never[]` collectors, stale player/team
   fixtures, and optional reads that hide live roster/rule contracts.
2. Keep roster-window, roster-legality, player-rules, cash-ledger, January 15,
   and input-validation assertions aligned with the live validator contracts.
3. Keep behavior unchanged unless a test only passed because it depended on a
   dishonest fixture or optional-chain shortcut.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/trade/rosterWindow_softEnforcement.test.ts tests/trade/rosterLegality_validateTrade.test.ts tests/architect/playerRulesProfile.test.ts tests/trade/cashLedger_season_tracking.test.ts tests/trade/jan15_offseason_timing.test.ts tests/trade/input_validation.test.ts tests/trade/roster_twoWay_enforcement.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the roster / rule validation cluster.
- Do not reopen sign-and-trade / mutation guardrail files except for tiny shared
  helper truth fixups this wave directly requires.

**Done when:** The roster / rule validation cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden roster rule validation truth cluster`.

---

## Step 43 — Post-wave checkpoint: reassess final-review readiness again

**Status:** DONE

Completed 2026-04-24: Re-ran the mission-level probes after Steps 41-42,
confirmed root and shared-boundaries strict remain green, confirmed Architect
strict still carries 367 errors, and extended the plan with the next two
bounded waves plus another checkpoint.

**Goal:** Re-run the mission-level measurements after Steps 41-42 and decide
whether the plan is honestly close to final review or still needs more numbered
waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 40 checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 43 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-sign-and-roster hardening checkpoint`.

---

## Step 44 — Harden the next Architect reactivity / CBA guardrail truth cluster (wave 17)

**Status:** DONE

Completed 2026-04-24: Hardened the planned Architect reactivity / CBA
guardrail truth cluster, kept root typecheck green, passed the bounded node
pack at 65 / 65, and reduced Architect strict from 367 to 318 with no
remaining hits in the Step 44 target files.

**Goal:** Tighten the next Architect reactivity, CBA batch, legacy-import, pure
compute, and current-state team guardrail cluster exposed by the Step 43
checkpoint without widening into offseason or DARE runtime work.

**Instructions:**
Focus this wave on:

- `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts`
- `src/tests/architect/batchB_cbaRules.test.ts`
- `src/tests/architect/phase59_legacy_import_guardrail.test.ts`
- `src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.ts`
- `src/tests/architect/mutationPipeline.currentStateTeamBoundary.test.ts`
- any tiny Architect test-helper truth fixups directly required to keep this
  cluster honest

For the chosen cluster:

1. Remove implicit-any fixtures, stale guardrail readers, nullable shortcut
   assertions, and untyped collectors that hide the live Architect reactivity,
   CBA, current-state, or compute contracts.
2. Keep behavior unchanged unless a test only passed because it depended on a
   dishonest fixture or optional-chain shortcut.
3. Keep runtime edits tightly bounded to helper truth fixups these guardrails
   directly require.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.ts src/tests/architect/batchB_cbaRules.test.ts src/tests/architect/phase59_legacy_import_guardrail.test.ts src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.ts src/tests/architect/mutationPipeline.currentStateTeamBoundary.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the reactivity / CBA / guardrail cluster.
- Do not reopen the Step 42 roster/rule files except for tiny shared helper
  truth fixups this wave directly requires.

**Done when:** The reactivity / CBA guardrail cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect reactivity cba guardrail cluster`.

---

## Step 45 — Harden the next offseason / DARE / preflight truth cluster (wave 18)

**Status:** DONE

Completed 2026-04-24: Hardened the planned offseason / DARE / preflight truth
cluster, kept root typecheck green, passed the bounded node pack at 86 / 86,
and reduced Architect strict from 318 to 268 with no remaining hits in the Step
45 target files.

**Goal:** Tighten the next offseason transition, DARE resolver, season-advance,
and conveyance-preflight cluster exposed by the Step 43 checkpoint without
reopening the reactivity/CBA guardrail wave.

**Instructions:**
Focus this wave on:

- `src/tests/architect/phase86_oste_offseason_transition_engine.test.ts`
- `src/tests/architect/dare/dareResolver.test.ts`
- `src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts`
- `src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.ts`
- `src/tests/tradeMachine/conveyancePreflight.test.ts`
- any tiny offseason, DARE, season-advance, or conveyance helper truth fixups
  directly required to keep this cluster honest

For the chosen cluster:

1. Remove implicit-any fixtures, stale offseason/DARE bags, nullable shortcut
   assertions, and untyped collectors that hide the live transition/preflight
   contracts.
2. Keep assertions aligned with canonical offseason transition, DARE resolver,
   TPE expiry, and conveyance preflight behavior.
3. Keep runtime edits tightly coupled to this cluster; do not widen into general
   UI or cap-sheet cleanup.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/phase86_oste_offseason_transition_engine.test.ts src/tests/architect/dare/dareResolver.test.ts src/tests/architect/phase51_seasonAdvance_tpe_expiry_integration.test.ts src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.ts src/tests/tradeMachine/conveyancePreflight.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the offseason / DARE / preflight cluster.
- Do not use broad casts to preserve stale transition or conveyance fixtures;
  the point is to keep live contract truth visible.

**Done when:** The offseason / DARE / preflight cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden offseason dare preflight truth cluster`.

---

## Step 46 — Post-wave checkpoint: reassess final-review readiness again

**Status:** DONE

Completed 2026-04-24: Re-ran the mission-level probes after Steps 44-45,
confirmed root and shared-boundaries strict remain green, confirmed Architect
strict still carries 268 errors, and extended the plan with the next two
bounded waves plus another checkpoint.

**Goal:** Re-run the mission-level measurements after Steps 44-45 and decide
whether the plan is honestly close to final review or still needs more numbered
waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 40 checkpoint,
   - the Step 43 checkpoint.
3. State whether the mission is honestly ready for final review or still needs
   more numbered waves.
4. Append additional numbered steps immediately after Step 46 if substantial
   mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion
  gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-reactivity-offseason checkpoint`.

---

## Step 47 — Harden the next Architect runtime-owner boundary cluster (wave 19)

**Status:** DONE

Completed 2026-04-24: Hardened the runtime-owner boundary cluster; Architect
strict moved from `268` to `223` errors and all Step 47 target files are clear
from the strict probe.

**Goal:** Tighten the next highest-value Architect runtime-owner boundary
cluster exposed by the Step 46 checkpoint without widening into unrelated UI or
test-only cleanup.

**Instructions:**
Focus this wave on:

- `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx`
- `src/features/architect/utils/capLegalityValidation.ts`
- `src/features/architect/utils/leagueInvariants.ts`
- `src/features/architect/utils/tradeContext/tradeContext.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`
- any tiny shared Architect runtime helper truth fixups directly required to
  keep this cluster honest

For the chosen cluster:

1. Remove nullable shortcut reads, stale cross-boundary bags, and implicit
   compatibility assumptions that hide live runtime contracts.
2. Keep behavior unchanged unless code only worked because it depended on an
   impossible or stale type shape.
3. Keep edits tightly bounded to the listed runtime-owner files and direct
   helper truth fixups.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run build`

**Constraints specific to this step:**

- Keep this wave bounded to the runtime-owner boundary cluster.
- Because this wave may touch `OffseasonTab.tsx`, run `npm run build` after the
  strict probes.
- Do not refactor UI layout or behavior except where a typed runtime-boundary
  fix directly requires it.

**Done when:** The runtime-owner boundary cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `fix: harden architect runtime owner boundaries`.

---

## Step 48 — Harden the next remaining trade / Architect test truth cluster (wave 20)

**Status:** DONE

Completed 2026-04-24: Hardened the remaining trade / Architect test truth
cluster; Architect strict moved from `223` to `167` errors and all Step 48
target files are clear from the strict probe.

**Goal:** Tighten the next remaining trade and Architect test clusters exposed
by the Step 46 checkpoint after the runtime-owner wave.

**Instructions:**
Focus this wave on:

- `tests/architect/overrideBypass.test.ts`
- `tests/trade/orderOfOps_conversionsBeforeMatching.test.ts`
- `src/tests/architect/dare/protectionLadderFactory.test.ts`
- `src/tests/architect/phase47_tpe_persistence_guardrails.test.ts`
- `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.ts`
- `src/tests/architect/phase86_league_invariants.test.ts`
- `tests/architect/EditContractModal.rules.test.tsx`
- `tests/trade/byc_outgoing_max.test.ts`
- `tests/trade/salaryMatching.test.ts`
- any tiny trade-test or Architect-test helper truth fixups directly required to
  keep this cluster honest

For the chosen cluster:

1. Remove implicit-any fixtures, stale bags, nullable shortcut assertions, and
   untyped collectors that hide live trade or Architect contracts.
2. Keep assertions aligned with live runtime behavior.
3. Keep runtime edits out of this wave unless a tiny helper truth fix is
   directly required by these tests.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/architect/overrideBypass.test.ts tests/trade/orderOfOps_conversionsBeforeMatching.test.ts src/tests/architect/dare/protectionLadderFactory.test.ts src/tests/architect/phase47_tpe_persistence_guardrails.test.ts src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.ts src/tests/architect/phase86_league_invariants.test.ts tests/architect/EditContractModal.rules.test.tsx tests/trade/byc_outgoing_max.test.ts tests/trade/salaryMatching.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the remaining trade / Architect test cluster.
- Do not reopen Step 47 runtime-owner files except for tiny shared helper truth
  fixups this wave directly requires.

**Done when:** The remaining trade / Architect test cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden remaining trade architect truth cluster`.

---

## Step 49 — Post-wave checkpoint: reassess final-review readiness again

**Status:** DONE

Completed 2026-04-24: Re-ran the mission-level probes after Steps 47-48;
root and shared-boundaries strict remain green, while Architect strict is still
expected-failing at `167` errors, so the plan extends with more numbered waves.

**Goal:** Re-run the mission-level measurements after Steps 47-48 and decide
whether the plan is honestly close to final review or still needs more numbered
waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 40 checkpoint,
   - the Step 43 checkpoint,
   - the Step 46 checkpoint.
3. State whether the mission is honestly ready for final review or still needs
   more numbered waves.
4. Append additional numbered steps immediately after Step 49 if substantial
   mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion
  gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-runtime-test hardening checkpoint`.

---

## Step 50 — Harden remaining Architect runtime utility boundaries (wave 21)

**Status:** DONE

Completed 2026-04-24: Hardened the planned runtime utility cluster; root
typecheck remains green and the Architect strict probe dropped to `138` errors
with the Step 50 target files clear. `npm run test:diff -- --reporter=dot`
auto-routed to the full suite after the user allowed `RUN FULL SUITE`; the
node half passed, while the UI half exposed out-of-scope guardrail drift in
broader UI/test files that this step intentionally did not modify.

**Goal:** Tighten the next runtime utility cluster exposed by the Step 49
checkpoint without widening into unrelated UI or broad test cleanup.

**Instructions:**
Focus this wave on:

- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/features/architect/utils/tradeMachine/rules/miscRules.ts`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`
- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/runOffseason.ts`
- `src/features/architect/utils/seasonFormat.ts`
- `src/features/architect/utils/salaryEngine/salaryEngine.ts`
- `src/features/architect/utils/tradeContext/tradeExecutionAuthority.ts`
- any tiny directly-required type owner/helper fixup in the same runtime
  utility boundary

For the chosen cluster:

1. Remove nullable year/value shortcut assumptions and stale loose-record
   payload bridges.
2. Prefer local normalization helpers at runtime boundaries over broad casts.
3. Preserve runtime behavior except where the old code only worked by relying
   on impossible strict-null assumptions.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:diff -- --reporter=dot`

**Constraints specific to this step:**

- Keep this wave bounded to the runtime utility cluster above.
- Do not reopen Step 48 test files except for tiny direct fallout from a
  runtime helper truth fix.

**Done when:** The runtime utility cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `fix: harden architect runtime utility boundaries`.

---

## Step 51 — Harden remaining Architect/trade test fixture clusters (wave 22)

**Status:** DONE

Completed 2026-04-24: Hardened the listed Architect/trade test fixture
cluster; root typecheck remains green and the Architect strict probe dropped
to `95` errors with the Step 51 target files clear. The scoped node validation
passed for the command listed below; Vitest reported the runnable node targets
as `8` files and `100` tests passed.

**Goal:** Tighten the next remaining Architect/trade test clusters exposed by
the Step 49 checkpoint after the runtime utility wave.

**Instructions:**
Focus this wave on:

- `src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts`
- `src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.ts`
- `src/tests/architect/entitlementInvariants.test.ts`
- `tests/trade/faExceptions_as_trade_buckets.test.ts`
- `tests/architect/salaryEngine.test.ts`
- `tests/architect/ExceptionTracker.tpe.test.tsx`
- `src/tests/architect/utils/seasonManager.tpe.test.ts`
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.ts`
- `src/tests/architect/phase42_apron_derivation_consolidation.test.ts`
- any tiny shared test helper truth fixup directly required by this cluster

For the chosen cluster:

1. Remove implicit-any fixtures, nullable shortcut assertions, and stale
   partial runtime payloads.
2. Keep assertions aligned with live behavior.
3. Avoid runtime edits unless a tiny helper truth fix is directly required.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.ts src/tests/architect/entitlementInvariants.test.ts tests/trade/faExceptions_as_trade_buckets.test.ts tests/architect/salaryEngine.test.ts tests/architect/ExceptionTracker.tpe.test.tsx src/tests/architect/utils/seasonManager.tpe.test.ts src/tests/architect/useArchitectActions.freeAgency.test.tsx src/tests/architect/phase43_apron_drift_prevention_guardrails.test.ts src/tests/architect/phase42_apron_derivation_consolidation.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the listed test fixture cluster.
- Do not treat UI TSX test files as requiring `npm run build`; this is a
  test-only wave unless runtime files are changed.

**Done when:** The listed test fixture cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden remaining architect trade fixtures`.

---

## Step 52 — Post-extension checkpoint: reassess final-review readiness again

**Status:** DONE

Completed 2026-04-24: Re-ran the mission-level probes after Steps 50-51;
root typecheck and shared-boundaries strict remain green, while Architect
strict is still expected-failing at `95` errors. The plan is extended with
additional numbered waves before final review.

**Goal:** Re-run the mission-level measurements after Steps 50-51 and decide
whether final review is now truthful or the plan still needs more numbered
waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 40 checkpoint,
   - the Step 43 checkpoint,
   - the Step 46 checkpoint,
   - the Step 49 checkpoint.
3. State whether the mission is honestly ready for final review or still needs
   more numbered waves.
4. Append additional numbered steps immediately after Step 52 if substantial
   mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion
  gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-extension hardening checkpoint`.

---

## Step 53 — Harden remaining Architect runtime/shared boundary cluster (wave 23)

**Status:** DONE

Completion note 2026-04-24: Hardened the listed runtime/shared boundary
cluster with explicit null guards and local typed adapters; root typecheck,
Architect strict target-file clearance, build, and the cap-sheet source-scan
probe pass. The full-routed `test:diff` node half passed and the UI half
failed only in the Step 54 fallout cluster, so that cleanup remains next.

**Goal:** Tighten the next remaining runtime/shared strict-boundary cluster
identified by the Step 52 checkpoint before returning to test-only cleanup.

**Instructions:**
Focus this wave on:

- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.tsx`
- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/hooks/useCapValidation.ts`
- `src/features/architect/tradeMachine/ValidationDetailsPanel.tsx`
- `src/features/architect/utils/tradeManager.ts`
- `src/features/architect/utils/tradeMachine/utils/capUtils.ts`
- `src/shared/components/TeamSelectDropdown.tsx`
- `src/shared/components/ui/filters/MultiSelectFilter.tsx`
- `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerContractMini.tsx`
- any tiny directly-required type owner/helper fixup in the same boundary

For the chosen cluster:

1. Replace nullable shortcut assumptions with explicit normalization or guards.
2. Avoid broad `as any` bridges; prefer local typed boundary helpers.
3. Preserve UI and runtime behavior unless the old behavior was only reachable
   through impossible strict-null assumptions.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run build`
- `npm run test:diff -- --reporter=dot`

**Constraints specific to this step:**

- Keep runtime edits bounded to the listed runtime/shared files and direct
  helper fallout.
- Do not use this runtime wave to rewrite broad test fixtures except for a
  directly required assertion update.

**Done when:** The runtime/shared boundary cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `fix: harden remaining architect runtime boundaries`.

---

## Step 54 — Harden full-suite UI guardrail fallout cluster (wave 24)

**Status:** DONE

Completion note 2026-04-24: Aligned the five full-suite UI fallout tests with
the live updater/payload shapes and restored the DEV fixture source sentinel;
root typecheck passed, Architect strict fell from `77` to `71`, the scoped UI
suite passed, and full-routed `test:diff` passed.

**Goal:** Fix the UI guardrail drift exposed by the `RUN FULL SUITE`
validation after Step 50 without mixing it into unrelated strict-probe waves.

**Instructions:**
Focus this wave on:

- `src/tests/architect/myct_step6_guardrails.test.tsx`
- `src/tests/architect/offseason.worldAdvanceAftermath.e110.behavior.test.tsx`
- `src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx`
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- `src/tests/smoke/architect.uiSmoke.e1.test.tsx`
- any tiny direct source truth fix in the UI paths those tests exercise

For the chosen cluster:

1. Align guardrail assertions with live behavior after the hardening waves.
2. Prefer testing the real state transition shape over brittle exact object
   matches when runtime now uses updater functions or normalized payloads.
3. Avoid broad runtime rewrites unless a test exposes a true product bug.
4. Record the resulting validation status and strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:ui -- --reporter=dot src/tests/architect/myct_step6_guardrails.test.tsx src/tests/architect/offseason.worldAdvanceAftermath.e110.behavior.test.tsx src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx src/tests/architect/useArchitectActions.freeAgency.test.tsx src/tests/smoke/architect.uiSmoke.e1.test.tsx`
- `npm run test:diff -- --reporter=dot`

**Constraints specific to this step:**

- Keep this wave bounded to the full-suite UI fallout cluster.
- Do not treat the full suite failure as license to widen into unrelated UI
  cleanup.

**Done when:** The listed UI guardrail fallout is fixed or explicitly proven pre-existing and out of scope, and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden full-suite ui guardrail fallout`.

---

## Step 55 — Harden remaining low-volume Architect/trade strict test cluster (wave 25)

**Status:** DONE

Completion note 2026-04-24: Hardened the listed low-volume Architect/trade
test cluster by adding explicit fixture types, defined-result guards, and live
trade helper input shapes; root typecheck passed, Architect strict fell from
`71` to `41` with the Step 55 target files clear, and the scoped node suite
passed.

**Goal:** Clear the next low-volume Architect/trade test strict cluster left
after the runtime and full-suite fallout waves.

**Instructions:**
Focus this wave on:

- `src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.ts`
- `src/tests/architect/capLegalityValidation.batchedHardening.test.ts`
- `tests/architect/CapSheetFull.rules.test.tsx`
- `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`
- `src/tests/architect/mutationTotalsAndStateContractAlignment.test.ts`
- `src/tests/architect/capSheet_toast_dedupe.behavior.test.ts`
- `src/tests/architect/architectCoreTrioPassR2.test.ts`
- `src/tests/architect/architectCoreLogicBlockerTrio.test.ts`
- `tests/trade/secondApron_handcuffs.test.ts`
- `tests/trade/basicRules.test.ts`
- any tiny shared test helper truth fixup directly required by this cluster

For the chosen cluster:

1. Remove implicit-any fixtures, stale partial payloads, and nullable shortcut
   assertions.
2. Keep assertions aligned with live runtime behavior.
3. Avoid runtime edits unless a tiny helper truth fix is directly required.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.ts src/tests/architect/capLegalityValidation.batchedHardening.test.ts tests/architect/CapSheetFull.rules.test.tsx src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx src/tests/architect/mutationTotalsAndStateContractAlignment.test.ts src/tests/architect/capSheet_toast_dedupe.behavior.test.ts src/tests/architect/architectCoreTrioPassR2.test.ts src/tests/architect/architectCoreLogicBlockerTrio.test.ts tests/trade/secondApron_handcuffs.test.ts tests/trade/basicRules.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the listed low-volume test cluster.
- Do not reopen runtime/shared files except for tiny direct fallout.

**Done when:** The listed test cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden remaining architect strict fixtures`.

---

## Step 56 — Post-extension checkpoint: reassess final-review readiness again

**Status:** DONE

Completion note 2026-04-24: Re-ran the mission-level probes; root typecheck
and shared-boundaries strict pass, but Architect strict still reports `41`
errors, so the plan has been extended with additional numbered waves instead
of moving to final review.

**Goal:** Re-run the mission-level measurements after Steps 53-55 and decide
whether final review is now truthful or the plan still needs more numbered
waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 40 checkpoint,
   - the Step 43 checkpoint,
   - the Step 46 checkpoint,
   - the Step 49 checkpoint,
   - the Step 52 checkpoint.
3. State whether the mission is honestly ready for final review or still needs
   more numbered waves.
4. Append additional numbered steps immediately after Step 56 if substantial
   mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion
  gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record continued hardening checkpoint`.

---

## Step 57 — Harden remaining two-error strict test cluster (wave 26)

**Status:** DONE — 2026-04-24

**Goal:** Clear the remaining two-error Architect/trade strict test files
identified by the Step 56 checkpoint.

**Instructions:**
Focus this wave on:

- `tests/architect/worldsOnlyRegression.test.ts`
- `src/tests/tradeMachine/pickIdUtils.test.ts`
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx`
- `src/tests/architect/rosterChargeDisplay.test.tsx`
- `src/tests/architect/dataValidation.test.ts`
- `src/tests/architect/capSheetFull_ssot_parity_guardrails.test.ts`
- `src/tests/architect/capSheetCloseoutBlockersRemediation2.hardCapOwnership.test.ts`
- `src/tests/architect/capLegalityValidation.test.ts`
- `src/tests/architect/architectRuntimeBlockers.pass1.test.ts`
- `src/tests/architect/architectHardeningE4.polish.test.ts`
- `src/tests/architect/architectCoreTrioPassR3.test.ts`
- any tiny shared test helper truth fixup directly required by this cluster

For the chosen cluster:

1. Remove implicit-any probes and nullable shortcut assertions.
2. Prefer typed local helpers over broad `as any` casts.
3. Keep runtime behavior unchanged unless a test exposes a tiny source truth
   bug.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:diff -- --reporter=dot`

**Constraints specific to this step:**

- Keep this wave bounded to the listed two-error test cluster.
- Do not use this step to start final review.

**Done when:** The listed two-error test cluster is materially more truthful
and the baseline records the resulting strict-probe delta plus what remains.
Commit message: `test: harden remaining two-error strict fixtures`.

**Completion notes:** Cleared the listed two-error strict cluster with typed
test helpers and nullable assertion narrowing. Architect strict moved from `41`
to `19` errors, and all Step 57 target files are clear. Root typecheck passed.
`npm run test:diff -- --reporter=dot` auto-selected the full node+UI suite and
passed (`423` node files / `4,430` tests, `115` UI files / `863` tests).

---

## Step 58 — Harden residual one-error strict test cluster (wave 27)

**Status:** DONE — 2026-04-24

**Goal:** Clear the remaining one-error Architect/trade strict test files after
Step 57.

**Instructions:**
Use the latest Architect strict probe from Step 57 and focus this wave on the
remaining one-error files, including but not limited to:

- `tests/trade/useTradeMachine.validatorTrust.test.ts`
- `tests/architect/seasonManager.test.ts`
- `tests/architect/capHoldTransitionHelpers.test.ts`
- `src/tests/tradeMachine/stepienObligations.test.ts`
- `src/tests/architect/worldOptimistic_lock_serialization.behavior.test.ts`
- `src/tests/architect/phase16_seasonmanager_entitlements_ssot_view_guardrail.test.ts`
- `src/tests/architect/phase16_3_trade_machine_init_guardrail.test.ts`
- `src/tests/architect/mutationPipeline.publicMutationIngressBoundary.test.ts`
- `src/tests/architect/mutationPipeline.payloadIngressBoundary.test.ts`
- `src/tests/architect/mutationPipeline.currentStateIngressClosure.test.ts`
- `src/tests/architect/mutationPipeline.catchallNarrowing.test.ts`
- `src/tests/architect/mutationPipeline.boundary.e107.test.ts`
- `src/tests/architect/entitlementPickRow.vacuumBadges.test.tsx`
- `src/tests/architect/dashboardWorldBoundary.e109.test.tsx`
- any tiny shared test helper truth fixup directly required by this cluster

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:diff -- --reporter=dot`

**Constraints specific to this step:**

- Keep this wave bounded to the residual one-error strict test cluster.
- Do not widen into optional cleanup while Architect strict is still red.

**Done when:** The residual one-error cluster is cleared or reduced to a new
explicit bounded set, and the baseline records the resulting strict-probe delta
plus what remains. Commit message: `test: harden residual strict fixtures`.

**Completion notes:** Cleared the residual one-error Architect/trade strict
cluster, including the five additional one-error files found in the Step 57
checkpoint. Architect strict moved from `19` errors to `0`; root typecheck
passed; `npm run test:diff -- --reporter=dot` auto-selected the full node+UI
suite and passed (`423` node files / `4,430` tests, `115` UI files / `863`
tests).

---

## Step 59 — Post-residual checkpoint: reassess final-review readiness again

**Status:** DONE — 2026-04-24

**Goal:** Re-run the mission-level measurements after Steps 57-58 and decide
whether final review is now truthful or the plan still needs more numbered
waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

Re-run:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
- `npm run typecheck -- --project tsconfig.architect-strict.json`

Compare the new results to all prior checkpoints and either proceed to final
review or extend the numbered plan again if Architect strict or substantial
mission-area backlog remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion
  gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has
been extended again if needed. Commit message: `docs: record residual hardening checkpoint`.

**Completion notes:** Root typecheck, shared-boundary strict, and Architect
strict all passed after Step 58. No additional numbered hardening waves are
needed at this checkpoint; Step 60 final review is now executable.

---

## Step 60 — Final review (only when the mission-level gates are truly satisfied)

**Status:** DONE — 2026-04-24

**Goal:** Recheck the full project as one system and produce a final review that truthfully supports mission completion.

**Instructions:**
Create or update `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md` only when the latest master checkpoint proves that no substantial mission-area backlog remains.

The final review must cover:

- declaration layer
- shared/runtime boundaries
- Architect/runtime boundaries
- typed tests and mocks
- strictness posture
- remaining issues, if any

Classify the remaining issues only as:

- `Resolved in this master plan`
- `Minor optional follow-up`
- `User-declared out of scope`

The verdict must be a true mission-complete verdict. If the most honest verdict is still `PASS WITH DEBT`, `CONCERN`, or equivalent, this step is **not allowed to complete** and the plan must extend instead.

**Constraints specific to this step:**

- Do not use this step to smuggle in a phase-level win and call it project-complete.
- Only make tiny doc corrections here, not new source changes.

**Done when:** The final review doc truthfully supports completion of the mission and not merely completion of a phase. Commit message: `docs: record final project TypeScript hardening review`.

**Completion notes:** Replaced the stale `PASS WITH DEBT` final review with a
mission-complete review grounded in the Step 59 green strict probes and Step 58
full-routed validation. Step 61 final closeout is now executable.

---

## Step 61 — Final closeout (only when the mission is actually done)

**Status:** DONE — 2026-04-24; RECONCILED — 2026-04-25

**Goal:** Close this self-extending master plan only when the project is actually completely hardened according to the mission statement and the hard anti-loophole rules above.

**Instructions:**
Append a `Final Closeout` section to this doc only when all mission-level completion gates are satisfied.

The closeout must state:

1. Why the mission is now actually complete.
2. Which major dishonesty mechanisms were removed across the life of the master plan.
3. Which probes/measurements now support the completion claim.
4. Any remaining issues that are truly minor, optional, or user-declared out of scope.
5. Why no further mission-area numbered steps are required.

**Constraints specific to this step:**

- This step is forbidden unless the mission-level completion gates are satisfied.
- If a substantial mission-area backlog still exists, return to Step 22 behavior and extend the plan.

**Done when:** This document has a truthful final closeout and the repo is actually completely hardened for the mission defined at the top. Commit message: `docs: close out self-extending TypeScript hardening master plan`.

**Reconciliation notes:** 2026-04-25 completion-contract checks supersede the
2026-04-24 closeout claim. Root `tsconfig.json` still has `"strict": false`,
so Gate 1 fails even though the permissive root compiler command passes. Gates
2, 4, 5, 6, and 7 also have unclassified scan hits. This plan is reopened with
Steps 62-66, and the current mission verdict remains `PHASE COMPLETE —
HARDENING STILL INCOMPLETE`.

---

## Final Closeout

Captured: 2026-04-24

The TypeScript hardening mission is complete. This is not a phase-complete
claim: the mission-level probes now pass, the stale `PASS WITH DEBT` final
review has been replaced, and the final checkpoint found no substantial
remaining hardening backlog requiring another numbered wave.

Why the mission is now actually complete:

- Root TypeScript compatibility is green.
- Shared/runtime strict is green.
- Architect strict is green.
- The final source-change wave was validated by the full routed node+UI test
  suite after the user explicitly authorized `RUN FULL SUITE`.

Major dishonesty mechanisms removed across the master plan:

- Repo-wide ambient declaration shims that masked real module exports.
- Shared/player runtime boundary casts that let unvalidated ingress flow into
  app state.
- Architect/base-data and world/mutation ingress trust gaps.
- Broad fixture/test mock shapes that made Architect/trade tests pass while
  avoiding the strict contracts they were supposed to protect.
- Residual strict-probe debt in two-error and one-error test clusters.

Completion evidence:

- `npm run typecheck` passed in Step 59.
- `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
  passed in Step 59.
- `npm run typecheck -- --project tsconfig.architect-strict.json` passed in
  Step 59.
- `npm run test:diff -- --reporter=dot` passed after Step 58 and auto-selected
  the full node+UI suite: `423` node files / `4,430` tests passed with `24`
  skipped, and `115` UI files / `863` tests passed.

Remaining issues:

- Minor optional follow-up: a few tests retain local casts to represent
  intentionally malformed external/runtime ingress. These are not substantial
  mission debt because the strict probes are green and the casts are local to
  invalid-shape tests.
- Minor optional follow-up: the existing skipped tests remain skipped under the
  suite configuration. The full routed validation passed with the existing skip
  set.

No further mission-area numbered steps are required because all hard completion
gates pass and no checkpoint evidence points to a substantial remaining
TypeScript hardening backlog.

---

## Step 62 — Satisfy Gate 1 root strict mode

**Status:** DONE — 2026-04-25

Completed 2026-04-25: Enabled `"strict": true` in root `tsconfig.json`, fixed the repo-wide strict-mode fallout across runtime source, scripts, and guardrail tests, and proved the exact root strict compiler command exits 0.

**Goal:** Turn root TypeScript strict mode on and make the exact root strict
compiler command pass without weakening runtime or test contracts.

**Instructions:**

1. Change `tsconfig.json` so root compiler options enforce `"strict": true`.
2. Run `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false`.
3. Fix the resulting strict errors by normalizing truthful contracts, adding
   runtime guards at data boundaries where needed, or tightening local types.
4. Keep broad escapes out of the fix path; `any`, `as any`, and double-casts
   may only remain where they are truly unavoidable and then must be documented
   in the relevant gate exception table.
5. Run scoped tests/probes dictated by the files touched.
6. Update the Mission Completion Status, Active Work Queue, Validation Ledger,
   Known Blockers / Deferred Debt, and Return Package Index before committing.

**Validation:**

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false`
- Relevant scoped `npm run test:* -- --reporter=dot` command(s) dictated by
  the changed files
- `npm run validate:project` if any structural changes are made

**Done when:** `tsconfig.json` has `"strict": true`, the exact root strict
compiler command exits 0, and the return package records the error families
fixed. Commit message: `config: enable root TypeScript strict mode`.

---

## Step 63 — Complete Gate 2 runtime type escape audit

**Status:** DONE — 2026-04-25

Completed 2026-04-25: Removed narrow runtime escape markers across filters, roster cards, Architect runtime helpers, cap legality validation, and trade-machine debug shaping; documented every remaining true Gate 2 marker in the Gate 2 exception table.

**Goal:** Remove or exception-list every true runtime-source type escape found
by the Gate 2 contract scan.

**Instructions:**

1. Re-run the Gate 2 scan from the completion contract:
   `rg -n "\bany\b|as any|as unknown as|Record<string, any>|@ts-ignore|@ts-expect-error" src -g '*.ts' -g '*.tsx' -g '*.d.ts' -g '!src/tests/**'`
2. Separate false-positive prose/assertion matches from true type escapes.
3. Remove true escapes where a truthful type, schema, guard, or local narrowing
   can express the contract.
4. Add a tracked exception table for any true escape that must remain,
   including path, line, marker, reason, safety, and owner/follow-up plan.
5. Keep the work bounded to production/runtime source outside `src/tests/**`.

**Validation:**

- Gate 2 contract scan
- `npm run typecheck`
- Relevant scoped tests with `--reporter=dot`

**Done when:** Every true Gate 2 runtime escape is either removed or documented
in an exception table accepted by the completion contract. Commit message:
`fix: audit runtime TypeScript escape hatches`.

---

## Step 64 — Complete Gates 3, 4, 6, and 7 declaration, boundary, JS, and schema audits

**Status:** DONE — 2026-04-25

Completed 2026-04-25: Added `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`, classified Gates 3, 4, 6, and 7, and deleted three tracked zero-byte Vitest timestamp files from the JS-like inventory.

**Goal:** Prove declaration/shim honesty remains clean and classify or fix every
runtime boundary, JS-like file, and schema escape required by Gates 4, 6, and 7.

**Instructions:**

1. Re-run the Gate 3 declaration scan and preserve its current zero-hit proof
   unless new hits appear.
2. Audit the Gate 4 boundary families listed in the completion contract,
   including Firestore reads/writes, storage, JSON parsing, route/search params,
   scraper/staging imports, Architect/base-data loaders, and player/team/world
   loader surfaces.
3. Classify every Gate 6 JS/CJS/MJS file as `INTENTIONAL CONFIG`,
   `INTENTIONAL NODE SCRIPT`, `GENERATED/TEMP`, `MIGRATE`, or `DELETE`; migrate
   or delete anything that blocks completion.
4. Classify every Gate 7 schema escape as intentional external passthrough,
   legacy compatibility, unknown-safe boundary, or temporary debt; remove or
   tighten any escape that lacks a truthful reason.
5. Record exception/classification tables in the living plan or a linked
   TypeScript evidence doc.

**Validation:**

- Gate 3 contract scan
- Gate 4 boundary audit evidence
- Gate 6 JS-like inventory
- Gate 7 schema escape scan
- `npm run typecheck`
- Targeted tests with `--reporter=dot` for any changed runtime boundary

**Done when:** Gates 3, 4, 6, and 7 have current pass evidence or complete
exception/classification tables that satisfy the completion contract. Commit
message: `docs: classify TypeScript boundary and schema gates`.

---

## Step 65 — Complete Gate 5 test and mock type integrity audit

**Status:** DONE — 2026-04-25

Completed 2026-04-25: Added `docs/typescript/TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md` and classified the 630 raw Gate 5 test/mock scan hits by assertion false positives, negative boundary fixtures, SDK mocks, UI harness state bags, validator result bags, and source-scan guardrails.

**Goal:** Remove, narrow, or exception-list every true test/mock escape found by
the Gate 5 contract scan.

**Instructions:**

1. Re-run the Gate 5 scan from the completion contract:
   `rg -n "\bany\b|as any|as unknown as|Record<string, any>|@ts-ignore|@ts-expect-error" tests src/tests -g '*.ts' -g '*.tsx'`
2. Separate false positives such as `expect.any` or prose from true test-side
   type escapes.
3. Replace broad mock/fixture bags with honest fixture helper types where the
   tests assert valid runtime behavior.
4. Keep intentionally malformed inputs explicit and local, then exception-list
   them as negative/assertion boundaries when they must remain.
5. Ensure central mocks do not hide runtime contract truth behind broad bags.

**Validation:**

- Gate 5 contract scan
- `npm run typecheck`
- Relevant scoped test scripts with `--reporter=dot`

**Done when:** Every true Gate 5 test/mock escape is either removed, converted
to an honest fixture/helper type, or justified as an intentional negative test
boundary. Commit message: `test: audit TypeScript mock escape hatches`.

---

## Step 66 — Produce final TypeScript completion evidence package

**Status:** DONE

Completed 2026-04-25: Produced the final Gate 8 evidence package after root
strict mode, retained scoped strict probes, project validation, markdown lint,
whitespace checks, and Gates 2-7 classification scans all passed.

**Goal:** Produce the final Gate 8 evidence package only after Gates 1-7 pass
with current evidence.

**Instructions:**

1. Re-run every completion-contract gate command and required validation.
2. Confirm `tsconfig.json` has `"strict": true`.
3. Confirm root strict mode passes with:
   `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false`
4. Confirm every runtime/test/schema/declaration/JS-like finding is either
   resolved or exception-listed according to the contract.
5. Write the final evidence package under `return_packages/typescript/` with
   the required gate table, commands, outcomes, exception tables, files changed,
   and final verdict.
6. Only if all gates pass may the mission verdict become
   `TYPESCRIPT HARDENING COMPLETE`.

**Validation:**

- Full completion-contract evidence package for Gates 1-8
- The exact root strict compiler command
- Scoped strict probes if they still exist
- Relevant project/test validation dictated by changed files

**Done when:** Gates 1-8 all pass with evidence and the return package records
the allowed `TYPESCRIPT HARDENING COMPLETE` verdict. Commit message:
`docs: record TypeScript hardening completion evidence`.

---

## Follow-up items (populate during execution)

*Anything surfaced during hardening that is real but not in scope for the step that found it. Examples: duplicated schemas, policy inconsistencies, low-value leaf files still using weak types, or minor optional cleanup that does not block mission completion. Do not use this section as a dumping ground for substantial mission-area backlog; substantial remaining hardening work must become numbered steps in this same plan.*

---

## Status legend

- **TODO** — not started
- **IN PROGRESS** — partially done; agent should pick up where the last session left off (read the step's notes section if present)
- **DONE** — complete and merged
- **BLOCKED** — needs user input or external dependency; agent should explain why and stop

When marking a step DONE, agents may also append a brief `Completed YYYY-MM-DD: <one-line summary>` under the step header for future reference.
