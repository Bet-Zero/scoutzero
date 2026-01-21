# PST Phase 10 Firestore Entitlements Implementation

## PLAN_INTENT

Implement Phase 10 Firestore entitlements storage, resolver helpers, loader wiring, validation, and documentation for Trade Machine use.

## SCOPE

- In scope:
  - Base entitlements writer script and base team entitlementIds patch script
  - Entitlement resolver helper (base + world override merge)
  - Loader/hook wiring for Trade Machine access
  - Validation script/test coverage and docs updates
  - Phase 10 return package and master plan update

- Out of scope:
  - UI redesigns beyond minimal wiring
  - Lottery or resolution engine logic
  - World migration beyond test/emulator needs
  - Phase 11 scope

## IMPLEMENTATION_SCOPE

Implement scripts to push base entitlements and patch base teams with entitlementIds, add entitlement resolver utilities and wiring for Trade Machine reads, add validation, and update required documentation.

## CONTEXT SNAPSHOT

Important background for this plan:

- Systems involved
  - Firestore (architect_baseEntitlements, architect_baseTeams, architect_worlds)
  - Architect trade machine loaders/utilities
  - PST entitlement assets JSON outputs (Phase 8.1)

- Key folders and files
  - `team-scrape/draft-picks/scripts/pst/`
  - `data/pst/`
  - `src/features/architect/utils/`
  - `src/features/architect/hooks/`
  - `docs/team-scrape/`

- Relevant docs (paths under docs/ or elsewhere)
  - `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`
  - `docs/workspace-rules/WORKFLOW_CHECKLIST.md`
  - `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md`
  - `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md`

- Known constraints
  - Read-only Firestore usage in app code
  - Must not break legacy pick arrays
  - Batch writes 400-450 per commit for writers

- **Questions asked and answered**
  - None (requirements provided in Phase 10 prompt)

- **Technical decisions made**
  - Create entitlement resolver in `src/features/architect/utils/entitlements/`
  - Use admin SDK for push/patch scripts with service account
  - Implement resolver with base-first deep merge for overrides

## CHUNK_INDEX

- No chunks for this plan (multi-step but not large/multi-phase).

## PROGRESS

**Status**: ✅ Complete

**Progress**: 🟩🟩🟩🟩🟩 5/5 tasks completed

**Completed**:

- ✅ Add Firestore writer scripts + npm commands
- ✅ Add entitlement resolver + loader/hook wiring
- ✅ Add validation script/test coverage
- ✅ Update documentation (return package, master plan, project schema, dev guide)
- ✅ World validation passed under emulators (anonymous auth + ownership gating)

**Next Steps**:

- None — Phase 10 validation complete in emulators

**Blockers**:

- None

**Last Updated**: 2026-01-21 10:50

### Phase 10.1 Note

World validation passed under emulators using anonymous auth + world ownership gating.

## PERMANENT_FILE_MAP

Authoritative mapping of where real work for this plan lives:

- Scripts: team-scrape/draft-picks/scripts/pst/
- Data (inputs): data/pst/
- Architect utils: src/features/architect/utils/entitlements/
- Architect hooks: src/features/architect/hooks/
- Docs: docs/team-scrape/
- Config: package.json, src/constants/collections.ts, src/data/firestorePaths.js, src/features/architect/utils/architectFirestorePaths.ts

## REVISION_LOG

- 2026-01-21: Plan created for Phase 10 Firestore entitlement storage + wiring

## KNOWN_LIMITATIONS

Anything we know is incomplete, constrained, or intentionally deferred.

- UI improvements deferred (Phase 11).
