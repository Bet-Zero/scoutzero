# C2 Runtime Proof Log

## Mandatory Minimum Commands

### 1) Typecheck
- Command: `npm run typecheck`
- Runtime: `41s`
- Exit: `0`
- Output excerpt:
  - `> scoutzero@1.0.0 typecheck`
  - `> tsc --noEmit`
- Evidence file: `return_packages/architect/audit/C_stageC_typecheck.log`

### 2) Build
- Command: `npm run build`
- Runtime: `58s`
- Exit: `0`
- Output excerpt:
  - `vite v4.5.14 building for production...`
  - `✓ 3071 modules transformed.`
  - `(!) Some chunks are larger than 500 kBs after minification.`
  - `✓ built in 56.39s`
- Evidence file: `return_packages/architect/audit/C_stageC_build.log`

### 3) Diff Tests
- Command: `npm run test:diff -- --reporter=dot`
- Runtime: `29s`
- Exit: `0`
- Output excerpt:
  - `No changed files detected`
  - `Running fast tests as fallback`
  - `Test Files 4 passed (4)`
  - `Tests 21 passed (21)`
- Evidence file: `return_packages/architect/audit/C_stageC_test_diff.log`

## Additional Scoped Proof (Discovered Script Exists)

### 4) Architect Scoped Suite
- Command: `npm run test:architect -- --reporter=dot`
- Runtime: `71s`
- Exit: `1`
- Output excerpt:
  - `❯ src/tests/architect/offseason.devGate.guardrail.test.ts:76:22`
  - `expect(source).toContain('Use World Season Advance to persist')`
  - `Test Files 1 failed | 166 passed (167)`
  - `Tests 1 failed | 2453 passed (2454)`
- Evidence file: `return_packages/architect/audit/C_stageC_test_architect.log`

### 5) Trade Scoped Suite
- Command: `npm run test:trade -- --reporter=dot`
- Runtime: `23s`
- Exit: `0`
- Output excerpt:
  - `Test Files 58 passed (58)`
  - `Tests 537 passed (537)`
- Evidence file: `return_packages/architect/audit/C_stageC_test_trade.log`

## Full-Suite Authorization Guard
- Full suite (`npm run test`, `npm run test:full`) not run.
- Authorization flag: `FULL_TEST_SUITE_AUTHORIZED = NO`.
