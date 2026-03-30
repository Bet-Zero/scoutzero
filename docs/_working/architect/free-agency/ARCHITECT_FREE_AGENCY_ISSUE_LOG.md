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
| FA-2-3 | FA-2C, FA-2D | MEDIUM | Visible row and player-card truth depends on multi-source identity resolution and name-based selection toggling rather than a single authoritative player object. The pool resolves displayed player data through a fallback chain (`playersMap`, normalized key, `playersById`), and selected-player state is keyed by name. This means the visible pool surface can present partial or subtly mismatched player identity depending on which lookup path resolves, and these seams are not yet protected by focused guardrails. | OPEN |
