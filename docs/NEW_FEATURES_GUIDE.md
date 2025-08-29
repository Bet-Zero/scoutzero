# 🚀 NEW FEATURES DOCUMENTATION

This document covers the major new features implemented for the ScoutZero project: Grade Archiving, Season Management, Enhanced Virtual World, and Scripts Pipeline.

## 📚 Grade Archiving System

### Overview
Track player grade changes over time with automatic and manual archiving capabilities.

### Key Components
- **`src/utils/gradeArchiving/gradeHistoryHelpers.js`** - Core archiving functions
- **`src/features/profile/GradeArchivePanel.jsx`** - UI component for player profiles

### Usage

#### Archive Player Grades
```javascript
import { archivePlayerGrades } from '@/utils/gradeArchiving';

// Manual archive
await archivePlayerGrades(playerId, currentGradeData, season, 'manual_save');

// Auto-archive on significant changes
await autoArchiveOnChange(playerId, oldData, newData);
```

#### View Grade History
```javascript
import { getPlayerGradeHistory, compareGrades } from '@/utils/gradeArchiving';

// Get all archives for a player
const history = await getPlayerGradeHistory(playerId);

// Compare with current grades
const comparison = await compareGrades(playerId, archiveId, 'current');
```

#### Batch Operations
```javascript
import { batchArchiveGrades } from '@/utils/gradeArchiving';

// Archive grades for multiple players (useful for season end)
const results = await batchArchiveGrades(playerIds, season, 'season_end');
```

### UI Integration
Add the `GradeArchivePanel` component to player profile pages:

```jsx
import GradeArchivePanel from '@/features/profile/GradeArchivePanel';

// In your player profile component
<GradeArchivePanel 
  player={player} 
  currentGrades={currentGradeData} 
/>
```

## 📅 Season Management

### Overview
Organize all data by NBA seasons with archiving and historical comparison capabilities.

### Key Components
- **`src/utils/seasonManagement/seasonHelpers.js`** - Season management functions
- **`src/components/shared/SeasonSelector.jsx`** - Season selection UI
- **`scripts/season_manager.py`** - CLI tool for season operations

### Usage

#### Initialize New Season
```javascript
import { initializeSeason, getCurrentSeason } from '@/utils/seasonManagement';

const newSeason = getCurrentSeason() + 1;
await initializeSeason(newSeason, {
  start_date: '2025-10-01',
  end_date: '2026-06-30',
  trade_deadline: '2026-02-08'
});
```

#### Archive Season Data
```javascript
import { archiveSeasonData } from '@/utils/seasonManagement';

const results = await archiveSeasonData(2025, {
  includePlayerGrades: true,
  includeTeamData: true,
  reason: 'end_of_season'
});
```

#### Season Selector Component
```jsx
import SeasonSelector from '@/components/shared/SeasonSelector';

<SeasonSelector
  selectedSeason={currentSeason}
  onSeasonChange={setCurrentSeason}
  showCreateOption={true}
/>
```

### CLI Management
Use the season manager script for bulk operations:

```bash
# Create new season
python3 scripts/season_manager.py create 2026

# Archive season data
python3 scripts/season_manager.py archive 2025

# List all seasons
python3 scripts/season_manager.py list
```

## 🌐 Enhanced Virtual World Management

### Overview
Advanced team planning with plan inheritance, branching, and scenario modeling.

### Key Features
- **Plan Inheritance** - Create plans based on real-world data or other plans
- **Plan Cloning** - Branch scenarios from existing plans
- **Comparison Tools** - Compare different planning scenarios
- **Inheritance Trees** - Track plan relationships

### Usage

#### Create Virtual Plan
```javascript
import { createVirtualPlan } from '@/utils/architect/firebaseTeamPlanHelpers';

await createVirtualPlan(userId, teamId, 'Trade Scenario A', 'real_world', {
  description: 'Exploring Bradley Beal trade',
  scenario: 'trade_analysis',
  allowTrades: true,
  timeHorizon: 'multi_year'
});
```

#### Clone Existing Plan
```javascript
import { cloneVirtualPlan } from '@/utils/architect/firebaseTeamPlanHelpers';

await cloneVirtualPlan(
  userId, 
  teamId, 
  'Trade Scenario A', 
  'Trade Scenario A - Modified',
  {
    description: 'Modified version with different players',
    metadata: { variation: 'player_swap' }
  }
);
```

#### Compare Plans
```javascript
import { compareVirtualPlans } from '@/utils/architect/firebaseTeamPlanHelpers';

const comparison = await compareVirtualPlans(
  userId, 
  teamId, 
  'Current Roster', 
  'Trade Scenario A'
);
```

#### Track Plan Inheritance
```javascript
import { getPlanInheritanceTree } from '@/utils/architect/firebaseTeamPlanHelpers';

const tree = await getPlanInheritanceTree(userId, teamId, 'Trade Scenario A');
// Returns: [current_plan, parent_plan, grandparent_plan, ..., real_world]
```

## 🔧 Scripts Pipeline

### Overview
Automated data pipeline for contract scraping, merging, and Firestore uploads.

### Master Scripts
- **`scripts/updateContracts.py`** - Complete contract update pipeline
- **`scripts/update_stats.py`** - Stats update pipeline

### Pipeline Components

#### Contract Pipeline
1. **`scripts/contracts/scrape_all_contracts.py`** - Scrape contract data
2. **`scripts/contracts/parse_contract_data.py`** - Parse and clean data
3. **`scripts/merge/merge_universal_player_data.py`** - Merge with existing data
4. **`scripts/upload/push_bio_and_contract.py`** - Upload to Firestore
5. **`scripts/capsheets/generateCapSheets.js`** - Generate team cap sheets

#### Firebase Helpers
```javascript
// Node.js environment
const { uploadPlayer, batchUploadPlayers } = require('./scripts/upload/firebaseHelpers.node.js');

// Upload single player
await uploadPlayer(playerId, playerData);

// Batch upload
await batchUploadPlayers(playersArray);
```

### Running the Pipeline

#### Full Contract Update
```bash
# Run complete contract pipeline
python3 scripts/updateContracts.py
```

#### Stats Update Only
```bash
# Run stats pipeline
python3 scripts/update_stats.py
```

#### Individual Components
```bash
# Just generate cap sheets
node scripts/capsheets/generateCapSheets.js

# Archive current grades
python3 scripts/season_manager.py archive 2025 --no-teams
```

## 📊 Atlas Documentation Tools

### Overview
Automated code analysis and documentation generation tools.

### Available Commands
```bash
# Generate dependency graphs and analysis
npm run docs:deps

# Find validator entry points
npm run docs:candidates

# Generate project maps
npm run docs:map

# Create rules catalog
npm run docs:rules

# Generate Mermaid diagrams
npm run docs:mermaid
```

### Configuration
Edit `scripts/atlas.config.json` to customize analysis:

```json
{
  "roots": ["src"],
  "exclude": ["node_modules/**", "dist/**", "build/**"],
  "docs_dir": "atlas-docs"
}
```

## 🔗 Integration Examples

### Player Profile with Grade History
```jsx
import React, { useState } from 'react';
import GradeArchivePanel from '@/features/profile/GradeArchivePanel';
import { archivePlayerGrades } from '@/utils/gradeArchiving';

const EnhancedPlayerProfile = ({ player }) => {
  const [grades, setGrades] = useState(player.grades);

  const handleGradeChange = async (newGrades) => {
    // Auto-archive if significant changes
    await autoArchiveOnChange(player.id, grades, newGrades);
    setGrades(newGrades);
  };

  return (
    <div>
      {/* Regular player profile components */}
      <PlayerDetails grades={grades} onGradeChange={handleGradeChange} />
      
      {/* New grade archiving panel */}
      <GradeArchivePanel player={player} currentGrades={grades} />
    </div>
  );
};
```

### Season-Aware App Structure
```jsx
import React, { useState, useEffect } from 'react';
import SeasonSelector from '@/components/shared/SeasonSelector';
import { getCurrentSeason } from '@/utils/seasonManagement';

const App = () => {
  const [selectedSeason, setSelectedSeason] = useState(getCurrentSeason());

  return (
    <div>
      <SeasonSelector 
        selectedSeason={selectedSeason}
        onSeasonChange={setSelectedSeason}
        showCreateOption={true}
      />
      
      {/* Season-aware components */}
      <PlayerTable season={selectedSeason} />
      <TeamView season={selectedSeason} />
    </div>
  );
};
```

### Virtual Planning Workflow
```jsx
import React, { useState } from 'react';
import { 
  createVirtualPlan, 
  listVirtualPlans, 
  compareVirtualPlans 
} from '@/utils/architect/firebaseTeamPlanHelpers';

const TeamPlanningDashboard = ({ userId, teamId }) => {
  const [plans, setPlans] = useState([]);
  const [selectedPlans, setSelectedPlans] = useState([]);

  const createNewScenario = async (basePlan, name, description) => {
    await createVirtualPlan(userId, teamId, name, basePlan, {
      description,
      scenario: 'trade_analysis'
    });
    
    // Refresh plans list
    const updated = await listVirtualPlans(userId, teamId);
    setPlans(updated);
  };

  const comparePlans = async () => {
    if (selectedPlans.length === 2) {
      const comparison = await compareVirtualPlans(
        userId, teamId, selectedPlans[0], selectedPlans[1]
      );
      // Display comparison results
    }
  };

  return (
    <div>
      {/* Plan creation and management UI */}
      <PlanCreator onCreate={createNewScenario} />
      <PlansList plans={plans} onSelect={setSelectedPlans} />
      <PlanComparison onCompare={comparePlans} />
    </div>
  );
};
```

## 🎯 Best Practices

### Grade Archiving
- Archive grades before major changes (trades, season transitions)
- Use descriptive reasons for manual archives
- Set up auto-archiving for significant grade changes
- Regular batch archives at season milestones

### Season Management
- Initialize new seasons before they start
- Archive completed seasons for historical reference
- Use season selectors in data-dependent components
- Maintain season metadata for context

### Virtual Planning
- Use descriptive names for virtual plans
- Document scenarios with metadata
- Create inheritance chains for related plans
- Regular cleanup of unused virtual plans

### Scripts Pipeline
- Run contract updates weekly during season
- Monitor script output for errors
- Use batch operations for large datasets
- Test scripts in development before production use