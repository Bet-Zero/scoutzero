# RETURN PACKAGE: Pipeline Draft Picks Ledger — PREFLIGHT

**Date:** 2026-01-08  
**Mode:** PREFLIGHT (repo inspection ONLY — NO code changes)  
**Status:** ✅ COMPLETE

---

## Executive Summary

This preflight inspection documents the complete team data pipeline from scrape to Firestore push. The pipeline consists of four main stages:

1. **Team Data Scrape** (SalarySwish) → `team_scrape/team-data/scripts/parse_team.ts`
2. **Draft Picks Scrape** (RealGM) → `team_scrape/draft-picks/scripts/realgm_draft_picks.ts`
3. **Merge Step** → `team_scrape/shared/review_and_merge/scripts/merge_team_outputs.ts`
4. **Firestore Push** → `team_scrape/shared/firestore_staging/scripts/push_staged_teams.ts`

**Root Cause for Missing "Received Picks":** The RealGM scraper **only outputs picks that the scraped team currently owns**, filtering by `pick.currentOwner === entry.code`. There is **no league-wide ledger pass** that distributes picks to recipient teams. Each team's file only contains picks from that team's perspective.

---

## T1) Firestore Push Entry Point(s)

### File Path
```
team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts
```

### Function Names
- `pushTeam()` — writes a single team document to Firestore
- `pushTeamWithRetry()` — wrapper with retry logic
- `main()` — orchestrates the push for all specified teams

### Collection Written
```typescript
const BASE_TEAMS_COLLECTION = 'architect_baseTeams';
```

### Excerpt (Lines 107-114)
```typescript
async function pushTeam(teamCode: string, stageDir: string) {
  const baseTeamPath = path.join(stageDir, 'baseTeams', `${teamCode}.json`);
  const baseTeamDoc = await loadJson<Record<string, unknown>>(baseTeamPath);

  await db.collection(BASE_TEAMS_COLLECTION).doc(teamCode).set(baseTeamDoc);

  console.log(`✅ Pushed ${teamCode}`);
}
```

### Firebase Admin Initialization (Lines 30-40)
```typescript
const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
const STAGE_DIR = path.resolve('team-scrape/shared/firestore_staging/_artifacts/output');

const BASE_TEAMS_COLLECTION = 'architect_baseTeams';

const serviceAccount = await readFile(SERVICE_ACCOUNT_PATH, 'utf8').then(
  JSON.parse
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
```

---

## T2) Draft Picks Scrape/Parse Pipeline

### File Path
```
team-scrape/draft-picks/scripts/realgm_draft_picks.ts
```

### Key Functions
- `scrapeTeamPage()` — fetches and parses RealGM team page
- `toStructured()` — converts raw row to StructuredPick objects
- `toCanonicalPick()` — maps StructuredPick to CanonicalPick
- `writePerTeamStructured()` — writes output to JSON file

### Produced Pick Object Schema (Lines 274-395)
```typescript
type StructuredPick = {
  id: string;
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'conditional' | 'contested';
  originalTeam: string;
  currentOwner: string;

  // CORE: Stepien & Trading Info
  stepienEligible: boolean;
  tradeable: boolean;

  // OPTIONAL: Conveyance details (only if there's an obligation)
  conveyanceObligation?: ConveyanceObligation;

  // Basic pick info
  protection?: string | null;
  isSwap: boolean;
  conditions?: PickCondition[];
  conditionalRecipient?: string;

  // Standard fields
  recipient?: string;
  via?: string;
  pickNumber?: number | null;
  protectionDetails?: string;
  swapDetails?: {
    swapType?: 'bilateral' | 'multiway' | 'favorable' | 'unknown';
    swapWith?: string[];
    favorable?: 'most' | 'least' | null;
  };
  conveysIf?: string[];
  otherwise?: string[];
  route?: string[];
  detailUrl?: string;
  dependsOn?: string[];
  title?: string;
  contendingTeams?: string[];
  tradedOn?: string;
};

type CanonicalPick = {
  id: string;
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'contested' | 'conditional';
  originalTeam: string;
  currentOwner: string;
  stepienEligible: boolean;
  tradeable: boolean;
  protection?: string | null;
  isSwap: boolean;
  via?: string;
  recipient?: string;
  pickNumber?: number | null;
  detailUrl?: string;
  title?: string;
  notes?: string;
  contendingTeams?: string[];
  tradedOn?: string;
  route?: string[];
  conveyanceObligation?: ConveyanceObligation;
  swapDetails?: StructuredPick['swapDetails'];
  dependsOn?: string[];
};
```

### Output Location
```
team-scrape/draft-picks/output/structured/draft_picks_{TEAM}.json
```

---

## T3) Team Data Scrape/Parse Pipeline

### File Path
```
team-scrape/team-data/scripts/parse_team.ts
```

### Key Functions
- `main()` — orchestrates the scrape and parse
- `findHeading()` — locates section headers
- `forwardUntilNextH3()` — traverses DOM between sections

### Produced Team Object Schema (Lines 672-740)
```typescript
const teamDoc = {
  teamCode,
  teamName,
  season,

  roster, // player refs; IDs resolved later by mapper
  deadCap: [], // not on this page (requires transaction history)
  capHolds, // parsed from cap holds tables

  exceptions: {
    mle: mle || undefined,
    taxpayerMle: undefined,
    room: room || undefined,
    bae: bae || undefined,
    dpe: undefined,
    tpe,
  },

  draftPicks, // populated from draft table (+ optional enrich)

  totals: {
    // Core salary totals
    totalSalary: totalsBox.totalSalary,
    activeSalary: totalsBox.activeSalary,
    deadCapTotal: totalsBox.deadCapTotal || 0,
    capHoldsTotal: totalsBox.capHoldsTotal,
    guaranteedSalary: totalsBox.guaranteedSalary,

    // Roster counts
    rosterCount: totalsBox.rosterCount,
    twoWayCount: totalsBox.twoWayCount,

    // Cap space calculations
    salaryCap: totalsBox.salaryCap,
    capSpace: totalsBox.capSpace,

    // Luxury tax
    luxuryTaxLine: totalsBox.luxuryTaxLine,
    taxSpace: totalsBox.luxuryTaxRoom,

    // Aprons
    firstApronLine: totalsBox.firstApronLine,
    firstApronRoom: totalsBox.firstApronRoom,
    firstApronTriggered: totalsBox.firstApronRoom < 0,

    secondApronLine: totalsBox.secondApronLine,
    secondApronRoom: totalsBox.secondApronRoom,
    secondApronTriggered: totalsBox.secondApronRoom < 0,

    // Hard cap
    capHit: totalsBox.capHit,
    hardCapLevel: totalsBox.hardCapLevel || 'none',
    hardCapDetail: totalsBox.hardCapDetail,

    // Additional details
    incompleteRosterCharges: totalsBox.incompleteRosterCharges,
    likelyIncentives: totalsBox.likelyIncentives,
    unlikelyIncentives: totalsBox.unlikelyIncentives,
  },

  source: {
    provider: 'SalarySwish',
    teamPageUrl: TEAM_URL,
    scrapedAt: new Date().toISOString(),
  },
  lastUpdated: new Date().toISOString(),
  version: '1.0',
};
```

### Output Location
```
team-scrape/team-data/output/team_{CODE}.json
```

---

## T4) Merge Step

### File Path
```
team-scrape/shared/review_and_merge/scripts/merge_team_outputs.ts
```

### Key Functions
- `mergeTeamData()` — combines salary data and draft picks
- `groupDraftPicksByStatus()` — organizes picks into incoming/outgoing/own/contested
- `normalizeDraftPickForTeam()` — adds owner field for schema alignment
- `loadSalaryData()` — reads team salary JSON
- `loadDraftPickData()` — reads draft picks JSON

### Merge Logic Excerpt (Lines 351-430)
```typescript
function mergeTeamData(
  salaryData: SalaryData | null,
  draftPicks: DraftPick[],
  teamCode: string
): MergedTeamData {
  const now = new Date().toISOString();

  // 1) Filter to picks that this team currently owns (assignment by currentOwner)
  const ownedByTeam = (draftPicks || []).filter(
    (p) => p.currentOwner === teamCode
  );

  // 2) Add season/owner fields for schema alignment
  const normalizedOwned = ownedByTeam.map((p) => normalizeDraftPickForTeam(p));

  // 3) Build a flat list of tradable picks for Trade Machine convenience
  const tradablePicks = normalizedOwned
    .filter((p) => p.tradeable)
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.round - b.round));

  // ... rest of merge logic
```

### How Draft Picks are Attached
The merge step reads from two separate directories and combines them:
1. Salary data from `team-scrape/team-data/output/team_{CODE}.json`
2. Draft picks from `team-scrape/draft-picks/output/structured/draft_picks_{CODE}.json`

Output is written to:
```
team-scrape/shared/firestore_staging/output/merged/{CODE}_merged.json
```

---

## T5) Current Ownership/Recipient Logic — Root Cause Analysis

### Evidence: No League-Wide Distribution

**Key Finding:** The pipeline does **NOT** distribute picks to recipient teams across the league.

**Location of the critical filter (`realgm_draft_picks.ts`, lines 1498-1506):**
```typescript
const canonical = teamStructured
  .filter((pick) => pick.currentOwner === entry.code)  // ⚠️ ONLY outputs picks owned by THIS team
  .map(toCanonicalPick)
  .sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });
await writePerTeamStructured(entry.code, canonical);
```

### What This Means

1. **Outgoing picks are recorded** — When Lakers scrape shows "2027 1st to Utah", the pick is created with:
   - `originalTeam: 'LAL'`
   - `currentOwner: 'UTA'` (or sometimes remains 'LAL' if protected)
   - `status: 'outgoing'`
   - `recipient: 'UTA'`

2. **BUT these outgoing picks are filtered OUT** — Because the scraper filters by `currentOwner === entry.code`, the Lakers output file will NOT contain picks where `currentOwner !== 'LAL'`.

3. **Incoming picks are only visible** if the recipient team's page is scraped AND the RealGM page shows them as incoming (e.g., "via LAL").

4. **NO LEAGUE LEDGER** — There is no step that:
   - Collects all picks from all 30 teams
   - Redistributes them based on `recipient` / `currentOwner`
   - Creates a unified ledger where each team sees both owned AND incoming picks

### Searches Performed

```bash
# Search for "distribution" or "ledger" logic
rg -n "distribute|ledger|league-wide|all.*teams|cross.*team" team-scrape
# Result: No matches related to pick distribution

# Search for where picks are assigned to recipient
rg -n "recipient.*owner|owner.*recipient|incoming.*filter" team-scrape
# Result: Only found the filter that REMOVES picks from output
```

### Root Cause Verdict

**"No distribution found"** — The pipeline operates per-team without a league-wide reconciliation pass. Each team file only contains picks from that team's perspective on RealGM.

---

## T6) Minimal "Ledger Builder" Insertion Plan

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CURRENT PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  RealGM Scrape (all 30 teams)                                           │
│       ↓                                                                  │
│  Per-team structured JSON  ← INSERTION POINT 1 (pre-filter)             │
│       ↓                                                                  │
│  Filter by currentOwner                                                  │
│       ↓                                                                  │
│  Per-team output files                                                   │
│       ↓                                                                  │
│  Merge with salary data                                                  │
│       ↓                                                                  │
│  stage_team.ts  ← INSERTION POINT 2 (post-merge, pre-push)              │
│       ↓                                                                  │
│  push_staged_teams.ts → Firestore                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Insertion Point

**Location:** NEW file at `team-scrape/shared/ledger/buildPickLedger.ts`

**Called from:** `team-scrape/shared/firestore_staging/scripts/run_full_team_scrape.ts`  
(Add as Step 1.5 between RealGM scrape and SalarySwish staging)

### Proposed Functions

```typescript
// team-scrape/shared/ledger/buildPickLedger.ts

/**
 * Aggregates all raw picks from all 30 team files into a single ledger.
 * Each pick appears ONCE with canonical ownership info.
 */
function buildPickLedger(rawPicksByTeam: Map<string, RawDraftPick[]>): LedgerRecord[] {
  // 1. Deduplicate picks by (year, round, originalTeam)
  // 2. Assign canonical currentOwner based on trade chains
  // 3. Track contested/conditional picks separately
}

/**
 * Derives per-team views from the ledger.
 * Each team gets three views: inventory, obligations, contested.
 */
function deriveTeamPickViews(ledgerRecords: LedgerRecord[]): {
  inventoryByTeam: Map<string, DraftPick[]>;    // Picks this team OWNS
  obligationsByTeam: Map<string, DraftPick[]>;  // Picks this team OWES
  contestedByTeam: Map<string, DraftPick[]>;    // Swaps/conditional involving this team
}
```

### Integration Steps (Planning Only)

1. **Modify `run_team_pipeline.ts`** — Add ledger build step after RealGM scrape
2. **Create `buildPickLedger.ts`** — New module in `team-scrape/shared/ledger/`
3. **Modify `stage_team.ts`** — Read from ledger views instead of raw per-team files
4. **Output new files:**
   - `_artifacts/output/ledger/pick_ledger.json` (master ledger)
   - `_artifacts/output/ledger/by_team/{CODE}_picks.json` (derived views)

### Why This Location?

1. **After all teams scraped** — Ledger needs complete data from all 30 teams
2. **Before staging** — Derived views replace raw per-team files for staging
3. **Separate module** — Clean separation of concerns; ledger logic is isolated
4. **Backwards compatible** — Existing per-team files can still be generated for debugging

---

## Pipeline Map (Call Graph)

```
                    ┌────────────────────────────────────┐
                    │         npm run team:full          │
                    │  (run_team_pipeline.ts)            │
                    └────────────────┬───────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         │                         ▼
┌──────────────────────┐             │             ┌──────────────────────┐
│ Step 1/2: RealGM     │             │             │ Step 2/2: SalarySwish│
│ realgm_draft_picks.ts│             │             │ run_full_team_scrape │
└──────────┬───────────┘             │             └──────────┬───────────┘
           │                         │                        │
           ▼                         │                        ▼
┌──────────────────────┐             │             ┌──────────────────────┐
│ draft_picks_{CODE}   │             │             │ team_{CODE}.json     │
│ .json                │             │             │ (salary data)        │
└──────────┬───────────┘             │             └──────────┬───────────┘
           │                         │                        │
           └───────────────┬─────────┘                        │
                           │                                  │
                           ▼                                  │
              ┌────────────────────────┐                      │
              │ merge_team_outputs.ts  │◄─────────────────────┘
              │ (combines both sources)│
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ stage_team.ts          │
              │ (creates baseTeam doc) │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ push_staged_teams.ts   │
              │ → architect_baseTeams  │
              └────────────────────────┘
```

---

## Command Outputs (C1-C4)

### C1) Firestore Writes Search
```bash
rg -n "firebase-admin|initializeApp|firestore|writeBatch|batch\.set|setDoc|updateDoc|architect_baseTeams|architect_basePlayers" team-scrape
```
**Results:**
- `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts:14`: `import admin from 'firebase-admin';`
- `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts:30`: `const BASE_TEAMS_COLLECTION = 'architect_baseTeams';`
- `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts:36`: `admin.initializeApp({...})`
- `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts:40`: `const db = admin.firestore();`
- `team-scrape/shared/firestore_staging/scripts/push_staged_teams.ts:111`: `await db.collection(BASE_TEAMS_COLLECTION).doc(teamCode).set(baseTeamDoc);`

### C2) Draft Picks Keywords Search
```bash
rg -n "draftPicks|conveyance|protection|isSwap|swapType|originalTeam|owner|recipient|route|via|contested|incoming|outgoing" team-scrape
```
**Results:** 100+ matches across:
- `realgm_draft_picks.ts` — primary scraper with all pick fields
- `merge_team_outputs.ts` — grouping logic for incoming/outgoing/own/contested
- `stage_team.ts` — normalization for Firestore
- `validate_pick_parsing.ts` — validation checks

### C3) Merge Keywords Search
```bash
rg -n "merge|combine|hydrate|compose|buildTeam|attach.*draftPicks|draftPicks|picks" team-scrape
```
**Results:** Key matches in:
- `merge_team_outputs.ts:351`: `function mergeTeamData(...)`
- `merge_team_outputs.ts:358`: Filter by `currentOwner === teamCode`

### C4) Pipeline Entrypoints Search
```bash
rg -n "scrape|parser|parse|pipeline|push|upload|seed|import" team-scrape
```
**Results:** Entry points confirmed:
- `parse_team.ts` — SalarySwish parsing
- `realgm_draft_picks.ts` — RealGM scraping
- `run_team_pipeline.ts` — Combined pipeline orchestration
- `push_staged_teams.ts` — Firestore push

---

## Summary

| Task | Status | Finding |
|------|--------|---------|
| T1: Firestore Push | ✅ | `push_staged_teams.ts` → `architect_baseTeams` collection |
| T2: Draft Picks Pipeline | ✅ | `realgm_draft_picks.ts` with comprehensive pick schema |
| T3: Team Data Pipeline | ✅ | `parse_team.ts` for SalarySwish cap data |
| T4: Merge Step | ✅ | `merge_team_outputs.ts` combines both sources |
| T5: Recipient Logic | ✅ | **No distribution found** — picks filtered by currentOwner per team |
| T6: Ledger Insertion | ✅ | New module at `team-scrape/shared/ledger/buildPickLedger.ts` |

**Next Steps:**
1. Create `buildPickLedger.ts` module with aggregation logic
2. Integrate into `run_team_pipeline.ts` as Step 1.5
3. Modify `stage_team.ts` to consume ledger views
4. Test with all 30 teams to validate complete pick coverage
