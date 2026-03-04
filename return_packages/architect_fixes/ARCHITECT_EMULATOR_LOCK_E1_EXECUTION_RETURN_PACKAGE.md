# ARCHITECT_EMULATOR_LOCK_E1 — Execution Return Package

Date: 2026-03-04  
Mode: EXECUTION  
Status: ✅ COMPLETE

## Summary + Why

This change locks the client app to Firebase emulators in DEV with fail-closed behavior so development cannot silently talk to production Firestore. It also adds a visible UI mode indicator and an emulator-unavailable warning banner to remove ambiguity during architect workflows.

## Files Changed

- `src/firebaseConfig.js`
- `src/features/architect/GMDashboard/GMDashboard.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/tests/security/architectClientEmulatorLock.guardrail.test.ts`
- `package.json`
- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- `return_packages/architect_fixes/ARCHITECT_EMULATOR_LOCK_E1_EXECUTION_RETURN_PACKAGE.md`

## How Target Mode Is Decided

SSOT is `getFirebaseTargetMode()` in `src/firebaseConfig.js`.

Decision rules:

1. If `import.meta.env.DEV` is true -> `EMULATOR`
2. If `VITE_USE_FIREBASE_EMULATORS=true` -> `EMULATOR`
3. Otherwise -> `PROD`

Safety behavior:

- DEV does not silently flip to PROD.
- If emulator mode is active but required emulator endpoints are missing, app init throws fail-closed.

## Where Emulator Host/Ports Come From

In `src/firebaseConfig.js`, emulator endpoint resolution is:

1. Env vars (preferred):
   - `VITE_FIRESTORE_EMULATOR_HOST` / `VITE_FIRESTORE_EMULATOR_PORT`
   - `VITE_AUTH_EMULATOR_HOST` / `VITE_AUTH_EMULATOR_PORT`
   - `VITE_FUNCTIONS_EMULATOR_HOST` / `VITE_FUNCTIONS_EMULATOR_PORT`
   - `VITE_STORAGE_EMULATOR_HOST` / `VITE_STORAGE_EMULATOR_PORT`
2. Fallback to `firebase.json`:
   - `emulators.firestore` (`127.0.0.1:8082`)
   - `emulators.auth` (`127.0.0.1:9099`)
   - `emulators.functions` (`127.0.0.1:5001`)
   - `emulators.storage` (when present)

## UI Badge/Banner (Description)

Location: `src/features/architect/GMDashboard/GMDashboard.jsx`

- New deterministic badge in dashboard header:
  - `EMULATOR MODE` when target mode is emulator
  - `PROD MODE` when target mode is production
- New fail-closed banner when emulator-mode connection-style errors are detected:
  - `Emulator mode: Firebase emulators not detected. Start them with: npm run emu`

## Guardrails Added

New deterministic source guardrail test:

- `src/tests/security/architectClientEmulatorLock.guardrail.test.ts`

Covers:

1. Firestore emulator port remains `127.0.0.1:8082` in `firebase.json`
2. DEV target mode resolves to emulator in Firebase init path
3. Client init path contains emulator connector calls (Firestore/Auth/Functions)
4. No legacy `8080` in client Firebase init path
5. `npm run dev` is pinned to emulator mode env
6. UI includes target mode badge and emulator warning banner strings

## Required Command Outputs (Exact Order)

### 1) `npm run validate:project`

Result: **PASS**

```text
✅ All validations passed!
```

### 2) `npm run build`

Result: **PASS**

```text
✓ built in 41.56s
```

### 3) `npm run test:trade -- --reporter=dot`

Result: **PASS**

```text
Test Files  58 passed (58)
Tests  532 passed | 1 skipped | 3 todo (536)
```

### 4) `npm run test:architect -- --reporter=dot`

Result: **PASS**

```text
Test Files  167 passed (167)
Tests  2449 passed | 1 skipped | 3 todo (2453)
```

## Acceptance Criteria Mapping

- **AC1 — Dev always uses emulators:** PASS
- **AC2 — No silent prod fallback:** PASS
- **AC3 — Visible mode indicator:** PASS
- **AC4 — Guardrails exist:** PASS
- **AC5 — Repo gates pass:** PASS

## Changed Files (Final)

- `src/firebaseConfig.js`
- `src/features/architect/GMDashboard/GMDashboard.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/tests/security/architectClientEmulatorLock.guardrail.test.ts`
- `package.json`
- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- `return_packages/architect_fixes/ARCHITECT_EMULATOR_LOCK_E1_EXECUTION_RETURN_PACKAGE.md`
