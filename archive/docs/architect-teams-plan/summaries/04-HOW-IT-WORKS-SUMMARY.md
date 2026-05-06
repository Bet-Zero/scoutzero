<!-- markdownlint-disable -->

# Summary: 04-HOW-IT-WORKS.md

## Purpose
Explains how the proposed Firestore schema accomplishes each of the five stated goals through specific architectural patterns and implementation details.

## Key Points

### Goal 1: Multi-Season Scenario Planning ✅
**How it works**: 
- User clicks "Next Season" button, system updates `world.metadata.currentSeason`
- For each team snapshot: remove expired contracts, process options, update guarantees, add cap holds, recalculate totals
- Empty roster charges computed dynamically when recalculating totals (not stored as capHolds)
- Contract ladders track multi-year deals with guaranteed flags for waive/cut decisions

**Example**: Non-guaranteed contract at $5M becomes $0 dead cap if waived, or $5M salary if kept

### Goal 2: Branching Decision Trees ✅
**How it works**:
- Create new world with `parentWorldId` pointing to original
- **Copy-on-write**: No team snapshots copied initially, only metadata
- First modification creates snapshots for affected teams
- Unaffected teams read from parent or base via fallback chain

**Storage efficiency example**: 
- World A (parent): 100 KB (2 teams modified)
- World B (branch): 50 KB (only 1 team updated)
- World C (branch): 50 KB (only 1 team updated)
- Total: 200 KB vs 300 KB if full copies

**Reading with branching**: Try current world → Try parent world → Fall back to base

### Goal 3: Storage Efficiency ✅
**Four optimization strategies**:
1. **Immutable base layer** (4 MB shared by all worlds, zero per-world cost)
2. **Snapshot only modified teams** (93% storage savings vs snapshotting all teams)
3. **Copy-on-write for branches** (shares parent snapshots until divergence)
4. **No player duplication** (base player docs used by reference, only override if contract changes)

**Storage math**: 75 MB (naive approach) → 9 MB (proposed approach) = 88% reduction

**Read performance**: 30 queries for league view regardless of world usage (2 world + 28 base)

### Goal 4: CBA Accuracy ✅
**Schema enables comprehensive CBA rules**:
- **Trade eligibility**: Signing date + 3 months or Dec 15 restriction
- **Base Year Compensation (BYC)**: Newly signed players traded in first year
- **Poison pill**: Rookie extensions use average of old + new salaries
- **Bird rights**: Cap holds calculated by status (Bird 1.9×, Early Bird 1.75×, Non-Bird 1.2×)
- **Exception tracking**: MLE usage triggers hard cap at First Apron
- **Salary matching**: Apron-dependent rules (stricter over first apron, aggregation prohibited over second apron)
- **Draft pick resolution**: Honor status, swaps, Stepien rules, dependencies, and conditional conveyances

### Goal 5: Data Integrity ✅
**Five integrity mechanisms**:
1. **Immutable base prevents corruption**: Firebase security rules make base collections read-only to users
2. **World isolation**: Each world has unique ID, security rules enforce ownership
3. **Audit trail**: Metadata tracks all modifications with timestamps and action descriptions
4. **Version tracking**: Base data versioned, snapshots reference base version for staleness detection
5. **Atomic operations**: Firestore batches ensure all-or-nothing commits (no partial trades)

### Complete User Flow Example
1. Create world → No snapshots yet (read from base)
2. Execute trade → Validate CBA rules, create 2 team snapshots (100KB), update metadata
3. Advance season → Update currentSeason, process contracts, recalculate cap totals
4. Branch world → Create new world with parentWorldId, no snapshots copied yet
5. Waive player in branch → Create LAL snapshot in branch (50KB), other teams read from parent

**Result**: 4.15 MB for base + 2 complete scenarios, <200ms league view, full data integrity

## Action Items
- Implement fallback chain reading (world → parent → base)
- Create atomic batch write operations for all modifications
- Build season advancement logic with contract processing
- Implement copy-on-write branching mechanism
