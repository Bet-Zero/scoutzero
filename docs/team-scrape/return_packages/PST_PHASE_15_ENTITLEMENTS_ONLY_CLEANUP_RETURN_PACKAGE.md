# PST Phase 15 — Entitlements-Only Cleanup & Legacy Pick Removal

**DATE**: 2026-02-01  
**PHASE**: 15  
**MODE**: EXECUTION COMPLETE  
**MASTER DOC**: [PST_PICK_LEDGER_MASTER_PLAN.md](../PST_PICK_LEDGER_MASTER_PLAN.md)

---

## Summary

Phase 15 finalizes the entitlements-only Trade Machine by removing dead legacy pick UI/code paths, tightening validators to be entitlements-exclusive, and keeping legacy pick schema fields only as explicitly deprecated compatibility fields.

**IMPORTANT STATEMENT**: Trade Machine draft assets are ENTITLEMENTS ONLY. Legacy pick arrays (`picksOut`, `incomingPicks`, `outgoingPicks`) are deprecated compatibility artifacts and are IGNORED by validators. No Trade Machine code path references legacy picks.

---

## Files Deleted

| File                                                        | Reason                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| `src/features/architect/tradeMachine/OutgoingPicksList.jsx` | Dead legacy pick UI - no imports reference it                   |
| `src/features/architect/tradeMachine/TradePickRow.jsx`      | Dead legacy pick row component - only used by OutgoingPicksList |

---

## Files Changed

### UI Components

| File                                                         | Changes                                                                                                                                                                                            |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx`      | Removed unused `formatPick` import                                                                                                                                                                 |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`  | Replaced "Picks Received" section with "Entitlements Received"; removed `formatPick` import and `getPickLabel` helper; added `incomingEntitlements` derivation from other teams' `entitlementsOut` |
| `src/features/architect/tradeMachine/TradeExportCapture.jsx` | Converted `picksOut` to `entitlementsOut`; replaced "Picks Received" section with "Entitlements Received"; added `getEntitlementKindBadge` import                                                  |

### Validator

| File                                                                 | Changes                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Removed legacy test case overrides that used `picksOut`; added Phase 15 comment that legacy pick arrays are IGNORED |

### Schema

| File                       | Changes                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/schemas/architect.ts` | Strengthened deprecation comments for `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` with explicit: "Trade Machine + validators MUST NOT read this field" |

### Tests

| File                                                                            | Changes                                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `tests/tradeValidatorEdgeCases.test.js`                                         | Updated all tests to use `entitlementsOut` instead of `picksOut`; updated test name and expectation for second apron test |
| `src/tests/architect/phase15_trade_payload_entitlements_only_guardrail.test.js` | NEW - 6 guardrail tests ensuring trade payload is entitlements-only                                                       |

---

## Files Created

| File                                                                            | Purpose                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/tests/architect/phase15_trade_payload_entitlements_only_guardrail.test.js` | Guardrail tests: (1) payload uses entitlements fields, (2) legacy fields are ignored |

---

## Validation Outputs

### Build

```
✓ built in 33.46s
```

### Phase 15 Guardrail Test

```
✓ src/tests/architect/phase15_trade_payload_entitlements_only_guardrail.test.js (6)
  ✓ Phase 15: Trade Payload Entitlements-Only Guardrails (6)
    ✓ Payload structure validation (2)
      ✓ trade payload uses outgoingEntitlements/incomingEntitlements (not legacy picks)
      ✓ validates trade successfully with entitlements-only payload
    ✓ Legacy pick field injection (must be ignored) (3)
      ✓ legacy picksOut field is ignored and does not affect validation
      ✓ legacy outgoingPicks field is ignored and does not affect validation
      ✓ legacy incomingPicks field is ignored and does not affect validation
    ✓ Entitlements-only Stepien validation (1)
      ✓ Stepien validation uses entitlementsOut, not legacy picks
```

### Stepien Tests

```
✓ tests/validators/stepien.test.js (14)
✓ tests/validators/stepienEntitlements.test.js (28)
✓ tests/validators/stepienEntitlementBaseline.test.js (19)
✓ src/tests/tradeMachine/stepienObligations.test.js (16)
```

### Phase 13 Guardrail

```
✓ src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js (9)
```

### Trade Validator Edge Cases

```
✓ tests/tradeValidatorEdgeCases.test.js (6)
```

---

## Explicit Confirmation

✅ **No Trade Machine code path references legacy picks**

The following legacy pick references have been eliminated from Trade Machine:

- `picksOut` - REMOVED from all UI components and hooks
- `incomingPicks` - REMOVED from all UI components
- `outgoingPicks` - IGNORED by validator (does not affect results)
- `formatPick` - REMOVED from Trade Machine UI imports (still exists in tradeHelpers for other uses)
- `areSamePick` - NOT used in Trade Machine
- `ensurePickId` - NOT used in Trade Machine

Draft-asset trading is now exclusively through:

- `entitlementsOut` - Outgoing entitlements in trade payload
- `incomingEntitlements` - Derived from other teams' `entitlementsOut`
- `outgoingEntitlements` / `incomingEntitlements` - Export payload structure

---

## Schema Deprecation Statements

From `src/schemas/architect.ts`:

```typescript
/**
 * @deprecated Phase 15: Legacy draft-pick storage. NOT updated by mutations.
 * Trade Machine + validators MUST NOT read this field.
 * Draft assets SSOT is entitlements (entitlementIds + baseEntitlements).
 * This field exists only for backward compatibility and rollback safety.
 */
draftPicksInventory: z.array(DraftPickZ).optional().default([]),

/**
 * @deprecated Phase 15: Legacy Stepien baseline. Replaced by entitlement-based validation.
 * Trade Machine + validators MUST NOT read this field.
 * Stepien validation now uses validationEntitlements exclusively.
 * See validateStepien.js for entitlements-based Stepien validation.
 */
draftPicksObligations: z.array(DraftPickZ).optional().default([]),

/**
 * @deprecated Phase 15: Legacy contested pick view. Swap/conveyance live in entitlements.
 * Trade Machine + validators MUST NOT read this field.
 * Swap rights and conveyance conditions are defined in entitlement objects.
 */
draftPicksContested: z.array(DraftPickZ).optional().default([]),
```

---

## Out of Scope (Not Modified)

As specified in the task, the following were NOT touched:

- ❌ Firestore data deletion
- ❌ SeasonManager entitlement-awareness
- ❌ Removing legacy fields from persisted documents
- ❌ Any mutation logic already passing tests

---

## Next Steps

Phase 15 completes the Trade Machine entitlements-only cleanup. Remaining work:

1. **SeasonManager Entitlement Awareness** - Make season advance operations entitlement-aware
2. **Firestore Legacy Field Cleanup** - When safe, remove deprecated fields from persisted documents
3. **formatPick Deprecation** - Consider deprecating the function if no longer needed

---

## Related Documents

- [PST_PICK_LEDGER_MASTER_PLAN.md](../PST_PICK_LEDGER_MASTER_PLAN.md) - Phase status table
- [PST_PHASE_14_2_REMOVE_LEGACY_PICKSOUT_ENTITLEMENTS_ONLY_EXECUTION_RETURN_PACKAGE.md](./PST_PHASE_14_2_REMOVE_LEGACY_PICKSOUT_ENTITLEMENTS_ONLY_EXECUTION_RETURN_PACKAGE.md) - Previous phase
- [PST_PHASE_13_ENTITLEMENTS_SSOT_VALIDATION_EXECUTION_RETURN_PACKAGE.md](./PST_PHASE_13_ENTITLEMENTS_SSOT_VALIDATION_EXECUTION_RETURN_PACKAGE.md) - SSOT confirmation
