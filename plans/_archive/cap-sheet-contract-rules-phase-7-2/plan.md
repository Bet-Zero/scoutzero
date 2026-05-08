# Cap Sheet Contract Rules Phase 7.2 - Cap Hold Amounts + FA Year

## PRE-EXECUTION SELF-CHECK

- This is multi-step work, so plan mode is required. Plan slug: `cap-sheet-contract-rules-phase-7-2`.
- This is not a large/multi-phase effort, so no chunks are needed.
- Temporary files (if any) go in `plans/cap-sheet-contract-rules-phase-7-2/temp/`.
- Permanent files likely touched: `src/features/architect/utils/`, `tests/architect/`, `docs/architect/`.

## PLAN_INTENT

Implement Phase 7.2 cap hold correctness and FA-year derivation rules, including audits, canonical computation, validation enforcement, tests, and documentation updates.

## SCOPE

- In scope:
  - Audit current cap hold computation + rightsType availability.
  - Implement canonical cap hold amount computation (rights-based multipliers).
  - Derive option-decline free agency year from season data.
  - Enforce cap hold amount validation for option declines.
  - Add required tests and run specified test/build commands.
  - Update Phase 7.2 return package and master doc.

- Out of scope:
  - Broader cap sheet refactors beyond option decline validation.
  - UI changes.
  - Firestore schema changes.

## IMPLEMENTATION_SCOPE

Follow Phase 7.2 requirements exactly, using existing canonical cap hold tables if present and documenting any stop conditions or fallbacks.

## CONTEXT SNAPSHOT

Important background for this plan:

- Systems involved: Architect cap sheet mutation pipeline + validation rules.
- Key folders and files: `src/features/architect/utils/`, `tests/architect/`, `docs/architect/`.
- Relevant docs: `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`, return packages in `docs/architect/return-packages/`.
- Known constraints: read-only Firestore; cap hold rules must be deterministic; Phase 7.2 stop conditions apply.
- **Questions asked and answered**: None.
- **Technical decisions made**: Use existing canonical cap hold multipliers if present in `capHolds`/`birdRightsRules`.

## CHUNK_INDEX

- No chunks (not a large/multi-phase plan).

## CURRENT_STATE

- status: completed
- currentChunk: none
- blockers: none
- lastUpdated: 2026-01-18 05:18

## PROGRESS

**Status**: 🟢 Completed

**Progress**: ✅✅✅✅✅ 5/5 tasks completed

**Completed**:

- ✅ Audit cap hold computation + rightsType availability; documented findings.
- ✅ Implemented canonical cap hold amount helper and FA-year derivation.
- ✅ Enforced validation and updated option decline logic.
- ✅ Added tests; ran required tests and build.
- ✅ Updated return package(s) and master doc.

**Next Steps**: None

**Blockers**: None

**Last Updated**: 2026-01-18 05:18

## PERMANENT_FILE_MAP

Authoritative mapping of where real work for this plan lives, for example:

- Cap hold transition logic: `src/features/architect/utils/capHoldTransitionHelpers.js`
- Option/season handling: `src/features/architect/utils/seasonManager.js`, `src/features/architect/utils/mutationPipeline.js`
- Validation: `src/features/architect/utils/capLegalityValidation.js`
- Tests: `tests/architect/capLegalityValidation.test.js`
- Docs: `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`, `docs/architect/return-packages/...`

## REVISION_LOG

- 2026-01-18: Plan created for Phase 7.2 execution.
- 2026-01-18: Completed Phase 7.2 execution and documentation.

## KNOWN_LIMITATIONS

Anything we know is incomplete, constrained, or intentionally deferred.
