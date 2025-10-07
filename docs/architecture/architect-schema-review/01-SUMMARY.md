# Architect Firestore Schema v2 - Summary

## Goal
Create a lean, efficient Firestore schema for the Architect feature that stores user-created "worlds" (alternate NBA scenarios) as diffs against an immutable real-life baseline, minimizing storage and query complexity.

## The Plan

### Core Architecture Principles
1. **Single Root Collection**: Everything lives under `/architect` 
2. **Immutable Base Data**: Real NBA data stored in `/architect/baseTeams` and `/architect/basePlayers` - never modified by user actions
3. **Diff-Only Storage**: User worlds only store what changes from the baseline
4. **Hierarchical Organization**: World data structured as `/architect/worlds/{worldId}/teams/{teamCode}`
5. **Player-Level Overrides**: Individual player contract changes stored per-team within worlds

### Storage Strategy

#### Base Layer (Immutable)
- **`/architect/baseTeams/{teamCode}`**: Complete team data (30 docs)
  - Roster arrays (player IDs only)
  - Dead cap, cap holds, exceptions
  - Draft picks
  - Computed totals (salary, cap space, apron status)
  
- **`/architect/basePlayers/{playerId}`**: Complete player data (~530 docs)
  - Bio information
  - Full contract ladder (seasons, guarantees, options)
  - Free agency details
  - Bird rights status

#### World Layer (Diff-Only)
- **`/architect/worlds/{worldId}/teams/{teamCode}/teamDoc`**: Team-level changes only
  - Modified roster (player ID array)
  - Overrides for team-level fields (dead cap, exceptions, picks)
  - Cached aggregated totals (recomputed on writes)
  
- **`/architect/worlds/{worldId}/teams/{teamCode}/players/{playerId}`**: Player contract overrides
  - Only stores changed contract fields
  - Extension/guarantee/option modifications
  - World-specific Bird rights changes

### Read/Write Flow

#### Reading Data
1. **Default Mode** (no world selected): Read directly from base collections
2. **World Mode**: 
   - Check for world team doc, fallback to base team
   - For each roster player, check for player override, fallback to base player
   - Merge overrides with base data for complete view

#### Writing Data
1. **Trades**: Update both teams' roster arrays, recompute totals
2. **Extensions/Guarantees**: Create player override with only changed fields
3. **Waives/Stretches**: Update roster, append dead cap, recompute totals
4. **Team Changes**: Update team doc overrides, recompute cached totals

## Purpose

### Problem Being Solved
Current architecture mixes user-generated "plans" with base NBA data, creating:
- Risk of data corruption/overwriting real NBA data
- Complex merge logic when rendering worlds
- Inefficient storage (full copies of unchanged data)
- Difficult conflict resolution between real NBA updates and user worlds

### Benefits of v2 Approach
1. **Data Safety**: Base NBA data is completely isolated and immutable
2. **Storage Efficiency**: Only stores what changes (typically 2-4 teams per world)
3. **Clear Separation**: Obvious boundary between real data and user scenarios
4. **Scalable Updates**: Real NBA updates only touch base layer
5. **Performance**: Cached totals reduce computation on reads
6. **Audit Trail**: Easy to see what changed in each world

### Use Cases Enabled
- **Solo Sandbox**: Single user creating "what-if" scenarios
- **Multiple Worlds**: Same user exploring different strategies simultaneously
- **Branching**: Fork from any point in NBA season (opening night, trade deadline, etc.)
- **Preservation**: Old worlds remain intact even as real NBA data updates
- **Future Multiplayer**: Foundation supports multi-user league mode
