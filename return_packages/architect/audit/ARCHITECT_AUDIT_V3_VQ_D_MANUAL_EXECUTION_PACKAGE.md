# ARCHITECT AUDIT V3 VQ-D EXECUTION PACKAGE

## Purpose

This package is the execution companion for `VQ-D-001`.

Use it to capture runtime, screenshot-backed UX evidence for the audited Architect workflows.

It now supports two paths:

- Playwright-assisted capture for the deterministic shell and DEV-fixture-backed checks
- Manual follow-through for any workflow you still want to inspect beyond the now-closed live blocker set

## What This Closes

- ID: `VQ-D-001`
- Current status: resolved since audit in the live delta
- Closure requirement: already met for the narrowed blocker scope; keep this package as the execution/reference companion for captured UX proof

## What Has Already Been Fixed

You do **not** need to re-fix the earlier agent-owned findings before running this package.

Already handled:

- `FIND-B5-001` resolved since audit
- `FIND-B4-001` resolved/candidate resolved since audit
- `FIND-B8-001` resolved/candidate resolved since audit
- `VQ-E2-001` closed by runtime rules proof
- `VQ-B4-001` closed by fail-closed implementation plus focused test proof

This package is now primarily a reference artifact for the execution path and evidence map.

## Environment Prep

### Preferred automated path

If you want the most reproducible setup, use the review-mode startup that now integrates with Playwright:

```bash
PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npm run test:e2e -- e2e/architect-qa.spec.ts
```

What this does:

- boots Architect review mode via `npm run architect:review:up`
- starts emulators
- seeds minimal review data
- runs the hardened checklist spec
- captures screenshots into Playwright test output folders

### When to use manual execution instead

Use the manual path below when you need to verify a save path that still depends on a richer seeded world, authenticated state, or transaction-specific data that the current Playwright suite does not yet synthesize end-to-end.

### Required state

1. Authenticated local session
2. Emulator-backed app session
3. Active world available for Architect flows
4. Dev server running
5. Firebase emulator running

### Recommended startup sequence

Run these in separate terminals if needed:

```bash
npm run emu
npm run dev
```

Then open the local app and navigate to the GM dashboard route used in the checklist.

## Automated Coverage Map

The current Playwright suite is stronger than the original scaffold, but it is not full closure for every row.

| ID         | Current automation status | Notes                                                                                                                                                                                                    |
| ---------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `D-MQ-001` | `Automated`               | Real badge/banner assertions in current dashboard shell                                                                                                                                                  |
| `D-MQ-002` | `Automated`               | Review-mode Playwright now creates/selects a world and proves `+1 Day` advances the world date                                                                                                           |
| `D-MQ-003` | `Automated`               | Review-mode Playwright now executes a real persisted Lakers/Celtics trade, verifies world team snapshot swaps plus an `executeTrade` world event, and proves roster truth after dashboard route re-entry |
| `D-MQ-004` | `Automated`               | Fail-closed gating asserted via disabled apply + not-validated callout                                                                                                                                   |
| `D-MQ-005` | `Automated`               | Review-mode Playwright now stores a seeded offer sheet, renders the pending row in UI, verifies the persisted ATL world document, and proves the pending state rehydrates after dashboard route re-entry |
| `D-MQ-006` | `Automated`               | DEV preview banner asserted through existing localStorage gate                                                                                                                                           |
| `D-MQ-007` | `Partial`                 | Review-mode Playwright now creates/selects a world and proves the season-advance modal opens with world gating                                                                                           |
| `D-MQ-008` | `Automated`               | Review-mode Playwright now uses the real persisted `executeTrade` event from D-MQ-003 and proves Team History row/detail truth against world-backed event data                                           |
| `D-MQ-009` | `Automated`               | Review-mode Playwright now proves persisted entitlement authoring, route re-entry rehydration, and fail-closed conflict handling through the real Trade Machine wizard                                   |
| `D-MQ-010` | `Hybrid`                  | UI handoff captured; actual deny proof remains the Firestore rules runtime suite                                                                                                                         |

## Evidence Capture Rules

For each checklist item below, capture:

1. One screenshot of the relevant UI state
2. A short note stating `PASS`, `FAIL`, or `BLOCKED`
3. If applicable, a short note on the persisted result you observed

If a step fails, do not improvise a workaround. Mark it `FAIL` or `BLOCKED` and record exactly what happened.

## Execution Order

Run the items in this order so the output is consistent with the consolidated plan:

1. D-MQ-001 — Environment truth indicators
2. D-MQ-002 — World date persistence
3. D-MQ-003 — Legal trade apply
4. D-MQ-004 — Invalid trade fail-closed path
5. D-MQ-005 — Free agency / offer sheet workflow
6. D-MQ-006 — Offseason preview non-persist path
7. D-MQ-007 — Season advance persist path
8. D-MQ-008 — Team history world-scope truth
9. D-MQ-009 — Entitlement authoring atomic attach
10. D-MQ-010 — Base-write deny behavior

## Run Sheet

| ID         | Precondition                                              | Action                                                             | Expected UI Result                                                           | Expected Persisted/System Result                                                                                                                                                                                              | Evidence to Capture                                       | Result            | Notes                                                                                                                                                                                                                                                                                                                                               |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `D-MQ-001` | Authenticated user, open `/gm/LAL`, active world selected | Verify header mode badge and emulator warning behavior             | Badge shows correct mode; warning appears only when emulator unavailable     | No unexpected writes; read-only visual indicators only                                                                                                                                                                        | Badge screenshot + warning state screenshot if applicable | `TODO`            |                                                                                                                                                                                                                                                                                                                                                     |
| `D-MQ-002` | Active world with known `asOfDate`                        | Change world date in `WorldTimeControls` and click `+1 Day`        | Date input reflects new date immediately                                     | `architect_worlds/{worldId}.asOfDate` updates; `lastModifiedAt` updates                                                                                                                                                       | Updated date control screenshot                           | `PLAYWRIGHT PASS` | Review mode run on 2026-03-07 passed via `npm run test:e2e -- e2e/architect-qa.spec.ts --grep "D-MQ-002:" --reporter=line`                                                                                                                                                                                                                          |
| `D-MQ-003` | Trade assets loaded for two teams                         | Execute legal trade in Trade Machine                               | Success toast + updated cap tiles/history rows                               | Writes only under `architect_worlds/{worldId}/teams/*`, `/events/*`, metadata patch                                                                                                                                           | Success toast + updated cap/history screenshot            | `PLAYWRIGHT PASS` | Review mode run on 2026-03-08 passed via `npm run test:e2e -- e2e/architect-qa.spec.ts --grep "D-MQ-003:" --reporter=line`; Playwright now proves a real persisted Lakers/Celtics trade, confirms world team snapshot swaps plus an `executeTrade` event, and verifies the re-entered Lakers roster hydrates Derrick White instead of Austin Reaves |
| `D-MQ-004` | Invalid multi-team routing payload scenario               | Attempt invalid apply path or use dev fixture                      | UI shows failure message; no false-success                                   | No rejected mutation write side effects                                                                                                                                                                                       | Failure message screenshot                                | `TODO`            |                                                                                                                                                                                                                                                                                                                                                     |
| `D-MQ-005` | Free agent available in world mode                        | Open FA modal, toggle Offer Sheet, submit a legal low-cost payload | Modal closes and the pending offer-sheet row renders for ATL                 | Offer sheet persists under `architect_worlds/{worldId}/teams/ATL.offerSheets`; emulator-backed admin read confirms saved document fields with no base writes, and the pending state rehydrates after dashboard route re-entry | Success screenshot + persisted world-doc proof            | `PLAYWRIGHT PASS` | Review mode run on 2026-03-07 passed via `npm run test:e2e -- e2e/architect-qa.spec.ts --grep "D-MQ-005:" --reporter=line`; Playwright now proves the persisted offer-sheet save path and route re-entry rehydration, not just modal entry                                                                                                          |
| `D-MQ-006` | Offseason DEV preview flag enabled                        | Run Offseason preview flow                                         | Banner states preview-only and non-persisting                                | No world write until Season Advance action is used                                                                                                                                                                            | Preview banner screenshot                                 | `TODO`            |                                                                                                                                                                                                                                                                                                                                                     |
| `D-MQ-007` | World season advance available                            | Run Season Advance modal                                           | UI season updates and summary modal appears                                  | Team snapshots + world metadata updated in world scope                                                                                                                                                                        | Advance summary screenshot                                | `PLAYWRIGHT PASS` | Review mode run on 2026-03-07 passed via `npm run test:e2e -- e2e/architect-qa.spec.ts --grep "D-MQ-007:" --reporter=line`                                                                                                                                                                                                                          |
| `D-MQ-008` | Team history in world mode                                | Open Team History and inspect newest row details                   | Timeline sorted newest-first, details modal includes operation/totals fields | Event data sourced from `architect_worlds/{worldId}/events`                                                                                                                                                                   | History row + detail modal screenshot                     | `PLAYWRIGHT PASS` | Review mode run on 2026-03-08 passed via `npm run test:e2e -- e2e/architect-qa.spec.ts --grep "D-MQ-008:" --reporter=line`; Playwright now proves Team History rehydrates the real persisted `executeTrade` event from the world event log rather than a DEV fixture row                                                                            |
| `D-MQ-009` | Entitlement authoring feature flag enabled                | Save entitlement edit and then duplicate identity conflict case    | Valid save succeeds; collision case returns explicit error                   | Writes only in world entitlements; atomic attach updates team entitlementIds, the persisted state survives dashboard route re-entry, and the conflict attempt performs no extra world write                                   | Success screenshot + collision error screenshot           | `PLAYWRIGHT PASS` | Review mode run on 2026-03-07 passed via `npm run test:e2e -- e2e/architect-qa.spec.ts --grep "D-MQ-009:" --reporter=line`; Playwright now proves persisted entitlement authoring, route re-entry rehydration, and fail-closed conflict handling, and the underlying atomic attach defect was fixed in `entitlementWriter.ts`                       |
| `D-MQ-010` | Base collection doc IDs known                             | Attempt base write through client path                             | UI denies or handles error                                                   | Firestore rules deny writes to `architect_base*` and `players_v2`                                                                                                                                                             | Error/deny screenshot                                     | `TODO`            |                                                                                                                                                                                                                                                                                                                                                     |

## Cross-Reference Anchors

Use these supporting documents if you need to understand what each check is proving:

- `return_packages/architect/audit/D_MANUAL_QA_CHECKLIST.md`
- `return_packages/architect/audit/D1_UX_TRUTH_TABLE.md`
- `return_packages/architect/audit/D2_WORKFLOW_WALKTHROUGHS.md`

## Completion Rule

`VQ-D-001` was reclassified in the live delta after the narrowed entitlement save-path/runtime authoring gap was proven. Keep these completion rules if you choose to continue capturing broader UX evidence:

1. All ten checklist rows have a filled `Result`
2. Screenshots exist for each applicable row
3. Playwright-generated evidence is attached for automated and partial rows where available
4. Any `FAIL` or `BLOCKED` rows are either fixed or explicitly accepted into a new follow-up backlog

## After You Finish This

When this package is completed, the next audit action is not “run the whole plan again.”

The next action is to:

1. Attach the completed evidence to the live audit delta
2. Recompute the Stage G readiness score
3. Update the final readiness statement based on the new evidence
