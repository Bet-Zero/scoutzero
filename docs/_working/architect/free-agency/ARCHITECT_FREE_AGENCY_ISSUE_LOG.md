# ARCHITECT FREE AGENCY — ISSUE LOG

Underlying problem backlog for the Free Agency review series.

---

## STEP 1 — Free Agency Action Ownership and Source of Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| FA-1-1 | FA-1A | MEDIUM | The feature has a real central action owner in `useArchitectActions.ts`, but the primary ownership boundary across dashboard wiring (`FreeAgencySection.tsx`), pool interaction and payload staging (`FreeAgentPool.tsx`), modal dispatch (`EditContractModal.tsx`), and mutation execution is still not explicit enough. The UI-layer files are not competing owners in practice, but the feature has no structural signal that clearly distinguishes wiring/dispatch surfaces from the authoritative mutation owner. | RESOLVED |
| FA-1-2 | FA-1B | HIGH | Standard signing contract truth is split between UI-layer payload construction in `FreeAgentPool.tsx` and action-layer normalization/mutation truth in `useArchitectActions.ts`. The pool builds meaningful contract structure (salary rows, total value, years left, minimum-contract flag, exception fields) before handing off to the action layer, which then re-normalizes. This means the pool is acting as a partial rules-bearing surface rather than a pure staging layer, and the line between what the pool is allowed to construct versus what the action layer truly owns is not enforced. | RESOLVED |
| FA-1-3 | FA-1C, FA-1D | HIGH | Step 1 ownership durability is now closed in live code. The grouped Free Agency owner remains the public UI contract for dashboard/section/pool wiring, world-only flows are pinned fail-closed in base mode, canonical authoritative mutation routing is guarded for sign-and-trade and the full offer-sheet lifecycle, and pool modal action availability is pinned to `actionOwner.worldOnly` rather than alternate local gating. | RESOLVED |

---

## STEP 2 — Free Agent Pool UI Truth and Modal Launch Wiring

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| FA-2-1 | FA-2A | MEDIUM | Shared modal-launch truth is now explicit in live code. `FreeAgentPool.tsx` owns one dedicated `openContractModal` callback and one `contractModalTarget` state, both row actions and selected-player cards feed that same pool-level launch path, and focused runtime/static guardrails now pin modal-entry equivalence plus the absence of modal ownership in the child entry surfaces. | RESOLVED |
| FA-2-2 | FA-2B | MEDIUM | Visible modal action availability is now projected from grouped-owner truth instead of being reconstructed locally in the pool/modal UI. `useArchitectActions.ts` publishes `freeAgentModalAvailability`, `FreeAgentPool.tsx` consumes that owner-level availability contract rather than inferring actions from `worldOnly`, `EditContractModal.tsx` honors an explicit `showOfferSheetToggle` boundary, and focused runtime/static guardrails now pin the owner-projected visibility contract. | RESOLVED |
| FA-2-3 | FA-2C, FA-2D | MEDIUM | Step 2 UI truth is now durably closed in live code. `FreeAgentPool.tsx` keeps one shared `FreeAgentSurfaceEntry` identity path plus one shared modal-launch callback, modal-visible actions remain projected from grouped-owner `freeAgentModalAvailability`, and focused behavioral/closure guardrails now compare row-menu vs selected-card launch through both mocked and real modal paths while forbidding legacy name-based and fallback seams from reappearing. | RESOLVED |

---

## STEP 3 — Free Agency Standard Signing Flow

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| FA-3-1 | FA-3A, FA-3B | HIGH | Standard signing payload finalization, legality interpretation, and signing-mechanism truth are still too easy to split across modal input staging, action-layer preparation, and mutation-time validation. The contract shape — salary rows, action year, total value, signing mechanism, exception usage — must survive multiple hands without being re-derived inconsistently, and legality validation must operate against the same assumptions that the final mutation commits. If these layers share even slightly different signing-truth models, the feature can approve one story and commit another without any visible failure. | OPEN |
| FA-3-2 | FA-3C | HIGH | World-mode and vacuum-mode standard signing still form a dual-path execution model that must be proven coherent rather than assumed coherent. The same `handleSign` handler routes to authoritative world mutation in world mode and to local compute/audit/state update in vacuum mode. These paths can diverge silently — on action-year handling, cap-legality assumptions, or exception resolution — and because each path is internally coherent, the mismatch may only surface in cross-mode comparison or post-migration regression. | OPEN |
| FA-3-3 | FA-3D | MEDIUM | Final-state, persistence, and reload truth for standard signings still carries a risk of post-mutation divergence even if the signing action itself looks correct at mutation time. A signed player must land consistently in team state, be removed from the visible pool, and survive Firestore write and state reload identically in both execution modes. The risk is not that the mutation is wrong, but that the downstream persistence and reload chain is not equally hardened for both paths, leaving room for a signing to appear committed while reloaded state tells a different story. | OPEN |
