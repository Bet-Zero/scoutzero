# RETURN PACKAGE: Draft Picks Pipeline — Ingredients Fix (Mentions Output)

**Date:** 2026-01-08  
**Mode:** PREFLIGHT (repo inspection ONLY — NO code changes)  
**Status:** ✅ COMPLETE

---

## 1) Executive Summary

### What's Broken

The RealGM draft-picks pipeline has a **critical filtering bug** that drops all "mentioned" picks from per-team outputs. The pipeline **correctly parses** outgoing/incoming picks like "LAL 2029 1st → DAL" during scraping, but a filter at line 1500 in `realgm_draft_picks.ts` discards any pick where `currentOwner !== entry.code`.

**Result:** Each team's output file only contains picks they currently own. Traded-away picks disappear even though they were correctly parsed, and the downstream ledger builder cannot create them "out of thin air."

### Why The Ledger Can't Fix It

The ledger builder (`team-scrape/shared/ledger/buildPickLedger.ts`) aggregates from per-team output files. It consumes:

- `team-scrape/draft-picks/_artifacts/output/structured/draft_picks_{TEAM}.json`

If a pick is filtered out of the per-team file before writing, it never reaches the ledger. The ledger's deduplication and distribution logic is sound, but it has no raw data to work with for dropped picks.

### Key Example: LAL 2029 1st → DAL

1. **Parse Phase:** RealGM text "2029: To DAL" is correctly parsed by `parseTo()` and `detectStatus()`
2. **Structured Object Created:**
   - `originalTeam: 'LAL'`
   - `currentOwner: 'DAL'`
   - `status: 'outgoing'`
   - `recipient: 'DAL'`
3. **Filter Applied:** At line 1500: `pick.currentOwner === entry.code` → `'DAL' === 'LAL'` → **FALSE**
4. **Pick Dropped:** Never written to `draft_picks_LAL.json`
5. **Not in Dallas File Either:** Dallas scrape would need to parse it as "incoming" from their page

---

## 2) Current Pipeline Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RealGM Draft Picks Pipeline                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │ npm run team:draft-picks                                             │
│  │ or npm run realgm:drafts                                             │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ realgm_draft_picks.ts                                            │    │
│  │ ─────────────────────                                            │    │
│  │ 1. fetchTeamHtml() → Playwright browser scrape                   │    │
│  │ 2. scrapeTeamPage() → Parse h2/h3 headers for 1st/2nd round      │    │
│  │ 3. parseCompressedPickData() → Extract year + description        │    │
│  │ 4. toStructured() → Create StructuredPick objects                │    │
│  │    ├─ detectStatus() → 'own'|'outgoing'|'incoming'|'contested'   │    │
│  │    ├─ parseTo() → Extract recipient team code                    │    │
│  │    ├─ parseVia() → Extract via team code                         │    │
│  │    └─ generatePickId() → Create pick ID                          │    │
│  │ 5. toCanonicalPick() → Map to output schema                      │    │
│  │                                                                   │    │
│  │ ⚠️  FILTER (line 1500):                                           │    │
│  │     .filter(pick => pick.currentOwner === entry.code)            │    │
│  │                                                                   │    │
│  │ 6. writePerTeamStructured() → Write JSON file                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Output: team-scrape/draft-picks/_artifacts/output/structured/    │    │
│  │         draft_picks_{TEAM}.json                                  │    │
│  │                                                                   │    │
│  │ ❌ ONLY contains picks where currentOwner === TEAM               │    │
│  │ ❌ Outgoing picks are DROPPED                                     │    │
│  │ ❌ Incoming picks depend on RealGM listing them                   │    │
│  └────────┬────────────────────────────────────────────────────────┘    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ buildPickLedger.ts                                               │    │
│  │ ─────────────────                                                │    │
│  │ • Reads all 30 team files                                        │    │
│  │ • Deduplicates by ledgerId                                       │    │
│  │ • Derives per-team views (inventory/obligations/contested)       │    │
│  │                                                                   │    │
│  │ ⚠️ Cannot create picks that were filtered out upstream!          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3) Evidence: Dropping Filter

### File Path

```
team-scrape/draft-picks/scripts/realgm_draft_picks.ts
```

### Exact Code Block (Lines 1494-1506)

```typescript
// Per-team STRUCTURED
const teamStructured: StructuredPick[] = [];
for (const r of rows) {
  teamStructured.push(...toStructured(r, 1));
  teamStructured.push(...toStructured(r, 2));
}
const canonical = teamStructured
  .filter((pick) => pick.currentOwner === entry.code)  // ⚠️ THE FILTER
  .map(toCanonicalPick)
  .sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });
await writePerTeamStructured(entry.code, canonical);
```

### Explanation

- `teamStructured` contains ALL picks parsed from the team's RealGM page, including outgoing picks with `currentOwner` set to the recipient team.
- The `.filter((pick) => pick.currentOwner === entry.code)` removes any pick where the current owner is NOT the scraped team.
- For Lakers (`entry.code === 'LAL'`), any pick with `currentOwner === 'DAL'` (like the 2029 1st) is filtered out.

### Fields Available at Filter Point

The `StructuredPick` object at this point contains (from lines 331-370):

```typescript
type StructuredPick = {
  id: string;
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'conditional' | 'contested';
  originalTeam: string;
  currentOwner: string;
  stepienEligible: boolean;
  tradeable: boolean;
  protection?: string | null;
  isSwap: boolean;
  conditions?: PickCondition[];
  conditionalRecipient?: string;
  recipient?: string;
  via?: string;
  route?: string[];
  // ... additional fields
};
```

---

## 4) Evidence: LAL 2029 → DAL Trace

### Where Parsed

**Function:** `parseTo()` (lines 578-614)

```typescript
function parseTo(text: string): string | undefined {
  // First try to match team codes (2-3 uppercase letters)
  const codeMatch = text.match(/\bto\s+([A-Z]{2,3})(?:\b|$)/i);

  if (codeMatch) {
    const teamCode = codeMatch[1];
    // ... code variation mapping ...
    if (isValidCode) {
      return normalizedCode;
    }
  }
  // Fallback to full team name matching
  const nameMatch = text.match(/\bto\s+([A-Z][A-Za-z .'\-]+?)(?:\s|[.;,)|]|$)/);
  // ...
}
```

### Where Status Detected

**Function:** `detectStatus()` (lines 525-544)

```typescript
function detectStatus(text: string): StructuredPick['status'] {
  const t = text.toLowerCase();

  // Check for contested/swap picks FIRST
  if (/(most|least)\s+favorable/i.test(text)) return 'contested';

  if (/^\s*to\s+/i.test(text)) return 'outgoing';  // ← Catches "To DAL"
  if (/\bto\s+/.test(t)) return 'outgoing';
  if (/\bvia\s+/.test(t) || /\bincoming\b/.test(t)) return 'incoming';
  // ...
}
```

### Object Created

For RealGM text "2029: To DAL", `toStructured()` creates:

```typescript
{
  id: 'LAL_2029_1st_to_DAL',
  year: 2029,
  round: 1,
  status: 'outgoing',
  originalTeam: 'LAL',
  currentOwner: 'DAL',  // ← Set because toTeam exists
  recipient: 'DAL',
  stepienEligible: false,
  tradeable: false,
  protection: null,
  isSwap: false
}
```

### Why Dropped

At line 1500:

```typescript
.filter((pick) => pick.currentOwner === entry.code)
```

For Lakers scrape: `'DAL' === 'LAL'` → `false` → **Pick filtered out**

### Not Created from Dallas Side

Dallas's RealGM page would need to show "2029 LAL 1st (via LAL)" for the pick to appear in their file. If RealGM doesn't list incoming picks explicitly on the recipient team's page, the pick is lost entirely.

---

## 5) Current Output Files

### Patterns and Locations

| Output Type | Path Pattern | Contents |
|-------------|--------------|----------|
| Per-team structured | `team-scrape/draft-picks/_artifacts/output/structured/draft_picks_{CODE}.json` | Only picks where `currentOwner === TEAM` |
| Default output dir | `team-scrape/draft-picks/output/` | CLI default if `--outDir` not specified |

### npm Scripts

From `package.json`:

```json
{
  "team:draft-picks": "tsx team-scrape/draft-picks/scripts/realgm_draft_picks.ts --outDir team-scrape/draft-picks/_artifacts/output",
  "realgm:drafts": "tsx team-scrape/draft-picks/scripts/realgm_draft_picks.ts"
}
```

### CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--teams` | All 30 NBA teams | Comma-separated team codes (e.g., `--teams LAL,DAL,OKC`) |
| `--outDir` | `team-scrape/draft-picks/output` | Output directory |
| `--pretty` | false | Pretty-print JSON output |

### Current Output Files (Per Team)

Each team gets a single file: `draft_picks_{CODE}.json`

**Example structure of `draft_picks_LAL.json`:**

```json
[
  {
    "id": "LAL_2026_1st",
    "year": 2026,
    "round": 1,
    "status": "own",
    "originalTeam": "LAL",
    "currentOwner": "LAL",
    "stepienEligible": true,
    "tradeable": true,
    "protection": null,
    "isSwap": false
  }
  // ... only picks LAL currently owns
]
```

**Missing from output:** Outgoing picks like LAL 2029 1st → DAL

---

## 6) Recommended Output Plan

### Option A (Recommended): Add "Mentions" Output

Create a new output file per team that includes ALL picks mentioned on that team's page:

#### Proposed Output Files

| File Pattern | Contents | Purpose |
|--------------|----------|---------|
| `draft_picks_mentions_{TEAM}.json` | ALL picks from team's RealGM page | Complete data for ledger builder |
| `draft_picks_inventory_{TEAM}.json` | Only picks team owns (current behavior) | Convenience for quick lookups |

#### Where to Implement

**File:** `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`

**Add after line 1498:**

```typescript
// Write ALL mentions (before filtering)
await writeMentionsFile(entry.code, teamStructured.map(toCanonicalPick));

// Then write inventory (filtered, as today)
const canonical = teamStructured
  .filter((pick) => pick.currentOwner === entry.code)
  .map(toCanonicalPick)
  // ...
await writePerTeamStructured(entry.code, canonical);
```

**New function to add:**

```typescript
async function writeMentionsFile(code: string, picks: CanonicalPick[]) {
  const dir = path.join(OUT_DIR, 'mentions');
  await ensureDir(dir);
  const p = path.join(dir, `draft_picks_mentions_${code}.json`);
  await fs.writeFile(p, serialize(picks), 'utf8');
  return p;
}
```

### Option B: Mentions Only (Kill Inventory)

Only output "mentions" files, remove the filtering step entirely. The ledger builder would derive inventory views.

**Pros:** Simpler, single source of truth  
**Cons:** Breaking change for any code expecting current file structure

### Recommendation

**Use Option A** — Add "mentions" output alongside existing "inventory" output. This is non-breaking and allows the ledger builder to consume complete data while maintaining backwards compatibility.

### Ledger Builder Consumption

**File:** `team-scrape/shared/ledger/buildPickLedger.ts`

**Current read path (line 86-93):**

```typescript
const DEFAULT_INPUT_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  '_artifacts',
  'output',
  'structured'
);
```

**Change to:**

```typescript
const DEFAULT_INPUT_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  '_artifacts',
  'output',
  'mentions'  // Read from mentions directory
);
```

---

## 7) Current ID Strategy

### ID Generation Code

**Function:** `generatePickId()` (lines 680-688)

```typescript
function generatePickId(
  teamCode: string,
  year: number,
  round: number,
  suffix?: string
): string {
  const base = `${teamCode}_${year}_${round === 1 ? '1st' : '2nd'}`;
  return suffix ? `${base}_${suffix}` : base;
}
```

### Current ID Examples

| Pick Type | Example Text | Generated ID |
|-----------|--------------|--------------|
| Own pick | "Own" | `LAL_2026_1st` |
| Outgoing | "To DAL" | `LAL_2029_1st_to_DAL` |
| Incoming via | "via PHI" | `PHI_2026_1st_from_PHI` |
| Conditional | "1-4 Own; 5-30 to UTH" | `LAL_2027_1st_conditional` |
| Contested | "Most favorable" | `OKC_2026_1st_contested` |
| Swap | "Swap with BOS" | `LAL_2026_1st_swap` |
| Protected | "Top-4 protected" | `LAL_2027_1st_protected` |

### Where Suffixes Are Applied

**In `toStructured()` (lines 1024-1037):**

```typescript
let idSuffix = '';
if (status === 'outgoing' && toTeam) {
  idSuffix = `to_${toTeam}`;
} else if (status === 'incoming' && (via || teamCodePrefix)) {
  const sourceTeam = via || teamCodePrefix;
  idSuffix = `from_${sourceTeam}`;
} else if (status === 'contested') {
  idSuffix = 'contested';
} else if (swap.isSwap) {
  idSuffix = 'swap';
} else if (protection) {
  idSuffix = 'protected';
}
```

---

## 8) ID Conflict Cases

### Conflict 1: Protection Baked Into ID

**Problem:** Protected picks include protection in ID, making it unstable if protection changes.

**Example:**

- LAL 2027 1st initially: `LAL_2027_1st_conditional`
- If protection conveys and becomes unprotected: ID would change

**Issue:** IDs should be stable across protection changes.

### Conflict 2: Ambiguous Swap IDs

**Problem:** Swap picks use generic `_swap` suffix without specifying swap partner.

**Example:**

- LAL swaps with BOS: `LAL_2026_1st_swap`
- LAL swaps with NYK: `LAL_2026_1st_swap`

Both would have the same ID if same year/round.

**Current mitigation:** Ledger builder adds swap partner: `${base}_${swapType}_${swapPartner}`

### Conflict 3: Contested Picks Without Context

**Problem:** Contested picks get `_contested` suffix without identifying contending teams.

**Example:**

- Three-way swap between OKC/HOU/LAC: `OKC_2026_1st_contested`

**Issue:** Cannot distinguish which contested scenario without reading full object.

### Conflict 4: Multiple Conditionals Same Year

**Problem:** A team could have multiple conditional scenarios for same year/round.

**Example:**

- LAL 2027 1st protected to UTA: `LAL_2027_1st_conditional`
- LAL 2027 1st also involved in swap: Conflicts if both exist

### Proposed Canonical ID Strategy

**Base Pick ID (Asset ID):**

```
{ORIGINAL}_{YEAR}_{1st|2nd}
```

Example: `LAL_2029_1st`

**Swap Rights ID:**

```
{ORIGINAL}_{YEAR}_{1st|2nd}_swap_{COUNTERPARTY}
```

Example: `LAL_2026_1st_swap_BOS`

**Obligation Record ID:**

```
{ORIGINAL}_{YEAR}_{1st|2nd}_obligation_{RECIPIENT}
```

Example: `LAL_2029_1st_obligation_DAL`

**Key Principle:** Protection details should NOT be in the ID. Protection is metadata on the obligation/asset, not part of its identity.

---

## 9) Open Questions / Unknowns

### Q1: Do RealGM pages have "Future Incoming/Outgoing Traded Pick Details" sections?

**Finding:** The scraper currently does NOT parse these sections. It only parses:

- "Future 1st Round Picks" header
- "Future 2nd Round Picks" header

Search for "Incoming.*Traded|Outgoing.*Traded" in `realgm_draft_picks.ts` returned no matches.

**Recommendation:** Inspect actual RealGM HTML to confirm if these sections exist. If they do, add parsing logic to capture additional trade route details.

### Q2: How reliable is RealGM's "via" information?

**Unknown:** RealGM may not always include "via" routing for incoming picks. Some picks may just show up without clear provenance.

**Recommendation:** Cross-reference with other sources or implement confidence scoring.

### Q3: Are there circular swap scenarios not handled?

**Unknown:** Complex multi-team swaps (e.g., three-way most favorable) may have edge cases not covered by current parsing.

---

## 10) Exact Execution Plan Requirements

### Changes Required

#### 1. Add "Mentions" Output File Generation

**File:** `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`

- [ ] Add `writeMentionsFile()` function (similar to `writePerTeamStructured()`)
- [ ] Call `writeMentionsFile()` BEFORE the filter at line 1500
- [ ] Output to `{OUT_DIR}/mentions/draft_picks_mentions_{TEAM}.json`

#### 2. Update Ledger Builder Input Path

**File:** `team-scrape/shared/ledger/buildPickLedger.ts`

- [ ] Change `DEFAULT_INPUT_DIR` to read from `mentions/` directory
- [ ] Optionally add CLI flag to specify input type (mentions vs structured)

#### 3. Implement Canonical ID Strategy

**File:** `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`

- [ ] Refactor `generatePickId()` to use base ID without protection
- [ ] Add separate ID generation for swap rights
- [ ] Add separate ID generation for obligation records
- [ ] Ensure IDs are stable across protection changes

#### 4. Add Incoming/Outgoing Detail Section Parsing (If Needed)

**File:** `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`

- [ ] Inspect RealGM HTML for additional section headers
- [ ] Add `parseIncomingDetails()` and `parseOutgoingDetails()` if sections exist
- [ ] Enrich picks with additional trade route information

#### 5. Update Documentation

- [ ] Update `team-scrape/draft-picks/docs/OUTPUT_FILE_STRUCTURE.md`
- [ ] Document new "mentions" vs "inventory" file distinction
- [ ] Document canonical ID strategy

### Validation Steps

1. Run scrape for LAL: `npm run realgm:drafts -- --teams LAL`
2. Verify `draft_picks_mentions_LAL.json` contains LAL 2029 1st → DAL
3. Verify `draft_picks_LAL.json` (inventory) does NOT contain LAL 2029 1st
4. Run ledger builder and verify DAL shows LAL 2029 1st in inventory
5. Verify pick IDs are stable and dedupable

---

## Appendix: Key File References

| File | Purpose | Key Lines |
|------|---------|-----------|
| `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` | Main scraper | 1494-1506 (filter), 680-688 (ID gen) |
| `team-scrape/shared/ledger/buildPickLedger.ts` | Ledger builder | 86-93 (input dir), 165-189 (ledger ID gen) |
| `team-scrape/shared/ledger/validateLedgerPicks.ts` | Validation | Full file |
| `team-scrape/draft-picks/docs/OUTPUT_FILE_STRUCTURE.md` | Output docs | Full file |
| `team-scrape/draft-picks/docs/PARSING_FIX_SUMMARY.md` | Parsing history | Full file |

---

**PREFLIGHT COMPLETE**

This return package provides all evidence and specifications needed for an EXECUTION prompt to implement the "mentions" output fix, canonical ID strategy, and ledger builder updates.
