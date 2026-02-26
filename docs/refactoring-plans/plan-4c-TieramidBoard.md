# Refactoring Plan 4C: Decompose `TieramidBoard.jsx`

## Instructions for Cursor

Follow these refactoring instructions exactly. This is a pure structural refactor — no logic changes. The visual layout and behavior must remain identical.

**Rules:**

- All new files must be `.ts` / `.tsx`
- Use `@/` import aliases (maps to `src/`)
- Use named exports only
- Keep each component under 200 lines
- After completing, run the validation commands listed at the end
- Update ALL imports across the entire codebase that reference moved/renamed files, including test files

---

## What We're Refactoring

**File:** `src/features/tierMaker/TieramidBoard.jsx` (1,057 lines)

**Why:** Mixes Firebase data fetching, persistence logic, data processing utilities, and UI rendering all in one component. Natural seams exist for extraction.

## Target Structure

```
src/features/tierMaker/tieramidBoard/
├── index.ts
├── TieramidBoard.tsx                (orchestrator, ~350 lines)
├── PyramidGrid.tsx                  (~200 lines)
├── PoolSection.tsx                  (~100 lines)
├── ControlsToolbar.tsx              (~150 lines)
├── hooks/
│   ├── useTierListPersistence.ts    (~150 lines)
│   └── useTierListData.ts           (~150 lines)
└── utils/
    └── dataProcessor.ts             (~100 lines)
```

## Step-by-Step

1. Extract `utils/dataProcessor.ts` — pure functions: `processPlayers`, `buildPlayersMap`, `normalizeRows`, `normalizeRowsForCapacity`, `getInitialRows`. These have no React or Firebase dependencies.

2. Extract `hooks/useTierListData.ts` — Firebase queries for lists, tier lists, and processed player data. Wraps `useSimplePlayerData` and other Firebase hooks. Returns `{ processedPlayers, processedPlayersMap, lists, tierLists, loading }`.

3. Extract `hooks/useTierListPersistence.ts` — save/load/create tier list logic, draft mode initialization and reporting. Returns `{ handleSave, handleLoad, handleCreate, isSaving }`.

4. Extract `PyramidGrid.tsx` — pyramid visual rendering with tiles and position controls (currently lines ~694-909). Props include `rowOrder`, `rows`, `screenshotMode`, and callbacks for `onMovePlayer`, `onRemovePlayer`, `onRenameRow`, `onMoveRowUp`, `onMoveRowDown`, `onAddRow`, `onDeleteRow`.

5. Extract `PoolSection.tsx` — pool display with place buttons (currently lines ~911-935). Props: `{ poolPlayers, screenshotMode, onAddFromPool }`.

6. Extract `ControlsToolbar.tsx` — save/load/new/add-team/add-list buttons and selectors (currently lines ~937-1005). Props include all the toolbar state and callbacks.

7. Rewrite `TieramidBoard.tsx` as orchestrator that uses the extracted hooks and renders the extracted components. It keeps row/rowOrder state and player placement logic (movePlayer, removePlayerToPool, addFromPool).

8. Create `index.ts` with `export { TieramidBoard } from './TieramidBoard'`

9. Update the import in any file that imports TieramidBoard (search the codebase for all references)

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run build
```

Also manually verify the Tier Maker page still renders, drag-and-drop works, save/load works, and screenshot mode works.
