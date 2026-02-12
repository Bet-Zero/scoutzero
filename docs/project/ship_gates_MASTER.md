# Project Ship Gates — MASTER

Date initialized: 2026-02-12  
Owner: Ship Gates Preflight

## Definition of Done

Green means all of the following are true:

- `npm run test -- --run` exits 0 with no failed files/tests.
- `npm run validate:project` exits 0 with no directory/schema errors.
- CI `Build, Test & Validate` job is green on Node 18 and runs the same commands successfully.
- Any required generated directories are handled deterministically (bootstrapped or schema-adjusted) so local and CI outcomes match.

## Current State Snapshot

- Test gate: **RED** — 76 failed tests across 22 files (2895 total tests).
- Validate gate: **RED** — 3 missing required directories:
  - `player-scrape/contracts/output`
  - `player-scrape/contracts/working`
  - `team-scrape/shared/firestore_staging/output/merged`
- CI parity: **YES** — `ci.yml` runs both failing commands (`npm run test -- --run`, `npm run validate:project`) on Node 18.
- Environment assumptions: Node 18 in CI; `package.json` requires `>=18.17`.

## Failure Buckets + Counts

By failed file count (22 total failed files):

- Data fixtures/schema drift: **16**
- UI/component assertions: **3**
- Mocking/test environment: **1**
- Time/date randomness / nondeterminism: **1**
- Other: **1**
- Firestore emulator/networking: **0**
- Imports/pathing: **0**

By failed assertion volume (76 total failed tests):

- Mock export mismatch (`yearToSeasonKey`) cascade: **21**
- Generic behavior mismatches (`expected false to be true`, etc.): **19+**
- UI expectation misses (text/test-id): **11+**
- Remaining mixed edge assertions: **~25**

## Priority Root Causes

1. Mocking contract mismatch in `computeTeamCapTotals` suite (`yearToSeasonKey` missing from mocked module).
2. UI assertion drift in Trade/Wizard/Entitlement component tests.
3. Entitlement + offer-sheet expectation drift likely tied to recent Architect/Trade/FA edits.

## validate:project Directory Requirement Analysis

Current validator (`scripts/validate-project-schema.ts`) treats these generated/output-style paths as hard-required based on `project.schema.json`:

- `player-scrape/contracts/output`
- `player-scrape/contracts/working`
- `team-scrape/shared/firestore_staging/output/merged`

Recommended direction:

- Keep immediate gate stability by bootstrapping dirs before validation (local + CI), and
- Revisit schema strictness so generated dirs are not brittle hard requirements unless intentionally enforced with bootstrap.

## Open Questions

- Should generated output paths remain in `directories.required`, or move to optional/generated semantics?
- For UI tests, should we standardize on stable test IDs to reduce copy-driven brittleness?
- For entitlement/offer-sheet failures, do we want to preserve new runtime behavior and update tests, or roll behavior back to old expectations?
- Should CI include an explicit project-bootstrap step before `validate:project`?
