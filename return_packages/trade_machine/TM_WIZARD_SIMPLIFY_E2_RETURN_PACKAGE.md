# TM-WIZARD-SIMPLIFY-E2 — RETURN PACKAGE (UPDATED)

**TICKET**: TM-WIZARD-SIMPLIFY-E2 — Compact Pick Right Quick Editor + Convert-to-Swap in Edit Mode  
**COMPLETED**: 2026-02-14  
**STATUS**: ✅ ALL ACCEPTANCE CRITERIA MET

---

## Summary

This execution added "Convert to Swap" functionality to the Pick Right Wizard edit mode. Users can now:

1. Click on an existing pick entitlement row and hit edit
2. See Protect + Swap action buttons in edit mode
3. Convert a non-swap entitlement to a swap_right via the "Convert to Swap" CTA

Additionally, removed all arrows (`→`) from the quick UI as per UX requirements.

---

## What the Edit-Mode Swap Button Does

### When Editing a **Non-Swap Entitlement** (e.g., `pick_ownership`):

1. **Shows "Convert to Swap" CTA**: A dedicated section with a "Convert to Swap" button appears instead of normal swap controls
2. **Clicking "Convert to Swap"**:
   - Creates a **NEW** `swap_right` entitlement document
   - Sets controller pick to the current underlying pick (the pick being traded)
   - Prefills swap fields with reasonable defaults (`swapType: 'best_of'`)
   - Calls `onDuplicateAsNew` with the new document
   - The wizard reopens in **CREATE MODE** with the prefilled swap_right document
3. **Original entitlement is NOT mutated** - it remains unchanged as `pick_ownership`

### When Editing a **swap_right Entitlement**:

- Shows normal read-only swap controls (Most favorable / Least favorable buttons)
- Controller pick is shown as read-only
- Direct editing of existing swap configuration

---

## Confirmation: Conversion Creates NEW Entitlement (No Mutation)

- ✅ The original entitlement's `kind` remains unchanged
- ✅ `handleConvertToSwap` builds a completely new document with `kind: 'swap_right'`
- ✅ The existing `onDuplicateAsNew` callback is reused, which closes the edit modal and reopens in create mode
- ✅ Tests verify: `expect(originalDoc.kind).toBe('pick_ownership')` after Convert to Swap is clicked

---

## UI Changes from This Execution

### Edit Mode Action Buttons

- **Added**: Protect + Swap buttons now visible in edit mode (previously hidden)
- **Removed**: Pool button in edit mode (stays advanced-only)

### Swap Section in Edit Mode

- When editing `pick_ownership` → Shows "Convert to Swap" CTA
- When editing `swap_right` → Shows read-only swap direction + controller pick

### No Arrow in Quick UI

- Removed `→` from "Advanced" button text (now just "Advanced")
- Updated protection preset labels:
  - `Top 4 → Unprotected` → `Top 4`
  - `Top 10 → Unprotected` → `Top 10`
  - `Lottery (14) → Unprotected` → `Lottery`

---

## Files Modified (This Execution)

| File                                                                 | Changes                                                                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx` | Added edit-mode action buttons, Convert to Swap section, removed arrow from Advanced button              |
| `src/features/architect/admin/PickRightWizardModal.tsx`              | Added `originalEntitlementKind` tracking, `handleConvertToSwap` callback, pass new props to QuickBuilder |
| `src/features/architect/admin/ProtectionLadderTemplates.ts`          | Simplified preset labels (removed arrows)                                                                |
| `src/features/architect/admin/pickEditorCopy.ts`                     | Removed arrow from `openAdvanced` label                                                                  |
| `src/tests/architect/pickRightWizard.test.tsx`                       | Added 10 new tests for Convert to Swap functionality                                                     |
| `src/tests/architect/quickBuilder.test.tsx`                          | Added 15 new tests for Convert to Swap and no-arrow constraints                                          |

---

## Test Results

```bash
npm run test -- --run src/tests/architect/pickRightWizard.test.tsx src/tests/architect/quickBuilder.test.tsx

 ✓ src/tests/architect/quickBuilder.test.tsx  (44 tests) 1952ms
 ✓ src/tests/architect/pickRightWizard.test.tsx  (31 tests | 2 skipped) 2268ms

 Test Files  2 passed (2)
      Tests  73 passed | 2 skipped (75)
```

### Key Test Cases Added

1. ✅ `edit mode shows Protect and Swap action buttons`
2. ✅ `clicking Swap when editing pick_ownership shows Convert to Swap button`
3. ✅ `Convert to Swap button triggers onDuplicateAsNew with swap_right kind`
4. ✅ `swap_right document has controller pick set to current underlying pick`
5. ✅ `editing a swap_right does NOT show Convert to Swap`
6. ✅ `original entitlement document is not mutated when Convert to Swap is clicked`
7. ✅ `create mode protect screen has no arrow`
8. ✅ `edit mode has no arrow in quick builder`
9. ✅ `Advanced button text is "Advanced" without arrow`

---

## Build Results

```bash
npm run build

✓ built in 51.46s
```

Build succeeded with no new errors.

---

## Acceptance Criteria Verification (This Execution)

| Criteria                                                                                         | Status                        |
| ------------------------------------------------------------------------------------------------ | ----------------------------- |
| Edit mode has Protect + Swap visible even when editing a pick_ownership entitlement              | ✅                            |
| "Convert to Swap" exists and creates a swap_right via duplicate-as-new (no mutation of original) | ✅                            |
| No "->" appears anywhere in quick UI                                                             | ✅                            |
| No scrolling for the quick UI surfaces (protect/swap)                                            | ✅ (compact layout preserved) |
| Tests enforce Swap presence + convert behavior                                                   | ✅                            |

---

## How It Works (Technical)

### Original Entitlement Kind Tracking

The modal tracks the original entitlement kind using a memoized value from `initialDocument`:

```typescript
const originalEntitlementKind = useMemo(() => {
  if (initialDocument && typeof initialDocument.kind === 'string') {
    return initialDocument.kind as EntitlementKind;
  }
  return '';
}, [initialDocument]);
```

This prevents the kind from changing when the wizard intent changes (which would otherwise update `formState.kind` via the sync effect).

### Convert to Swap Handler

```typescript
const handleConvertToSwap = useCallback(() => {
  if (!onDuplicateAsNew) return;

  const controllerPickId = formState.underlyingPickId ||
    `${formState.holderTeam}_${formState.seasonYear}_${formState.round}`;

  const swapDocument = {
    holderTeam: formState.holderTeam,
    seasonYear: Number(formState.seasonYear) || 2026,
    round: Number(formState.round) || 1,
    kind: 'swap_right',
    underlyingPickId: formState.underlyingPickId,
    swapControllerPickId: controllerPickId,
    swapTargetDefinition: `${formState.holderTeam} own ${...} round pick`,
    swapType: 'best_of',
    description: formState.description || '',
  };

  onDuplicateAsNew(swapDocument);
}, [formState, onDuplicateAsNew]);
```

### QuickBuilder Conditional Rendering

```tsx
{
  intent === 'create_swap' && (
    <div data-testid="quick-swap-section">
      {isEditingNonSwap && onConvertToSwap ? (
        // Convert to Swap CTA
        <div data-testid="swap-convert-section">
          <button onClick={onConvertToSwap}>Convert to Swap</button>
        </div>
      ) : (
        // Normal swap controls
        <>...</>
      )}
    </div>
  );
}
```

---

## Final Preset List

| ID                    | Label       | Description                                           |
| --------------------- | ----------- | ----------------------------------------------------- |
| `unprotected`         | Unprotected | No protection — pick conveys regardless of position   |
| `top4_unprotected`    | Top 4       | Top 4 protected first year, unprotected second year   |
| `top10_unprotected`   | Top 10      | Top 10 protected first year, unprotected second year  |
| `lottery_unprotected` | Lottery     | Lottery protected first year, unprotected second year |

---

## Previous Execution Changes (Preserved)

From earlier TM-WIZARD-SIMPLIFY-E2 work:

- Reduced preset list from 5 to 4 (removed Lottery→Top10→Unprotected)
- Made swap "Other team's pick" read-only in edit mode
- Added "Other team's pick" label replacing "Their pick"
- Added "swap with team" to banned jargon list
