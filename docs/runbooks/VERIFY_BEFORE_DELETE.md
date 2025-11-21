# Verify Before Deleting Old Collections

## Collections to Delete
- `/teams` (old team data)
- `/players` (old player data - if exists)

## Verification Steps

### ✅ Code Check
Run this to verify no active code reads from old collections:
```bash
grep -r "collection.*teams\|doc.*teams" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" | grep -v "baseTeams\|teamPlans\|teamProjects"
```

**Expected Result:** Only `FirestoreDataDiagnostic.jsx` mentions old collections (diagnostic only - OK)

### ✅ Current Data Sources
All team/player loading now uses:
- **Teams**: `architect_baseTeams` collection (via `loadTeamCapSheet`)
- **Players**: `players_v2` collection (via `useSimplePlayerData`)
- **Architect Players**: `architect_basePlayers` collection (via `basePlayerRef`)

### ✅ Functions Using New Collections
- `loadTeamCapSheet()` → reads from `architect_baseTeams`
- `getAllTeams()` → reads from `architect_baseTeams`
- `useSimplePlayerData()` → reads from `players_v2`
- `hydrateBaseTeam()` → reads from `architect_basePlayers`

### ⚠️ Before Deleting
1. **Export backups** (optional but recommended):
   ```bash
   # Export teams collection
   # Export players collection (if you want to keep as backup)
   ```

2. **Test the application** - verify everything works with new collections

3. **Delete old collections**:
   - `/teams` → Safe to delete (all code uses `architect_baseTeams`)
   - `/players` → Safe to delete if exists (all code uses `players_v2`)

### 📝 After Deletion
- Old collections are gone
- All features should continue working from new collections
- Diagnostic component may show warnings (expected - it checks old collections)


