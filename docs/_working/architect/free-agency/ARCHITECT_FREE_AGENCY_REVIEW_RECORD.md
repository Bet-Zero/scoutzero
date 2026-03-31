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

---

# STEP 3 — Free Agency Standard Signing Flow

## Scope

Free Agency — Step 3: Standard Signing Flow

**Date:** 2026-03-30  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether the standard Free Agency signing flow is correct from modal input to final team state.

Main questions:

- how standard signing payloads are built and finalized
- whether salary years, action year, total value, signing mechanism, and exception usage are constructed correctly
- whether legality validation and authoritative mutation truth are aligned
- whether world-mode and vacuum-mode standard signing remain coherent rather than silently diverging
- whether final saved/reloaded team state reflects standard signings correctly
- whether any duplicate, fallback, or weaker standard-signing paths still exist

---

## Executive Verdict

**RISK**

Standard signing is the most important Free Agency action path and also the one major Free Agency flow that still intentionally supports both:

- world-mode authoritative execution
- vacuum/base-mode local compute execution

That immediately makes this step more than a simple signing correctness check.

This step is not just asking whether a player can be signed.
It is asking whether the entire signing system stays coherent across:

- modal input
- staged payload data
- action-year handling
- signing mechanism / exception usage
- legality validation
- mutation execution
- persistence / reload
- world-mode vs vacuum-mode behavior

The main reason this step starts at **RISK** is that standard signing still carries the most meaningful dual-path execution model in the Free Agency feature.

Even after Step 1 ownership hardening and Step 2 UI-truth hardening, there are still real areas that need direct review:

- whether the standard-sign payload is truly finalized in one place
- whether action year and salary rows stay correct across both execution modes
- whether exception/signing-mechanism truth stays aligned with legality validation
- whether world and vacuum execution continue to tell the same signing story
- whether post-sign state is equally trustworthy in local and world-backed paths

So the correct starting assessment for Step 3 is:

**RISK**

not because standard signing is assumed broken, but because it is a high-complexity path with enough moving parts and dual-path execution that correctness must be proven directly.

---

## Why This Step Exists Separately

Step 1 proved that Free Agency action ownership is centralized and now better fenced.
Step 2 proved that the visible pool/modal launch layer is cleaner and more durable.

That still does **not** prove standard signing is fully correct.

This step exists to answer a different question:

> Does the real standard signing system remain internally coherent from input to final state across both world-mode and vacuum-mode execution?

That is a deeper correctness question than ownership or launch wiring alone.

---

## Key Surfaces Under Review

The main surfaces in scope are:

- `FreeAgentPool.tsx`
- `EditContractModal.tsx`
- `useArchitectActions.ts`
- any helper paths used by standard signing legality, contract normalization, action-year derivation, mutation execution, and final-state update

---

## Initial Review Framing

This step should determine:

1. where standard signing payload truth is finalized
2. whether salary/year/mechanism details are consistently derived
3. whether legality validation and mutation truth are aligned
4. whether world-mode and vacuum-mode standard signing stay behaviorally coherent
5. whether final saved/reloaded team state reflects standard signings correctly
6. whether any weaker or duplicate signing paths still remain

---

## PASS / RISK / FAIL

### Starting Step Verdict

**RISK**

This is the correct starting status for Step 3 because standard signing is the most execution-heavy and dual-path-sensitive Free Agency flow, and it still needs direct correctness review.

---

## Final Conclusion

Step 3 should now review the standard Free Agency signing system as a full correctness path from modal input through legality, mutation, and final team state.

Current Step 3 starting assessment:

**RISK**

---

# STEP 4 — Free Agency Sign-and-Trade Initiation, Preflight, and Commit Truth

## Scope

Free Agency — Step 4: Sign-and-Trade Initiation, Preflight, and Commit Truth

**Date:** 2026-03-30  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether the Free Agency sign-and-trade path is correct from visible initiation through authoritative preflight and final committed truth.

Main questions:

- whether sign-and-trade is offered only in the correct contexts
- whether preflight is authoritative and correctly wired
- whether destination-team handling and payload structure are correct
- whether commit-time mutation truth matches preflight truth
- whether final saved/reloaded state reflects sign-and-trade correctly
- whether any duplicate, fallback, or weaker sign-and-trade paths still exist

---

## Executive Verdict

**RISK**

Sign-and-trade is not loosely wired.

The path is structurally coherent in several important ways:

- world-only availability is explicit in the dashboard/pool/modal surface
- modal-side sign-and-trade validation correctly defers to authoritative preflight rather than advisory-only modal checks
- destination-team handling is enforced in both preflight and commit
- preflight and commit both use the same shared sign-and-trade contract-preparation seam in `useArchitectActions.ts`
- no vacuum/base-mode fallback path was found for sign-and-trade

Those are meaningful strengths.

However, this step is still not a PASS because sign-and-trade remains a high-risk multi-layer world-only action whose correctness still depends on several aligned but separately executed stages:

- initiation truth in the visible modal layer
- authoritative preflight
- authoritative commit
- generic world-mutation synchronization
- final committed/reloaded team truth

The main structural risk is not obvious fragmentation.
The main structural risk is **drift sensitivity** between:

- what preflight approves
- what commit actually executes
- what final synced/reloaded state ultimately shows

Even though preflight and commit currently share the same contract-preparation helper, they are still two separate evaluations of the transaction rather than one carried authoritative preflight artifact.

That means the current sign-and-trade system is coherent enough to avoid a FAIL, but still sensitive enough that the correct Step 4 verdict is:

**RISK**

---

## Sign-and-Trade System Map

### 1. Section-Level World Gating

`FreeAgencySection.tsx` makes the world-only boundary explicit.

It:

- warns that offer sheets and sign-and-trade require an active world
- disables offer-sheet action surfaces when world-only actions are unavailable
- passes the grouped `actionOwner` into `FreeAgentPool`

This is part of the sign-and-trade truth story because it frames visible availability correctly at the section level.

---

### 2. Pool/Modal Launch Truth

`FreeAgentPool.tsx` launches `EditContractModal.tsx` and passes sign-and-trade capability through the grouped action-owner contract.

The visible surface does not invent its own sign-and-trade owner.
Instead, it depends on the grouped owner’s published world-only action set.

That is a good ownership boundary.

---

### 3. Modal Initiation Truth

`EditContractModal.tsx` handles sign-and-trade as a distinct authoritative-preflight path.

It:

- requires destination team selection
- builds a canonical sign-and-trade payload for preflight
- runs `getSignAndTradePreflight(...)`
- blocks confirm if destination team is missing
- blocks confirm if authoritative preflight is incomplete or blocked
- dispatches `onSignAndTrade(...)` only through the world-only action surface

This is a strong part of the design because sign-and-trade is treated as an authoritative action at modal time, not just a regular local contract action.

---

### 4. Authoritative Preflight Owner

`useArchitectActions.ts` owns `getSignAndTradePreflight(...)`.

It:

- fails closed if no `worldId`
- normalizes destination team code
- blocks same-team destination
- blocks missing player ID
- prepares the sign-and-trade contract through `prepareAuthoritativeSigningDetails(...)`
- calls `preflightSignAndTradeMutation(...)` with prepared contract truth, team routing, player ID, and signing mechanism truth

This means the hook is the real preflight owner.

---

### 5. Authoritative Commit Owner

`useArchitectActions.ts` also owns `handleSignAndTrade(...)`.

It uses the same key assumptions as preflight:

- world required
- destination required
- same-team destination blocked
- player ID required
- shared `prepareAuthoritativeSigningDetails(...)`
- canonical destination team code
- action-season-derived `seasonId`

Then it commits through `runAuthoritativeFAMutation('signAndTrade', ...)`.

This is the real commit owner.

---

## What Looks Strong

### World-only gating is real

The path does not merely “look” world-only.
It is world-only in both visible UI availability and authoritative action logic.

That is correct and important for sign-and-trade.

---

### Destination-team truth is consistent

Both preflight and commit:

- require destination team
- canonicalize destination team code
- reject same-team routing

This reduces one of the most common transaction-shape drift risks.

---

### Contract preparation is shared

The strongest technical point in the current design is that both preflight and commit share the same `prepareAuthoritativeSigningDetails(...)` helper with sign-and-trade-specific overrides.

That means:

- contract structure
- action-year/season context
- signing mechanism normalization
- sign-and-trade flags

are not being independently rebuilt in different layers.

---

### Modal validation authority is correctly chosen

For sign-and-trade, the modal does not rely on advisory-only modal guardrails.
It switches to authoritative-preflight truth.

That is the correct validation model for this kind of action.

---

## Main Risks

### 1. Preflight and commit are aligned, but still separate

The current system is coherent, but preflight and commit are still two separate executions:

- `preflightSignAndTradeMutation(...)`
- `runAuthoritativeFAMutation('signAndTrade', ...)`

They share contract preparation, which is good, but there is no single carried authoritative transaction artifact that proves the exact preflighted transaction is what commit executes.

This is the biggest reason the step remains RISK rather than PASS.

---

### 2. Final-state truth is still somewhat hidden behind the generic authoritative helper

Standard signing was recently made more explicit around post-commit local/final-state handling.

Sign-and-trade still commits through the more generic `runAuthoritativeFAMutation(...)` path and then relies on the generic sync flow.

That may be correct, but the sign-and-trade final-state contract is less explicit than the standard-sign seam now is.

So final committed/reloaded truth remains more indirect than ideal.

---

### 3. Shared modal complexity still matters

`EditContractModal.tsx` is handling sign-and-trade correctly, but sign-and-trade still lives as one branch inside a large shared contract modal.

That is not inherently wrong, but it does keep sign-and-trade exposed to future modal-level drift unless the path stays well guarded.

---

## Weak / Alternate / Duplicate Path Analysis

### Vacuum/base-mode fallback path

No vacuum/base-mode sign-and-trade fallback path was found.

That is correct.

---

### Duplicate mutation owner

No competing commit owner was found.

The modal dispatches.
The pool stages and launches.
The hook commits.

That ownership boundary is clean.

---

### Weak local interpretation path

No obvious local UI-side sign-and-trade mutation path was found.
The main remaining weakness is not local mutation.
It is preflight/commit/final-state drift sensitivity within the authoritative world-only system.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- world-only gating is explicit and enforced
- destination-team handling is coherent
- preflight and commit share the same prepared contract seam
- no alternate vacuum path was found
- no competing mutation owner was found

The system is too organized and too intentional to justify FAIL.

---

### Why this is not PASS

- preflight and commit are still separate evaluations rather than one carried authoritative transaction artifact
- final-state/reload truth is still somewhat hidden behind the generic authoritative mutation helper
- the path remains sensitive to future drift across initiation, preflight, commit, and post-commit sync layers

So the correct Step 4 result remains:

**RISK**

---

## Final Conclusion

Free Agency sign-and-trade is structurally coherent and correctly world-only, with shared contract preparation across preflight and commit.

However, it still carries enough preflight/commit/final-state drift sensitivity that the correct Step 4 verdict is:

**RISK**

---
