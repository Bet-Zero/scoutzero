# Development & Testing Utilities

This folder contains scripts used for development, testing, and debugging. These are **not part of the main production pipeline** but are useful for:

- Regression testing
- Capturing API snapshots for testing
- Generating test fixtures

## Scripts

- **`run_regress.ts`** - Runs regression tests against fixtures
- **`capture_snapshot.ts`** - Captures NBA API responses for testing
- **`generate_fixture.ts`** - Generates expected output fixtures from snapshots
- **`test_utils.ts`** - Shared test helper functions

## Usage

See `TESTING.md` in the parent directory for detailed usage instructions.

