# ARCHITECT_SECURITY_E2 — Execution Return Package

Date: 2026-03-04
Status: ✅ Complete

## 1) Summary

ARCHITECT_SECURITY_E2 is implemented end-to-end to eliminate the three remaining security gotchas:

- Added deterministic admin audit/backfill tooling for legacy ownership/id fields.
- Removed lists/tierLists auto-claim exception from Firestore rules (strict owner-only).
- Added source-level rules guardrails to prevent regression.
- Added a minimal Architect auth-ready gate at entry so Architect does not mount/read before auth readiness.

This keeps security fail-closed and preserves ownership SSOT at `architect_worlds/{worldId}.createdBy`.

## 2) Files changed

- `scripts/admin/architectSecurityBackfill.ts` (new)
- `package.json`
- `firestore.rules`
- `src/tests/security/architectSecurity.rulesSource.guardrail.test.ts` (new)
- `src/pages/GmDashboardView.jsx`
- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- `return_packages/architect_fixes/ARCHITECT_SECURITY_E2_EXECUTION_RETURN_PACKAGE.md` (new)

## 3) Rules diff explanation (auto-claim removal confirmed)

`firestore.rules` was tightened for both `lists` and `tierLists`:

- Removed legacy update exception that allowed claims when `ownerUid` was missing.
- Final behavior is strict owner-only:
  - create: authenticated and `request.resource.data.ownerUid == request.auth.uid`
  - read: owner-only (`resource.data.ownerUid == request.auth.uid`)
  - update/delete: owner-only (`resource.data.ownerUid == request.auth.uid`)

Confirmed: no owner-missing auto-claim logic remains for `lists`/`tierLists`.

## 4) Admin script usage

New script: `scripts/admin/architectSecurityBackfill.ts`

### Default audit (dry-run; no writes)

```bash
npm run admin:security:audit
```

### Apply mode (explicit)

```bash
npm run admin:security:apply -- --defaultWorldOwnerUid <uid> --defaultListOwnerUid <uid>
```

### Supported flags

- `--apply` : enable writes
- `--dryRun` : explicit dry-run (alias of default when `--apply` is absent)
- `--verbose` : detailed per-doc audit/update logging
- `--defaultWorldOwnerUid <uid>` : required if any world docs are missing `createdBy`
- `--defaultListOwnerUid <uid>` : required for ownerless list/tierList docs when no inferable owner field exists

### Safety behavior

- Audits and reports totals + offender samples (first 50 per category).
- World docs:
  - missing `worldId` or mismatched `worldId` → backfilled to doc id
  - missing `createdBy` → never guessed; apply aborts without `--defaultWorldOwnerUid`
- Lists/tierLists:
  - missing `ownerUid` uses inferable owner fields only when value is uid-like string
  - otherwise apply aborts without `--defaultListOwnerUid`
- Writes are batched at <= 400 ops per commit.

## 5) Guardrail test coverage

New source-level deterministic guardrail test:

- `src/tests/security/architectSecurity.rulesSource.guardrail.test.ts`

Asserts invariants by reading `firestore.rules` text:

1. No global allow (`allow read, write: if true`) exists.
2. Fail-closed fallback exists (`allow read, write: if false`).
3. `architect_worlds` owner gating uses `createdBy` + `request.auth.uid`.
4. Explicit write deny exists for:
   - `architect_basePlayers`
   - `architect_baseTeams`
   - `architect_baseEntitlements`
   - `architect_basePickRules`
   - root `teams`
5. `lists`/`tierLists` owner-only rules are active and no auto-claim-missing-owner logic remains.

## 6) Auth gate result

Implemented (not skipped).

- File: `src/pages/GmDashboardView.jsx`
- Change: Added minimal auth-ready boundary using `useAuth()`.
- Behavior:
  - While `loading` is true, render compact `Signing in...` state.
  - `GMDashboard` is not mounted until auth readiness is reached.

Why this fixes gotcha #3:

- `useArchitectState` (inside `GMDashboard`) invokes `useArchitectPlayerData`, which subscribes to Firestore on mount.
- Gating mount at page boundary prevents those reads while auth is unresolved.

## 7) Command outputs (required order)

### 1) `npm run validate:project`

- Result: PASS
- Key output:
  - `VALIDATION SUMMARY`
  - `✅ All validations passed!`

### 2) `npm run build`

- Result: PASS
- Key output:
  - `vite v4.5.14 building for production...`
  - `✓ built in 59.58s`
- Notes: existing non-blocking build warnings remain (chunk size / dynamic import notices).

### 3) `npm run test:trade -- --reporter=dot`

- Result: PASS
- Key output:
  - `Test Files  58 passed (58)`
  - `Tests  532 passed | 1 skipped | 3 todo (536)`
  - `Duration  72.55s`

### 4) `npm run test:architect -- --reporter=dot`

- Result: PASS
- Key output:
  - `Test Files  167 passed (167)`
  - `Tests  2449 passed | 1 skipped | 3 todo (2453)`
  - `Duration  104.08s`

## 8) Follow-up punchlist

None blocked for implementation.

Operational follow-up (expected one-time run):

1. Run `npm run admin:security:audit`.
2. If offenders exist, run apply with explicit default UID flags as needed.
3. Re-run audit and confirm zero offenders before production rollout of strict owner rules.
