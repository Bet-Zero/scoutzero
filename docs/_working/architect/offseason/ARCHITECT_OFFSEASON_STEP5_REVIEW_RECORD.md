# STEP 5 — Offseason World-Mode vs DEV Preview / Local Behavior

## Scope

Offseason — Step 5: World-Mode vs DEV Preview / Local Behavior

**Date:** 2026-04-02  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review how Offseason behaves differently in real world mode versus the DEV-gated local/single-team preview path.

Main questions:

- which Offseason actions are world-only
- which Offseason actions are allowed in DEV/local preview mode
- whether the UI truth matches the real mutation/action truth across those two modes
- whether any action can silently no-op or behave inconsistently across world vs preview/local paths
- whether the world/preview boundary is structurally clean
- whether preview/local behavior can leak into real authoritative Offseason assumptions

---

## Executive Verdict

**PASS**

Offseason world mode vs DEV/local preview behavior is structurally clean enough for PASS.

The feature does have two execution models, but the UI labels, gates, and actual action paths line up well:

- world mode persists through `advanceSeasonInWorld(...)`
- preview mode stays on `runOffseason(...)`
- preview explicitly says it does not persist

The remaining weaknesses are architectural complexity and durability concerns, not active truth failures.

---

## World-Mode vs DEV/Local-Preview Offseason Behavior Map

### 1. Real world-backed Offseason path

The real authoritative path is the world-backed surface in `OffseasonSection.tsx`, which wires:

- `SeasonAdvanceModal`
- `DraftPositionsInput`
- world-season-derived draft year
- normalized world aftermath handling
- optional reload reconciliation after success

`SeasonAdvanceModal.tsx` is the real world-backed action surface. It:

- requires world context
- stages option decisions locally
- dispatches through `advanceSeasonInWorld(...)`
- normalizes one `SeasonAdvanceSuccessResult`
- never calls the preview runner

### 2. DEV/local preview path

The DEV preview path is `OffseasonTab.tsx`.

It is a separate single-team preview surface that:

- runs only through `runOffseason(...)`
- never calls `advanceSeasonInWorld(...)`
- never claims to persist
- emits one preview-only result through `onPreviewAdvanceComplete(...)`

That makes the intended execution split very clear in code:

- **world mode** → `SeasonAdvanceModal` → `advanceSeasonInWorld(...)`
- **DEV preview mode** → `OffseasonTab` → `runOffseason(...)`

### 3. Gate that separates the two

`OffseasonSection.tsx` gates preview rendering behind:

- `import.meta.env.DEV`
- localStorage flag `hz.dev.offseasonPreview`
- explicit `showDevPreview` boundary

The source guardrail file explicitly checks for that exact gate and verifies that preview rendering only happens through the explicit preview surface path.

---

## UI Gating vs Mutation / Action Truth Analysis

### Which actions are world-only

World-only actions are:

- real season advancement
- world-backed offseason aftermath application
- draft-position persistence as part of the world-backed surface

The world-backed path is guarded at the UI seam and routed only through the authoritative executor. `SeasonAdvanceModal.tsx` stays on `advanceSeasonInWorld(...)`, and the guardrail explicitly checks that it does **not** import or call `runOffseason`.

### Which actions are allowed in DEV/local preview mode

Preview mode allows:

- local option confirmation
- single-team preview computation
- local/offscreen result staging via callback
- preview messaging for next year projection

`OffseasonTab.tsx` makes this explicit:

- button text is **“Preview Advance to …”**
- completion text is **“Preview computed — not saved”**
- it tells the user to **“Use World Season Advance to persist.”**

### Whether UI truth matches actual action truth

Mostly yes.

The UI language lines up well with the actual behavior:

- preview says preview
- world mode says world-backed advance
- preview does not pretend to save
- world path does not silently fall back to preview
- preview path does not call the real world executor

This is one of the cleaner boundaries in Offseason right now.

---

## Misleading, Duplicate, or Weakly Enforced Boundaries

### What is clean

- Preview and world mode use **different execution engines**:
  - `runOffseason(...)`
  - `advanceSeasonInWorld(...)`
- Preview is DEV-gated and localStorage-gated, not casually available in production-facing flow
- The wrapper publishes separate surfaces:
  - `offseason-world-surface`
  - `offseason-preview-surface`
- The preview surface explicitly warns that it does not persist

### Real weakness 1: preview still patches dashboard-visible state through callback

Even though preview is correctly labeled, `OffseasonTab.tsx` still emits a payload containing:

- `previousCapSheet`
- `updatedCapSheet`
- `nextYear`
- `summary`

through `onPreviewAdvanceComplete(...)`

That is fine for preview behavior, but it means preview still affects dashboard-visible state in a way that structurally resembles a real aftermath path. The messaging fences it, but the shape is still close enough to the real world-backed aftermath model to keep a little risk alive.

### Real weakness 2: two execution models still exist inside one feature wrapper

Even though the boundary is explicit, Offseason still has two real execution models under one tab:

- authoritative world-backed league-wide advance
- preview-only single-team simulation

That is intentional, but it still adds structural complexity. This is not a hidden bug, just a real architectural seam.

### Real weakness 3: localStorage flag is a practical but soft gate

The preview path is correctly DEV-only and localStorage-gated, but this is still a softer boundary than a deeper feature-flag system. The guardrail proves the gate exists, but the design still depends on that gating convention continuing to hold.

---

## PASS / RISK / FAIL

### Result: PASS

### Why this is not RISK

- UI truth matches execution truth well
- preview path is clearly labeled as non-persisting
- world path is clearly authoritative
- no silent no-op or fallback between the two paths showed up
- explicit guardrails already exist for the DEV/localStorage gate and persistence language

### Why this is not FAIL

There is no evidence that preview is masquerading as authoritative world behavior or that world mode is leaking into preview mode incorrectly.

The remaining weaknesses are architectural complexity and durability concerns, not active truth failures.

---

## Files Reviewed

- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx`
- `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx`
- `src/tests/architect/offseason.devGate.guardrail.test.ts`

---

## Final Conclusion

Offseason world mode vs DEV/local preview behavior is structurally clean enough for PASS.

The feature does have two execution models, but the UI labels, gates, and actual action paths line up well:

- world mode persists through `advanceSeasonInWorld(...)`
- preview mode stays on `runOffseason(...)` and explicitly says it does not persist

The correct Step 5 verdict is:

**PASS**
