# SCOUTING_PLAYER_TABLE_HOTFIX_TABLE_NOT_LOADING_RP

**DATE**: 2026-01-27
**STATUS**: DEPLOYED

## 1. Summary

Fixed a critical rendering bug where the Player Table appeared blank after the Phase 1 virtualization update. The issue was due to the list container having an effective height of 0, causing `AutoSizer` to render with 0 height.

## 2. Root Cause

The parent container's height class used an invalid Tailwind arbitrary value syntax for `calc()`.

- **Invalid**: `h-[calc(100vh-100px)]` (missing spaces around operator, invalid CSS)
- **Result**: The browser discarded the height rule, causing the container to collapse to height 0 (or auto), preventing `AutoSizer` from measuring available space.

## 3. Files Changed

### `src/features/table/PlayerTable/index.jsx`

#### Fix: Corrected CSS syntax

```jsx
// Before
<div className="... h-[calc(100vh-100px)] lg:h-[calc(100vh-80px)] ...">

// After (Using underscores for spaces in Tailwind arbitrary values)
<div className="... h-[calc(100vh_-_100px)] lg:h-[calc(100vh_-_80px)] ...">
```

#### Cleanup

Removed temporary debug logging `console.log('AutoSizer Dims:', ...)` as measurement is now correct.

## 4. Validation Results

| Step | Status | Notes |
| :--- | :--- | :--- |
| **Rows Visible** | ✅ PASS | `AutoSizer` now receives correct height from parent. |
| **Filtering** | ✅ PASS | Search and filters update the virtualized list instantly. |
| **Overlay Drawer** | ✅ PASS | `InnerElement` positioning works; drawer aligns with rows. |
| **Layout** | ✅ PASS | Verified `flex-1 min-h-0` is present and functional. |
| **Console** | ✅ PASS | No errors or warnings from `AutoSizer`. |

## 5. How to Verify

1. Open the **Player Database** page.
2. Confirm the table immediately renders rows (no longer blank).
3. Open DevTools and verify the `list outer` container has a computed height > 0 (e.g., ~900px).
