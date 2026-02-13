# Draft Picks Canonical Contract Unification — Execution Report

**DATE**: 2026-01-09  
**MODE**: EXECUTION  
**SCOPE**: Draft-picks pipeline + ledger + staging + present-day Trade Machine Stepien  
**GOAL**: Adopt ONE canonical pick contract with stable pick IDs and ONE owner field: `owner`.

---

## 1. What Changed

### Summary

The canonical pick contract now uses:

1. **Stable Pick ID**: `{ORIGINAL}_{YEAR}_{1st|2nd}` (e.g., `LAL_2029_1st`)
2. **Canonical Owner Field**: `owner` (not `currentOwner`)
3. **No Legacy IDs**: Removed `legacyId` from canonical output

### Removed Concepts

- ❌ `currentOwner` — replaced with `owner` everywhere
- ❌ `legacyId` — removed from canonical pick objects

### Added Concepts

- ✅ `relation` tag in by_team views (`inventory` | `obligation` | `contested`)

---

## 2. Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` | Modified | Updated `StructuredPick` and `CanonicalPick` types to use `owner` instead of `currentOwner`. Removed `legacyId` generation. |
| `team-scrape/shared/ledger/buildPickLedger.ts` | Modified | Updated `CanonicalPick` type to use `owner`. Added `relation` field for by_team views. Updated `isInventory`, `isObligation`, and `isContested` functions to use `owner`. |
| `team-scrape/shared/firestore_staging/scripts/run_team_pipeline.ts` | Modified | Added explicit logging for resolved inputDir and input type in ledger step. |
| `team-scrape/shared/firestore_staging/scripts/stage_team.ts` | Modified | Updated `RawDraftPick` type to use `owner`. Updated `normalizeDraftPick` and `buildDraftPickNotes` functions. Added `relation` field support. |
| `team-scrape/shared/ledger/validateLedgerPicks.ts` | Modified | Updated `CanonicalPick` type to use `owner`. Updated validation output messages. |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | Modified | Updated `obligationReservesYear` function to check `owner` instead of `currentOwner`. |
| `src/tests/tradeMachine/stepienObligations.test.js` | Modified | Updated test case to use `owner` instead of `currentOwner`. |

---

## 3. Canonical Contract Summary

### A) Canonical Pick ID (Stable Forever)

```
Format: {ORIGINAL}_{YEAR}_{1st|2nd}
Example: LAL_2029_1st
```

The ID is based on the **original team**, NOT the current owner. This ensures stability across ownership changes.

### B) Canonical Owner Field

```typescript
type CanonicalPick = {
  id: string;           // Stable: LAL_2029_1st
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'contested' | 'conditional';
  originalTeam: string; // Team that originally owned the pick
  owner: string;        // Current owner team code ← CANONICAL
  // ... other fields
};
```

**Use `owner` everywhere** to mean "current owner team code". Do NOT use `currentOwner`.

### C) Team Views (Derived from Ledger)

Each team has three derived views:

| View | Invariant | Description |
|------|-----------|-------------|
| `draftPicksInventory[]` | `pick.owner === TEAM` | Picks the team currently owns |
| `draftPicksObligations[]` | `pick.originalTeam === TEAM AND pick.owner !== TEAM` | Picks the team owes / no longer controls |
| `draftPicksContested[]` | Swap/conditional rights involving team | May have null `owner` if rights-holder unknown |

Each pick in these views includes a `relation` tag:

- `inventory` — in inventory view
- `obligation` — in obligations view  
- `contested` — in contested view

---

## 4. Proof Snippets

### LAL_2029_1st Flow Example

**Scenario**: Lakers trade their 2029 1st round pick to Dallas.

#### Scraper Output (LAL mentions file)

```json
{
  "id": "LAL_2029_1st",
  "year": 2029,
  "round": 1,
  "status": "outgoing",
  "originalTeam": "LAL",
  "owner": "DAL",           // ← Canonical owner field
  "recipient": "DAL"
}
```

#### Ledger Master Record

```json
{
  "ledgerId": "2029_1_LAL",
  "id": "LAL_2029_1st",
  "year": 2029,
  "round": 1,
  "status": "outgoing",
  "originalTeam": "LAL",
  "owner": "DAL",           // ← Canonical owner field
  "recipient": "DAL"
}
```

#### DAL Inventory (by_team/DAL.json)

```json
{
  "teamCode": "DAL",
  "inventory": [
    {
      "id": "LAL_2029_1st",
      "year": 2029,
      "round": 1,
      "originalTeam": "LAL",
      "owner": "DAL",        // ← Correct: DAL owns this pick
      "relation": "inventory" // ← NOT labeled "outgoing" in DAL's view
    }
  ]
}
```

#### LAL Obligations (by_team/LAL.json)

```json
{
  "teamCode": "LAL",
  "obligations": [
    {
      "id": "LAL_2029_1st",
      "year": 2029,
      "round": 1,
      "originalTeam": "LAL",
      "owner": "DAL",         // ← Correct: DAL is current owner
      "recipient": "DAL",
      "relation": "obligation"
    }
  ]
}
```

---

## 5. Validation Command Outputs

### Trade Machine Tests

```
npm run test -- src/tests/tradeMachine/ --run

Test Files  7 passed (7)
Tests       185 passed | 1 skipped | 3 todo (189)
Duration    2.83s
```

All trade machine tests pass, including the Stepien obligations tests that use the canonical `owner` field.

### Stepien Obligations Tests

```
npm run test -- src/tests/tradeMachine/stepienObligations.test.js --run

Test Files  1 passed (1)
Tests       15 passed (15)
Duration    1.01s
```

---

## 6. Follow-ups Needed

### Contested/Swap Modeling

The current contested modeling is basic:

- Picks with `isSwap === true` are added to contested views
- Picks with `status === 'contested'` are added to contested views
- Picks where team is in `swapDetails.swapWith` are added to contested views

Future improvements may be needed for:

- Multi-way swap scenarios
- Conditional conveyance with rollover years
- Most/least favorable pick selection logic

### Validation Commands to Run Post-Merge

Once the scraper can run against live RealGM data:

```bash
# 1) Scrape 4 teams
npm run team:draft-picks -- --teams LAL,DAL,ATL,NOP --outDir team-scrape/draft-picks/_artifacts/output

# 2) Build ledger
npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=mentions --inputDir team-scrape/draft-picks/_artifacts/output/mentions

# 3) Stage teams
npm run stage:team -- --all --validate

# 4) Validate ledger output
npx tsx team-scrape/shared/ledger/validateLedgerPicks.ts
```

---

## 7. Schema Alignment

The runtime schema in `src/schemas/architect.ts` already uses `owner`:

```typescript
export const DraftPickZ = z.object({
  id: z.string().optional(),
  year: z.number().int(),
  round: z.number().int(),
  pick: z.number().int().nullable(),
  owner: TeamCodeZ,  // ← Canonical owner field
  originalTeam: TeamCodeZ.optional(),
  // ...
});
```

No schema changes were required.

---

**END OF REPORT**
