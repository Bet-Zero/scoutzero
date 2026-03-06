# D Manual QA Checklist (Fallback Mandatory Artifact)

Use this checklist in an emulator-backed manual session.

## Checklist

| ID | Precondition | Action | Expected UI Result | Expected Persisted/System Result |
|---|---|---|---|---|
| D-MQ-001 | Authenticated user, open `/gm/LAL`, active world selected | Verify header mode badge and emulator warning behavior | Badge shows correct mode; warning appears only when emulator unavailable | No unexpected writes; read-only visual indicators only |
| D-MQ-002 | Active world with known `asOfDate` | Change world date in `WorldTimeControls` and click `+1 Day` | Date input reflects new date immediately | `architect_worlds/{worldId}.asOfDate` updates; `lastModifiedAt` updates |
| D-MQ-003 | Trade assets loaded for two teams | Execute legal trade in Trade Machine | Success toast + updated cap tiles/history rows | Writes only under `architect_worlds/{worldId}/teams/*`, `/events/*`, metadata patch |
| D-MQ-004 | Invalid multi-team routing payload scenario | Attempt invalid apply path (or use dev fixture) | UI shows failure message; no false-success | No `batch.commit` write side effects for rejected mutation |
| D-MQ-005 | Free agent available in world mode | Open FA modal, toggle Offer Sheet, submit invalid then valid payload | First submit keeps modal open with error; second succeeds and closes | Offer sheet persisted under world scope; no base collection writes |
| D-MQ-006 | Offseason DEV preview flag enabled | Run Offseason preview flow | Banner states preview-only and non-persisting | No world write until Season Advance action is used |
| D-MQ-007 | World season advance available | Run Season Advance modal | UI season updates and summary modal appears | Team snapshots + world metadata updated in same world scope |
| D-MQ-008 | Team history in world mode | Open Team History and inspect newest row details | Timeline sorted newest-first, details modal includes operation/totals fields | Event data sourced from `architect_worlds/{worldId}/events` for selected team |
| D-MQ-009 | Entitlement authoring feature flag enabled | Save entitlement edit and then duplicate identity conflict case | Valid save succeeds; collision case returns explicit error | Writes in world entitlements only; atomic attach updates team entitlementIds |
| D-MQ-010 | Base collection doc IDs known | Attempt base write through client path | UI denies/handles error | Firestore rules deny writes to `architect_base*` and `players_v2` |
