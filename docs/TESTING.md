# Testing Strategy

This document explains ScoutZero's testing organization, test types, and how to run tests effectively.

---

## Table of Contents

- [Overview](#overview)
- [Test Organization](#test-organization)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Requirements](#test-requirements)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)

---

## Overview

ScoutZero uses **Vitest** as the test runner with two distinct configurations:

1. **Standard Tests** (`vitest.config.js`) - Unit and integration tests with mocked Firebase
2. **Emulator Tests** (`vitest.emulator.config.js`) - E2E tests against real Firebase emulator

---

## Test Organization

### Standard Tests (`vitest.config.js`)

**Configuration:**

- **Environment**: `jsdom` (browser simulation)
- **Setup Files**:
  - `tests/setupFirebaseMocks.js` - Mocks Firebase/Firestore
  - `tests/setupDebug.js` - Debug logging utilities
- **Exclusions**: `*.emulator.test.*` files (run separately)

**Test Locations:**

#### `/tests` - Core Business Logic Tests

Primary location for pure function tests and business logic:

- `contractParser.test.js` - Contract parsing logic
- `contractYears.test.js` - Contract year calculations
- `rankingEngine.test.js` - Player ranking algorithms
- `salaryMatchingRules.test.js` - Salary matching validation
- `trade/` - Trade machine validation tests:
  - `salaryMatching.test.js` - Salary matching rules
  - `firstApron_100pct.test.js` - First apron restrictions
  - `secondApron_handcuffs.test.js` - Second apron restrictions
  - `signAndTrade_completeness.test.js` - Sign & trade rules
  - `stepienRule.test.js` - Draft pick protections
  - Many more CBA compliance tests...

#### `/src/tests` - Integration & Component Tests

Tests for React components and feature integration:

- `stripUndefinedDeep.test.js` - Utility function tests
- `roster/rosterBuilderUtils.test.ts` - Roster building logic
- `trade/` - Trade machine integration tests:
  - `goldenTrades.test.js` - Known-good trade scenarios
  - `tradeSnapshotWiring.test.js` - Trade snapshot functionality
  - `TradeValidationGating.guardrail.test.jsx` - Validation flow
- `entitlements/` - Draft pick entitlement tests
- `scouting/` - Scouting feature tests
- `architect/` - GM dashboard tests

**Naming Convention:**

- `.guardrail.test.js` - Critical invariant tests (must never fail)
- `.test.js` / `.test.ts` - Standard tests

### Emulator Tests (`vitest.emulator.config.js`)

**Configuration:**

- **Environment**: `node` (not jsdom - true E2E)
- **Setup Files**: `tests/setupDebug.js` only (NO Firebase mocks)
- **Include Pattern**: `**/*.emulator.test.{js,ts}`
- **Timeout**: 30 seconds (longer for emulator operations)
- **Requirement**: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082` must be set

**Test Locations:**

- `/src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts`
- Any file matching `*.emulator.test.*` pattern

**Purpose:**

- Test actual Firebase/Firestore interactions
- Validate data persistence and queries
- E2E verification of mutation pipeline

---

## Running Tests

### All Standard Tests

```bash
npm test
```

Runs all tests except emulator tests (uses mocked Firebase).

### Watch Mode

```bash
npm test -- --watch
```

Automatically reruns tests on file changes.

### Specific Test File

```bash
npm test -- path/to/test.test.js
```

Example:

```bash
npm test -- tests/trade/salaryMatching.test.js
```

### Specific Test Suite or Test

```bash
npm test -- tests/trade/salaryMatching.test.js -t "should allow matching salaries"
```

### Emulator Tests

**Prerequisites:**

1. Firebase emulator must be running:

   ```bash
   firebase emulators:start
   ```

   Or use the exec wrapper (recommended):

   ```bash
   npm run emulators:exec -- "npm run test:emulator"
   ```

**Run emulator tests:**

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 vitest run --config vitest.emulator.config.js
```

**Specific emulator tests:**

```bash
npm run ci:phaseD4-dare-emulator-gate
# or
npm run verify:draft-assets:emu
```

### Test Coverage

```bash
npm test -- --coverage
```

Generates coverage report in `coverage/` directory.

### Clear Test Cache

If tests behave unexpectedly:

```bash
npm test -- --clearCache
```

---

## Writing Tests

### Where to Put Tests

Follow this decision tree:

1. **Pure business logic** (no React, no Firebase) → `/tests/unit/`
   - Example: Contract parsing, salary calculations, date utilities

2. **Trade machine validation** → `/tests/trade/`
   - Example: CBA compliance, salary matching, apron restrictions

3. **React components** → `/src/tests/components/`
   - Example: UI components, hooks, state management

4. **Feature integration** → `/src/tests/{feature}/`
   - Example: `/src/tests/trade/`, `/src/tests/roster/`, `/src/tests/scouting/`

5. **Firebase E2E** → `*.emulator.test.ts` (anywhere, but prefer `/src/tests/`)
   - Example: Firestore queries, mutations, data persistence

### Test File Naming

- **Standard tests**: `{module}.test.{js|ts}`
- **Guardrail tests** (critical): `{module}.guardrail.test.{js|ts}`
- **Emulator tests**: `{module}.emulator.test.{js|ts}`

### Test Structure

```javascript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '../path/to/module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should do something specific', () => {
      // Arrange
      const input = { /* ... */ };

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should handle edge case', () => {
      // ...
    });
  });
});
```

### Mocking Firebase (Standard Tests)

Firebase is automatically mocked via `tests/setupFirebaseMocks.js`. Access mocks:

```javascript
import { mockFirestore } from '../tests/setupFirebaseMocks';

it('should query Firestore', async () => {
  // Mock data is already set up
  const result = await someFunction();
  expect(result).toBeDefined();
});
```

### Testing with Real Emulator

For emulator tests, ensure `FIRESTORE_EMULATOR_HOST` is set:

```javascript
// phaseD4.emulator.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { getFirestore } from 'firebase/firestore';

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be set');
  }
});

it('should persist data to Firestore', async () => {
  const db = getFirestore();
  // Test with real emulator
});
```

---

## Test Requirements

### Before Committing

All of these must pass:

```bash
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
npm test           # All standard tests
```

### Before Pull Request

In addition to commit requirements:

1. ✅ All new features have tests
2. ✅ All bug fixes include regression tests
3. ✅ Emulator tests pass (if applicable)
4. ✅ No console warnings or errors
5. ✅ Test coverage doesn't decrease

### For New Features

- **Unit tests** for business logic
- **Integration tests** for feature interaction
- **Component tests** for React components (if applicable)
- **Emulator tests** for Firestore interactions (if applicable)

### For Bug Fixes

- **Regression test** that reproduces the bug
- Test should **fail before fix**, **pass after fix**
- Add to existing test suite or create new file

---

## CI/CD

### Automated Test Runs

Tests run automatically on:

- Every push to any branch
- Every pull request
- Before deployment to production

### CI Test Scripts

The following scripts are run in CI:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Standard tests
npm test

# Emulator tests (select critical tests)
npm run ci:phaseD4-dare-emulator-gate
```

### Test Gates

**Pull Request Gates:**

- All tests must pass
- No TypeScript errors
- No ESLint errors
- Coverage threshold met (if configured)

**Deployment Gates:**

- All PR gates pass
- Additional emulator tests pass
- Manual smoke tests complete (see [runbooks/MANUAL_SMOKE_TEST_CHECKLIST.md](runbooks/MANUAL_SMOKE_TEST_CHECKLIST.md))

---

## Troubleshooting

### Common Issues

#### ESLint/Prettier Conflicts in Tests

If linter complains about test files:

```bash
npm run lint -- --fix
```

#### Firebase Mock Not Working

Clear cache and reinstall:

```bash
npm test -- --clearCache
rm -rf node_modules
npm install
```

#### Emulator Tests Failing

1. **Check emulator is running:**

   ```bash
   firebase emulators:start
   ```

2. **Verify environment variable:**

   ```bash
   echo $FIRESTORE_EMULATOR_HOST
   # Should output: 127.0.0.1:8082
   ```

3. **Check emulator port:**
   Default is 8082 for Firestore. Verify in `firebase.json`.

#### Tests Timing Out

Increase timeout in specific test:

```javascript
it('slow test', async () => {
  // ...
}, 10000); // 10 second timeout
```

Or in `vitest.config.js`:

```javascript
test: {
  testTimeout: 10000
}
```

#### Import Path Issues

Tests use the `@/` alias to reference `/src`:

```javascript
import { someUtil } from '@/utils/someUtil';
```

If alias doesn't work, check `vitest.config.js` resolve configuration.

---

## Test Categories Summary

| Category | Location | Environment | Firebase | Purpose |
|----------|----------|-------------|----------|---------|
| **Unit Tests** | `/tests` | jsdom | Mocked | Business logic |
| **Trade Tests** | `/tests/trade` | jsdom | Mocked | CBA compliance |
| **Integration** | `/src/tests` | jsdom | Mocked | Feature integration |
| **Component** | `/src/tests` | jsdom | Mocked | React components |
| **Emulator E2E** | `*.emulator.test.*` | node | Real | Firestore E2E |

---

## Best Practices

1. **Test behavior, not implementation** - Test what the code does, not how it does it
2. **Keep tests isolated** - Each test should be independent
3. **Use descriptive names** - Test names should explain what is being tested
4. **Arrange-Act-Assert** - Structure tests clearly
5. **Don't mock unnecessarily** - Only mock external dependencies
6. **Test edge cases** - Especially for CBA compliance (aprons, Stepien Rule, etc.)
7. **Guardrail tests are sacred** - Never skip or ignore guardrail test failures

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library (for React)](https://testing-library.com/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Project Developer Guide](guides/DEVELOPER_GUIDE.md)

---

**Last Updated**: February 12, 2026
**Maintainers**: See [CONTRIBUTING.md](CONTRIBUTING.md)
