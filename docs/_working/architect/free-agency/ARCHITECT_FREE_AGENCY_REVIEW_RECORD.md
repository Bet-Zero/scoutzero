# STEP 1 — Free Agency Action Ownership and Source of Truth

## Scope

Free Agency — Step 1: Action Ownership and Source of Truth

**Date:** 2026-03-30  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine the real ownership model for Free Agency actions and state.

Main questions:

- what the real source of truth is for Free Agency actions and state
- whether standard signings, sign-and-trades, and offer-sheet actions all route through one clear authoritative owner model
- whether world-only actions and vacuum-mode actions are clearly separated
- whether any duplicate, fallback, or alternate mutation paths still exist
- whether Free Agency tells one coherent ownership story overall

---

## Executive Verdict

**RISK**

Free Agency is not fragmented or chaotic.

There is a real central action owner:

- `useArchitectActions.ts` owns standard signing
- `useArchitectActions.ts` owns sign-and-trade handlers and authoritative preflight
- `useArchitectActions.ts` owns offer-sheet preflight, storage, and lifecycle resolution handlers

That is a strong foundation.

However, this step is not a PASS because the ownership story is still meaningfully split across:

- dashboard wiring in `FreeAgencySection.tsx`
- UI-layer interaction and contract payload construction in `FreeAgentPool.tsx`
- shared modal dispatch behavior through `EditContractModal.tsx`
- authoritative mutation handling in `useArchitectActions.ts`
- world-mode authoritative execution for some actions
- vacuum-mode local compute/audit execution for some other actions

So the feature has a real central owner, but not a fully singular ownership model.

The correct conclusion is:

**Free Agency has a centralized action owner and generally coherent world-gated mutation truth, but still carries enough split payload ownership and dual-path execution behavior that Step 1 should be graded RISK rather than PASS.**

---

## Ownership / Source-of-Truth Map

### 1. Dashboard Entry Ownership

`FreeAgencySection.tsx` is the dashboard entry surface for Free Agency.

It wires:

- incoming `OfferSheetList`
- outgoing `OfferSheetList`
- `FreeAgentPool`
- callbacks for sign, sign-and-trade, offer-sheet creation, and offer-sheet lifecycle actions
- world-only gating text and action disabling for offer-sheet/sign-and-trade behavior

This file is not the mutation owner.
It is the top-level Free Agency surface wiring owner.

---

### 2. Main Interaction Ownership

`FreeAgentPool.tsx` is the main interaction surface.

It owns:

- filter state application
- player selection state
- selected-player action cards
- opening the contract modal
- constructing standard signing contract payloads from modal form values
- passing sign / sign-and-trade / offer-sheet callbacks into the modal

This means `FreeAgentPool.tsx` owns more than display.
It is a real part of Free Agency action truth because it constructs contract data before handing control to the action layer.

---

### 3. Modal Dispatch Ownership

`EditContractModal.tsx` is part of the Free Agency action path but is not the final action owner.

In the Free Agency flow, the modal is used as:

- action selection surface
- contract form surface
- callback dispatch surface
- world-gated sign-and-trade / offer-sheet initiation surface

This keeps the modal in a dispatch role rather than a mutation-owner role, which is good.

---

### 4. Central Action Ownership

`useArchitectActions.ts` is the real action owner for the feature.

It owns:

- `handleSign`
- `handleSignAndTrade`
- `getSignAndTradePreflight`
- `getOfferSheetPreflight`
- `handleStoreOfferSheet`
- `handleMatchOfferSheet`
- `handleDeclineOfferSheet`
- `handleFinalizeOfferSheet`

This is the strongest ownership point in the Free Agency feature.

The feature does not scatter final action handlers across multiple components.

---

### 5. Authoritative World-Mode Mutation Ownership

For world-backed actions, `useArchitectActions.ts` routes through:

- `runAuthoritativeFAMutation(...)`
- `applyWorldMutation(...)`
- authoritative preflight helpers such as sign-and-trade preflight and offer-sheet preflight

This creates a real authoritative execution path for world-only actions.

This is especially clear for:

- sign-and-trade
- offer-sheet creation
- offer-sheet lifecycle actions

---

### 6. Vacuum-Mode Local Compute Ownership

Standard signing still has a second execution path when no world is active.

In vacuum/base mode, signing goes through:

- local validation
- local `computeWorldMutation(...)`
- local cap-audit evaluation
- local team update / local free-agent removal

So standard signing has one central handler owner, but not one single execution truth path.

That dual-path model is the biggest ownership risk in Step 1.

---

## Standard Signing vs Sign-and-Trade vs Offer-Sheet Ownership

### Standard Signing

Standard signing is only partially ownership-clean.

`handleSign` is the action owner, but it uses:

- authoritative world mutation in world mode
- local compute/audit/state update in vacuum mode

So it has one handler owner, but two execution truth paths.

---

### Sign-and-Trade

Sign-and-trade is cleaner.

It is:

- world-gated in the UI
- world-gated in the action layer
- preflighted through authoritative logic
- committed through authoritative mutation only

So sign-and-trade is more ownership-clean than standard signing.

---

### Offer Sheets

Offer-sheet creation and lifecycle are also cleaner than standard signings.

They are:

- world-only
- preflight-backed
- committed through dedicated authoritative handlers
- kept separate from standard signing flow

That gives offer sheets a stronger ownership model than normal signings.

---

## World-Only Actions vs Vacuum-Mode Actions

### UI Separation

The UI separation is mostly explicit.

`FreeAgencySection.tsx` shows that:

- offer sheets require an active world
- sign-and-trade requires an active world
- incoming/outgoing offer-sheet actions are disabled without a world

`FreeAgentPool.tsx` also limits modal actions by world mode:

- with world: sign + sign-and-trade
- without world: sign only

This is a good sign.

---

### Action-Layer Separation

The action layer backs that up.

`useArchitectActions.ts` explicitly blocks world-required actions when `worldId` is absent for:

- sign-and-trade
- offer-sheet storage
- offer-sheet match
- offer-sheet decline
- offer-sheet finalize

So the UI/world boundary is not fake. It is reinforced by handler truth.

---

### Remaining Ownership Risk

The risk is not that world-mode gating is absent.

The risk is that standard signing still follows a different ownership/execution model than the world-only Free Agency actions, which weakens the overall “one feature, one action truth model” story.

---

## Duplicate / Legacy / Alternate Paths

### 1. Dual-path execution for standard signings

This is the biggest alternate-path risk.

The same signing action can flow through:

- authoritative world mutation
- vacuum-mode local compute + audit + local state patch

That is not a sloppy duplicate implementation, but it is still a split execution model.

---

### 2. UI-layer contract construction before action-layer normalization

`FreeAgentPool.tsx` builds contract details itself:

- salary rows
- total value
- years left
- minimum-contract flag
- signing mechanism / exception fields

Then `useArchitectActions.ts` re-normalizes that contract via shared helpers.

That means Free Agency contract truth is shared between UI-layer payload construction and action-layer normalization, instead of being owned in only one place.

---

### 3. Shared modal surface rather than dedicated Free Agency modal

The feature uses `EditContractModal.tsx`, a shared modal surface, rather than a strictly Free Agency-owned modal contract.

That is not automatically bad, but it increases the chance that Free Agency behavior depends on generic modal assumptions rather than a fully dedicated Free Agency ownership contract.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- `useArchitectActions.ts` is a real central owner
- world-only actions are explicitly gated
- sign-and-trade and offer-sheet flows are relatively clean
- dashboard/UI gating generally matches action-layer truth

Free Agency is clearly organized enough to avoid a FAIL verdict.

---

### Why this is not PASS

- standard signings still use a dual-path execution model
- `FreeAgentPool.tsx` owns meaningful contract-building truth before the action layer
- the feature has centralized action ownership, but not fully singular execution ownership
- the overall ownership story is coherent enough to work, but not clean enough yet to call fully hardened

---

## Final Conclusion

Free Agency has a real central action owner and generally coherent world-gated mutation truth.

However, the feature still carries enough split payload ownership and dual-path execution behavior — especially around standard signings versus world-only actions — that the correct Step 1 result is:

**RISK**

---

# STEP 2 — Free Agent Pool UI Truth and Modal Launch Wiring

## Scope

Free Agency — Step 2: Free Agent Pool UI Truth and Modal Launch Wiring

**Date:** 2026-03-30  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether the visible Free Agent Pool surface is accurately wired to the real Free Agency action model.

Main questions:

- whether row/list/filter behavior is structurally clean and accurate
- whether selected-player and sign-launch behavior are correctly wired
- whether modal launch paths are clean and consistent
- whether the visible UI could show misleading or partial truth about what actions are actually available
- whether this surface has drift risk or hidden fallback behavior

---

## Executive Verdict

**RISK**

The Free Agent Pool surface is not obviously broken, but it is a high-leverage UI layer that sits directly on top of:

- grouped Free Agency action ownership
- modal dispatch logic
- world-only vs vacuum-mode action availability
- selected-player staging
- free-agent row interaction and filtering

This means Step 2 is not mainly about whether the pool “renders.”
It is about whether the visible Free Agency surface tells the truth about what actions are actually available and where they really go.

The main structural risk entering this step is that the pool can still look more authoritative than it really is because it controls:

- selection state
- sign-launch behavior
- modal-opening behavior
- action availability handoff into the modal

So even after Step 1 clarified ownership, this surface can still create misleading UI truth if:

- selection and row actions do not line up
- modal launch paths differ between selected-player cards and row actions
- action availability shown to the user does not match grouped owner truth
- local UI behavior quietly reintroduces hidden fallback assumptions

The correct starting verdict for this step is therefore:

**RISK**

not because Step 1 ownership failed, but because the visible Free Agent Pool layer still needs its own truth/wiring review.

---

## Why This Step Exists Separately from Step 1

Step 1 proved that the Free Agency action owner is centralized and that the ownership boundary is now clearer.

That does **not** prove that the visible pool surface is fully honest or drift-safe.

This step exists to answer different questions:

- does the UI show the right actions
- does it open the right modal state
- do row actions and selected-player actions behave consistently
- does world-only availability appear correctly at the visible surface
- does the pool still hide any weak or duplicated UI paths

So this is a UI-truth and launch-wiring step, not an ownership-source-of-truth step.

---

## Key Surfaces Under Review

The main surfaces in scope are:

- `FreeAgentPool.tsx`
- `FreeAgentRow`
- `SelectedFreeAgentCards`
- `FreeAgencyFilterBar`
- `EditContractModal.tsx` launch/wiring behavior from the pool surface
- the `FreeAgencySection.tsx` wrapper only where it affects visible pool truth

---

## Initial Review Framing

This step should determine:

1. whether the visible pool list/filter/selection layer is structurally clean
2. whether row actions and selected-player actions launch the same truthful action model
3. whether modal launch behavior is unified and correctly constrained
4. whether the visible action surface could mislead users about sign / sign-and-trade availability
5. whether the pool still contains weakly-owned UI paths or hidden fallback behavior

---

## PASS / RISK / FAIL

### Starting Step Verdict

**RISK**

This is the correct starting status for Step 2 because the visible Free Agent Pool surface still needs direct review for UI truth and modal launch wiring, even though Step 1 ownership hardening is complete.

---

## Final Conclusion

Step 2 should now review the Free Agent Pool as the visible Free Agency interaction layer and determine whether the user-facing surface is actually truthful, clean, and consistently wired to the real action model.

Current Step 2 starting assessment:

**RISK**

---

# STEP 2 — Free Agent Pool UI Truth and Modal Launch Wiring

## Scope

Free Agency — Step 2: Free Agent Pool UI Truth and Modal Launch Wiring

**Date:** 2026-03-30  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether the visible Free Agent Pool surface is accurately wired to the real Free Agency action model.

Main questions:

- whether row/list/filter behavior is structurally clean and accurate
- whether selected-player and sign-launch behavior are correctly wired
- whether modal launch paths are clean and consistent
- whether the visible UI could show misleading or partial truth about what actions are actually available
- whether this surface has drift risk or hidden fallback behavior

---

## Executive Verdict

**RISK**

The Free Agent Pool surface is not obviously broken, and its major interaction paths are coherent enough to function.

Key strengths:

- `FreeAgentPool.tsx` is now clearly a staging/dispatch surface rather than the primary action owner
- modal action availability is grouped around the Step 1 `actionOwner` contract
- world-only availability is visibly fenced through `actionOwner.worldOnly` rather than ad-hoc callback guessing
- selected-player cards and row actions both converge on the same modal-entry surface
- the list/filter/selection surface is reasonably modular, with separate row, header, selected-card, and filter-bar pieces

However, this step is not a PASS because the visible pool layer still carries enough UI-level staging and launch responsibility that it could present partial or slightly misleading truth if those paths drift.

The main risks are:

- modal launch can still happen from more than one visible surface (row and selected-player card), so consistency must be proven rather than assumed
- action availability is truthful only if the pool’s grouped-owner wiring remains aligned with modal dispatch behavior
- the pool still performs local resolution/staging work such as player-data lookup, selected-player management, and modal-open state handling, which means it is still a high-leverage UI seam
- the visible surface can look simpler than the actual underlying action model, especially around world-only actions

So the correct conclusion is:

**The Free Agent Pool UI is mostly coherent and now better aligned with the grouped action-owner model, but it is still a high-leverage launch surface with enough staging complexity that Step 2 should be graded RISK rather than PASS.**

---

## Free Agent Pool UI Truth Map

### 1. Section-Level Wrapper Truth

`FreeAgencySection.tsx` renders:

- incoming offer sheets
- outgoing offer sheets
- `FreeAgentPool`

and passes the grouped Free Agency action surface into the pool.

This file is not the visible row/filter/selection owner, but it does frame the visible Free Agency screen and controls the surrounding world-only messaging for offer-sheet/sign-and-trade behavior.

So it is part of the user-facing truth story, even though the main Step 2 focus is inside the pool itself.

---

### 2. Free Agent Pool as Visible Interaction Surface

`FreeAgentPool.tsx` is the main visible Free Agency surface for:

- filter state
- list rendering
- row-level interaction
- selected-player cards
- modal open/close state
- player lookup resolution
- final UI handoff into `EditContractModal.tsx`

This is the main Step 2 surface because it determines what the user sees and how the user launches Free Agency actions.

It is not the mutation owner, but it is the visible launch owner.

---

### 3. Row/List Truth

The row/list surface is built from:

- `filteredAgents`
- `FreeAgentRow`
- `SelectedFreeAgentCards`
- `FreeAgencyFilterBar`

This modularity is a strength because the pool is not one giant flat render block.

However, the row/list truth still depends on local resolution behavior:

- resolving the displayed player object from `playersMap` / `playersById`
- toggling selected-player state by name
- opening the contract modal from row-level actions

That means this UI surface still owns a meaningful amount of visible truth and identity mapping.

---

### 4. Selected-Player Truth

The pool maintains its own `selectedPlayers` state and renders selected-player action cards through `SelectedFreeAgentCards`.

That means there are two visible launch surfaces:

- row-level sign actions
- selected-player card sign actions

These are not inherently wrong, but they create a consistency seam:
both surfaces must launch the same truthful modal/action model.

So selected-player UI is a real Step 2 review layer, not just a visual extra.

---

### 5. Modal Launch Truth

`FreeAgentPool.tsx` owns:

- `contractPlayer` state
- modal open/close behavior
- the dispatch object / callbacks handed into `EditContractModal.tsx`
- `actionsOverride` based on the grouped owner’s world-only branch

This is the most important Step 2 seam.

The pool is not deciding final mutation truth, but it is deciding:

- when the modal opens
- which player it opens for
- which actions the modal is allowed to show
- which action callbacks are present

So this surface can still create misleading truth if launch wiring drifts.

---

## Row/List/Filter Behavior Analysis

### What looks clean

- filtering is separated into `applyFreeAgencyFilters(...)`
- filter persistence is separated into `useFreeAgencyFilterPersistence()`
- row rendering is split out into `FreeAgentRow`
- selected-player rendering is split into `SelectedFreeAgentCards`
- the pool is no longer also rebuilding standard-sign canonical contract truth

This is a healthier UI structure than a monolithic pool surface.

---

### What still carries risk

- selection toggles by player name, which is simple and readable but means the visible UI truth depends on stable naming assumptions
- the surface still performs multi-source player lookup resolution (`playersMap`, normalized key, `playersById`)
- visible truth for a row can therefore depend on lookup fallback behavior, not just a single authoritative object source

That does not automatically mean the surface is wrong, but it is enough UI-level identity/staging logic to keep this step at RISK.

---

## Selected-Player and Sign-Launch Wiring Analysis

### What looks coherent

- row sign actions and selected-player sign actions both route toward the same modal-opening state in the pool
- the modal is launched from one local `contractPlayer` state owner
- that helps keep visible launch behavior unified rather than having separate row-modal and selected-card-modal systems

This is good.

---

### What still carries risk

- because the pool owns both selected-player state and modal-open state, it is still the place where visible launch consistency can drift
- if selected-player cards ever diverge from row action assumptions, the pool layer is where the mismatch would appear
- this is a launch-surface risk, not a mutation-owner risk

So the selected-player surface is coherent enough to work, but still important enough to keep under RISK rather than PASS.

---

## Modal Launch / Callback Wiring Analysis

### What looks clean

- the pool now hands off standard signing directly to the grouped action owner instead of rebuilding a separate standard-sign adapter
- world-only actions are gated through the grouped `actionOwner.worldOnly` contract
- modal action availability is tied to the grouped owner rather than raw UI improvisation
- the modal remains a dispatch surface, not a mutation owner

This is a strong improvement from the earlier split-ownership state.

---

### What still carries risk

- the pool still decides which callback surface is present and which modal actions appear
- this means the visible UI truth depends on the pool continuing to honor grouped-owner semantics correctly
- there is still a real seam between:
  - visible modal action availability
  - deeper authoritative action truth in the hook layer

That seam is now clearer, but it still exists.

---

## Misleading / Duplicated / Weakly Owned UI Paths

### 1. Dual visible launch surfaces

The user can launch the modal from:

- a row action
- a selected-player card action

That is acceptable, but it means truth must stay synchronized across more than one visible entry path.

### 2. Player identity / lookup fallback behavior

The pool resolves player data through multiple lookup routes rather than one guaranteed canonical object source.
That is a UI-truth seam and a possible drift point.

### 3. Action availability is still a handoff surface, not raw final truth

The pool truthfully stages modal actions, but it still does not own final mutation truth.
That means the visible UI can only be considered honest as long as the grouped-owner wiring remains aligned with the hook layer and modal dispatch layer.

### 4. World-only behavior can still look simpler than it really is

The visible surface hides some of the deeper complexity of:

- authoritative preflight
- world-only commit paths
- blocked/no-world behavior

That is good for UX, but it means the pool can still present a cleaner picture than the underlying system unless the wiring remains tight.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- the pool is structurally modular
- row/list/filter/selected-card surfaces are separated cleanly enough
- modal launch is centralized through one local owner
- grouped owner wiring now makes action availability clearer
- the surface does not appear to be inventing alternate mutation truth

This is clearly not a broken UI layer.

---

### Why this is not PASS

- the pool still owns enough visible launch/staging/identity logic to be a real drift seam
- modal launch truth still depends on grouped-owner handoff staying aligned
- row actions and selected-player actions still need consistency protection
- lookup fallback behavior means visible row truth is not coming from one perfectly singular source

So the correct Step 2 verdict is still:

**RISK**

---

## Final Conclusion

The Free Agent Pool UI is mostly coherent and is now better aligned with the grouped action-owner model created in Step 1.

However, it is still a high-leverage visible launch surface with enough staging, identity resolution, and modal wiring responsibility that it needs hardening review rather than a PASS.

The correct Step 2 result is:

**RISK**
