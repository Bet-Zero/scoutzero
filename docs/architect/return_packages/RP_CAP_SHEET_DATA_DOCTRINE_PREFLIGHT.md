# Cap Sheet - Data Doctrine Preflight - Return Package

**Status**: PREFLIGHT COMPLETE
**Date**: 2026-01-16
**Author**: Antigravity

### 1) Data Doctrine Summary

**Base (Read-Only)** → **World (Writable Overlay)** → **Computed (Ephemeral)**

- **Base**: `architect_baseTeams` and `architect_basePlayers` (Source of Truth for real life).
- **Plan/World**: `architect_worlds` (User mutations).
  - **Note**: The legacy `teamPlans` collection is dead; `architect_worlds` is the sole writable layer.
- **Computed**: All totals (salary, apron, dead money, holds) must be computed on the fly. Storing them is a "Critical Violation" of the doctrine.

### 2) Base Data Collections (Read-Only)

| Collection Name | Content | Source File |
| :--- | :--- | :--- |
| `architect_baseTeams` | Team metadata, roster IDs, draft picks, base cap holds | `src/data/firestorePaths.js` |
| `architect_basePlayers` | Canonical contracts, bio, trade eligibility | `src/data/firestorePaths.js` |

### 3) Plan Collections (Writable)

| Collection Name | Schema Shape | Notes |
| :--- | :--- | :--- |
| `architect_worlds` | Metadata: `{ worldId, createdBy, rulesProfile, type? }` | Root document. |
| `.../teams/{teamCode}` | Snapshot: `{ roster: [], waivedContracts: [], ... }` | Partial overlay of base team. |
| `.../players/{playerId}`| Snapshot: `{ contract: { ... } }` | Partial overlay of base player. |

### 4) Cap-Related Data Paths & Classification

| File | Class | Description |
| :--- | :--- | :--- |
| `src/features/architect/utils/worldTeamData.ts` | **(A/B)** | Primary loader. Implements fallback: World -> Base. |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js` | **(C)** | **Canonical SSOT** for computation. |
| `src/features/architect/capSheet/CapSheet.jsx` | **(D)** | Main UI display. |
| `src/features/architect/tradeMachine/CapImpactTiles.jsx` | **(D)** | Display tile in Trade Machine. |

### 5) Duplicate Computation Risks (Critical)

There are multiple competing sources of truth for salary/dead money logic. **These must be unified.**

| File | Duplicate Function | Conflict Risk |
| :--- | :--- | :--- |
| `src/features/architect/utils/salaryUtils.js` | `payrollForYearFromCapSheet` | **High**: Uses different field priority (`activeContracts` vs `players`). |
| `src/features/architect/utils/salaryUtils.js` | `deadMoneyForYear` | **Medium**: Logic duplicates `computeTeamCapTotals`. |
| `src/features/architect/hooks/useTradeMachine.js` | `payrollForYearFromCapSheet` | **High**: Local definition inside hook. |
| `src/features/architect/hooks/useTradeMachine.js` | `deadMoneyForYear` | **Medium**: Local definition inside hook. |
| `src/features/architect/utils/worldlessBaselineSalary.js` | `getWorldlessTeamBaselineTotal` | **High**: Claims to be SSOT for worldless, completely separate path. |

### 6) Proposed Cap Sheet Plan Schema (Versioned)

Since `architect_worlds` is the standard writable layer, a "Cap Sheet" should be a **specialized World**.

**Collection**: `architect_worlds`
**Document**: `architect_worlds/{worldId}`

```typescript
interface CapSheetWorldMetadata {
  worldId: string;
  type: 'capSheet'; // <--- DIFFERENTIATOR
  targetTeam: string; // e.g. "LAL" (Team focus)
  parentWorldId: null | string; // Cap Sheets should likely be isolated or strictly child of base
  createdBy: string;
  // ...standard world metadata fields
}
```

**Subcollections**:

- `teams/{targetTeam}`: Stores the user's manipulations for that team.
- `teams/{targetTeam}/players/*`: Stores contract overrides.

### 7) Recommendation

**Store Cap Sheets in `architect_worlds` with `type: 'capSheet'`.**

- **Why?**: Reuses the entire `loadWorldTeamData` stack (fallback logic, player overrides).
- **Avoid**: Creating a new root collection like `cap_sheets` would require duplicating the "Base -> Overlay" loading verification logic.
- **Action**: Add `type` field to `WorldMetadata` schema to filter "Cap Sheets" from "Trade Scenarios" in the dashboard.
