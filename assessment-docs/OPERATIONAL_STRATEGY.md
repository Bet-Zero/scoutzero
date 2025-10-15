# 🔄 Operational Strategy & Long-Term Maintenance Plan

## Overview

This document addresses the **long-term operational aspects** of the scraping pipeline, including periodic updates, season transitions, and future-proofing considerations that complement the initial setup described in the assessment documents.

---

## Executive Summary

**Yes, the architecture was designed with these considerations:**
- ✅ Periodic updates throughout the year (contracts, trades, injuries)
- ✅ Season-to-season transitions (archiving, new season setup)
- ✅ Impact on architect collections during updates
- ✅ Future-proofing for seamless data flow

**However, the initial assessment focused on the first-time setup.** This document provides the complete operational strategy for ongoing maintenance.

---

## 1. Periodic Updates Throughout the Year

### Update Scenarios

#### 1.1 Contract Updates (Multiple Times/Year)
**When:** After trades, signings, extensions, option decisions
**Frequency:** Weekly during season, daily during free agency/trade deadline

**Process:**
```bash
# Step 1: Scrape updated data
npm run architect:scrape-players    # Only changed players
npm run architect:scrape-teams       # Only affected teams

# Step 2: Upload with merge strategy (not overwrite)
npm run architect:upload-players -- --merge
npm run architect:upload-teams -- --merge

# Step 3: Validate changes
npm run architect:validate-changes
```

**Impact on Architect:**
- **Trade Machine:** Updates player availability and contracts in real-time
- **Cap Manager:** Recalculates cap space with new contracts
- **GM Tools:** User saved plans remain intact (separate collection)
- **Preservation:** User grades and customizations NOT affected

**Implementation Needs:**
```javascript
// upload_players.js - Add merge mode
async function uploadPlayers(inputDir, options = {}) {
  const mergeMode = options.merge || false;
  
  for (const file of files) {
    const playerData = transformPlayer(JSON.parse(file));
    
    if (mergeMode) {
      // Preserve existing data, only update changed fields
      const existing = await docRef.get();
      const merged = mergePlayerData(existing.data(), playerData);
      await docRef.update(merged);  // Update, not set
    } else {
      await docRef.set(playerData);  // Full replace
    }
  }
}
```

#### 1.2 Trade Updates (In-Season)
**When:** After trades are completed
**Frequency:** Real-time during trade deadline, sporadic rest of year

**Process:**
```bash
# Option A: Targeted update (faster)
npm run architect:update-trade -- --players "lebron_james,anthony_davis" --teams "LAL,MIA"

# Option B: Full team rescrape
npm run architect:scrape-teams -- --teams "LAL,MIA"
npm run architect:upload-teams -- --teams "LAL,MIA" --merge
```

**Impact on Architect:**
- **Immediate:** Updated rosters in baseTeams
- **Cascading:** Updated team totals, cap space calculations
- **User Impact:** Active trades in Trade Machine may need refresh warning

#### 1.3 Injury/Status Updates (Daily During Season)
**When:** Injury reports, out-for-season designations
**Frequency:** Daily during season

**Note:** This is currently NOT in scope for the architect base collections (they focus on contracts/cap). Player status would be in a separate `/playerStatus` collection if needed.

---

## 2. Season-to-Season Transitions

### 2.1 End of Season (Summer)

**Goal:** Archive current season, prepare for next season

**Existing Infrastructure:** ✅
- You already have `data_pipeline/05_season_transition_streamlined.py`
- You already have `npm run season:archive` and `npm run season:create`

**Enhanced Process for Architect Collections:**

```bash
# Step 1: Archive current architect data (preserve for history)
npm run architect:archive-season -- --season "2024-25"
# Creates: /architect/seasons/2024-25/basePlayers
#          /architect/seasons/2024-25/baseTeams

# Step 2: Scrape new season data (after free agency settles)
npm run architect:scrape-all -- --season "2025-26"

# Step 3: Upload new season to live collections
npm run architect:upload-all -- --season "2025-26"

# Step 4: Update season references in app
npm run architect:set-active-season -- --season "2025-26"
```

**Implementation:**
```javascript
// scripts/architect-upload/archive_season.js
async function archiveSeasonData(season) {
  const db = admin.firestore();
  
  // Copy current basePlayers to archive
  const playersSnap = await db.collection('architect/basePlayers').get();
  const batch = db.batch();
  
  playersSnap.forEach(doc => {
    const archiveRef = db
      .collection('architect/seasons')
      .doc(season)
      .collection('basePlayers')
      .doc(doc.id);
    
    batch.set(archiveRef, {
      ...doc.data(),
      archivedAt: new Date().toISOString(),
      archivedSeason: season
    });
  });
  
  await batch.commit();
  console.log(`✅ Archived ${playersSnap.size} players for season ${season}`);
}
```

### 2.2 Season Data Structure

**Firestore Schema (Enhanced):**
```
/architect/
├── basePlayers/              # ACTIVE season (current)
├── baseTeams/               # ACTIVE season (current)
├── activeSeason/            # Metadata
│   └── current: "2025-26"
└── seasons/                 # Historical archive
    ├── 2023-24/
    │   ├── basePlayers/
    │   ├── baseTeams/
    │   └── metadata/
    ├── 2024-25/
    │   ├── basePlayers/
    │   ├── baseTeams/
    │   └── metadata/
    └── 2025-26/            # Next season staging
        └── metadata/
```

**Benefits:**
- Historical analysis (compare contracts year-to-year)
- User saved plans reference correct season data
- No data loss during transitions

---

## 3. Impact on Architect During Updates

### 3.1 Data Consistency

**Challenge:** Architect tools read from basePlayers/baseTeams while updates are in progress

**Solution: Atomic Updates with Validation**

```javascript
// upload_players.js - Enhanced with validation
async function uploadPlayers(inputDir, options = {}) {
  // Step 1: Validate all data BEFORE any uploads
  const validationResults = await validateAllPlayers(inputDir);
  if (validationResults.errors.length > 0) {
    console.error('❌ Validation failed. No uploads performed.');
    return;
  }
  
  // Step 2: Upload in transaction batches (atomic)
  const batches = createBatches(files, 500);
  for (const batch of batches) {
    await uploadBatch(batch);  // All or nothing
  }
  
  // Step 3: Update metadata to signal completion
  await db.collection('architect/metadata').doc('lastUpdate').set({
    timestamp: new Date().toISOString(),
    playersCount: files.length,
    status: 'complete'
  });
}
```

**Frontend Handling:**
```javascript
// src/hooks/useArchitectData.js
export function useArchitectData() {
  const [updateInProgress, setUpdateInProgress] = useState(false);
  
  // Listen for update status
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'architect/metadata/lastUpdate'),
      (snapshot) => {
        const status = snapshot.data()?.status;
        setUpdateInProgress(status === 'in_progress');
      }
    );
    return unsubscribe;
  }, []);
  
  // Show warning if update in progress
  if (updateInProgress) {
    return { data: null, loading: false, updateInProgress: true };
  }
  
  // Normal data loading...
}
```

### 3.2 User Experience During Updates

**Update Notifications:**
```javascript
// Show banner during updates
{updateInProgress && (
  <Banner type="warning">
    🔄 Data update in progress. Some features may be temporarily unavailable.
  </Banner>
)}
```

**Fallback Strategy:**
```javascript
// If live data unavailable, use cached version
const playerData = useMemo(() => {
  if (updateInProgress && cachedData) {
    return cachedData;  // Use last known good data
  }
  return liveData;
}, [updateInProgress, cachedData, liveData]);
```

---

## 4. Automation & Future-Proofing

### 4.1 Automated Update Pipeline (Phase 2)

**After initial setup is working, implement Cloud Functions:**

```javascript
// functions/scheduledUpdates.js
exports.dailyContractUpdate = functions.pubsub
  .schedule('0 6 * * *')  // 6 AM daily
  .timeZone('America/New_York')
  .onRun(async (context) => {
    // Step 1: Check for changed data
    const changes = await detectChanges();
    
    if (changes.length === 0) {
      console.log('No changes detected');
      return;
    }
    
    // Step 2: Trigger scraping for changed players/teams
    await scrapeChangedEntities(changes);
    
    // Step 3: Upload with merge
    await uploadWithMerge(changes);
    
    // Step 4: Validate and notify
    await validateAndNotify();
  });

exports.tradeDeadlineMonitor = functions.pubsub
  .schedule('*/15 * * * *')  // Every 15 min during trade deadline
  .onRun(async (context) => {
    const now = new Date();
    const isTradeDeadline = isTradeDeadlineActive(now);
    
    if (isTradeDeadline) {
      // Frequent updates during trade deadline
      await runFullUpdate();
    }
  });
```

**Webhook Integration (Advanced):**
```javascript
// Trigger updates from external events
exports.tradeWebhook = functions.https.onRequest(async (req, res) => {
  const { players, teams } = req.body;
  
  // Validate webhook signature
  if (!validateWebhook(req)) {
    return res.status(401).send('Unauthorized');
  }
  
  // Trigger targeted update
  await updateSpecificEntities({ players, teams });
  
  res.status(200).send('Update triggered');
});
```

### 4.2 Data Versioning

**Track changes over time:**
```javascript
// Each update creates a version snapshot
async function uploadWithVersioning(playerData) {
  const playerId = playerData.playerId;
  
  // Save to live collection
  await db.collection('architect/basePlayers').doc(playerId).set(playerData);
  
  // Save version history
  await db.collection('architect/basePlayers')
    .doc(playerId)
    .collection('versions')
    .add({
      ...playerData,
      versionedAt: new Date().toISOString(),
      changeType: detectChangeType(playerData)  // 'contract', 'trade', 'extension', etc.
    });
}
```

**Benefits:**
- Audit trail of all changes
- Rollback capability if bad data uploaded
- Historical analysis and debugging

### 4.3 Smart Caching Strategy

**Reduce Firestore reads:**
```javascript
// Implement tiered caching
const cacheStrategy = {
  // Level 1: In-memory (React state)
  memory: {
    ttl: 5 * 60 * 1000,  // 5 minutes
    maxSize: 100  // 100 players max
  },
  
  // Level 2: IndexedDB (browser storage)
  indexedDB: {
    ttl: 60 * 60 * 1000,  // 1 hour
    maxSize: 1000
  },
  
  // Level 3: Firestore (source of truth)
  firestore: {
    onlyWhenNeeded: true
  }
};

// Update cache on data changes
onSnapshot(collection(db, 'architect/basePlayers'), (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'modified') {
      invalidateCache(change.doc.id);  // Clear stale cache
    }
  });
});
```

---

## 5. Complete Update Workflows

### 5.1 Weekly Update (Regular Season)

**Typical Flow:**
```bash
# Monday morning: Check for changes
npm run architect:check-changes

# If changes detected:
npm run architect:scrape-changes    # Scrape only changed entities
npm run architect:upload-changes -- --merge
npm run architect:validate

# Update complete - users see latest data
```

**Automated Version (Future):**
- Cloud Function runs Monday 6 AM
- Detects changes automatically
- Updates architect collections
- Sends notification to admin dashboard

### 5.2 Trade Deadline Update (Real-time)

**Manual (Initial):**
```bash
# Every 30 min during trade deadline
npm run architect:scrape-all        # Full scrape
npm run architect:upload-all --merge
npm run architect:validate

# Push notification to users about updates
```

**Automated (Future):**
- Webhook receives trade notification
- Triggers immediate scrape of affected teams
- Updates collections with merge
- Pushes update to active users

### 5.3 Free Agency Update (Daily)

**Early July Flow:**
```bash
# Daily at 9 AM during free agency
npm run architect:scrape-free-agents  # Focus on FA players
npm run architect:upload-players -- --merge
npm run architect:update-team-caps    # Recalculate cap space
npm run architect:validate
```

---

## 6. Preservation Strategies

### 6.1 User Data Protection

**Critical: NEVER overwrite user data during updates**

**Architect Collections:**
```
/architect/
├── basePlayers/         # ← Update these
├── baseTeams/          # ← Update these
└── userPlans/          # ← NEVER touch these
    └── {userId}/
        ├── savedTrades/
        ├── capProjects/
        └── customRosters/
```

**Implementation:**
```javascript
// WRONG: This would destroy user data
await db.collection('architect').doc('teamPlans').delete();

// RIGHT: Only update base data
await db.collection('architect/basePlayers').doc(playerId).update(data);
// userPlans collection remains untouched
```

### 6.2 Grades & Customizations

**Your existing `/players` collection has user grades:**
```
/players/{playerId}/
├── bio/              # ← Update
├── contract/         # ← Update
├── stats/           # ← Update
└── grades/          # ← PRESERVE (user data)
```

**The architect pipeline should NEVER touch the `/players` collection.** It's a separate system:
- `/players` = Scouting data (bio, stats, grades)
- `/architect/basePlayers` = Cap/trade data (contracts, eligibility)

**No conflicts possible.**

---

## 7. Future-Proofing Checklist

### ✅ Handled in Current Design

- [x] **Modular Upload Scripts:** Easy to add new data sources
- [x] **Schema Transformation:** Flexible mapping adapts to changes
- [x] **Batch Processing:** Handles 500+ players efficiently
- [x] **Error Handling:** Graceful failures, no partial updates
- [x] **Validation:** Pre-upload checks prevent bad data
- [x] **Separation of Concerns:** Base data vs user data isolated

### 🔄 Phase 2 Enhancements (After Initial Setup)

- [ ] **Automated Updates:** Cloud Functions for scheduling
- [ ] **Webhook Integration:** Real-time triggers from external sources
- [ ] **Data Versioning:** Historical tracking of all changes
- [ ] **Smart Caching:** Reduce Firestore reads and costs
- [ ] **Update Notifications:** Alert users to new data
- [ ] **Rollback Mechanism:** Undo bad updates

### 🔮 Phase 3 Advanced Features

- [ ] **Multi-Source Validation:** Cross-check SalarySwish with Spotrac
- [ ] **Predictive Updates:** ML to detect likely contract changes
- [ ] **Real-time Sync:** WebSocket updates to active users
- [ ] **API Integration:** Direct feeds from official NBA sources
- [ ] **Conflict Resolution:** Handle competing data sources

---

## 8. Operational Runbook

### 8.1 Standard Update Procedure

**Pre-Update Checklist:**
1. ✅ Backup current data (automatic via archiving)
2. ✅ Check for breaking schema changes
3. ✅ Validate scraper still works (SalarySwish unchanged)
4. ✅ Review recent issues/bugs
5. ✅ Notify users of pending update (if major)

**Update Execution:**
```bash
# 1. Set update status
npm run architect:set-status -- --status "in_progress"

# 2. Scrape new data
npm run architect:scrape-all

# 3. Validate before upload
npm run architect:validate-scraped

# 4. Upload with merge
npm run architect:upload-all -- --merge

# 5. Post-upload validation
npm run architect:validate-live

# 6. Set status complete
npm run architect:set-status -- --status "complete"

# 7. Clear caches (if using)
npm run architect:clear-caches
```

**Post-Update Checklist:**
1. ✅ Verify player counts match expected
2. ✅ Spot-check 5-10 changed players
3. ✅ Test trade machine with updated data
4. ✅ Monitor error logs for 1 hour
5. ✅ Update changelog/release notes

### 8.2 Rollback Procedure

**If update goes wrong:**
```bash
# Option 1: Restore from archive
npm run architect:rollback -- --to-version "2025-01-15-06:00"

# Option 2: Restore from last known good
npm run architect:restore-archive -- --season "2024-25"

# Option 3: Manual restore (last resort)
# Use Firebase Console to restore from backup
```

### 8.3 Emergency Hotfix

**For critical issues (bad data, broken validations):**
```bash
# 1. Immediate: Disable affected features
npm run architect:disable-feature -- --feature "tradeMachine"

# 2. Identify bad records
npm run architect:find-invalid

# 3. Fix specific records
npm run architect:fix-player -- --id "lebron_james"

# 4. Re-enable features
npm run architect:enable-feature -- --feature "tradeMachine"
```

---

## 9. Monitoring & Alerts

### 9.1 Health Checks

**Daily Automated Checks:**
```javascript
// functions/healthCheck.js
exports.dailyHealthCheck = functions.pubsub
  .schedule('0 7 * * *')
  .onRun(async () => {
    const checks = {
      playerCount: await checkPlayerCount(),      // Should be ~530
      teamCount: await checkTeamCount(),          // Should be 30
      schemaValid: await validateAllSchemas(),
      dataFreshness: await checkDataAge(),        // Updated within 7 days
      userPlansIntact: await checkUserPlans()
    };
    
    const failures = Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([check]) => check);
    
    if (failures.length > 0) {
      await sendAlert({
        type: 'health_check_failed',
        failures,
        severity: 'warning'
      });
    }
  });
```

### 9.2 Alert Thresholds

**Set up monitoring for:**
- ❌ Player count drops below 500 (data loss)
- ❌ Team count ≠ 30 (missing teams)
- ❌ Schema validation failures > 5% (format issues)
- ❌ Update duration > 2 hours (performance issue)
- ❌ Upload failures > 10 (systemic problem)

---

## 10. Cost Optimization

### 10.1 Firestore Usage

**Current Design Efficiency:**
```
Initial Upload:
- 530 players × 1 write = 530 writes
- 30 teams × 1 write = 30 writes
- Total: 560 writes (~$0.11)

Weekly Update (10 changes):
- 10 players × 1 update = 10 writes
- 3 teams × 1 update = 3 writes
- Total: 13 writes (~$0.0026)

Monthly Cost Estimate:
- 4 weekly updates = 52 writes
- 1 full refresh = 560 writes
- Total: ~612 writes/month (~$0.12/month)
```

**Read Optimization:**
```javascript
// Instead of reading all players every time
const allPlayers = await db.collection('architect/basePlayers').get();
// Cost: 530 reads

// Use targeted queries
const lakersPlayers = await db.collection('architect/basePlayers')
  .where('teamCode', '==', 'LAL')
  .get();
// Cost: 15 reads (only Lakers roster)
```

### 10.2 Scraping Efficiency

**Rate Limiting Strategy:**
```javascript
// Adaptive rate limiting based on time of day
const getRateLimit = () => {
  const hour = new Date().getHours();
  
  if (hour >= 9 && hour <= 17) {
    // Business hours: slower to be respectful
    return 3000;  // 3 seconds between requests
  } else {
    // Off hours: faster updates
    return 1000;  // 1 second between requests
  }
};
```

**Incremental Scraping:**
```javascript
// Only scrape what changed
async function scrapeChangedPlayers() {
  const lastUpdate = await getLastUpdateTimestamp();
  const recentTrades = await getTradesSince(lastUpdate);
  
  // Only scrape affected players
  const playersToScrape = extractPlayersFromTrades(recentTrades);
  
  console.log(`Scraping ${playersToScrape.length} changed players instead of all 530`);
  // Saves: (530 - playersToScrape.length) × 2 seconds
}
```

---

## 11. Implementation Phases

### Phase 1: Initial Setup (2-3 Days) - CURRENT FOCUS
- [x] Assessment complete
- [ ] Create 11 integration files
- [ ] First-time data upload
- [ ] Basic validation

### Phase 2: Operational Readiness (1 Week)
- [ ] Add merge mode to uploads
- [ ] Implement archive/restore
- [ ] Add update status tracking
- [ ] Create rollback mechanism
- [ ] Write operational runbook

### Phase 3: Automation (2 Weeks)
- [ ] Cloud Functions for scheduling
- [ ] Automated health checks
- [ ] Alert system
- [ ] Webhook integration
- [ ] Update notifications

### Phase 4: Advanced Features (Ongoing)
- [ ] Data versioning
- [ ] Multi-source validation
- [ ] Predictive updates
- [ ] Real-time sync
- [ ] Cost optimization

---

## 12. Decision Points & Recommendations

### Immediate Decisions (Before Starting Implementation)

**1. Update Frequency**
- **Recommendation:** Start with manual weekly updates
- **Rationale:** Understand patterns before automating
- **Timeline:** Move to automated in Phase 3

**2. Archive Strategy**
- **Recommendation:** Archive at end of each season
- **Rationale:** Historical data useful, storage is cheap
- **Timeline:** Implement in Phase 2

**3. Merge vs Overwrite**
- **Recommendation:** Use merge mode for all updates
- **Rationale:** Prevents accidental data loss
- **Timeline:** Implement from day 1

**4. Validation Strictness**
- **Recommendation:** Fail-fast (reject bad data)
- **Rationale:** Better to catch issues early
- **Timeline:** Implement from day 1

### Long-Term Decisions (Can Defer)

**5. Multi-Source Validation**
- **Decision Point:** After 6 months of stable operation
- **Options:** SalarySwish only vs cross-check with Spotrac
- **Recommendation:** Start with single source

**6. Real-Time Updates**
- **Decision Point:** After automation is stable
- **Options:** Polling vs webhooks vs manual
- **Recommendation:** Start manual, then polling, then webhooks

**7. Historical Data**
- **Decision Point:** After first season transition
- **Options:** Keep all history vs rolling window
- **Recommendation:** Keep 3 seasons of history

---

## 13. Success Metrics

### Technical Metrics
- **Uptime:** > 99.5% (< 1 hour downtime/month)
- **Data Freshness:** < 24 hours old during season
- **Update Duration:** < 30 minutes for full update
- **Error Rate:** < 1% of updates fail
- **Rollback Time:** < 15 minutes to restore

### Business Metrics
- **User Trust:** No data corruption incidents
- **Feature Availability:** Trade machine 99%+ uptime
- **Update Transparency:** Users aware of updates
- **Cost Efficiency:** < $5/month Firestore costs
- **Maintenance Time:** < 2 hours/week manual work

---

## 14. Summary & Action Plan

### What's Covered in This Strategy

✅ **Periodic Updates:** Weekly, trade deadline, free agency flows
✅ **Season Transitions:** Archive, restore, new season setup
✅ **Impact Management:** Update notifications, fallback strategies
✅ **Future-Proofing:** Automation, versioning, multi-phase rollout
✅ **User Preservation:** Separate collections, no data loss
✅ **Cost Optimization:** Efficient queries, incremental updates

### What This Adds to Initial Assessment

The initial assessment (7 documents) focused on:
- **Getting to 100% (initial setup)**
- 11 files to create
- First-time data upload

This operational strategy adds:
- **Staying at 100% (ongoing maintenance)**
- Update procedures and automation
- Season transition workflows
- Long-term sustainability

### Combined Implementation Path

**Phase 1: Initial Setup (Weeks 1-2)**
1. Follow ARCHITECT_UPLOAD_ACTION_PLAN.md
2. Create 11 integration files
3. Do first upload
4. Add basic merge mode

**Phase 2: Operational Readiness (Weeks 3-4)**
5. Implement archive/restore (this doc, Section 2)
6. Add update status tracking (this doc, Section 3)
7. Create rollback mechanism (this doc, Section 8)
8. Test weekly update flow (this doc, Section 5)

**Phase 3: Automation (Months 2-3)**
9. Deploy Cloud Functions (this doc, Section 4)
10. Set up monitoring (this doc, Section 9)
11. Implement alerts (this doc, Section 9)
12. Test trade deadline flow (this doc, Section 5)

**Phase 4: Optimization (Ongoing)**
13. Add data versioning (this doc, Section 4.2)
14. Implement smart caching (this doc, Section 4.3)
15. Cost optimization (this doc, Section 10)
16. Advanced features as needed

---

## 15. Final Checklist

### Before Implementation
- [ ] Review this document with team
- [ ] Decide on update frequency
- [ ] Choose archive strategy
- [ ] Set validation strictness
- [ ] Approve operational approach

### During Phase 1 (Initial Setup)
- [ ] Create 11 files from ARCHITECT_UPLOAD_ACTION_PLAN.md
- [ ] Add --merge flag to upload scripts
- [ ] Implement basic validation
- [ ] Test with sample data
- [ ] Do first full upload

### Before Phase 2 (Operations)
- [ ] Archive current data
- [ ] Test restore from archive
- [ ] Create update checklist
- [ ] Write rollback procedure
- [ ] Document error scenarios

### Before Phase 3 (Automation)
- [ ] Manual updates working smoothly
- [ ] No data loss incidents
- [ ] Update duration acceptable
- [ ] Team comfortable with process
- [ ] Monitoring strategy approved

---

## Conclusion

**Yes, the architecture is designed for long-term operation:**

✅ **Periodic Updates:** Covered with merge mode and targeted scraping
✅ **Season Transitions:** Archive/restore mechanisms planned
✅ **Impact Management:** Update status, notifications, fallbacks
✅ **Future-Proofing:** 4-phase roadmap from manual to automated
✅ **Seamless Flow:** Clear procedures for every update scenario

**The initial assessment (7 docs) gets you to 100% - this strategy keeps you there.**

**Next Step:** Proceed with Phase 1 implementation (ARCHITECT_UPLOAD_ACTION_PLAN.md), knowing the operational strategy is mapped out for long-term success.
