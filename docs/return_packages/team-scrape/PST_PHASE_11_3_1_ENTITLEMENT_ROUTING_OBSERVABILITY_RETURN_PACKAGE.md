# Phase 11.3.1 — Entitlements Routing (toTeamId) Observability

**Status**: COMPLETE  
**Date**: 2026-01-22  
**Master Doc**: PST_PICK_LEDGER_MASTER_PLAN.md

---

## 1. Summary of Change

Added OPTIONAL routing support using `toTeamId` on outgoing entitlement objects for multi-team trades:

- **When `toTeamId` is present**: ONLY that team sees the entitlement as incoming
- **When `toTeamId` is absent**: Keep current behavior (broadcast/all-to-all) for backward compatibility

This is **observability only** (Trade Receipt + Event metadata). Trade mechanics were not changed.

---

## 2. Files Changed

| File                                                                 | Change                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/architect/utils/mutationPipeline.js`                   | Updated `computeTradeResult()` to respect `toTeamId` routing in `entitlementsTraded` event metadata                                                                |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Updated `generateTradeReceipt()` to respect `toTeamId` routing in `incomingEntitlements`; added `toTeamId` field to both outgoing and incoming entitlement objects |
| `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`          | Added debug display: outgoing shows `→ {toTeamId}` when routed; incoming shows `[routed]` badge when `toTeamId` was specified                                      |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`                    | Added Phase 11.3.1 to phase table and documented goal/solution                                                                                                     |

---

## 3. Before/After Example (3-Team Trade)

### Scenario

Teams A, B, C in a 3-team trade. Team A trades 2 entitlements:

- Entitlement 1: `{ id: "ent-001", toTeamId: "B" }`
- Entitlement 2: `{ id: "ent-002", toTeamId: "C" }`

### BEFORE (Phase 11.3 behavior)

Both B and C would see **both** entitlements as incoming:

```javascript
// Team B receipt
incomingEntitlements: [
  { id: "ent-001", fromTeam: "A" },
  { id: "ent-002", fromTeam: "A" }  // WRONG - routed to C
]

// Team C receipt
incomingEntitlements: [
  { id: "ent-001", fromTeam: "A" },  // WRONG - routed to B
  { id: "ent-002", fromTeam: "A" }
]

// Event metadata
entitlementsTraded: {
  A: { out: ["ent-001", "ent-002"], in: [] },
  B: { out: [], in: ["ent-001", "ent-002"] },  // WRONG
  C: { out: [], in: ["ent-001", "ent-002"] }   // WRONG
}
```

### AFTER (Phase 11.3.1 behavior)

Routing is respected:

```javascript
// Team B receipt
incomingEntitlements: [
  { id: "ent-001", fromTeam: "A", toTeamId: "B" }  // Correctly routed
]

// Team C receipt
incomingEntitlements: [
  { id: "ent-002", fromTeam: "A", toTeamId: "C" }  // Correctly routed
]

// Event metadata
entitlementsTraded: {
  A: { out: ["ent-001", "ent-002"], in: [] },
  B: { out: [], in: ["ent-001"] },  // CORRECT - only ent-001
  C: { out: [], in: ["ent-002"] }   // CORRECT - only ent-002
}
```

### Backward Compatibility (2-team or no toTeamId)

When `toTeamId` is absent, behavior is unchanged (broadcast mode):

```javascript
// Team A trades entitlement with no toTeamId
{
  id: 'ent-003';
} // No toTeamId

// All other teams receive it (same as before)
// Team B receipt
incomingEntitlements: [{ id: 'ent-003', fromTeam: 'A', toTeamId: null }];
```

---

## 4. Validation Evidence

### Build Output

```
✓ 2941 modules transformed
✓ built in 1m 26s

dist/assets/index-d351fe04.js          1,964.43 kB │ gzip: 570.67 kB
```

Build passes with no errors.

### Receipt Structure (sample)

Outgoing entitlements now include routing target:

```javascript
outgoingEntitlements: [
  {
    id: 'ent-001',
    seasonYear: '2026-27',
    round: 1,
    kind: 'pick_ownership',
    description: '...',
    toTeamId: 'BOS', // NEW: routing target
  },
];
```

Incoming entitlements now include routing source:

```javascript
incomingEntitlements: [
  {
    id: 'ent-001',
    seasonYear: '2026-27',
    round: 1,
    kind: 'pick_ownership',
    description: '...',
    fromTeam: 'ATL',
    toTeamId: 'BOS', // NEW: indicates this was routed (not broadcast)
  },
];
```

### UI Display

- Outgoing entitlements show: `2026-27 R1 — pick_ownership (ent-001) → BOS`
- Incoming entitlements show: `2026-27 R1 — pick_ownership (ent-001) from ATL [routed]`

### Event Metadata Structure

```javascript
metadata.entitlementsTraded = {
  ATL: { out: ['ent-001'], in: [] },
  BOS: { out: [], in: ['ent-001'] }, // Only BOS receives (routed)
  CHI: { out: [], in: [] }, // CHI excluded (not the target)
};
```

---

## 5. Acceptance Criteria Status

| AC   | Description                                                              | Status  |
| ---- | ------------------------------------------------------------------------ | ------- |
| AC-1 | Receipt incoming entitlements respects toTeamId routing when present     | ✅ PASS |
| AC-2 | Receipt behavior unchanged for entitlements with no toTeamId             | ✅ PASS |
| AC-3 | Event metadata.entitlementsTraded respects toTeamId routing when present | ✅ PASS |
| AC-4 | Event metadata behavior unchanged for entitlements with no toTeamId      | ✅ PASS |
| AC-5 | npm run build passes                                                     | ✅ PASS |

---

## 6. Master Doc Update Confirmation

- ✅ Phase 11.3.1 added to phase status table
- ✅ Phase 11.3.1 section added with goal, problem, solution, and artifacts
- ✅ Status set to COMPLETE

---

## Notes

- This change is **observability only** — it does not affect how entitlement IDs are actually transferred in Phase 11.1 logic
- The `toTeamId` field must be set on outgoing entitlements by the UI/caller when constructing multi-team trades with specific routing
- 2-team trades continue to work exactly as before (no routing needed)
