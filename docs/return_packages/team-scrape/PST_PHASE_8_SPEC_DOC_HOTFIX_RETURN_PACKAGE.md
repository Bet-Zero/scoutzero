# PST PHASE 8 SPEC DOC HOTFIX RETURN PACKAGE

## Summary

Applied two surgical documentation edits to `PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md` to remove ambiguity regarding Base Pick tradeability and the semantics of the `holderTeam` field for `pick_ownership` assets.

## File Changed

`docs/team-scrape/PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md`

## Proof 1: Base Pick Tradeability

The "Tradeability" bullet in **Section 1.1** was updated to explicitly state that Base Picks are not traded directly:

> - **Tradeability**: Base Picks are never traded directly in Trade Machine UI/logic. Trading occurs via Entitlement Assets (including `pick_ownership` wrappers).

## Proof 2: pick_ownership Semantics

A comment block was inserted in the TypeScript schema in **Section 2** to clarify `holderTeam` semantics:

```typescript
  // 1. PICK_OWNERSHIP (The "Base Pick" wrapper)
  underlyingPickId?: string;       // The physical slot ID (e.g. "HOU_2029_1st")
  // IMPORTANT (pick_ownership semantics):
  // holderTeam = current controller/trade seat for this physical slot.
  // If underlyingStatus is "pooled" or "encumbered", holderTeam is NOT guaranteed final resolved ownership.
  // Final resolution is determined later by conveyance_right / swap_right assets.
```

## Status

COMPLETE
