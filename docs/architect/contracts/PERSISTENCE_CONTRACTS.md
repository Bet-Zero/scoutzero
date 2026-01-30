# Persistence Contracts

**Created:** 2026-01-30  
**Phase:** 61, 62  
**Purpose:** Define and document allowlist-based persistence contracts for Firestore world documents

---

## 1. Overview

Persistence contracts prevent schema drift in Firestore world data by enforcing explicit allowlists at the mutation persistence boundary. These contracts define **exactly which fields may be written** to each document type.

### Why Persistence Contracts?

1. **Prevent drift:** Unknown or debug fields can creep into persisted data over time
2. **Complement sanitization:** Phase 60 strips known transient keys; contracts catch unknown keys
3. **Actionable failures:** Test failures include exact paths and guidance for fixes
4. **Defense in depth:** Layered protection: sanitize → validate contract → removeUndefined
5. **Fixture-based guardrails:** Phase 62 keyset snapshots catch drift before it reaches production

### Relationship to Phase 60 Sanitization

| Mechanism             | Purpose                    | Approach                               |
| --------------------- | -------------------------- | -------------------------------------- |
| Phase 60 Sanitization | Strip known transient keys | Blocklist (`FORBIDDEN_TRANSIENT_KEYS`) |
| Phase 61 Contracts    | Catch unknown keys         | Allowlist (persistence contracts)      |
| Phase 62 Deep Rules   | Validate nested arrays     | Deep allowlists + keyset snapshots     |

Both are applied in `persistWorldMutation()` in the order: **sanitize → validate contract → removeUndefined**

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
