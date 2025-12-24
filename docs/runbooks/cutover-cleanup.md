# Cutover & Cleanup Checklist

Updated: 2025-11-12

## Completed Steps

✅ **Data Pipeline Execution**

- Full player contract + stats scrape completed
- Full team salary scrape completed (30 teams)
- RealGM draft picks scraped for all 30 teams ✅
- All data staged and validated

✅ **Application Integration**

- Frontend helpers updated to read from new collections (`players_v2`, `/architect/basePlayers`, `/architect/baseTeams`)
- Architect components refactored to use new contract schema
- Legacy `contract_clean` compatibility layer removed

✅ **Data Push**

- 674 players pushed to `players_v2` + `/architect/basePlayers` ✅
  - 526 active players (with contracts/stats)
  - 74 free agents (contracts cleared, bio preserved)
- 30 teams pushed to `/architect/baseTeams` ✅
- Draft picks merged and included in all team documents ✅

## Pending Cleanup

### Legacy Collections (Archive After Smoke Tests Pass)

**Firestore Collections to Archive:**

- `/players` → Replaced by `players_v2` (hierarchical structure)
- `/teams` → Replaced by `/architect/baseTeams` (with hydration from `/architect/basePlayers`)

**Archive Strategy:**

1. Export legacy collections to JSON backups
2. Create `archived_players` and `archived_teams` collections
3. Copy documents to archived collections with timestamp metadata
4. Delete original collections after verification period (recommend 30 days)

### Legacy Scripts (Keep for Reference)

**Scripts to Archive (move to `archive/` directory):**

- `player-scrape/legacy/` (if exists)
- `team-scrape/legacy/` (if exists)
- Any scripts referencing old `/players` or `/teams` collections

**Scripts to Update:**

- Any diagnostic/debug scripts still referencing legacy collections
- Update comments/docs to reference new collection paths

### Documentation Updates

- [ ] Update `DEVELOPER_GUIDE.md` with new collection paths
- [ ] Update `README.md` if it references legacy collections
- [ ] Archive old schema docs (move to `docs/schema/archive/`)
- [ ] Update `PROJECT_SCHEMA.md` to remove legacy collection references

## Remaining Work

### Data Completion

- **Stage remaining players:** Only 20 players staged/pushed; need to stage remaining ~400+ players
  - Run `stage_player.ts` for each player from full scrape outputs
  - Or enhance `run_full_scrape.ts` to auto-stage all players

- ~~**Discover remaining RealGM IDs:**~~ ✅ COMPLETE - All 30 team IDs discovered and added to script
- ~~**Re-run RealGM scraper for all teams:**~~ ✅ COMPLETE - All 30 teams scraped
- ~~**Re-stage and push teams with complete draft pick data:**~~ ✅ COMPLETE - All 30 teams pushed with draft picks

### Testing

- **Manual smoke tests:** Run UI smoke tests per `application-integration-verification.md`
  - Player Profile (`/player/:id`)
  - League View (`/gm/league`)
  - GM Dashboard (`/gm/:teamSlug`)
  - Roster Visual / Planner

- **Validation:** Re-run validators after full data push
  - `npm run validate:project`
  - `npm run schema:generate`

## Notes

- Legacy collections preserved for rollback during transition period
- All new data successfully pushed and accessible
- Application code updated to use new collections exclusively
- No dual-read paths or feature flags needed (clean cutover)
