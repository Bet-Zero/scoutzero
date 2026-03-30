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
