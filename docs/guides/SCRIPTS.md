# npm Scripts Reference

ScoutZero has 130+ npm scripts for development, data pipelines, testing, and deployment. This guide organizes them by category and explains their purpose.

---

## Table of Contents

- [Quick Start (Essential Commands)](#quick-start-essential-commands)
- [Development](#development)
- [Testing & Validation](#testing--validation)
- [Player Data Pipeline](#player-data-pipeline)
- [Team Data Pipeline](#team-data-pipeline)
- [Draft Picks Pipeline](#draft-picks-pipeline)
- [PST (Projected Salary Trade) Pipeline](#pst-projected-salary-trade-pipeline)
- [Firebase Emulator](#firebase-emulator)
- [CI/CD Gates](#cicd-gates)
- [Production Deployment](#production-deployment)
- [Utilities](#utilities)

---

## Quick Start (Essential Commands)

These are the commands you'll use daily:

```bash
# Development
npm run dev              # Start development server (http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build locally

# Quality Checks
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint code linting
npm run lint:md          # Markdown linting
npm test                 # Run all tests

# Common Data Tasks
npm run team:salaryswish # Scrape all team salary data
npm run contracts:run    # Scrape all player contract data
```

---

## Development

### Frontend Development

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite development server at <http://localhost:5173> |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build locally |
| `npm run zen` | Toggle zen view mode (utility script) |

### Code Quality

| Script | Description |
|--------|-------------|
| `npm run typecheck` | Run TypeScript compiler in check mode (no emit) |
| `npm run lint` | Lint JavaScript/TypeScript files with ESLint |
| `npm run lint:md` | Lint markdown documentation files |
| `npm run prepare` | Husky git hooks setup (runs automatically on `npm install`) |

### Documentation

| Script | Description |
|--------|-------------|
| `npm run docs` | Generate API documentation from JSDoc comments |
| `npm run schema:generate` | Generate schema documentation from Zod schemas |
| `npm run schema:check` | Verify schema docs are up to date (used in CI) |

### Project Validation

| Script | Description |
|--------|-------------|
| `npm run validate:project` | Validate project structure against PROJECT_SCHEMA.md |

---

## Testing & Validation

### Unit & Integration Tests

| Script | Description |
|--------|-------------|
| `npm test` | Run all tests (excludes emulator tests) |
| `npm test -- --watch` | Run tests in watch mode |
| `npm test -- --coverage` | Run tests with coverage report |

### Emulator Tests

| Script | Description |
|--------|-------------|
| `npm run ci:phaseD4-dare-emulator-gate` | Run E2E emulator tests (requires emulator running) |
| `npm run verify:draft-assets:emu` | Verify draft assets with emulator |

### Verification Gates

| Script | Description |
|--------|-------------|
| `npm run verify:draft-assets` | Verify draft pick entitlement invariants |
| `npm run verify:legacy:phaseD2` | Legacy phase D2 verification |
| `npm run verify:legacy:phaseD3` | Legacy phase D3 verification |
| `npm run verify:legacy:phaseD4` | Legacy phase D4 emulator verification |

See [TESTING.md](TESTING.md) for detailed testing documentation.

---

## Player Data Pipeline

### Contract Scraping

| Script | Description |
|--------|-------------|
| `npm run fetch-player` | Fetch single player page from external source |
| `npm run parse-player` | Parse fetched player page |
| `npm run validate-player` | Validate parsed player data |
| `npm run contracts:run` | **Run full contract scrape for all players** |
| `npm run contracts:team` | Scrape contracts for single team (default: LAL) |
| `npm run contracts:one` | Scrape contract for single player (e.g., austin_reaves) |
| `npm run contracts:push` | Scrape and push contracts to Firestore |

**Tip**: Use `--player=<name>` or `--team=<code>` flags to customize.

### Stats Scraping

| Script | Description |
|--------|-------------|
| `npm run stats:batch` | Run stats batch scraping |
| `npm run regress:stats` | Regression test for stats scraper |

### Player Foundation

| Script | Description |
|--------|-------------|
| `npm run build:ids` | Build all player IDs mapping (season 2026) |
| `npm run build:bios` | Build player bios (season 2026) |
| `npm run build:index` | Build player index |
| `npm run build:foundation` | **Run all foundation scripts** (ids → bios → index) |
| `npm run build-player-index` | Alternative player index build script |

### Player Utilities

| Script | Description |
|--------|-------------|
| `npm run peek:ids` | Count total player IDs |
| `npm run peek:has` | Check if player ID exists (use `IDS=123,456 npm run peek:has`) |
| `npm run peek:unresolved` | View unresolved player names |
| `npm run peek:dupes` | View duplicate name candidates |
| `npm run peek:filtered` | View filtered out players |

### Validation

| Script | Description |
|--------|-------------|
| `npm run validate-po-voiding` | Validate player option voiding logic |
| `npm run regress` | Run contract scraper regression tests |

---

## Team Data Pipeline

### Team Salary Scraping

| Script | Description |
|--------|-------------|
| `npm run fetch` | Fetch single team page |
| `npm run probe` | Probe team data structure |
| `npm run parse` | Parse team page |
| `npm run inspect` | Inspect parsed team data |
| `npm run team:salaryswish` | **Run full team salary scrape** |
| `npm run stage:team` | Stage single team for Firestore |
| `npm run team:push` | Push staged teams to Firestore |
| `npm run team:publish` | Stage and push teams (stage → push) |

### Team Review

| Script | Description |
|--------|-------------|
| `npm run merge:samples` | Merge team output samples |
| `npm run clean-view` | Create clean view of team data |

---

## Draft Picks Pipeline

### Draft Picks Scraping (RealGM)

| Script | Description |
|--------|-------------|
| `npm run team:draft-picks` | Scrape draft picks from RealGM |
| `npm run draft-picks:scrape` | Scrape draft picks to mentions output |
| `npm run draft-picks:build` | Build pick ledger from mentions |
| `npm run draft-picks:verify` | **Run full verification** (build → reports → audits) |
| `npm run draft-picks:scrape-verify` | **Scrape and verify** (scrape → verify) |

### Draft Picks Reports

| Script | Description |
|--------|-------------|
| `npm run draft-picks:reports` | Generate all reports (TSV, MD, assets) |
| `npm run draft-picks:assets-md` | Generate draft assets markdown |
| `npm run draft-picks:assets-manual-check` | Generate manual check markdown |

### Draft Picks Audits

| Script | Description |
|--------|-------------|
| `npm run draft-picks:audits` | **Run all audits** (coverage, semantics, inventory, assets) |

Individual audit scripts run as part of `draft-picks:audits`:

- Year coverage audit
- Semantic assertions audit
- Recipient inventory invariant audit
- Draft assets invariant audit

---

## PST (Projected Salary Trade) Pipeline

The PST pipeline scrapes and processes projected salary data for trade analysis. It runs in multiple phases:

### Phase 1-2: Fetch & Extract

| Script | Description |
|--------|-------------|
| `npm run pst:fetch` | Fetch PST pages (headless mode) |
| `npm run pst:fetch:headed` | Fetch PST pages (headed browser) |
| `npm run pst:fetch:session` | Fetch using saved session |
| `npm run pst:fetch:cdp` | Fetch using Chrome DevTools Protocol |
| `npm run pst:fetch:cdp:test` | Test CDP fetch |
| `npm run pst:extract` | Extract raw rows from fetched pages |
| `npm run pst:validate` | Validate phase 1-2 output |
| `npm run pst:phase-1-2` | **Run phase 1-2** (fetch:session → extract → validate) |
| `npm run pst:phase-1-2:cdp` | **Run phase 1-2 with CDP** (fetch:cdp → extract → validate) |

### Phase 2: Build Ledger

| Script | Description |
|--------|-------------|
| `npm run pst:build:base` | Build base ledger |
| `npm run pst:build:overlay` | Build owner overlay |
| `npm run pst:apply:overlay` | Apply display owner overlay |
| `npm run pst:build:holdings` | Build holdings by team |
| `npm run pst:phase-2` | **Run phase 2** (base → overlay → apply → holdings) |
| `npm run pst:phase-2:validate` | Validate phase 2 ledger |

### Phases 3-5: Normalize & Finalize

| Script | Description |
|--------|-------------|
| `npm run pst:phase-3` | Normalize text fields |
| `npm run pst:phase-4` | Build entitlement profiles |
| `npm run pst:phase-4:report` | Build profiles and output report |
| `npm run pst:phase-5` | Finalize ledger |
| `npm run pst:phase-5:validate` | Validate finalized ledger |

### Build Final

| Script | Description |
|--------|-------------|
| `npm run pst:build-final` | **Run complete build** (overlay → phase 4 → phase 5 → validate → views) |

### Manual Views & Validation

| Script | Description |
|--------|-------------|
| `npm run pst:manual-views` | Generate manual check views (v6.5) |
| `npm run pst:manual-views:legacy` | Generate manual check views (legacy) |
| `npm run pst:manual-rights-views` | Generate rights views |
| `npm run pst:validate:overlay:regressions` | Validate owner overlay regressions |

### Session Management

| Script | Description |
|--------|-------------|
| `npm run pst:session:chrome` | Launch Chrome debug helper |
| `npm run pst:session:capture` | Capture browser session |
| `npm run pst:session:capture:cdp` | Capture session via CDP |
| `npm run pst:session:test` | Test session-based fetch |

### Manual Fetch Helpers

| Script | Description |
|--------|-------------|
| `npm run pst:manual:urls` | Generate URLs for manual fetch |
| `npm run pst:manual:check` | Check manual fetch status |
| `npm run pst:manual:manifest` | Generate fetch manifest |

### Entitlements

| Script | Description |
|--------|-------------|
| `npm run pst:entitlements` | Build entitlement assets (phase 8) |
| `npm run pst:push:base-entitlements` | Push base entitlements to Firestore (phase 10) |
| `npm run pst:patch:base-teams-entitlements` | Patch base teams with entitlement data (phase 10) |
| `npm run pst:push:base-pick-rules` | Push base pick rules to Firestore (phase 12.3a) |

### PST Audits

| Script | Description |
|--------|-------------|
| `npm run pst:audit:hou:2026:r2` | Audit Houston 2026 Round 2 pick |
| `npm run pst:audit:hou:entitlements` | Audit Houston entitlements sanity |
| `npm run pst:audit:entitlements:all` | Audit all teams entitlements |
| `npm run pst:guard:entitlements:sanity` | Guard entitlements sanity (CI gate) |
| `npm run pst:trace:hou:2026:r2` | Trace owner overlay anomalies |

---

## Firebase Emulator

### Emulator Control

| Script | Description |
|--------|-------------|
| `npm run emu` | Run Firebase emulator |
| `npm run emu:save` | Export emulator data to `.emulator-data/` |
| `npm run emu:clear` | Clear emulator data directory |

### Emulator Seeding

| Script | Description |
|--------|-------------|
| `npm run emu:seed:base-players` | Seed base players if missing |
| `npm run emu:seed:players-v2` | Seed players_v2 collection if missing |
| `npm run emu:reseed:entitlements` | Reseed entitlements |
| `npm run emu:reseed:baseTeams` | Reseed base teams |

### Emulator Utilities

| Script | Description |
|--------|-------------|
| `npm run emu:repair:teams` | Repair teams in emulator |
| `npm run emu:doctor` | Run emulator health check |

---

## CI/CD Gates

These scripts run in continuous integration to verify code quality:

| Script | Description |
|--------|-------------|
| `npm run ci:phase69-proof` | Phase 69 TPE migration proof |
| `npm run ci:phase80-cap-proof` | Phase 80 cap sheet E2E proof |
| `npm run ci:phaseD2-dare-gate` | Phase D2 trade-to-advance gate |
| `npm run ci:phaseD3-dare-gate` | Phase D3 integration gate |
| `npm run ci:phaseD4-dare-emulator-gate` | Phase D4 emulator E2E gate |

---

## Production Deployment

### Pipeline Overview

| Script | Description |
|--------|-------------|
| `npm run pipeline:sync:plan` | Generate production sync plan |
| `npm run pipeline:sync:verify` | Verify sync plan (read-only) |

### Staging

| Script | Description |
|--------|-------------|
| `npm run pipeline:stage:players` | Stage all players for deployment |
| `npm run pipeline:stage:teams:patch` | Patch base teams with entitlement IDs |
| `npm run stage:patch:baseTeams:entitlementIds` | Preview entitlement ID patch (dry run) |
| `npm run stage:patch:baseTeams:entitlementIds:write` | Write entitlement ID patch |

### Verification

| Script | Description |
|--------|-------------|
| `npm run verify:artifacts:players` | Verify player artifacts before push |
| `npm run verify:artifacts:baseTeams` | Verify base teams artifacts before push |
| `npm run pipeline:verify:artifacts` | **Verify all artifacts** (players + teams) |

### Production Push (Manual)

**⚠️ IMPORTANT**: These scripts display instructions but don't auto-execute to prevent accidental production writes.

| Script | Description |
|--------|-------------|
| `npm run pipeline:prod:push:players` | Display command to push players to production |
| `npm run pipeline:prod:push:teams` | Display command to push teams to production |
| `npm run pipeline:prod:push:pst` | Display instructions for PST entitlements push |

**Example output:**

```bash
npm run pipeline:prod:push:players
# Output: Run: npx tsx player-scrape/firestore_staging/scripts/push_staged_players.ts --confirmProject=scoutzero-bf1ae
```

You must copy and run the command manually to confirm production write.

---

## Utilities

### Firestore Utilities

| Script | Description |
|--------|-------------|
| `npm run firestore:architect:scan` | Scan architect collection usage |
| `npm run firestore:architect:snapshot` | Export sanitized Firestore snapshot |

### Miscellaneous

| Script | Description |
|--------|-------------|
| `npm run realgm:drafts` | Alternative RealGM draft picks scraper |
| `npm run scrape:one` | Legacy single contract scrape (deprecated) |

---

## Common Workflows

### Full Player Data Refresh

```bash
# 1. Build foundation (player IDs, bios, index)
npm run build:foundation

# 2. Scrape all contracts
npm run contracts:run

# 3. Scrape all stats
npm run stats:batch

# 4. Stage for Firestore
npm run pipeline:stage:players

# 5. Verify before push
npm run verify:artifacts:players

# 6. Push to production (manual confirmation required)
npm run pipeline:prod:push:players
```

### Full Team Data Refresh

```bash
# 1. Scrape team salary data
npm run team:salaryswish

# 2. Scrape draft picks
npm run draft-picks:scrape-verify

# 3. Stage teams
npm run stage:team

# 4. Verify artifacts
npm run verify:artifacts:baseTeams

# 5. Push to production (manual)
npm run pipeline:prod:push:teams
```

### Draft Pick Pipeline (PST)

```bash
# Phase 1-2: Fetch and extract
npm run pst:phase-1-2:cdp

# Phase 2: Build ledger
npm run pst:phase-2
npm run pst:phase-2:validate

# Phases 3-5: Normalize and finalize
npm run pst:build-final

# Build entitlements
npm run pst:entitlements

# Validate
npm run pst:guard:entitlements:sanity
```

### Pre-Commit Workflow

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Test
npm test

# Validate project structure
npm run validate:project
```

### Development Setup

```bash
# Install dependencies
npm install

# Start emulator (in separate terminal)
npm run emu

# Seed emulator data
npm run emu:seed:base-players
npm run emu:seed:players-v2
npm run emu:reseed:baseTeams

# Start dev server
npm run dev
```

---

## Script Flags & Options

Many scripts accept command-line flags:

### Player Scraping

```bash
# Scrape specific player
npm run contracts:one -- --player=lebron_james

# Scrape specific team
npm run contracts:team -- --team=BOS --concurrency=6

# Resume interrupted scrape
npm run contracts:run -- --resume

# Push to Firestore after scraping
npm run contracts:push
```

### Draft Picks

```bash
# Specify output directory
npm run team:draft-picks -- --outDir=custom/path

# Set season
npm run build:ids -- --season=2026
```

### PST

```bash
# Run in headed mode (show browser)
npm run pst:fetch:headed

# Test mode
npm run pst:fetch:cdp:test
```

---

## Troubleshooting

### "Command not found: tsx"

Ensure dev dependencies are installed:

```bash
npm install --include=dev
```

### "FIRESTORE_EMULATOR_HOST is not set"

Set environment variable before running emulator tests:

```bash
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8082
npm run ci:phaseD4-dare-emulator-gate
```

Or use the built-in wrapper:

```bash
npm run verify:draft-assets:emu
```

### Scripts fail with TypeScript errors

Run type check to see specific errors:

```bash
npm run typecheck
```

### Emulator data corrupted

Clear and reseed:

```bash
npm run emu:clear
npm run emu:seed:base-players
npm run emu:reseed:baseTeams
```

---

## Additional Resources

- [Testing Documentation](TESTING.md) - Detailed testing guide
- [Contributing Guide](CONTRIBUTING.md) - Development workflow
- [Developer Guide](guides/DEVELOPER_GUIDE.md) - Architecture and patterns
- [Project Schema](architecture/PROJECT_SCHEMA.md) - Data structures and conventions

---

**Last Updated**: February 12, 2026
**Total Scripts**: 130+
