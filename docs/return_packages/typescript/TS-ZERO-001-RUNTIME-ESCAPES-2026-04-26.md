# TS-ZERO-001 Runtime Escapes Return Package

Date: 2026-04-26

Verdict: `PHASE COMPLETE - ZERO-EXCEPTION HARDENING STILL INCOMPLETE`

## Summary

TS-ZERO-001 eliminated the nine carried-forward true runtime/schema escape
markers from the prior TypeScript hardening exception table.

## Changes

- Added `JsonValueZ` in `src/schemas/common.ts` for legacy JSON-compatible
  metadata and fallback value records.
- Replaced player schema `z.any()` sites with typed contract option payloads
  and recursive JSON value records.
- Replaced Architect exception extra-field `z.any()` values with `JsonValueZ`.
- Replaced the trade validator variadic `any[]` constraint with `never[]` so
  heterogeneous validators remain assignable while preserving concrete
  `Parameters<T[K]>`.
- Replaced the trade-context `Record<string, any>` bridge with
  `Record<string, unknown>` and added local scalar/object narrowing in the
  snapshot builder.
- Fixed the schema doc generator's `## Notes` spacing so generated schema docs
  remain markdown-lint clean after future schema generation.

## Files Changed

- `src/schemas/common.ts`
- `src/schemas/players_v2.ts`
- `src/schemas/architect.ts`
- `src/features/architect/utils/tradeMachine/engine/validationUtils.ts`
- `src/features/architect/utils/tradeContext/types.ts`
- `src/features/architect/utils/tradeContext/tradeContext.ts`
- `scripts/generate-schemas.ts`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`
- `return_packages/typescript/TS-ZERO-001-RUNTIME-ESCAPES-2026-04-26.md`

## Validation

| Command                                                                                                                                                                                                                                                       | Result                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rg -n "z\\.any\\(\|Record<string, any>\|extends any\\[\\]\|as any\|as unknown as" src/schemas/players_v2.ts src/schemas/architect.ts src/features/architect/utils/tradeMachine/engine/validationUtils.ts src/features/architect/utils/tradeContext/types.ts` | PASS; no carried-forward Phase 1 markers remain.                                                                                                     |
| `rg -n "\\bany\\b\|as any\|as unknown as\|Record<string, any>\|@ts-ignore\|@ts-expect-error" src -g '*.ts' -g '*.tsx' -g '*.d.ts' -g '!src/tests/**'`                                                                                                         | PASS by review for this item; output contains existing prose/comment/string-literal false positives and no TS-ZERO-001 true marker.                  |
| `npm run typecheck`                                                                                                                                                                                                                                           | PASS.                                                                                                                                                |
| `npm run schema:check`                                                                                                                                                                                                                                        | Initial FAIL because generated schema docs were unstaged after regeneration; final rerun PASS after staging generated docs.                          |
| `npm run validate:project`                                                                                                                                                                                                                                    | PASS.                                                                                                                                                |
| `npm run lint:md`                                                                                                                                                                                                                                             | PASS after fixing schema generator heading spacing and the plan-table regex row.                                                                     |
| `npm run test:diff -- --reporter=dot`                                                                                                                                                                                                                         | PASS, but selected guarded FULL because schema files changed; 115 files and 863 tests passed. This was not manually requested with `RUN FULL SUITE`. |
| `npm run test:architect -- --reporter=dot`                                                                                                                                                                                                                    | PASS; 283 files and 3,298 tests passed.                                                                                                              |
| `git diff --check`                                                                                                                                                                                                                                            | PASS.                                                                                                                                                |
| `npm run typecheck`                                                                                                                                                                                                                                           | Final rerun PASS after the schema generator TypeScript edit.                                                                                         |

## Commands Intentionally Skipped

- `npm run build`: skipped because no UI, route, or component behavior changed.
- `npm run test:full`: not intentionally invoked; `test:diff` selected it
  automatically due the schema-file diff, and this is recorded above as a
  policy note.

## Remaining Work

- TS-ZERO-002 must run the broader schema escape scan and prove there are no
  remaining `z.any()` or `z.record(..., z.any())` sites in `src/`.
