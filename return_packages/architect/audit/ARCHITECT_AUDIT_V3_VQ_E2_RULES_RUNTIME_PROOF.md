# ARCHITECT AUDIT V3 VQ-E2 RULES RUNTIME PROOF

## Purpose

This artifact closes `VQ-E2-001` by recording a successful runtime Firestore rules proof against the local emulator.

## Queue Item Closed

- ID: `VQ-E2-001`
- Original source: `return_packages/architect/audit/E2_SECURITY_POSTURE_AUDIT.md`
- Original gap: runtime rules enforcement evidence missing in the March 5 audit run

## Command Run

```bash
npm run test:rules
```

## Environment

- Firestore emulator host: `127.0.0.1:8082`
- Emulator start path used: `npm run emu`
- Snapshot date: `2026-03-06`

## Result

- Exit: `0`
- Test files: `1 passed (1)`
- Tests: `16 passed (16)`
- Duration: `42.98s`

## Runtime Enforcement Matrix Confirmed

### Owner-allowed world writes

- `1)` owner can create `architect_worlds/{worldId}` when `createdBy == uidA`
- `4)` owner can write `architect_worlds/{worldId}/teams/{teamCode}`
- `5)` owner can write `architect_worlds/{worldId}/events/{eventId}`
- `7)` owner can write `architect_worlds/{worldId}/entitlements/{entitlementId}`

### Non-owner denied world access

- `2)` non-owner cannot read world doc
- `3)` non-owner cannot write/update world doc
- `6)` non-owner cannot read world events subcollection
- `8)` non-owner cannot write `teams/{teamCode}/players/{playerId}` under another user's world

### Base/source collection write denies confirmed

- `9)` any authed user cannot write `architect_baseTeams/{teamCode}`
- `10)` any authed user cannot write `architect_basePlayers/{playerId}`
- `11)` any authed user cannot write `architect_baseEntitlements/{id}`
- `12)` any authed user cannot write root `teams/{teamId}`

### Owner-only lists and tier lists confirmed

- `13)` owner can create `lists/{id}` when `ownerUid == uidA`
- `14)` non-owner cannot read owner list
- `15)` list create fails when `ownerUid` is missing or mismatched
- `16)` `tierLists` mirror strict owner checks for create/read/invalid create

## Consolidated Outcome

`VQ-E2-001` is resolved by runtime proof. The static security posture claims from `E2_SECURITY_POSTURE_AUDIT.md` are now backed by executed emulator evidence rather than source-only inspection.

## Related Artifacts

- `return_packages/architect/audit/E2_SECURITY_POSTURE_AUDIT.md`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_LIVE_STATUS_DELTA.md`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_LIVE_STATUS_DELTA.json`
- `return_packages/architect/audit/ARCHITECT_AUDIT_V3_CONSOLIDATED_IMPLEMENTATION_PLAN.md`
