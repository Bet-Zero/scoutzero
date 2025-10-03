# Collection Naming Strategy & Frontend Integration Guide

## Collection Naming: How to Keep "players" Instead of "players_v2"

The migration system was designed to create a **new collection** (`players_v2`) to ensure safety - you can always roll back to the original `players` collection. However, if you want to end up with the collection named `players`, here are your options:

### Option 1: Rename After Migration (Recommended)

**Step-by-step:**

1. **Run migration to `players_v2`:**
   ```bash
   npm run migrate:live  # Creates players_v2
   ```

2. **Verify `players_v2` is correct** (test app, check data)

3. **Rename collections in Firestore:**
   - Unfortunately, Firestore doesn't support direct rename
   - You need to: **Delete old `players`** → **Rename `players_v2` to `players`**

4. **Use the provided script to do this safely:**

   Create a new script: `scripts/rename_collection.cjs`
   ```javascript
   #!/usr/bin/env node
   const admin = require('firebase-admin');
   
   if (!admin.apps.length) { admin.initializeApp(); }
   const db = admin.firestore();
   
   async function renameCollection() {
     console.log('🔄 Renaming players_v2 → players\n');
     
     // Step 1: Backup old players collection
     console.log('Step 1: Creating backup of old players...');
     const oldPlayers = await db.collection('players').get();
     const backup = {};
     oldPlayers.docs.forEach(doc => backup[doc.id] = doc.data());
     require('fs').writeFileSync(
       `./backup_old_players_${Date.now()}.json`, 
       JSON.stringify(backup, null, 2)
     );
     console.log(`✅ Backed up ${oldPlayers.size} documents\n`);
     
     // Step 2: Delete old players collection
     console.log('Step 2: Deleting old players collection...');
     const batch1 = db.batch();
     oldPlayers.docs.forEach(doc => batch1.delete(doc.ref));
     await batch1.commit();
     console.log('✅ Old players collection deleted\n');
     
     // Step 3: Copy players_v2 to players
     console.log('Step 3: Copying players_v2 → players...');
     const newPlayers = await db.collection('players_v2').get();
     const batch2 = db.batch();
     newPlayers.docs.forEach(doc => {
       batch2.set(db.collection('players').doc(doc.id), doc.data());
     });
     await batch2.commit();
     console.log(`✅ Copied ${newPlayers.size} documents to players\n`);
     
     // Step 4: Delete players_v2
     console.log('Step 4: Deleting players_v2...');
     const batch3 = db.batch();
     newPlayers.docs.forEach(doc => batch3.delete(doc.ref));
     await batch3.commit();
     console.log('✅ Deleted players_v2\n');
     
     console.log('🎉 Collection renamed successfully!');
     console.log('   players_v2 → players');
   }
   
   renameCollection().catch(console.error);
   ```

   Then run:
   ```bash
   node scripts/rename_collection.cjs
   ```

### Option 2: Modify Migration Script to Write Directly to "players"

**WARNING:** This is riskier because you lose the safety net.

If you want to write directly to `players` collection (overwriting existing data):

1. **Create backup first:**
   ```bash
   # Backup existing players collection
   node scripts/migrate_phase1_enhanced.cjs --dry-run --backup
   ```

2. **Modify the enhanced migration script:**
   
   Edit `scripts/migrate_phase1_enhanced.cjs` line 252:
   ```javascript
   // BEFORE:
   const dstCollectionName = args.shadow ? 'players_v2_shadow' : 'players_v2';
   
   // AFTER (to write directly to players):
   const dstCollectionName = args.shadow ? 'players_v2_shadow' : 'players';
   ```

3. **Run migration:**
   ```bash
   npm run migrate:live
   ```

   This will **overwrite** the existing `players` collection with the new structure.

### Option 3: Use Two-Phase Approach (Safest)

1. **Phase 1:** Migrate to `players_v2` (already done)
2. **Phase 2:** Update frontend to use new structure with `players_v2`
3. **Phase 3:** Test thoroughly
4. **Phase 4:** Once stable, use Option 1 to rename `players_v2` → `players`
5. **Phase 5:** Update frontend to use `players` again

---

## Frontend Integration: What Was Done vs. What's Needed

### ❌ Frontend Integration Was NOT Automatically Fixed

The tools I created **do not automatically update your frontend code**. Here's what was provided vs. what you still need to do:

### ✅ What Was Provided

**Documentation only:**
- `ENHANCED_MIGRATION_GUIDE.md` includes a section on frontend updates
- Lists which files need to be updated
- Provides examples of what to change

**No actual code changes were made to:**
- `src/hooks/usePlayerData.js`
- `src/firebase/`
- `src/utils/filtering/`
- `src/utils/roster/`

### ⚠️ What You Need to Do Manually

You **must update your frontend code** to read from the new structure. Here's exactly what to change:

#### 1. Update Collection References

**File:** `src/hooks/usePlayerData.js` (or wherever you query Firestore)

```javascript
// OLD (reading from flat structure):
const playersRef = collection(db, 'players');

// NEW (reading from hierarchical structure):
const playersRef = collection(db, 'players_v2');  // or 'players' after rename
```

#### 2. Update Data Selectors

**Old code (flat structure):**
```javascript
const name = player.display_name;
const age = player.AGE;
const position = player.Position;
const points = player.system?.stats?.PTS;
const shooting = player.traits?.Shooting;
const team = player.Team;
```

**New code (hierarchical structure):**
```javascript
const name = player.bio?.displayName;
const age = player.bio?.age;
const position = player.bio?.position;
const points = player.seasons?.['2025-26']?.stats?.PTS;
const shooting = player.evaluations?.traits?.Shooting;
const team = player.bio?.display?.team;
```

#### 3. Key Files That Need Updates

Search your codebase for these patterns and update them:

**Pattern 1: Direct field access**
```javascript
// Find and replace:
player.display_name     → player.bio.displayName
player.AGE              → player.bio.age
player.Position         → player.bio.position
player.HT               → player.bio.height (now in inches!)
player.WT               → player.bio.weight
player.Team             → player.bio.display.team
```

**Pattern 2: Stats access**
```javascript
// Find and replace:
player.system.stats     → player.seasons['2025-26'].stats
player['Games Played']  → player.seasons['2025-26'].stats.GP
player.PPG              → player.seasons['2025-26'].stats.PTS
```

**Pattern 3: Evaluation data**
```javascript
// Find and replace:
player.overall_grade    → player.evaluations.overallGrade
player.traits           → player.evaluations.traits
player.roles            → player.evaluations.roles
player.shootingProfile  → player.evaluations.shootingProfile
```

**Pattern 4: Contract data**
```javascript
// Find and replace:
player.contract         → player.contracts['std_202425']  // or dynamic contractId
player.free_agency_year → player.bio.display.freeAgentYear
```

#### 4. Create a Data Adapter (Recommended)

To minimize code changes, create an adapter that converts new structure → old structure:

**File:** `src/utils/playerDataAdapter.js`
```javascript
export function adaptPlayerData(newPlayer) {
  // Convert new hierarchical structure to old flat structure
  // This allows minimal changes to existing code
  return {
    // Bio fields
    display_name: newPlayer.bio?.displayName,
    AGE: newPlayer.bio?.age,
    Position: newPlayer.bio?.position,
    HT: newPlayer.bio?.height ? `${Math.floor(newPlayer.bio.height / 12)}-${newPlayer.bio.height % 12}` : null,
    WT: newPlayer.bio?.weight,
    Team: newPlayer.bio?.display?.team,
    
    // Stats (use current season)
    system: {
      stats: newPlayer.seasons?.['2025-26']?.stats || {}
    },
    
    // Evaluations
    overall_grade: newPlayer.evaluations?.overallGrade,
    traits: newPlayer.evaluations?.traits,
    roles: newPlayer.evaluations?.roles,
    shootingProfile: newPlayer.evaluations?.shootingProfile,
    badges: newPlayer.evaluations?.badges,
    
    // Contract
    contract: newPlayer.contracts?.['std_202425'] || {},
    free_agency_year: newPlayer.bio?.display?.freeAgentYear,
    
    // Keep new structure available too
    _newStructure: newPlayer
  };
}

// Usage:
import { adaptPlayerData } from '@/utils/playerDataAdapter';

const players = await getPlayers();
const adaptedPlayers = players.map(adaptPlayerData);
// Now use adaptedPlayers with your existing code
```

#### 5. Testing Checklist

After updating frontend code:

- [ ] Player list loads correctly
- [ ] Player profiles display all data
- [ ] Search and filters work
- [ ] Roster builder functions
- [ ] Stats display correctly
- [ ] Contract information shows properly
- [ ] No console errors
- [ ] All features tested

---

## Recommended Workflow

### Week 1: Migration
```bash
# 1. Test migration
npm run migrate:dry

# 2. Shadow migration
npm run migrate:shadow-backup

# 3. Verify shadow data
# Check Firebase Console: players_v2_shadow

# 4. Live migration (creates players_v2)
npm run migrate:live
```

### Week 2: Frontend Updates

```bash
# 1. Create data adapter (recommended)
# See adapter code above

# 2. Update collection references
# Change 'players' → 'players_v2' in queries

# 3. Test locally with players_v2
npm run dev

# 4. Fix any issues
```

### Week 3: Rename & Deploy

```bash
# 1. Rename players_v2 → players (Option 1 above)
node scripts/rename_collection.cjs

# 2. Update frontend to use 'players' collection
# (or keep using 'players_v2')

# 3. Deploy
npm run build
# Deploy to production

# 4. Monitor for issues
```

---

## Summary

**Collection Naming:**
- Migration creates `players_v2` for safety
- Use Option 1 (rename script) to end up with `players` collection
- Or modify migration script to write directly to `players` (riskier)

**Frontend Integration:**
- ❌ Was NOT automatically fixed
- ✅ Documentation was provided
- ⚠️ You must manually update frontend code
- 💡 Use data adapter to minimize changes
- 📋 Follow testing checklist before deployment

**Key Takeaway:**
The migration tools are ready, but **frontend code changes are manual** and **collection naming requires an extra step** if you want to keep the name "players".
