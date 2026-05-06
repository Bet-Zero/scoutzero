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

- Player identity (playerId, displayName, teamCode, teamName)
- Bio (position, height, weight, age, experience, shoots, draft fields)
- Contract summary (type, signing details including executive, duration, financial totals)
- **Per-season breakdown** (salariesByYear array with season format "YYYY-YY"):
  - season, salary, capHit, guaranteed, guaranteedAmount, option, optionUsed, optionDecisionDate, tradeBonus, incentives, guaranteeSchedule, voidedByExtension, voidedOn
- Trade clauses (NTC, trade kicker, restrictions)
- Bird rights (status, yearsOfService, yearsWithTeam)
- Free agency (type, year, capHold, qualifyingOffer, earlyTerminationOption, hasOption, optionYear, optionType)
- Trade eligibility (canBeTradedNow: null, restrictedUntil, reason, rules)
- Contract metadata (isMaxContract, maxType, estimatedCapPercentage, superseded fields)
- Future contract (optional extension that hasn't started yet)
- Representation (agent, agency)

### Critical Schema Changes from Current

1. **Year Format**: Change from `year: 2026` to `season: "2026-27"` everywhere
2. **New Fields Added**:
   - `contract.signingExecutive` (GM/executive name)
   - `contract.yearsOfService` (extension eligibility)
   - `contract.isRookieScale` (poison pill logic)
   - `salariesByYear[].capHit` (differs from salary with incentives)
   - `salariesByYear[].tradeBonus` (per-year kicker breakdown)
   - `salariesByYear[].optionUsed` and `optionDecisionDate` (option decisions)
   - `salariesByYear[].guaranteeSchedule` (guarantee milestones)
   - `salariesByYear[].voidedByExtension` and `voidedOn` (voided years)
   - `freeAgency.hasOption`, `optionYear`, `optionType` (option tracking)
   - `contract.isMaxContract`, `maxType`, `estimatedCapPercentage` (max contract tracking)
   - `contract.supersededIn`, `supersededByContractRef`, `supersedesContractRef` (extension relationships)
   - `futureContract` (optional next contract)
   - `representation.agent`, `representation.agency` (agent info)
   - `bio.shoots`, `bio.draftYear`, `bio.draftRound`, `bio.draftPick`, `bio.draftedBy` (bio fields)

### World Metadata Document (`/architect_worlds/{worldId}`)

**Size**: ~2KB per world
**Essential Fields**:

- World identity (worldId, worldName, description)
- Ownership (createdBy, createdAt, lastModifiedAt)
- Current state (currentSeason, baselineSeason)
- Branching (parentWorldId, branchedFrom, childWorlds)
- Modifications tracking (modifiedTeams, actionCount, lastAction)
- Tags and flags (isArchived, isFavorite)

### World Team Snapshot (`/architect_worlds/{worldId}/teams/{teamCode}`)

**Size**: ~50KB per modified team
**Content**: Same structure as base team document, but represents modified state
**Key Difference**: Source metadata shows it's a world snapshot with worldId and generation timestamp

### World Player Override (`/architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`)

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

### Implementation Available in `/team-scrape` Folder

**Complete working implementation exists with exact field structure:**

- ✅ Team scraper outputs match BaseTeamDoc schema
- ✅ Draft picks scraper provides comprehensive pick structure with status, swaps, Stepien rules, conditions, routing
- ✅ Merge script combines both into final format ready for `/architect/baseTeams`
- ✅ Sample merged files show exact structure:
  - `team-scrape/review_and_merge/out_merged_samples/LAL_merged.json` - Complete Lakers example with roster, cap holds, exceptions, totals, draft picks
  - `team-scrape/review_and_merge/out_merged_samples/all_teams_merged.json` - 5 teams combined showing format consistency

**Key structure details from samples:**

- Roster: Array of `{displayName, sourceUrl}` objects
- Cap holds: Categorized by type (RFA, UFA, draft picks)
- Exceptions: MLE, BAE, TPE with usage tracking
- Totals: 20+ cap fields (salary, cap space, tax, aprons, hard cap)
- Draft picks: Organized by status (incoming, outgoing, own, contested) with full metadata
- Sources: Data lineage tracking for salary and draft pick sources

## Action Items

- Use existing `/team-scrape` merge script to generate all 30 team documents
- Upload merged outputs to `/architect/baseTeams` collection in Firestore
- Validate data accuracy against samples in `team-scrape/review_and_merge/out_merged_samples/`
- Implement merge logic for player overrides (player-level contracts handled separately)
