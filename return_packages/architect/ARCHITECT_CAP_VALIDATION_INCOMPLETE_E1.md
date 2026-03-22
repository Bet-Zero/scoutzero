# ARCHITECT_CAP_VALIDATION_INCOMPLETE_E1 — Return Package

## Summary

Surfaced the `incomplete` field from `useCapValidation` in `EditContractModal` so that incomplete validation is never silently treated as valid.

---

## Behavior: Before vs After

| Scenario | Before | After |
|----------|--------|-------|
| Extension without `rulesProfile` | `isLegal: true`, confirm enabled, blue info box with technical message | `isLegal: false`, confirm blocked, amber warning: "Validation incomplete — some rules could not be evaluated", button: "Validation Incomplete" |
| Extension with `rulesProfile` | No change | No change |
| Any non-extend action | No change | No change |
| Override of incomplete (dev mode) | N/A (was never blocked) | Override section appears, reason listed, audit log captures "Validation incomplete" |

---

## Handling: Block by Default, Override Available

- **Default (production)**: `incomplete` blocks confirmation. Button shows "Validation Incomplete" (gray, disabled).
- **Override mode** (`VITE_ENABLE_CBA_OVERRIDE=true`): Incomplete is overridable via the standard "type OVERRIDE" flow. The incomplete reason is captured in the audit log and override metadata.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/shared/components/EditContractModal.tsx` | Destructure `incomplete` from hook; add `incomplete` to `ValidationResultLike` type; update `buildValidationResult` (param, logic, return); add `displayWarnings` derived array; update downstream refs (ValidationWarnings, effect, visibility condition); enhance button text |
| `docs/architect/ARCHITECT_CAP_VALIDATION_INCOMPLETE_FIX.md` | Created — defines `incomplete` semantics and UI treatment rules |

---

## Edge Cases Considered

1. **`isValid: true` + `incomplete: true`**: This is the core case. No errors exist but validation was skipped. Before this fix, `isLegal` was `true`. Now `isLegal` is `false`.

2. **`isValid: false` + `incomplete: true`**: Errors already block. The incomplete reason is additive — it appears alongside error reasons in the override section. No conflict.

3. **Info message deduplication**: The hook pushes `{ severity: 'info', message: 'Extension validation skipped: rulesProfile not provided' }`. The `displayWarnings` array filters out info-level messages when `incomplete` is true and replaces them with a single user-facing warning. This prevents showing both a technical info message and a user-facing warning for the same condition.

4. **Non-extend actions**: `incomplete` is always `false`. The `!incomplete` term in `isLegal` evaluates to `true`. `displayWarnings === warnings` (passthrough). Zero behavioral impact.

---

## Validation Commands Run

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | PASS | 0 errors |
| `npm run test:node -- --reporter=dot` | 2 pre-existing failures | `offerSheets_closure.gate.test.ts` Gate 11 (unrelated to cap validation) |
| `npm run build` | PASS | 3062 modules, 26.60s |

### Commands Intentionally Skipped

- `npm run test:full` — not authorized (requires "RUN FULL SUITE" in prompt)
- `npm run lint` — not requested; repo has pre-existing lint issues
