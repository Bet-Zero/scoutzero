# Summary: 03-TARGET-SCHEMA.md

## Purpose
Provides complete, field-by-field examples of the target Firestore data structure for the Architect Teams Plan.

## Key Points

### Base Team Document (`/architect/baseTeams/{teamCode}`)
**Size**: ~50KB per team × 30 teams = 1.5MB total
**Essential Fields**:
- Team identity (teamCode, teamName, season, conference, division)
- Roster (array of player IDs only, not full player objects)
- Dead cap (waived players with stretched payments)
- Cap holds (unsigned free agents with rights)
- Exceptions (MLE, BAE, trade exceptions with usage tracking)
- Draft picks (comprehensive structure including status, Stepien eligibility, swaps, conditions, dependencies, and routing)
- Calculated totals (salary, cap space, luxury tax, apron room, hard cap status)
- Source metadata (provider, URL, scraped timestamp)

### Base Player Document (`/architect/basePlayers/{playerId}`)
**Size**: ~5KB per player × 530 players = 2.65MB total
**Essential Fields**:
- Player identity (playerId, displayName, teamCode)
- Bio (position, height, weight, age, experience)
- Contract summary (type, signing details, duration, financial totals)
- **Per-season breakdown** (salariesByYear array with season format "YYYY-YY"):
  - season, salary, capHit, guaranteed, guaranteedAmount, option, tradeBonus, incentives
- Trade clauses (NTC, trade kicker, restrictions)
- Bird rights (status, yearsOfService, yearsWithTeam)
- Free agency (type, year, capHold, qualifying offer)
- Trade eligibility (canBeTradedNow, restrictedUntil, BYC, poison pill, aggregation rules)

### Critical Schema Changes from Current
1. **Year Format**: Change from `year: 2026` to `season: "2026-27"` everywhere
2. **New Fields to Add**:
   - `contract.yearsOfService` (extension eligibility)
   - `contract.isRookieScale` (poison pill logic)
   - `salariesByYear[].capHit` (differs from salary with incentives)
   - `salariesByYear[].tradeBonus` (per-year kicker breakdown)

### World Metadata Document (`/architect/worlds/{worldId}/metadata`)
**Size**: ~2KB per world
**Essential Fields**:
- World identity (worldId, worldName, description)
- Ownership (createdBy, createdAt, lastModifiedAt)
- Current state (currentSeason, baselineSeason)
- Branching (parentWorldId, branchedFrom, childWorlds)
- Modifications tracking (modifiedTeams, actionCount, lastAction)
- Tags and flags (isArchived, isFavorite)

### World Team Snapshot (`/architect/worlds/{worldId}/snapshot/teams/{teamCode}`)
**Size**: ~50KB per modified team
**Content**: Same structure as base team document, but represents modified state
**Key Difference**: Source metadata shows it's a world snapshot with worldId and generation timestamp

### World Player Override (`/architect/worlds/{worldId}/snapshot/teams/{teamCode}/players/{playerId}`)
**Size**: ~5KB per player
**Use Case**: Optional, only needed for player-level contract changes (extensions, option decisions)
**Content**: Only contains override fields that changed from base, merged at read time

### Storage Breakdown
- **Base Collections**: ~4 MB one-time (shared by all worlds)
- **Per World**: ~150 KB typical (only modified teams), 250 KB max
- **50 Worlds**: Base 4 MB + Worlds 7.5 MB = ~12 MB total

### Draft Pick Structure
Draft picks are stored with complete semantics including:
- Basic info (year, round, status, originalTeam, currentOwner)
- Stepien rules (stepienEligible, tradeable)
- Swaps (isSwap, swapDetails with favorable/least indicators)
- Dependencies (dependsOn, conveyanceObligation)
- Conditions (protection ranges, outcomes, recipients)
- Routing (route, via, pickJourney metadata)

## Action Items
- Update scrapers to output new season format "YYYY-YY"
- Ensure all new required fields are populated during data migration
- Implement merge logic for player overrides
