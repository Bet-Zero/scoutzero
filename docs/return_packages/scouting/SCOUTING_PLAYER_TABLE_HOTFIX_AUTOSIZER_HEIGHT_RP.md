# Return Package: Player Table AutoSizer Height Hotfix

## Overview

Fixed a critical layout issue where `AutoSizer` was measuring 0 height, causing the Player Table to render blank rows. The issue was due to the flex container structure preventing height from being passed down correctly.

## Changes

### `src/features/table/PlayerTable/index.jsx`

- **Wrapper Refactor**:
  - Modified the max-width wrapper (line 146):
    - Changed from `flex-shrink-0` to `flex flex-col flex-1 min-h-0`.
    - This allows the wrapper to fill the available vertical space provided by its parent.
- **Table Nesting**:
  - Moved the table container (previously a sibling of the wrapper) **inside** the wrapper.
  - Structure changed from:

    ```
    Parent (Fixed Height)
      -> Wrapper (Header info)
      -> Table (Flex-1)
    ```

    To:

    ```
    Parent (Fixed Height)
      -> Wrapper (Flex-1, Max-W 1100px)
         -> Header info
         -> Table (Flex-1)
    ```

  - This structure ensures the table strictly respects the `max-w-[1100px]` constraint while also receiving the full remaining height from the flex chain, ensuring `AutoSizer` measures a valid height.

## Validation

### Automated

- `npm run build`: **PASSED** (Exit Code 0).

### Manual Verification Required

1. Open **Player Database** (Scouting) page.
2. **Visual Check**: Confirm that player rows are now visible and not blank.
3. **DevTools Check**:
   - Inspect the table container.
   - Verify that the `AutoSizer` container (or the table list div) has a computed height of `> 300px` (likely `~700-900px` depending on screen size).
