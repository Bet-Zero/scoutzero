# Entitlement Authoring Schema Notes

**Created:** 2026-02-05
**Scope:** TM-4 Entitlement Authoring

## Overview

Entitlement authoring now supports a **world-only** override field named `protectionLadder`.
This is stored on `architect_worlds/{worldId}/entitlements/{entitlementId}` and never
written to `architect_baseEntitlements`.

`protectionLadder` is used for:

- **Display** in Trade Machine entitlement rows.
- **Resolution** in DARE via `buildProtectionLadder()` when present.

It is **not simulated** in Trade Machine validation.

## Field Shape

```ts
protectionLadder?: Array<{
  year: number;             // draft year this tier applies to
  condition: string;        // e.g., "Top 3", "Lottery", "Unprotected"
  ifTriggered: 'roll' | 'convert' | 'cancel';
  rollToYear?: number;      // required if ifTriggered === 'roll'
  convertToRound?: number;  // required if ifTriggered === 'convert'
  source?: string;          // optional provenance
}>;
```

## Example

```json
{
  "id": "ent:LAL:2026:1:own:abcd",
  "holderTeam": "LAL",
  "seasonYear": 2026,
  "round": 1,
  "kind": "pick_ownership",
  "underlyingPickId": "LAL_2026_1st",
  "protectionLadder": [
    { "year": 2026, "condition": "Top 3", "ifTriggered": "roll", "rollToYear": 2027 },
    { "year": 2027, "condition": "Top 5", "ifTriggered": "roll", "rollToYear": 2028 },
    { "year": 2028, "condition": "Unprotected", "ifTriggered": "cancel" }
  ]
}
```
