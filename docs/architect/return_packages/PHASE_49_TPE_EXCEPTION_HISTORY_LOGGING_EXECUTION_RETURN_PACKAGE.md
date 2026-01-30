# PHASE 49 — TPE Exception History Logging — EXECUTION RETURN PACKAGE

**Date:** 2026-01-29  
**Mode:** EXECUTION  
**Scope:** `src/features/architect/**` (Architect trade pipeline + guardrails)  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Executive Summary

### Gap

- Phase 46 gap **G-TPE-3 Usage History** remained open: no durable record of TPE creation/consumption events even though SSOT validators delivered that data.
- ExceptionHistoryTracker UI always displayed "No TPE activity logged" because `team.exceptionHistory[]` was never populated.
- Retried mutations risked double-logging if history were naively appended.

### Fix

- Added dedicated helper module `historyHelpers.js` that builds deterministic `historyKey`s (`${mutationType}:${worldId}:${teamCode}:${tpeId}:${kind}:${signature}`) and appends entries idempotently.
- `computeTradeResult()` now:
  - Emits `TPE_CONSUMED` entries whenever validator reduces `remainingAmount`, carrying `amountConsumed`, `remainingAmountAfter`, `fullyConsumed`, and `absorbedPlayers` derived from `matchIncoming` data.
  - Emits `TPE_CREATED` entries sourced from SSOT `teamResult.createdTPE`, including creation metadata and expiry.
  - Persists entries onto `team.exceptionHistory[]` before Firestore writes via `appendExceptionHistory()`.
- Added Phase 49 guardrail tests covering creation, partial/full consumption, idempotency, and no-op behavior.

Result: Architect worlds now accumulate accurate TPE activity feeds without duplicate entries on retries.

---

## 2. Data Schema Decision

- **Storage Field:** `exceptionHistory[]` on each team overlay document at `architect_worlds/{worldId}/teams/{teamCode}`.
- **Reasoning:** Exception history is tightly coupled to team snapshots already written by `persistWorldMutation()`. Persisting alongside `tradeExceptions[]` keeps history scoped per team, aligns with existing UI props (`teamCapSheet.exceptionHistory`), and avoids new collections/schema migrations.
- **Entry Shape:**
  - Base fields: `historyKey`, `type` (`TPE_CREATED` or `TPE_CONSUMED`), `teamCode`, `tpeId`, `seasonId`, `seasonYear`, ISO `timestamp`.
  - Creation-only fields: `amountCreated`, `createdFrom`, `createdSeason`, `expiresOn`.
  - Consumption-only fields: `amountConsumed`, `remainingAmountAfter`, `fullyConsumed`, `absorbedPlayers[]`.
  - Optional metadata: `worldId`, `mutationId` (populated when context provides it).
- **Idempotency:** `appendExceptionHistory()` rejects entries whose `historyKey` already exists, ensuring reruns or batch retries do not double-log events.

---

## 3. Files Changed

| File                                                                                                | Change       | Description                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/exceptionHistory/historyHelpers.js`                                   | **Added**    | New helper module to build history entries, compute deterministic keys, sanitize absorbed player lists, and append entries with dedupe guarantees.                                            |
| `src/features/architect/utils/mutationPipeline.js`                                                  | **Modified** | Threaded `worldId`/mutation context through trade + sign-and-trade paths, generated creation/consumption entries from validator SSOT data, and persisted them via `appendExceptionHistory()`. |
| `src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.js`                      | **Added**    | Guardrail suite covering creation logging, consumption logging (partial & full), append idempotency, and no-op behavior.                                                                      |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`                                       | **Modified** | Added Phase 49 execution entry to the canonical changelog.                                                                                                                                    |
| `PROJECT_SCHEMA.md`                                                                                 | **Modified** | Documented the new `features/architect/utils/exceptionHistory/` directory in the repo schema map.                                                                                             |
| `docs/architect/return_packages/PHASE_49_TPE_EXCEPTION_HISTORY_LOGGING_EXECUTION_RETURN_PACKAGE.md` | **Added**    | This return package.                                                                                                                                                                          |

---

## 4. Example History Entries

### `TPE_CREATED`

```json
{
  "historyKey": "executeTrade:world_123:BOS:tpe_bos_42:created:2025|2026-07-01T00:00:00.000Z|8000000|Jaylen Brown",
  "type": "TPE_CREATED",
  "teamCode": "BOS",
  "tpeId": "tpe_bos_42",
  "amountCreated": 8000000,
  "createdFrom": "Jaylen Brown",
  "createdSeason": 2025,
  "expiresOn": "2026-07-01T00:00:00.000Z",
  "seasonId": "2024-25",
  "seasonYear": 2025,
  "timestamp": "2026-01-29T05:25:00.000Z",
  "worldId": "world_123"
}
```

### `TPE_CONSUMED`

```json
{
  "historyKey": "executeTrade:world_123:LAL:tpe_lal_01:consumed:3500000|1500000|0|player_a:2000000,player_b:1500000",
  "type": "TPE_CONSUMED",
  "teamCode": "LAL",
  "tpeId": "tpe_lal_01",
  "amountConsumed": 3500000,
  "remainingAmountAfter": 1500000,
  "fullyConsumed": false,
  "absorbedPlayers": [
    { "playerId": "player_a", "name": "Player A", "amountAbsorbed": 2000000 },
    { "playerId": "player_b", "name": "Player B", "amountAbsorbed": 1500000 }
  ],
  "seasonId": "2024-25",
  "seasonYear": 2025,
  "timestamp": "2026-01-29T05:25:00.000Z",
  "worldId": "world_123"
}
```

---

## 5. Tests & Build

```
npm run test -- --run src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.js
✓ src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.js (5)
Test Files  1 passed (1)
Tests       5 passed (5)
Duration    5.75s
```

```
npm run test -- --run src/tests/architect/
Test Files  21 passed (21)
Tests       230 passed (230)
Duration    49.72s
Notes       Expected sign-and-trade negative tests emit applyWorldMutation error logs during assertions.
```

```
npm run build
vite build ✓ (chunk warnings only: known large bundles & fs externalization log)
Duration    28.70s
```

---

## 6. Master Doc Changelog Entry

```markdown
- - 2026-01-29: Phase 49 TPE Exception History Logging (EXECUTION) - Added `exceptionHistory[]` persistence to Architect trade results with deterministic `historyKey` dedupe. `computeTradeResult()` now generates durable `TPE_CREATED` + `TPE_CONSUMED` entries (world-aware, timestamped) via `historyHelpers.js`, and `appendExceptionHistory()` prevents retries from duplicating records. Added Phase 49 guardrail tests covering creation, consumption (partial/full), idempotency, and no-op scenarios. Return package: `docs/architect/return_packages/PHASE_49_TPE_EXCEPTION_HISTORY_LOGGING_EXECUTION_RETURN_PACKAGE.md`.
```

---

**Phase 49 Complete.** Architect worlds now capture verifiable TPE activity feeds that drive ExceptionHistoryTracker and future audits.
