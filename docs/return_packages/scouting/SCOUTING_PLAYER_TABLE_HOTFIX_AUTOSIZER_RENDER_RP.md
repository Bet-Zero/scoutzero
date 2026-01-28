# Return Package: Player Table AutoSizer Render Hotfix

## Overview

Fixed the Player Table blank render after virtualization by ensuring the list container provides measurable flex height and by adding a container-based fallback when AutoSizer reports zero dimensions. The virtualization and drawer overlay behavior remain unchanged.

## Root Cause

- The list container chain could collapse to 0 height in flex layout, causing AutoSizer to report `height = 0` / `width = 0` and render only its sizer div with no list content.
- This repo’s `react-virtualized-auto-sizer` build exports **named** `AutoSizer` only; attempting a default import breaks the production build. The fix keeps the named import to preserve build stability.

## Code Change Summary

- Added a `listContainerRef` to measure the real container size when AutoSizer reports zero.
- Simplified the list container wrapper to the required flex chain (`flex-1 min-h-0`) and made AutoSizer the direct child.
- Replaced zero-dimension rendering with container-based fallback dimensions (1100×600 default) **only** when AutoSizer returns 0.

## Fallback Behavior

If AutoSizer reports `height` or `width` as `0`, the list now renders using:

- `width = listContainerRef.current?.getBoundingClientRect().width || 1100`
- `height = listContainerRef.current?.getBoundingClientRect().height || 600`

This is **container-based**, not viewport-based, and is only used when AutoSizer returns zero.

## Key Diffs (Relevant Blocks Only)

```diff
-import React, { useState, useMemo, useCallback } from 'react';
+import React, { useState, useMemo, useCallback, useRef } from 'react';
@@
-  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
+  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
+  const listContainerRef = useRef(null);
@@
-      <div className="w-full flex-1 min-h-0 relative z-10 bg-neutral-900 overflow-hidden">
+      <div
+        ref={listContainerRef}
+        className="w-full flex-1 min-h-0 relative z-10 bg-neutral-900 overflow-hidden"
+      >
@@
-            <AutoSizer>
-              {({ height, width }) => (
-                <List
-                  height={Math.max(height || 0, 400)}
-                  width={Math.max(width || 0, 320)}
-                  itemCount={filteredPlayers.length}
+            <AutoSizer>
+              {({ height, width }) => {
+                const containerRect =
+                  listContainerRef.current?.getBoundingClientRect();
+                const fallbackHeight = containerRect?.height || 600;
+                const fallbackWidth = containerRect?.width || 1100;
+                const resolvedHeight = height > 0 ? height : fallbackHeight;
+                const resolvedWidth = width > 0 ? width : fallbackWidth;
+
+                return (
+                  <List
+                    height={resolvedHeight}
+                    width={resolvedWidth}
+                    itemCount={filteredPlayers.length}
```

## Validation

### Automated

- `npm run docs`: **PASSED**
- `npm run schema:check`: **FAILED** — schema outputs reported out of date after auto-generation
- `npm run validate:project`: **FAILED** — missing required directories:
  - `player-scrape/contracts/output`
  - `player-scrape/contracts/working`
  - `team-scrape/shared/firestore_staging/output/merged`
- `npm run build`: **PASSED** (with existing warnings about `fs` externalization and large chunk size)

### Manual Verification (Pending)

- Open Player Database page and confirm:
  - Rows render immediately (no blank table)
  - Filtering works
  - react-window virtualization works (only visible rows in DOM)
  - Drawer overlay aligns under the row and overlays beneath rows (no layout push)
