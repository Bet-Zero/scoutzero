> **Architect lives entirely under `/architect`.** `/players_v2` and `/teams` are immutable and **not** part of Architect. The legacy top-level `Teams` (Architect v1) is deprecated and will be removed after cutover.

# Architect Teams Plan - Goals & Objectives

## Primary Goals

### 1. **Multi-Season Scenario Planning**

Enable users to simulate NBA roster decisions across multiple seasons with full CBA accuracy.

**User Story:**

> "I want to trade for a player with a non-guaranteed contract, see how it affects my cap space this year, then advance to next offseason to cut him and sign a free agent in the newly available space."

**Requirements:**

- Advance through seasons (2025-26 → 2026-27 → 2027-28)
- Track contract changes (guarantees, options, expirations)
- Calculate cap space evolution over time
- Handle waive/stretch scenarios
- Free agency planning

### 2. **Branching Decision Trees**

Allow users to create and compare multiple "what-if" scenarios from a single starting point.

**User Story:**

> "After making a trade, I want to explore three different paths: (A) keep the player, (B) cut him next year, or (C) trade him again. I want to see where each decision leads without losing my work."

**Requirements:**

- Fork/branch from any world state
- Compare outcomes across branches
- Track decision history (audit trail)
- Navigate between scenarios easily
- Visualize decision tree structure

### 3. **Storage Efficiency**

Minimize Firestore costs while maintaining fast read performance.

**Targets:**

- **Read performance:** <200ms for full league view (30 teams)
- **Storage per world:** 1-2 MB (only modified teams)
- **Storage per branch:** 1-2 MB additional (incremental)
- **Scalability:** Support 100+ worlds per user

### 4. **CBA Accuracy**

Ensure all calculations comply with NBA Collective Bargaining Agreement rules.

**Critical Features:**

- Trade eligibility (Aug 15, Dec 15, 3-month rules)
- Base Year Compensation (BYC) for newly signed players
- Poison pill calculations for extended rookies
- Bird rights (Bird, Early Bird, Non-Bird)
- Exception usage tracking (MLE, BAE, TPE)
- Cap holds and qualifying offers
- Salary matching rules (apron-dependent)

### 5. **Data Integrity**

Maintain an immutable baseline with clear separation between real NBA data and user simulations.

**Principles:**

- **Immutable base:** Real NBA data never modified
- **Isolated worlds:** User scenarios don't affect each other
- **Audit trail:** Track all changes with timestamps
- **Rollback capability:** Revert to any previous state

**Authoritative Paths**

- `/players_v2` — immutable, real player data (not part of Architect)
- `/teams` — immutable, real team data (if present; not part of Architect)
- `/architect` — top-level for all Architect data:
  - `/architect/baseTeams/{teamId}`
  - `/architect/basePlayers/{playerId}`
  - `/architect/worlds/{worldId}/metadata`
  - `/architect/worlds/{worldId}/snapshot/teams/{teamId}`
  - (optional) `/architect/worlds/{worldId}/snapshot/teams/{teamId}/players/{playerId}`

---

## Success Metrics

### Performance

- ✅ League view loads in <200ms (30 queries)
- ✅ World creation: <500ms
- ✅ Trade execution: <1s (including validation)
- ✅ Branch creation: <300ms

### Storage

- ✅ Base collections: ~4 MB total (30 teams ~1.5 MB + ~530 players ~2.5 MB)
- ✅ World storage: 1-2MB per world (2-4 modified teams)
- ✅ 50 worlds: 50-100MB (manageable)

### User Experience

- ✅ Zero loading delay when viewing unmodified teams
- ✅ Instant branch switching (<100ms)
- ✅ Clear visual indication of modified vs baseline teams
- ✅ Decision tree navigation UI

### Data Quality

- ✅ 100% CBA compliance for trade validation
- ✅ Accurate cap calculations (±$1 tolerance)
- ✅ Contract details match source (SalarySwish)
- ✅ Consistent season formatting (YYYY-YY)

---

## Non-Goals (Out of Scope)

❌ **Not building:**

- Real-time multiplayer (future consideration)
- AI-powered trade suggestions (future consideration)
- Historical NBA data (pre-2025)
- Player performance projections
- Injury tracking/simulations
- Draft pick value calculators
- Salary cap predictions beyond current CBA

❌ **Not migrating:**

- Existing player scouting data (stays in `/players_v2` collection)
- Roster Builder feature (separate from Architect)
- Historical user team plans (clean slate approach)

---

## Dependencies

### External Data Sources

- **SalarySwish.com** - NBA salary, contract, and cap data
  - Team pages: 30 teams with cap tables
  - Player pages: ~530 players with contract details
  - Updated annually before each season

### Internal Systems

- **Firebase Firestore** - Data storage and querying
- **Existing Architect UI** - GMDashboard, CapSheet, TradeMachine
- **Cap calculation utils** - Existing cap space logic in `/src/utils/`

### Technical Requirements

- Firebase Admin SDK (Node.js scraper)
- React 18+ (UI components)
- Modern browser with ES2020+ support

---

## Timeline & Phases

### Phase 1: Foundation (Current Phase) ✅

- [x] Review and validate schema design
- [x] Document goals and requirements
- [x] Create target data structure
- [ ] Create comprehensive implementation plan

### Phase 2: Data Migration (3-4 days)

- [ ] Build team page scraper (day 1)
- [ ] Build player page scraper (day 1-2)
- [ ] Populate base collections (day 2)
- [ ] Validate data accuracy (day 2-3)

### Phase 3: Core Implementation (3-4 days)

- [ ] World CRUD operations (day 3)
- [ ] Snapshot save/load logic (day 3-4)
- [ ] Season advancement (day 4)
- [ ] Branch/fork functionality (day 4)

### Phase 4: Polish & Launch (2-3 days)

- [ ] UI for world management (day 5)
- [ ] Testing and bug fixes (day 5-6)
- [ ] Performance optimization (day 6)
- [ ] Documentation and launch (day 7)

**Total Estimated Time:** 10-14 days (2 weeks aggressive, 3 weeks comfortable)
