# 🚀 IMMEDIATE IMPLEMENTATION GUIDE

This document provides actionable steps to implement the Firestore optimization plan, starting with the highest priority items.

## 🎯 Phase 1: Critical Foundation (Start Here)

### Step 1: Create Scripts Folder Structure

```bash
# Create the main scripts directory structure
mkdir -p scripts/{audit,capsheets,contracts,merge,names,upload,utils}

# Create priority 1 scripts (contract pipeline)
touch scripts/contracts/scrape_all_contracts.py
touch scripts/contracts/parse_contract_data.py
touch scripts/merge/merge_universal_player_data.py
touch scripts/upload/push_bio_and_contract.py
touch scripts/upload/push_stat_data.py
touch scripts/upload/firebaseHelpers.node.js
touch scripts/capsheets/generateCapSheets.js
```

### Step 2: Update Package.json Scripts

The package.json already references these scripts. Verify they work:

```json
{
  "scripts": {
    "update-contracts": "python3 scripts/updateContracts.py",
    "update-stats": "python3 scripts/update_stats.py",
    "generate-capsheets": "node scripts/capsheets/generateCapSheets.js"
  }
}
```

### Step 3: Enhanced Virtual Plans Structure

Update the `firebaseTeamPlanHelpers.js` to support plan inheritance:

```javascript
// Add to src/utils/architect/firebaseTeamPlanHelpers.js

export const createVirtualPlan = async (userId, teamId, planName, basePlan = "real_world") => {
  try {
    const planId = `${userId}_${teamId}`;
    
    // Get base plan data
    let basePlanData;
    if (basePlan === "real_world") {
      basePlanData = { capSheet: await loadTeamCapSheet(teamId) };
    } else {
      basePlanData = await loadNamedTeamPlan(userId, teamId, basePlan);
    }
    
    if (!basePlanData) {
      throw new Error(`Base plan '${basePlan}' not found`);
    }

    const newPlan = {
      name: planName,
      capSheet: basePlanData.capSheet,
      basedOn: basePlan,
      changes: [],
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      description: `Virtual plan based on ${basePlan}`
    };

    const ref = doc(db, 'teamPlans', planId, 'namedPlans', planName);
    await setDoc(ref, newPlan);
    
    console.log(`Created virtual plan '${planName}' for ${userId} - ${teamId}`);
    return true;
  } catch (error) {
    console.error('Error creating virtual plan:', error);
    return false;
  }
};

export const applyTradeToVirtualPlan = async (userId, teamId, planName, tradeData) => {
  try {
    const planId = `${userId}_${teamId}`;
    const planRef = doc(db, 'teamPlans', planId, 'namedPlans', planName);
    const planSnap = await getDoc(planRef);
    
    if (!planSnap.exists()) {
      throw new Error(`Plan '${planName}' not found`);
    }
    
    const plan = planSnap.data();
    
    // Apply trade to the cap sheet (this would use existing trade logic)
    const updatedCapSheet = applyTradeToCapSheet(plan.capSheet, tradeData);
    
    // Track the change
    const change = {
      type: 'trade',
      timestamp: new Date().toISOString(),
      description: `Trade: ${tradeData.description || 'Unnamed trade'}`,
      details: tradeData
    };
    
    await updateDoc(planRef, {
      capSheet: updatedCapSheet,
      changes: [...(plan.changes || []), change],
      lastUpdated: serverTimestamp()
    });
    
    console.log(`Applied trade to plan '${planName}'`);
    return true;
  } catch (error) {
    console.error('Error applying trade to virtual plan:', error);
    return false;
  }
};

export const listVirtualPlans = async (userId, teamId) => {
  try {
    const planId = `${userId}_${teamId}`;
    const plansRef = collection(db, 'teamPlans', planId, 'namedPlans');
    const snap = await getDocs(plansRef);
    
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        basedOn: data.basedOn,
        lastUpdated: data.lastUpdated,
        description: data.description,
        changeCount: (data.changes || []).length
      };
    });
  } catch (error) {
    console.error('Error listing virtual plans:', error);
    return [];
  }
};

// Helper function to apply trade logic to cap sheet
const applyTradeToCapSheet = (capSheet, tradeData) => {
  // This would integrate with existing trade validation logic
  // For now, return a simple implementation
  const updatedCapSheet = JSON.parse(JSON.stringify(capSheet)); // Deep clone
  
  // Remove outgoing players
  if (tradeData.outgoing) {
    updatedCapSheet.players = updatedCapSheet.players.filter(
      player => !tradeData.outgoing.some(out => out.player_id === player.player_id)
    );
  }
  
  // Add incoming players
  if (tradeData.incoming) {
    updatedCapSheet.players.push(...tradeData.incoming);
  }
  
  // Recalculate totals
  updatedCapSheet.totalSalary = updatedCapSheet.players.reduce(
    (sum, player) => sum + (player.contract_clean?.salaries_by_year?.['2025']?.salary || 0), 0
  );
  
  return updatedCapSheet;
};
```

## 📦 Step 4: Basic Scripts Implementation

### Contract Scraping Template

```python
# scripts/contracts/scrape_all_contracts.py
import requests
import json
import time
from bs4 import BeautifulSoup

def scrape_contracts():
    """
    Scrape NBA contract data from public sources
    This is a template - implement based on your data sources
    """
    print("🔍 Starting contract scraping...")
    
    # Placeholder for actual scraping logic
    contracts = []
    
    # Example structure of what scraped data should look like
    example_contract = {
        "player_id": "lebron_james",
        "player_name": "LeBron James", 
        "team": "Lakers",
        "contract_years": 2,
        "total_value": 85000000,
        "salaries_by_year": {
            "2024": {"salary": 47607350, "guaranteed": 47607350},
            "2025": {"salary": 51415938, "guaranteed": 51415938}
        },
        "bird_rights": "Full",
        "trade_kicker": None,
        "no_trade_clause": False
    }
    
    # Save raw data
    with open('data/raw_contracts.json', 'w') as f:
        json.dump(contracts, f, indent=2)
    
    print(f"✅ Scraped {len(contracts)} contracts")
    return contracts

if __name__ == "__main__":
    scrape_contracts()
```

### Data Upload Template

```python
# scripts/upload/push_bio_and_contract.py
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from firebase_helpers import savePlayerData
import json

def upload_player_data():
    """Upload processed player data to Firestore /players collection"""
    print("📤 Starting player data upload...")
    
    # Load processed data
    try:
        with open('data/processed_players.json', 'r') as f:
            players_data = json.load(f)
    except FileNotFoundError:
        print("❌ No processed player data found. Run merge script first.")
        return
    
    success_count = 0
    error_count = 0
    
    for player_id, player_data in players_data.items():
        try:
            savePlayerData(player_id, player_data)
            success_count += 1
        except Exception as e:
            print(f"❌ Error uploading {player_id}: {e}")
            error_count += 1
    
    print(f"✅ Upload complete: {success_count} success, {error_count} errors")

if __name__ == "__main__":
    upload_player_data()
```

### Cap Sheet Generation

```javascript
// scripts/capsheets/generateCapSheets.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs } from 'firebase/firestore';

// Firebase config (should match your project)
const firebaseConfig = {
  apiKey: "AIzaSyAXv8xJd08cDsM0X6hlMXZuWns-jwn3Lz8",
  authDomain: "scoutzero-bf1ae.firebaseapp.com",
  projectId: "scoutzero-bf1ae",
  storageBucket: "scoutzero-bf1ae.appspot.com",
  messagingSenderId: "105500121903",
  appId: "1:105500121903:web:119be1873ef2885949dfda"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const generateCapSheets = async () => {
  console.log('🏀 Generating cap sheets for all teams...');
  
  try {
    // Get all players
    const playersSnapshot = await getDocs(collection(db, 'players'));
    const allPlayers = {};
    
    playersSnapshot.forEach(doc => {
      allPlayers[doc.id] = { id: doc.id, ...doc.data() };
    });
    
    // Group players by team
    const teamRosters = {};
    Object.values(allPlayers).forEach(player => {
      const team = player.bio?.Team || player.team;
      if (team) {
        if (!teamRosters[team]) teamRosters[team] = [];
        teamRosters[team].push(player);
      }
    });
    
    // Generate cap sheet for each team
    for (const [teamName, players] of Object.entries(teamRosters)) {
      const teamId = teamName.toLowerCase().replace(/\s+/g, '_');
      
      // Calculate team salary
      let totalSalary = 0;
      const processedPlayers = players.map(player => {
        const salary = player.contract_clean?.salaries_by_year?.['2025']?.salary || 0;
        totalSalary += salary;
        
        return {
          name: player.name || player.display_name,
          player_id: player.player_id || player.id,
          position: player.position || player.bio?.Position,
          age: player.bio?.AGE || player.age,
          height: player.bio?.HT,
          weight: player.bio?.WT,
          contract_clean: player.contract_clean || {}
        };
      });
      
      const capSheet = {
        lastUpdated: Date.now(),
        teamName,
        totalSalary,
        players: processedPlayers
      };
      
      // Save to /teams collection
      await setDoc(doc(db, 'teams', teamId), { capSheet }, { merge: true });
      console.log(`✅ Generated cap sheet for ${teamName} (${players.length} players, $${totalSalary.toLocaleString()})`);
    }
    
    console.log('🎉 Cap sheet generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating cap sheets:', error);
  }
};

generateCapSheets();
```

## 🔧 Step 5: Test the Implementation

### Test Virtual Plans
```javascript
// Test script - can be run in browser console or as Node script
const testVirtualPlans = async () => {
  const userId = "test_user";
  const teamId = "lakers";
  
  // Create a virtual plan
  await createVirtualPlan(userId, teamId, "lebron_experiment", "real_world");
  
  // List all plans for this user/team
  const plans = await listVirtualPlans(userId, teamId);
  console.log("Available plans:", plans);
  
  // Apply a mock trade
  const mockTrade = {
    description: "Trade LeBron for picks",
    outgoing: [{ player_id: "lebron_james", name: "LeBron James" }],
    incoming: [{ player_id: "draft_pick_1", name: "2025 First Round Pick" }]
  };
  
  await applyTradeToVirtualPlan(userId, teamId, "lebron_experiment", mockTrade);
  console.log("Trade applied successfully");
};
```

### Test Data Pipeline
```bash
# Test the scripts
npm run generate-capsheets
npm run update-stats  # (after implementing)
npm run update-contracts  # (after implementing)
```

## 📝 Step 6: Integration with Trade Machine

Update the Trade Machine to work with virtual plans:

```javascript
// In trade machine components, add plan selection
const TradeWithVirtualPlans = () => {
  const [selectedPlan, setSelectedPlan] = useState("real_world");
  const [virtualPlans, setVirtualPlans] = useState([]);
  
  useEffect(() => {
    // Load available plans for current user/team
    const loadPlans = async () => {
      const plans = await listVirtualPlans(userId, teamId);
      setVirtualPlans(plans);
    };
    loadPlans();
  }, [userId, teamId]);
  
  // Use selected plan data instead of real team data
  const teamData = selectedPlan === "real_world" 
    ? realTeamData 
    : virtualPlanData[selectedPlan];
    
  // Rest of trade machine logic...
};
```

## ✅ Validation Checklist

Before moving to Phase 2, ensure:

- [ ] Scripts folder structure is created
- [ ] Virtual plan creation works
- [ ] Virtual plan listing works  
- [ ] Trade application to virtual plans works
- [ ] Cap sheet generation runs successfully
- [ ] Data pipeline scripts have basic structure
- [ ] Trade Machine can switch between real and virtual data
- [ ] All tests pass
- [ ] No data corruption in existing collections

## 🚀 Next Steps

Once Phase 1 is complete:

1. **Implement actual data scraping** in the contract scripts
2. **Add stats update pipeline** 
3. **Enhance plan inheritance** system
4. **Add real-world sync** capabilities
5. **Performance optimizations** and caching

This foundation provides a solid base for the complete data management system while maintaining the excellent existing structure.