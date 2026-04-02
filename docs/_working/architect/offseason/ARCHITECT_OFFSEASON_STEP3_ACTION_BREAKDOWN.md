# STEP 3 — ACTION BREAKDOWN

## World Season Advancement Flow

---

## OS-3A — Remove or Fence the Legacy Parallel Season-Advance Path

### Problem

`seasonManager.ts` currently contains two different season-advance engines:

- the older path:
  - `advanceSeason(...)`
  - `processSeasonTransition(...)`
  - `processTeamSeasonTransition(...)`
- the real world-backed Offseason path:
  - `advanceSeasonInWorld(...)`
  - `processTeamSeasonTransitionWithOptions(...)`

Only the newer path is the actual authoritative Offseason execution path, but the older path still exists in the same module and still performs overlapping season-transition work.

### Why It Matters

- Contributors can misunderstand which season-advance path is real
- Parallel execution models create maintenance and regression risk even when only one is currently used by the UI
- This is the biggest structural cleanliness problem in the live world-advance seam

### Goal

Make the authoritative world-backed season-advance path easier to identify by reducing, fencing, or otherwise clarifying the legacy parallel path.

### Success Criteria

- It is easier to identify the real authoritative season-advance engine
- Contributors are less likely to modify the wrong season-advance path
- The execution surface no longer presents two equally plausible season-transition models
- Any remaining legacy path is clearly fenced or intentionally isolated

---

## OS-3B — Tighten Payload / Season / Summary Truth Through the Authoritative Path

### Problem

The live world-backed path already has strong season/year truth and explicit option decisions, but its payload / summary / result bridge is still a high-value seam:

- modal payload → `advanceSeasonInWorld(...)`
- world metadata → actual season truth
- executor summary → modal normalized aftermath → wrapper aftermath

This seam is coherent today, but it is the core truth path for world-backed Offseason and must remain tightly aligned.

### Why It Matters

- If this bridge drifts, the modal and wrapper can stay structurally clean while still reporting the wrong season/result truth
- World-backed season advancement is a top-trust action, so summary/result truth needs stronger protection than “seems aligned right now”
- Option decisions, year derivation, and summary projection all converge here

### Goal

Keep the authoritative world-backed payload / season / summary path explicit, traceable, and harder to weaken silently.

### Success Criteria

- Payload truth is easier to trace from modal dispatch into the authoritative executor
- Season/year truth stays clearly world-metadata-driven
- Summary/result truth remains clearly anchored to authoritative execution
- Contributors are less likely to weaken this bridge without obvious friction

---

## OS-3C — Tighten Final Saved / Reloaded World State Truth

### Problem

The current flow writes world team snapshots, updates world metadata, and lets the wrapper optionally trigger a reload callback after success.

That is broadly trustworthy, but the final saved/reloaded state story still has a few seams:

- world batch persistence
- event writing / metadata updates
- wrapper aftermath application
- optional reload callback

This means final post-advance truth is strong, but not yet as sealed and explicit as it could be.

### Why It Matters

- A contributor can change persistence or aftermath behavior without fully understanding the final-state contract
- World-backed season advance affects multiple downstream Architect surfaces, so reload truth matters beyond the Offseason tab itself
- This is the place where a feature can appear correct immediately after success but still drift on refresh/reload

### Goal

Make the final saved/reloaded state story easier to trace and harder to drift.

### Success Criteria

- Final world state remains easier to verify directly from the authoritative path
- Wrapper aftermath remains visibly downstream of committed world truth
- Reload/update expectations after season advance are clearer
- Contributors are less likely to create post-success state drift

---

## OS-3D — Add Focused Guardrails for the World-Backed Season-Advance Seam

### Problem

Even with the current strong path, world-backed season advancement still depends on several important assumptions continuing to hold:

- the real authoritative engine remains identifiable
- option decisions remain explicit and world-backed
- season/year truth stays driven by world metadata
- summary/result truth stays aligned through the normalized modal/wrapper bridge
- final persistence / reload truth remains trustworthy

These are durable correctness seams and should not rely only on current readability.

### Why It Matters

- Season advancement is one of the most important authoritative actions in Architect
- Drift in this area would be expensive because it touches league-wide state, not just one team surface
- Focused guardrails reduce the chance that future changes quietly weaken the real execution story

### Goal

Add focused protection so the authoritative world-backed season-advance seam stays durable instead of only currently understandable.

### Success Criteria

- Regressions in the real season-advance engine are easier to detect
- Legacy/parallel path drift is easier to catch
- Season/year/result/final-state seams are better protected
- Contributors can more easily distinguish intentional execution truth from leftovers or fallbacks

---

## Step 3 Summary

This step focuses on:

- removing or fencing the legacy parallel season-advance path
- tightening payload / season / summary truth through the authoritative world-backed path
- tightening final saved / reloaded world-state truth
- adding focused guardrails for the world-backed season-advance seam

This is a **world-backed season-advance correctness / execution-cleanliness step**, not a broad Offseason rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **OS-3A + OS-3B** may be executed together if legacy-path cleanup/fencing and payload/season/summary truth live in the same season-manager execution seam
- **OS-3C + OS-3D** may be executed together if final saved/reloaded state truth and guardrails share the same post-success/persistence seam

Validation can stay tiered:

- use targeted season-manager / season-advance / aftermath / reload tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for blocker follow-up or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution
