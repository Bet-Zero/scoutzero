# ARCHITECT_RULES_INTEGRATION_E1 — Execution Return Package

Date: 2026-03-04  
Mode: EXECUTION  
Status: ✅ COMPLETE

## Summary

Implemented emulator-backed Firestore rules integration tests that execute against the real Firestore emulator and real `firestore.rules` (not source-string assertions).

This closes runtime security proof for:

- `architect_worlds/{worldId}` owner-only behavior via `createdBy`
- Owner-only inheritance across world subcollections (`teams`, `events`, `entitlements`, `teams/*/players`)
- Write-deny boundaries for `architect_base*` and root `teams`
- Strict owner-only behavior for `lists` and `tierLists` by `ownerUid` (no auto-claim)

## Files Changed (Task Scope)

- `src/tests/security/firestoreRules.integration.test.ts`
- `scripts/ci/run_rules_integration_tests.mjs`
- `vitest.rules.config.js`
- `package.json`
- `package-lock.json`
- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- `return_packages/architect_fixes/ARCHITECT_RULES_INTEGRATION_E1_EXECUTION_RETURN_PACKAGE.md`

## Test Matrix Coverage (What each test proves)

### World ownership (`architect_worlds/{worldId}`)

1. Owner can create world when `createdBy == uidA`
2. Non-owner cannot read world doc
3. Non-owner cannot update world doc
4. Owner can write `architect_worlds/{worldId}/teams/{teamCode}`

### World subcollections

5. Owner can write `events/{eventId}`
6. Non-owner cannot read `events/{eventId}`
7. Owner can write `entitlements/{entitlementId}`
8. Non-owner cannot write `teams/{teamCode}/players/{playerId}`

### Base write-deny

9. Authenticated write denied: `architect_baseTeams/{teamCode}`
10. Authenticated write denied: `architect_basePlayers/{playerId}`
11. Authenticated write denied: `architect_baseEntitlements/{id}`
12. Authenticated write denied: root `teams/{teamId}`

### `lists` / `tierLists` strict owner

13. Owner can create `lists/{id}` with `ownerUid == uidA`
14. Non-owner cannot read that list
15. `lists` create fails when `ownerUid` is missing or mismatched
16. `tierLists` mirrors strict behavior (owner create pass, non-owner read deny, invalid create deny)

## How Emulator Targeting Is Enforced

- `npm run test:rules` sets `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082`.
- `scripts/ci/run_rules_integration_tests.mjs` fail-closed preflights emulator reachability via TCP host:port check before launching Vitest.
- If emulator is unreachable, script exits non-zero with explicit guidance:
  - Start emulators with `npm run emu`
  - Retry `npm run test:rules`
- Rules tests run under dedicated `vitest.rules.config.js` to avoid Firebase mocks and ensure real rules evaluation.

## Required Command Outputs (Exact Order)

### 1) `npm run validate:project`

Result: **PASS**

```text
✅ All validations passed!
```

### 2) `npm run build`

Result: **PASS**

```text
✓ built in 39.83s
```

### 3) `npm run typecheck`

Result: **PASS**

```text
> tsc --noEmit
```

### 4) `npm run test:trade -- --reporter=dot`

Result: **PASS**

```text
Test Files  58 passed (58)
Tests  537 passed (537)
```

### 5) `npm run test:architect -- --reporter=dot`

Result: **PASS**

```text
Test Files  167 passed (167)
Tests  2454 passed (2454)
```

### 6) `npm run test:rules`

Result: **PASS**

```text
Test Files  1 passed (1)
Tests  16 passed (16)
```

## Docs Snippets Requested

### `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`

```md
### ARCHITECT_RULES_INTEGRATION_E1 — Emulator-backed Firestore Rules Integration

Optional ship gate to prove runtime Firestore rules behavior against the real emulator using `firestore.rules`.

Optional gate command:

npm run test:rules
```

### `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`

```md
### ARCHITECT_RULES_INTEGRATION_E1: Emulator-backed Firestore Rules Integration (2026-03-04)

Status: ✅ COMPLETE

Commands run + outcomes (required order):

- npm run validate:project -> PASS
- npm run build -> PASS
- npm run typecheck -> PASS
- npm run test:trade -- --reporter=dot -> PASS
- npm run test:architect -- --reporter=dot -> PASS
- npm run test:rules -> PASS
```
