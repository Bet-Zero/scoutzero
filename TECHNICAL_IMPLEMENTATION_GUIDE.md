# 🔧 ScoutZero Data Architecture - Technical Implementation Guide

**Purpose**: Detailed technical specifications for implementing the data architecture fixes identified in the comprehensive analysis.

---

## 📋 Phase 1: Data Source Consolidation (Critical Priority)

### 1.1 Remove useSeasonPlayerData Hook

**Current State**: 4-strategy fallback system causing data inconsistencies
**Target State**: Single data source via `useSimplePlayerData`

**Implementation Steps:**

1. **Identify All Usage**
```bash
# Find all components using the deprecated hook
grep -r "useSeasonPlayerData" src/ --include="*.js" --include="*.jsx"
```

2. **Create Migration Script**
```javascript
// scripts/migrate-player-data-hooks.js
import fs from 'fs';
import { glob } from 'glob';

const files = glob.sync('src/**/*.{js,jsx}');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace import
  content = content.replace(
    /import.*useSeasonPlayerData.*from.*$/gm,
    "import useSimplePlayerData from '@/hooks/useSimplePlayerData';"
  );
  
  // Replace hook usage
  content = content.replace(
    /const\s+.*=\s+useSeasonPlayerData\([^)]*\)/g,
    'const { players, loading, error } = useSimplePlayerData()'
  );
  
  fs.writeFileSync(file, content);
});
```

3. **Update Component Patterns**
```javascript
// Before (problematic):
const { players, loading, error, diagnostics } = useSeasonPlayerData('2024-25');

// After (simplified):
const { players, loading, error } = useSimplePlayerData();
```

### 1.2 Remove Season Collection Dependencies

**Files to Update:**
- `src/components/diagnostic/FirestoreDataDiagnostic.jsx`
- `src/hooks/useFirebaseQuery.js`
- All components with season-based queries

**Implementation:**
```javascript
// Remove these query patterns:
collection(db, 'seasons', season, 'players')
collection(db, 'seasons')

// Replace with:
collection(db, 'players')
```

### 1.3 Archive Static Data Fallback

**Steps:**
1. Move `public/players.json` to `public/archive/players-backup.json`
2. Remove fetch fallback logic from hooks
3. Add error boundaries for missing data scenarios

---

## 📋 Phase 2: Frontend Consolidation Specification

### 2.1 Target File Structure

**Current: 294 files → Target: ~50 files**

```
src/
├── components/
│   ├── layout/
│   │   └── SiteLayout.jsx
│   └── shared/
│       ├── PlayerHeadshot.jsx
│       ├── TeamLogo.jsx
│       └── modals/
├── features/
│   ├── players/
│   │   ├── PlayerTable.jsx
│   │   ├── PlayerProfile.jsx
│   │   ├── PlayerFilters.jsx
│   │   └── hooks/
│   │       ├── usePlayerData.js      # Unified data access
│   │       ├── usePlayerFilters.js   # All filtering logic
│   │       └── usePlayerActions.js   # Player operations
│   ├── trades/
│   │   ├── TradeValidator.jsx
│   │   ├── TradeMachine.jsx
│   │   └── validation/
│   │       ├── tradeRules.js         # Consolidated rules
│   │       ├── salaryMatching.js     # Salary logic
│   │       └── tradeUtils.js         # Helper functions
│   ├── teams/
│   │   ├── CapSheet.jsx
│   │   ├── RosterBuilder.jsx
│   │   └── utils/
│   │       ├── capCalculations.js
│   │       └── rosterUtils.js
│   └── rankings/
│       ├── TierMaker.jsx
│       ├── PlayerLists.jsx
│       └── rankingUtils.js
├── hooks/
│   ├── useSimplePlayerData.js        # Main data hook
│   └── useFirebaseQuery.js           # Generic Firebase hook
├── utils/
│   ├── firebase/
│   │   └── queries.js                # Firebase utilities
│   ├── data/
│   │   ├── normalization.js          # Data transformation
│   │   └── validation.js             # Data validation
│   └── constants/
│       ├── positions.js
│       ├── teams.js
│       └── cbaRules.js
└── pages/
    ├── PlayerProfiles.jsx
    ├── RosterBuilder.jsx
    ├── TradeMachine.jsx
    └── TierMaker.jsx
```

### 2.2 Trade Machine Consolidation

**Current: 52 files → Target: 8 files**

```javascript
// src/features/trades/validation/tradeRules.js
export const validateTrade = (tradeData) => {
  const results = [];
  
  // Consolidated validation logic
  results.push(validateSalaryMatching(tradeData));
  results.push(validateRosterLimits(tradeData));
  results.push(validateDraftPicks(tradeData));
  results.push(validateTiming(tradeData));
  
  return combineResults(results);
};

// src/features/trades/validation/salaryMatching.js
export const validateSalaryMatching = (tradeData) => {
  // Move all salary matching logic here
  // Remove complex caching system causing test failures
  // Implement simple memoization if needed
};
```

### 2.3 File Consolidation Plan

**Merge Strategy:**

1. **Player Filtering** (Currently scattered across 8 files)
```javascript
// Consolidate into: src/features/players/hooks/usePlayerFilters.js
import { filterPlayers, sortPlayers } from './filterUtils';
import { useFilterDefaults } from './filterDefaults';

export const usePlayerFilters = () => {
  // All filtering logic in one place
};
```

2. **Contract Utilities** (Currently in 6 different locations)
```javascript
// Consolidate into: src/utils/data/contractUtils.js
export const normalizeContract = (rawContract) => { /* */ };
export const calculateSalaryByYear = (contract) => { /* */ };
export const formatContractDisplay = (contract) => { /* */ };
```

3. **Role Management** (Currently spread across 4 files)
```javascript
// Consolidate into: src/utils/data/roleUtils.js
export const POSITION_MAP = { /* */ };
export const expandPositionGroup = (position) => { /* */ };
export const formatPlayerRole = (player) => { /* */ };
```

---

## 📋 Phase 3: Python Pipeline Migration

### 3.1 Firebase Cloud Functions Structure

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Daily NBA API updates
exports.updatePlayerStats = functions.pubsub
  .schedule('every day 06:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    return updateStatsFromNBA();
  });

// Weekly contract updates  
exports.updateContracts = functions.pubsub
  .schedule('every sunday 08:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    return updateContractData();
  });

// Season transition (manual trigger)
exports.transitionSeason = functions.https
  .onCall(async (data, context) => {
    // Require admin authentication
    if (!context.auth || !context.auth.token.admin) {
      throw new functions.https.HttpsError('permission-denied');
    }
    return executeSeasonTransition(data.newSeason);
  });
```

### 3.2 NBA API Integration (JavaScript)

```javascript
// functions/nbaApi.js
const axios = require('axios');

const NBA_API_BASE = 'https://stats.nba.com/stats';
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ScoutZero/1.0)',
  'Accept': 'application/json',
  'Referer': 'https://www.nba.com/'
};

export const fetchNBAPlayerStats = async (season = '2024-25') => {
  const url = `${NBA_API_BASE}/leaguedashplayerstats`;
  const params = {
    Season: season,
    SeasonType: 'Regular Season',
    PerMode: 'PerGame'
  };
  
  try {
    const response = await axios.get(url, { 
      params, 
      headers: DEFAULT_HEADERS,
      timeout: 30000
    });
    
    return parseNBAResponse(response.data);
  } catch (error) {
    console.error('NBA API Error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fetch NBA data');
  }
};
```

### 3.3 Data Processing Pipeline

```javascript
// functions/dataProcessor.js
const admin = require('firebase-admin');
const db = admin.firestore();

export const processPlayerUpdate = async (nbaData) => {
  const batch = db.batch();
  
  for (const playerData of nbaData) {
    const playerRef = db.collection('players').doc(playerData.player_id);
    
    // Preserve user grades during updates
    const existingPlayer = await playerRef.get();
    const userData = existingPlayer.exists ? {
      traits: existingPlayer.data().traits,
      overall_grade: existingPlayer.data().overall_grade,
      roles: existingPlayer.data().roles
    } : {};
    
    const updatedData = {
      ...userData,
      bio: extractBioData(playerData),
      system: {
        stats: extractStatsData(playerData),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }
    };
    
    batch.set(playerRef, updatedData, { merge: true });
  }
  
  await batch.commit();
  console.log(`Updated ${nbaData.length} players`);
};
```

---

## 📋 Phase 4: Performance Optimization

### 4.1 React Query Integration

```javascript
// src/hooks/usePlayerData.js (Enhanced)
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

export const usePlayerData = () => {
  return useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'players'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false
  });
};

export const useRealTimePlayerData = () => {
  return useQuery({
    queryKey: ['players', 'realtime'],
    queryFn: () => new Promise((resolve) => {
      const unsubscribe = onSnapshot(
        collection(db, 'players'),
        (snapshot) => {
          resolve(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      );
      return { data: [], unsubscribe };
    }),
    staleTime: Infinity // Never stale for real-time data
  });
};
```

### 4.2 Firebase Query Optimization

```javascript
// src/utils/firebase/queries.js
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter 
} from 'firebase/firestore';

export const createOptimizedPlayerQuery = (filters, pagination) => {
  let playerQuery = collection(db, 'players');
  
  // Add filters
  if (filters.team) {
    playerQuery = query(playerQuery, where('bio.Team', '==', filters.team));
  }
  
  if (filters.position) {
    playerQuery = query(playerQuery, where('bio.Position', '==', filters.position));
  }
  
  // Add sorting
  playerQuery = query(playerQuery, orderBy('name'));
  
  // Add pagination
  if (pagination.limit) {
    playerQuery = query(playerQuery, limit(pagination.limit));
  }
  
  if (pagination.lastDoc) {
    playerQuery = query(playerQuery, startAfter(pagination.lastDoc));
  }
  
  return playerQuery;
};
```

### 4.3 Caching Strategy

```javascript
// src/utils/cache/playerCache.js
class PlayerDataCache {
  constructor() {
    this.cache = new Map();
    this.expiryTimes = new Map();
    this.DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  }
  
  set(key, data, ttl = this.DEFAULT_TTL) {
    this.cache.set(key, data);
    this.expiryTimes.set(key, Date.now() + ttl);
  }
  
  get(key) {
    if (this.isExpired(key)) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key);
  }
  
  isExpired(key) {
    const expiry = this.expiryTimes.get(key);
    return expiry && Date.now() > expiry;
  }
  
  delete(key) {
    this.cache.delete(key);
    this.expiryTimes.delete(key);
  }
  
  clear() {
    this.cache.clear();
    this.expiryTimes.clear();
  }
}

export const playerCache = new PlayerDataCache();
```

---

## 🧪 Testing Strategy

### Critical Test Updates Required

1. **Remove Caching Test Failures**
```javascript
// tests/playerData.test.js (simplified)
import { renderHook } from '@testing-library/react';
import { useSimplePlayerData } from '@/hooks/useSimplePlayerData';

describe('Player Data Hook', () => {
  test('loads player data successfully', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useSimplePlayerData());
    
    await waitForNextUpdate();
    
    expect(result.current.loading).toBe(false);
    expect(result.current.players).toBeDefined();
    expect(result.current.error).toBeNull();
  });
});
```

2. **Trade Validation Tests** (Remove complex caching)
```javascript
// tests/tradeValidation.test.js (simplified)
import { validateTrade } from '@/features/trades/validation/tradeRules';

describe('Trade Validation', () => {
  test('validates salary matching', () => {
    const tradeData = { /* test data */ };
    const result = validateTrade(tradeData);
    
    expect(result.isValid).toBeDefined();
    expect(result.violations).toEqual([]);
  });
});
```

---

## 📊 Implementation Metrics

### Success Criteria

1. **File Count Reduction**
   - Current: 294 JavaScript files
   - Target: ≤50 focused components
   - Measurement: `find src -name "*.js" -o -name "*.jsx" | wc -l`

2. **Test Success Rate**
   - Current: 172 passing, 27 failing
   - Target: ≥95% pass rate
   - Measurement: `npm run test -- --run`

3. **Build Performance**
   - Current: 7.6s build time, 1.29MB bundle
   - Target: <5s build, <1MB bundle
   - Measurement: `npm run build`

4. **Data Consistency**
   - Current: Multiple data sources
   - Target: Single source of truth
   - Measurement: Component audits

### Rollback Plan

If issues arise during migration:

1. **Keep deprecated hooks until migration complete**
2. **Feature flags for new data architecture**
3. **Database backups before major changes**
4. **Incremental rollout to components**

---

## 🚀 Deployment Considerations

### Environment Setup

1. **Firebase Functions Deployment**
```bash
cd functions
npm install
firebase deploy --only functions
```

2. **Environment Variables Update**
```env
# Remove Python-specific vars
# PYTHON_PATH=/usr/bin/python3
# NBA_API_KEY=...

# Add JavaScript-specific vars
FIREBASE_FUNCTIONS_URL=https://...
```

3. **CI/CD Pipeline Updates**
```yaml
# .github/workflows/deploy.yml
- name: Deploy Functions
  run: |
    cd functions
    npm ci
    firebase deploy --only functions
```

This technical implementation guide provides the specific code changes and migration steps needed to execute the data architecture fixes identified in the comprehensive analysis.