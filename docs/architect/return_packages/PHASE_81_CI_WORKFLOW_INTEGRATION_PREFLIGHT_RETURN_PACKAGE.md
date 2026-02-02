# PHASE 81 — CI Workflow Integration Preflight Return Package

**Date:** 2026-02-02  
**Phase:** 81  
**Mode:** PREFLIGHT (discovery only)  
**Status:** ✅ COMPLETE

---

## Summary

This preflight phase audited the repository's CI/CD configuration to determine how to integrate the Phase 69 and Phase 80 proof harnesses into automated CI workflows. All acceptance criteria have been met — the CI system has been identified, emulator requirements documented, and a concrete integration plan has been prepared for Phase 82 execution.

---

## Task A — CI System & Entry Files

### CI Provider

| Attribute | Value |
|-----------|-------|
| **Provider** | GitHub Actions |
| **Config Location** | `.github/workflows/` |
| **Primary Trigger** | Push to `main`, PRs to `main`, `copilot/**` branches |

### Workflow Files

| File | Purpose | Triggers | Jobs |
|------|---------|----------|------|
| [ci.yml](file:///Users/brenthibbitts/Desktop/ScoutZero/.github/workflows/ci.yml) | **Primary CI** | Push to `main`, `copilot/**`; PRs to `main` | `validate` (build, test, validate) |
| [audit.yml](file:///Users/brenthibbitts/Desktop/ScoutZero/.github/workflows/audit.yml) | Audit doc changes | Push to `docs/AUDIT_DEEP.md`; manual | `test` |
| [player-scrape-regression.yml](file:///Users/brenthibbitts/Desktop/ScoutZero/.github/workflows/player-scrape-regression.yml) | Player scrape regression | Path-scoped: `player-scrape/contracts/**`; manual | `regression-tests` |
| [ci.yml.local-backup](file:///Users/brenthibbitts/Desktop/ScoutZero/.github/workflows/ci.yml.local-backup) | Local backup (inactive) | N/A | N/A |

### Primary Workflow Summary: `ci.yml`

```yaml
jobs:
  validate:
    name: Build, Test & Validate
    runs-on: ubuntu-latest
    steps:
      - Checkout code (actions/checkout@v4)
      - Setup Node.js 18 (actions/setup-node@v4)
      - Install dependencies (PUPPETEER_SKIP_DOWNLOAD=true npm ci)
      - Type check (npm run typecheck) [continue-on-error: true]
      - Run tests (npm run test -- --run)
      - Validate project schema (npm run validate:project)
```

> [!NOTE]
> The primary `ci.yml` workflow runs on every PR and push to `main`. It currently runs unit tests via `npm run test -- --run` but does **not** start any Firebase emulators.

---

## Task B — Emulator Strategy

### Current Emulator Usage in CI

| Question | Finding |
|----------|---------|
| Does CI currently start emulators? | **NO** |
| `firebase emulators:start` in workflows? | Not used |
| `firebase emulators:exec` in workflows? | Not used |
| `FIRESTORE_EMULATOR_HOST` in workflows? | Not set |

### Local Emulator Setup (for reference)

The repo has a robust local emulator setup:

| Component | Details |
|-----------|---------|
| **Entry script** | `npm run emu` → [runEmu.ts](file:///Users/brenthibbitts/Desktop/ScoutZero/scripts/emu/runEmu.ts) |
| **Emulator config** | [firebase.json](file:///Users/brenthibbitts/Desktop/ScoutZero/firebase.json) |
| **Firestore port** | `8082` (host: `127.0.0.1`) |
| **Auth port** | `9099` |
| **Functions port** | `5001` |
| **UI port** | `4000` |
| **Data persistence** | `.emulator-data/` directory |
| **Auto-seed** | `seedIfMissing.ts` runs after emulator starts |

### firebase-tools Dependency Status

| Location | Status |
|----------|--------|
| `package.json` dependencies | ❌ Not listed |
| `package.json` devDependencies | ❌ Not listed |
| Expected installation | Global or ad-hoc in CI |

> [!IMPORTANT]  
> `firebase-tools` must be installed in CI to start emulators. This requires either adding it to `devDependencies` or installing it ad-hoc in the workflow.

### Recommended Emulator Approach for CI

**Option A: `firebase emulators:exec` (RECOMMENDED)**

```yaml
- name: Run emulator-backed proof harness
  run: |
    npx firebase emulators:exec \
      --project demo-scoutzero \
      --only firestore \
      "npm run ci:phase69-proof && npm run ci:phase80-cap-proof"
```

**Rationale:**

- Single command handles start/stop lifecycle — no background process management
- No `wait-on` or port polling needed
- Clean exit on success/failure
- Matches existing repo pattern in docs (Phase 10 return package mentions `emulators:exec`)
- Uses `--only firestore` to minimize startup time (no auth/functions needed for proof jobs)
- Uses `demo-scoutzero` project ID (emulator-safe, no production credentials)

**Option B: Background emulator + wait-on (NOT recommended)**

```yaml
- name: Start emulator
  run: npm run emu &
- name: Wait for emulator
  run: npx wait-on tcp:8082 -t 60000
- name: Run proof harness
  env:
    FIRESTORE_EMULATOR_HOST: 127.0.0.1:8082
  run: npm run ci:phase69-proof && npm run ci:phase80-cap-proof
```

**Why not Option B:**

- Requires additional `wait-on` dependency
- Background process management is error-prone
- Emulator may not shut down cleanly on job failure
- More complex debugging

---

## Task C — Recommended Integration Point

### Current CI Job Structure

```
ci.yml
└── jobs:
    └── validate:
        ├── Checkout
        ├── Setup Node.js
        ├── Install dependencies
        ├── Type check
        ├── Run tests
        └── Validate project schema
```

### Proposed CI Job Structure

**Option 1: Extend existing `validate` job (RECOMMENDED)**

```
ci.yml
└── jobs:
    └── validate:
        ├── Checkout
        ├── Setup Node.js
        ├── Install dependencies
        ├── Type check
        ├── Run tests
        ├── Validate project schema
        └── ⚡ Run emulator-backed proof harness (NEW)
```

**Rationale:**

- Minimal workflow changes
- Proof jobs run after unit tests pass (logical ordering)
- Single job = no added container startup time
- Fails fast if unit tests fail

**Option 2: Dedicated proof job (alternative)**

```
ci.yml
└── jobs:
    ├── validate: (existing)
    │   └── ...
    └── proof-harness: (NEW)
        ├── needs: validate
        ├── Checkout
        ├── Setup Node.js
        ├── Install dependencies
        └── Run emulator-backed proof harness
```

**When to prefer Option 2:**

- If proof jobs become slow (>5 min) and you want parallel execution with other jobs
- If proof jobs have different failure semantics (e.g., warnings vs. blockers)

> [!TIP]
> Start with Option 1. Refactor to Option 2 only if proof job duration becomes problematic.

---

## Task D — Proof Command Requirements

### Proof Scripts in package.json

| Script | Command | Line |
|--------|---------|------|
| `ci:phase69-proof` | `node scripts/ci/run_phase69_tpe_migration_proof.js` | 114 |
| `ci:phase80-cap-proof` | `node scripts/ci/run_phase80_cap_sheet_e2e_proof.js` | 115 |

### Environment Requirements

| Variable | Required Value | Purpose |
|----------|---------------|---------|
| `FIRESTORE_EMULATOR_HOST` | `127.0.0.1:8082` | Tells proof scripts to connect to emulator |

> [!NOTE]
> When using `firebase emulators:exec`, this env var is **automatically set** by the Firebase CLI. No explicit `env:` block needed.

### Production Safety Checks

Both proof scripts implement production refusal:

**Phase 69 script** ([run_phase69_tpe_migration_proof.js](file:///Users/brenthibbitts/Desktop/ScoutZero/scripts/ci/run_phase69_tpe_migration_proof.js)):

```javascript
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('[CI ERROR] FIRESTORE_EMULATOR_HOST is not set.');
  // ... exits with code 1
}
```

**Phase 80 script** ([run_phase80_cap_sheet_e2e_proof.js](file:///Users/brenthibbitts/Desktop/ScoutZero/scripts/ci/run_phase80_cap_sheet_e2e_proof.js)):

```javascript
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  // ... exits with code 1
}

// Additional safety: block if GOOGLE_APPLICATION_CREDENTIALS implies prod
if (
  process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  !process.env.FIRESTORE_EMULATOR_HOST
) {
  // ... exits with code 1
}
```

### CI Env Safety Note

| Risk | Mitigation |
|------|------------|
| Repository secrets containing `GOOGLE_APPLICATION_CREDENTIALS` | ✅ SAFE: Phase 80 script only blocks if `GOOGLE_APPLICATION_CREDENTIALS` is set **without** `FIRESTORE_EMULATOR_HOST`. When `emulators:exec` sets `FIRESTORE_EMULATOR_HOST`, the check passes. |
| Accidental production Firestore writes | ✅ SAFE: Using `demo-scoutzero` project ID which has no associated production project. Additionally, emulator does not connect to production regardless of env vars. |
| CI workflow exposing secrets | ✅ SAFE: No secrets needed for proof jobs. They run entirely against in-memory emulator state. |

---

## Phase 82 Execution Plan

### Exact Edit Targets

| File | Location | Change |
|------|----------|--------|
| [ci.yml](file:///Users/brenthibbitts/Desktop/ScoutZero/.github/workflows/ci.yml) | After line 41 (`npm run validate:project`) | Add new step for emulator proof harness |

### Proposed New Step

```yaml
      - name: Run emulator-backed proof harness
        run: |
          npx firebase emulators:exec \
            --project demo-scoutzero \
            --only firestore \
            "npm run ci:phase69-proof && npm run ci:phase80-cap-proof"
```

### Step-by-Step Phase 82 Checklist

1. [ ] **Add step to ci.yml**
   - After `Validate project schema` step
   - Use `firebase emulators:exec` wrapper
   - Chain both proof commands

2. [ ] **Verify firebase-tools availability in CI**
   - `npx firebase` should work (installs from npm registry)
   - If slow, consider adding `firebase-tools` to devDependencies

3. [ ] **Test locally**
   - Run: `npx firebase emulators:exec --project demo-scoutzero --only firestore "npm run ci:phase69-proof && npm run ci:phase80-cap-proof"`
   - Verify exit code 0

4. [ ] **Open PR with workflow change**
   - Monitor GitHub Actions for first run
   - Verify emulator starts and stops cleanly
   - Verify proof jobs pass

5. [ ] **Document in return package**
   - Capture CI run link
   - Note any timing observations

---

## Risks & Gotchas

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Emulator startup time** | Medium | Use `--only firestore` to skip auth/functions. Expect ~10-20s added. |
| **Port conflicts** | Low | Ubuntu runners are clean per-job. No persistent ports. |
| **firebase-tools version drift** | Low | `npx firebase` uses latest. Pin version if issues arise. |
| **Proof job timeout** | Low | Current proof scripts complete in <30s. GitHub Actions default timeout is 6 hours. |
| **Data seeding in CI** | Low | Proof scripts seed their own data. No need for `.emulator-data/` import. |

---

## Stop Conditions Evaluation

| Condition | Status | Notes |
|-----------|--------|-------|
| **STOP-1**: No CI configs exist | ❌ Not triggered | GitHub Actions found at `.github/workflows/` |
| **STOP-2**: CI is not GitHub Actions | ❌ Not triggered | Confirmed GitHub Actions |
| **STOP-3**: Emulator cannot be started | ❌ Not triggered | `firebase.json` exists, `firebase emulators:exec` available via npx |
| **STOP-4**: Proof scripts require app alias | ❌ Not triggered | Proof scripts use direct Node imports, no Vite aliases |

---

## Acceptance Criteria Verification

| AC | Description | Status |
|----|-------------|--------|
| AC1 | Identify CI provider + all workflow files | ✅ GitHub Actions, 3 active workflows documented |
| AC2 | Determine emulator usage exists today | ✅ No emulator usage in CI; recommended `emulators:exec` approach |
| AC3 | Propose exactly where proof steps should be added | ✅ ci.yml, after `validate:project` step |
| AC4 | Verify proof commands + env requirements | ✅ Both scripts exist, require `FIRESTORE_EMULATOR_HOST`, have prod safety |
| AC5 | Write preflight return package | ✅ This document |

---

## References

- [ci.yml](file:///Users/brenthibbitts/Desktop/ScoutZero/.github/workflows/ci.yml)
- [firebase.json](file:///Users/brenthibbitts/Desktop/ScoutZero/firebase.json)
- [run_phase69_tpe_migration_proof.js](file:///Users/brenthibbitts/Desktop/ScoutZero/scripts/ci/run_phase69_tpe_migration_proof.js)
- [run_phase80_cap_sheet_e2e_proof.js](file:///Users/brenthibbitts/Desktop/ScoutZero/scripts/ci/run_phase80_cap_sheet_e2e_proof.js)
- [runEmu.ts](file:///Users/brenthibbitts/Desktop/ScoutZero/scripts/emu/runEmu.ts)
- [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md)
- [PERSISTENCE_CONTRACTS.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/contracts/PERSISTENCE_CONTRACTS.md)
