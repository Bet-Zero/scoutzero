# CAP SHEET: TPE Expiration Automation (Phase 1)

## GOAL

Automate the expiration of Trade Exceptions (TPEs) during the season advance workflow in Architect Worlds so that invalid TPEs are removed from the team state and UI without requiring read-time filtering.

## STRATEGY

**Option 1 — On-Advance Cleanup**: TPEs are filtered during the transition from Season X to Season Y.

## PHASE 1: Execution (Core Logic)

**Scope**: Architect Worlds season advance only (no base collections).

### 1. Core Logic (`processTradeExceptions`)

- **Location**: `src/features/architect/utils/seasonManager.js` (or helper)
- **Behavior**:
  - Input: `tradeExceptions` list, `toSeason` context.
  - Logic:
    - Determine `seasonStartBoundary` (July 1 of `toSeason` year).
    - Filter TPEs: Keep if `expiryDate >= seasonStartBoundary`.
    - Support `expiresOn` and `expiryISO`.
  - Output: `activeTPEs`, `expiredTPEs`.

### 2. Wiring (`processTeamSeasonTransitionWithOptions`)

- **Location**: `src/features/architect/utils/seasonManager.js`
- **Actions**:
  - Invoke `processTradeExceptions`.
  - Update `team.tradeExceptions = activeTPEs`.
  - Add `expiredTPEs` to transition summary.
- **Constraint**: Operate only on world overlay teams.

### 3. UI Updates (`SeasonAdvanceModal.jsx`)

- **Location**: `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
- **Actions**:
  - Display "Expired Trade Exceptions" in the summary/complete step.
  - List team, amount, and expiry date.

### 4. Schema Hygiene

- **Location**: `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
- **Actions**:
  - Update `createTPE` to write `expiresOn` (ISO) as canonical.
  - Keep `expiryISO` for now (backward compat).

### 5. Validation

- **Tests**: `src/tests/architect/utils/seasonManager.tpe.test.js`
- **Scenarios**:
  - Expiry < July 1 (removed)
  - Expiry > July 1 (kept)
  - Expiry == July 1 (kept/removed defined behavior)

## CHANGELOG

- **[PENDING]** Implementation of Phase 1
