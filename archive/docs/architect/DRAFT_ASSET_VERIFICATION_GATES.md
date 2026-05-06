# Draft Asset Verification Gates (GPS Doc)

**Created**: 2026-02-04  
**Purpose**: Single source of truth for verifying Draft Asset Lifecycle completion.

---

## What "DONE" Means

The Draft Asset Lifecycle is considered **complete** when all four verification gates pass: (A) unit/guardrail tests for DARE resolution, (B) world persistence integration, (C) entitlement invariants enforcement, and (D4) true end-to-end persistence via Firebase Emulator. These gates ensure that entitlements can be traded, resolved during season advance, and persisted correctly without data loss or invariant violations. D5+ phases are **optional enhancements** and not required for shipping.

---

## Recommended Commands

### Fast/Local Verification (No Emulator)

```bash
npm run verify:draft-assets
```

**What it runs:**

- Phase A: DARE unit + guardrail tests (protections, swaps, ladders, pools, ranked conveyance)
- Phase B: World persistence integration tests
- Phase C: Entitlement invariants integration tests

**Expected output:** All tests pass (~230+ tests).

**When to use:** Quick validation during development, CI pre-merge checks.

---

### Full Gate (With Emulator)

```bash
npm run verify:draft-assets:emu
```

**What it runs:**

- Phase D4: True end-to-end emulator gate with real Firestore persistence

**Expected output:** Emulator-backed tests pass, verifying actual write/read cycles.

**When to use:** Full verification before release, when persistence behavior is in question.

---

## Prerequisites for Emulator Gate

### Required Software

- **Firebase CLI**: `npm install -g firebase-tools` (version 13+)
- **Java Runtime**: Required for Firestore emulator (Java 11+)
- **Node.js**: Version 18+ (as specified in CI workflows)

### Ports

- **8082**: Firestore emulator default port (configurable in `firebase.json`)

### Environment Variables

- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082` — Set automatically by the `verify:draft-assets:emu` script

### Starting the Emulator Manually (if needed)

```bash
npm run emu
```

This starts the emulator with auto-export on exit to `./.emulator-data`.

---

## If This Fails, What Now?

### Fast Gate Failures (`verify:draft-assets`)

| Symptom                     | Likely Cause                             | Where to Look                                                    |
| --------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| DARE resolver tests fail    | Resolution logic bug                     | `src/features/architect/utils/entitlements/dare/dareResolver.js` |
| Phase 17.x guardrail fail   | Protection/swap/ladder logic             | `src/features/architect/utils/entitlements/dare/*.js`            |
| Invariant test fail (B5/B6) | Duplicate entitlement or pick accounting | `src/features/architect/utils/leagueInvariants.js`               |
| World persistence fail      | seasonManager or DARE integration        | `src/features/architect/utils/seasonManager.js`                  |

### Emulator Gate Failures (`verify:draft-assets:emu`)

| Symptom                        | Likely Cause                      | Where to Look                                             |
| ------------------------------ | --------------------------------- | --------------------------------------------------------- |
| Firestore write fails          | `undefined` value in document     | Check `removeUndefinedDeep()` usage in `seasonManager.js` |
| Emulator not running           | Port 8082 not available           | Run `npm run emu` in separate terminal                    |
| Connection refused             | `FIRESTORE_EMULATOR_HOST` not set | Script sets it automatically; check terminal env          |
| Document not found after write | Batch commit failed               | Check `batch.commit()` calls in mutation pipeline         |

### Debugging Steps

1. **Run specific test file:**

   ```bash
   npm test -- --run src/tests/architect/dare/dareResolver.test.js
   ```

2. **Check emulator logs:**

   ```bash
   # Emulator outputs to terminal where it was started
   ```

3. **Verify emulator data:**

   ```bash
   npm run emu:doctor
   ```

4. **Clear and reseed emulator:**

   ```bash
   npm run emu:clear && npm run emu
   ```

---

## Gate Coverage Summary

| Phase | Gate                          | Tests | Scope                                                |
| ----- | ----------------------------- | ----- | ---------------------------------------------------- |
| A     | DARE Unit + Guardrails        | ~150  | Resolution logic, protections, swaps, ladders, pools |
| B     | World Persistence Integration | ~20   | Season advance → DARE → Firestore hand-off           |
| C     | Entitlement Invariants        | ~30   | B5 (no duplicate IDs), B6 (pick slot accounting)     |
| D4    | True E2E Emulator             | ~10   | Real persistence with Firebase emulator              |

**Total**: 230+ tests across all gates.

---

## Related Documentation

- [DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md](../../archive/docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md) — Historical master audit document

---

**END OF GPS DOC**
