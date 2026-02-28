# TM_CAP_AUDITABILITY_E1_EXECUTION_RETURN_PACKAGE

Date: 2026-02-28  
Mode: EXECUTION  
Scope: Authoritative world mutation pipeline only (`applyWorldMutation` / `persistWorldMutation`)

## Executive Summary

E1 is implemented for the authoritative world mutation path.

- Added a shared post-state validator contract (`postStateCapValidator`) with version `0.1.0`.
- `applyWorldMutation` now generates an `operationId`, computes SSOT before/after totals snapshots, runs post-state validation, and fail-closes on validator violations.
- `persistWorldMutation` now writes a versioned `CapAuditEventV1` envelope at the existing world events destination.
- Persistence event allowlists were extended for `CapAuditEventV1` fields.
- Finalize offer-sheet validator mapping gap was closed with explicit finalize validation routing.

No new Firestore write path was introduced; changes stay within the existing world mutation persistence boundary.

## Files Changed

| File | Change |
| --- | --- |
| `src/features/architect/utils/capLegality/postStateCapValidator.ts` | New post-state validator module + E1 rule set + versioned contract output |
| `src/features/architect/utils/mutationPipeline.js` | Added `operationId` threading, post-state validator invocation, fail-closed gate, CapAuditEventV1 envelope write, finalize offer-sheet validator mapping fix |
| `src/constants/collections.ts` | Added `ARCHITECT_WORLD_EVENTS_SUBCOLLECTION` constant |
| `src/features/architect/utils/persistenceContracts/contracts.js` | Extended `EVENT_TOP_LEVEL_ALLOWLIST` for CapAuditEventV1 fields |
| `src/tests/architect/capAuditEventV1.persistWorldMutation.guardrails.test.ts` | Source-scan guardrail for required event envelope fields |
| `src/tests/architect/postStateCapValidator.behavior.test.ts` | Behavioral tests for NaN violation, salary floor warning, hard-cap violation |
| `src/tests/architect/offerSheetFinalizeValidatorMapping.guardrail.test.ts` | Guardrail test for finalize offer-sheet validator mapping |
| `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js` | Updated event allowlist expectations to include CapAuditEventV1 fields |
| `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js` | Updated event fixture/keyset expectations for CapAuditEventV1 |
| `docs/architect/CAP_AUDITABILITY_MASTER.md` | Added E1 implementation status section |
| `docs/SHIP_GATES_MASTER.md` | Added draft gates for world mutation validator fail-close + CapAuditEventV1 emission |

## Validator Contract + Version

- Module: `src/features/architect/utils/capLegality/postStateCapValidator.ts`
- Version: `POST_STATE_CAP_VALIDATOR_VERSION = "0.1.0"`
- Exported API:
  - `validatePostStateCapLegality(input): { valid, violations, warnings }`

Input fields used in E1:

- `operationId`
- `mutationType`
- `worldId`
- `year`
- `beforeTeamsByCode`
- `afterTeamsByCode`
- `beforeTotalsByTeam`
- `afterTotalsByTeam`
- `rulesContext`

## CapAuditEventV1 Schema (Implemented)

Persisted event envelope now includes:

- `schemaVersion`
- `validatorVersion`
- `operationId`
- `mutationType`
- `occurredAt`
- `worldId`
- `teamCodes`
- `playerIds`
- `beforeTotalsByTeam`
- `afterTotalsByTeam`
- `valid`
- `violations`
- `warnings`
- `diffSummary`
- `mutationMetadata` (`mutationType`, `category`, `worldId`, `teams`, `players`)

Backward-compatible legacy fields retained:

- `eventId`
- `type`
- `timestamp`
- `seasonId`
- `metadata`
- `teamsAffected`

## Evidence

- Operation ID generation and post-state validator invocation:
  - `src/features/architect/utils/mutationPipeline.js:660`
  - `src/features/architect/utils/mutationPipeline.js:830`
- Fail-closed post-state behavior before persistence:
  - `src/features/architect/utils/mutationPipeline.js:812`
  - `src/features/architect/utils/mutationPipeline.js:847`
- Audit context threading into persistence:
  - `src/features/architect/utils/mutationPipeline.js:892`
- CapAuditEventV1 envelope write in `persistWorldMutation`:
  - `src/features/architect/utils/mutationPipeline.js:2918`
- Existing event path preserved via centralized constant:
  - `src/constants/collections.ts:69`
  - `src/features/architect/utils/mutationPipeline.js:2888`
- Persistence allowlist updates for event contract:
  - `src/features/architect/utils/persistenceContracts/contracts.js:271`
- Finalize offer-sheet validation mapping:
  - `src/features/architect/utils/mutationPipeline.js:2693`

## Tests Added / Updated

Added:

- `src/tests/architect/capAuditEventV1.persistWorldMutation.guardrails.test.ts`
  - Proves event construction includes required E1 envelope fields.
- `src/tests/architect/postStateCapValidator.behavior.test.ts`
  - Proves:
    - NaN totals => violation (`TOTALS_NON_FINITE`)
    - Salary floor breach => warning only (`SALARY_FLOOR_NOT_MET`)
    - Hard-cap exceed => violation (`HARD_CAP_EXCEEDED`)
- `src/tests/architect/offerSheetFinalizeValidatorMapping.guardrail.test.ts`
  - Proves finalize mutation types route through `validateOfferSheetResolution(action: 'finalize')` and fail when offer sheet missing.

Updated:

- `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js`
- `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js`

## Commands Run + Results

Required commands:

1. `npm run test:node -- --run --reporter=dot`  
   Result: PASS (`240` files passed, `1` skipped)
2. `npm run test:ui -- --run --reporter=dot`  
   Result: PASS (`35` files passed)
3. `npm run build`  
   Result: PASS (build completed; existing non-blocking chunk warnings)
4. `npm run validate:project`  
   Result: PASS (all validations passed)

Additional command run for early regression feedback:

- `npm run test:diff -- --reporter=dot`  
  Result: PASS

Commands intentionally skipped:

- None.

## Residual Risks / Next Steps (E2/E3)

Residual risks:

- E1 validator scope is intentionally minimal; it does not yet enforce broader cap legality beyond totals sanity, hard-cap sanity, and salary-floor warning.
- Team snapshot extraction is bounded to mutation pipeline team scope; E1 does not yet cover season-advance/world-wide parity.
- Legacy/optimistic/base-mode paths are still out of scope for E1.

Recommended next execution ticket:

- **E2: season advance event parity** (emit same `CapAuditEventV1` + post-state validator contract for `advanceSeasonInWorld`).

---

## RETURN PACKAGE (PASTE BACK)

Paths created/updated:

- `return_packages/architect/TM_CAP_AUDITABILITY_E1_EXECUTION_RETURN_PACKAGE.md`
- `docs/architect/CAP_AUDITABILITY_MASTER.md`
- `docs/SHIP_GATES_MASTER.md`
- `src/features/architect/utils/capLegality/postStateCapValidator.ts`
- `src/features/architect/utils/mutationPipeline.js`
- `src/constants/collections.ts`
- `src/features/architect/utils/persistenceContracts/contracts.js`
- `src/tests/architect/capAuditEventV1.persistWorldMutation.guardrails.test.ts`
- `src/tests/architect/postStateCapValidator.behavior.test.ts`
- `src/tests/architect/offerSheetFinalizeValidatorMapping.guardrail.test.ts`
- `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js`
- `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js`

CapAuditEventV1 field list:

- `schemaVersion`
- `validatorVersion`
- `operationId`
- `mutationType`
- `occurredAt`
- `worldId`
- `teamCodes`
- `playerIds`
- `beforeTotalsByTeam`
- `afterTotalsByTeam`
- `valid`
- `violations`
- `warnings`
- `diffSummary`
- `mutationMetadata`

Post-state validator rule list + version:

- Version: `0.1.0`
- Rules:
  - Totals sanity (presence + finite numeric fields + year key validation)
  - Hard-cap ceiling sanity (when hard-cap context is available)
  - Salary floor warning-only (`SALARY_FLOOR_NOT_MET`)

Next recommended execution ticket:

- `E2: season advance event parity`
