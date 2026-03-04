# ARCHITECT_SMOKE_E1 — Execution Return Package

Date: 2026-03-04  
Mode: EXECUTION  
Status: ✅ COMPLETE

## Summary

Implemented a canonical emulator-first Architect UI smoke gate that fails closed when emulator is unreachable and validates world-mode render coherence across major surfaces.

New canonical command:

```bash
npm run smoke:architect
```

This command now runs (fail-fast):

1. `npm run gates:architect`
2. `npm run test:smoke:architect`

## Files Changed

- `src/tests/smoke/architect.uiSmoke.e1.test.tsx` (NEW)
- `vitest.smoke.config.js` (NEW)
- `scripts/ci/run_architect_smoke_e1.mjs` (NEW)
- `docs/architect/ARCHITECT_SMOKE_MASTER.md` (NEW)
- `package.json`
- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`

## What Smoke Proves

`src/tests/smoke/architect.uiSmoke.e1.test.tsx` proves all required surfaces render without crash in world-mode smoke context:

1. GM Dashboard shell + mode badge (`EMULATOR MODE`)
2. Trade Machine surface
3. Cap Sheet surface
4. Free Agency surface
5. Team History timeline row + click opens detail modal (DEV fixture-driven)
6. Offseason world season-advance surface + DEV preview banner rendering

Notes:

- No Playwright used.
- Smoke is render-level only; mutation correctness remains covered by existing integration/rules suites.

## Mocks Used (and why acceptable)

- `useTradeMachine` mocked at hook boundary so Trade UI can render deterministically without Firestore dependency.
- `worldManager` read helpers (`getWorldMetadata`, `getDraftPositions`) mocked to avoid Firestore reads on mount in Offseason/Draft positions surfaces.
- `useArchitectState`, `useArchitectActions`, `useArchitectModals`, `usePlayerRulesProfiles`, `useAuth` mocked for dashboard shell smoke to avoid unrelated data loading while still rendering shipped shell UI.
- `ResizeObserver` polyfill added in test only for jsdom compatibility with Headless UI controls.

This preserves real shipped section components while mocking only boundary dependencies needed to keep smoke deterministic and emulator-safe.

## Acceptance Criteria Mapping

1. ✅ `npm run smoke:architect` exists as single canonical smoke command
2. ✅ Fails closed on emulator unreachable (`Start emulators with: npm run emu`)
3. ✅ Smoke suite renders all required surfaces
4. ✅ Team History row -> click -> detail modal opens (fixture-driven)
5. ✅ No Playwright used
6. ✅ No production targeting risk introduced (emulator preflight + existing gates/rules discipline)
7. ✅ `npm run gates:architect` passes in smoke chain
8. ✅ Docs updated (Ship master + Smoke master + Ledger)
9. ✅ Return package written at required path

## STOP Conditions Check

- Smoke runs without emulator and silently targets prod: **NO** (preflight hard-fails)
- Non-deterministic sleeps/timeouts required: **NO**
- Smoke writes to Firestore: **NO**
- New skip/todo introduced in Architect/Trade/Smoke suites: **NO**
- Security rules / emulator lock weakened: **NO**

## Validation Commands + Outputs

### 1) `npm run validate:project`

```text
> scoutzero@1.0.0 validate:project
> tsx scripts/validate-project-schema.ts
...
VALIDATION SUMMARY
============================================================
✅ All validations passed!
```

### 2) `npm run build`

```text
> scoutzero@1.0.0 build
> vite build
...
✓ built in 1m 9s
```

### 3) `npm run typecheck`

```text
> scoutzero@1.0.0 typecheck
> tsc --noEmit
```

### 4) `npm run test:trade -- --reporter=dot`

```text
> scoutzero@1.0.0 test:trade
> vitest run -c vitest.node.config.js tests/trade --reporter=dot
...
Test Files  58 passed (58)
Tests  537 passed (537)
Duration  56.81s
```

### 5) `npm run test:architect -- --reporter=dot`

```text
> scoutzero@1.0.0 test:architect
> vitest run -c vitest.node.config.js tests/architect src/tests/architect src/tests/tradeMachine --reporter=dot
...
Test Files  167 passed (167)
Tests  2454 passed (2454)
Duration  235.78s
```

### 6) `npm run test:rules`

```text
> scoutzero@1.0.0 test:rules
> cross-env FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/ci/run_rules_integration_tests.mjs
...
Test Files  1 passed (1)
Tests  16 passed (16)
Duration  12.30s
```

(First attempt timed out during emulator warm-up; immediate re-run passed and is the final evidence run above.)

### 7) `npm run test:smoke:architect`

```text
> scoutzero@1.0.0 test:smoke:architect
> vitest --config vitest.smoke.config.js --run --reporter=dot

 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero

stderr | src/tests/smoke/architect.uiSmoke.e1.test.tsx > ARCHITECT_SMOKE_E1: emulator-first world-mode UI smoke > renders Offseason world surface and season advance controls
Warning: DraftPositionsInput: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.
Warning: OffseasonTab: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.
Warning: SeasonAdvanceModal: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.

······

Test Files  1 passed (1)
Tests  6 passed (6)
Start at  06:18:30
Duration  14.85s (transform 3.16s, setup 0ms, collect 9.07s, tests 1.28s, environment 1.90s, prepare 1.49s)
```

### 8) `npm run smoke:architect`

```text
> scoutzero@1.0.0 smoke:architect
> node scripts/ci/run_architect_smoke_e1.mjs

[ARCHITECT_SMOKE_E1] (1/2) npm run gates:architect
...
Test Files  1 passed (1)
Tests  16 passed (16)
[ARCHITECT_GATES_E2] PASS: all required ship gates completed.

[ARCHITECT_SMOKE_E1] (2/2) npm run test:smoke:architect

> scoutzero@1.0.0 test:smoke:architect
> vitest --config vitest.smoke.config.js --run --reporter=dot

 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero

stderr | src/tests/smoke/architect.uiSmoke.e1.test.tsx > ARCHITECT_SMOKE_E1: emulator-first world-mode UI smoke > renders Offseason world surface and season advance controls
Warning: DraftPositionsInput: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.
Warning: OffseasonTab: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.
Warning: SeasonAdvanceModal: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.

······

Test Files  1 passed (1)
Tests  6 passed (6)
Start at  06:25:09
Duration  13.04s (transform 2.96s, setup 0ms, collect 8.03s, tests 725ms, environment 1.65s, prepare 1.78s)

[ARCHITECT_SMOKE_E1] PASS: all smoke gates completed.
```

## Product Code Touch Check

Yes — product code was **not** changed for runtime behavior. Changes were limited to:

- tests (`src/tests/smoke/architect.uiSmoke.e1.test.tsx`)
- test config (`vitest.smoke.config.js`)
- CI/gate script (`scripts/ci/run_architect_smoke_e1.mjs`)
- docs/ledger updates
- script wiring in `package.json`
