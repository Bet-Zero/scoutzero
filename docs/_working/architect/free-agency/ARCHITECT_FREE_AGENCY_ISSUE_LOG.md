# ARCHITECT FREE AGENCY — ISSUE LOG

Underlying problem backlog for the Free Agency review series.

---

## STEP 1 — Free Agency Action Ownership and Source of Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| FA-1-1 | FA-1A | MEDIUM | The feature has a real central action owner in `useArchitectActions.ts`, but the primary ownership boundary across dashboard wiring (`FreeAgencySection.tsx`), pool interaction and payload staging (`FreeAgentPool.tsx`), modal dispatch (`EditContractModal.tsx`), and mutation execution is still not explicit enough. The UI-layer files are not competing owners in practice, but the feature has no structural signal that clearly distinguishes wiring/dispatch surfaces from the authoritative mutation owner. | RESOLVED |
| FA-1-2 | FA-1B | HIGH | Standard signing contract truth is split between UI-layer payload construction in `FreeAgentPool.tsx` and action-layer normalization/mutation truth in `useArchitectActions.ts`. The pool builds meaningful contract structure (salary rows, total value, years left, minimum-contract flag, exception fields) before handing off to the action layer, which then re-normalizes. This means the pool is acting as a partial rules-bearing surface rather than a pure staging layer, and the line between what the pool is allowed to construct versus what the action layer truly owns is not enforced. | RESOLVED |
| FA-1-3 | FA-1C, FA-1D | HIGH | FA-1C is now complete in live code: the grouped Free Agency owner explicitly separates dual-path standard signing from world-only sign-and-trade / offer-sheet flows, and dashboard/pool wiring now consumes that split instead of reconstructing it from raw `worldId`. Focused guardrails pin that ownership seam. The remaining FA-1D risk is broader alternate-path / permanence coverage beyond this world-vs-vacuum ownership fence. | OPEN |

---
