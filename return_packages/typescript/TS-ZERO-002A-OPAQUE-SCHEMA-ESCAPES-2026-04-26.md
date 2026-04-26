# TS-ZERO-002A Opaque Schema Escapes Return Package

Date: 2026-04-26

Verdict: `PHASE COMPLETE - ZERO-EXCEPTION HARDENING STILL INCOMPLETE`

## Scope

TS-ZERO-002A removed opaque schema passthroughs from the canonical player and
Architect schema files:

- `src/schemas/players_v2.ts`
- `src/schemas/architect.ts`

The broader Gate 3 scan found remaining Firebase helper passthrough schemas, so
TS-ZERO-002B was appended before Phase 3.

## Changes

- Removed all `.passthrough()` sites from `players_v2` and `architect`
  schemas.
- Added explicit compatibility fields for current contract filters,
  entitlement editor/vacuum metadata, cap holds, trade exceptions, draft pick
  carrier fields, and computed team totals.
- Replaced genuinely map-shaped payloads with typed `JsonValue` records.
- Updated the team staging script so draft-pick metadata conforms to the typed
  schema contract.
- Updated the zero-exception plan cursor to TS-ZERO-002B and recorded the
  remaining Firebase helper schema work.

## Validation

| Command | Result |
| --- | --- |
| `rg -n "z\.unknown\(\|passthrough\(\|catchall\(\|z\.any\(" src/schemas/players_v2.ts src/schemas/architect.ts` | PASS; no matches. |
| `npm run typecheck` | PASS. |
| `npm run schema:check` | PASS. |
| `npm run test:diff -- --reporter=dot` | STOPPED; selected guarded full tier, node half passed, UI half stopped after crossing the 4-minute budget. |
| `npm run test:architect -- --reporter=dot` | PASS; 283 files and 3,298 tests. |
| `rg -n "z\.unknown\(\|passthrough\(\|catchall\(\|z\.any\(" src -g '*.ts' -g '*.tsx'` | FOLLOW-UP; remaining source hits are Firebase helper passthrough schemas plus one test comment. |
| `git diff --check` | PASS. |
| `npm run lint:md` | PASS. |
| `npm run validate:project` | PASS. |

## Files Changed

- `src/schemas/players_v2.ts`
- `src/schemas/architect.ts`
- `team-scrape/shared/firestore_staging/scripts/stage_team.ts`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`
- `return_packages/typescript/TS-ZERO-002A-OPAQUE-SCHEMA-ESCAPES-2026-04-26.md`

## Commands Intentionally Skipped

- `npm run test:full`: skipped because the prompt did not contain the required
  exact phrase `RUN FULL SUITE`.
- `npm run build`: skipped because this item changed schemas and staging logic,
  not UI, routes, or components.

## Follow-up

Continue with TS-ZERO-002B. The next source-code Gate 3 work is limited to:

- `src/firebase/rankerHelpers.ts`
- `src/firebase/listHelpers.ts`
- `src/firebase/rosterHelpers.ts`
