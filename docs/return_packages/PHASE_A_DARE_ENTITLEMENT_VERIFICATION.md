# Phase A: DARE + Entitlement Invariants Verification

**Status**: ✅ COMPLETE  
**Date**: 2026-02-04  
**Verification Command**: `npm test -- --run src/tests/architect/dare src/tests/architect/*entitlement*`  
**Result**: 160 tests passed across 11 test files

---

## Summary

Phase A verification successfully aligned all DARE and entitlement guardrail tests with the actual implemented API and Phase 17 routing rules. The 19 originally failing tests were caused by:

1. **Import mismatches** - Tests imported non-existent function names
2. **API signature changes** - Function parameters had evolved during implementation
3. **Phase 17 routing rules** - Tests expected old broadcast behavior for 3+ team trades

---

## Files Modified

### 1. `src/tests/architect/dare/dareResolver.test.js`

**Problem**: Imported non-existent functions (`classifyEntitlements`, `buildDAREInput`)

**Fix**: Complete rewrite to test the actual public API:

- `validateDAREInput(input)` - 6 tests
- `resolveAllDraftAssets(db, input)` - 9 tests
- `resolveTeamDraftAssets(db, worldId, teamCode, draftYear, positionsMap, opts)` - 1 test

**Tests Now**: 16 passing

---

### 2. `src/tests/architect/dare/conveyanceResolutionAdapter.test.js`

**Problem**: Imported `resolveConveyance` but actual export is `resolveConveyanceForEntitlement`

**Fixes Applied**:

- Changed import to `resolveConveyanceForEntitlement`
- Updated mock to include: `protectionTriggers`, `getCurrentProtectionTier`, `getNextProtectionTier`, `isFinalProtectionYear`
- Updated entitlement shapes: `kind` (not `type`), `holderTeam`, `underlyingPickId`
- Updated assertions: `result.position` (not `result.resolvedPosition`)

**Tests Now**: 10 passing

---

### 3. `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js`

**Problem**: Tests expected broadcast behavior for 3+ team trades, but Phase 17 requires explicit `toTeamId`

**Phase 17 Rule** (from `tradeContext.js` lines 248-260):

```javascript
if (activeTeamCount > 2) {
  console.warn(
    `[tradeContext] Entitlement "${entId}" has no toTeamId in 3-team trade - skipping`
  );
  return;
}
```

**Fixes Applied**:

- Test 3 "Unrouted Entitlements" now expects NO broadcast (entitlement is skipped)
- Updated assertions: `expect(postTradeB.entitlementIds).not.toContain('e1')`
- Added explicit Phase 17 documentation in test comments

**Tests Now**: 9 passing

---

## Test Results Summary

| Test File                                                      | Tests   | Status          |
| -------------------------------------------------------------- | ------- | --------------- |
| dareResolver.test.js                                           | 16      | ✅ Pass         |
| conveyanceResolutionAdapter.test.js                            | 10      | ✅ Pass         |
| phase13_entitlementIds_transfer_guardrail.test.js              | 9       | ✅ Pass         |
| phase15_trade_payload_entitlements_only_guardrail.test.js      | 6       | ✅ Pass         |
| phase16_seasonmanager_entitlements_ssot_view_guardrail.test.js | 19      | ✅ Pass         |
| phase17_entitlement_routing_guardrail.test.js                  | 9       | ✅ Pass         |
| phase17_1_protections_guardrail.test.ts                        | 20      | ✅ Pass         |
| phase17_2_swap_guardrail.test.ts                               | 24      | ✅ Pass         |
| protectionLadderFactory.test.js                                | 27      | ✅ Pass         |
| swapResolutionAdapter.test.js                                  | 8       | ✅ Pass         |
| entitlementInvariants.test.js                                  | 12      | ✅ Pass         |
| **TOTAL**                                                      | **160** | ✅ **All Pass** |

---

## Key API Reference

### DARE Core (`dareResolver.ts`)

```typescript
// Main orchestrator - resolves all entitlements for a world
resolveAllDraftAssets(db, input: DAREInput): Promise<DAREOutput>

// Single team convenience wrapper
resolveTeamDraftAssets(db, worldId, teamCode, draftYear, positionsMap, opts): Promise<EntitlementResolution[]>

// Input validation
validateDAREInput(input: DAREInput): string[]  // Returns array of issues
```

### Conveyance Resolution (`conveyanceResolutionAdapter.ts`)

```typescript
// Single entitlement resolution
resolveConveyanceForEntitlement(
  entitlement: Entitlement,
  positionsMap: Record<string, number>,
  protectionLadder: ProtectionLadder,
  opts?: { draftYear?: number }
): EntitlementResolution

// Batch resolution
resolveConveyanceForEntitlements(
  entitlements: Entitlement[],
  positionsMap: Record<string, number>,
  protectionLadderMap: Record<string, ProtectionLadder>,
  opts?: { draftYear?: number }
): EntitlementResolution[]
```

### Phase 17 Routing Rules

| Scenario                       | Behavior                            |
| ------------------------------ | ----------------------------------- |
| 2-team trade, no `toTeamId`    | Broadcast to counterparty ✅        |
| 3+ team trade, with `toTeamId` | Route to specified team ✅          |
| 3+ team trade, no `toTeamId`   | **SKIPPED** with console warning ⚠️ |

---

## Verification Command

```bash
npm test -- --run src/tests/architect/dare src/tests/architect/*entitlement*
```

Expected output: `Test Files 11 passed (11) | Tests 160 passed (160)`

---

## Next Steps

- Phase B: Core DARE invariants testing (if not covered)
- Phase C: Integration testing with real Firestore data
- Consider adding TypeScript types for test fixtures
