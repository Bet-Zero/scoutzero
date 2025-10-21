# Combined Summary: Architect Teams Plan Documentation

## Overview
This combined summary synthesizes all seven documentation files from the `/docs/architect-teams-plan/` folder, providing a complete picture of the Architect Teams Plan feature from goals through implementation.

---

## 1. Project Goals & Objectives (01-GOALS.md)

The Architect Teams Plan aims to create a comprehensive NBA roster scenario planning system with five primary goals:

1. **Multi-Season Scenario Planning**: Enable users to simulate roster decisions across multiple seasons with full CBA accuracy, tracking contract evolution, cap space changes, and waive/stretch scenarios.

2. **Branching Decision Trees**: Allow users to create and compare multiple "what-if" scenarios from a single starting point, exploring different paths (e.g., keep/cut/trade a player) without losing work.

3. **Storage Efficiency**: Minimize Firestore costs while maintaining fast read performance (<200ms for 30 teams, 1-2 MB per world, supporting 100+ worlds per user).

4. **CBA Accuracy**: Ensure 100% compliance with NBA Collective Bargaining Agreement rules including trade eligibility, Base Year Compensation, poison pill calculations, Bird rights, exception usage, cap holds, and salary matching.

5. **Data Integrity**: Maintain an immutable baseline with clear separation between real NBA data and user simulations, including audit trails and rollback capability.

**Key Architecture Decision**: All Architect data lives under `/architect` (baseTeams, basePlayers, worlds). The collections `/players_v2` and `/teams` are immutable and NOT part of Architect. Legacy top-level `Teams` (Architect v1) is deprecated and will be removed after cutover.

---

## 2. Current Status & Existing Structure (02-CURRENT-STATUS.md)

The existing Architect feature includes Cap Sheet, Trade Machine, and Cap Sheet Full capabilities accessed via `/src/pages/GMDashboard.jsx`. Current limitations include:

- Basic save/load functionality (`saveUserTeamPlan()`, `loadUserTeamPlan()`) but no multi-season support or branching
- No immutable baseline separation
- Missing world metadata tracking and action history

**Current Schema Issues**:
- Uses single year format (2026) instead of season format ("2026-27")
- Missing critical CBA fields: `yearsOfService`, `isRookieScale`, per-year `capHit` and `tradeBonus`

**Migration Strategy**: Clean slate approach - start fresh rather than migrate existing data. The new structure adds `/architect/` with baseTeams, basePlayers, and worlds collections. Player scouting data in `/players_v2` remains unchanged and separate.

**CRITICAL RESOURCE: Complete implementation exists in `/team-scrape` folder:**
- ✅ Working team scraper, draft picks scraper, and merge script
- ✅ Sample merged outputs for 5 teams showing exact `/architect/baseTeams` format
- ✅ Files in `team-scrape/review_and_merge/out_merged_samples/` demonstrate precise field structure
- ✅ Documentation in `team-scrape/README.md` and `team-scrape/review_and_merge/docs/REPORT.md`
- ✅ Ready to scale to all 30 teams

---

## 3. Target Data Schema (03-TARGET-SCHEMA.md)

The target schema consists of four main document types:

### Base Team Document (`/architect/baseTeams/{teamCode}`)
- **Size**: ~50KB per team, 1.5MB total for 30 teams
- **Contains**: Team identity, roster (player IDs only), dead cap, cap holds, exceptions (MLE, BAE, TPE), draft picks (with comprehensive structure: status, Stepien rules, swaps, dependencies, conditions, routing), calculated totals
- **Key Change**: Season format "2025-26" instead of 2025

### Base Player Document (`/architect/basePlayers/{playerId}`)
- **Size**: ~5KB per player, 2.65MB total for 530 players
- **Contains**: Player identity, bio, contract summary, per-season breakdown with `salariesByYear[]`, trade clauses, Bird rights (with `yearsOfService`), free agency info, trade eligibility rules
- **Critical Fields**: `isRookieScale` (for poison pill), per-year `capHit` and `tradeBonus`

### World Metadata (`/architect/worlds/{worldId}/metadata`)
- **Size**: ~2KB per world
- **Contains**: World identity, ownership, current/baseline season, branching relationships (parentWorldId, childWorlds), modification tracking (modifiedTeams, actionCount, lastAction)

### World Team Snapshot (`/architect/worlds/{worldId}/snapshot/teams/{teamCode}`)
- **Size**: ~50KB per modified team
- **Contains**: Same structure as base team, but represents modified state with world-specific source metadata

**Storage Breakdown**: Base 4MB (shared) + ~150KB per world = ~12MB for 50 worlds (vs 75MB naive approach).

---

## 4. How It Works (04-HOW-IT-WORKS.md)

The hybrid snapshot architecture achieves all five goals through specific patterns:

### Multi-Season Planning
- User advances season via button click, system updates `currentSeason` in metadata
- For each team: remove expired contracts, process options, update guarantees, add cap holds
- Empty roster charges computed dynamically when recalculating totals
- Contract ladders track multi-year deals with per-season guarantees

### Branching
- **Copy-on-write**: New world created with parentWorldId, no snapshots copied initially
- First modification creates snapshots for affected teams only
- Unaffected teams read from parent or base via fallback chain
- **Storage efficiency**: World A (100KB) + Branch B (50KB) + Branch C (50KB) = 200KB total

### Storage Efficiency
Four optimization strategies achieve 88% storage reduction:
1. Immutable base layer (4MB shared by all worlds)
2. Snapshot only modified teams (93% savings vs full snapshots)
3. Copy-on-write for branches (shares parent snapshots)
4. No player duplication (base docs used by reference)

**Read Performance**: 30 queries for league view regardless of world (2 world + 28 base typical).

### CBA Accuracy
Schema enables comprehensive CBA rules:
- Trade eligibility (signing date + 3 months or Dec 15)
- Base Year Compensation (BYC) for newly signed players
- Poison pill (rookie extensions use average of old + new salaries)
- Bird rights with proper cap hold calculations (Bird 1.9×, Early Bird 1.75×, Non-Bird 1.2×)
- Exception tracking (MLE usage triggers hard cap at First Apron)
- Salary matching with apron-dependent rules
- Draft pick resolution honoring status, swaps, Stepien rules, dependencies, conditional conveyances

### Data Integrity
Five mechanisms ensure data safety:
1. Immutable base (Firebase security rules: read-only to users)
2. World isolation (ownership enforced, unique worldId per scenario)
3. Audit trail (metadata tracks all modifications with timestamps)
4. Version tracking (snapshots reference base version for staleness detection)
5. Atomic operations (Firestore batches ensure all-or-nothing commits)

---

## 5. Save & Load Logic (05-SAVE-LOAD-LOGIC.md)

### Reading Pattern: World → Parent → Base

**getTeam()** implements fallback chain:
1. Try world snapshot
2. Try parent world recursively
3. Fall back to base

**getPlayer()** adds override merge:
1. Try world-specific player override
2. Merge override with base player data
3. Try parent world recursively
4. Fall back to base

**getLeague()** optimizes for 30 teams:
- Batch read world snapshots
- Fill gaps from base for unmodified teams
- **Performance**: 30 queries regardless of modifications

**Important**: Never read from `/players_v2` in Architect. Use `/architect/basePlayers` exclusively. Keep draft picks with complete semantic structure in memory.

### Writing Pattern: Atomic Batches

**Team-Level Operations**:
- **Execute Trade**: Load teams, validate CBA, update rosters, recalculate totals, atomic batch (2 teams + metadata)
- **Sign Free Agent**: Validate cap space, update roster/exceptions, remove cap hold, recalculate, atomic batch
- **Waive Player**: Calculate dead cap (stretch if applicable), update roster, add dead cap entry, recalculate

**Player-Level Operations**:
- **Contract Extension**: Create player override with only changed fields (new extension years)
- **Pick Up/Decline Option**: Update guarantee status, null out option, add cap hold if declined

**World Management**:
- **Create World**: Generate worldId, create metadata, update parent's childWorlds if branching, NO team snapshots yet
- **Advance Season**: Update currentSeason, process contracts for all modified teams (remove expired, handle options, add empty roster charges if <12), recalculate totals

**Key Patterns**:
- Always use atomic batches (all-or-nothing)
- Update metadata on every modification
- Recalculate totals after roster changes
- Only write what changed

---

## 6. Comprehensive Summary (06-COMPREHENSIVE-SUMMARY.md)

This file consolidates everything into a single reference covering:

**The Problem**: Users need multi-season planning with branching scenarios. Current system lacks this capability and has performance issues with full team duplication.

**The Solution**: Hybrid Snapshot Architecture with four layers:
1. Immutable Base (Real NBA Data)
2. User Worlds (Scenarios)
3. Team Snapshots (Modified Teams Only)
4. Player Overrides (Contract Changes Only)

**Key Innovation**: Only snapshot what changes. 2-team trade = 2 snapshots (100KB), other 28 teams read from base (0KB) = 93% storage savings.

**Critical Schema Changes**:
1. Year format: `year: 2026` → `season: "2026-27"`
2. New fields: `yearsOfService`, `isRookieScale`, per-year `capHit` and `tradeBonus`
3. Draft picks: Full structure with status, swaps, Stepien rules, dependencies, conditions, routing

**Performance Metrics**:
- League view: 30 queries, ~100-200ms
- Trade execution: 3 writes, ~200ms
- Storage: Base 4.15MB + ~150KB per world = ~12MB for 50 worlds (84% savings)

**Key Decisions Made**:
1. Year format "YYYY-YY" ✅
2. Hybrid architecture (base + snapshots) ✅
3. Copy-on-write branching ✅
4. Immutable base ✅
5. Team snapshots only (player overrides optional) ✅

**Success Criteria**: All goals met ✅ - multi-season planning, branching scenarios, storage efficiency, CBA accuracy, data integrity.

---

## 7. Implementation Plan (07-IMPLEMENTATION-PLAN.md)

### Phase 1: Foundation & Planning ✅ COMPLETE
All documentation files created. **Next**: Stakeholder approval.

### Phase 2: Data Migration
**Goal**: Populate `/architect/baseTeams` and `/architect/basePlayers`

**Steps**:
1. Set up scraping environment (Node.js 18+, Firebase Admin SDK)
2. Build team scraper (`scrapeTeams.js`) - fetch from SalarySwish, parse roster/cap data/exceptions/draft picks, normalize draft-pick schema, de-duplicate
3. Build player scraper (`scrapePlayers.js`) - parse bio/contract, convert to season format ("YYYY-YY"), add new required fields, rate limit 1.5s
4. Validate data (`validateData.js`) - check required fields, verify format, validate ranges
5. Upload to Firestore (`uploadToFirestore.js`) - batch upload 30 teams + 530 players

**Checklist**: Scrapers built, all data scraped and validated, uploaded to Firestore, verified in Firebase Console, backup created.

### Phase 2.5: Docs Alignment (No Code)
Replace legacy `Teams` references with `/architect/...`, add Authoritative Paths block to docs, add deprecation notice.

### Phase 3: Core Implementation
**Goal**: Build world management and team operations

**Steps**:
1. Create world management module (`worldManager.js`) - CRUD operations
2. Create team data loader (`teamLoader.js`) - implement fallback chain
3. Implement trade execution (`tradeManager.js`) - load, validate, update, atomic write
4. Implement season advancement - update season, process contracts, recalculate totals

**Checklist**: World CRUD, team loading with fallback, trade/signing/waiving, season advancement, branching, cap calculations, trade validation, tests passing.

### Phase 4: UI & Polish
**Goal**: Build user interface and test end-to-end

**Steps**:
1. Create world selector component (`WorldSelector.jsx`)
2. Update GMDashboard to use worlds
3. Build season navigator, branch button, world management panel
4. E2E testing, performance optimization, production deployment

**Checklist**: World selector integrated, create/branch workflows, season navigation, E2E tests passing, performance benchmarks met (<200ms league view, <500ms trades), production deployed.

### Final Launch Checklist
- **Data**: Base teams/players populated, validated, correct format
- **Code**: World management complete, fallback chain working, operations implemented, CBA validation
- **UI**: World selector, create/branch workflows, clear visual feedback
- **Testing**: Unit/integration/E2E tests passing, performance benchmarks met
- **Documentation**: User guide, developer docs, API reference
- **Production**: Security rules updated (base read-only, worlds owner-only), monitoring configured, backup strategy, rollback plan

### Success Metrics Post-Launch
Monitor performance (league view <200ms, trades <500ms), usage (worlds/branches/trades per user), data quality (99%+ accuracy, <0.1% calculation errors, 99.9%+ uptime).

---

## Key Takeaways

1. **Architecture**: Hybrid snapshot system with immutable base + world-specific snapshots achieves optimal balance of read performance and storage efficiency.

2. **Schema Changes**: Critical updates include season format ("YYYY-YY"), new CBA fields (`yearsOfService`, `isRookieScale`), and comprehensive draft pick structure.

3. **Implementation Pattern**: Fallback chain for reads (world → parent → base), atomic batches for writes, copy-on-write for branching.

4. **Performance**: 30 queries for league view (constant regardless of world), ~100-200ms load time, 84-93% storage savings vs naive approach.

5. **Data Integrity**: Five mechanisms ensure safety (immutable base, world isolation, audit trail, version tracking, atomic operations).

6. **Implementation Phases**: Four phases total (planning complete, data migration, core implementation, UI/polish).

7. **Authoritative Paths**: `/architect` is the ONLY location for Architect data. `/players_v2` and `/teams` are immutable and separate. Legacy `/Teams` deprecated.

---

## Next Steps

1. ✅ Complete Phase 1 documentation
2. ⏭️ Obtain stakeholder approval on schema design
3. ⏭️ Begin Phase 2: Build scrapers and populate base collections
4. ⏭️ Phase 3: Implement world management and team operations
5. ⏭️ Phase 4: Build UI and test end-to-end
6. ⏭️ Production deployment with monitoring

**Status**: Ready for implementation pending stakeholder approval.
