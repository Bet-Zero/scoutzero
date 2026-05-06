# Summary: 05-SAVE-LOAD-LOGIC.md

## Purpose

Provides complete implementation guide for reading data from and writing data to Firestore for both team-level and player-level operations.

## Key Points

### Reading Data (Load Logic)

**Pattern**: World Snapshot → Parent Snapshot → Base (fallback chain)

**Important**: Do NOT read from `/players_v2` in Architect. Use `/architect/basePlayers` exclusively.

**getTeam() function**:

1. If no worldId, read from `/architect/baseTeams/{teamCode}`
2. Try current world snapshot at `/architect_worlds/{worldId}/teams/{teamCode}`
3. If not found, recursively check parent world
4. Fall back to base

**getPlayer() function**:

1. If no worldId, read from `/architect/basePlayers/{playerId}`
2. Try world-specific player override at `/architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`
3. If override exists, merge with base player data
4. Try parent world recursively
5. Fall back to base

**getLeague() function** (optimized for 30 teams):

- Batch read world snapshots first
- Fill gaps from base (or parent) for unmodified teams
- **Performance**: 30 queries regardless of how many teams modified (2 world + 28 base typical)

**Draft pick handling**: Keep complete structure in memory (status, stepienEligible, tradeable, isSwap, swapDetails, dependsOn, conveyanceObligation, conditions, route/via, metadata) for downstream evaluators.

### Writing Data (Save Logic)

**Team-Level Operations**:

1. **Execute Trade**:
   - Load both team states via getTeam()
   - Validate trade using CBA rules
   - Update rosters (remove/add players)
   - Recalculate cap totals
   - Update source metadata (type: "world-snapshot")
   - Atomic batch write (2 teams + metadata update)

2. **Sign Free Agent**:
   - Load team state
   - Validate signing (cap space, exception availability)
   - Update roster, exceptions if used (MLE triggers hard cap)
   - Remove cap hold if player had one
   - Recalculate totals
   - Create/update player contract
   - Atomic batch write (team + player + metadata)

3. **Waive Player**:
   - Load team and player data
   - Calculate dead cap (stretch formula if applicable)
   - Update roster (remove player), add dead cap entry
   - Recalculate totals
   - Atomic batch write (team + metadata)

**Player-Level Operations**:

1. **Contract Extension**:
   - Load player data
   - Validate extension using CBA rules
   - Create player override with only changed fields (new extension years)
   - Update team snapshot if trade eligibility changes
   - Atomic batch write (player override + team + metadata)

2. **Pick Up/Decline Option**:
   - Load player data, find option year
   - Create player override with updated guarantee status and null option
   - If declined, add cap hold for upcoming free agency
   - Atomic batch write (player override + team if needed + metadata)

### World Management

**Create World**:

- Generate unique worldId
- Create metadata document with parentWorldId (null for root)
- Update parent's childWorlds array if branching
- **No team snapshots created yet** (copy-on-write)

**Advance Season**:

- Update currentSeason in metadata
- For each modified team: process contracts, remove expired, handle options, add empty roster charges if under 12
- Recalculate totals with new season
- Atomic batch write (all modified teams + metadata)

**processSeasonTransition() function**:

- Remove players whose contracts expired
- Auto-decline non-guaranteed contracts (add to cap holds if Bird rights)
- Add empty roster charges if roster < 12
- Recalculate totals for new season

### Key Patterns

**Reading**:

- Always try world first, then parent, then base
- Use batch reads for league view (30 teams at once)
- Merge player overrides with base player data

**Writing**:

- Always use atomic batches (all-or-nothing)
- Update metadata on every modification
- Recalculate totals after roster changes
- Only write what changed (snapshots or overrides)

**Performance**:

- Reads: 30 queries max for league view
- Writes: 2-3 docs typical (trade = 2 teams + metadata)
- Storage: 100-200 KB per world (only modified teams)

## Action Items

- Implement fallback chain for getTeam() and getPlayer()
- Build atomic batch write operations
- Create cap total recalculation function
- Implement season transition logic with contract processing
- Add player override merge logic
