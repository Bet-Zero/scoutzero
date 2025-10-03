# Firestore Subcollection Data Structure

## Overview

Player data is now organized into subcollections for better data organization and historical tracking:

- **Root Document** (`/players/{playerId}`): Bio, grades, identity
- **Contracts Subcollection** (`/players/{playerId}/contracts/{contractId}`): Contract information
- **Seasons Subcollection** (`/players/{playerId}/seasons/{seasonId}`): Season statistics

## Data Upload Scripts

### Upload to Subcollections

Use the main upload script to route data to appropriate subcollections:

```bash
python3 data_pipeline/helpers/upload/push_to_subcollections.py
```

This script:
- Routes contract fields to `contracts` subcollection
- Routes season stats to `seasons` subcollection
- Writes bio/grades/identity to root document

### Individual Upload Scripts

**Bio and Contract Data:**
```bash
python3 data_pipeline/helpers/upload/push_bio_and_contract.py
```

**Season Stats:**
```bash
python3 data_pipeline/helpers/upload/push_stat_data.py
```

**Contract Updates (with pipeline):**
```bash
python3 data_pipeline/03_update_contracts.py
```

## Frontend Hooks

### Basic Player Data (Root Documents Only)

```javascript
import useSimplePlayerData from '@/hooks/useSimplePlayerData';

const { players, loading, error } = useSimplePlayerData();
```

### Enhanced Player Data (With Subcollections)

```javascript
import useEnhancedPlayerData from '@/hooks/useEnhancedPlayerData';

const { players, loading, error } = useEnhancedPlayerData();
// players include merged contract and season data
```

### Individual Player Contract

```javascript
import { usePlayerContract } from '@/hooks/usePlayerContract';

const { contract, loading, error } = usePlayerContract(playerId);
```

### Individual Player Season Stats

```javascript
import { usePlayerSeasonStats } from '@/hooks/usePlayerSeasonStats';

const { seasonStats, loading, error } = usePlayerSeasonStats(playerId, '2024-25');
// seasonId is optional, defaults to current season
```

### Complete Player Data

```javascript
import { useCompletePlayerData } from '@/hooks/usePlayerSeasonStats';

const { player, contract, seasonStats, loading, error } = useCompletePlayerData(playerId);
```

### Batch Operations

```javascript
import { useBatchPlayerContracts } from '@/hooks/usePlayerContract';
import { useBatchPlayerSeasonStats } from '@/hooks/usePlayerSeasonStats';

// Fetch contracts for multiple players
const { contractsByPlayer, loading } = useBatchPlayerContracts(playerIds);

// Fetch season stats for multiple players
const { statsByPlayer, loading } = useBatchPlayerSeasonStats(playerIds, '2024-25');
```

## Field Categories

### Root Document Fields

**Bio Data:**
- Name, HT, WT, AGE, Years Pro, Team, Position
- bio object with structured data

**Grades & Traits:**
- overall_grade, traits, roles, badges, blurbs, subRoles
- shootingProfile

**Identity:**
- player_id, nba_player_id, name, display_name
- is_active_nba, discovery_source

**Metadata:**
- last_updated, last_bio_update
- draft, position

### Contract Subcollection Fields

- Contract (e.g., "$48.7M / 2 yrs")
- Free Agent (e.g., "2026 (UFA)")
- bird_rights, free_agent_type, free_agency_year
- contract_summary, contract (raw), contract_clean
- cap_hold, qualifying_offer, no_trade_clause, trade_kicker
- agent { name, agency }
- status (e.g., 'Signed', 'FA', '2-Way')
- updated_at (timestamp)

### Season Subcollection Fields

**Document ID:** Season identifier (e.g., `2024-25`)

**Stats:**
- MIN, PPG, RPG, APG
- FG%, 3PT%, FT%, EFG%
- TS%, USG%, BPM, VORP, WS, PER
- Games Played

**Metadata:**
- season_id
- updated_at (timestamp)

## Migration Notes

### Backward Compatibility

The new hooks maintain backward compatibility by:
1. `useSimplePlayerData` - still works, returns root documents only
2. `useEnhancedPlayerData` - merges subcollection data for full compatibility
3. Individual hooks available for specific needs

### Updating Existing Code

**Before:**
```javascript
const { players } = usePlayerData();
const contract = players[0].Contract;
const stats = players[0].PPG;
```

**After (Option 1 - Same API):**
```javascript
const { players } = useEnhancedPlayerData();
const contract = players[0].Contract; // Merged from subcollection
const stats = players[0].PPG; // Merged from subcollection
```

**After (Option 2 - Explicit):**
```javascript
const { players } = useSimplePlayerData();
const { contract } = usePlayerContract(players[0].id);
const { seasonStats } = usePlayerSeasonStats(players[0].id);
```

## Benefits

1. **Better Organization:** Clear separation of bio, contract, and season data
2. **Historical Tracking:** Easy to store multiple contracts/seasons per player
3. **Performance:** Fetch only the data you need
4. **Scalability:** Subcollections grow independently
5. **Flexibility:** Add new seasons/contracts without modifying root document
