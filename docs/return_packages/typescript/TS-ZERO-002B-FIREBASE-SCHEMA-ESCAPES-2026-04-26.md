# TS-ZERO-002B Firebase Schema Escapes Return Package

## Verdict

PHASE COMPLETE - ZERO-EXCEPTION HARDENING STILL INCOMPLETE

TS-ZERO-002B removed the remaining Firebase helper schema `.passthrough()`
sites and cleared the broad Gate 3 schema escape source scan. The overall
zero-exception mission remains incomplete because Gate 4 test/mock hardening,
Gate 5 JS-like file conversion, and the final audit are still active.

## Files Changed

- `src/firebase/listHelpers.ts`
- `src/firebase/rankerHelpers.ts`
- `src/firebase/rosterHelpers.ts`
- `src/tests/architect/mutationPipeline.catchallNarrowing.test.ts`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`
- `return_packages/typescript/TS-ZERO-002B-FIREBASE-SCHEMA-ESCAPES-2026-04-26.md`

## Source Changes

- Replaced Firebase timestamp `.passthrough()` schemas with explicit supported
  timestamp object shapes in list, ranker, and roster helpers.
- Removed passthrough behavior from list, tier-list, ranker setup/session, and
  roster-project read document schemas so helper reads validate only the fields
  they own.
- Updated one Architect test comment that caused a false-positive broad schema
  escape scan hit.

## Validation Commands Run

- `rg -n "z\.unknown\(\|passthrough\(\|catchall\(\|z\.any\(" src -g '*.ts' -g '*.tsx'`
  - PASS: no source matches remained.
- `npm run typecheck`
  - PASS.
- `npm run test:diff -- --reporter=dot`
  - STOPPED / POLICY NOTE: selected guarded full-tier coverage from the
    cumulative diff and was stopped under the 4-minute budget policy.
- `npm run test:fast -- --reporter=dot`
  - PASS: 12 files and 57 tests.
- `npm run test:roster -- --reporter=dot`
  - PASS: 3 files and 31 tests.
- `npm run test:node -- --reporter=dot tests/listHelpers.smoke.test.ts tests/ranker/rankerHelpers.smoke.test.ts tests/rankerLocalDraft.test.ts tests/rankerSaveAsList.test.ts tests/rankerSessionSerialization.test.ts`
  - PASS: 5 files and 42 tests.
- `npm run lint:md`
  - PASS.
- `npm run validate:project`
  - PASS.
- `git diff --check`
  - PASS.

## Commands Intentionally Skipped

- `npm run test:full`
  - Skipped because the prompt did not contain the required exact phrase
    `RUN FULL SUITE`.
- `npm run build`
  - Skipped because this checkpoint changed helper validation schemas, tests,
    and docs, with no UI, route, or component changes.

## Next Cursor

- `TS-ZERO-003`: tighten the highest-hit broad test harness/mock files into
  typed builders under Gate 4.
