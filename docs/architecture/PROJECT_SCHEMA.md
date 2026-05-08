# Project Schema

This document provides an authoritative map of the ScoutZero/HoopZero repository structure, naming conventions, script interfaces, data contracts, and validation rules. It serves as both human documentation and the basis for automated validation.

## Repo Layout

Top-level directory structure and purposes:

| Directory        | Purpose                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/`           | Main React/Vite application source (HoopZero frontend)                                                        |
| `player-scrape/` | Player contract & stats scraping pipeline                                                                     |
| `team-scrape/`   | Team roster & draft pick scraping pipeline                                                                    |
| `scripts/`       | Utility scripts for Firebase, schema tools, and documentation                                                 |
| `tests/`         | Vitest test suites for utils, contracts, and trade validation                                                 |
| `docs/`          | Organized documentation (architecture, guides, compliance, migrations)                                        |
| `archive/`       | Historical docs and retained archive material that are no longer active source of truth                       |
| `plans/`         | Active plans (`plan.md`, chunks) and execution tracking; completed plans are archived under `plans/_archive/` |
| `public/`        | Static assets (fonts, team logos, player headshots)                                                           |
| `cba/`           | NBA CBA reference materials (guides, articles, rule cards)                                                    |
| `_exports/`      | Export artifacts and build outputs                                                                            |
| `.github/`       | GitHub Actions workflows and configuration                                                                    |

### Key Subdirectories

#### player-scrape/

- `contracts/` - Contract data scraping and normalization
  - `scripts/` - CLI tools for fetching, parsing, and validating player contracts
  - `fixtures/` - Test fixtures (expected outputs and snapshots)
  - `snapshots/` - Raw HTML snapshots for regression testing
  - `output/` - Scraped contract JSON files organized by team
  - `working/` - Temporary working directory for scrape operations
- `shared/` - Shared schemas and utilities
  - `schema/` - Zod schemas for player data structures
  - `scripts/` - Shared utility scripts
  - `tools/headshots/` - Headshot downloader tool
    - `download_headshots.ts` - Download NBA player headshots from CDN
    - `README.md` - Usage documentation
- `stats/` - Player statistics scraping (TBD)
- `docs/` - Player scraping documentation
- `firestore_staging/` - Preparation utilities for staging Firestore payloads (no writes)

#### team-scrape/

- `scripts/` - Team roster and draft pick scraping tools
- `output/` - Team data outputs
  - `team-data/` - Team roster JSON files
  - `draft-picks/` - Draft pick data
  - `merged/` - Merged outputs
- `config/` - Configuration files
- `review_and_merge/` - Review and merge utilities

#### src/ (React application)

- `components/` - Layout wrappers and shared UI
- `schemas/` - Canonical Zod schemas for players_v2 and architect
- `features/` - Domain features (table, profile, roster, filters, tierMaker, lists)
- `hooks/` - Custom React hooks for Firebase and filtering
- `pages/` - Top-level route views
- `utils/` - Helper utilities (filtering, formatting, roster logic, architect/trade tools)
- `constants/` - Shared constants and enums
- `firebase/` - Firestore helpers and configuration
- `data/` - Firestore path utilities
- `features/architect/utils/exceptionHistory/` - Phase 49 helper module housing `historyHelpers.js` for deterministic TPE exception history entry creation and deduplication
- `features/architect/utils/offseason/` - Offseason Transition Engine (OSTE) utilities for year-to-year state transitions

#### scripts/

- `firebase-utils/` - Firebase Admin utilities
- `schema-tools/` - Schema validation and migration tools
- `firebaseConfig.node.js` - Node.js Firebase configuration
- `emu/` - Local emulator workflow scripts (port cleanup, seed gate, export fallback)

#### docs/

- `_working/` - Temporary planning, review, and draft documentation for active initiatives
- `return_packages/` - Canonical execution-evidence archive for current return packages
- `schema/` - Firestore schema documentation
- `guides/` - User and developer guides
- `compliance/` - CBA compliance matrix; historical audit certificates in `archive/docs/compliance/`
- `components/` - Component hierarchy documentation
- `scouting/` - Scouting feature audits and master docs
- `migrations/` - Migration documentation and plans
- `architect-teams-plan/` - Architect feature planning docs (multi-season roster planning)
- `runbooks/` - Operational runbooks for scrapes, staging, and deployment workflows
- `workspace-rules/` - Repo documentation placement, return-package, and workspace guardrails

## Naming Conventions

### Player IDs

- Format: `snake_case` (lowercase with underscores)
- Pattern: `^[a-z]+(_[a-z]+)*$`
- Examples: `luka_doncic`, `austin_reaves`, `jalen_wilson`
- Used consistently across:
  - Firestore document IDs (`/players_v2/{playerId}`)
  - JSON artifact filenames (`{playerId}.json`)
  - HTML snapshot filenames (`{playerId}.html`)
  - Environment variables (`PLAYER_ID`)

### Team Codes

- Format: 3-letter uppercase abbreviations
- Pattern: `^[A-Z]{3}$`
- Examples: `DAL`, `LAL`, `BOS`, `GSW`
- Used in:
  - Contract output directories (`player-scrape/contracts/output/{TEAM}/`)
  - Firestore team documents
  - Player contract team references

### File Naming

- **Contract outputs:** `{playerId}.json` (e.g., `luka_doncic.json`)
- **HTML snapshots:** `{playerId}.html` (e.g., `luka_doncic.html`)
- **Test fixtures:** `{playerId}.{expected|snapshot}.json`
- **Scripts:** `{action}_{entity}.{ts|js|cjs}` (e.g., `parse_player.ts`, `fetch_page.ts`)

### Seasons

- Format: `"YYYY-YY"` (string with hyphen)
- Pattern: `^\d{4}-\d{2}$`
- Examples: `"2024-25"`, `"2025-26"`
- Used in contract year data and season identifiers

## Runtime & Tooling

### Environment

- **Node.js:** `>=18.17` (specified in `package.json` engines)
- **Package Manager:** npm
- **TypeScript:** Yes (tsconfig.json present, `tsx` for script execution)
- **React:** 18.2.0 with Vite 4.4.0

### Development Tools

- **Linting:** ESLint (`npm run lint`)
- **Type Checking:** TypeScript compiler (`npm run typecheck`)
- **Testing:** Vitest (`npm run test`)
- **Build:** Vite (`npm run build`)
- **Dev Server:** Vite dev server (`npm run dev`)

### Key Dependencies

- **Firebase:** Client SDK (11.6.1) + Admin SDK (13.5.0)
- **Validation:** Zod (4.1.12)
- **Web Scraping:** Puppeteer (24.23.0), Cheerio (1.1.2)
- **Testing:** Vitest (1.6.1), @testing-library/react (14.2.1)

## Script Interfaces

### Emulator Workflow

#### `scripts/emu/runEmu.ts`

**Purpose:** Start Firebase emulators with port self-heal, data import/export, and seed-if-missing.

**Usage:**

```bash
npm run emu
```

**Behavior:**

- Auto-frees configured emulator ports before startup
- Starts emulators with `--import=./.emulator-data` and `--export-on-exit=./.emulator-data`
- Runs `scripts/emu/seedIfMissing.ts` after Firestore is ready
- Forces a fallback export after emulator shutdown

#### `scripts/emu/seedIfMissing.ts`

**Purpose:** Seed base entitlements into the emulator only when missing.

**Usage:**

```bash
npx tsx scripts/emu/seedIfMissing.ts
```

**Environment Variables:**

- `FIRESTORE_EMULATOR_HOST` (required)
- `FIREBASE_AUTH_EMULATOR_HOST` (required)

### Player Contract Scraping

#### `player-scrape/contracts/scripts/scrape_player.ts`

**Purpose:** Fetch and parse a single player's contract from SalarySwish

**Usage:**

```bash
PLAYER_ID=luka_doncic SOURCE_URL=https://salaryswish.com/players/luka-doncic npm run scrape:one
```

**Environment Variables:**

- `PLAYER_ID` (required) - Player identifier in snake_case
- `SOURCE_URL` (required) - SalarySwish player page URL

**Output:**

- `player-scrape/contracts/output/{TEAM}/{playerId}.json`

**Exit Codes:**

- `0` - Success
- `1` - Missing required environment variables or parse failure

#### `player-scrape/contracts/scripts/parse_player.ts`

**Purpose:** Parse player contract from HTML snapshot

**Usage:**

```bash
PLAYER_URL="https://salaryswish.com/players/austin-reaves" PLAYER_ID="austin_reaves" npm run parse-player
```

**Environment Variables:**

- `PLAYER_URL` (required) - Source URL for metadata
- `PLAYER_ID` (required) - Player identifier
- `DEBUG` (optional) - Set to `1` for verbose output

**Input:** `player-scrape/contracts/working/page.html`

**Output:** `player-scrape/contracts/output/player.json`

#### `player-scrape/contracts/scripts/fetch_player_page.ts`

**Purpose:** Fetch raw HTML from SalarySwish player page

**Usage:**

```bash
PLAYER_URL="https://salaryswish.com/players/player-name" npm run fetch-player
```

**Environment Variables:**

- `PLAYER_URL` (required) - SalarySwish player page URL

**Output:** `player-scrape/contracts/working/page.html`

#### `player-scrape/contracts/scripts/validate_player.ts`

- `player-scrape/firestore_staging/stage_player.ts`
  - **Purpose:** Transform scraped contract + stats outputs into staged JSON payloads for `players_v2` and `/architect/basePlayers`
  - **Usage:** `npx tsx player-scrape/firestore_staging/stage_player.ts --player=toumani_camara [--outDir=custom] [--validate]`
  - **Notes:** Produces files under `player-scrape/firestore_staging/_artifacts/output/` for manual review; validation flag enforces Zod schema checks
- `player-scrape/firestore_staging/run_full_scrape.ts`
  - **Purpose:** Full-league orchestrator that runs contract + stats scrapers with configurable batching, exponential backoff, and per-phase logging
  - **Usage:** `npx tsx player-scrape/firestore_staging/run_full_scrape.ts [--teams=LAL,BOS] [--batchSize=4] [--concurrency=6] [--maxRetries=4]`
  - **Notes:** Streams logs to `player-scrape/logs/<timestamp>/{contracts,stats}/TEAM.log`; supports `--contractsOnly` / `--statsOnly` modes and auto-resume for previously scraped players

**Purpose:** Validate scraped player contract against schema

**Usage:**

```bash
npm run validate-player
```

**Input:** `player-scrape/contracts/output/player.json`

**Validation:** Uses Zod schema from `player-scrape/shared/schema/player_scrape_schema.ts`

#### `player-scrape/contracts/scripts/run_regress.ts`

**Purpose:** Run regression tests against known player fixtures

**Usage:**

```bash
npm run regress
```

**Fixtures:** `player-scrape/contracts/fixtures/*.{expected|snapshot}.json`

**Exit Codes:**

- `0` - All tests pass
- `1` - One or more tests fail

#### Batch Processing Scripts

- `batch_scrape_players.ts` - Batch process multiple players from a list
- `batch_process_all_teams.ts` - Process all NBA teams
- `batch_process_lakers.ts` - Process Lakers roster
- `batch_process_thunder.ts` - Process Thunder roster
- `batch_process_trio.ts` - Process specific player trio
- `batch_process_parallel.ts` - Parallel batch processing

#### `player-scrape/shared/tools/headshots/download_headshots.ts`

**Purpose:** Download NBA player headshots from official CDN and save to `public/assets/headshots/`

**Usage:**

```bash
# Annual full-season refresh (overwrites all)
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --all

# Targeted updates (trades, new signings)
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --filter=lebron_james,austin_reaves

# Dry run (preview without writing)
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --all --dry-run

# Custom concurrency
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --all --concurrency=5
```

**Input:** `player-scrape/shared/outputs/player_index.json` (requires `nbaId` field)

**Output:** `public/assets/headshots/{playerId}.png`

**Flags:**

- `--all` - Process all players (default: overwrite existing)
- `--filter=<ids>` - Comma-separated player IDs to process
- `--overwrite` - Overwrite existing files (default: true with `--all`, false otherwise)
- `--dry-run` - Preview without writing files
- `--concurrency=<n>` - Max concurrent downloads (default: 10)

**Notes:** Replaces legacy Python script (`archive/data_pipeline/helpers/tools/pull_all_headshots.py`). Uses same `player_index.json` as contract/stats scrapers.

**Common Environment Variables:**

- `PLAYERS_FILE` - Path to players list JSON
- `OUTPUT_DIR` - Output directory override
- `RATE_LIMIT_MS` - Rate limiting delay (default: 2000ms)
- `SKIP_FETCH` - Set to `1` to skip fetching, only parse

### Team Scraping

#### `team-scrape/team-data/scripts/fetch_page.ts`

**Purpose:** Fetch team roster page HTML

**Usage:**

```bash
npm run fetch
```

#### `team-scrape/team-data/scripts/parse_team.ts`

**Purpose:** Parse team roster from HTML

**Usage:**

```bash
npm run parse
```

#### `team-scrape/team-data/scripts/probe.ts`

**Purpose:** Interactive HTML structure probe tool

**Usage:**

```bash
npm run probe
```

#### `team-scrape/team-data/scripts/inspect.ts`

**Purpose:** Inspect team data structure

**Usage:**

```bash
npm run inspect
```

#### `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`

**Purpose:** Scrape draft pick data from RealGM

**Usage:**

```bash
npm run realgm:drafts
```

#### `team-scrape/draft-picks/scripts/audit_recipient_inventory_invariant.ts`

**Purpose:** Verify unconditional "To TEAM" mentions land in TEAM inventory (not only contested).

**Usage:**

```bash
npx tsx team-scrape/draft-picks/scripts/audit_recipient_inventory_invariant.ts \
  [--teams=ALL] \
  [--mentionsDir=team-scrape/draft-picks/_artifacts/output/mentions] \
  [--ledgerDir=team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team]
```

**Output:** `team-scrape/draft-picks/_artifacts/audits/recipient_inventory_invariant_report.json`

**Exit Codes:**

- `0` - Invariant satisfied
- `1` - Invariant violations or missing inputs

#### `team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts`

**Purpose:** Push base entitlement definitions to `architect_baseEntitlements` from Phase 8.1 outputs.

**Usage:**

```bash
npm run pst:push:base-entitlements
```

#### `team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts`

**Purpose:** Patch base teams with `entitlementIds` derived from Phase 8.1 team holdings.

**Usage:**

```bash
npm run pst:patch:base-teams-entitlements
```

#### `team-scrape/draft-picks/scripts/pst/pst_phase_10_validate_firestore_entitlements.ts`

**Purpose:** Validate Firestore entitlements counts, team holdings, and resolver merge behavior.

**Usage:**

```bash
npx tsx team-scrape/draft-picks/scripts/pst/pst_phase_10_validate_firestore_entitlements.ts
```

#### `npm run draft-picks:verify`

**Purpose:** Local draft-picks verification (build + reports + audits, no scrape).

**Usage:**

```bash
# Fast verify (no scrape, uses existing mentions)
npm run draft-picks:verify

# Full end-to-end (scrape + verify)
npm run draft-picks:scrape-verify
```

- `team-scrape/shared/firestore_staging/stage_team.ts`
  - **Purpose:** Transform SalarySwish + RealGM outputs into staged `/architect/baseTeams/{teamCode}` documents
  - **Usage:** `npx tsx team-scrape/shared/firestore_staging/stage_team.ts --team=LAL [--season=2025-26] [--outDir=custom] [--validate]`
  - **Notes:** Writes previews to `team-scrape/shared/firestore_staging/output/` (git-ignored) and reuses the shared player index for name → playerId resolution
- `team-scrape/shared/firestore_staging/run_full_team_scrape.ts`
  - **Purpose:** Full-team orchestrator that fetches SalarySwish pages via Playwright, parses outputs, stages Firestore payloads, and rate-limits between steps
  - **Usage:** `npx tsx team-scrape/shared/firestore_staging/run_full_team_scrape.ts [--teams=LAL,NYK] [--batchSize=3] [--delayMs=1500] [--maxRetries=3]`
  - **Notes:** Logs per-phase execution to `team-scrape/logs/<timestamp>/{fetch,parse,stage}/TEAM.log`; auto-discovers SalarySwish slugs and supports backoff tuning
- `team-scrape/shared/review_and_merge/scripts/merge_team_outputs.ts`
  - **Purpose:** Merge SalarySwish team data with RealGM draft picks, emitting per-team and combined JSON plus execution logs
  - **Usage:** `npx tsx team-scrape/shared/review_and_merge/scripts/merge_team_outputs.ts [--teams=LAL,BOS] [--logDir=team-scrape/logs] [--pretty=true]`
  - **Notes:** Discovers teams dynamically from input directories, writes logs to `team-scrape/logs/merge-<timestamp>.log`, and respects `--outputDir` / `--salaryDir` / `--draftDir` overrides
- `player-scrape/firestore_staging/push_staged_players.ts`
  - **Purpose:** Push staged player documents (`players_v2` + `/architect/basePlayers`) using Firebase Admin credentials
  - **Usage:** `npx tsx player-scrape/firestore_staging/push_staged_players.ts player_id [player_id...]`
  - **Notes:** Reads `PLAYERS_V2_COLLECTION` / `BASE_PLAYERS_COLLECTION` from env, expects `serviceAccountKey.json` in repo root, and respects staged outputs in `player-scrape/firestore_staging/_artifacts/output/`
- `team-scrape/shared/firestore_staging/push_staged_teams.ts`
  - **Purpose:** Push staged `/architect/baseTeams` documents with retry/backoff support
  - **Usage:** `npx tsx team-scrape/shared/firestore_staging/push_staged_teams.ts TEAM_CODE [TEAM_CODE...] [--stageDir=path] [--delayMs=500] [--maxRetries=3]`
  - **Notes:** Applies exponential backoff (`--retryDelayMs`, `--backoffMultiplier`) between attempts and logs progress per team

### Build & Development

#### `npm run dev`

**Purpose:** Start Vite development server

**Output:** Dev server at `http://localhost:5173`

**Duration:** Continuous (use Ctrl+C to stop)

#### `npm run build`

**Purpose:** Build production bundle

**Output:** `dist/` directory

**Duration:** ~7-10 seconds

#### `npm run test`

**Purpose:** Run test suite

**Options:**

- `npm run test -- --run` - Run once (non-watch mode)
- `npm run test tests/capUtils.test.js -- --run` - Run specific test file

**Duration:** ~15 seconds for full suite

#### `npm run typecheck`

**Purpose:** TypeScript type checking without emitting files

**Duration:** ~5-10 seconds

#### `npm run lint`

**Purpose:** ESLint code quality check

**Duration:** ~8 seconds

**Note:** Current repo has ~1888 existing lint errors (technical debt)

## Data Contracts

### Contract Artifacts (Non-Firestore)

#### Player Contract JSON

**Location:** `player-scrape/contracts/output/{TEAM}/{playerId}.json`

**Schema:** Defined in `player-scrape/shared/schema/player_scrape_schema.ts`

**Key Fields:**

```typescript
{
  playerId: string,           // snake_case identifier
  displayName: string,        // Human-readable name
  teamCode: string,           // 3-letter team code
  bio: {
    position?: string,
    height?: string,
    weight?: string,
    age?: number,
    birthdate?: string,
    experience?: number,
    draft?: {
      year: number,
      round: number,
      pick: number,
      team: string
    }
  },
  contracts: Array<{
    contractType: string,
    startSeason: string,
    endSeason: string,
    yearsTotal: number,
    yearsRemaining: number,
    totalValue: number,
    averageAnnualValue: number,
    guaranteedValue: number,
    guaranteedYears: number,
    salariesByYear: Array<{
      season: string,
      salary: number,
      capHit: number,
      guaranteed: boolean,
      guaranteedAmount: number,
      option: string | null,
      optionUsed: boolean | null,
      optionDecisionDate: string | null,
      tradeBonus: number | null,
      incentives: {
        likely: number,
        unlikely: number
      }
    }>
  }>,
  freeAgency?: {
    status: string,
    season: string,
    type: string
  }
}
```

**Validation Rules:**

- `playerId` must match filename
- `teamCode` must be 3-letter uppercase
- All dates in ISO `YYYY-MM-DD` format
- `optionUsed` and `optionDecisionDate` must both be null or both be set
- `yearsRemaining` counts only non-voided future years
- File must pass Zod schema validation

#### HTML Snapshots

**Location:** `player-scrape/contracts/snapshots/{playerId}.html`

**Purpose:** Raw SalarySwish page HTML for regression testing

**Format:** UTF-8 encoded HTML

#### Test Fixtures

**Location:** `player-scrape/contracts/fixtures/{playerId}.{expected|snapshot}.json`

**Types:**

- `.expected.json` - Hand-verified expected output
- `.snapshot.json` - Captured output for regression comparison

**Regression Fixtures:**

- `luka_doncic`
- `jalen_wilson`
- `jordan_poole`
- `austin_reaves`

### Team Data Artifacts

**Location:** `team-scrape/team-data/output/`

**Format:** JSON (structure TBD based on actual outputs)

### Player Index

**Location:** `player-scrape/shared/outputs/player_index.json` (built via `npm run build-player-index`)

**Format:** JSON list of player metadata

## Firestore Collections

**Note:** Full Firestore schema is documented in `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`. This section provides a high-level summary.

### `/players_v2/{playerId}`

**Status:** ✅ Migration complete (active/stable)

**Structure:** Hierarchical with subcollections + denormalized views

**Top-Level Fields:**

- `bio.*` - Player biographical information
- `createdAt`, `updatedAt` - Timestamps
- `currentContractView` - Denormalized contract view for fast filtering (optional)
- `currentEvaluationView` - Denormalized evaluation view for fast filtering (optional)
- `currentSeasonStats` - Denormalized latest season stats for fast filtering (optional)

**Subcollections:**

- `/contracts/{contractId}` - Contract details
- `/seasons/{seasonId}` - Season statistics
- `/evaluations/{evaluationId}` - Player grades and evaluations

**Access Pattern:**

```javascript
const player = await getDoc(doc(db, 'players_v2', playerId));
const bio = player.data().bio;
const contracts = await getDocs(
  collection(doc(db, 'players_v2', playerId), 'contracts')
);
```

### `/architect_baseTeams/{teamCode}`

**Status:** ✅ Active (architect)

**Structure:** See `docs/schema/architect.md` for complete schema

**Notes:**

- `entitlementIds` stores entitlement ownership for each team (Phase 10).

### `/architect_baseEntitlements/{entitlementId}`

**Status:** ✅ Active (Phase 10)

**Usage:** Base entitlement definitions for draft assets and trade machine reads.

### `/architect_worlds/{worldId}/entitlements/{entitlementId}`

**Status:** ✅ Active (Phase 10)

**Usage:** World entitlement overrides or world-created entitlements.

### `/teams/{teamId}`

**Status:** 🚧 Migrating to `/architect/` collections

**Current Structure:**

- `capSheet.players[]` - Array of flattened player objects with `contract_clean`
- `capSheet.lastUpdated` - Timestamp

**Migration Target:** See `docs/migrations/teams-to-architect/TARGET_SCHEMA.md`

**Access Pattern:**

```javascript
const team = await getDoc(doc(db, 'teams', teamId));
const players = team.data().capSheet.players;
```

### Artifact → Firestore Pipeline

**Player Contracts:**

1. Scrape from SalarySwish → `player-scrape/contracts/output/{TEAM}/{playerId}.json`
2. Validate against Zod schema
3. Transform and upload to `/players_v2/{playerId}/contracts/{contractId}` (manual/script-driven)

**Owner:** TBD (likely via `scripts/firebase-utils/` or Python upload scripts)

## Pipelines

### Player Contract Pipeline

**Owner:** TBD

**Stages:**

1. **Fetch** - Download HTML from SalarySwish
   - Tool: `fetch_player_page.ts`
   - Input: `PLAYER_URL` environment variable
   - Output: `working/page.html`

2. **Parse** - Extract structured data from HTML
   - Tool: `parse_player.ts`
   - Input: `working/page.html`
   - Output: `output/{TEAM}/{playerId}.json`
   - Normalization rules applied (option pairing, date formatting, guarantee calculation)

3. **Validate** - Verify against schema
   - Tool: `validate_player.ts` or regression tests
   - Schema: `player_scrape_schema.ts` (Zod)
   - Exit on validation failure

4. **Upload** - Push to Firestore (manual step)
   - Target: `/players_v2/{playerId}/contracts/`
   - Tool: TBD (likely Firebase Admin scripts)

**Data Flow:**

```text
SalarySwish URL
  → working/page.html
  → output/{TEAM}/{playerId}.json
  → /players_v2/{playerId}/contracts/{contractId}
```

### Team Roster Pipeline

**Owner:** TBD

**Stages:**

1. **Fetch** - Download team roster page
2. **Parse** - Extract roster and pick data
3. **Validate** - Schema validation
4. **Merge** - Combine with other data sources
5. **Upload** - Push to Firestore

**Output Locations:**

- `team-scrape/team-data/output/`
- `team-scrape/draft-picks/output/`
- `team-scrape/shared/firestore_staging/output/merged/`

**Target Firestore:** Migrating to `/architect/` collections

### Stats Pipeline

**Status:** TBD (directory exists but implementation incomplete)

**Location:** `player-scrape/stats/`

## Validation Rules

### Filename ↔ ID Matching

**Rule:** Player contract filenames must match the `playerId` field in the JSON content

**Validation:**

```typescript
const filename = path.basename(filepath, '.json');
const content = JSON.parse(await fs.readFile(filepath, 'utf8'));
assert(
  filename === content.playerId,
  `Filename ${filename}.json does not match playerId "${content.playerId}"`
);
```

**Applies to:**

- `player-scrape/contracts/output/**/*.json`
- `player-scrape/contracts/fixtures/**/*.json`

### Team Code Format

**Rule:** All team codes must be exactly 3 uppercase letters

**Pattern:** `/^[A-Z]{3}$/`

**Validation:**

```typescript
assert(
  /^[A-Z]{3}$/.test(teamCode),
  `Invalid team code "${teamCode}" - must be 3 uppercase letters`
);
```

### Player ID Format

**Rule:** All player IDs must be lowercase snake_case

**Pattern:** `/^[a-z]+(_[a-z]+)*$/`

**Validation:**

```typescript
assert(
  /^[a-z]+(_[a-z]+)*$/.test(playerId),
  `Invalid playerId "${playerId}" - must be lowercase snake_case`
);
```

### Date Format

**Rule:** All dates must be in ISO `YYYY-MM-DD` format

**Pattern:** `/^\d{4}-\d{2}-\d{2}$/`

**Applies to:**

- `optionDecisionDate`
- `birthdate`
- Any date field in contract data

### Option Field Pairing

**Rule:** `optionUsed` and `optionDecisionDate` must both be null or both be set

**Validation:**

```typescript
const bothNull = optionUsed === null && optionDecisionDate === null;
const bothSet = optionUsed !== null && optionDecisionDate !== null;
assert(
  bothNull || bothSet,
  'optionUsed and optionDecisionDate must both be null or both be set'
);
```

### Schema Validation

**Rule:** All player contract artifacts must validate against the Zod schema

**Schema Location:** `player-scrape/shared/schema/player_scrape_schema.ts`

**Validation:**

```typescript
import { basePlayerSchema } from './player-scrape/shared/schema/player_scrape_schema';
const result = basePlayerSchema.safeParse(jsonContent);
assert(result.success, `Schema validation failed: ${result.error}`);
```

### Required Directories

**Rule:** Core project directories must exist

**Required:**

- `player-scrape/contracts/output/`
- `player-scrape/contracts/fixtures/`
- `player-scrape/contracts/snapshots/`
- `player-scrape/contracts/working/`
- `team-scrape/team-data/output/`
- `team-scrape/draft-picks/output/`
- `team-scrape/shared/firestore_staging/output/merged/`
- `scripts/`
- `src/`
- `tests/`
- `docs/`

### Totals Rollups

**Rule:** Contract `guaranteedValue` and `guaranteedYears` must match sum/count of guaranteed years in `salariesByYear`

**Validation:**

```typescript
const guaranteedYears = salariesByYear.filter((y) => y.guaranteed).length;
const guaranteedValue = salariesByYear
  .filter((y) => y.guaranteed)
  .reduce((sum, y) => sum + y.guaranteedAmount, 0);

assert(
  contract.guaranteedYears === guaranteedYears,
  'guaranteedYears mismatch'
);
assert(
  contract.guaranteedValue === guaranteedValue,
  'guaranteedValue mismatch'
);
```

## Contributing Rules

### When to Update Schema

Contributors must update `PROJECT_SCHEMA.md` and `project.schema.json` when:

1. **Adding new top-level directories** - Document purpose in Repo Layout section
2. **Adding new scripts** - Document in Script Interfaces with usage, inputs, outputs, exit codes
3. **Changing artifact locations** - Update paths in Data Contracts and Pipelines sections
4. **Modifying naming conventions** - Update patterns and examples in Naming Conventions
5. **Adding new validation rules** - Document in Validation Rules section
6. **Changing Firestore collections** - Update Firestore Collections section and link to detailed schema docs
7. **Adding new dependencies** - Update Runtime & Tooling section
8. **Modifying pipeline stages** - Update Pipelines section with new flow

### When to Update Tests

Contributors must update or add schema validation tests when:

1. **Adding new validation rules** - Add corresponding test cases
2. **Changing artifact schemas** - Update Zod schemas and regression tests
3. **Modifying pipelines** - Add integration tests for new pipeline stages

### Documentation Updates

When making structural changes, also update:

- `README.md` - If changing setup or key features
- `docs/guides/DEVELOPER_GUIDE.md` - If changing component architecture or key utilities
- `AGENTS.md` - If changing agent task rules or file structure patterns
- `docs/schema/CURRENT_FIRESTORE_SCHEMA.md` - If changing Firestore collections

### Pre-Commit Validation

Before committing:

1. Run `npm run validate:project` - Schema validation must pass
2. Run `npm run typecheck` - Type checking must pass (or only show pre-existing errors)
3. Run `npm run test -- --run` - Tests should pass (or only show pre-existing failures)
4. Run `npm run lint` - Check for new linting errors (1888 existing errors are known technical debt)

---

**Version:** 1.0.0  
**Last Updated:** 2025-10-30  
**Maintainers:** See `AGENTS.md` for agent task assignments
