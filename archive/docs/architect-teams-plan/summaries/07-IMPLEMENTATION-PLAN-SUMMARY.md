<!-- markdownlint-disable -->

# Summary: 07-IMPLEMENTATION-PLAN.md

## Purpose
Provides both high-level roadmap and detailed, semi-executable steps for implementing the Architect Teams Plan across all phases.

## Key Points

### Phase 1: Foundation & Planning ✅ COMPLETE
**Deliverables**: All documentation files created (01-GOALS through 07-IMPLEMENTATION-PLAN)
**Next Action**: Stakeholder approval before proceeding to Phase 2

### Phase 2: Data Migration
**Goal**: Populate `/architect/baseTeams` and `/architect/basePlayers` with current NBA data

**IMPORTANT: Complete implementation already exists in `/team-scrape` folder:**
- ✅ Team scraper built and tested (`parse_team.ts`)
- ✅ Draft picks scraper built and tested (`realgm_draft_picks.ts`)
- ✅ Merge script ready (`review_and_merge/scripts/merge_team_outputs.ts`)
- ✅ Sample outputs for 5 teams showing exact format in `review_and_merge/out_merged_samples/`
- ✅ Schema validation and field mappings documented
- ✅ Output structure matches `/architect/baseTeams` schema exactly

**High-level approach**:
- Run existing scrapers for all 30 teams using batch processing
- Run existing merge script to combine team + draft pick data, validate outputs
- Upload merged outputs to Firestore `/architect/baseTeams`, scrape player data
- Validation, cleanup, and fixes

**Detailed steps**:
**Detailed steps (REVISED)**:

1. **Use existing team scraper** (replaces "Build team scraper"):
   ```bash
   # Already built: team-scrape/team-data/scripts/parse_team.ts
   # Run for each team (or create batch script):
   TEAM_URL="https://www.salaryswish.com/teams/lakers" TEAM_CODE="LAL" npm run parse
   ```
   
2. **Use existing draft picks scraper** (replaces "Build player scraper"):
   ```bash
   # Already built: team-scrape/draft-picks/scripts/realgm_draft_picks.ts
   # Run for all teams:
   npm run realgm:drafts -- --teams LAL,MEM,NYK,OKC,WAS,... --pretty
   ```
   
3. **Use existing merge script** (NEW):
   ```bash
   # Already built: team-scrape/review_and_merge/scripts/merge_team_outputs.ts
   # Merges team data + draft picks:
   npm run merge:samples
   # Output: team-scrape/shared/firestore_staging/output/merged/{TEAM}_merged.json
   ```
   
4. **Validate using sample references**:
- Compare outputs against `team-scrape/shared/firestore_staging/output/merged/LAL_merged.json`
   - Verify all required fields present
   - Check draft pick structure matches schema
   
5. **Upload to Firestore** (`uploadToFirestore.js`):
   ```javascript
  // Read from team-scrape/shared/firestore_staging/output/merged/*.json
   // Upload each to /architect/baseTeams/{teamCode}
   ```

**Phase 2 checklist (REVISED)**: 
- [x] Team scraper exists and tested
- [x] Draft picks scraper exists and tested  
- [x] Merge script exists and tested
- [x] Sample outputs available showing exact format
- [ ] Run scrapers for all 30 teams (batch processing)
- [ ] Run merge script for all teams
- [ ] Validate outputs against samples
- [ ] Upload to Firestore /architect/baseTeams
- [ ] Scrape player data (separate from team data)
- [ ] Upload to Firestore /architect/basePlayers

### Phase 2.5: Docs Alignment (No Code)
- Replace references equating Architect with legacy `Teams` → `/architect/...`
- Add Authoritative Paths block to README/overview docs
- Add deprecation note: "Legacy top-level `Teams` will be removed after cutover"

### Phase 3: Core Implementation
**Goal**: Build world management and team operations

**High-level approach**:
- World CRUD (create, load, delete, update metadata)
- Team operations (execute trade, sign free agent, waive player, renounce rights)
- Season & branching (advance season, process contracts, fork/branch world, world navigation)
- Testing & polish (integration tests, CBA validation, error handling, performance optimization)

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

### Phase 4: UI & Polish
**Goal**: Build user interface and test end-to-end

**High-level approach**:
- Core UI components (world selector, create modal, season navigator, branch button)
- Enhanced features (world management panel, decision tree visualizer, world comparison, action history)
- Testing & launch (E2E testing, performance optimization, bug fixes, production deployment)

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
