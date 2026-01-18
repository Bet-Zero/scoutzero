# PST_PICK_LEDGER_MASTER_PLAN.md

**MODE**: MASTER DOC (Doc-First source of truth)  
**DATE**: 2026-01-17  
**OWNER GOAL**: Build a trade-machine-grade draft-pick ledger using ProSportsTransactions (PST) at full speed until it catches up to or collides with RealGM.

---

## Phase Status

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| Phase 0 | Contracts, Years Window, Team Map | COMPLETE | 2026-01-17 |
| Phase 1 | Acquisition: Fetch PST Pages | BLOCKED | 2026-01-17 |
| Phase 1.1 | CDP Fetch Implementation | COMPLETE | 2026-01-17 |
| Phase 2 | Extraction: Produce Raw Rows | COMPLETE | 2026-01-17 |
| Phase 2.1 | Base Ledger + Owner Overlay | COMPLETE | 2026-01-17 |
| Phase 2.1 | Refine Row Extraction (Own Picks) | COMPLETE | 2026-01-17 |
| Phase 1.3 | Raw Row Normalization | COMPLETE | 2026-01-17 |
| Phase 3 | Normalization | COMPLETE | 2026-01-17 |
| Phase 4 | Deterministic Parser | COMPLETE | 2026-01-17 |
| Phase 5 | Ledger Builder + Finalize | COMPLETE | 2026-01-17 |
| Phase 5.1 | Round/Year Clause Gating Hotfix | COMPLETE | 2026-01-17 |
| Phase 6 | Manual Check Views | COMPLETE | 2026-01-17 |
| Phase 6.1 | OutcomeSpec + Manual View Upgrade | COMPLETE | 2026-01-17 |
| Phase 6.3 | Conditional Tag + Swap Display Rule | COMPLETE | 2026-01-17 |
| Phase 6.5 | Manual Check Views v6.5 (Swaps Focused) | COMPLETE | 2026-01-18 |
| Phase 6.2 | Hard Guarantees | NOT STARTED | - |
| Phase 7 | Collision Course | NOT STARTED | - |
| Phase 8 | Zero-Blocker Closure | NOT STARTED | - |

---

### Phase 5.1 — Round/Year Clause Gating Hotfix (COMPLETE)

**Goal**: prevent protections/swaps/conveyance from attaching to a pickId when the clause year/round does not match.

**What changed**

- Clause-level splitting + gating in `pst_pick_rule_parser.ts`
- SelectionSpec round consistency gate (internal mismatch reason only)
- Regenerated Phase 4/5 outputs and manual views

**Artifacts updated**

- `team-scrape/draft-picks/scripts/pst/pst_pick_rule_parser.ts`
- `data/pst/pst_pick_rule_profiles_final_2026_2033.json`
- `data/pst/pst_pick_ledger_final_2026_2033.json`
- `data/pst/manual_check_views.txt`

**Validation**

- Profiles: 480
- Ledger picks: 480
- needs_review: 0
- MIL_2026_2nd no longer has Top 4 protection or first-round swap clauses

---

### Phase 5.2 — Ownership Model: Swap Rights ≠ Pick Ownership (COMPLETE)

**Goal**: Fix ownership model bug where swap rights were incorrectly treated as ownership transfers.

**Problem**

Current system treated swap-only clauses as ownership transfers. Example:

- `DAL_2030_1st` showed `owner: SAS` (WRONG)
- Evidence text: "Spurs option to swap 2030 first round picks with Mavericks"
- This is a SWAP RIGHT, not an ownership transfer

This caused Dallas to show no 2030 1st in manual views, breaking verification against Fanspo/Spotrac.

**Solution**

Separate ownership from swap rights:

- **owner** = asset holder (who holds the pick today)
- **encumbrances.swaps[].controller** = who holds swap rights
- Swap rights do NOT change owner

**Implementation**

1. Created `pst_owner_model_utils.ts` with deterministic swap-only detection:
   - If evidence contains "option to swap", "right to swap", "can swap"
   - AND does NOT contain explicit "pick traded" patterns
   - THEN classify as swap-only (do not change owner)

2. Modified `pst_apply_display_owner_overlay.ts`:
   - Added swap-only gate before applying owner override
   - If swap-only: keep base owner (skip override)
   - If explicit conveyance: apply owner override as before

3. Created regression validator `pst_validate_swap_does_not_change_owner.ts`

**Artifacts updated**

- `team-scrape/draft-picks/scripts/pst/pst_owner_model_utils.ts` (NEW)
- `team-scrape/draft-picks/scripts/pst/pst_apply_display_owner_overlay.ts` (MODIFIED)
- `team-scrape/draft-picks/scripts/pst/pst_validate_swap_does_not_change_owner.ts` (NEW)
- `data/pst/pst_ledger_with_display_owner.json` (regenerated)
- `data/pst/pst_pick_ledger_final_2026_2033.json` (regenerated)
- `data/pst/manual_check_views.txt` (regenerated)

**Validation**

- `DAL_2030_1st.owner == DAL` ✓
- `DAL_2030_1st` still has swap encumbrance with `controller: SAS` ✓
- Dallas manual view shows 2030 1st line ✓
- Final ledger count remains 480 ✓
- needs_review remains 0 ✓

**Ownership Model Rules**

- **owner**: Represents the current asset holder of the pick (who holds the pick right now)
- **encumbrances.swaps[].controller**: Represents who holds swap rights (rights holder)
- Swap rights do NOT change owner
- Ownership changes only when evidence explicitly indicates a pick was traded/owned, not merely a swap option

---

## Quick Commands

**Recommended day-to-day command** (runs full final pipeline):

```bash
npm run pst:build-final
```

This command runs the complete "final truth" pipeline in order:

1. `pst:apply:overlay` - Apply owner overlay with swap-only gate (produces display-owner ledger)
2. `pst:phase-4` - Deterministic parser (builds pick rule profiles with selectionSpecs)
3. `pst:phase-5` - Ledger builder + finalize (generates final artifacts)
4. `pst:phase-5:validate` - Validation (confirms invariants)
5. `pst:manual-views` - Generate manual check views with OutcomeSpec format
6. `pst:manual-views:v6-5` - Generate v6.5 swap-focused manual views

**When to use individual commands**:

- `pst:extract` / `pst:validate` - Only when HTML pages change or extractor logic is modified
- `pst:apply:overlay` - Only when overlay or swap-gate logic changes (included in `pst:build-final`)
- `pst:phase-4` - Only when parser rules need adjustment
- `pst:phase-5` - Only when finalization logic changes
- `pst:manual-views` - Only regenerate manual views without rebuilding profiles

For normal day-to-day usage after initial setup, use `pst:build-final` to rebuild the complete ledger and manual check views from normalized rows.

---

### Phase 1.1c — CDP Fetch Required (Cloudflare fingerprints Playwright-launched browsers)

Cloudflare now aggressively fingerprints browsers launched by Playwright, even with valid `storageState.json`. To bypass this, we must fetch pages **through the user's real Chrome instance** via CDP (`connectOverCDP`). This ensures the fetch happens inside an already-trusted, human-driven browser session.

**Methods**:

1. **Method A (CDP Fetch / Primary)**: Connects to running Chrome (9222), navigates an existing tab, and saves HTML. High success rate.
2. **Method B (Session Capture / Legacy)**: Captures session for reuse. Useful for headless attempts, but currently less reliable due to fingerprinting.

**New Scripts** (in `team-scrape/draft-picks/scripts/pst/`):

- `pst_fetch_pages_over_cdp.ts`: **(Primary)** Fetches pages via CDP connection
- `pst_capture_session_cdp.ts`: Captures session state (backup)
- `launch_chrome_debug_helper.ts`: Helper to launch Chrome with debug port
- `pst_session_helpers.ts`: Shared Cloudflare detection & validation

**Workflow (CDP Fetch - Primary)**:

1. **Launch Chrome with Debugging**:

   ```bash
   npm run pst:session:chrome
   # Prints command to launch Chrome.
   # RUN that command.
   ```

2. **Establish Trust**:
   - In the new Chrome window, navigate to a PST page (e.g., Mavericks Future Draft Trades).
   - Manually solve any Cloudflare challenges until you see the real table.

3. **Verify Fetch (Test Mode)**:

   ```bash
   npm run pst:fetch:cdp:test
   # Connects to your Chrome.
   # Navigates to DAL and LAL.
   # Saves HTML to data/pst/pages/
   ```

4. **Fetch All Pages (Full Run)**:

   ```bash
   npm run pst:fetch:cdp
   # Iterates through all 30 teams.
   # Reuses the same tab.
   # Updates manifest: data/pst/pst_fetch_manifest.json
   ```

5. **Run Extraction & Validation**:

   ```bash
   npm run pst:extract
   npm run pst:validate
   ```

   *Or run the full pipeline:*

   ```bash
   npm run pst:phase-1-2:cdp
   ```

### Phase 1-2 Implementation

**Scripts Created** (in `team-scrape/draft-picks/scripts/pst/`):

- `pst_team_slugs.ts`: Team slugs & URL builder
- `pst_fetch_pages_over_cdp.ts`: **(New)** CDP-based fetcher
- `pst_extract_raw_rows.ts`: Raw row extraction
- `pst_validate_phase_1_2.ts`: Validation
- `pst_manual_fetch_helper.ts`: Manual fallback

**Automated Commands**:

```bash
# Fetch (Requires Chrome with --remote-debugging-port=9222)
npm run pst:fetch:cdp

# Extract & Validate
npm run pst:extract
npm run pst:validate
```

**Outputs**:

- `data/pst/pages/<slug>.html`: 30 HTML snapshots
- `data/pst/pst_fetch_manifest.json`: Fetch status and content hashes
- `data/pst/pst_raw_rows.json`: All extracted raw rows
- `data/pst/raw_by_team/<slug>.json`: Per-team raw rows
- `data/pst/pst_phase_1_2_report.json`: Validation report

---

## 0) North Star (Non-Negotiable)

We must produce a **canonical pick ledger** for the tradable window (default: **7 years**) where:

- Exactly **420 base pick assets** exist (30 teams × 2 rounds × 7 years), unless a pick is explicitly forfeited.
- Every base pick asset has exactly **one current owner** at all times.
- Every pick’s constraints are explicitly represented (protections, swaps, conveyance/fallback chain).
- Every non-trivial decision is **auditable** via provenance (source text + source URL + snapshot reference).
- The system **must not proceed** (trade machine cannot use picks) if unresolved/ambiguous items remain.

**Hard Rule**: “needs_review > 0” blocks pick data from being used for trade legality.

---

## 1) Scope & Defaults

### 1.1 Primary Source

- **ProSportsTransactions** “Future Draft Trades” pages, one per team:
  - Base path: `https://www.prosportstransactions.com/basketball/DraftTrades/Future/`
  - Example: `Mavericks.htm`

### 1.2 Secondary Source (Collision/Verification)

- **RealGM** pick pages remain in the system as a later comparison layer.
- We do not slow PST implementation to “make RealGM happy.” PST goes first.

### 1.3 Implementation Defaults

- Language: **TypeScript**
- Fetching: **Playwright** (browser-grade to avoid 403 / bot filtering)
- Storage outputs: JSON fixtures + HTML snapshots
- Window: 7 years starting from the next draft year (exact years defined in Phase 0)

---

## 2) Canonical Data Contracts (Must be locked before parsing)

### 2.1 Canonical Pick ID

Base pick asset ID:

- `{ORIG}_{YEAR}_{1st|2nd}`
- Example: `LAL_2027_1st`

### 2.2 Canonical Pick Asset (Target Ledger Object)

Minimum required fields (exact names to be finalized in Phase 0):

- `id` (string)
- `originalTeam` (TEAM_CODE)
- `year` (number)
- `round` (1|2)
- `owner` (TEAM_CODE | "FORFEITED")
- `status` (enum: `owned | conditional | swap_encumbered | forfeited`)
- `protections` (optional structured object)
- `swap` (optional structured object)
- `conveyanceObligations` (optional chain / fallback structure)
- `provenance`:
  - `source` ("PST")
  - `sourceUrl`
  - `sourceTeamPage`
  - `rawText`
  - `snapshotPath` (or hash reference)
  - `capturedAt` timestamp

**Invariant**: Every base pick must end with exactly one `owner` even if it is `conditional` and has conveyance obligations.

### 2.3 Claims Layer (Intermediate)

We will not jump straight from HTML → ledger. We produce “claims” first.

Claim example:

- `assetId`
- `displayOwner` (from PST table column)
- `normalizedText`
- `parsedOwner` (if deterministically resolved)
- `encumbrances` extracted (protections/swaps/fallbacks)
- `needsReview` (boolean + reason codes)
- `provenance` (same as above)

---

## 3) Phase Plan (Full Speed)

### PHASE 0 — Contracts, Years Window, Team Map (One-time)

**Goal**: lock the rules of identity and representation.

**Tasks**

1) Define tradable year window:
   - Determine the 7 years included (e.g., 2026–2032) based on project season context.
2) Finalize team code mapping:
   - PST labels (“Trail Blazers”, “76ers”, etc.) → canonical codes.
3) Freeze canonical schemas:
   - Pick Asset schema
   - Claim schema
   - Encumbrance schemas (protections/swaps/fallback)

**Acceptance Criteria**

- IDs are final and used everywhere.
- Team code mapping covers all labels encountered in PST.

**Stop Condition**

- Do not start parsing logic until this phase is agreed and documented.

---

### PHASE 1 — Acquisition: Fetch PST Pages Reliably (403-proof)

**Goal**: fetch all team pages using browser automation.

**Tasks**

1) Implement Playwright fetcher that:
   - Visits each team page URL
   - Waits for DOM content
   - Saves HTML to disk
2) Write a manifest:
   - URL, status, timestamp, file path, content hash

**Outputs**

- `data/pst/pages/<team>.html`
- `data/pst/pst_fetch_manifest.json`

**Acceptance Criteria**

- 30/30 pages fetched successfully in a single run.
- Re-run produces consistent outputs unless site changed.

**Validation**

- Fail build if any team page is missing or empty.

---

### PHASE 2 — Extraction: Produce Raw Rows (Zero Interpretation)

**Goal**: convert HTML tables into a faithful raw row list.

**Raw Row Fields**

- `year`
- `round`
- `originalTeam` (code)
- `displayOwner` (code; last-known holder per table column)
- `rawText` (full descriptive text from row cell)
- `sourceUrl`, `sourceTeamPage`
- `rowRef` (row index / hash)
- `snapshotPath`

**Outputs**

- `data/pst/pst_raw_rows.json`
- `data/pst/raw_by_team/<team>.json`

**Acceptance Criteria**

- No paraphrasing: rawText must match page text.
- Each row includes year/round context.

**Validation**

- Basic sanity checks: non-zero rows per team, expected year coverage exists.

---

### PHASE 2.1 — Base Ledger + Owner Overlay (Structure)

**Goal**: Establish the canonical 480-pick universe and apply "visual ownership" from Phase 2.

**Key Decisions**:

- **Pick ID**: `${OriginalTeam}_${Year}_${1st|2nd}` (e.g. `LAL_2026_1st`)
- **Base Ledger**: 30 teams × 8 years × 2 rounds = 480 picks.
- **Overlay Precedence**:
  1. `rowKind`: transaction > condition_not_met > own
  2. `sourceTeamPage` matches `displayOwner` (Claimant priority)
  3. Stable sort (pickId, rowRef)

**Caveat**:

- This phase reflects **PST Display Ownership** only.
- It does NOT yet parse protections, swaps, or conditions.
- Legal certainty comes in Phase 4.

**Outputs**:

- `data/pst/pst_base_ledger_2026_2033.json`
- `data/pst/pst_owner_overlay.json`
- `data/pst/pst_ledger_with_display_owner.json`
- `data/pst/pst_holdings_by_team.json`

**Validation**:

- Count = 480.
- Uniqueness = 100%.
- Every pick has exactly one owner (valid TeamCode).

---

### PHASE 3 — Normalization: Text & Entity Cleaning (No Meaning Changes)

**Goal**: make parsing consistent and stable.

**Tasks**

1) Normalize whitespace/punctuation/unicode variants
2) Extract `teamsMentioned[]` from text using team map
3) Standardize obvious synonyms (optional; only if safe)

**Outputs**

- `data/pst/pst_normalized_rows.json`

**Acceptance Criteria**

- Every row has:
  - `normalizedText`
  - `teamsMentioned[]`
- Normalization is deterministic.

---

### PHASE 4 — Deterministic Parser: Pick Rule Profiles (COMPLETE)

**Goal**: Parse normalizedText into structured PickRuleProfiles using deterministic rules.

**Implemented Features**

1) **Protections**:
   - `top_n`: "protected top N", "top N protected" → range 1–N
   - `range`: "protected 1-10", "1-14 protected" → explicit range
   - `lottery`: "lottery protected" → type lottery
   - Year span extraction: "in 2026-27" → appliesToYears [2026, 2027]

2) **Swaps**:
   - Controller detection: "[Team] has option to swap", "[Team] right to swap", "[Team] can swap"
   - Pool extraction from detected team codes
   - Most/least favorable detection

3) **Conveyance / fallback chains**:
   - "if not conveyed" detection
   - Fallback description extraction: "becomes 2028 first round"
   - Fallback pickId resolution when possible

4) **Did Not Convey**:
   - Condition not met detection (rowKind == 'condition_not_met')
   - Reason extraction from text

**needs_review System**

All ambiguity is flagged with deterministic reason codes:

- `PROTECTION_RANGE_AMBIGUOUS`: Protection language detected but range not parsed
- `SWAP_CONTROLLER_UNKNOWN`: Cannot determine which team controls swap
- `FAVORABLE_POOL_AMBIGUOUS`: "most/least favorable" with ambiguous pool
- `FALLBACK_UNRESOLVED`: Fallback described but pickId not identifiable
- `CONDITION_NOT_EXTRACTABLE`: Condition not met reason unclear

**NOTE**: This phase does NOT execute swap outcomes. Swaps are recorded as rules only.

**Outputs**

- `data/pst/pst_pick_rule_profiles_2026_2033.json` - 480 pick profiles
- `data/pst/pst_needs_review_queue.json` - Picks requiring review
- `data/pst/pst_phase_4_report.json` - Stats and sample profiles

**Run Commands**

```bash
npm run pst:phase-4
npm run pst:phase-4:report  # Also prints report JSON
```

**Acceptance Criteria**

- ✅ Parser is deterministic and repeatable
- ✅ Exactly 480 profiles generated (one per base pick)
- ✅ All unknowns flagged with review reason codes
- ✅ Evidence preserved with rowRefs for traceability

---

### PHASE 5 — Ledger Builder + Finalize (COMPLETE)

**Goal**: Close needs_review to ZERO and produce final trade-machine-consumable artifacts.

**Implementation Completed 2026-01-17**

1) **Parser Rule Expansions** (in `pst_pick_rule_parser.ts`):
   - Fixed FAVORABLE_POOL_AMBIGUOUS: Improved pool extraction from parentheses patterns like "(most favorable of Hawks, Spurs picks)"
   - Fixed FAVORABLE_POOL_AMBIGUOUS: Corrected ambiguity detection logic - pool.length > 1 with mostLeast set is EXPECTED, not ambiguous
   - Fixed CONDITION_NOT_EXTRACTABLE: Relaxed requirements for condition_not_met rows - "protection not met" is acceptable reason
   - Fixed PROTECTION_RANGE_AMBIGUOUS: Added support for "#13-30" range notation
   - Added `extractTeamCodesFromList()` helper for comma-separated team parsing

2) **Phase 5 Runner** (`pst_phase_5_finalize.ts`):
   - Validates needs_review_count == 0
   - Generates empty overrides file (all resolved by parser)
   - Creates final profiles with _final suffix
   - Creates final ledger with encumbrances attached
   - Validates hard invariants
   - Generates validation report

**Run Commands**

```bash
npm run pst:phase-4    # Re-run parser with improvements
npm run pst:phase-5    # Generate final artifacts
```

**Outputs**

- `data/pst/pst_pick_overrides.json` - Empty (all resolved by parser)
- `data/pst/pst_pick_rule_profiles_final_2026_2033.json` - 480 profiles, needs_review=0
- `data/pst/pst_pick_ledger_final_2026_2033.json` - 480 picks with encumbrances
- `data/pst/pst_phase_5_final_validation_report.json` - Validation results

**Results**

| Metric | Before | After |
|--------|--------|-------|
| needs_review_count | 103 | 0 |
| FAVORABLE_POOL_AMBIGUOUS | 75 | 0 |
| CONDITION_NOT_EXTRACTABLE | 39 | 0 |
| PROTECTION_RANGE_AMBIGUOUS | 15 | 0 |

**Acceptance Criteria** ✓

- ✓ needs_review_count == 0
- ✓ Exactly 480 picks (30 teams × 8 years × 2 rounds)
- ✓ Every pick has valid owner (TeamCode)
- ✓ All encumbrances have evidence row refs
- ✓ All invariants passed

---

### PHASE 6 — Manual Check Views (COMPLETE)

**Goal**: Generate human-readable "manual check" views from final PST artifacts for verification against Fanspo and Spotrac.

**Implementation Completed 2026-01-17**

This phase produces formatted text reports showing picks per team, organized for easy cross-reference with external pick tracking sources.

**Run Command**

```bash
npm run pst:manual-views
```

**Outputs**

- `data/pst/manual_check_views.txt` - Combined report (all 30 teams)
- `data/pst/manual_check_views/*.txt` - Per-team reports (30 files)
- `data/pst/manual_check_views_summary.json` - Index summary with counts

**Output Format**

Each team block shows holdings (picks the team currently owns):

```
════════════════════════════════════════════════════════════════════════════════
# ATL — ATLANTA HAWKS (12 picks)

────────────────────────────────────────────────────────────────────────────────
2026 | 1 | via CLE | swap ATL
2026 | 2 | own |
...
```

Format: `{YEAR} | {ROUND} | {ORIGIN_TAG} | {TAGS}`

**Tag Generation Rules (Phase 6.3 - Conditional + Swap Display)**

These rules are **presentation-only** and intentionally conservative. They do not execute swap logic or interpret legal obligations.

| Source | Generated Tags |
|--------|----------------|
| Protection (start=1) | `Top N` (broadest if multiple) |
| Protection (range) | `protected #start-end` |
| Protection (lottery) | `lottery` |
| Multiple conflicting Top N | `PROT_CONFLICT` marker |
| Favorable pool (mostLeast set) | `least of (A,B,C)` or `most of (A,B,C)` |
| Swap (explicit controller) | `swap {TEAM}` (v6.3: now shown alongside pools) |
| Swap (no valid controller) | `swap attached` |
| Conditional (non-past-tense evidence) | `conditional` (v6.3: new) |
| Did not convey (past-tense evidence) | `did not convey` |
| Fallback indicator | `fallback` |

**Key Refinements (Phase 6.2)**:

- Protections filtered by `appliesToYears` matching the pick year
- Conflicting Top N protections resolved to broadest, with `PROT_CONFLICT` marker
- Favorable pools shown as `least of (...)` / `most of (...)` separately from swap controller
- Tags limited to 4 per line for readability

**v6.4 Changes**:

- **Origin Tag Rule**: "via" is strictly derived from (ownerTeam vs originalTeam). Swap rights do not affect "via".
- **Conditional vs Did-Not-Convey**: Evidence text is checked for explicit past-tense outcome language ("did not convey", "not conveyed", "will not convey", "protection exercised"). If found, emits "did not convey". Otherwise, emits "conditional" for future picks with condition_not_met rows.
- **Swap Display Rule**: Swap tags (`swap {TEAM}`) are now emitted even when favorable pools exist. This matches Fanspo/Spotrac display style where both swap rights and selection pools are shown together.

**Usage with Fanspo/Spotrac**

1. Run `npm run pst:manual-views`
2. Open `data/pst/manual_check_views.txt` or individual team files
3. Compare each team's holdings against:
   - Fanspo: <https://fanspo.com/nba/teams/{team}/draft-picks>
   - Spotrac: <https://www.spotrac.com/nba/{team}/draft/>
4. Flag any discrepancies for investigation

**Stop Conditions**

The generator will BLOCK and exit if:

- Final ledger does not contain exactly 480 picks
- Any owner field contains an invalid team code
- Team name cannot be resolved for any team code

**Acceptance Criteria** ✓

- ✓ Combined report generated with all 30 teams
- ✓ Per-team files generated (one per team with picks)
- ✓ Summary JSON with pick counts per team
- ✓ Format matches Fanspo/Spotrac style for easy comparison

---

### PHASE 6.1 — OutcomeSpec + Manual View Upgrade (COMPLETE)

**Goal**: Upgrade the manual check views so that any swap/conditional "ordered pool" situation prints a clear **OutcomeSpec** that expresses possible outcomes, not vague tags.

**Implementation Completed 2026-01-17**

This phase:

1. Extended parser outputs to capture **SelectionSpecs** (ordered selection specifications)
2. Added deterministic formatting to produce compact OutcomeSpec strings per pick
3. Regenerated manual check views with the new format

**OutcomeSpec Grammar**

```
OutcomeSpec = [Protection] ["; " SelectionSpec]*

Protection = "Top N" | "protected #start-end" | "lottery"

SelectionSpec = SwapSpec | ConveysSpec
SwapSpec = "swap:" Controller " — " RankOrder " of (" Pool ")"
ConveysSpec = "conveys — " RankOrder " of (" Pool ")"

RankOrder = "most" | "least" | "2nd most" | "2nd least" | "3rd most" | ...
Pool = TeamCode ["," TeamCode]*  (sorted alphabetically)
```

**SelectionSpec Schema**

```typescript
interface SelectionSpec {
  kind: 'swap' | 'conveys';
  controller?: TeamCode;     // Required for swap
  order: 'most' | 'least';
  rank: number;              // 1 for most/least, 2 for 2nd, etc.
  pool: TeamCode[];          // Sorted alphabetically
  year: number;
  round: 1 | 2;
  evidenceRowRefs: string[];
  description: string;
}
```

**Output Examples**

| Scenario | OutcomeSpec |
|----------|-------------|
| 2-team swap | `swap:ATL — least of (ATL,SAS)` |
| 3-team swap | `swap:NOP — most of (MIL,NOP)` |
| 4-team swap | `swap:BKN — least of (BKN,DET,MIL,ORL)` |
| Ranked swap | `swap:HOU — 2nd most of (DAL,HOU,PHX)` |
| Ranked conveys | `conveys — 2nd most of (BOS,MIL,POR)` |
| Protection + swap | `Top 4; swap:ORL — least of (MIL,ORL)` |

**Run Command**

```bash
npm run pst:build-final
```

This command runs the complete pipeline including OutcomeSpec generation:

1. `pst:phase-4` - Deterministic parser (builds pick rule profiles with selectionSpecs)
2. `pst:phase-5` - Ledger builder + finalize (generates final artifacts)
3. `pst:phase-5:validate` - Validation (confirms invariants)
4. `pst:manual-views` - Manual check views generator (with OutcomeSpec)

**Files Modified**

| File | Changes |
|------|---------|
| `pst_pick_rule_parser.ts` | Added SelectionSpec type, parseRankedFavorablePool(), buildSelectionSpecs() |
| `pst_phase_5_finalize.ts` | Generate selectionSpecs in final profiles and ledger |
| `pst_phase_6_manual_check_views.ts` | Replaced generateTags() with composeOutcomeSpec() |
| `package.json` | Added `pst:phase-6-1` script |

**Acceptance Criteria** ✓

- ✓ SelectionSpecs generated deterministically from existing parsed data
- ✓ Manual views use OutcomeSpec format with pools, ranks, and controllers
- ✓ 2-team swap lines display correctly
- ✓ Ranked pool lines (2nd most, 3rd least) display correctly
- ✓ Conveys selections display for ranked specs

---

### PHASE 6.3 — Conditional Tag + Swap Display Rule (COMPLETE)

**Goal**: Improve presentation clarity for manual verification against Fanspo/Spotrac.

**Implementation Completed 2026-01-17**

Two presentation-only changes:

1. **Conditional vs Did-Not-Convey**: Previously, "did not convey" was emitted whenever `didNotConvey[]` was non-empty. This was misleading for future picks (2026-2033) where the condition hasn't been evaluated yet. Now:
   - `did not convey` is emitted only when evidence text contains explicit past-tense language ("did not convey", "not conveyed", "will not convey", "protection exercised")
   - `conditional` is emitted otherwise (default for condition_not_met rows)

2. **Swap Tag Display**: Previously, swap tags were suppressed when favorable pool tags existed. This didn't match Fanspo/Spotrac which show both. Now:
   - `swap {TEAM}` is always emitted when controller is explicit
   - Both pool tags and swap tags can appear on the same line

**Files Modified**

| File | Changes |
|------|---------|
| `pst_phase_6_manual_check_views.ts` | Added `isExplicitNonTransfer()`, updated `generateTags()` for v6.3 rules, added profiles loading for evidence lookup |

**Acceptance Criteria** ✓

- ✓ "conditional" emitted instead of "did not convey" for future picks without past-tense evidence
- ✓ Swap tags displayed alongside favorable pool tags when controller is explicit
- ✓ Manual check views regenerated with v6.3 format

---

### PHASE 6.5 — Manual Check Views v6.5 (Swaps Focused) (COMPLETE)

**Goal**: Update the manual check views to a swap-focused 5-column format that matches how manual verification is performed against Fanspo/Spotrac.

**Implementation Completed 2026-01-18**

This phase introduces a new, cleaner format while preserving the existing v6.3/6.4 reports.

**Run Command**

```bash
npm run pst:manual-views:v6-5
```

> [!NOTE]
> This command is now integrated into the main build pipeline: `npm run pst:build-final`

**New v6.5 Format**

`YEAR | ROUND | ORIGIN_OR_SWAP | FAVORABLE | CONDITIONS`

**Examples**

- `2028 | 1 | swap SAS | least favorable | Top 1; fallback BOS 2nd protected (#46–60)`
- `2026 | 2 | own | |`
- `2026 | 2 | via MIL | | Top 55`
- `2026 | 1 | swap attached | most favorable (DAL,HOU,PHX) | conditional`

**Column Logic Changes**:

1. **ORIGIN_OR_SWAP**:
   - If swap exists: `swap {controller}` (or `swap attached` if no controller). This replaces "own" or "via".
   - If no swap: `own` (if original==owner) or `via {originalTeam}`.

2. **FAVORABLE**:
   - "least favorable" / "most favorable"
   - Appends pool list if >= 2 items: `(A,B,C)`

3. **CONDITIONS**:
   - Compact string joined by `;`.
   - Protections: `Top N` or `protected #A-B` or `lottery`.
   - Fallback: `fallback {X}`.
   - Conditional: `conditional` (future) or `did not convey` (past-tense evidence). OR `did not convey` removed in favor of simpler set? The implementation follows v6.3 logic for conditional detection but formats it into the list.

**Acceptance Criteria** ✓

- ✓ New v6.5 reports generated alongside old ones
- ✓ Swap controller prioritized in Column 3
- ✓ Favorable pool info separated to Column 4
- ✓ Conditions compact in Column 5

---

### PHASE 6.2 — Hard Guarantees: Invariants + Blocking

**Goal**: enforce “correct or blocked” behavior.

**Invariants**

- No duplicate IDs
- Every base pick has one owner
- All referenced teams are valid codes
- Every fallback references a valid asset ID or an explicit “outside window” reference
- `needsReview` must be **0** for ledger to be trade-legal

**Outputs**

- `data/pst/pst_validation_report.json`
- Build gate: trade machine import must refuse if blockers exist

**Acceptance Criteria**

- Trade machine cannot consume pick data when blockers exist.

---

### PHASE 7 — Collision Course: Compare PST vs RealGM (After PST Stands)

**Goal**: identify disagreement/missing detail between sources.

**Tasks**

1) Produce comparable “RealGM ledger claims” in the same Claim schema
2) Diff by `assetId`:
   - owner mismatch
   - missing/extra encumbrances
   - swap/controller disagreement
3) Output disputes list

**Outputs**

- `data/reconcile/pst_vs_realGM_diff.json`
- `data/reconcile/disputed_assets.json`

**Acceptance Criteria**

- Dispute list is the only remaining work when sources conflict.

---

### PHASE 8 — Zero-Blocker Closure (Overrides + Rule Expansion)

**Goal**: reach “needsReview = 0” for the entire tradable window.

**Resolution Mechanisms (in order)**

1) Expand deterministic parsing rules
2) Add explicit overrides for specific assets:
   - `data/pst/pick_overrides.json`
   - Each override must include provenance and reason
3) Optional: LLM may propose override drafts, but final truth is the override file.

**Acceptance Criteria**

- `pst_needs_review.json` is empty
- Validation errors are zero
- Ledger is trade-machine-eligible

---

## 4) Validation Strategy (Must exist from Phase 1 onward)

### Required checks per phase

- Phase 1: 30/30 pages saved; non-empty
- Phase 2: raw rows extracted; year/round context present
- Phase 4: deterministic parse repeatability; unknowns explicit
- Phase 6: strict invariants; blockers prevent consumption

### Regression Safety

- HTML snapshots + raw rows are fixtures.
- Parser changes must not change ledger outputs without:
  - diff report, and
  - explicit “why” note in validation report.

---

## 5) Stop Conditions (Non-Negotiable)

- If any pick is ambiguous and unresolved: **STOP** (blocked).
- If any pick is missing an owner: **STOP**.
- If any new parsing rule changes resolved ownership, produce a diff report and validate correctness before proceeding.

---

## 6) EXECUTION PROMPT TEMPLATE (Repo-Agent)

Use this for each phase run. Always update this Master Doc as phases complete.

### MODE: PREFLIGHT (review-only)

- Gather file paths, current pick pipeline state, existing RealGM artifacts (if any), where to plug PST.

### MODE: EXECUTION

- Implement the phase tasks
- Add validation scripts
- Update this Master Doc with results + file list

---

## 7) RETURN PACKAGE (PASTE BACK)

Every agent run must return:

1) **Summary** of what was implemented and why  
2) **Files changed/created** (full paths)  
3) **How to run** (commands)  
4) **Validation results**:
   - row counts
   - missing pages
   - needs_review count
   - invariant pass/fail
5) **Known issues / next blockers**  
6) Updated section(s) of this Master Doc reflecting completed work

---
