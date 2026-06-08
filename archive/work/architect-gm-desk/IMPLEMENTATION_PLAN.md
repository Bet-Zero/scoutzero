# Architect GM Desk Home Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Full Cap Table home-base experience so Architect feels like one live GM desk.

**Architecture:** Keep `GMDashboard` as the orchestration boundary, `CapSheetFull` as the dense home-base renderer, and existing action hooks/modals as mutation authorities. Add small controlled handoff contracts for free-agent options and visual change highlighting; do not move mutation logic into cockpit or cap-table UI.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Vitest, existing Architect mutation/action hooks.

## Execution Status

Completed on branch `feature/architect-cockpit-intelligence`.

| Task | Status | Commit |
|------|--------|--------|
| Data-driven Full Cap Table horizon | Complete | `4e762242` |
| Transparent non-player money detail groups | Complete | `bc4c9c3b` |
| Desk-level FA Options handoff | Complete | `2833c69b` |
| Multi-player receipt row and total highlighting | Complete | `6c551d0a` |

Implementation variance: the planned `freeAgentSurface.ts` extraction was not
needed. `FreeAgentPool.tsx` remains the single resolver owner and publishes its
already-resolved selected entries to `GMDashboard.tsx`. This keeps identity
resolution in one existing module without adding a redundant helper surface.

---

## Scope Already Covered By Current Branch

- Cockpit shell, top bar, nav rail, activity rail, selection dock.
- Full Cap Table default landing room.
- Current selected-season status in cockpit chrome.
- Row-level contract action launchers.
- Dead money and exceptions management launchers.
- Trade draft activity label.
- Applied-action receipt links to Cap/Compare/Guide.
- URL `room` and `player` sync, plus persisted season.
- League handoff bar for `/gm`.

This plan only covers the remaining home-base gaps from `GM_DESK_HOME_BASE_UX_SPEC.md`.

## Files And Responsibilities

- `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`  
  Owns full-horizon year derivation, dynamic grid templates, non-player money groups, FA Options rendering slot, and row/total highlighting.

- `src/features/architect/GMDashboard/GMDashboard.tsx`  
  Owns desk-level FA option state, focused player ids, requested FA modal handoff, and wiring into `CapTableSection` / `FreeAgencySection`.

- `src/features/architect/GMDashboard/sections/CapTableSection.tsx`  
  Forwards new home-base props into `CapSheetFull`.

- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`  
  Forwards controlled FA option props into `FreeAgentPool`.

- `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx`  
  Supports controlled selection keys and auto-opening a selected free agent after navigation from the home base.

- `src/features/architect/freeAgency/FreeAgentPool/types.ts`  
  Defines controlled selection and auto-open props.

- `src/features/architect/freeAgency/FreeAgentPool/freeAgentSurface.ts`  
  New helper module for `buildFreeAgentSurfaceEntry`, allowing both FA room and GM desk to resolve selected option entries consistently.

- `src/tests/architect/capSheetFull_homeBase.behavior.test.tsx`  
  Extends home-base behavior coverage for dynamic horizon, non-player money groups, footer totals, and highlight behavior.

- `src/tests/architect/GMDashboard.smoke.test.tsx`  
  Covers dashboard-level FA option handoff and applied-trade return behavior where existing smoke setup supports it.

---

### Task 1: Make The Full Cap Table Horizon Data-Driven

**Files:**
- Modify: `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`
- Test: `src/tests/architect/capSheetFull_homeBase.behavior.test.tsx`

- [ ] **Step 1: Add a failing dynamic-horizon test**

Add a test that renders `CapSheetFull` with one player whose contract reaches beyond the existing fixed seven-year window.

```tsx
it('extends season columns through the longest contract horizon', () => {
  const teamCapSheet = makeCapSheet({
    players: [
      makePlayer({
        id: 'long-contract',
        name: 'Long Contract',
        salariesByYear: {
          '2025-26': 10_000_000,
          '2026-27': 11_000_000,
          '2027-28': 12_000_000,
          '2028-29': 13_000_000,
          '2029-30': 14_000_000,
          '2030-31': 15_000_000,
          '2031-32': 16_000_000,
          '2032-33': 17_000_000,
          '2033-34': 18_000_000,
        },
      }),
    ],
  });

  render(<CapSheetFull teamCapSheet={teamCapSheet} currentYear={2026} />);

  expect(screen.getByText('2033-34')).toBeInTheDocument();
  expect(screen.getByText('$18,000,000')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm run test:node -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx --reporter=dot
```

Expected: FAIL because the table still renders `repeat(7, ...)` and only derives seven years from `currentYear`.

- [ ] **Step 3: Implement dynamic horizon helpers**

In `CapSheetFull.tsx`, replace fixed seven-year derivation with helpers that scan player contracts, cap holds, and dead money. Keep a seven-year minimum so existing teams do not collapse to too few columns.

```tsx
const MIN_VISIBLE_YEARS = 7;

function seasonKeyToEndYear(season: unknown): number | null {
  if (typeof season !== 'string') return null;
  const match = season.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return 2000 + Number(match[2]);
}

function collectPlayerContractEndYears(player: CapSheetFullPlayerLike): number[] {
  const years: number[] = [];
  const salaryRows = player.contract?.salariesByYear;
  if (Array.isArray(salaryRows)) {
    for (const row of salaryRows) {
      const endYear = seasonKeyToEndYear((row as { season?: unknown }).season);
      if (endYear) years.push(endYear);
    }
  }
  return years;
}

function getLatestVisibleEndYear(
  teamCapSheet: TeamCapSheetLike,
  currentYear: number
): number {
  const candidateYears = [currentYear + MIN_VISIBLE_YEARS - 1];

  for (const player of teamCapSheet.players || []) {
    candidateYears.push(...collectPlayerContractEndYears(player));
  }

  for (const hold of (teamCapSheet.capHolds || []) as CapHoldLike[]) {
    const holdYear = seasonKeyToEndYear(hold.season);
    if (holdYear) candidateYears.push(holdYear);
  }

  const deadCap = teamCapSheet.deadCap;
  if (Array.isArray(deadCap)) {
    for (const entry of deadCap as Array<{ year?: unknown; season?: unknown }>) {
      const numericYear =
        typeof entry.year === 'number' ? entry.year : seasonKeyToEndYear(entry.season);
      if (numericYear) candidateYears.push(numericYear);
    }
  }

  return Math.max(...candidateYears);
}
```

- [ ] **Step 4: Replace fixed grid classes with dynamic grid templates**

Use inline grid templates wherever the year count can vary.

```tsx
const allYears = useMemo(() => {
  const latestYear = getLatestVisibleEndYear(teamCapSheet, currentYear);
  return Array.from(
    { length: latestYear - currentYear + 1 },
    (_, index) => currentYear + index
  );
}, [teamCapSheet, currentYear]);

const playerGridTemplate = useMemo(
  () => `200px repeat(${allYears.length}, minmax(100px, 1fr))`,
  [allYears.length]
);

const capHoldGridTemplate = useMemo(
  () => `140px 60px repeat(${allYears.length}, minmax(100px, 1fr))`,
  [allYears.length]
);
```

Replace `grid-cols-[200px_repeat(7,minmax(100px,1fr))]` and `grid-cols-[140px_60px_repeat(7,minmax(100px,1fr))]` with:

```tsx
className="grid ..."
style={{ gridTemplateColumns: playerGridTemplate }}
```

and:

```tsx
className="grid ..."
style={{ gridTemplateColumns: capHoldGridTemplate }}
```

- [ ] **Step 5: Verify focused behavior**

Run:

```bash
npm run test:node -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx --reporter=dot
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx src/tests/architect/capSheetFull_homeBase.behavior.test.tsx
git commit -m "feat: derive Architect cap table horizon from team data"
```

---

### Task 2: Add Transparent Non-Player Money Detail Groups

**Files:**
- Modify: `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`
- Test: `src/tests/architect/capSheetFull_homeBase.behavior.test.tsx`

- [ ] **Step 1: Add a failing test for footer total composition**

Add a test that proves the footer total includes player salary, dead money, cap holds, and incomplete roster charges.

```tsx
it('shows canonical footer totals and expandable non-player money details', async () => {
  const user = userEvent.setup();
  const teamCapSheet = makeCapSheet({
    players: [
      makePlayer({
        id: 'p1',
        name: 'Roster Player',
        salariesByYear: { '2025-26': 10_000_000 },
      }),
    ],
    capHolds: [
      {
        playerId: 'hold-1',
        playerName: 'Cap Hold Player',
        season: '2025-26',
        amount: 5_000_000,
        type: 'FA Cap Hold',
        isSigned: false,
      },
    ],
    deadCap: [{ playerName: 'Waived Player', year: 2026, amount: 2_000_000 }],
  });

  render(<CapSheetFull teamCapSheet={teamCapSheet} currentYear={2026} />);

  expect(screen.getByLabelText(/canonical yearly totals/i)).toHaveTextContent(
    '$17,000,000'
  );

  await user.click(screen.getByRole('button', { name: /dead money/i }));
  expect(screen.getByText('Waived Player')).toBeInTheDocument();
  expect(screen.getByText('$2,000,000')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /cap hold details/i }));
  expect(screen.getByText('Cap Hold Player')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm run test:node -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx --reporter=dot
```

Expected: FAIL because dead-money detail rows are not visible on the home base.

- [ ] **Step 3: Store full yearly total breakdowns**

Replace the simple `yearTotals` map with a breakdown map.

```tsx
const yearTotalBreakdowns = useMemo(() => {
  const totals: Record<number, ReturnType<typeof computeTeamCapTotals>> = {};
  for (const year of allYears) {
    totals[year] = computeTeamCapTotals(
      teamCapSheet
        ? { ...teamCapSheet, players: teamCapSheet.players?.map((p) => ({ ...p })) }
        : null,
      year
    );
  }
  return totals;
}, [teamCapSheet, allYears]);
```

Update footer cells to read:

```tsx
${yearTotalBreakdowns[year].totalCapAllocations.toLocaleString()}
```

- [ ] **Step 4: Add a dead-money detail group**

Add `showDeadMoneyDetails` state and render rows aligned to season columns.

```tsx
const [showDeadMoneyDetails, setShowDeadMoneyDetails] = useState(false);

const displayedDeadMoney = Array.isArray(teamCapSheet.deadCap)
  ? teamCapSheet.deadCap
  : [];
```

Render a collapsible section below cap holds when `displayedDeadMoney.length > 0`.

```tsx
<section
  aria-label="Multi-year dead money detail surface"
  className="shrink-0 border-t border-cockpit-edge px-4 py-1.5"
>
  <button
    type="button"
    data-testid="cap-sheet-full-dead-money-toggle"
    onClick={() => setShowDeadMoneyDetails((value) => !value)}
    aria-expanded={showDeadMoneyDetails}
    className="flex w-full items-center gap-2 text-left group"
  >
    <span className={`text-sm text-cockpit-text-secondary transition-transform duration-200 ${showDeadMoneyDetails ? 'rotate-90' : ''}`}>
      ▶
    </span>
    <span className="text-[11px] font-semibold uppercase tracking-wider text-cockpit-text-secondary group-hover:text-cockpit-text-primary">
      Dead Money Details
    </span>
    <span className="rounded bg-cockpit-raised px-1.5 text-[10px] text-cockpit-text-secondary">
      {displayedDeadMoney.length}
    </span>
  </button>
  {showDeadMoneyDetails ? (
    <div className="max-h-[32vh] overflow-auto rounded-lg border border-cockpit-edge bg-cockpit-inlay shadow-lg">
      {/* render dynamic-grid rows here using playerGridTemplate */}
    </div>
  ) : null}
</section>
```

- [ ] **Step 5: Add an incomplete roster charge readout**

Render a compact grouped row when any `yearTotalBreakdowns[year]._meta.incompleteRosterCharge` is present.

```tsx
const hasIncompleteCharges = allYears.some(
  (year) => yearTotalBreakdowns[year]._meta.incompleteRosterCharge
);
```

The row label should be `Incomplete roster charges`; each year cell shows `incompleteChargesTotal` when non-zero and stays blank otherwise.

- [ ] **Step 6: Verify focused behavior**

Run:

```bash
npm run test:node -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx --reporter=dot
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx src/tests/architect/capSheetFull_homeBase.behavior.test.tsx
git commit -m "feat: expose non-player money on Architect home base"
```

---

### Task 3: Lift Free-Agent Queue Into Desk-Level FA Options

**Files:**
- Create: `src/features/architect/freeAgency/FreeAgentPool/freeAgentSurface.ts`
- Modify: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx`
- Modify: `src/features/architect/freeAgency/FreeAgentPool/types.ts`
- Modify: `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`
- Modify: `src/features/architect/GMDashboard/sections/CapTableSection.tsx`
- Modify: `src/features/architect/GMDashboard/GMDashboard.tsx`
- Modify: `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`
- Test: `src/tests/architect/GMDashboard.smoke.test.tsx`
- Test: `src/tests/architect/capSheetFull_homeBase.behavior.test.tsx`

- [ ] **Step 1: Add failing tests for FA Options**

In `capSheetFull_homeBase.behavior.test.tsx`, add a renderer-level test for the home-base strip:

```tsx
it('renders free-agent options separately from roster rows', () => {
  render(
    <CapSheetFull
      teamCapSheet={makeCapSheet({ players: [] })}
      currentYear={2026}
      freeAgentOptions={[
        {
          selectionKey: 'fa-1',
          playerId: 'fa-1',
          freeAgent: { id: 'fa-1', name: 'Desk Option', askingSalary: 8_000_000 },
          surfacePlayer: { id: 'fa-1', name: 'Desk Option', displayName: 'Desk Option' },
        },
      ]}
      onOpenFreeAgentOption={vi.fn()}
      onRemoveFreeAgentOption={vi.fn()}
      onLaunchFreeAgentSearch={vi.fn()}
    />
  );

  expect(screen.getByTestId('cap-sheet-full-fa-options')).toHaveTextContent(
    'Desk Option'
  );
  expect(screen.queryByRole('button', { name: /Desk Option/i })).not.toHaveAttribute(
    'data-testid',
    'cap-sheet-full-player-row-button'
  );
});
```

In `GMDashboard.smoke.test.tsx`, add a smoke test that selecting a free agent in the FA room makes that player appear in the Full Cap Table FA Options area.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm run test:node -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx src/tests/architect/GMDashboard.smoke.test.tsx --reporter=dot
```

Expected: FAIL because `CapSheetFull` does not accept or render FA Options and `FreeAgentPool` selection is still local.

- [ ] **Step 3: Extract free-agent surface helpers**

Move `normalizeLookupKey`, `getStablePlayerId`, `resolveLookupPlayer`, and `buildFreeAgentSurfaceEntry` from `FreeAgentPool.tsx` into `freeAgentSurface.ts`.

```ts
export function buildFreeAgentSurfaceEntry(
  freeAgent: FreeAgentListItem,
  playersMap: Record<string, FreeAgentLookupPlayer>
): FreeAgentSurfaceEntry {
  // move the existing implementation without behavior changes
}
```

Update `FreeAgentPool.tsx` imports:

```ts
import { buildFreeAgentSurfaceEntry } from './freeAgentSurface';
```

- [ ] **Step 4: Add controlled FA selection props**

Extend `FreeAgentPoolProps`:

```ts
selectedPlayerKeys?: string[];
onSelectedPlayerKeysChange?: (selectionKeys: string[]) => void;
requestedOpenSelectionKey?: string | null;
onRequestedOpenSelectionHandled?: () => void;
onSelectedEntriesChange?: (entries: FreeAgentSurfaceEntry[]) => void;
```

In `FreeAgentPool.tsx`, replace local-only state with controlled fallback:

```tsx
const [uncontrolledSelectedPlayerKeys, setUncontrolledSelectedPlayerKeys] =
  useState<string[]>([]);

const selectedPlayerKeys =
  controlledSelectedPlayerKeys ?? uncontrolledSelectedPlayerKeys;

const updateSelectedPlayerKeys = useCallback(
  (updater: (prev: string[]) => string[]) => {
    const next = updater(selectedPlayerKeys);
    if (onSelectedPlayerKeysChange) {
      onSelectedPlayerKeysChange(next);
    } else {
      setUncontrolledSelectedPlayerKeys(next);
    }
  },
  [onSelectedPlayerKeysChange, selectedPlayerKeys]
);
```

Emit selected entries:

```tsx
useEffect(() => {
  onSelectedEntriesChange?.(selectedEntries);
}, [onSelectedEntriesChange, selectedEntries]);
```

Auto-open requested option:

```tsx
useEffect(() => {
  if (!requestedOpenSelectionKey) return;
  const entry = entriesBySelectionKey.get(requestedOpenSelectionKey);
  if (!entry) return;
  openContractModal(entry);
  onRequestedOpenSelectionHandled?.();
}, [
  entriesBySelectionKey,
  onRequestedOpenSelectionHandled,
  openContractModal,
  requestedOpenSelectionKey,
]);
```

- [ ] **Step 5: Wire FA option state in `GMDashboard`**

Add desk-level state:

```tsx
const [freeAgentOptionKeys, setFreeAgentOptionKeys] = useState<string[]>([]);
const [freeAgentOptionEntries, setFreeAgentOptionEntries] = useState<
  FreeAgentSurfaceEntry[]
>([]);
const [requestedFreeAgentOpenKey, setRequestedFreeAgentOpenKey] =
  useState<string | null>(null);
```

Pass it through `FreeAgencySection` and `CapTableSection`.

Home-base open behavior:

```tsx
onOpenFreeAgentOption={(selectionKey) => {
  setRequestedFreeAgentOpenKey(selectionKey);
  setActiveTab('fa');
}}
onRemoveFreeAgentOption={(selectionKey) => {
  setFreeAgentOptionKeys((keys) => keys.filter((key) => key !== selectionKey));
}}
```

- [ ] **Step 6: Render FA Options in `CapSheetFull`**

Add props:

```ts
freeAgentOptions?: FreeAgentSurfaceEntry[];
onOpenFreeAgentOption?: (selectionKey: string) => void;
onRemoveFreeAgentOption?: (selectionKey: string) => void;
```

Render a compact strip above the table toolbar when options exist:

```tsx
{freeAgentOptions.length > 0 ? (
  <section
    data-testid="cap-sheet-full-fa-options"
    className="shrink-0 border-b border-cockpit-edge bg-cockpit-slab px-3 py-2"
  >
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
        FA Options
      </span>
      {freeAgentOptions.map((entry) => (
        <div
          key={entry.selectionKey}
          className="flex items-center gap-2 rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1"
        >
          <span className="text-xs text-cockpit-text-primary">
            {entry.surfacePlayer.displayName || entry.surfacePlayer.name}
          </span>
          <button type="button" onClick={() => onOpenFreeAgentOption?.(entry.selectionKey)}>
            Open offer
          </button>
          <button type="button" onClick={() => onRemoveFreeAgentOption?.(entry.selectionKey)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  </section>
) : null}
```

- [ ] **Step 7: Clear signed options after successful signing**

When `onAfterSigningComplete` fires in `freeAgencySectionSurface`, clear any selected option matching the signed player if the signing result exposes player ids. If only a generic callback is available, clear the requested/opened key on modal close after success.

Use this concrete fallback:

```tsx
onAfterSigningComplete: () => {
  if (requestedFreeAgentOpenKey) {
    setFreeAgentOptionKeys((keys) =>
      keys.filter((key) => key !== requestedFreeAgentOpenKey)
    );
    setRequestedFreeAgentOpenKey(null);
  }
  setActiveTab('capfull');
},
```

- [ ] **Step 8: Verify focused behavior**

Run:

```bash
npm run test:node -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx src/tests/architect/GMDashboard.smoke.test.tsx --reporter=dot
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/architect/freeAgency/FreeAgentPool/freeAgentSurface.ts src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx src/features/architect/freeAgency/FreeAgentPool/types.ts src/features/architect/GMDashboard/sections/FreeAgencySection.tsx src/features/architect/GMDashboard/sections/CapTableSection.tsx src/features/architect/GMDashboard/GMDashboard.tsx src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx src/tests/architect/GMDashboard.smoke.test.tsx src/tests/architect/capSheetFull_homeBase.behavior.test.tsx
git commit -m "feat: surface free-agent options on Architect home base"
```

---

### Task 4: Highlight All Committed Change Rows And Affected Totals

**Files:**
- Modify: `src/features/architect/GMDashboard/postActionHandoff/types.ts`
- Modify: `src/features/architect/GMDashboard/GMDashboard.tsx`
- Modify: `src/features/architect/GMDashboard/sections/CapTableSection.tsx`
- Modify: `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- Modify: `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`
- Modify: `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- Test: `src/tests/architect/capSheetFull_homeBase.behavior.test.tsx`
- Test: `src/tests/architect/GMDashboard.smoke.test.tsx`

- [ ] **Step 1: Add failing tests for multi-player and total highlighting**

Add a home-base renderer test:

```tsx
it('highlights every focused player and affected footer total years', () => {
  const teamCapSheet = makeCapSheet({
    players: [
      makePlayer({
        id: 'p1',
        name: 'Changed One',
        salariesByYear: { '2025-26': 10_000_000, '2026-27': 11_000_000 },
      }),
      makePlayer({
        id: 'p2',
        name: 'Changed Two',
        salariesByYear: { '2025-26': 12_000_000 },
      }),
    ],
  });

  render(
    <CapSheetFull
      teamCapSheet={teamCapSheet}
      currentYear={2026}
      highlightPlayerIds={['p1', 'p2']}
    />
  );

  expect(screen.getAllByTestId('cap-sheet-full-player-row-highlighted')).toHaveLength(2);
  expect(screen.getAllByTestId('cap-sheet-full-total-cell-highlighted').length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm run test:node -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx src/tests/architect/GMDashboard.smoke.test.tsx --reporter=dot
```

Expected: FAIL because `CapSheetFull` only accepts one `highlightPlayerId` and does not mark footer cells.

- [ ] **Step 3: Extend receipt focus to support multiple ids**

Keep `primaryPlayerIds` as the receipt source. In `GMDashboard`, derive:

```tsx
const focusedPlayerIds = useMemo(() => {
  if (deskPlayerId) return [deskPlayerId];
  return postActionReceipt.receipt?.primaryPlayerIds ?? [];
}, [deskPlayerId, postActionReceipt.receipt?.primaryPlayerIds]);

const focusedPlayerId = focusedPlayerIds[0] ?? null;
```

Use `focusedPlayerId` for single-label surfaces like `SelectionDock`, and pass `focusedPlayerIds` into cap table surfaces.

- [ ] **Step 4: Update `CapSheetFull` props and matching**

Add:

```ts
highlightPlayerIds?: string[];
```

Normalize internally:

```tsx
const focusedIds = useMemo(
  () => new Set([...(highlightPlayerIds || []), highlightPlayerId].filter(Boolean)),
  [highlightPlayerId, highlightPlayerIds]
);

const playerMatchesAnyFocus = (player: CapSheetFullPlayerLike) =>
  Array.from(focusedIds).some((id) => playerMatchesFocus(player, id));
```

Use `playerMatchesAnyFocus(player)` for row highlighting.

- [ ] **Step 5: Derive affected total years**

Add:

```tsx
const affectedTotalYears = useMemo(() => {
  const years = new Set<number>();
  for (const player of sortedPlayers) {
    if (!playerMatchesAnyFocus(player)) continue;
    for (const year of allYears) {
      const rowAmounts = getPlayerCapSheetAmountsForYear(player, year);
      if (rowAmounts.contractSlice || rowAmounts.capHit > 0 || rowAmounts.baseSalary > 0) {
        years.add(year);
      }
    }
  }
  return years;
}, [allYears, focusedIds, sortedPlayers]);
```

Footer cell class:

```tsx
const isTotalHighlighted = affectedTotalYears.has(year);
```

Add:

```tsx
data-testid={
  isTotalHighlighted
    ? 'cap-sheet-full-total-cell-highlighted'
    : 'cap-sheet-full-total-cell'
}
className={`px-2 py-2 text-center text-xs tabular-nums tracking-tight border-l border-cockpit-edge ${
  isTotalHighlighted
    ? 'bg-green-500/10 text-green-100 ring-1 ring-inset ring-green-400/30'
    : 'text-cockpit-text-primary'
}`}
```

- [ ] **Step 6: Forward highlight arrays through sections**

In `CapTableSectionProps`, include `highlightPlayerIds`. Pass to `CapSheetFull`.

For `CapSheetSection` / `CapSheet`, keep existing single-id behavior unless a matching multi-id prop is already simple to thread safely. The Full Cap Table is the primary target.

- [ ] **Step 7: Verify focused behavior**

Run:

```bash
npm run test:node -- src/tests/architect/capSheetFull_homeBase.behavior.test.tsx src/tests/architect/GMDashboard.smoke.test.tsx --reporter=dot
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/architect/GMDashboard/postActionHandoff/types.ts src/features/architect/GMDashboard/GMDashboard.tsx src/features/architect/GMDashboard/sections/CapTableSection.tsx src/features/architect/GMDashboard/sections/CapSheetSection.tsx src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx src/features/architect/capSheet/CapSheet/CapSheet.tsx src/tests/architect/capSheetFull_homeBase.behavior.test.tsx src/tests/architect/GMDashboard.smoke.test.tsx
git commit -m "feat: highlight Architect home-base change impact"
```

---

### Task 5: Final Verification And Documentation Update

**Files:**
- Modify: `src/features/architect/cockpit/README.md`
- Modify: `work/architect-gm-desk/GOAL_AND_ACCEPTANCE.md`
- Modify if generated by `npm run docs`: `docs/components/ArchitectHierarchy.md`

- [ ] **Step 1: Update working docs**

Add a short "Home-base completion notes" section to `work/architect-gm-desk/GOAL_AND_ACCEPTANCE.md`:

```md
## Home-base completion notes

- Full Cap Table horizon is derived from team data, not a fixed year window.
- FA selections from the Free Agency room surface as FA Options on the home base.
- Non-player money groups explain canonical year totals without replacing roster rows.
- Committed action focus can highlight multiple changed players and affected footer totals.
```

Update `src/features/architect/cockpit/README.md` Phase 2 notes to mark these as complete.

- [ ] **Step 2: Run validation**

Run:

```bash
npm run typecheck
npm run test:architect -- --reporter=dot
npm run build
```

Expected:

- `typecheck`: PASS.
- `test:architect`: PASS. If it exceeds 4 minutes, stop it and run the narrower focused command from Tasks 1-4 plus `npm run test:fast -- --reporter=dot`.
- `build`: PASS, with existing Vite chunk-size/browser-compat warnings allowed.

- [ ] **Step 3: Generate docs if hook did not already do it**

Only run this manually if `docs/components/ArchitectHierarchy.md` is stale after the source changes:

```bash
npm run docs
```

Expected: docs generated without errors.

- [ ] **Step 4: Commit final docs and generated artifacts**

```bash
git add src/features/architect/cockpit/README.md work/architect-gm-desk/GOAL_AND_ACCEPTANCE.md docs/components/ArchitectHierarchy.md
git commit -m "docs: update Architect GM desk completion notes"
```

---

## Final Return Package Requirements

Every completion response must include:

- Files changed.
- Validation commands actually run.
- Commands intentionally skipped and why.
- Whether Trade Machine interior remained unchanged.
- Whether any full-suite command was avoided because the prompt did not contain `RUN FULL SUITE`.
