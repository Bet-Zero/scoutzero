# Architect Teams Plan - Execution Instructions

## Context
You are tasked with implementing the **Architect Teams Plan** feature for the HoopZero/ScoutZero NBA scouting platform. This feature enables users to create and manage multi-season NBA roster scenarios with full CBA accuracy, branching decision trees, and optimal storage efficiency.

## Documentation Location
All implementation details are contained in this folder: `/architect-plan-summary/`

Start by reading these files in order:
1. **COMBINED-SUMMARY.md** - Complete overview synthesizing all documentation
2. **01-GOALS-SUMMARY.md** - Project goals and success criteria
3. **02-CURRENT-STATUS-SUMMARY.md** - Existing implementation and what's being added
4. **03-TARGET-SCHEMA-SUMMARY.md** - Complete Firestore schema with examples
5. **04-HOW-IT-WORKS-SUMMARY.md** - How the architecture achieves each goal
6. **05-SAVE-LOAD-LOGIC-SUMMARY.md** - Implementation guide for reading/writing data
7. **07-IMPLEMENTATION-PLAN-SUMMARY.md** - Step-by-step implementation across all phases

## Implementation Approach

### Current Status
- **Phase 1**: Foundation & Planning ✅ **COMPLETE**
- **Phase 2**: Data Migration - **START HERE**
- **Phase 3**: Core Implementation
- **Phase 4**: UI & Polish

### Phase 2: Data Migration (START HERE)
**Goal**: Populate `/architect/baseTeams` and `/architect/basePlayers` with current NBA data

**CRITICAL**: Complete scraping infrastructure already exists in `/team-scrape` folder:
- ✅ Team scraper (`scripts/parse_team.ts`)
- ✅ Draft picks scraper (`scripts/realgm_draft_picks.ts`)
- ✅ Merge script (`review_and_merge/scripts/merge_team_outputs.ts`)
- ✅ Sample outputs in `review_and_merge/out_merged_samples/` showing exact format
- ✅ Documentation in `team-scrape/README.md` and `team-scrape/review_and_merge/docs/REPORT.md`

**Your Tasks**:
1. Review existing scraping tools in `/team-scrape` folder
2. Run scrapers for all 30 NBA teams using batch processing
3. Run merge script to combine team + draft pick data
4. Validate outputs against sample files
5. Create upload script to populate `/architect/baseTeams` in Firestore
6. Scrape and upload player data to `/architect/basePlayers`
7. Verify data in Firebase Console

**Phase 2 Checklist**:
- [ ] Review `/team-scrape` folder implementation
- [ ] Run scrapers for all 30 teams (batch processing)
- [ ] Run merge script for all teams
- [ ] Validate outputs against samples
- [ ] Create `uploadToFirestore.js` script
- [ ] Upload to Firestore `/architect/baseTeams`
- [ ] Scrape player data (separate from team data)
- [ ] Upload to Firestore `/architect/basePlayers`
- [ ] Validate in Firebase Console
- [ ] Create backup of base collections

### Phase 3: Core Implementation
**Goal**: Build world management and team operations

**Your Tasks**:
1. Create world management module (`/src/utils/architect/worldManager.js`)
   - `createWorld()`, `getWorldMetadata()`, `deleteWorld()`, `listUserWorlds()`
2. Create team data loader (`/src/utils/architect/teamLoader.js`)
   - Implement fallback chain: world → parent → base
   - `getTeam()`, `getLeague()`, `getPlayer()`, `mergePlayerOverride()`
3. Implement trade execution (`/src/utils/architect/tradeManager.js`)
   - `executeTrade()`, `signFreeAgent()`, `waivePlayer()`, `extendPlayer()`
   - All with atomic batch writes and cap recalculations
4. Implement season advancement
   - `advanceSeason()`, `processSeasonTransition()`
   - Handle contract expiration, options, empty roster charges

**Phase 3 Checklist**:
- [ ] World CRUD operations complete
- [ ] Team loading with fallback chain working
- [ ] Trade execution with CBA validation
- [ ] Player signing/waiving implemented
- [ ] Season advancement working
- [ ] Branching/forking functional
- [ ] Cap calculations accurate
- [ ] Unit tests passing
- [ ] Integration tests passing

### Phase 4: UI & Polish
**Goal**: Build user interface and test end-to-end

**Your Tasks**:
1. Create world selector component (`/src/components/Architect/WorldSelector.jsx`)
2. Update GMDashboard (`/src/pages/GMDashboard.jsx`) to use worlds
3. Build season navigator, branch button, world management panel
4. Run E2E testing
5. Performance optimization
6. Production deployment

**Phase 4 Checklist**:
- [ ] World selector integrated
- [ ] Create world workflow complete
- [ ] Branch functionality working
- [ ] Season navigation implemented
- [ ] Clear visual feedback for modified vs unmodified teams
- [ ] E2E tests passing
- [ ] Performance benchmarks met (<200ms league view, <500ms trades)
- [ ] Firebase security rules updated (base read-only, worlds owner-only)
- [ ] Production deployed

## Key Architecture Principles

### Data Structure
```
/architect/                         # ALL Architect data lives here
  baseTeams/{teamCode}             # 30 teams, ~1.5 MB (immutable)
  basePlayers/{playerId}           # 530 players, ~2.65 MB (immutable)
  worlds/{worldId}/metadata        # World info (~2 KB per world)
  worlds/{worldId}/snapshot/teams/{teamCode}  # Only modified teams
```

**CRITICAL**: 
- `/players_v2` and `/teams` are **NOT** part of Architect (immutable, separate)
- Legacy `/Teams` (Architect v1) is deprecated and will be removed
- **Only read from `/architect/basePlayers`** - never from `/players_v2`

### Reading Pattern (Fallback Chain)
```javascript
getTeam(worldId, teamCode) {
  1. Try world snapshot: /architect/worlds/{worldId}/snapshot/teams/{teamCode}
  2. Try parent world recursively if branched
  3. Fall back to base: /architect/baseTeams/{teamCode}
}
```

### Writing Pattern (Atomic Batches)
```javascript
executeTrade(worldId, trade) {
  1. Load team states via getTeam()
  2. Validate trade using CBA rules
  3. Update rosters
  4. Recalculate cap totals
  5. Atomic batch write (2 teams + metadata)
}
```

### Critical Schema Changes
1. **Year format**: Change `year: 2026` → `season: "2026-27"` everywhere
2. **New fields**: Add `yearsOfService`, `isRookieScale`, per-year `capHit` and `tradeBonus`
3. **Draft picks**: Full structure with status, swaps, Stepien rules, dependencies, conditions, routing

## Performance & Storage Targets

### Storage Efficiency
- Base collections: ~4 MB (shared by all worlds)
- Per world: ~150 KB typical (only modified teams)
- 50 worlds: ~12 MB total (88% savings vs naive approach)

### Performance Metrics
- League view (30 teams): <200ms
- Trade execution: <500ms
- World creation: <300ms
- Branch creation: <300ms

### Optimization Strategies
1. **Immutable base layer** - Shared by all worlds (zero per-world cost)
2. **Snapshot only modified teams** - 93% storage savings
3. **Copy-on-write branching** - Shares parent snapshots until divergence
4. **No player duplication** - Use base docs by reference, override only when needed

## CBA Rules to Implement

Your implementation must handle these CBA rules accurately:
- Trade eligibility (signing date + 3 months or Dec 15 restriction)
- Base Year Compensation (BYC) for newly signed players
- Poison pill for rookie extensions (use average of old + new salaries)
- Bird rights with proper cap hold calculations (Bird 1.9×, Early Bird 1.75×, Non-Bird 1.2×)
- Exception tracking (MLE usage triggers hard cap at First Apron)
- Salary matching with apron-dependent rules (stricter over first apron, prohibited aggregation over second apron)
- Draft pick resolution honoring status, swaps, Stepien rules, dependencies, conditional conveyances

## Data Integrity Requirements

Implement these five mechanisms:
1. **Immutable base** - Firebase security rules make base collections read-only to users
2. **World isolation** - Each world has unique ID, security rules enforce ownership
3. **Audit trail** - Metadata tracks all modifications with timestamps and action descriptions
4. **Version tracking** - Snapshots reference base version for staleness detection
5. **Atomic operations** - Use Firestore batches to ensure all-or-nothing commits (no partial trades)

## Testing Requirements

### Unit Tests
- World CRUD operations
- Fallback chain logic
- Cap calculations
- CBA validation rules
- Season advancement logic

### Integration Tests
- Complete trade flow
- Free agent signing
- Player waiving with dead cap
- Contract extensions
- Option decisions
- Multi-season advancement
- World branching

### E2E Tests
- Create world → Execute trade → Verify cap totals
- Create world → Advance season → Verify contract processing
- Create world → Branch → Execute different trade → Compare outcomes
- Load league view → Verify performance <200ms

## Production Deployment Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Firebase security rules deployed (base read-only, worlds owner-only)
- [ ] Environment variables configured
- [ ] Monitoring configured
- [ ] Backup strategy documented
- [ ] Rollback plan documented
- [ ] User guide created
- [ ] Developer documentation updated

## Success Criteria

Your implementation is complete when:
- ✅ All 30 base teams populated with correct schema
- ✅ All 530 base players populated with correct schema
- ✅ World management fully functional (create, load, delete, list)
- ✅ Team operations working (trade, sign, waive, extend)
- ✅ Season advancement processing contracts correctly
- ✅ Branching creating efficient snapshots (copy-on-write)
- ✅ UI integrated with world selector and navigation
- ✅ Performance targets met (<200ms league view, <500ms trades)
- ✅ Storage efficiency achieved (<200KB per world)
- ✅ CBA validation accurate (100% rule compliance)
- ✅ All tests passing
- ✅ Production deployed with monitoring

## Getting Started

1. **Read all documentation files** in this folder to understand the complete system
2. **Start with Phase 2** - Review `/team-scrape` folder and run existing scrapers
3. **Work sequentially** through phases 2, 3, and 4
4. **Test continuously** - Write tests as you implement each component
5. **Follow patterns** - Use fallback chain for reads, atomic batches for writes
6. **Validate CBA rules** - Ensure 100% accuracy for all cap calculations and trade validation

## Questions or Issues?

If you encounter issues or need clarification:
1. Re-read the relevant summary file in this folder
2. Check the original detailed docs in `/docs/architect-teams-plan/`
3. Review the working scraper code in `/team-scrape/`
4. Examine sample outputs in `/team-scrape/review_and_merge/out_merged_samples/`

---

**Implementation Status**: Phase 1 Complete ✅ | Begin Phase 2 Now

**Expected Outcome**: A fully functional multi-season NBA roster scenario planning system with branching decision trees, full CBA accuracy, and optimal storage efficiency.
