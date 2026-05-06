# ARCHITECT_CAP_VALIDATION_INCOMPLETE_FIX

## Definition of `incomplete`

`incomplete` is a boolean field returned by `useCapValidation` that signals **validation was partially skipped** due to missing inputs — not that the inputs were invalid.

Currently, `incomplete` is `true` in exactly one scenario:

| Condition | Action | incomplete |
|-----------|--------|------------|
| `rulesProfile` not provided | `extend` | `true` |
| All other cases | any | `false` |

When `incomplete` is `true`, the hook still returns `isValid: true` (no errors were found) but the validation is **not authoritative** — some rules could not be evaluated.

---

## How the UI Must Treat `incomplete`

### Rule

> If `incomplete === true`, the UI must NOT treat the result as fully valid. The confirm action must be blocked unless explicitly overridden.

### Implementation (as of E1)

1. **`ValidationResultLike` type** includes `incomplete: boolean` as an explicit, inspectable field.

2. **`buildValidationResult`** sets `isLegal = false` when `incomplete` is `true` and adds `"Validation incomplete — some rules could not be evaluated"` to the `reasons` array.

3. **Display**: A derived `displayWarnings` array replaces the hook's technical info message (`"Extension validation skipped: rulesProfile not provided"`) with a user-facing warning when `incomplete` is `true`. This avoids duplicative messaging.

4. **Button text**: Shows `"Validation Incomplete"` (distinct from `"Action Blocked"` for CBA violations).

5. **Override**: When `VITE_ENABLE_CBA_OVERRIDE=true`, the incomplete state is overridable via the standard override flow. The incomplete reason is included in:
   - The override section's blocking reasons list
   - The audit log entry
   - The override metadata attached to the mutation payload

### Future Consumers

Any code reading `validationResult` can check `validationResult.incomplete` to distinguish incomplete validation from actual CBA violations, without inspecting `reasons[]` strings.

---

## Status

| Scope | Status |
|-------|--------|
| E1: Surface `incomplete` in EditContractModal | COMPLETE |
