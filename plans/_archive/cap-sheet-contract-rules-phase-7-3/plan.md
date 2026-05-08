# Cap Sheet Contract Rules Phase 7.3: Option State Invariants + Cap Hold Multiplier Audit

## PRE-EXECUTION SELF-CHECK

- This is multi-step work, so plan mode is required. Plan slug: `cap-sheet-contract-rules-phase-7-3`.
- This is not a large/multi-phase effort, so no chunks are needed.
- Temporary files (if any) go in `plans/cap-sheet-contract-rules-phase-7-3/temp/`.
- Permanent files likely touched: `src/features/architect/utils/`, `tests/architect/`, `docs/architect/`, `plans/`.

## PLAN_INTENT

Make option accept/decline transitions pipeline-authoritative via enforced state invariants, and confirm cap hold multipliers are defined in exactly one canonical source.

## SCOPE

- In scope:
  - Audit cap hold multiplier sources and unify on a single canonical table
  - Enforce option accept/decline state invariants in pipeline validation
  - Add/adjust tests for invariants and multiplier sourcing
  - Update master doc and create Phase 7.3 return package
  - Run required tests and build

- Out of scope:
  - Any Firestore write logic changes beyond pipeline validation
  - Trade Machine validation changes
  - Schema migrations or structural refactors

## IMPLEMENTATION_SCOPE

Targeted validation logic updates (capLegalityValidation + pipeline caller), small helper adjustments for canonical multipliers, test additions in capLegalityValidation test suite, and documentation updates (master doc + return package). No feature/UI changes.

## CONTEXT SNAPSHOT

- Systems involved
  - Architect mutation pipeline validation (`src/features/architect/utils/mutationPipeline.js`)
  - Cap legality validation (`src/features/architect/utils/capLegalityValidation.js`)
  - Cap hold helpers (`src/features/architect/utils/capHoldTransitionHelpers.js`, `src/features/architect/utils/capHolds.ts`)

- Key folders and files
  - `src/features/architect/utils/capLegalityValidation.js`
  - `src/features/architect/utils/capHoldTransitionHelpers.js`
  - `src/features/architect/utils/mutationPipeline.js`
  - `src/features/architect/utils/capHolds.ts`
  - `src/features/architect/utils/playerRulesProfile/birdRightsRules.js` (multiplier audit)
  - `tests/architect/capLegalityValidation.test.js`
  - `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
  - `docs/architect/return-packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_3_OPTION_STATE_INVARIANTS.md`

- Relevant docs
  - `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
  - `docs/workspace-rules/WORKFLOW_CHECKLIST.md`
  - `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md`
  - `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md`

- Known constraints
  - Firestore is read-only (no write logic changes beyond validation/pipeline)
  - Temporary work must live in `plans/cap-sheet-contract-rules-phase-7-3/temp/`

- Questions asked and answered
  - None (requirements are explicit in the request)

- Technical decisions made
  - Use `CAP_HOLD_MULTIPLIERS` in `capHolds.ts` as the single canonical multiplier table
  - Enforce option invariants primarily via `validateOptionDecision` with updated inputs

## CHUNK_INDEX

- chunk_n/a — no chunks (multi-step but not large)

## CURRENT_STATE

- status: completed
- currentChunk: none
- blockers: none
- lastUpdated: 2026-01-18 07:30

## PROGRESS

**Status**: 🟢 Completed

**Progress**: ✅✅✅✅✅ 5/5 tasks completed

**Completed**:

- ✅ Audit multiplier sources and unify canonical usage
- ✅ Implement option accept/decline invariant checks in validation
- ✅ Update tests for invariants and multiplier sourcing
- ✅ Update master doc and create Phase 7.3 return package
- ✅ Run required tests and build

**Next Steps**:

- [ ] None

**Blockers**: None

**Last Updated**: 2026-01-18 07:30

## PERMANENT_FILE_MAP

- Validation logic: `src/features/architect/utils/capLegalityValidation.js`
- Cap hold helpers: `src/features/architect/utils/capHoldTransitionHelpers.js`, `src/features/architect/utils/capHolds.ts`
- Pipeline validation wiring: `src/features/architect/utils/mutationPipeline.js`
- Tests: `tests/architect/capLegalityValidation.test.js`
- Docs: `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
- Return package: `docs/architect/return-packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_3_OPTION_STATE_INVARIANTS.md`

## REVISION_LOG

- 2026-01-18: Plan initialized for Phase 7.3 execution.
- 2026-01-18: Completed Phase 7.3 execution and verification.

## KNOWN_LIMITATIONS

- If the declined option removes the player from `updatedTeam.players`, free agency invariants can only be validated via roster/cap hold checks (direct contract inspection unavailable).
