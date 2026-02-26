# Refactoring Plan 4B: Decompose `TradeTeamCard.jsx`

## Instructions for Cursor

Follow these refactoring instructions exactly. This is a pure structural refactor — no logic changes. The visual layout and behavior must remain identical.

**Rules:**

- All new files must be `.tsx`
- Use `@/` import aliases (maps to `src/`)
- Use named exports only
- Keep each component under 200 lines
- After completing, run the validation commands listed at the end
- Update ALL imports across the entire codebase that reference moved/renamed files, including test files

---

## What We're Refactoring

**File:** `src/features/architect/tradeMachine/TradeTeamCard.jsx` (931 lines)

**Why:** Multiple responsibilities crammed into one component — salary display, tab navigation, incoming/outgoing player lists, and allowable incoming calculations.

## Target Structure

```
src/features/architect/tradeMachine/tradeTeamCard/
├── index.ts
├── TradeTeamCard.tsx                (orchestrator, ~350 lines)
├── SalaryDisplayHeader.tsx          (~200 lines)
├── AllowableIncomingPanel.tsx       (~150 lines)
├── IncomingPlayersList.tsx          (~200 lines)
└── TabNavigation.tsx                (~80 lines)
```

## Step-by-Step

1. Extract `SalaryDisplayHeader.tsx` — outgoing/incoming salary display with adjustment indicators, estimate labels, loading states, and collapsible sections. Manages its own `showOutgoing`/`showIncoming` toggle state.

2. Extract `AllowableIncomingPanel.tsx` — allowable incoming amount, salary matching rule labels, hard cap limiter status, TPE availability display. Pure display component, all data passed as props.

3. Extract `IncomingPlayersList.tsx` — incoming players list with absorption mode selector (Match/TPE/FA Exception). Delegates actions to parent callbacks.

4. Extract `TabNavigation.tsx` — Players/Picks/Exceptions tab selector with badge counts. Props: `{ activeTab, onTabChange, playersCount, picksCount, exceptionCount }`

5. Rewrite `TradeTeamCard.tsx` as orchestrator that renders: header → salary display → tabs → tab content → incoming players → allowable incoming panel

6. Create `index.ts` with `export { TradeTeamCard } from './TradeTeamCard'`

7. Update the import in any file that imports TradeTeamCard (search the codebase for all references)

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run build
npm run test:trade -- --reporter=dot
```

Also manually verify the Trade Machine still renders team cards correctly with all tabs functional.
