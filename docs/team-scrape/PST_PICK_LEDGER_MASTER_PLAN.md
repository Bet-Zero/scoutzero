# PST_PICK_LEDGER_MASTER_PLAN.md

**MODE**: MASTER DOC (Doc-First source of truth)  
**DATE**: 2026-01-16  
**OWNER GOAL**: Build a trade-machine-grade draft-pick ledger using ProSportsTransactions (PST) at full speed until it catches up to or collides with RealGM.

---

## Phase Status

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| Phase 0 | Contracts, Years Window, Team Map | COMPLETE | 2026-01-17 |
| Phase 1 | Acquisition: Fetch PST Pages | BLOCKED | 2026-01-17 |
| Phase 1.1 | CDP Fetch Implementation | COMPLETE | 2026-01-17 |
| Phase 2 | Extraction: Produce Raw Rows | COMPLETE | 2026-01-17 |
| Phase 3 | Normalization | NOT STARTED | - |
| Phase 4 | Deterministic Parser | NOT STARTED | - |
| Phase 5 | Ledger Builder | NOT STARTED | - |
| Phase 6 | Hard Guarantees | NOT STARTED | - |
| Phase 7 | Collision Course | NOT STARTED | - |
| Phase 8 | Zero-Blocker Closure | NOT STARTED | - |

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

### PHASE 4 — Deterministic Parser: Encumbrances + Owner Claim

**Goal**: parse normalizedText into structured encumbrances using rules, not guesses.

**Must Detect**

1) Protections:
   - ranges/top-N/lottery, protector party (usually original team)
2) Conveyance / fallback chains:
   - “if not conveyed then …” sequences, conversions to seconds
3) Swaps:
   - swap rights, pool teams, controller, “most/least favorable”
4) Forfeited/void (if present)

**Key Rule**

- If parser cannot confidently represent the meaning, set:
  - `needsReview = true`
  - `reviewReasonCodes[]` populated
  - DO NOT silently assign fields.

**Outputs**

- `data/pst/pst_parsed_claims.json`
- `data/pst/pst_needs_review.json` (subset)

**Acceptance Criteria**

- Parser is deterministic and repeatable.
- Unknowns are explicit and enumerated.

---

### PHASE 5 — Ledger Builder: Create the 420 Pick Objects

**Goal**: build the canonical 420 pick universe and apply parsed claims.

**Tasks**

1) Generate base pick set (420):
   - every team × round × year
2) Apply claims:
   - set `owner` from parsed/display owner rules
   - attach encumbrances + provenance
3) Ensure every pick has exactly one `owner`.

**Outputs**

- `data/pst/pst_ledger.json`
- `data/pst/pst_holdings_by_team.json`

**Acceptance Criteria**

- Exactly 420 base picks exist (unless forfeited state is modeled).
- Every pick has `owner` defined.
- Every pick with non-trivial constraints includes provenance.

---

### PHASE 6 — Hard Guarantees: Invariants + Blocking

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
