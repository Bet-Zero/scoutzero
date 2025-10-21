# Summary: 07-IMPLEMENTATION-PLAN.md

## Purpose
Provides both high-level roadmap and detailed, semi-executable steps for implementing the Architect Teams Plan across all phases.

## Key Points

### Phase 1: Foundation & Planning ✅ COMPLETE
**Duration**: 2-3 days (DONE)
**Deliverables**: All documentation files created (01-GOALS through 07-IMPLEMENTATION-PLAN)
**Next Action**: Stakeholder approval before proceeding to Phase 2

### Phase 2: Data Migration (3-4 days)
**Goal**: Populate `/architect/baseTeams` and `/architect/basePlayers` with current NBA data

**High-level timeline**:
- Day 1: Build team and player page scrapers, validation scripts
- Day 2: Scrape all 30 teams and ~530 players
- Day 3: Upload to Firestore, verify data quality
- Day 4 (if needed): Cleanup and fixes

**Detailed steps**:
1. **Set up scraping environment**: Node.js 18+, Firebase Admin SDK, serviceAccountKey.json
2. **Build team scraper** (`scrapeTeams.js`):
   - Fetch team pages from SalarySwish
   - Parse roster, cap data, exceptions, draft picks, cap holds, dead cap
   - Normalize draft-pick inputs to structured schema (status, Stepien, swaps, dependencies, conditions, routing)
   - De-duplicate repeated entries
   - Output to `scraped_teams.json`
3. **Build player scraper** (`scrapePlayers.js`):
   - For each player ID from teams, fetch player page
   - Parse bio, contract details, per-season breakdown
   - **Critical**: Convert year to season format (2025 → "2025-26")
   - Add new required fields (yearsOfService, isRookieScale, capHit, tradeBonus per year)
   - Rate limit (1.5s between requests)
   - Output to `scraped_players.json`
4. **Validate data** (`validateData.js`):
   - Check required fields present
   - Verify season format ("YYYY-YY")
   - Validate roster sizes (10-20 players)
   - Check salary ranges reasonable ($50M-$250M)
5. **Upload to Firestore** (`uploadToFirestore.js`):
   - Batch upload teams (30 docs to `/architect/baseTeams`)
   - Batch upload players (530 docs to `/architect/basePlayers`, 450 per batch due to 500 limit)
   - Verify in Firebase Console

**Phase 2 checklist**: Environment setup, scrapers built and tested, all data scraped and validated, uploaded to Firestore, backup created

### Phase 2.5: Docs Alignment (No Code)
- Replace references equating Architect with legacy `Teams` → `/architect/...`
- Add Authoritative Paths block to README/overview docs
- Add deprecation note: "Legacy top-level `Teams` will be removed after cutover"

### Phase 3: Core Implementation (3-4 days)
**Goal**: Build world management and team operations

**High-level timeline**:
- Day 1: World CRUD (create, load, delete, update metadata)
- Day 2: Team operations (execute trade, sign free agent, waive player, renounce rights)
- Day 3: Season & branching (advance season, process contracts, fork/branch world, world navigation)
- Day 4: Testing & polish (integration tests, CBA validation, error handling, performance optimization)

**Detailed steps**:
1. **Create world management module** (`/src/utils/architect/worldManager.js`):
   - `createWorld()`: Generate worldId, create metadata, update parent's childWorlds if branching
   - `getWorldMetadata()`: Load world metadata by ID
   - `deleteWorld()`: Delete world and subcollections
   - `listUserWorlds()`: Get all worlds for current user
2. **Create team data loader** (`/src/utils/architect/teamLoader.js`):
   - `getTeam()`: Implement fallback chain (world → parent → base)
   - `getLeague()`: Parallel load all 30 teams
   - `getPlayer()`: Load with override merge
   - `mergePlayerOverride()`: Deep merge contract fields
3. **Implement trade execution** (`/src/utils/architect/tradeManager.js`):
   - `executeTrade()`: Load teams, validate trade, update rosters, recalculate totals, atomic batch write
   - Similar functions for `signFreeAgent()`, `waivePlayer()`, `extendPlayer()`, `handleOption()`
4. **Implement season advancement**:
   - `advanceSeason()`: Update currentSeason, process all modified teams
   - `processSeasonTransition()`: Remove expired contracts, handle options, add empty roster charges, recalculate totals

**Phase 3 checklist**: World CRUD, team loading with fallback, trade execution, signing/waiving, season advancement, branching, cap calculations, trade validation, tests passing

### Phase 4: UI & Polish (2-3 days)
**Goal**: Build user interface and test end-to-end

**High-level timeline**:
- Day 1: Core UI components (world selector, create modal, season navigator, branch button)
- Day 2: Enhanced features (world management panel, decision tree visualizer, world comparison, action history)
- Day 3: Testing & launch (E2E testing, performance optimization, bug fixes, production deployment)

**Detailed steps**:
1. **Create world selector component** (`/src/components/Architect/WorldSelector.jsx`):
   - Dropdown showing available worlds
   - "New World" button with create modal
   - World metadata display (season, modified teams)
2. **Update GMDashboard** (`/src/pages/GMDashboard.jsx`):
   - Integrate WorldSelector
   - Load league data based on selected world
   - Display modified vs unmodified teams clearly
3. **Build additional UI components**:
   - Season navigator (advance/rewind)
   - Branch world button
   - World management panel (list, rename, delete, archive)
   - Decision tree visualizer (show parent/child relationships)

**Phase 4 checklist**: World selector integrated, create world workflow, branch functionality, season navigation, clear visual feedback, E2E tests passing, performance benchmarks met, production deployed

### Final Launch Checklist
**Data**: Base teams/players populated (30 + 530 docs), data validated, season format correct, all required fields present

**Code**: World management complete, team/player loading with fallback chain, trade/signing/waiving working, season advancement, branching functional, cap calculations accurate, CBA validation implemented

**UI**: World selector integrated, create/branch workflows, season navigation, clear visual feedback

**Testing**: Unit tests passing, integration tests passing, manual E2E testing complete, performance benchmarks met (<200ms league view, <500ms trades)

**Documentation**: User guide written, developer docs updated, API reference created

**Production**: Firebase security rules updated (base read-only, worlds owner-only), environment variables set, monitoring configured, backup strategy in place, rollback plan documented

### Success Metrics to Monitor After Launch
- **Performance**: League view <200ms, trade execution <500ms, world creation <300ms
- **Usage**: Worlds created per user, branches created, trades executed, season advancements
- **Data Quality**: Data accuracy vs source 99%+, calculation errors <0.1%, system uptime 99.9%+

### Troubleshooting Common Issues
- **Slow league view**: Add query batching, Firestore indexes
- **Stale cap calculations**: Always call `calculateCapTotals()` after modifications
- **Trade validation failing**: Review CBA validation logic, add tests
- **Player not found**: Check fallback chain in `getPlayer()` logic

## Action Items
- Complete Phase 1 stakeholder approval
- Begin Phase 2: Set up scraping environment and build scrapers
- Scrape and validate all team/player data
- Upload to Firestore and verify
- Proceed to Phase 3 core implementation
