# STEP 2 — Season Advance Modal UI Truth and Wizard Wiring

## Scope

Offseason — Step 2: Season Advance Modal UI Truth and Wizard Wiring

**Date:** 2026-04-01  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Determine whether `SeasonAdvanceModal.tsx` is a truthful and structurally clean UI surface for world-backed season advancement.

Main questions:

- whether the wizard-step flow is structurally clean and accurate
- whether option-decision staging and validation are correctly wired
- whether summary / confirmation / processing / complete states are truthful
- whether the modal could show misleading or partial truth about what will actually happen during season advancement
- whether the modal surface has drift risk or hidden fallback behavior

---

## Executive Verdict

**PASS**

The Season Advance modal now reads as a clean staged UI surface over one real world-backed action path.

Its wizard model is explicit:

- `summary`
- `options`
- `confirmation`
- `processing`
- `complete`

Its world-backed dispatch is also explicit:

- it uses `authoritativeSeasonEndYear`
- derives `fromSeason` / `toSeason`
- collects option decisions locally
- calls `advanceSeasonInWorld(...)`
- normalizes one `worldAdvanceAftermath` payload for the wrapper

The modal is not trying to own the authoritative season transition itself. It is staging, validating, dispatching, and normalizing results from the actual executor.

That makes this surface strong enough for **PASS**.

---

## SeasonAdvanceModal UI Truth Map

### 1. Wizard ownership is explicit

`SeasonAdvanceModal.tsx` owns the visible wizard state through `currentStep` and `WIZARD_STEPS`.

That state machine is clean and readable:

- `SUMMARY`
- `OPTIONS`
- `CONFIRMATION`
- `PROCESSING`
- `COMPLETE`

Navigation is also explicit through:

- `handleNext`
- `handleBack`
- `handleAdvanceSeason`

So the modal does have one clear UI owner for visible flow truth.

### 2. Season truth is now world-anchored at the UI seam

The key improvement is that the modal no longer takes a vague `currentYear` prop.
It now takes `authoritativeSeasonEndYear`, then derives:

- `toYear`
- `fromSeason`
- `toSeason`

This is much cleaner because it makes the modal read as world-season-driven rather than dashboard-viewing-year-driven.

### 3. Option-decision staging is locally owned and appropriately scoped

The modal locally stages:

- `optionDecisions`
- whether all options are decided
- option radio input state

This is appropriate UI staging, not competing mutation ownership.

It uses:

- `findPlayersWithOptions(...)`
- `allOptionsDecided`
- `handleOptionChange(...)`

The decision gate before confirmation is real and enforced in UI.

### 4. Summary/confirmation states are mostly truthful

The summary step is built from live team-cap-sheet-derived preview helpers:

- `findPlayersWithOptions(...)`
- `findExpiringContracts(...)`
- `findExpiringCapHolds(...)`
- `findExpiringTPEs(...)`

The confirmation step is built from the staged decisions and correctly presents the user’s chosen option outcomes before dispatch.

### 5. Processing/complete states are truthful enough

The modal’s processing state is simple and honest: it is a waiting state during the async season-advance call.

The complete state also stays modest. It confirms advancement and reports updated teams without pretending to be a second detailed offseason summary surface.

---

## Wizard / Staging / Dispatch Wiring Analysis

### What is strong

- The modal owns only staged UI state, not persistent season state
- The actual season advance runs through `advanceSeasonInWorld(...)`
- The modal normalizes result truth into one `worldAdvanceAftermath` contract
- The wrapper consumes that contract instead of synthesizing its own world-backed result model

This is exactly the right split between UI and action ownership.

### What is cleaner now than before

The modal now normalizes:

- `nextWorldSeason`
- `nextViewingYear`
- `offseasonSummary`

inside `worldAdvanceAftermath`

That means the wrapper no longer invents fallback summary defaults or year fallbacks after success. The modal is now the clear UI-to-wrapper bridge for authoritative result normalization.

### Remaining mild risk

The summary step still contains some static “other effects” copy, such as:

- MLE reset
- hard cap cleared
- draft picks updated
- Stepien recalculated

That is not inherently wrong, but it is the part most likely to drift if deeper season-manager behavior changes later. Right now, though, it is still aligned enough not to block PASS.

---

## Misleading, Duplicated, or Weakly Owned UI Paths

### No serious duplicated launch/dispatch path found

The modal has one real advancement dispatch path:

- `handleAdvanceSeason`
- dynamic import of `advanceSeasonInWorld(...)`
- normalized result handling

There is no second competing advancement path inside the modal.

### No hidden local fallback for world-backed advancement

If `worldId` is missing, the modal blocks advancement and shows an explicit error.
It does not silently fall back to preview or local mutation behavior.

### Main weak point is descriptive drift, not structural drift

The biggest remaining weakness is that some summary text is declarative rather than derived from actual result payloads.
But that is much smaller than a real ownership or dispatch problem.

---

## PASS / RISK / FAIL

### Result: PASS

### Why this is not RISK

- the wizard state machine is explicit and structurally clean
- option staging is local and appropriate
- dispatch goes through one real authoritative path
- the modal now publishes one normalized aftermath contract for the wrapper
- there is no hidden local fallback or competing execution owner

### Why this is not FAIL

There is no evidence that the modal is misleading in a structural way or that it owns the wrong layer of truth.

---

## Final Conclusion

`SeasonAdvanceModal.tsx` is now a clean staged UI surface over one world-backed season-advance action path.

Its wizard flow, option staging, dispatch logic, and post-success normalization are coherent enough to earn:

**PASS**
