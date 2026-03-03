# TEAM_HISTORY_E5 — EXECUTION RETURN PACKAGE

## 1) Status

**COMPLETE**

## 2) Summary (what changed and why)

TEAM_HISTORY_E5 final-close is implemented by enriching canonical world event payloads at write-time in the mutation pipeline SSOT so Team History world mode has deterministic data for high-quality summary rows and detail sections.

Primary implementation points:

- Canonical event payload builder enrichment in `src/features/architect/utils/mutationPipeline.js` (`buildWorldMutationEventPayload` + helper normalizers).
- Persistence contract allowlist updates in `src/features/architect/utils/persistenceContracts/contracts.js` to accept enriched event fields.
- Deterministic E5 matrix guardrail + world-mode display integration tests added under `src/tests/architect/`.

No write-path broadening was introduced; world writes remain under `architect_worlds/{worldId}/...`.

## 3) Exact enrichment fields added (schema)

### Event envelope guarantees (required)

For required Team History mutation families:

- `schemaVersion`
- `eventId` and mirror `id`
- `operationId` (stable fallback to event id when absent)
- canonical `mutationType` with legacy mirror `type`
- `occurredAt` and `timestamp` (ISO)
- `teamCodes` (fail-closed when missing for required families)
- `teamsAffected` mirror
- `playerIds`
- `metadata` and `mutationMetadata`

### Enrichment blocks

Added/normalized for Team History rendering:

- `diffSummary.playersMoved` (array) for trade-family readability
- `diffSummary.picksMoved` (array) from `picksTraded` and/or `entitlementsTraded`
- `diffSummary.exceptionChanges` default marker for `setExceptions` when needed
- `diffSummary.deadCapChanges` default marker for `setDeadCap` when needed
- `mutationMetadata.contractSummary` (and `mutationMetadata.contract` mirror) with:
  - `years`
  - `firstYearSalary`
  - `totalValue` (when derivable)
  - `startYear` / `endYear` (season labels when available)
  - `signedUsing`
- `mutationMetadata.signedUsing` / `mutationMetadata.rightsUsed` when available
- `mutationMetadata.stretched`
- `mutationMetadata.buyout`
- `mutationMetadata.deadCapAmount`
- `mutationMetadata.extensionYears`
- `mutationMetadata.optionType`
- `mutationMetadata.accepted`

### Family metadata producers enriched at compute-time (write-time source inputs)

In `mutationPipeline.js`, metadata producers now surface inputs used by builder normalization:

- Signing: `rightsUsed`
- Waive: `buyout`, `buyoutAmount`, `stretchYears`
- Extend: `extensionTerms`
- Offer-sheet finalize (matched/declined): `teamCode`, `playerName`, `signedUsing`, `contract` summary source
- Cap admin: `exceptionChanges` / `deadCapChanges` markers

## 4) Mutation matrix coverage table

| mutationType                 | enrichment proof                                                                         | test proof                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `executeTrade`               | `diffSummary.playersMoved`, `diffSummary.picksMoved` and entitlement-derived picks lines | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `signFreeAgent`              | `mutationMetadata.contractSummary` + `signedUsing`/rights fields                         | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `signAndTrade`               | `contractSummary` from metadata contract + canonical envelope fields                     | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `finalizeMatchedOfferSheet`  | offer-sheet contract metadata emitted and normalized to contract summary                 | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `finalizeDeclinedOfferSheet` | offer-sheet contract metadata emitted and normalized to contract summary                 | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `waivePlayer`                | `stretched`, `buyout`, `deadCapAmount` emitted in mutation metadata                      | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `extendPlayer`               | `extensionYears` + extension terms normalized into contract summary                      | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `optionDecision`             | `optionType` and `accepted` propagated                                                   | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `renounceRights`             | `rightsUsed` canonicalized for detail rendering                                          | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `setExceptions`              | `diffSummary.exceptionChanges` marker present when input/metadata provided               | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |
| `setDeadCap`                 | `diffSummary.deadCapChanges` marker present when input/metadata provided                 | `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` |

Display integration proof (E4-model consumption from enriched shapes):

- `src/tests/architect/teamHistory.displayFromEnrichedEvents.integration.test.tsx`

## 5) Files changed (product/tests/docs)

### Product

- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/persistenceContracts/contracts.js`

### Tests

- `src/tests/architect/teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts` (new)
- `src/tests/architect/teamHistory.displayFromEnrichedEvents.integration.test.tsx` (new)

### Docs

- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md` (TEAM_HISTORY_E5 ledger entry)
- `docs/architect/TEAM_HISTORY_MASTER.md` (new, v1 CLOSED note)

### Return package

- `return_packages/architect_fixes/TEAM_HISTORY_E5_EXECUTION_RETURN_PACKAGE.md` (this file)

## 6) Test evidence (new tests + assertions)

### `teamHistory.eventPayloadEnrichment.matrix.guardrail.test.ts`

- Iterates required mutation matrix and builds canonical payload via `buildWorldMutationEventPayload`.
- Asserts always-present envelope fields exist.
- Asserts non-empty `teamCodes` for required families.
- Asserts canonical alias normalization (`setException` -> `setExceptions`).
- Asserts family-specific enrichment keys are present (trade movement, contract summary, waive flags, cap-admin diffs).
- Asserts fail-closed throw for missing `teamCodes`.

### `teamHistory.displayFromEnrichedEvents.integration.test.tsx`

- Seeds enriched events for required representative families (`executeTrade`, `signFreeAgent`, `waivePlayer`, `extendPlayer`, `setExceptions`).
- Asserts timeline rows show human summary text (not fail-soft fallback).
- Asserts detail modal structured sections (Players/Picks/Contract/Exceptions/Cap Delta as applicable).
- Asserts raw payload block remains visible.

## 7) Forbidden writes proof

- No new write target to root `/teams`.
- No new write target to `architect_base*` collections.
- Mutation persistence path remains canonical world-scoped writes under `architect_worlds/{worldId}/...` via existing `persistWorldMutation` flow.
- Existing forbidden-write regression guardrail suite remains passing in architect tests.

## 8) Command outputs (required order)

1. `npm run validate:project` → **PASS**
   - `✅ All validations passed!`

2. `npm run build` → **PASS**
   - `✓ built in 34.01s`
   - Non-blocking existing warnings remained (browserslist age, chunk-size warning, dynamic import notes).

3. `npm run test:architect -- --reporter=dot` → **PASS**
   - `Test Files  165 passed (165)`
   - `Tests  2437 passed | 1 skipped | 3 todo (2441)`

4. `npm run test:trade -- --reporter=dot` → **PASS**
   - `Test Files  58 passed (58)`
   - `Tests  532 passed | 1 skipped | 3 todo (536)`

## 9) Known gaps / residual risk

- `beforeTotalsByTeam` / `afterTotalsByTeam` remain present only when available from pipeline audit context; E5 does not fabricate totals.
- Some enrichment markers for admin mutations (`setExceptions`, `setDeadCap`) may be generalized text markers when detailed deltas are not supplied by mutation inputs.
- Existing non-blocking build warnings are unchanged and out-of-scope for E5.

## 10) Ledger + master doc update confirmation

- Ledger updated: `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- Team History master doc created/closed: `docs/architect/TEAM_HISTORY_MASTER.md`
