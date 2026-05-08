# Tiermaker Draft Schema Notes

**Last Updated:** 2026-02-28  
**Status:** Reference documentation for P0/P1 development

---

## Overview

This document captures the actual in-code draft schemas used by Tiermaker/Tieramid for sessionStorage persistence. These are derived directly from [src/features/tierMaker/hooks/useTierDraft.ts](../../src/features/tierMaker/hooks/useTierDraft.ts).

---

## Storage Constants

| Property     | Value                | Location                             |
| ------------ | -------------------- | ------------------------------------ |
| Storage Key  | `tiermaker_draft_v1` | `useTierDraft.ts#L46`                |
| Storage Type | `sessionStorage`     | Browser-native, cleared on tab close |
| Debounce     | 1000ms               | `useTierDraft.ts#L47`                |

---

## Draft Envelope (Root Schema)

The top-level object stored in sessionStorage:

```typescript
interface DraftEnvelope {
  draftStandard: DraftStandard | null;
  draftTieramid: DraftTieramid | null;
  draftUpdatedAt: number | null; // Unix timestamp (ms)
}
```

**Behavior:**

- Both `draftStandard` and `draftTieramid` can coexist in the same envelope
- Cross-conversion happens on mode switch (e.g., Standard → Tieramid)
- Only one envelope is stored — most recent draft overwrites previous

---

## DraftStandard (Tiermaker)

Used for the traditional tier list layout (S/A/B/C/D tiers):

```typescript
interface DraftStandard {
  tiers: Record<string, string[]>; // tier name → array of player IDs
  tierOrder: string[]; // ordered list of tier names
}
```

### Example

```json
{
  "tiers": {
    "S": ["player_abc123", "player_def456"],
    "A": ["player_ghi789"],
    "B": [],
    "C": [],
    "D": [],
    "Pool": ["player_jkl012", "player_mno345"]
  },
  "tierOrder": ["S", "A", "B", "C", "D", "Pool"]
}
```

### Invariants

- `tierOrder` always ends with `"Pool"` (enforced by `normalizeTiers()`)
- Empty tiers have empty arrays `[]`, not `null` or missing keys
- Player IDs are strings (Firestore document IDs)

---

## DraftTieramid (Pyramid)

Used for the pyramid layout (Row1 has 1 slot, Row2 has 2, etc.):

```typescript
interface DraftTieramid {
  rows: Record<string, string[]>; // row name → array of player IDs
  rowOrder: string[]; // ordered list of row names
}
```

### Example

```json
{
  "rows": {
    "Row1": ["player_abc123"],
    "Row2": ["player_def456", "player_ghi789"],
    "Row3": ["player_jkl012"],
    "Row4": [],
    "Row5": [],
    "Pool": ["player_mno345", "player_pqr678"]
  },
  "rowOrder": ["Row1", "Row2", "Row3", "Row4", "Row5", "Pool"]
}
```

### Invariants

- `rowOrder` always ends with `"Pool"` (enforced by `normalizeRows()`)
- Row capacity: `Row{N}` has N slots (Row1=1, Row2=2, etc.)
- Overflow players beyond capacity are moved to Pool

---

## Pool Order Representation

**Key Design Decision:** Player order within Pool (or any tier/row) is determined by array index.

- `tiers["Pool"][0]` is the first player in Pool
- `tiers["Pool"][1]` is the second, etc.
- No separate `poolOrder` array exists — the array IS the order

This is important for the "seed from list" feature: the array order must be preserved from `playerOrder` on import.

---

## Proposed Additions (P1)

### sourceListId

To track the origin of a seeded pool:

```typescript
interface DraftEnvelope {
  // ...existing fields...
  sourceListId?: string | null; // Firestore doc ID of source list (if seeded from list)
}
```

**Use case:**

- User clicks "Add List" → `sourceListId` is set
- Enables future features like "refresh from original list" or tracking provenance

---

## Cross-Conversion

The conversion utilities in [draftConversion.ts](../../src/features/tierMaker/utils/draftConversion.ts) handle Standard ↔ Tieramid:

| Function             | From          | To            | Algorithm                                    |
| -------------------- | ------------- | ------------- | -------------------------------------------- |
| `standardToTieramid` | DraftStandard | DraftTieramid | Flatten tiers top→bottom, fill rows 1,2,3... |
| `tieramidToStandard` | DraftTieramid | DraftStandard | Each row becomes a tier with same name       |

---

## Firestore Mapping

When saved to Firestore (`tierLists` collection), the draft is serialized to:

```typescript
interface TierListDoc {
  name: string;
  tiers: Record<string, string[]>; // same format as DraftStandard.tiers
  tierOrder: string[];
  mode: 'standard' | 'pyramid';
  ownerUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Note:** Both Standard and Tieramid drafts serialize to the same `tiers`/`tierOrder` Firestore schema. The `mode` field indicates how to interpret the structure.
