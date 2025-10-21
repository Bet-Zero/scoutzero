# Summary: 01-GOALS.md

## Purpose
Defines the project goals, requirements, and success criteria for the Architect Teams Plan feature.

## Key Points

### Primary Goals
1. **Multi-Season Scenario Planning**: Enable users to simulate NBA roster decisions across multiple seasons with full CBA accuracy, including contract evolution, cap space changes, and waive/stretch scenarios.

2. **Branching Decision Trees**: Allow users to create and compare multiple "what-if" scenarios from a single starting point, exploring different paths without losing work.

3. **Storage Efficiency**: Minimize Firestore costs while maintaining fast read performance (<200ms for 30 teams, 1-2 MB per world, support 100+ worlds per user).

4. **CBA Accuracy**: Ensure all calculations comply with NBA Collective Bargaining Agreement rules (trade eligibility, BYC, poison pill, Bird rights, exceptions, cap holds, salary matching).

5. **Data Integrity**: Maintain immutable baseline with clear separation between real NBA data and user simulations, including audit trails and rollback capability.

### Data Architecture
- `/players_v2` and `/teams` are immutable, NOT part of Architect
- `/architect` is the top-level for all Architect data including baseTeams, basePlayers, and worlds
- Legacy top-level `Teams` (Architect v1) is deprecated and will be removed after cutover

### Success Metrics
- **Performance**: League view <200ms, world creation <500ms, trade execution <1s, branch creation <300ms
- **Storage**: Base collections ~4 MB, worlds 1-2MB each, 50 worlds = 50-100MB total
- **User Experience**: Zero loading delay for unmodified teams, instant branch switching, clear visual indicators
- **Data Quality**: 100% CBA compliance, accurate cap calculations (±$1), consistent season formatting (YYYY-YY)

### Non-Goals
- Real-time multiplayer, AI trade suggestions, historical data pre-2025, player performance projections, injury tracking, draft pick value calculators, salary cap predictions beyond current CBA
- Not migrating existing player scouting data or historical user team plans

### Timeline
- **Phase 1**: Foundation (current) - Review and validate schema design
- **Phase 2**: Data Migration (3-4 days) - Build scrapers, populate base collections
- **Phase 3**: Core Implementation (3-4 days) - World CRUD, snapshot logic, season advancement, branching
- **Phase 4**: Polish & Launch (2-3 days) - UI, testing, optimization, documentation
- **Total**: 10-14 days (2-3 weeks)

## Action Items
- Validate target schema design
- Begin data scraping from SalarySwish.com
- Build world management system with immutable baseline
