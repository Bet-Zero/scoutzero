# FA Cap + History Integration Master

## Purpose

Track authoritative review status for Free Agency integration with Cap Sheet and Team History in Architect world mode.

Primary question:

If a user commits FA actions in world mode, do those actions:

1. Persist through canonical world mutation pipeline (fail-closed),
2. Reflect in Cap Sheet roster/totals/holds/exceptions,
3. Emit world events that Team History reads and renders.

---

## SSOT (Single Source of Truth)

### Mutation + Persistence SSOT

- Canonical world mutation entrypoint: `applyWorldMutation(...)`
- Canonical persistence stage (only write stage): `persistWorldMutation(...)`
- Success contract is fail-closed on writes summary:
  - `teamsPatched > 0`
  - `eventsWritten > 0`
  - `worldMetadataPatched > 0`

### Team History SSOT

- Event store: `architect_worlds/{worldId}/events/{eventId}`
- Reader: `useWorldTeamEvents(...)`
- Normalizer: `normalizeWorldEventsForTeamHistory(...)`

### Cap Sheet SSOT

- Team snapshot state feeding dashboard sections: `teamCapSheet`
- Totals recompute SSOT: `computeTeamCapTotals(...)`

---

## Mutation Families Covered

Required:

- `signFreeAgent`
- `finalizeMatchedOfferSheet`
- `finalizeDeclinedOfferSheet`
- `renounceRights`

Optional present:

- `signAndTrade`
- `storeOfferSheet`
- `matchOfferSheet`
- `declineOfferSheet`

---

## Current Status Matrix

| Review                              | Date       | Status          | PASS/FAIL                    | Notes                    |
| ----------------------------------- | ---------- | --------------- | ---------------------------- | ------------------------ |
| FA_CAP_HISTORY_INTEGRATION_R1_LOCAL | 2026-03-03 | REVIEW_COMPLETE | 12 PASS / 0 FAIL / 0 BLOCKED | STOP conditions 5/5 PASS |

---

## Linked Return Packages

- `return_packages/architect_reviews/FA_CAP_HISTORY_INTEGRATION_R1_LOCAL_REVIEW_RETURN_PACKAGE.md`

---

## Forbidden Writes Rule

For this integration area, no FA path may write to:

- root `/teams`
- any `architect_base*` collection

All canonical mutation writes must remain world-scoped under `architect_worlds/{worldId}/...`.
