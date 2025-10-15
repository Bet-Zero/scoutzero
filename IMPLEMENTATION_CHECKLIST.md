# 📋 Implementation Checklist - Architect Upload Pipeline

**Goal:** Connect scrapers to Firestore `/architect` collections  
**Status:** 🟡 0/11 files created  
**Estimated Time:** 20-28 hours (2-3 days)

---

## Pre-Implementation Checklist

- [ ] Review `SCRAPING_PIPELINE_GAP_ANALYSIS.md` (comprehensive analysis)
- [ ] Review `ARCHITECT_UPLOAD_ACTION_PLAN.md` (code templates)
- [ ] Review `READINESS_VISUAL_SUMMARY.md` (executive summary)
- [ ] Approve implementation approach
- [ ] Confirm Firebase credentials available (`serviceAccountKey.json`)
- [ ] Confirm decision on dead cap data (skip for now recommended)
- [ ] Confirm decision on update frequency (manual recommended)

---

## Day 1: Upload Infrastructure (6-8 hours)

### Morning Session (3-4 hours)

#### File 1: `scripts/architect-upload/upload_players.js`
- [ ] Create directory: `mkdir -p scripts/architect-upload`
- [ ] Create file from template in ARCHITECT_UPLOAD_ACTION_PLAN.md
- [ ] Import Firebase Admin SDK
- [ ] Implement batch upload logic
- [ ] Add error handling and logging
- [ ] Test with sample data (1-2 players)
- **Validation:** Can upload player JSON to `/architect/basePlayers/{playerId}`
- **Time:** 2-3 hours

#### File 2: `scripts/architect-upload/upload_teams.js`
- [ ] Create file from template
- [ ] Import Firebase Admin SDK  
- [ ] Implement batch upload logic
- [ ] Add player ID resolution calls
- [ ] Add error handling and logging
- [ ] Test with sample data (Lakers)
- **Validation:** Can upload team JSON to `/architect/baseTeams/{teamCode}`
- **Time:** 2-3 hours

### Afternoon Session (3-4 hours)

#### File 3: `scripts/architect-upload/transform_player.js`
- [ ] Create file from template
- [ ] Map all fields (camelCase → snake_case)
- [ ] Handle nested objects
- [ ] Add calculated fields
- [ ] Remove scraper metadata
- [ ] Test transform with sample player
- **Validation:** Output matches `architect-teams-plan/03-TARGET-SCHEMA.md`
- **Time:** 1-2 hours

#### File 4: `scripts/architect-upload/transform_team.js`
- [ ] Create file from template
- [ ] Map all fields (camelCase → snake_case)
- [ ] Convert player URLs to IDs
- [ ] Format exceptions correctly
- [ ] Handle missing dead cap
- [ ] Test transform with sample team
- **Validation:** Output matches target schema
- **Time:** 1-2 hours

#### File 5: `scripts/architect-upload/resolve_player_id.js`
- [ ] Create file from template
- [ ] Implement slug → player_id conversion
- [ ] Load `/players` collection for reference
- [ ] Add manual overrides for edge cases
- [ ] Test resolution with sample URLs
- **Validation:** Correctly resolves "lebron-james" → "lebron_james"
- **Time:** 1-2 hours

### End of Day 1 Testing
- [ ] Upload Lakers to Firestore
- [ ] Upload 3-5 sample players to Firestore
- [ ] Query data in Firebase Console
- [ ] Verify schema matches target
- [ ] Fix any issues found

---

## Day 2: Automation & Data Prep (7-10 hours)

### Morning Session (3-4 hours)

#### File 6: `scripts/architect-upload/orchestrate.js`
- [ ] Create file from template
- [ ] Implement step-by-step pipeline:
  - [ ] Step 1: Scrape players
  - [ ] Step 2: Scrape teams
  - [ ] Step 3: Upload players
  - [ ] Step 4: Upload teams
  - [ ] Step 5: Validate
- [ ] Add progress reporting
- [ ] Add error handling and rollback
- [ ] Test on 2-3 teams
- **Validation:** Complete pipeline runs end-to-end
- **Time:** 1-2 hours

#### File 7: `scripts/architect-upload/validate.js`
- [ ] Create file from template
- [ ] Check collection counts
- [ ] Verify required fields
- [ ] Check schema compliance
- [ ] Validate relationships
- [ ] Test with sample data
- **Validation:** Detects missing/invalid data
- **Time:** 1-2 hours

#### File 8: `team-scrape/batch_scrape_teams.ts`
- [ ] Create file from template
- [ ] Copy structure from `player-scrape/batch_scrape_players.ts`
- [ ] Implement team list iteration
- [ ] Add rate limiting (2 seconds)
- [ ] Add error handling
- [ ] Test with 2-3 teams
- **Validation:** Scrapes multiple teams to JSON files
- **Time:** 1-2 hours

### Afternoon Session (4-6 hours)

#### File 9: `player-scrape/all_nba_players.json`
- [ ] Write script to query `/players` collection
- [ ] Extract player names and teams
- [ ] Convert names to SalarySwish slugs
- [ ] Handle edge cases (Jr., III, etc.)
- [ ] Save to JSON file
- [ ] Verify ~530 players listed
- **Validation:** All current NBA players included
- **Time:** 1-2 hours

#### File 10: `team-scrape/all_nba_teams.json`
- [ ] Create JSON file with all 30 teams
- [ ] Include teamCode, slug, teamName
- [ ] Verify SalarySwish URLs
- [ ] Cross-check with NBA roster
- **Validation:** All 30 teams listed correctly
- **Time:** 0.5 hours (manual entry from template)

#### File 11: Update `package.json`
- [ ] Add `architect:scrape-players` script
- [ ] Add `architect:scrape-teams` script
- [ ] Add `architect:upload-players` script
- [ ] Add `architect:upload-teams` script
- [ ] Add `architect:validate` script
- [ ] Add `architect:pipeline` script
- [ ] Test each script individually
- **Validation:** All npm scripts work
- **Time:** 0.5 hours

### End of Day 2 Testing
- [ ] Run `npm run architect:scrape-players` on 5-10 players
- [ ] Run `npm run architect:scrape-teams` on 2-3 teams
- [ ] Run `npm run architect:upload-players`
- [ ] Run `npm run architect:upload-teams`
- [ ] Run `npm run architect:validate`
- [ ] Verify all data uploaded correctly
- [ ] Fix any pipeline issues

---

## Day 3: Full Deployment & Validation (6-10 hours)

### Morning Session (3-4 hours)

#### Scrape All Players
- [ ] Set `PLAYERS_FILE=player-scrape/all_nba_players.json`
- [ ] Set `OUTPUT_DIR=player-scrape/output`
- [ ] Run `npm run architect:scrape-players`
- [ ] Monitor progress (~530 players × 2 sec = ~18 min + parsing)
- [ ] Handle any failed scrapes
- [ ] Verify all JSON files created
- **Validation:** ~530 player JSON files in output/
- **Time:** 1-2 hours

#### Scrape All Teams
- [ ] Set `TEAMS_FILE=team-scrape/all_nba_teams.json`
- [ ] Set `OUTPUT_DIR=team-scrape/output`
- [ ] Run `npm run architect:scrape-teams`
- [ ] Monitor progress (~30 teams × 2 sec = ~1 min + parsing)
- [ ] Handle any failed scrapes
- [ ] Verify all JSON files created
- **Validation:** 30 team JSON files in output/
- **Time:** 0.5-1 hour

### Afternoon Session (3-6 hours)

#### Upload All Data
- [ ] Run `npm run architect:upload-players`
- [ ] Monitor progress and logs
- [ ] Handle any upload errors
- [ ] Run `npm run architect:upload-teams`
- [ ] Monitor progress and logs
- [ ] Handle any upload errors
- **Validation:** All data in Firestore
- **Time:** 1-2 hours

#### Comprehensive Validation
- [ ] Run `npm run architect:validate`
- [ ] Check collection counts:
  - [ ] 30 teams in `/architect/baseTeams`
  - [ ] ~530 players in `/architect/basePlayers`
- [ ] Spot check 5-10 random players
- [ ] Spot check 3-5 random teams
- [ ] Verify schema compliance
- [ ] Check for missing fields
- [ ] Validate relationships (roster IDs exist)
- **Validation:** All checks pass
- **Time:** 1-2 hours

#### Trade Machine Integration Testing
- [ ] Open trade machine in browser
- [ ] Load Lakers team
- [ ] Load Warriors team
- [ ] Verify roster displays correctly
- [ ] Check cap calculations
- [ ] Test player trade
- [ ] Verify Bird rights logic
- [ ] Test poison pill rules
- [ ] Check Base Year Compensation
- [ ] Test salary matching
- **Validation:** Trade machine works with new data
- **Time:** 1-2 hours

#### Bug Fixes & Iteration
- [ ] Document any issues found
- [ ] Fix schema mismatches
- [ ] Fix missing data
- [ ] Re-upload affected records
- [ ] Re-run validation
- [ ] Repeat until clean
- **Time:** 1-2 hours (buffer)

---

## Post-Implementation

### Documentation
- [ ] Update README with new pipeline
- [ ] Document npm scripts usage
- [ ] Create maintenance guide
- [ ] Document known limitations
- [ ] Add troubleshooting section

### Monitoring
- [ ] Set up data quality alerts
- [ ] Monitor collection sizes
- [ ] Track upload errors
- [ ] Schedule regular validation

### Future Enhancements
- [ ] Add dead cap scraping (optional)
- [ ] Implement automated updates (optional)
- [ ] Create monitoring dashboard (optional)
- [ ] Add Cloud Functions (optional)
- [ ] Historical data collection (optional)

---

## Success Criteria

### Must Have ✅
- [ ] All 30 teams in `/architect/baseTeams`
- [ ] All ~530 players in `/architect/basePlayers`
- [ ] Schema matches target exactly
- [ ] No critical fields missing
- [ ] Trade machine loads team data
- [ ] CBA rules validate correctly

### Data Quality ✅
- [ ] All required fields populated
- [ ] Player IDs resolve correctly
- [ ] Cap math adds up
- [ ] Bird rights correct
- [ ] Trade eligibility accurate
- [ ] No validation errors

### Integration ✅
- [ ] Trade machine works
- [ ] Cap Manager works
- [ ] GM Tools work
- [ ] Roster Builder works
- [ ] No breaking changes

---

## Troubleshooting

### Common Issues

**Upload fails with "Permission denied":**
- [ ] Check `serviceAccountKey.json` exists
- [ ] Verify Firebase project ID
- [ ] Check Firestore rules

**Player ID resolution fails:**
- [ ] Check `/players` collection accessible
- [ ] Verify slug conversion logic
- [ ] Add manual overrides for edge cases

**Schema validation errors:**
- [ ] Compare with target schema
- [ ] Check field names (camelCase vs snake_case)
- [ ] Verify nested object structure

**Trade machine doesn't load:**
- [ ] Check collection paths
- [ ] Verify document IDs
- [ ] Check data structure

---

## Quick Reference

### File Locations
```
scripts/architect-upload/
├── upload_players.js
├── upload_teams.js
├── transform_player.js
├── transform_team.js
├── resolve_player_id.js
├── orchestrate.js
└── validate.js

player-scrape/
├── all_nba_players.json
└── output/ (generated)

team-scrape/
├── all_nba_teams.json
└── output/ (generated)
```

### Key Commands
```bash
# Full pipeline
npm run architect:pipeline

# Individual steps
npm run architect:scrape-players
npm run architect:scrape-teams
npm run architect:upload-players
npm run architect:upload-teams
npm run architect:validate
```

### Resources
- 📄 Detailed Analysis: `SCRAPING_PIPELINE_GAP_ANALYSIS.md`
- 📋 Action Plan: `ARCHITECT_UPLOAD_ACTION_PLAN.md`
- 🎯 Visual Summary: `READINESS_VISUAL_SUMMARY.md`
- ✅ This Checklist: `IMPLEMENTATION_CHECKLIST.md`

---

## Progress Tracking

**Day 1:** ☐ 0/5 files created  
**Day 2:** ☐ 0/6 files created  
**Day 3:** ☐ 0/3 major tasks complete  

**Overall:** ☐ 0/11 files | ☐ 0/30 tasks | 🟡 0% complete

---

## Sign-Off

- [ ] All files created
- [ ] All tests passing
- [ ] All data uploaded
- [ ] Validation complete
- [ ] Integration tested
- [ ] Documentation updated
- [ ] Team notified
- [ ] **PRODUCTION READY** 🎉
