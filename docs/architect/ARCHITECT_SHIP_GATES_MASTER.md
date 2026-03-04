# Architect Ship Gates Master

**Last updated:** 2026-03-04
**Status:** FULL PASS — security gate closed; ship-ready rules in place

---

## Ship Definition

### What "v1 Shipped" Includes

- **World Mode**: Users can create worlds, select teams, and perform GM actions that persist to Firestore under `architect_worlds/{worldId}/...`
- **Trade Machine**: Full CBA-compliant trade validation + execution with salary matching, apron enforcement, Stepien rule, TPE creation/consumption, entitlement routing
- **Cap Sheet**: Real-time cap totals SSOT, dead money, exception management, buyout/stretch, incomplete roster charges
- **Free Agency**: Sign free agents, sign-and-trade, offer sheets, rights/holds management, exception eligibility
- **Team History**: Transaction-log quality timeline from canonical world events with structured detail sections, pagination (50-item limit + load more)
- **Offseason (World-Wide)**: Season advance with OSTE computation, TPE expiry, DARE entitlement lifecycle, draft position configuration
- **Persistence Contract**: Atomic batch writes with fail-closed success requiring events + metadata + teams all written

### What "v1 Shipped" Excludes

- **Single-team offseason preview**: DEV-gated, local-state-only — not part of production surface
- **Team History fixtures panel**: DEV-gated, in-memory only
- **Entitlement authoring admin**: Feature-flagged (`VITE_FEATURE_ENTITLEMENT_AUTHORING`)
- **Multi-user collaboration**: Single-user worlds only (no sharing, no concurrent editing)
- **Multi-user world collaboration ACLs**: Not included in v1 (owner-only world access)

---

## Ship Gate Summary

| Gate | Area                             | Status   | Review                |
| ---- | -------------------------------- | -------- | --------------------- |
| A1   | Create world flow                | **PASS** | SHIP_GATES_R1_LOCAL   |
| A2   | Select world + load team         | **PASS** | SHIP_GATES_R1_LOCAL   |
| A3   | Refresh shows persisted state    | **PASS** | SHIP_GATES_R1_LOCAL   |
| B4   | DEV-only paths gated             | **PASS** | SHIP_GATES_R1_LOCAL   |
| B5   | Preview UI labeled               | **PASS** | SHIP_GATES_R1_LOCAL   |
| C6   | Success only on persistence      | **PASS** | SHIP_GATES_R1_LOCAL   |
| D7   | World events + history rendering | **PASS** | SHIP_GATES_R1_LOCAL   |
| E8   | No root/base writes              | **PASS** | SHIP_GATES_R1_LOCAL   |
| E9   | Base reads are read-only         | **PASS** | SHIP_GATES_R1_LOCAL   |
| E10  | Non-pipeline writes justified    | **PASS** | SHIP_GATES_R1_LOCAL   |
| F11  | Firestore rules enforced         | **PASS** | ARCHITECT_SECURITY_E1 |
| G12  | No unbounded listeners           | **PASS** | SHIP_GATES_R1_LOCAL   |
| G13  | History pagination               | **PASS** | SHIP_GATES_R1_LOCAL   |
| H14  | Deterministic evidence           | **PASS** | SHIP_GATES_R1_LOCAL   |

---

## Single Command

Run the canonical Architect ship gate command:

```bash
npm run gates:architect
```

This command executes all required gates in order and fails fast on first failure.

---

## Ship Blocker List

### Active Blockers

None.

### Resolved Blockers

| ID     | Severity | Description                                              | Resolution                                                      |
| ------ | -------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| SB-R01 | SEV-2    | Single-team offseason claims success without persistence | DEV-gated in OFFSEASON_E1                                       |
| SB-R02 | SEV-2    | Repository typecheck failures                            | Resolved in ARCH_P2                                             |
| SB-R03 | SEV-2    | World-mode persistence not proven E2E                    | Resolved in ARCH_P3 (emulator proof)                            |
| SB-R04 | SEV-1    | Firestore rules DEV-OPEN (`allow read, write: if true`)  | Replaced with fail-closed scoped rules in ARCHITECT_SECURITY_E1 |
| SB-R05 | SEV-2    | `architect_worlds` ownership access not enforced         | Owner-only `createdBy` rules deployed in ARCHITECT_SECURITY_E1  |
| SB-R06 | SEV-2    | Base collections lacked explicit client write deny       | Explicit write-deny added for all `architect_base*` collections |

---

## Security Rules: SHIP-READY (ARCHITECT_SECURITY_E1)

### Final Rules Posture

- Authentication is required for all non-public writes (`request.auth != null`).
- `architect_worlds/{worldId}` uses `createdBy` as ownership SSOT.
  - World metadata: owner-only read/write.
  - World subcollections: owner-only read/write for:
    - `teams/*`
    - `teams/*/players/*`
    - `events/*`
    - `entitlements/*`
    - Any additional world subcollections (owner-only recursive fallback).
- Explicit client write-deny is in place for:
  - `architect_basePlayers`
  - `architect_baseTeams`
  - `architect_baseEntitlements`
  - `architect_basePickRules`
  - root `teams`
- Global DEV-open wildcard has been removed.
- Fallback behavior is fail-closed (`match /{document=**} { allow read, write: if false; }`).

### Ownership Field Coverage

- World creation already writes `createdBy` in `src/features/architect/utils/worldManager.js` (`createWorld`).
- No additional product write-path changes were required for ownership compliance.

### Deterministic Verification Checklist (Emulator/Rules)

Run against Firestore emulator or staging rules environment after deploying updated rules:

1. Authenticate as user A (anonymous auth is sufficient).
2. Create world `W_A` with `createdBy = uidA`.
3. Verify user A can read/write:
   - `architect_worlds/W_A`
   - `architect_worlds/W_A/teams/LAL`
   - `architect_worlds/W_A/events/e1`
   - `architect_worlds/W_A/entitlements/ent1`
4. Authenticate as user B.
5. Verify user B is denied read/write to all `W_A` paths above.
6. Verify user A and B are both denied writes to:
   - `architect_basePlayers/*`
   - `architect_baseTeams/*`
   - `architect_baseEntitlements/*`
   - `architect_basePickRules/*`
   - `teams/*`
7. Verify no global allow exists in deployable `firestore.rules`.

### Dev Strategy (No Ship Rule Loosening)

- Do not reintroduce `allow read, write: if true` in deployable rules.
- For local-only experimentation, use a separate Firebase project/emulator seed flow rather than loosening shipped rules.

### Auth Assumptions

- The app uses Firebase Anonymous Auth for unauthenticated visitors
- `useAuth()` hook (`src/shared/hooks/useAuth.js`) provides `userId` to all components
- `worldManager.js` writes `createdBy: userId` at world creation
- `persistWorldMutation` does NOT currently enforce userId matching at the application layer — enforcement depends on Firestore rules

## Security Backfill (Required Once)

This backfill exists to safely migrate legacy docs that predate strict owner-only security rules.

- Why: ownerless legacy docs (`architect_worlds.createdBy`, `architect_worlds.worldId`, `lists.ownerUid`, `tierLists.ownerUid`) can become inaccessible under fail-closed owner rules.
- Scope: audit and backfill only `architect_worlds`, `lists`, and `tierLists`.
- Non-goal: no writes to root `teams` or any `architect_base*` collection.

### Commands

Run audit first (default dry-run, no writes):

```bash
npm run admin:security:audit
```

Apply only after audit review (explicit `--apply` command + explicit fallback UIDs when needed):

```bash
npm run admin:security:apply -- --defaultWorldOwnerUid <uid> --defaultListOwnerUid <uid>
```

### Environment / Admin Credentials

- Uses Firebase Admin SDK credentials from one of:
  1. `GOOGLE_APPLICATION_CREDENTIALS`, or
  2. `serviceAccountKey.json` in repo root.
- Recommended: verify service account project before apply runs.

### Safety Warnings

- Always run audit first.
- Apply mode is fail-safe and will stop (non-zero) if world docs are missing `createdBy` and `--defaultWorldOwnerUid` is not provided.
- Apply mode will also stop (non-zero) for ownerless `lists`/`tierLists` docs without inferable owner fields unless `--defaultListOwnerUid` is provided.

### ARCHITECT_SECURITY_E3 — Admin tooling targeting lock

Admin security backfill tooling is now emulator-first and fail-closed by default.

- Default target is Firestore emulator.
- Emulator host resolution order:
  1. `FIRESTORE_EMULATOR_HOST`
  2. `firebase.json` -> `emulators.firestore.host` + `emulators.firestore.port`
- If emulator target cannot be resolved, the script exits non-zero.
- If emulator is unreachable, the script exits non-zero and does not fallback to production.

Run commands:

```bash
npm run admin:security:audit
npm run admin:security:apply -- --defaultWorldOwnerUid <uid> --defaultListOwnerUid <uid>
```

If emulator is not running, expected error pattern:

```text
Firestore emulator not running on 127.0.0.1:8082. Start it with npm run emu.
```

Startup banner now prints targeting context each run:

- `Target` (EMULATOR)
- `Host` (`127.0.0.1:8082`)
- `Mode` (`DRY RUN` / `APPLY`)
- `ProjectId`

Explicit safety contract: this tool cannot hit prod silently.

Current E3 stance: prod mode is disabled for this script and exits fail-closed when `--prod` is passed.

### ARCHITECT_EMULATOR_LOCK_E1 — Client emulator lock (DEV fail-closed)

Client Firebase initialization is now emulator-first in DEV with explicit targeting indicators.

Guarantees:

- In `import.meta.env.DEV`, target mode resolves to `EMULATOR` by default.
- `VITE_USE_FIREBASE_EMULATORS=true` also forces emulator mode.
- There is no silent DEV fallback to production if emulator mode is selected.
- Firestore/Auth/Functions emulator connectors are wired in the shared Firebase init path.
- Emulator endpoint resolution uses env vars first, then `firebase.json` emulator host/port fallback.

DEV-safe run flow:

```bash
npm run emu
npm run dev
```

UI targeting indicators:

- Architect dashboard shows a deterministic mode badge:
  - `EMULATOR MODE` when target is emulator
  - `PROD MODE` when target is production
- If emulator mode is active and Firestore connection-style errors occur, UI shows:
  - `Emulator mode: Firebase emulators not detected. Start them with: npm run emu`

Explicit safety contract: when DEV target mode is emulator, this client path does not silently switch to production.

### ARCHITECT_QUALITY_GATES_E1 — Typecheck + Gate Hygiene Closure

Repository quality gates are now clean for the required Architect ship sequence.

Guarantees:

- `npm run typecheck` passes with zero errors.
- Core gate suites (`test:trade`, `test:architect`, `test:rules`) are required in the canonical ship chain.
- DEV-only fixture tooling remains explicitly gated behind DEV + local flags.

Required quality sequence executed in order and passing:

```bash
npm run validate:project
npm run build
npm run typecheck
npm run test:trade -- --reporter=dot
npm run test:architect -- --reporter=dot
npm run test:rules
```

Latest gate evidence:

- Trade suite: `58` files, `537` tests, all passed.
- Architect suite: `167` files, `2454` tests, all passed.

### ARCHITECT_RULES_INTEGRATION_E1 — Emulator-backed Firestore Rules Integration

Required ship gate to prove runtime Firestore rules behavior against the real emulator using `firestore.rules`.

What this gate proves:

- `architect_worlds/{worldId}` is strictly owner-only by `createdBy` (create/read/update expectations).
- World subcollections (`teams`, `events`, `entitlements`, `teams/*/players`) inherit owner-only behavior.
- Canonical/base write boundaries are enforced at runtime: client writes are denied to `architect_base*` and root `teams`.
- `lists` and `tierLists` are strict `ownerUid` owner-only resources with no auto-claim behavior.

Required gate command:

```bash
npm run test:rules
```

Emulator targeting contract:

- Command is emulator-first and pins `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082`.
- Preflight checks that emulator host:port is reachable before running tests.
- If emulator is not reachable, command exits non-zero with explicit guidance to run `npm run emu`.

Scope discipline:

- This rules integration suite is part of the canonical Architect ship gates command.
- Canonical command: `npm run gates:architect`.

### ARCHITECT_SMOKE_E1 — Emulator-first UI Smoke Gate

Final Architect DONE gate after `ARCHITECT_SHIP_GATES_E2` + `ARCHITECT_RULES_INTEGRATION_E1`.

What this gate proves (WORLD MODE render-level smoke):

- GM Dashboard shell boots and shows target mode badge.
- Trade Machine, Cap Sheet, Free Agency, Team History, and Offseason surfaces render without crash.
- Team History fixture timeline row opens detail modal on click.
- Offseason season-advance surface renders with DEV preview gate enabled for smoke-only rendering.

Canonical command:

```bash
npm run smoke:architect
```

Execution contract:

- Emulator-first and fail-closed: preflight requires Firestore emulator at `127.0.0.1:8082`.
- If emulator is unavailable, command exits non-zero with: `Start emulators with: npm run emu`.
- Fail-fast chain:
  1. `npm run gates:architect`
  2. `npm run test:smoke:architect`

Runbook:

- See `docs/architect/ARCHITECT_SMOKE_MASTER.md`.

---

## Key Architecture References

| Component         | SSOT File                                                                             | Purpose                                   |
| ----------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| Mutation Pipeline | `src/features/architect/utils/mutationPipeline.js`                                    | All GM action persistence                 |
| World Manager     | `src/features/architect/utils/worldManager.js`                                        | World CRUD                                |
| Season Manager    | `src/features/architect/utils/seasonManager.js`                                       | Season advance persistence                |
| Firestore Paths   | `src/features/architect/utils/architectFirestorePaths.ts`                             | World-scoped path helpers                 |
| Collections       | `src/constants/collections.ts`                                                        | Collection name constants                 |
| Truth Evaluator   | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`                     | Persistence truth contract                |
| Team History      | `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`                    | Timeline rendering                        |
| Event Payload     | `src/features/architect/utils/mutationPipeline.js` (`buildWorldMutationEventPayload`) | Event structure                           |
| Firestore Rules   | `firestore.rules`                                                                     | Security rules (ship-secure, fail-closed) |

---

## Review History

| Review                         | Date       | Result                                   | Return Package                                                                               |
| ------------------------------ | ---------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| ARCHITECT_SHIP_GATES_R1_LOCAL  | 2026-03-04 | CONDITIONAL PASS                         | `return_packages/architect_reviews/ARCHITECT_SHIP_GATES_R1_LOCAL_REVIEW_RETURN_PACKAGE.md`   |
| ARCHITECT_SECURITY_E1          | 2026-03-04 | FULL PASS (Gate F closed)                | `return_packages/architect_fixes/ARCHITECT_SECURITY_E1_EXECUTION_RETURN_PACKAGE.md`          |
| ARCHITECT_SECURITY_E3          | 2026-03-04 | COMPLETE (targeting lock)                | `return_packages/architect_fixes/ARCHITECT_SECURITY_E3_EXECUTION_RETURN_PACKAGE.md`          |
| ARCHITECT_EMULATOR_LOCK_E1     | 2026-03-04 | COMPLETE (client lock)                   | `return_packages/architect_fixes/ARCHITECT_EMULATOR_LOCK_E1_EXECUTION_RETURN_PACKAGE.md`     |
| ARCHITECT_QUALITY_GATES_E1     | 2026-03-04 | COMPLETE (quality clean)                 | `return_packages/architect_fixes/ARCHITECT_QUALITY_GATES_E1_EXECUTION_RETURN_PACKAGE.md`     |
| ARCHITECT_RULES_INTEGRATION_E1 | 2026-03-04 | COMPLETE (emulator rules)                | `return_packages/architect_fixes/ARCHITECT_RULES_INTEGRATION_E1_EXECUTION_RETURN_PACKAGE.md` |
| ARCHITECT_SHIP_GATES_E2        | 2026-03-04 | COMPLETE (single-command required gates) | `return_packages/architect_fixes/ARCHITECT_SHIP_GATES_E2_EXECUTION_RETURN_PACKAGE.md`        |
| ARCHITECT_SMOKE_E1             | 2026-03-04 | COMPLETE (final emulator UI smoke gate)  | `return_packages/architect_fixes/ARCHITECT_SMOKE_E1_EXECUTION_RETURN_PACKAGE.md`             |

Prior section reviews (14 completed): See `docs/reviews/ARCHITECT_REVIEW_LEDGER.md` for full history.
