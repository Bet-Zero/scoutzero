# PST PHASE 8: ENTITLEMENT ASSETS MASTER SPEC

**Status**: ACTIVE (Phase 8.1 Implemented)
**Context**: Defines the "Entitlement Asset" — the atomic, tradeable unit in the Trade Machine.

## 1. Core Concepts

The Trade Machine distinguishes between the **Physical Slot** and the **Tradeable Right**.

### 1.1 Base Pick (Physical Slot)

- **Definition**: The immutable, 1-to-1 slot in the draft order (e.g., `DAL_2029_1st`).
- **Persistence**: ALWAYS exists. There are exactly **480** Base Pick assets in the system (30 teams *2 rounds* 8 years).
- **Tradeability**: Base Picks are never traded directly in Trade Machine UI/logic. Trading occurs via Entitlement Assets (including `pick_ownership` wrappers).

### 1.2 Entitlement Asset

- **Definition**: The tradeable legal right held by a team.
- **Relationship**: Sits "on top" of Base Picks. A team trades Entitlements, not Base Picks directly.
- **Varieties**:
  1. **Pick Ownership**: Simple title to a specific slot (e.g., "Owns DAL 2029 1st").
  2. **Conveyance Right**: Right to receive a result from a pool (e.g., "Most Favorable of X/Y").
  3. **Swap Right**: Right to *exercise an option* to exchange picks.

---

## 2. Entitlement Asset Schema

The `EntitlementAsset` is the only object exposed to the Trade Machine UI.

```typescript
type EntitlementKind = 'pick_ownership' | 'conveyance_right' | 'swap_right';
type PhysicalSlotStatus = 'clean' | 'pooled' | 'encumbered';

interface EntitlementAsset {
  // === IDENTITY ===
  id: string;                      // Deterministic ID (ent:{holder}:{year}:{round}:{kind}:{hash})
  holderTeam: TeamCode;            // The team that can currently trade this asset
  
  // === CORE PROPERTIES ===
  seasonYear: number;              // e.g., 2029
  round: 1 | 2;
  kind: EntitlementKind;
  description: string;             // Human-readable summary
  
  // === VARIANT FIELDS ===
  
  // 1. PICK_OWNERSHIP (The "Base Pick" wrapper)
  underlyingPickId?: string;       // The physical slot ID (e.g. "HOU_2029_1st")
  // IMPORTANT (pick_ownership semantics):
  // holderTeam = current controller/trade seat for this physical slot.
  // If underlyingStatus is "pooled" or "encumbered", holderTeam is NOT guaranteed final resolved ownership.
  // Final resolution is determined later by conveyance_right / swap_right assets.
  underlyingStatus?: PhysicalSlotStatus; // e.g. "pooled" if this slot is part of a conveyance
  coveredByEntitlementIds?: string[]; // IDs of Conveyance/Swap rights that sit on top of this slot

  // 2. CONVEYANCE_RIGHT (Pooled result)
  poolUnderlyingPickIds?: string[]; // IDs of all picks in the pool (e.g. ["DAL_2029_1st", "PHX_2029_1st"])
  receivesRank?: number[];         // 1-based rank received (e.g. [1] = Most Favorable)
  receivesComparator?: string;     // "more_favorable" | "less_favorable"

  // 3. SWAP_RIGHT (Option)
  swapControllerPickId?: string;   // The pick the holder currently owns and would trade away
  swapTargetDefinition?: string;   // Description of the target (e.g. "Lesser of DAL/PHX")
  
  // === METADATA ===
  metadata?: {
      source: string;              // Provenance (e.g. "PST Phase 7 Ledger")
  };
}
```

---

## 3. Entitlement Kinds & Generation Rules

### 3.1 Pick Ownership (Physical)

- **Generation Rule**: Generated 1-to-1 for EVERY pick in the `pst_pick_ledger` (480 total).
- **Behavior**:
  - If the pick is simple (no complex conditions), it appears as a standard tradeable pick.
  - If the pick is involved in a complex pool, it is marked `underlyingStatus: 'pooled'` or `'encumbered'` and may be hidden or grouped in the UI, superseded by the Conveyance/Swap rights.

### 3.2 Conveyance Right (Pooled)

- **Generation Rule**: Generated when a team receives a specific rank from a pool of picks.
- **Example**: "Most favorable of DAL, PHX".
- **Function**: Represents the guaranteed receipt of *one* pick from the pool.

### 3.3 Swap Right (Option)

- **Generation Rule**: Generated when a team holds an explicit option to exchange picks.
- **Function**: Represents the *potential* to improve position. Does not guarantee a pick itself, but sits alongside a Pick Ownership or Conveyance Right.

---

## 4. The HOU 2029 Example (Separable Rights)

This scenario defines the standard for complex three-way pooled rights.

**Scenario**: Houston controls its own 2029 1st, plus rights involving DAL and PHX (via BKN).
**Incorrect Interpretation**: "Houston owns 3 picks" or "Houston owns a single complex 3-way object".
**Correct Spec Interpretation**: Houston owns **TWO** distinct, separable tradeable rights (plus their original slot).

### The Asset Set

#### 1. Conveyance Right ("The Good One")

*HOU receives the best of the external picks.*

- **Kind**: `conveyance_right`
- **Description**: "Most favorable of DAL, PHX"
- **Pool**: `[DAL_2029_1st, PHX_2029_1st]`
- **Rank**: `[1]` (Best)

#### 2. Swap Right ("The Protection")

*HOU can swap their own pick for the better of the remaining external pick.*

- **Kind**: `swap_right`
- **Description**: "Swap Right: HOU 2029 1st ↔ (Less favorable of DAL, PHX)"
- **Controller**: `HOU_2029_1st`
- **Target**: "Less favorable of DAL, PHX"

#### 3. Defining the Base Picks (Physical Slots)

- `HOU_2029_1st`: Exists. Status: `encumbered` (Subject to the Swap).
- `DAL_2029_1st`: Exists. Status: `pooled` (Covered by Conveyance).
- `PHX_2029_1st`: Exists. Status: `pooled` (Covered by Conveyance).

**Trade Machine Result**: HOU sees two "chips" on the table: The **DAL/PHX Best** asset, and the **Swap Option** asset.

---

## 5. Trade Machine Integration

### 5.1 What Appears in UI

The Trade Machine should iterate through the **Entitlement Assets**:

1. **Display** all `conveyance_right` assets as "Conditional Picks".
2. **Display** all `swap_right` assets as "Swap Options".
3. **Display** `pick_ownership` assets **UNLESS** they are marked `pooled` or `encumbered` in a way that hides them (UI logic can filter based on `underlyingStatus` or simply show everything and let the user understand the encumbrance).
   - *Default Guidance*: Hide `pooled` base picks because they are represented by the Conveyance Right. Show `encumbered` picks but visually link them to the Swap Right if possible.

### 5.2 Resolution Logic

During Lottery Simulation (Resolution Phase):

1. **Determine** final order of all Base Picks.
2. **Resolve** **Conveyance Rights**: Assign the specific slotted Base Pick to the holder (e.g., DAL lands #5, PHX lands #12 -> HOU gets #5).
3. **Resolve** **Swap Rights**: Execute swaps if favorable.

---

## 6. Glossary

| Term | Definition |
|------|------------|
| **Base Pick** | The physical slot in the draft (e.g. Pick #1-60). Immutable ID. |
| **Entitlement** | The tradeable object. Can be ownership, conveyance, or swap. |
| **Pool** | A group of Base Pick IDs whose order determines distribution. |
| **Encumbered** | A Base Pick that is subject to a Swap Right. |
| **Pooled** | A Base Pick that is part of a Conveyance Right pool. |
