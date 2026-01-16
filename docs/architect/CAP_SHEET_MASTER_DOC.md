# CAP SHEET / CAP TABLE — MASTER DOC

**STATUS:** ACTIVE | **TYPE:** SOURCE OF TRUTH (SSOT) | **LAST UPDATED:** 2026-01-16

## A) Purpose + Scope

This document serves as the authoritative source of truth for the technical implementation of the Cap Sheet / Cap Table feature. It defines the data doctrine, storage schemas, computation pipelines, and critical risks associated with cap management. All future development must align with the patterns defined here to avoid state de-synchronization.

## B) Definitions & Requirements

### Definitions

- **Cap Sheet:** The detailed, interactive view of a specific team's salary cap situation for a specific season (or multi-year window). It allows for "what-if" manipulations (waiving players, stretching provisions, signing free agents).
- **Cap Table:** a multi-year obligations/flexibility view for a single team (year-by-year salary, options/guarantees, dead money schedule, FA years).

> *Note:* If a multi-team summary view is required, it is a separate "League View" surface, not the Cap Table.

### Requirement: Standalone UX

**Standalone UX; world-backed under the hood.**
The user typically views a "Cap Sheet" as a persistent tool for a team. The user does NOT need to manually manage "Worlds" or "Save Files" to use the Cap Sheet. However, technically, the data reality uses `architect_worlds` as the writable overlay layer. The UI must abstract the "World" management away from the user, automatically creating or retrieving the appropriate `type: 'capSheet'` world for the target team.

## C) Data Doctrine

**Pattern:** `Base (Read-Only) → World (Writable Overlay) → Computed (Ephemeral)`

1. **Base (Read-Only):** The ground truth from the scraper/API. Never written to by the app.
2. **World (Writable Overlay):** The only layer where user changes live. Acts as a diff/patch over the base.
3. **Computed (Ephemeral):** Totals and aggregates (Cap Space, Tax Apron status, etc.).

> **CRITICAL VIOLATION:** Storing computed totals (e.g., "Total Cap Space") in the database is strictly forbidden. All totals must be computed on the fly from the Base + World state to ensure consistency.

## D) Canonical Collections + Schemas

### 1. Base Data Collections (Read-Only)

- **Teams:** `architect_baseTeams`
  - *Source:* `src/data/firestorePaths.js`
  - *Contains:* Team metadata, roster IDs, draft picks, base cap holds.
- **Players:** `architect_basePlayers`
  - *Source:* `src/data/firestorePaths.js`
  - *Contains:* Canonical contracts, bio, trade eligibility.

### 2. Plan Collections (Writable Overlay)

- **World Container:** `architect_worlds/{worldId}`
  - *Metadata:* `worldId`, `createdBy`, `rulesProfile`, `type` (proposed: `'capSheet'`).
- **Team Overlay:** `architect_worlds/{worldId}/teams/{teamCode}`
  - *Contains:* Snapshot overlay: roster changes, waived contracts, exception usage.
- **Player Overlay:** `architect_worlds/{worldId}/players/{playerId}`
  - *Contains:* Contract overrides, edited salaries, notes.

## E) Loading Pipeline SSOT

**Primary Loader:** `src/features/architect/utils/worldTeamData.ts`

- **Mechanism:** Implements the `Fallback` pattern: Look for data in World → if missing, return Base.

## F) Computation SSOT

**Canonical Computation Logic:** `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

- **Role:** The single function responsible for calculating Team Salary, Cap Space, Dead Money, and Apron Hard Caps.
- **Rule:** **No duplicate formulas.** Any feature needing these numbers must import this function or a hook that wraps it. Do not re-implement `salary + bonus` math in UI components.

## F.1) SSOT Output Contract (CapReport / CapTableReport)

This structure represents the canonical output of `computeTeamCapTotals.js`.

### Canonical Object: `TeamCapTotals`

```javascript
{
  // Observed from computeTeamCapTotals.js:
  yearKey: number,             // Season END year (e.g. 2026)
  playersTotal: number,        // Sum of active roster cap hits
  deadMoneyTotal: number,      // Sum of waived + stretched + flat dead money
  capHoldsTotal: number,       // Sum of active, unsigned cap holds
  incompleteChargesTotal: number, // Roster checks (min roster size)
  
  totalCapAllocations: number, // players + dead + holds + incomplete
  
  salaryCap: number,
  firstApron: number,
  secondApron: number,
  
  deltas: {
    vsCap: number,         // total - cap (negative = room)
    vsFirstApron: number,  // total - apron1 (negative = room)
    vsSecondApron: number  // total - apron2 (negative = room)
  },
  
  _meta: {
    source: 'computeTeamCapTotals',
    seasonKey: string      // e.g. "2025-26"
  }
}
```

### Required Fields for Consumers

1. **Cap Sheet Headline Tiles**:
    - `deltas.vsCap` (Cap Room/Over)
    - `deltas.vsFirstApron` (Apron Room)
    - `deltas.vsSecondApron` (Apron Room)
    - `totalCapAllocations` (Total Cap Hit)

2. **Trade Machine (CapImpactTiles)**:
    - `totalCapAllocations` (Total Cap)
    - `deltas.vsCap` (Cap Space)
    - `deltas.vsFirstApron`
    - `deltas.vsSecondApron`

## G) Known Consumers

The following components currently consume cap data and must be aligned to the SSOT:

1. `src/features/architect/capSheet/CapSheet/CapSheet.jsx` (Main UI display)
2. `src/features/architect/tradeMachine/CapImpactTiles.jsx` (Trade Machine display tile)

## G.1) Wiring Map Rules — VERIFIED (Phase 4)

**Rule:** Consumers must never compute payroll, dead money, or cap room locally. They must accept a `TeamCapTotals` object (or compute it once via the SSOT function) and read from it.

| Surface | Component | Metric(s) | Source | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Cap Sheet** | `CapSummaryTiles` | Room, Aprons, Total | `totals` prop from parent | ✅ **VERIFIED** (Phase 1) |
| **Cap Sheet** | `CapSheet` (Grid) | Totals Row | `computeTeamCapTotals()` | ✅ **VERIFIED** (Phase 1) |
| **Trade Machine** | `CapImpactTiles` | Room, Aprons | `computeTeamCapTotals()` | ✅ **VERIFIED** (Phase 4) |
| **Trade Machine** | `TradeTeamCard` | Total Salary | `computeTeamCapTotals()` | ✅ **VERIFIED** (Phase 1/4) |

## H) Duplicate Computation Risks (Critical)

The following paths currently contain logic that risks de-synchronization with the central SSOT. They must be refactored to consume `computeTeamCapTotals.js`.

| Severity | File Path | Function / Issue |
| :--- | :--- | :--- |
| **High** | `src/features/architect/utils/salaryUtils.js` | ~~Duplicate~~ → **Converted to SSOT wrapper in Phase 2** |
| **Medium** | `src/features/architect/utils/salaryUtils.js` | ~~Duplicate~~ → **Converted to SSOT wrapper in Phase 2** |
| **High** | `src/features/architect/hooks/useTradeMachine.js` | ~~Local inline duplicate~~ → **Replaced with SSOT in Phase 2** |
| **Medium** | `src/features/architect/hooks/useTradeMachine.js` | ~~Local inline duplicate~~ → **Replaced with SSOT in Phase 2** |
| ~~**High**~~ | ~~`src/features/architect/utils/worldlessBaselineSalary.js`~~ | **DELETED in Phase 3** |
| **High** | `src/features/architect/capSheet/CapSheet/CapSheet.jsx` | ~~UI-level duplicate math~~ → **Wired to SSOT in Phase 1** |

## I) Cap Sheet World Schema

To support the "Standalone" requirement, Cap Sheets are specialized Worlds.

**Schema:** `architect_worlds/{worldId}`

- `type`: `'capSheet'`
- `targetTeam`: `{teamCode}` (e.g., 'LAL')
- `metadata`: Standard world metadata (plus `type` field to filter cap sheets from trade scenarios in dashboard).

**Subcollections:**

- `teams/{targetTeam}`: Stores the team-specific manipulations.
- `players/{playerId}`: Stores contract overrides (match repo reality).

## J) Open Questions / Unknowns

1. **Rules Profile:** Does the Cap Sheet defaulting to `architect_worlds` inherit a standard rules profile, or must it be explicitly set?
2. **World Lifecycle:** Specifically, how does the application determining "loading" a cap sheet for the first time? Does it create on demand? (To be verified in Standalone UX Preflight).

## K) Phase Plan

### Phase 0: Preflight Findings (Completed)

**Summary:** The codebase currently has fragmented "sources of truth" for cap math.

1. **Duplicate Inventory:** We found 5+ distinct implementations of `payroll = sum(players) + deadMoney`.
    - `src/features/architect/utils/capTotals/computeTeamCapTotals.js` (THE SSOT)
    - `src/features/architect/utils/salaryUtils.js` (Legacy utils)
    - `src/features/architect/hooks/useTradeMachine.js` (Inline local math)
    - `src/features/architect/capSheet/CapSheet/CapSheet.jsx` (UI local math)
    - `src/features/architect/utils/worldlessBaselineSalary.js` (Parallel "worldless" math)

2. **`worldlessBaselineSalary.js` Disposition:**
    - **DELETED in Phase 3** (2026-01-16). File and associated tests removed.
    - Was redundant—`computeTeamCapTotals.js` safely handles data without World wrappers if passed a basic team object.

3. **Missing Fields:** `computeTeamCapTotals` is robust but lacks `incompleteChargesTotal` (hardcoded to 0). This is fine for now but should be noted.

### Phase 1: SSOT Consolidation (Next Steps)

1. **Refactor Consumers:** Update `CapSheet.jsx` and `TradeTeamCard` to implementation `computeTeamCapTotals`.
2. **Delete Duplicates:** Remove `salaryUtils.js` cap logic (or redirect to SSOT) and delete `worldlessBaselineSalary.js`.
3. **Strict Wiring:** Ensure `useTradeMachine` does not compute its own payrolls.
