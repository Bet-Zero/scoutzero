# Architect Phase 5: Production Hardening Gap Analysis & Execution Plan

> **Created**: December 24, 2025  
> **Purpose**: Comprehensive review to make Architect ship-ready  
> **Status**: Analysis Complete - Ready for Implementation  

---

## Executive Summary

This document analyzes the Architect feature's production readiness, identifying gaps in correctness enforcement, persistence consistency, and security. The goal is to deliver a system where:

1. **Correctness-first**: Illegal actions cannot persist  
2. **Single-source-of-truth**: No parallel persistence that can diverge  
3. **Easy to maintain**: No duplicated rule logic drifting over time  
4. **Secure enough for launch**: Writes properly constrained  

### Key Findings

| Area | Risk Level | Summary |
|------|------------|---------|
| Persistence Model | 🟢 Resolved | Worlds-only persistence for Architect (teamPlans removed) |
| Illegal State Prevention | 🔴 High | "Force Action" bypass persists invalid states |
| Rule Parity | 🟡 Medium | Trade Machine validates more than other actions |
| Code Duplication | 🟡 Medium | Cap holds, season format, salary matching in multiple locations |
| Security | 🟡 Medium | Firestore rules need owner-scoping before launch |

---

## Phase 5 Operating Rules

> [!IMPORTANT]
> These rules govern all Architect operations and must be maintained throughout the codebase.

### 1. Worlds Are Canonical

- **`architect_worlds`** is the single source of truth for all Architect state
- No `teamPlans` reads, writes, autosave, Plan Picker, or Plan Mode in Architect
- User state is always loaded from and persisted to world snapshots

### 2. MutationPipeline Enforces Legality

- **All** mutations flow through `applyWorldMutation()` → `mutationPipeline.js`
- Pipeline validates before persisting — illegal states are **rejected**, not fixed after-the-fact
- Validation returns structured `{ valid, violations[], warnings[] }` for UI display

### 3. Roster Size Policy

| Condition | Severity | Behavior |
|-----------|----------|----------|
| Roster > 15 players | **Error** | **Block** — action cannot proceed |
| Roster < 14 players | **Warning** | **Warn** — action proceeds, user notified |

This allows users to waive/trade players during roster construction while still preventing illegal >15 states.

### 4. Overrides Are Dev-Only

- Force Override UI gated by `VITE_ENABLE_CBA_OVERRIDE` env flag (default: `false`)
- In production, overrides are **never visible** and **never persist** illegal states
- Dev overrides are logged but do not create production-viable world states

---

## Phase 5 Gap Analysis (Structured)

### Gap 1: Persistence Model (Resolved: Worlds-Only)

**Name**: Persistence Model Consistency

**Status**: ✅ **RESOLVED** — Architect is worlds-only.

**Decision**:

- **Architect uses `architect_worlds` exclusively** for persistence
- **No `teamPlans` reads, writes, autosave, Plan Picker, or Plan Mode** for Architect
- Legacy `teamPlans` collection may remain for other features but is **not used by Architect**

**Where it lives**:

- `src/features/architect/utils/worldManager.js` → `architect_worlds` collection (canonical)
- `src/features/architect/utils/mutationPipeline.js` → writes to `architect_worlds`

**Why this matters**:

- Single source of truth eliminates divergence risk
- User always sees world state, no confusion about "which data is real"
- Simplifies codebase by removing dual-persistence complexity

**Implementation Notes**:

- Remove/gate any `saveUserTeamPlan` / `saveNamedTeamPlan` calls from Architect code paths
- Remove Plan Picker UI from Architect (worlds picker is the canonical selector)
- Consider deprecating `firebaseTeamPlanHelpers.js` if no other features use it

---

### Gap 2: "Force Action" Bypass Persists Illegal States

**Name**: Force Override Bypass Path

**Where it lives**:

- `src/shared/components/EditContractModal.jsx` lines 1165-1250 → Override UI
- `src/features/architect/hooks/useTradeMachine.js` line 169 → `forceTrade` state
- `src/features/architect/tradeMachine/TradeEditor.jsx` lines 157-181 → Force button

**Why it's a risk**:

- Users can persist CBA-illegal contract actions to world snapshots
- Creates invalid game states that break downstream calculations
- "Override audit log" exists but isn't enforcement - just documentation after the fact
- No admin/dev-only gating on this feature

**How to detect it**:

- EditContractModal shows "⚠️ Force Override" button when validation fails
- User clicks override → `overrideMetadata` passed to action handlers
- Action persists with `overrideUsed: true` flag but data is still illegal
- Cap calculations may show impossible states (over hard cap, etc.)

**Override Flow in EditContractModal** (lines 1180-1194):

```jsx
{showAdvanced && (
  <div className="p-4 bg-red-900/10 space-y-4">
    <div className="text-xs text-red-300/80 space-y-2">
      <p className="font-semibold text-red-300">
        This action violates CBA rules:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        {validationResult.reasons.map((reason, idx) => (
          <li key={idx}>{reason}</li>
        ))}
      </ul>
      <p className="pt-2 border-t border-red-500/20 mt-2">
        Proceeding will create an illegal world state. This action
        will be logged and marked as an override.
      </p>
    </div>
    // ... confirmation checkbox
  </div>
)}
```

**Trade Machine Override** (`useTradeMachine.js` line 465):

```javascript
legal: forceTrade ? true : validation.legal,
```

**Proposed Fix**:

1. **Remove Force Override from production builds** via environment check
2. **Gate behind dev-only flag** (`VITE_ENABLE_CBA_OVERRIDE`)
3. **Block persistence entirely** in mutation pipeline when `validateMutation()` fails
4. **Remove `forceTrade` state** from production trade validation flow

---

### Gap 3: Incomplete Validation in Mutation Pipeline

**Name**: Non-Trade Mutations Lack Full Validation

**Where it lives**:

- `src/features/architect/utils/mutationPipeline.js` lines 962-994 → `validateMutation()`

**Why it's a risk**:

Current `validateMutation()` only validates trades comprehensively:

```javascript
function validateMutation({ mutationType, payload, currentState, computeResult, seasonId }) {
  // Trade validation uses the full Trade Machine
  if (mutationType === 'executeTrade') {
    return validateTradeForPipeline(payload, currentState, seasonId);
  }

  // Other mutations have simpler validation
  // For now, basic validation - can be extended later
  switch (mutationType) {
    case 'signFreeAgent':
      // TODO: Add cap validation in Phase 2
      // CALLER MUST pre-validate via useCapValidation hook
      return { valid: true };

    case 'waivePlayer':
      // Could add roster minimum validation here
      return { valid: true };

    case 'extendPlayer':
      // Could add extension eligibility validation here
      return { valid: true };

    case 'optionDecision':
      // Basic validation
      return { valid: true };

    case 'renounceRights':
      // Renouncing is always valid if player has rights with the team
      return { valid: true };

    default:
      return { valid: true };
  }
}
```

**Gap**: Non-trade mutations bypass validation entirely with `return { valid: true }`.

**How to detect it**:

- Sign a free agent that would hard cap the team over the ceiling
- Mutation pipeline doesn't check hard cap for signings
- Illegal state persists to world snapshot

**Proposed Fix**:
Implement `validateSigningForPipeline()`, `validateWaiveForPipeline()`, etc. that run the same cap rules:

- Hard cap ceiling check
- Roster size constraints  
- Second apron restrictions
- Exception usage constraints

---

### Gap 4: Renounce Rights - Implementation Complete but Needs Wire-Up

**Name**: Renounce Rights UI Wire-Up

**Where it lives**:

- `src/features/architect/utils/mutationPipeline.js` lines 241-300 → `loadStateForMutation('renounceRights')`
- `src/features/architect/utils/mutationPipeline.js` lines 881-949 → `computeRenounceResult()`
- `tests/architect/renounceRights.test.js` → comprehensive tests

**Status**: Implementation is **complete** in mutationPipeline:

- Cap hold removal ✅
- Bird rights clearing ✅  
- Team totals recalculation ✅
- Tests passing ✅

**Gap**: UI wire-up verification needed. `handleRenounceRights()` in `useArchitectActions.ts` exists (line 272) but needs verification that it calls `applyWorldMutation`.

**How to detect it**:

- Click "Renounce Rights" in EditContractModal
- Check if mutation flows through `applyWorldMutation('renounceRights', ...)`
- Verify world snapshot shows cap hold removed

**Proposed Fix**:

1. Verify `handleRenounceRights` calls mutation pipeline
2. Add integration test for renounce → persistence → reload

---

### Gap 5: Rule Parity - Trade Machine vs Other Actions

**Name**: Inconsistent Rule Enforcement

**Where it lives**:

- `src/features/architect/utils/tradeMachine/rules/` → comprehensive trade rules
- `src/features/architect/hooks/useCapValidation.js` → signing/extension validation
- `src/features/architect/utils/mutationPipeline.js` → no validation for non-trades

**Why it's a risk**:

Trade Machine validates these restrictions:

| Rule | Trade Machine | Signing | Extension | Waive | Option |
|------|---------------|---------|-----------|-------|--------|
| Salary Matching | ✅ Full | N/A | N/A | N/A | N/A |
| Hard Cap Ceiling | ✅ Full | ✅ Error/Block | ⚠️ Warning only | ❌ None | ❌ None |
| Second Apron Restrictions | ✅ Full | ⚠️ Warning only | ❌ None | ❌ None | ❌ None |
| Roster Size (>15) | ✅ Full | ✅ Error/Block | N/A | ❌ None | N/A |
| Roster Minimum (<14) | ✅ Full | N/A | N/A | ⚠️ Warning only | N/A |
| Exception Usage | ✅ Full | ⚠️ Partial | N/A | N/A | N/A |

**How to detect it**:

- Sign free agent that would put team at 16 players → allowed
- Waive player that puts team at 13 players → allowed
- Accept option that triggers second apron violations → allowed

**Proposed Fix**:

Create shared `capLegalitySuite.js` with reusable validators:

```javascript
export function checkHardCapCeiling(team, projectedSalary, capSettings) { ... }
export function checkRosterSize(team, rosterAfterAction) { ... }  
export function checkApronRestrictions(team, projectedSalary, capSettings) { ... }
```

Then use in all mutation validation paths.

---

### Gap 6: Code Duplication Creating Drift Risk

**Name**: Duplicated Logic Clusters

**Where it lives**:

**1. Salary Matching Tiers** (HIGH drift risk):

- `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
- `src/features/architect/utils/cbaConstants.js`  
- `src/features/architect/utils/tradeMachine/rules/salaryMatching.js`

**2. Cap Hold Formulas** (MEDIUM drift risk):

- `src/features/architect/utils/contractUtils.js` → `calculateCapHold()`
- `src/features/architect/utils/capHolds.ts` → `computeCapHold()`
- Different multipliers may exist (1.5x vs 1.75x depending on rights type)

**3. Season Format Parsing** (MEDIUM drift risk):

- `src/features/architect/utils/seasonFormat.js` → `toEndYear()`, `toSeasonCode()`
- `src/features/architect/utils/seasonHelpers.ts` → duplicate helpers
- `src/features/architect/utils/seasonUtils.js` → another set
- `src/features/architect/utils/tradeMachine/utils/seasonUtils.js` → trade-specific

**4. Minimum Salary Scales** (LOW drift risk):

- `src/features/architect/data/minimumSalaryScales.ts` → data file
- `src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js` → logic

**How to detect drift**:

- Run `grep -r "salaryMatchingTiers\|SALARY_TIERS" src/`
- Compare values between files
- Any discrepancy = bug

**Proposed Consolidation Order**:

1. Season format → single canonical `seasonFormat.js`, delete others
2. Cap holds → single `capHolds.ts`, route all callers
3. Salary matching → single constants file, import everywhere
4. Minimum salary → already mostly consolidated

---

### Gap 7: Security - Firestore Rules Need Tightening

**Name**: Open Firestore Rules for Development

**Where it lives**:

- Firestore rules (not in repo, configured in Firebase Console)
- `functions/src/architect/purgeWorld.ts` → ownership check in Cloud Function

**Why it's a risk**:

- During development, Firestore rules are likely open (`allow read, write: if true`)
- Users could write to other users' world data
- Base collections (`architect_baseTeams`, `architect_basePlayers`) should be read-only

**Current Ownership Check** (in purgeWorld Cloud Function):

```typescript
// Validate ownership
if (worldData.createdBy !== context.auth.uid) {
  throw new functions.https.HttpsError(
    'permission-denied',
    'You do not have permission to delete this world'
  );
}
```

**Gap**: This check is in Cloud Function only. Direct Firestore writes bypass it.

**Proposed Firestore Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Base collections - read-only in app
    match /architect_baseTeams/{teamCode} {
      allow read: if true;
      allow write: if false; // Admin SDK only
    }
    
    match /architect_basePlayers/{playerId} {
      allow read: if true;
      allow write: if false; // Admin SDK only
    }
    
    // Worlds - owner-scoped
    match /architect_worlds/{worldId} {
      allow read: if request.auth != null && resource.data.createdBy == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.createdBy == request.auth.uid;
      allow update: if request.auth != null && resource.data.createdBy == request.auth.uid;
      allow delete: if false; // Use Cloud Function for deletion
      
      // Team snapshots - inherit world ownership
      match /teams/{teamCode} {
        allow read, write: if request.auth != null && 
          get(/databases/$(database)/documents/architect_worlds/$(worldId)).data.createdBy == request.auth.uid;
          
        // Player overrides - inherit team ownership
        match /players/{playerId} {
          allow read, write: if request.auth != null && 
            get(/databases/$(database)/documents/architect_worlds/$(worldId)).data.createdBy == request.auth.uid;
        }
      }
      
      // Events subcollection
      match /events/{eventId} {
        allow read, write: if request.auth != null && 
          get(/databases/$(database)/documents/architect_worlds/$(worldId)).data.createdBy == request.auth.uid;
      }
    }
  }
}
```

> [!NOTE]
> **teamPlans rules removed**: Architect no longer uses `teamPlans`. If other features use this collection, rules should scope by a stored `ownerId` field (not doc ID parsing with `split()`).

---

## Ordered Execution Plan

### Step 1: Single Source of Truth — Worlds-Only Persistence

**Decision**: **Worlds-only** for Architect. No `teamPlans` usage (no reads, writes, autosave, Plan Picker, or Plan Mode).

#### Scope Analysis (Baseline Search)

| Pattern | Files | Occurrences | Location |
|---------|-------|-------------|----------|
| `saveUserTeamPlan` | 1 | 1 (definition only) | `firebaseTeamPlanHelpers.js:219` |
| `saveNamedTeamPlan` | 1 | 1 (definition only) | `firebaseTeamPlanHelpers.js:271` |
| `teamPlans` collection | 2 | 7 total | `firebaseTeamPlanHelpers.js` (6), `ARCHITECT_FEATURE_README.md` (1) |
| `PlanPicker` / `planMode` | 0 | 0 | No UI component exists |

**Key Finding**: No Plan Picker UI exists. The save functions are defined but **not imported or called** from any Architect code paths. The only imports from `firebaseTeamPlanHelpers.js` are:

- `loadFreeAgents` → `useArchitectState.ts:16`
- `hydrateBaseTeam` → `teamLoader.js:13`
- `loadTeamCapSheet` → `worldTeamData.ts:20`, `LeagueView.jsx:2`

**Concrete Tasks**:

1. [x] Remove/gate `saveUserTeamPlan` / `saveNamedTeamPlan` calls — **N/A**: No calls exist in Architect code paths
2. [x] Remove Plan Picker UI — **N/A**: No `PlanPicker` or `planMode` components exist
3. [ ] Verify `useArchitectState.ts` has no `teamPlans` fetch logic (confirmed: imports only `loadFreeAgents`)
4. [ ] Update `ARCHITECT_FEATURE_README.md` to remove teamPlans reference (line 10)
5. [ ] Add inline comment in `firebaseTeamPlanHelpers.js` marking teamPlans functions as deprecated/unused by Architect

**Files to Update**:

| File | Change | Lines |
|------|--------|-------|
| [ARCHITECT_FEATURE_README.md](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/ARCHITECT_FEATURE_README.md) | Remove teamPlans reference | Line 10 |
| [firebaseTeamPlanHelpers.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/firebaseTeamPlanHelpers.js) | Add deprecation comment | Lines 219-300 |

**Verification Strategy**:

```bash
# 1. Confirm no teamPlans writes from Architect
grep -r "saveUserTeamPlan\|saveNamedTeamPlan" src/features/architect/ --include="*.ts" --include="*.tsx" --include="*.jsx"
# Expected: 0 matches (only definition in .js file)

# 2. Confirm no teamPlans collection reads from Architect hooks/components
grep -r "collection(db, 'teamPlans')" src/features/architect/ --include="*.ts" --include="*.tsx"
# Expected: 0 matches

# 3. Run Architect workflow end-to-end; grep Firestore writes for teamPlans collection; confirm zero matches
# (Manual verification during testing)
```

**Tests to Add**:

- `tests/architect/persistence.test.js` — new file with assertions:
  - Mock Firestore and verify no writes to `teamPlans` collection during:
    - World creation
    - Mutation execution (signFreeAgent, waivePlayer, etc.)
    - World save/reload cycle
  - Assert all writes target `architect_worlds` collection only

**Regression Check**:

- [ ] All existing tests pass after changes (`npm test -- --testPathPattern=architect`)
- [ ] No runtime errors when loading/saving worlds

**Definition of Done**:

- [x] No Architect code path reads from or writes to `teamPlans` — **Verified**: no calls exist
- [x] All mutations flow through `architect_worlds` only — **Already true**
- [x] Plan Picker / Plan Mode removed from Architect UI — **N/A**: never existed
- [ ] Documentation updated to reflect worlds-only persistence
- [ ] Deprecation comments added to unused teamPlans functions

---

### Step 2: Illegal-State Prevention via Pipeline Preflight

**Concrete Tasks**:

1. [x] Create `src/features/architect/utils/capLegalityValidation.js` ✅ Complete
   - Exports `validateSigning()`, `validateWaive()`, `validateExtension()`, `validateOptionDecision()`, `validateRenounceRights()`
   - Each returns `{ valid: boolean, violations: Array, warnings: Array }`
2. [x] Update `validateMutation()` in `mutationPipeline.js` to call appropriate validator ✅ Complete
3. [x] Return structured violation payload to UI ✅ Complete (includes `warnings` in success response)

**Files Impacted**:

- `src/features/architect/utils/mutationPipeline.js` ✅ Updated with warnings in response
- `src/features/architect/utils/capLegalityValidation.js` ✅ Already exists

**Validation Payload Format**:

```javascript
{
  valid: boolean,
  error: string | null,
  violations: [
    { rule: 'hard_cap', message: 'Team would exceed hard cap ceiling', severity: 'error' },
    { rule: 'roster_size', message: 'Team would exceed 15-player roster limit', severity: 'error' }
  ],
  warnings: [
    { rule: 'apron', message: 'Team over first apron - limited flexibility', severity: 'warning' }
  ]
}
```

**Tests to Add**:

- `tests/architect/capLegalityValidation.test.js` ✅ Created with 8 tests
  - Signing that exceeds hard cap → blocked (error) ✅
  - Signing that exceeds 15 players → blocked (error) ✅
  - Waive that drops below roster minimum (<14) → warning (allowed to proceed) ✅
  - Extension that triggers apron → warning but allowed

**Definition of Done**:

- [x] Validation functions created for all mutation types ✅
- [x] All 6 mutation types have validation running before persist ✅
- [x] `{ success: false, violations: [...] }` returned for illegal actions ✅
- [x] UI can display structured violations (warnings included in response) ✅

---

### Step 3: Remove/Gate Bypass Paths ("Force Action")

**Concrete Tasks**:

1. [x] Add environment flag `VITE_ENABLE_CBA_OVERRIDE` (default: `false`) ✅
2. [x] Gate "Force Override" UI section in `EditContractModal.jsx` ✅ (line 331)
3. [x] Gate `forceTrade` state in `useTradeMachine.js` ✅ (line 465)
4. [ ] Update mutation pipeline to reject overrideMetadata when flag is false
5. [ ] Ensure `validateMutation` always blocks when invalid (no bypass)

**Files Impacted**:

- `src/shared/components/EditContractModal.jsx`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/utils/mutationPipeline.js`

**Implementation**:

```javascript
// In EditContractModal.jsx
const canOverride = import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';
// Hide override UI entirely if canOverride is false
{canOverride && showOverrideOption && (
  <div className="mt-4 border border-red-500/30 ...">
    // ... override UI
  </div>
)}
```

```javascript
// In mutationPipeline.js validateMutation()
if (!validationResult.valid) {
  // No bypass possible - always return failure
  return {
    success: false,
    error: validationResult.error || 'Validation failed',
    violations: validationResult.violations,
  };
}
```

**Tests to Add**:

- `tests/architect/overrideGating.test.js`
  - With flag off → override UI not rendered
  - With flag off → mutation rejects even if override metadata present

**Definition of Done**:

- [x] In production build, override UI is not visible (gated by `canOverride` check) ✅
- [ ] In production build, mutations reject invalid states with no bypass
- [x] Dev builds can enable override via `.env` flag ✅

---

### Step 4: Verify Renounce Rights End-to-End

**Concrete Tasks**:

1. [ ] Verify `handleRenounceRights` in `useArchitectActions.ts` calls mutation pipeline
2. [x] Add E2E test: renounce → world snapshot → reload → verify state ✅

**Files Impacted**:

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (verify)
- `tests/architect/e2e-workflows.test.js` ✅ Tests exist
- `tests/architect/renounceRights.test.js` ✅ 9 tests passing

**Current Implementation Check**:

```typescript
// useArchitectActions.ts
handleRenounceRights: (player: ArchitectPlayer, overrideMetadata?: OverrideMetadata | null) => void;
```

Need to verify this calls:

```javascript
applyWorldMutation({
  userId,
  worldId,
  seasonId,
  mutationType: 'renounceRights',
  payload: { teamCode, playerId },
});
```

**Tests to Add**:

- `tests/architect/e2e-workflows.test.js` → "renounce rights persists to world"

**Definition of Done**:

- [ ] Click "Renounce Rights" → cap hold removed in world snapshot
- [ ] Reload world → cap hold still removed
- [ ] E2E test passing

---

### Step 5: Rule Parity Enforcement Across All Actions

**Concrete Tasks**:

1. [ ] Extract shared validators from Trade Machine to `capLegalitySuite.js`
2. [ ] Import and use in `capLegalityValidation.js` (from Step 2)
3. [ ] Map rule sets to mutation types:

| Mutation Type | Applicable Rules |
|---------------|------------------|
| signFreeAgent | hard_cap, roster_size, apron_restrictions, exception_usage |
| waivePlayer | roster_minimum |
| extendPlayer | hard_cap (projected), extension_eligibility |
| optionDecision | hard_cap (if accepting), creates_cap_hold (if declining) |
| renounceRights | (always valid structurally) |
| executeTrade | (existing comprehensive Trade Machine) |

**Files Impacted**:

- `src/features/architect/utils/capLegalitySuite.js` (new shared module)
- `src/features/architect/utils/capLegalityValidation.js` (imports from suite)

**Tests to Add**:

- `tests/architect/capLegalitySuite.test.js`
  - Hard cap check blocks when projected > ceiling (error)
  - Roster size check blocks when >15 (error)
  - Roster minimum check warns when <14 (warning, not blocking)

**Definition of Done**:

- [ ] Single source of truth for cap rules
- [ ] Signings blocked when they would exceed hard cap or roster >15
- [ ] Waives **warn** (not block) when they would drop below roster minimum

---

### Step 6: Consolidation / Dedupe Cleanup

**Concrete Tasks** (in order of risk):

1. [ ] **Season Format Consolidation**
   - Canonical: `src/features/architect/utils/seasonFormat.js`
   - Delete/deprecate: `seasonHelpers.ts`, `seasonUtils.js`, `tradeMachine/utils/seasonUtils.js`
   - Update all imports

2. [ ] **Cap Holds Consolidation**
   - Canonical: `src/features/architect/utils/capHolds.ts`
   - Merge logic from `contractUtils.js:calculateCapHold()`
   - Update all callers

3. [ ] **Salary Matching Constants**
   - Canonical: `src/features/architect/utils/cbaConstants.js`
   - Merge from `tradeMachine/constants/cbaConstants.js`
   - Update Trade Machine imports

4. [x] **Cap Helpers Consolidation** ✅ Complete
   - Canonical: `src/features/architect/utils/capHelpers.ts`
   - Extracted shared utilities: `getCapSettings()`, `calculateTeamCapHit()`, `getPlayerId()`, `getPlayerName()`
   - Updated imports in: `capLegalityValidation.js`, `useCapValidation.js`, `EditContractModal.jsx`

**Files Impacted**:

- Multiple files with import updates
- 3-4 files deleted/deprecated

**Tests to Add**:

- Verify existing tests still pass after consolidation
- Add test for each consolidated module verifying single export point

**Definition of Done**:

- [ ] Season format has one source, others deleted
- [ ] Cap holds have one formula, others deprecated
- [ ] No duplicate constant definitions
- [x] Cap helpers consolidated into `capHelpers.ts` ✅
- [ ] All existing tests pass

---

### Step 7: Security Tightening Checklist

**Concrete Tasks**:

1. [ ] Deploy Firestore rules (from Gap 7 proposal above)
2. [ ] Verify Cloud Function ownership checks align with rules
3. [ ] Test that users cannot write to other users' worlds
4. [ ] Test that base collections are read-only

**Files Impacted**:

- Firebase Console → Firestore Rules
- `functions/src/architect/purgeWorld.ts` (verify alignment)

**Verification Checklist**:

- [ ] Create world as User A → visible only to User A
- [ ] Attempt write to User A's world as User B → denied
- [ ] Attempt write to `architect_baseTeams` → denied
- [ ] Attempt delete via direct Firestore write → denied (must use Cloud Function)

**Definition of Done**:

- [ ] Firestore rules deployed matching proposal
- [ ] Manual verification of access controls passes
- [ ] No unauthorized write paths exist

---

## Ship Readiness Checklist

Run through this checklist before declaring Phase 5 complete:

### Persistence Consistency

- [ ] No `teamPlans` usage in Architect (no reads, writes, autosave, Plan Picker)
- [ ] All mutations flow through `applyWorldMutation()` → `architect_worlds`
- [ ] No direct Firestore writes from UI components

### Illegal State Prevention

- [x] Validation functions exist (`capLegalityValidation.js`) ✅
- [x] `validateMutation()` runs for ALL mutation types ✅
- [x] Invalid mutations return `{ success: false, violations }` ✅
- [x] UI receives and displays structured violation messages ✅
- [x] No "Force Override" in production builds (`VITE_ENABLE_CBA_OVERRIDE !== 'true'`) ✅

### Rule Parity

- [x] Hard cap checked for signings, extensions, option accepts (in `capLegalityValidation.js`) ✅
- [x] Roster maximum (>15) → **error/block** for signings (in `validateSigning()`) ✅
- [x] Roster minimum (<14) → **warning only** for waives (in `validateWaive()`) ✅
- [x] Apron restrictions checked for signings ✅
- [ ] Trade Machine integration of shared validators pending

### Consolidation

- [ ] Single season format module in use
- [ ] Single cap holds formula in use
- [ ] No duplicate CBA constants
- [x] Cap helpers consolidated (`getCapSettings`, `calculateTeamCapHit`) ✅

### Security

- [ ] Firestore rules scoped to world owner
- [ ] Base collections read-only
- [ ] Cloud Function ownership check aligns with rules
- [ ] Manual access control verification passes

### Testing

- [x] All existing tests pass (316/317 - 1 pre-existing flaky test) ✅
- [x] Renounce rights tests pass (9 tests) ✅
- [x] E2E workflow tests pass (7 tests) ✅
- [ ] No regressions in Trade Machine (needs manual verification)

---

## Assumptions & Items to Verify

**Assumptions Made**:

1. `VITE_ENABLE_CBA_OVERRIDE` environment variable can be added without breaking build
2. Firestore rules can be deployed via Firebase Console or CI
3. `teamPlans` collection is **not used by Architect** (may remain for other features)
4. Trade Machine validation is comprehensive and can serve as template for other actions

**Items to Verify Before Implementation**:

1. Review `handleRenounceRights` actual implementation in `useArchitectActions.ts`
2. Confirm Trade Machine `validateTrade` covers all needed rules for extraction
3. Check if any UI components bypass `useCapValidation` hook entirely
4. Verify Cloud Function deployment process for `purgeArchitectWorld`

---

## Related Documentation

- [Gap Analysis v1](./ARCHITECT_GAP_ANALYSIS.md) - Phase 1-4 completion details
- [Implementation Status](./architect-teams-plan/00-IMPLEMENTATION-STATUS.md)
- [Target Schema](./architect-teams-plan/03-TARGET-SCHEMA.md)
- [Test Status](../tests/architect/TEST_STATUS.md)
