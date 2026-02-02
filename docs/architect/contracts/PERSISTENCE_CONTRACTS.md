# Persistence Contracts

**Created:** 2026-01-30  
**Phase:** 61, 62, 64, 65, 66  
**Purpose:** Define and document allowlist-based persistence contracts for Firestore world documents

---

## 1. Overview

Persistence contracts prevent schema drift in Firestore world data by enforcing explicit allowlists at the mutation persistence boundary. These contracts define **exactly which fields may be written** to each document type.

### Why Persistence Contracts?

1. **Prevent drift:** Unknown or debug fields can creep into persisted data over time
2. **Complement sanitization:** Phase 60 strips known transient keys; contracts catch unknown keys
3. **Actionable failures:** Test failures include exact paths and guidance for fixes
4. **Defense in depth:** Layered protection: sanitize → normalize → validate contract → removeUndefined
5. **Fixture-based guardrails:** Phase 62 keyset snapshots catch drift before it reaches production

### Relationship to Phase 60 Sanitization

| Mechanism             | Purpose                    | Approach                               |
| --------------------- | -------------------------- | -------------------------------------- |
| Phase 60 Sanitization | Strip known transient keys | Blocklist (`FORBIDDEN_TRANSIENT_KEYS`) |
| Phase 61 Contracts    | Catch unknown keys         | Allowlist (persistence contracts)      |
| Phase 62 Deep Rules   | Validate nested arrays     | Deep allowlists + keyset snapshots     |
| Phase 64 Normalize    | Canonicalize TPE schema    | `normalizeTeamTpeSchema()` transform   |
| Phase 66 Migration    | Remove legacy from DB      | Migration script + telemetry           |

All are applied in `persistWorldMutation()` in the order: **sanitize → normalize TPE → validate contract → removeUndefined**

### Phase 64: TPE Schema Canonicalization

**IMPORTANT:** As of Phase 64, `team.tradeExceptions[]` is a **legacy read-only** field.

- **Canonical persisted path:** `team.exceptions.tpe[]`
- **Legacy path:** `team.tradeExceptions[]` (read-only for backward compatibility)
- **Persistence:** Legacy data is automatically normalized into `exceptions.tpe[]` via `normalizeTeamTpeSchema()` before contract validation
- **Legacy persistence is FORBIDDEN:** `tradeExceptions` is NOT in the allowlist and will cause contract violations if present after normalization

Use `getTeamTpeList(team)` for reading TPEs - it handles both canonical and legacy locations transparently.

### Phase 65: TPE Read-Path Canonicalization

**IMPORTANT:** As of Phase 65, production code **MUST NOT** access `.tradeExceptions` directly.

- **Read-path rule:** All TPE reads MUST use `getTeamTpeList(team)` from `persistenceContracts/normalizeTeamTpe.js`
- **Legacy `.tradeExceptions` is input only:** Used only in normalization/migration code
- **Guardrails:** Source-scan tests forbid `.tradeExceptions` outside a tight 9-file allowlist
- **Non-mutation persistence:** `seasonManager.js` (L119, L598) now calls `normalizeTeamTpeSchema()` before `batch.set()`

**Refactored files (Phase 65):**

- `TradeTeamCard.jsx`, `TradeExceptionDashboard.jsx`, `ValidationDetailsPanel.jsx`
- `useTradeMachine.js`, `tradeExceptions.js`, `basicRules.js`, `validateSalaryMatching.js`
- `runOffseason.js`, `SeasonAdvanceModal.jsx`, `seasonManager.js`

### Phase 66: Legacy tradeExceptions Migration + Telemetry

**IMPORTANT:** As of Phase 66, legacy `tradeExceptions` is being fully migrated out of persisted Firestore data.

- **Migration script:** `scripts/migrations/phase66_migrate_tradeExceptions.js`
  - Scans `architect_worlds/{worldId}/teams/{teamCode}` docs
  - Calls `normalizeTeamTpeSchema()` to merge legacy → canonical
  - Removes `tradeExceptions` field and writes back
  - Supports `--dry-run` (default), `--write`, `--verify-only` CLI flags
  - Supports `--worldId=<WORLD_ID>` for targeted migration
  - Supports `--output-dir=<DIR>` for custom report location
  - Produces JSON + markdown reports with deterministic filenames: `phase67_<mode>_<date>.{json,md}`

- **Telemetry:** `getTeamTpeList()` tracks legacy fallback reads
  - In-memory counter: `getLegacyTpeFallbackCount()`
  - **Quiet by default (Phase 67):** Only logs when `LOG_LEGACY_TPE_FALLBACK=true`
  - Reset function: `resetLegacyTpeFallbackTelemetry()` (for testing)
  - Counter still increments silently for programmatic access
  - **Status:** Telemetry retained for debugging, quiet-by-default

- **Type updates:**
  - `NormalizedTeam` interface in `types.ts` marked with `@deprecated` JSDoc comment
  - Clarified as internal compute type only, not persisted shape
  - Canonical persisted schema in `src/schemas/architect.ts` remains correct (no `tradeExceptions`)

### Phase 67: Migration Execution + Verify-Only Mode

**STATUS:** Completed 2026-02-01

- **CLI hardening:** Migration script now supports proper CLI flags:
  - `--dry-run` - Report only, no writes (default)
  - `--write` - Actually perform writes
  - `--verify-only` - Scan for legacy occurrences, exit code 1 if any found
  - `--output-dir=<DIR>` - Custom report directory

- **Verify-only mode:**
  - Produces `phase67_verify_only_<date>.{json,md}` reports
  - Exit code 0 = zero legacy occurrences (migration complete)
  - Exit code 1 = legacy occurrences found (needs migration)

- **Telemetry wind-down:**
  - Quiet by default: no console.warn unless `LOG_LEGACY_TPE_FALLBACK=true`
  - Counter still increments for programmatic access

### Phase 68: CI-Safe Verify-Only + Empty-Scan Fail-Safe

**STATUS:** Completed 2026-02-01

Phase 68 makes `--verify-only` mode CI-trustworthy by preventing false greens from empty scans.

- **Empty-scan fail-safe:**
  - If `worldsScanned === 0` OR `teamDocsScanned === 0`, verify-only FAILS (exit 1)
  - Prints: `[VERIFY FAILED] Empty scan (0 worlds or 0 team docs). Check credentials / emulator / project / data.`
  - Prevents CI from reporting success when no data was actually scanned

- **Escape hatch: `--allow-empty`**
  - Bypasses empty-scan fail with loud warning
  - NOT recommended for CI pipelines
  - Warning: `[VERIFY WARNING] ⚠️  Empty scan detected but --allow-empty is set.`

- **Explicit environment targeting:**
  - Prints at script start: projectId, emulator host status, Firestore instance type
  - Makes it clear which database the script is connecting to

- **ESM compatibility:**
  - Fixed `require()` → `JSON.parse(fs.readFileSync())` for service account loading

### Phase 76: Non-TPE Exception Season Advance Lifecycle

**STATUS:** Completed 2026-02-01

Phase 76 adds exception lifecycle handling during season advance for non-TPE exceptions (BAE, Mini MLE, NTMLE, Room).

- **Lifecycle behavior:**
  - Season advance now resets non-TPE exceptions using canonical cap rules
  - `maxAmount` recomputed from `getCapRulesForYear(toYear)` for each exception type
  - `usedAmount` reset to 0 (fresh season = fresh allocation)
  - `remainingAmount` = maxAmount when enabled, 0 when disabled
  - `enabled` flag preserved (does NOT auto-enable/disable)
  - `seasonKey` updated to new season

- **TPE lifecycle unchanged:**
  - TPE expiry logic remains in `processTradeExceptions()` in `tpeLifecycle.js`
  - Helper explicitly does NOT touch `exceptions.tpe[]`

- **Helper location:**
  - `src/features/architect/utils/exceptions/exceptionLifecycle.js`
  - Exported: `resetTeamNonTpeExceptionsForNewSeason()`, `validateNonTpeExceptionsForYear()`, `NON_TPE_EXCEPTION_TYPES`

- **Wiring:**
  - Called in `processTeamSeasonTransitionWithOptions()` in `seasonManager.js`
  - Runs AFTER TPE expiry processing, BEFORE cap totals recalculation

### Phase 77: Season Advance Totals SSOT + Persist→Reload Parity

**STATUS:** Completed 2026-02-01

Phase 77 ensures season advance computes and persists team totals using the canonical SSOT function, eliminating legacy totals computation paths.

- **SSOT enforcement:**
  - Season advance now uses `computeTeamCapTotals(team, toYear)` from `@/features/architect/utils/capTotals`
  - Removed dynamic imports of `updateTeamCapTotals()` from `tradeManager.js`
  - Both `processTeamSeasonTransition()` and `processTeamSeasonTransitionWithOptions()` updated

- **Correct yearKey:**
  - Totals computed for `toYear` (the target season end year)
  - Ensures cap rules, salary cap, and apron thresholds match the post-transition season

- **Ordering preserved:**
  1. TPE expiry processing (Phase 53)
  2. Non-TPE exception lifecycle reset (Phase 76)
  3. **Totals recompute using SSOT (Phase 77)**
  4. Persist teams via `normalizeTeamTpeSchema()` (Phase 65)

- **SSOT fields guaranteed:**
  - `yearKey` - Season end year
  - `playersTotal` - Sum of player salaries
  - `deadMoneyTotal` - Dead cap from waivers/stretches
  - `capHoldsTotal` - Active unsigned cap holds
  - `incompleteChargesTotal` - Missing roster slot charges
  - `totalCapAllocations` - Sum of all cap commitments
  - `salaryCap`, `firstApron`, `secondApron` - Thresholds from cap rules
  - `deltas` - Position relative to each threshold
  - `_meta` - Source metadata for debugging

- **Persist→Reload parity:**
  - JSON serialize → deserialize produces identical `team.totals` object
  - No normalization step rewrites totals on reload
  - Exception state unchanged by totals recompute (Phase 76 handles exception reset)

### Phase 78: Remove updateTeamCapTotals Everywhere - SSOT-Only Totals

**STATUS:** Completed 2026-02-01

Phase 78 enforces a single rule: **There is exactly one way to compute team totals: `computeTeamCapTotals(team, yearKey)`**. No legacy totals helpers remain in the codebase.

- **Deleted `updateTeamCapTotals()`:**
  - Function definition removed from `tradeManager.js`
  - Export removed from `architectCore.js` barrel
  - 4 call sites replaced with SSOT `computeTeamCapTotals()`

- **SSOT-only invariant:**
  - `tradeManager.js` now imports `computeTeamCapTotals` from `@/features/architect/utils/capTotals`
  - All trade-related functions use SSOT with correct yearKey derivation
  - yearKey is derived from `team.season` via `toEndYear()` at each call site

- **Functions migrated to SSOT:**
  - `executeTrade()` - uses `currentYear` (already numeric)
  - `signFreeAgent()` - derives yearKey from `updatedTeam.season`
  - `waivePlayer()` - derives yearKey from `updatedTeam.season`
  - `extendPlayer()` - derives yearKey from `updatedTeam.season`

- **Guardrails added:**
  - 9 source-scan guardrail tests in `phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js`
  - Tests verify: no function definition, no export, SSOT import present, SSOT used, Phase 77 invariants preserved

**Migration commands (updated):**

```bash
# Dry run on all worlds (default safe mode)
node scripts/migrations/phase66_migrate_tradeExceptions.js --dry-run

# Verify-only scan (exit 1 if legacy found OR empty scan)
node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only

# Verify-only with empty scan allowed (escape hatch, not for CI)
node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only --allow-empty

# Live migration on specific world (USE WITH CAUTION)
node scripts/migrations/phase66_migrate_tradeExceptions.js --write --worldId=abc123

# Custom output directory
node scripts/migrations/phase66_migrate_tradeExceptions.js --dry-run --output-dir=./reports
```

---

### Phase 79: Mutation Pipeline Totals SSOT Guardrails

**STATUS:** Completed 2026-02-02

Phase 79 adds guardrail tests enforcing that all mutation compute functions use `computeTeamCapTotals()` SSOT for totals, with persist→reload parity verification.

- **Invariant:** After any mutation, `team.totals === computeTeamCapTotals(team, yearKey)`
- **Persist→Reload:** `JSON.parse(JSON.stringify(team.totals))` produces identical object
- **Covered mutations:** signing, waive, option, renounce, trade (via tradeContext)
- **Exception:** `computeExtensionResult` does NOT recalculate totals (futureContract only)

- **Test file:** `phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.js`
  - 10 source-scan tests
  - 5 behavioral tests
  - 4 persist→reload parity tests
  - 1 extension exclusion test

---

### Phase 80: Emulator E2E Cap Sheet Proof Harness

**STATUS:** Completed 2026-02-02

Phase 80 creates an emulator-backed proof harness demonstrating the complete mutation → persist → reload lifecycle with SSOT totals invariant.

- **CI Script:** `scripts/ci/run_phase80_cap_sheet_e2e_proof.js`
- **npm Script:** `npm run ci:phase80-cap-proof`
- **World ID:** `phase80_cap_sheet_e2e_proof_world` (deterministic)

**Safety:**

- Refuses to run without `FIRESTORE_EMULATOR_HOST` set
- Refuses if `GOOGLE_APPLICATION_CREDENTIALS` detected without emulator

**Mutations verified:**

1. Signing → totals match SSOT
2. Waive → totals match SSOT, dead money created
3. Renounce → totals match SSOT, cap holds reduced
4. Trade snapshot → both teams' totals match SSOT

**Persistence verified:**

- Persist team to emulator via `batch.set()`
- Reload from emulator via `getDoc()`
- Assert totals identical after roundtrip

**Test file:** `phase80_emulator_e2e_cap_sheet_proof_guardrails.test.js`

- 14 source-scan guardrails

---

## 2. Document Types & Contracts

### 2.1 Team Overlay Documents

**Path:** `architect_worlds/{worldId}/teams/{teamCode}`

**Contract:** `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`

**Source:** `src/features/architect/utils/persistenceContracts/contracts.js`

**Allowed fields:**

| Field                   | Description                              |
| ----------------------- | ---------------------------------------- |
| `teamCode`              | Three-letter team code (e.g., "BOS")     |
| `teamName`              | Full team name                           |
| `abbreviation`          | Team abbreviation (optional)             |
| `city`                  | Team city (optional)                     |
| `conference`            | Conference name (optional)               |
| `division`              | Division name (optional)                 |
| `season`                | Current season code                      |
| `roster`                | Array of player IDs                      |
| `deadCap`               | Array of DeadCapItemZ objects            |
| `capHolds`              | Array of CapHoldItemZ objects            |
| `exceptions`            | ExceptionsZ object (MLE, BAE, TPE, etc.) |
| `exceptionHistory`      | Array of exception history entries       |
| `draftPicks`            | Legacy picks array                       |
| `draftPicksInventory`   | Picks team owns                          |
| `draftPicksObligations` | Picks team owes                          |
| `draftPicksContested`   | Swaps and conditionals                   |
| `entitlementIds`        | Array of entitlement IDs                 |
| `totals`                | TeamTotalsZ computed totals              |
| `source`                | ArchitectSourceZ metadata                |
| `lastUpdated`           | Timestamp string                         |
| `version`               | Schema version                           |
| `mergedAt`              | Merge timestamp                          |
| `_meta`                 | UI computed totals (Phase 60 preserved)  |
| `hardCapLevel`          | Hard cap level enum                      |
| `hardCapReason`         | Hard cap reason string                   |
| `hardCapTriggeredBy`    | Hard cap trigger info                    |
| `hardCapped`            | Legacy boolean                           |

**Deep rules (nested array validation):**

- `exceptions.tpe[]` → `TRADE_EXCEPTION_ITEM_ALLOWLIST`
- `exceptionHistory[]` → `EXCEPTION_HISTORY_ITEM_ALLOWLIST`
- `deadCap[]` → `DEAD_CAP_ITEM_ALLOWLIST` (Phase 62)
- `deadCap[].amountByYear[]` → `DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST` (Phase 62, 3-level nesting)
- `capHolds[]` → `CAP_HOLD_ITEM_ALLOWLIST` (Phase 62)

---

### 2.2 Trade Exception Items

**Path:** `team.exceptions.tpe[]` array items

**Contract:** `TRADE_EXCEPTION_ITEM_ALLOWLIST`

**Allowed fields:**

| Field             | Description              |
| ----------------- | ------------------------ |
| `id`              | Unique TPE identifier    |
| `amount`          | Initial amount (runtime) |
| `totalAmount`     | Maximum lifetime value   |
| `usedAmount`      | Amount consumed          |
| `remainingAmount` | Amount still available   |
| `createdFrom`     | Source description       |
| `createdOn`       | ISO date string          |
| `createdSeason`   | Season code              |
| `expiresOn`       | ISO date string          |
| `isUsed`          | Boolean: fully consumed  |
| `notes`           | Optional notes           |

---

### 2.3 Exception History Items

**Path:** `team.exceptionHistory[]` array items

**Contract:** `EXCEPTION_HISTORY_ITEM_ALLOWLIST`

**Allowed fields (union of all entry types):**

| Field                  | Entry Types              | Description                            |
| ---------------------- | ------------------------ | -------------------------------------- |
| `historyKey`           | ALL                      | Deterministic dedup key                |
| `type`                 | ALL                      | TPE_CREATED, TPE_CONSUMED, TPE_EXPIRED |
| `teamCode`             | ALL                      | Team code                              |
| `tpeId`                | ALL                      | TPE identifier                         |
| `timestamp`            | ALL                      | ISO timestamp                          |
| `seasonId`             | ALL                      | Season code                            |
| `seasonYear`           | ALL                      | End year number                        |
| `worldId`              | ALL (optional)           | World context                          |
| `mutationId`           | ALL (optional)           | Mutation reference                     |
| `amountCreated`        | TPE_CREATED              | Amount created                         |
| `createdFrom`          | TPE_CREATED              | Source description                     |
| `createdSeason`        | TPE_CREATED              | Creation season                        |
| `expiresOn`            | TPE_CREATED, TPE_EXPIRED | Expiry date                            |
| `amountConsumed`       | TPE_CONSUMED             | Amount consumed                        |
| `remainingAmountAfter` | TPE_CONSUMED             | Remaining after consumption            |
| `fullyConsumed`        | TPE_CONSUMED             | Boolean: fully consumed                |
| `absorbedPlayers`      | TPE_CONSUMED             | Array of player info                   |
| `amountExpired`        | TPE_EXPIRED              | Amount expired                         |
| `totalAmount`          | TPE_EXPIRED              | Total amount at expiry                 |
| `toSeason`             | TPE_EXPIRED              | Target season after expiry             |

---

### 2.4 Dead Cap Items (Phase 62)

**Path:** `team.deadCap[]` array items

**Contract:** `DEAD_CAP_ITEM_ALLOWLIST`

**Source:** `src/features/architect/utils/persistenceContracts/contracts.js`

**Allowed fields:**

| Field            | Description                    |
| ---------------- | ------------------------------ |
| `playerId`       | Waived player identifier       |
| `playerName`     | Waived player display name     |
| `originalSalary` | Original salary before waive   |
| `amountByYear`   | Array of year-by-year dead cap |
| `waiveDate`      | ISO date of waive transaction  |
| `notes`          | Optional notes                 |

**Nested deep rule (3-level nesting):**

- `deadCap[].amountByYear[]` → `DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST`

---

### 2.5 Dead Cap Amount-By-Year Items (Phase 62)

**Path:** `team.deadCap[].amountByYear[]` array items

**Contract:** `DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST`

**Source:** `src/features/architect/utils/persistenceContracts/contracts.js`

**Allowed fields:**

| Field         | Description                     |
| ------------- | ------------------------------- |
| `season`      | Season code (e.g., "2025-26")   |
| `amount`      | Dead cap amount for this season |
| `isStretched` | Whether this is stretched cap   |

---

### 2.6 Cap Hold Items (Phase 62)

**Path:** `team.capHolds[]` array items

**Contract:** `CAP_HOLD_ITEM_ALLOWLIST`

**Source:** `src/features/architect/utils/persistenceContracts/contracts.js`

**Allowed fields:**

| Field        | Description                       |
| ------------ | --------------------------------- |
| `playerId`   | Player identifier                 |
| `playerName` | Player display name               |
| `amount`     | Cap hold amount                   |
| `type`       | Cap hold type (bird, early, etc.) |
| `season`     | Applicable season                 |
| `isSigned`   | Whether player has been signed    |
| `expiresOn`  | ISO date when cap hold expires    |
| `notes`      | Optional notes                    |

---

### 2.7 Player Override Documents

**Path:** `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`

**Contract:** `PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST`

**Source:** `src/features/architect/utils/persistenceContracts/contracts.js`

**Allowed fields:**

| Field               | Description                |
| ------------------- | -------------------------- |
| `playerId`          | Player identifier          |
| `displayName`       | Player display name        |
| `teamCode`          | Team code                  |
| `teamName`          | Team name                  |
| `bio`               | Nested bio object          |
| `contract`          | BasePlayerContractZ object |
| `futureContract`    | Optional future contract   |
| `representation`    | Agent/agency info          |
| `source`            | Provider metadata          |
| `lastUpdated`       | Timestamp string           |
| `version`           | Schema version             |
| `rfaOfferSheet`     | RFA offer sheet flag       |
| `rfaOfferSheetOnly` | Store-only flag            |
| `rfaContext`        | RFA context object         |

---

### 2.8 Event Documents

**Path:** `architect_worlds/{worldId}/events/{eventId}`

**Contract:** `EVENT_TOP_LEVEL_ALLOWLIST`

**Source:** `src/features/architect/utils/persistenceContracts/contracts.js`

**Allowed fields:**

| Field           | Description         |
| --------------- | ------------------- |
| `eventId`       | Event identifier    |
| `type`          | Mutation type       |
| `timestamp`     | ISO timestamp       |
| `seasonId`      | Season code         |
| `metadata`      | Event-specific data |
| `teamsAffected` | Array of team codes |

---

### 2.9 Event Metadata

**Path:** `event.metadata` object

**Contract:** `EVENT_METADATA_TOP_LEVEL_ALLOWLIST`

**Source:** `src/features/architect/utils/persistenceContracts/contracts.js`

**Allowed fields (union across mutation types):**

| Field                | Used By        | Description            |
| -------------------- | -------------- | ---------------------- |
| `type`               | All            | Mutation type echo     |
| `timestamp`          | All            | ISO timestamp          |
| `teamsInvolved`      | Trade          | Team codes array       |
| `playersTraded`      | Trade          | Player info array      |
| `entitlementsTraded` | Trade          | Entitlement changes    |
| `picksTraded`        | Trade          | Pick info array        |
| `playerId`           | Signing        | Player ID              |
| `playerName`         | Signing        | Player name            |
| `signingTeam`        | Signing        | Team code              |
| `contractValue`      | Signing        | Contract value         |
| `contractYears`      | Signing        | Contract length        |
| `signedUsing`        | Signing        | Exception used         |
| `waivedPlayer`       | Waive          | Waived player info     |
| `stretchProvision`   | Waive          | Stretch provision used |
| `deadCapAmount`      | Waive          | Dead cap amount        |
| `optionType`         | Option         | Option type            |
| `optionDecision`     | Option         | Accept/decline         |
| `effectiveSeason`    | Option         | Effective season       |
| `extensionType`      | Extension      | Extension type         |
| `extensionTerms`     | Extension      | Extension terms        |
| `renouncedPlayer`    | Renounce       | Renounced player       |
| `capHoldRemoved`     | Renounce       | Cap hold removed       |
| `fromSeason`         | Season Advance | Source season          |
| `toSeason`           | Season Advance | Target season          |
| `expiredExceptions`  | Season Advance | Expired exceptions     |
| `advancedPlayers`    | Season Advance | Advanced players       |
| `draftYear`          | Draft          | Draft year             |
| `draftRound`         | Draft          | Draft round            |
| `draftPick`          | Draft          | Pick number            |
| `selectedPlayer`     | Draft          | Selected player        |
| `notes`              | General        | Optional notes         |
| `reason`             | General        | Reason string          |

---

## 3. Enforcement

### 3.1 Where Enforced

**File:** `src/features/architect/utils/mutationPipeline.js`

**Function:** `persistWorldMutation()`

**Enforcement points:**

1. Team snapshot write → `PERSISTENCE_CONTRACTS.TEAM`
2. Player override write → `PERSISTENCE_CONTRACTS.PLAYER`
3. Event metadata → `PERSISTENCE_CONTRACTS.EVENT_METADATA`
4. Event document → `PERSISTENCE_CONTRACTS.EVENT`

### 3.2 Enforcement Order

```
sanitizeTransientFieldsForPersistence()  ← Phase 60: strip known transient keys
         ↓
assertPersistableOrThrow()               ← Phase 61: validate against allowlist
         ↓
removeUndefinedDeep()                    ← Strip undefined values
         ↓
batch.set()                              ← Write to Firestore
```

### 3.3 Environment Gating

| Environment            | Enforcement                          |
| ---------------------- | ------------------------------------ |
| Test (`NODE_ENV=test`) | **ENABLED** (default)                |
| Production             | **DISABLED** (default)               |
| Explicit override      | Set `ENFORCE_PERSIST_CONTRACTS=true` |

---

## 4. How to Extend Safely

### Adding a New Persisted Field

1. **Identify the document type** (team, player, event, or event metadata)
2. **Add the field to the appropriate allowlist** in `src/features/architect/utils/persistenceContracts/contracts.js`
3. **If it's a nested array**, add a deep rule entry in `TEAM_DEEP_RULES` or create a new deep rules map
4. **Update this document** with the new field description
5. **Run Phase 61 tests** to verify the allowlist change works:

   ```bash
   npm run test -- --run src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js
   ```

6. **Document the change** in the HISTORY section of the Master Doc

### Removing a Persisted Field

1. **Remove the field from the allowlist** (this will cause test failures if the field is still being written)
2. **Ensure the field is no longer produced** by any compute function
3. **Consider migration** for existing data if needed

### Adding a New Nested Array Validation

1. **Create a new `*_ITEM_ALLOWLIST`** constant for the array item shape
2. **Add an entry to `TEAM_DEEP_RULES`** (or the appropriate deep rules map):

   ```javascript
   export const TEAM_DEEP_RULES = Object.freeze({
     'exceptions.tpe': TRADE_EXCEPTION_ITEM_ALLOWLIST,
     exceptionHistory: EXCEPTION_HISTORY_ITEM_ALLOWLIST,
     newArrayPath: NEW_ARRAY_ITEM_ALLOWLIST, // New entry
   });
   ```

3. **Update tests** to cover the new nested validation

### Adding 3-Level Nested Validation (Phase 62)

For arrays within array items (e.g., `deadCap[].amountByYear[]`):

1. **Create the parent array item allowlist** (e.g., `DEAD_CAP_ITEM_ALLOWLIST`)
2. **Create the nested array item allowlist** (e.g., `DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST`)
3. **Add entries to `TEAM_DEEP_RULES`** for both levels:

   ```javascript
   export const TEAM_DEEP_RULES = Object.freeze({
     deadCap: DEAD_CAP_ITEM_ALLOWLIST,
     'deadCap.amountByYear': DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST,
   });
   ```

4. The validator automatically propagates nested rules to array items

---

## 5. Troubleshooting

### Test Failure: "PERSISTENCE CONTRACT VIOLATION"

**Symptom:** Test fails with message like:

```
[PERSISTENCE CONTRACT VIOLATION] TEAM document has 1 disallowed field(s):
  - team.debugFoo
```

**Resolution:**

1. **If the field is intentional:** Add it to the appropriate allowlist
2. **If the field should NOT persist:**
   - Remove it at the source (compute function)
   - Or add it to Phase 60 `FORBIDDEN_TRANSIENT_KEYS` if it's a transient artifact

### Finding the Source of an Unknown Field

1. Search for the field name in the codebase
2. Trace back to the compute function that produces it
3. Determine if it should be persisted or stripped

---

## 6. Reference Files

| File                                                                                     | Purpose                        |
| ---------------------------------------------------------------------------------------- | ------------------------------ |
| `src/features/architect/utils/persistenceContracts/contracts.js`                         | Allowlist definitions          |
| `src/features/architect/utils/persistenceContracts/validatePersistableShape.js`          | Validation logic               |
| `src/features/architect/utils/persistenceContracts/enforcement.js`                       | Enforcement gating             |
| `src/features/architect/utils/persistenceContracts/index.js`                             | Public API                     |
| `src/features/architect/utils/mutationPipeline.js`                                       | Enforcement wiring             |
| `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.js`          | Phase 61 guardrail tests       |
| `src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js` | Phase 62 fixtures + deep rules |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`                            | Master documentation           |

---

## 7. How Fixtures Work (Phase 62)

### Capture-From-Persist Boundary Strategy

Phase 62 introduces fixture-based drift guardrails that validate real persisted shapes:

1. **Fixture Creation:** Tests build representative objects that mirror what `persistWorldMutation()` writes to Firestore
2. **Contract Validation:** Fixtures are validated against the same `PERSISTENCE_CONTRACTS` used at runtime
3. **Keyset Snapshots:** Tests capture sorted key lists from fixtures and compare against explicit expected arrays

### Why Keyset Snapshots Prevent Drift

```javascript
// If a new field sneaks into the fixture, this test fails:
const EXPECTED_DEAD_CAP_ITEM_KEYS = [
  'amountByYear',
  'notes',
  'originalSalary',
  'playerId',
  'playerName',
  'waiveDate',
];

it('deadCap[] item keyset is stable', () => {
  const actualKeys = extractArrayItemKeys(team.deadCap);
  expect(actualKeys).toEqual(EXPECTED_DEAD_CAP_ITEM_KEYS);
});
```

Benefits:

- **Early detection:** New fields trigger test failure before reaching production
- **Deterministic:** Sorted keys ensure stable, reproducible snapshots
- **Actionable:** Failures show exactly which key appeared or disappeared

### How to Intentionally Evolve Contracts

When adding a new persisted field:

1. **Update the allowlist** in `contracts.js`
2. **Update the fixture** in the Phase 62 test file to include the new field
3. **Update the expected keyset snapshot** to include the new key (sorted position)
4. **Run tests** to verify all three are in sync

This ensures:

- The allowlist permits the new field
- The fixture reflects realistic data
- The snapshot documents the expected shape

---

## 8. How to Prove Verify-Only End-to-End (Phase 69)

Phase 69 introduced a **seeded emulator proof harness** that demonstrates the complete verify-only workflow with non-empty scans. This is the repeatable way to prove that:

1. The migration script correctly detects legacy `tradeExceptions` fields
2. Write-mode removes legacy fields without data loss
3. Verify-only correctly reports zero legacy after migration

### Proof Loop Commands

```bash
# 1. Seed emulator with test data (creates world + teams with legacy tradeExceptions)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js

# 2. Verify-only (expected: FAIL with exit 1, legacy detected)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only

# 3. Write migration (removes legacy tradeExceptions)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/migrations/phase66_migrate_tradeExceptions.js --write --worldId=phase69_seed_world

# 4. Verify-only again (expected: PASS with exit 0, zero legacy)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only
```

### Automated Proof Runner

For convenience, a single script runs all four steps with exit code validation:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/seed/phase69_run_tpe_migration_proof.js
```

### Expected Outcomes

| Step               | Expected Exit Code | Scan Counts                                             |
| ------------------ | ------------------ | ------------------------------------------------------- |
| Seed               | 0                  | N/A                                                     |
| First verify-only  | 1 (FAIL)           | worldsScanned > 0, teamDocsScanned > 0, legacyHits > 0  |
| Write migration    | 0                  | docsMigrated > 0                                        |
| Second verify-only | 0 (PASS)           | worldsScanned > 0, teamDocsScanned > 0, legacyHits == 0 |

### Seed Script Structure

The seed script (`scripts/seed/phase69_seed_architect_worlds_for_tpe_migration.js`):

- Creates deterministic worldId: `phase69_seed_world`
- Creates 3 team docs:
  - **BOS**: Legacy `tradeExceptions` only
  - **LAL**: Canonical `exceptions.tpe` only
  - **MIA**: Both legacy and canonical (merge test case)
- Is idempotent: re-running produces same docs
- Refuses to run against production (requires `FIRESTORE_EMULATOR_HOST`)

---

## 9. CI Proof Job + Production Write Safety (Phase 70)

Phase 70 adds a CI-safe entrypoint for the Phase 69 proof harness and introduces production write safety rails.

### CI Entrypoint

A single npm script runs the complete Phase 69 proof loop with deterministic pass/fail behavior:

```bash
# Run CI proof job (requires emulator running)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 npm run ci:phase69-proof
```

**CI Entrypoint Location:** `scripts/ci/run_phase69_tpe_migration_proof.js`

**Exit Codes:**

- **0:** All proof loop assertions passed
- **1:** Any validation failure

**Validation Checks:**

1. First verify-only must exit with code 1 (legacy detected)
2. Second verify-only must exit with code 0 (zero legacy)
3. Nonzero scan counts must appear in output
4. Proof loop must complete successfully

### Production Verify-Only (Safe)

Verify-only mode can be run safely against production with no risk of writes:

```bash
# Production verify-only scan (SAFE - no writes)
node scripts/migrations/phase66_migrate_tradeExceptions.js --verify-only
```

This scans production Firestore and reports any legacy `tradeExceptions` fields without making changes.

### Production Write Safety Latch

**CRITICAL:** As of Phase 70, `--write` is REFUSED against production Firestore unless one of these conditions is met:

1. `FIRESTORE_EMULATOR_HOST` is set (running against emulator), OR
2. `ALLOW_PROD_MIGRATION_WRITE=true` is set in environment

This prevents accidental production writes from CI pipelines or mistaken commands.

**To write to production (when intentional):**

```bash
# Explicit production write (must set ALLOW_PROD_MIGRATION_WRITE=true)
ALLOW_PROD_MIGRATION_WRITE=true node scripts/migrations/phase66_migrate_tradeExceptions.js --write --worldId=<WORLD_ID>
```

**Safety Latch Behavior:**

| Scenario                                     | `--verify-only` | `--write`  |
| -------------------------------------------- | --------------- | ---------- |
| Emulator (FIRESTORE_EMULATOR_HOST set)       | ✅ Allowed      | ✅ Allowed |
| Production (no ALLOW_PROD_MIGRATION_WRITE)   | ✅ Allowed      | ❌ REFUSED |
| Production (ALLOW_PROD_MIGRATION_WRITE=true) | ✅ Allowed      | ✅ Allowed |

**Environment Variables:**

| Variable                     | Purpose                                      |
| ---------------------------- | -------------------------------------------- |
| `FIRESTORE_EMULATOR_HOST`    | Use Firestore emulator                       |
| `ALLOW_PROD_MIGRATION_WRITE` | Bypass production write safety latch         |
| `LOG_LEGACY_TPE_FALLBACK`    | Enable legacy TPE fallback telemetry logging |
