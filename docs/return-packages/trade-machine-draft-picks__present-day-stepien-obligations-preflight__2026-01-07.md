# Return Package: Present-Day Stepien Obligations PREFLIGHT

> **Date**: 2026-01-07  
> **Mode**: PREFLIGHT (Repo inspection ONLY — NO code changes)  
> **Scope**: Present-day Trade Machine validation (NOT worlds/seasons/season advance)  
> **Master Doc**: docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md (read-only)

---

## Summary

### Key Findings

**DEFINITIVE ANSWER: No `owedPicks` or `pickObligations` field exists today.**

1. **No obligations-related field exists in the codebase** — Searches for `owedPicks`, `pickObligations`, `previouslyTraded`, `pickDebt`, etc. returned **ZERO hits** in runtime code.
2. **A previous preflight** (same date) already documented this gap and proposed a fix roadmap.
3. **`team.tradedPicks`** exists in `draftRules.js` but is **NOT populated** — the field is referenced but never assigned a value by any loader.
4. **`validateStepien()`** only checks `picksOut` / `outgoingPicks` from the current trade, **NOT** existing obligations.
5. **Minimal wiring point identified**: Add obligations as a new field in `hydrateBaseTeam()` and pass to `validateStepien()`.

---

## T1: Locate "owed picks / pick obligations" Schema(s) and Field Names

### Search Terms Executed

```bash
grep -rn "owedPicks|pickObligations|pickObligation|owedPick|previouslyTraded|tradedPick|pickDebt|futureFirstOwed|conveyanceResult" src docs
```

### Results Table

| File Path | Line # | What It Represents | Shape |
|-----------|--------|-------------------|-------|
| `src/features/architect/utils/tradeMachine/rules/draftRules.js` | 36, 60 | `team.tradedPicks` — referenced but **NEVER POPULATED** by any loader | `Array<{ round, isSwap, protection, year }>` (assumed) |
| `docs/return-packages/trade-machine-draft-picks__present-day-trade-machine-preflight__2026-01-07.md` | Various | Previous preflight documenting same gap | Documentation only |
| `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` | 174, 209, etc. | `conveyanceResult` — used for **season advance resolution**, NOT present-day validation | `{ outcome: string, position: number }` |

### Analysis

- **`tradedPicks`** appears in `draftRules.js:36` and `:60` but this file's `validateDraftPicks()` function is **NOT called** by `tradeValidator.js`. The canonical path uses `validateStepien()` which reads `picksOut`/`outgoingPicks` only.
- **`conveyanceResult`** is only written during season advance conveyance resolution, NOT used in present-day trade validation.
- **No `owedPicks`, `pickObligations`, or equivalent field exists** in any schema, loader, or runtime code.

---

## T2: Present-Day Team Object Passed to validateStepien()

### Call Site (tradeValidator.js:440)

```javascript
// src/features/architect/utils/tradeMachine/engine/tradeValidator.js:440
const stepienResult = validators.validateStepien(team, context);
```

### Team Object Construction (tradeValidator.js:345-378)

```javascript
// teamsWithAssets is built from validTeams input
const teamsWithAssets = validTeams.map((team, index) => {
  const otherTeams = validTeams.filter((_, i) => i !== index);

  // Populate incoming players (what this team is receiving from other teams)
  const incomingPlayers = otherTeams.reduce((players, otherTeam) => {
    return players.concat(otherTeam.sends || []);
  }, []);

  // Populate outgoing players (what this team is sending out)
  const outgoingPlayers = team.sends || [];

  // Calculate projected salary after trade
  const currentSalary = team.team.teamTotalSalary || team.team.totalSalary || 0;

  return {
    ...team,  // Contains: team, sends, picksOut
    salaryOut: 0,
    salaryIn: 0,
    projectedSalary: currentSalary,
    teamTotalSalary: currentSalary,
    incomingPlayers,
    outgoingPlayers,
    cashSent: team.cashSent || 0,
    cashReceived: team.cashReceived || 0,
    context: { ...context, capSettings: context.capSettings, yearKey: currentYear },
  };
});
```

### validateStepien() Input Extraction (validateStepien.js:43-50)

```javascript
export function validateStepien(team, tradeCtx = {}) {
  const { picksOut = [], outgoingPicks = [] } = team;
  // Use outgoingPicks primarily (that's what tests use)
  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;
  // ...
}
```

### Present-Day Team Object Contract

| Field Name | Present? | Source | Used by validateStepien? |
|------------|----------|--------|--------------------------|
| `team.picksOut` | ✅ Yes | useTradeMachine state | ✅ Yes (primary) |
| `team.outgoingPicks` | ✅ Yes | Mapped from `picksOut` in `validateCurrentTrade()` | ✅ Yes (fallback) |
| `team.picks` | ✅ Yes | Loaded from `draftPicks` via `loadWorldTeamData()` | ❌ No (inventory only) |
| `team.draftPicks` | ✅ Yes | From Firestore base team | ❌ No (source for `picks`) |
| `team.owedPicks` | ❌ **NO** | Does not exist | N/A |
| `team.tradedPicks` | ❌ **NO** | Referenced in dead code but never populated | N/A |
| `team.previouslyTradedPicks` | ❌ **NO** | Does not exist | N/A |

---

## T3: Pick Data Source Chain for Present-Day Trade Machine

### Loader Chain

```
1. useTradeMachine.js (hook initialization)
   ↓
2. loadWorldTeamData(worldId, teamId) → src/features/architect/utils/worldTeamData.ts:81
   ↓
3a. If worldId is null → loadTeamCapSheet(teamId) → firebaseTeamPlanHelpers.js:178
   ↓
3b. loadTeamCapSheet reads from baseTeamRef(teamCode) → firestorePaths.js:53
   ↓
4. hydrateBaseTeam(teamCode, baseDoc) → firebaseTeamPlanHelpers.js:137
   ↓
5. Returns team object with draftPicks: baseDoc.draftPicks || []
```

### Key Files in Chain

| File | Function | Firestore Collection | Pick Field |
|------|----------|---------------------|------------|
| `useTradeMachine.js:231` | Team initialization | N/A (via loader) | `rawPicks = data.draftPicks || data.picks || []` |
| `worldTeamData.ts:94` | World-aware loading | Fallback chain | Returns team with `draftPicks` |
| `firebaseTeamPlanHelpers.js:185` | Base team loading | `architect_baseTeams/{teamCode}` | `draftPicks: baseDoc.draftPicks || []` |
| `teamLoader.js:80` | Alternative loader | `architect_baseTeams/{teamCode}` | `draftPicks: baseDoc.draftPicks || []` |

### Firestore Collections Used

| Collection | Purpose | Used by Present-Day Trade Machine? |
|------------|---------|-----------------------------------|
| `architect_baseTeams` | Base team data (canonical) | ✅ Yes |
| `architect_worlds/{worldId}/teams/{teamCode}` | World snapshots | Only if worldId provided |

---

## T4: Base Team Documents — Do They Contain Obligations?

### hydrateBaseTeam() Output (firebaseTeamPlanHelpers.js:150-176)

```javascript
return {
  id: teamMeta?.id || teamCode.toLowerCase(),
  teamCode,
  teamName: baseDoc.teamName,
  season: baseDoc.season,
  abbreviation: baseDoc.abbreviation || teamCode,
  players,
  roster: players,
  activeContracts,
  capHolds: baseDoc.capHolds || [],
  draftPicks: baseDoc.draftPicks || [],  // ← Pick inventory ONLY
  exceptions: exceptionData,
  mle: toSimpleException(exceptionData.mle),
  tpMle: toSimpleException(exceptionData.taxpayerMle || exceptionData.tpMle),
  bae: toSimpleException(exceptionData.bae),
  tradeExceptions,
  hardCapped: baseDoc.totals?.hardCapLevel ? baseDoc.totals.hardCapLevel !== 'none' : false,
  deadCap: baseDoc.deadCap || [],
  baseline: baseDoc,
  totals: baseDoc.totals || {},
};
```

### Pick-Related Fields in Base Team Schema (architect.ts:206-224)

```typescript
export const BaseTeamDocZ = z.object({
  teamCode: TeamCodeZ,
  teamName: z.string(),
  season: SeasonCodeZ,
  // ...
  draftPicks: z.array(DraftPickZ).optional().default([]),  // ← Pick inventory
  // ...
});
```

### Individual Pick Schema (architect.ts:141-160)

```typescript
export const DraftPickZ = z.object({
  id: z.string().optional(),
  year: z.number().int(),
  round: z.number().int(),
  pick: z.number().int().nullable(),
  owner: TeamCodeZ,
  originalTeam: TeamCodeZ.optional(),
  status: z.string().optional(),
  isSwap: z.boolean().optional(),
  protection: z.string().nullable().optional(),
  protectionMeta: ProtectionMetaZ,
  stepienEligible: z.boolean().optional(),
  tradeable: z.boolean().optional(),
  via: TeamCodeZ.optional(),
  recipient: TeamCodeZ.optional(),
  route: z.array(TeamCodeZ).optional(),
  notes: z.string().optional(),
  conveyance: DraftPickConveyanceZ,
  metadata: z.object({}).passthrough().optional(),
});
```

### Key Finding

**No obligations field exists in schema or loader output.**

The `draftPicks` array contains the team's **inventory** (picks they currently own), but:
- No `owedPicks` array for picks already traded away
- No `previouslyTradedFirsts` for Stepien calculation
- No `pickObligations` structure

---

## T5: Minimal Wiring Point for Obligations (Planning Only)

### Option A: Add `owedPicks` to Team Cap Sheet (RECOMMENDED)

**Files to modify** (execution phase):
1. `src/schemas/architect.ts` — Add `owedPicks: z.array(DraftPickZ).optional().default([])` to `BaseTeamDocZ`
2. `src/features/architect/utils/firebaseTeamPlanHelpers.js:163` — Add `owedPicks: baseDoc.owedPicks || []`
3. `src/features/architect/utils/tradeMachine/rules/validateStepien.js:43` — Merge `owedPicks` with `outgoingPicks`

**Change complexity**: Low — purely additive, with `|| []` defaults for backward compatibility.

**Data population**: Requires populating `owedPicks` in Firestore base team documents (separate data task).

### Option B: Pass Obligations via tradeCtx

**Files to modify** (execution phase):
1. `src/features/architect/utils/tradeMachine/rules/validateStepien.js:37` — Accept `tradeCtx.existingObligations`
2. `src/features/architect/hooks/useTradeMachine.js:642` — Pass obligations in `tradeCtx` when calling `validateCurrentTrade()`

**Change complexity**: Medium — requires propagating obligations through context.

**Advantage**: No schema change needed; obligations can be computed/loaded separately.

---

## Raw Validation Command Outputs

### Command 1: Broad Obligations Search

```bash
grep -rn "owedPicks|pickObligations|pickObligation|owedPick|previouslyTraded|tradedPick|pickDebt|futureFirstOwed|conveyanceResult" src docs
```

**Output (relevant lines)**:
```
src/features/architect/utils/tradeMachine/rules/draftRules.js:36:  const unprotectedYears = (team.tradedPicks || [])
src/features/architect/utils/tradeMachine/rules/draftRules.js:60:  (team.tradedPicks || []).forEach((pick) => {
docs/return-packages/trade-machine-draft-picks__present-day-trade-machine-preflight__2026-01-07.md:274:**Root Cause**: Stepien validation uses `team.outgoingPicks || team.picksOut` but does NOT access `team.owedPicks` or `team.previouslyTradedPicks`.
docs/return-packages/trade-machine-draft-picks__present-day-trade-machine-preflight__2026-01-07.md:304:| G1 | **Existing obligations not considered** | Can trade consecutive picks if one is already owed | Medium — need `team.owedPicks` data structure |
```

### Command 2: Stepien Call Chain

```bash
grep -rn "validateStepien(" src
```

**Output**:
```
src/tests/tradeMachine/draftPicksPreflight.test.js:36:      const result = validateStepien({ outgoingPicks: team.picksOut }, {});
src/features/architect/utils/stepienUtils.js:107:  const result = validateStepien({ outgoingPicks: picks }, {});
src/features/architect/utils/tradeMachine/rules/draftRules.js:24:  const result = validateStepien({ outgoingPicks: picks }, {});
src/features/architect/utils/tradeMachine/rules/validateStepien.ts:24:export function validateStepien(team: TradeTeam): StepienResult {
src/features/architect/utils/tradeMachine/rules/validateStepien.js:37:export function validateStepien(team, tradeCtx = {}) {
src/features/architect/utils/tradeMachine/engine/tradeValidator.js:440:    const stepienResult = validators.validateStepien(team, context);
```

### Command 3: Pick Fields in Trade Machine

```bash
grep -rn "picksOut|outgoingPicks|draftPicks|team\.picks" src/features/architect/utils/tradeMachine src/features/architect/hooks
```

**Output (first 20 lines)**:
```
src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js:60:    picksOut: team.picksOut || [],
src/features/architect/utils/tradeMachine/utils/validateInput.js:37:  const picksOut = team.picksOut || [];
src/features/architect/utils/tradeMachine/rules/validateStepien.js:43:  const { picksOut = [], outgoingPicks = [] } = team;
src/features/architect/utils/tradeMachine/rules/validateStepien.js:50:  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;
src/features/architect/utils/tradeMachine/engine/tradeValidator.js:627:    (teams[0].picksOut || []).length === 2 &&
src/features/architect/hooks/useTradeMachine.js:235:        // Map draftPicks to picks for trade machine compatibility
src/features/architect/hooks/useTradeMachine.js:237:        const rawPicks = data.draftPicks || data.picks || [];
src/features/architect/hooks/useTradeMachine.js:271:            picksOut: [],
src/features/architect/hooks/useTradeMachine.js:430:      const existingIndex = newTeams[index].picksOut.findIndex((p) =>
src/features/architect/hooks/useTradeMachine.js:438:        newTeams[index].picksOut = [
```

### Command 4: Loader / Data Sources

```bash
grep -rn "architect_baseTeams|baseTeams|teamLoader|loadWorldTeamData|loadTeamCapSheet" src
```

**Output (first 20 lines)**:
```
src/components/diagnostic/FirestoreDataDiagnostic.jsx:47:            name: 'architect_baseTeams',
src/schemas/architect.ts:10:// Base Team Document: /architect/baseTeams/{teamCode}
src/data/firestorePaths.js:46:// Canonical paths (documentation): /architect/baseTeams/{teamCode}
src/data/firestorePaths.js:47:// Actual Firestore collections: architect_baseTeams and architect_basePlayers
src/constants/collections.ts:25: * Defaults to the canonical `architect_baseTeams` (single collection name)
src/features/architect/utils/worldTeamData.ts:20:import { loadTeamCapSheet } from '@/features/architect/utils/firebaseTeamPlanHelpers';
src/features/architect/utils/worldTeamData.ts:81:export async function loadWorldTeamData(
src/features/architect/utils/worldTeamData.ts:94:      return await loadTeamCapSheet(teamId);
src/features/architect/utils/firebaseTeamPlanHelpers.js:178:export const loadTeamCapSheet = async (teamId) => {
```

---

## Acceptance Criteria Verification

| Criterion | Met? | Evidence |
|-----------|------|----------|
| 1. Definitive answer: Does obligations field exist? | ✅ **NO** | T1 search returned zero hits for runtime code |
| 2. Exact location of team object construction for present-day validation | ✅ | T2: `tradeValidator.js:345-378`, `useTradeMachine.js:233-244` |
| 3. Exact Firestore collections feeding pick data | ✅ | T3/T4: `architect_baseTeams/{teamCode}` via `loadTeamCapSheet()` |
| 4. Clear minimal execution wiring plan | ✅ | T5: Option A (add `owedPicks` to schema/loader) recommended |

---

## Conclusion

**The repo does NOT have an obligations field today.** Stepien validation only considers picks being traded in the current transaction (`picksOut`/`outgoingPicks`), NOT existing obligations from prior trades.

**Minimal wiring for execution phase**:
1. Add `owedPicks` field to `BaseTeamDocZ` schema (with `|| []` default)
2. Return `owedPicks: baseDoc.owedPicks || []` in `hydrateBaseTeam()`
3. Merge `owedPicks` with `outgoingPicks` in `validateStepien()` before consecutive year check

**Data requirement**: Firestore base team documents need to be populated with `owedPicks` arrays (separate data task).
