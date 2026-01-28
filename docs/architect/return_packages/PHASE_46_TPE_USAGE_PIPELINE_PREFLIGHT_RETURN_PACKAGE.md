# PHASE 46 — TPE Usage Tracking Pipeline Status & Gaps — PREFLIGHT RETURN PACKAGE

**Date:** 2026-01-28  
**Mode:** PREFLIGHT (Discovery-only; NO code changes)  
**Scope:** `src/features/architect/**`  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. TPE Model & Storage Locations

### 1.1 Data Structures

| Location                                                        | Structure            | Schema Field(s)                                                                                   | Purpose                             |
| --------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `teams/{code}.exceptions.tpe[]`                                 | Array of TPE objects | `id`, `totalAmount`, `remainingAmount`, `usedAmount`, `createdFrom`, `expiresOn`, `createdSeason` | Firestore base storage (canonical)  |
| `architect_worlds/{worldId}/teams/{teamCode}.tradeExceptions[]` | Array                | Same as above + `isUsed`, `isBeingUsed`                                                           | World overlay (session mutations)   |
| Team runtime object `.tradeExceptions[]`                        | Normalized array     | `id`, `amount`, `used`, `createdFrom`, `expires`, `expirationDate`, `isUsed`                      | In-memory (hydrated from Firestore) |
| `validateTradeExceptions` result                                | Object               | `createdTPE`                                                                                      | Computed during trade validation    |

### 1.2 TPE Object Shape (Canonical)

```typescript
interface TPE {
  id: string; // Unique identifier
  amount: number; // Original/remaining amount (USD)
  createdSeason?: number; // Season year TPE was created
  expiresOn?: string; // ISO date string (canonical field, Phase 1 tpeLifecycle)
  expiryISO?: string; // Legacy alias for expiresOn
  expirationDate?: string; // Legacy alias (UI layer)
  createdFrom?: string; // Player name that generated TPE
  isUsed?: boolean; // Whether fully consumed
  isBeingUsed?: boolean; // Temporarily marked during trade validation
  remaining?: number; // Computed remaining capacity
}
```

### 1.3 Firestore Collection Paths

| Collection                                    | Field Path           | Read Locations                       |
| --------------------------------------------- | -------------------- | ------------------------------------ |
| `architect_baseTeams/{teamCode}`              | `.exceptions.tpe[]`  | `firebaseTeamPlanHelpers.js:135-145` |
| `architect_worlds/{worldId}/teams/{teamCode}` | `.tradeExceptions[]` | `teamLoader.js`, `seasonManager.js`  |

---

## 2. TPE Lifecycle Map

### 2.1 CREATE → STORE

| Step                            | Function/File                        | Trigger                                                 | Notes                                                                                                           |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Compute TPE creation**        | `validateTradeExceptions.js:122-133` | Trade where `salaryOut > salaryIn` and team is over cap | Calls `createTPE()` from `tradeUtilities.js`                                                                    |
| **Create TPE object**           | `tradeUtilities.js:26-41`            | Called by validator                                     | Returns `{ amount, createdSeason, expiresOn }` with 1-year expiry                                               |
| **Attach to validation result** | `validateTradeExceptions.js:142`     | After validation                                        | `result.createdTPE` populated                                                                                   |
| **Display in UI**               | `TradeExceptionDashboard.jsx:20-35`  | Trade validation result                                 | Shows "TPE Created" panel                                                                                       |
| **❌ PERSIST to Firestore**     | **MISSING**                          | —                                                       | **Gap: No `mutationPipeline` or `persistWorldMutation` step writes `createdTPE` to team's `tradeExceptions[]`** |

### 2.2 STORE → SHOW (Display)

| Step                          | Function/File                          | UI Surface      | Notes                                                |
| ----------------------------- | -------------------------------------- | --------------- | ---------------------------------------------------- |
| **Load from Firestore**       | `firebaseTeamPlanHelpers.js:135-145`   | Cap Sheet load  | Hydrates `exceptionData.tpe[]` → `tradeExceptions[]` |
| **Display in Cap Sheet**      | `ExceptionTracker.jsx:95-113, 231-255` | Cap Sheet panel | `CompactTradeExceptionRow` renders each TPE          |
| **Display in Trade Machine**  | `TradeTeamCard.jsx:632-665`            | Trade team card | Shows "Available TPEs" badge list                    |
| **Display exception history** | `ExceptionHistoryTracker.jsx:7-30`     | History view    | Table of TPE activity (if logged)                    |

### 2.3 SHOW → VALIDATE (Trade TPE Usage)

| Step                            | Function/File                       | Trigger                           | Notes                                                      |
| ------------------------------- | ----------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| **Select TPE for player**       | `TradePlayerRow.jsx:246-253`        | User clicks "Use TPE" in dropdown | Sets `player.tpeId` or `absorptionMode='TPE'`              |
| **Apply TPE in session**        | `useTradeMachine.js:824-847`        | `applyTradeException()` callback  | Updates `team.tradeExceptions[].isUsed = true` locally     |
| **TPE eligibility check**       | `tradeUtilities.js:48-52`           | `canUseTPE()`                     | Checks expiration only                                     |
| **TPE validation (per-player)** | `validateSalaryMatching.js:177-273` | Trade validation                  | Enforces TPE must cover 100% of assigned player salary     |
| **TPE rule validation**         | `validateTradeExceptions.js:1-145`  | Trade validation                  | Checks expiration, capacity, second-apron blocks           |
| **Second apron TPE block**      | `validateTradeExceptions.js:50-60`  | Team salary > second apron        | Blocks all TPE usage (prior-year TPE has specific message) |

### 2.4 VALIDATE → CONSUME (Usage/Consumption)

| Step                           | Function/File                            | Trigger                      | Notes                                                                                             |
| ------------------------------ | ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| **Mark TPE as used (session)** | `useTradeMachine.js:840-842`             | During `applyTradeException` | Sets `isUsed: true` in local state only                                                           |
| **Track absorbed salary**      | `validateSalaryMatching.js:194, 227-234` | Validation                   | `tpeAbsorbedSalary` computed, excluded from salary matching                                       |
| **Validate TPE covers player** | `validateSalaryMatching.js:248-258`      | Validation                   | Returns violation if TPE insufficient                                                             |
| **Update TPE remaining**       | `validateTradeExceptions.js:115`         | During validation            | `tpe.remaining = tpeAmount - totalUsage`                                                          |
| **❌ PERSIST consumption**     | **MISSING**                              | —                            | **Gap: No pipeline step writes `tpe.isUsed = true` or decrements `remainingAmount` in Firestore** |

### 2.5 CONSUME → EXPIRE

| Step                              | Function/File                      | Trigger                 | Notes                                                |
| --------------------------------- | ---------------------------------- | ----------------------- | ---------------------------------------------------- |
| **Check expiration (validation)** | `validateTradeExceptions.js:89-92` | Trade validation        | Uses `isExpiredTPE()` helper                         |
| **Check expiration (UI)**         | `TradeTeamCard.jsx:297, 639-640`   | Render                  | Filters out expired TPEs from display                |
| **Season transition expiry**      | `seasonManager.js:773-782`         | Season advance          | Calls `processTradeExceptions(toSeason)`             |
| **Process expirations**           | `tpeLifecycle.js:26-99`            | Season advance          | Filters TPEs where `expiresOn < seasonStartBoundary` |
| **Update active TPEs**            | `seasonManager.js:781`             | After processing        | `updatedTeam.tradeExceptions = tpeResult.activeTPEs` |
| **✅ Persist expiry**             | `seasonManager.js`                 | Season advance persists | World mutation writes updated `tradeExceptions[]`    |

---

## 3. Missing Pieces (Gap Analysis)

### 3.1 Critical Gaps

| Gap ID      | Category                    | Description                                                                            | Current Behavior                                                    | Expected Behavior                                                    |
| ----------- | --------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **G-TPE-1** | **Consumption Persistence** | No pipeline step persists TPE usage after trade execution                              | TPE remains "unused" in Firestore after trade executes              | TPE should be marked `isUsed: true` or `remainingAmount` decremented |
| **G-TPE-2** | **Creation Persistence**    | No pipeline step persists newly created TPEs                                           | `createdTPE` computed but not written to team's `tradeExceptions[]` | New TPE should be added to receiving team's exception array          |
| **G-TPE-3** | **Usage History**           | `ExceptionHistoryTracker` expects `exceptionHistory[]` but no mutation creates entries | History table shows "No TPE activity logged"                        | TPE usage/creation events should be logged                           |
| **G-TPE-4** | **Partial Consumption**     | TPE can absorb multiple players but no partial tracking                                | TPE is either fully consumed or not                                 | Should track `usedAmount` incrementally for partial consumption      |

### 3.2 Secondary Gaps

| Gap ID      | Category                  | Description                                                                                        | Risk Level                                             |
| ----------- | ------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **G-TPE-5** | **Manual TPE Management** | `ManageExceptionsModal.jsx:19` explicitly notes "TPE is explicitly NOT included in Phase 27 scope" | Low — MLE/BAE/Room managed, TPE deferred               |
| **G-TPE-6** | **Schema Normalization**  | Multiple date fields (`expiresOn`, `expiryISO`, `expirationDate`, `expires`) coexist               | Low — `getTpeExpiryISO()` helper handles normalization |
| **G-TPE-7** | **TPE ID Generation**     | No standard ID generation for new TPEs                                                             | Medium — Could cause duplicate/collision issues        |

### 3.3 Where Consumption Should Occur But Doesn't

| Code Path                                                   | Current Status                                      | What's Missing                                                       |
| ----------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `mutationPipeline.js:490` (`executeTrade` case)             | Loads team states, validates, computes trade result | **No step to extract `validationResult.createdTPE` and add to team** |
| `mutationPipeline.js:2940` (`executeTrade` case in compute) | Calls `computeTradeResult()`                        | **No step to mark used TPEs as consumed**                            |
| `useArchitectActions.ts:594` (`handleTradeActions`)         | Calls `persistMutation('executeTrade', { teams })`  | **Payload doesn't include TPE consumption data**                     |
| `tradeManager.js:38-100` (`executeTrade`)                   | Returns `updatedTeams` after trade                  | **No TPE array modification**                                        |

---

## 4. Minimal Files for Future Execution Phase

### 4.1 Core Files Requiring Modification

| File                                                                 | Change Type | Purpose                                                           |
| -------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `src/features/architect/utils/mutationPipeline.js`                   | ADD         | Add TPE persistence logic in `executeTrade` case                  |
| `src/features/architect/utils/tradeManager.js`                       | ADD         | Include TPE creation/consumption in `updatedTeam.tradeExceptions` |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | VERIFY      | Ensure `createdTPE` is exposed in result object                   |

### 4.2 Helper Files Involved

| File                                                                         | Role                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `src/features/architect/utils/tpeLifecycle.js`                               | Existing expiration logic (model for consumption) |
| `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`          | `createTPE()` function                            |
| `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js` | Returns `createdTPE` and tracks `tpe.isUsed`      |

### 4.3 UI Files (No Changes Required)

| File                          | Status                                                                    |
| ----------------------------- | ------------------------------------------------------------------------- |
| `ExceptionTracker.jsx`        | Already renders `tradeExceptions[]` — will auto-update when data persists |
| `TradeExceptionDashboard.jsx` | Already shows `createdTPE` from validation result                         |
| `TradeTeamCard.jsx`           | Already filters by `isUsed` and expiration                                |

### 4.4 Test Files to Extend

| File                                              | Current Coverage                                                  | Missing Coverage                                        |
| ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| `tests/trade/tpe_creation_expiry_usage.test.js`   | Creation, expiry rejection, aggregation block, second-apron block | **Persistence of created TPE, consumption persistence** |
| `src/tests/trade/tpe_perPlayer.guardrail.test.js` | Per-player matching validation                                    | **Post-trade TPE state verification**                   |

---

## 5. Risk If Ignored

### 5.1 Functional Risks

| Risk                             | Severity   | Impact                                                                                              |
| -------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| **TPEs never actually consumed** | **HIGH**   | Users can "use" the same TPE infinitely across multiple trades — cap compliance fiction             |
| **Created TPEs lost**            | **HIGH**   | Trade generates TPE but it's never available for future use — silent data loss                      |
| **Cap totals incorrect**         | **MEDIUM** | TPE-absorbed salary not tracked properly could affect apron calculations in subsequent transactions |
| **User confusion**               | **LOW**    | UI shows TPE as "available" after trade where it should be consumed                                 |

### 5.2 CBA Compliance Risks

| Rule                                 | Risk                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| CBA Art VII Sec 5 (Trade Exceptions) | TPE should be reduced by acquired salary, not reusable                                            |
| CBA Art VII Sec 2(f) (Second Apron)  | Second-apron teams blocked from TPE usage — validation exists, but if TPE never consumed, no harm |
| CBA TPE 1-year expiry                | Expiry works (seasonManager), but creation timing may be lost if TPE not persisted                |

---

## 6. Summary Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           TPE LIFECYCLE MAP                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   CREATE                     STORE                    SHOW                   │
│   ┌─────────────────┐       ┌──────────────────┐     ┌──────────────────┐   │
│   │ validateTrade() │──────▶│ ❌ NOT PERSISTED │────▶│ ExceptionTracker │   │
│   │ → createdTPE    │       │                  │     │ TradeTeamCard    │   │
│   └─────────────────┘       └──────────────────┘     └──────────────────┘   │
│                                                              │               │
│                                                              ▼               │
│   VALIDATE                                           ┌──────────────────┐   │
│   ┌─────────────────────────────────────────────────│ User selects TPE │   │
│   │ validateSalaryMatching() - TPE per-player check │ for incoming     │   │
│   │ validateTradeExceptions() - expiry, capacity    │ player           │   │
│   └─────────────────────────────────────────────────└──────────────────┘   │
│                              │                                               │
│                              ▼                                               │
│   CONSUME                                            EXPIRE                  │
│   ┌─────────────────┐       ┌──────────────────┐     ┌──────────────────┐   │
│   │ ❌ NOT PERSISTED│       │ Session state    │     │ seasonManager    │   │
│   │ isUsed=true     │◀──────│ only (local)     │     │ tpeLifecycle.js  │   │
│   │ never written   │       │                  │     │ ✅ PERSISTED     │   │
│   └─────────────────┘       └──────────────────┘     └──────────────────┘   │
│                                                                              │
│   ❌ = MISSING PIPELINE STEP                                                 │
│   ✅ = WORKING                                                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Recommendations (For Future Execution Phase)

1. **Add TPE consumption to `computeTradeResult()`** — After trade validation, mark used TPEs as consumed in the returned `teamUpdates`.

2. **Add TPE creation to `computeTradeResult()`** — If `validationResult.createdTPE` exists, add it to the receiving team's `tradeExceptions[]`.

3. **Persist in `persistWorldMutation()`** — Ensure `tradeExceptions[]` changes are included in the batch write.

4. **Add TPE history logging** — Create `exceptionHistory[]` entries for TPE creation/consumption events.

5. **Add guardrail tests** — Verify that after `executeTrade`, TPE state in Firestore reflects consumption/creation.

---

**Phase 46 Preflight Complete.**
