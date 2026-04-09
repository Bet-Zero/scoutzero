# ARCHITECT SYSTEM INTEGRATION — ISSUE LOG

## Feature

Architect System Integration

## Step

Step 1 — Global Ownership and Truth Boundaries

## Log Purpose

This issue log records ownership risks, truth-boundary ambiguities, and structural concerns identified in the Step 1 review. It is the authoritative record of what was found, how serious it is, which execution lane addresses it, and whether it is resolved.

It is distinct from the Review Tracker. The tracker manages execution lane status. This log manages the risks themselves and tracks whether the intended corrections have been applied.

---

## Issue Status Reference

- **OPEN** — identified, not yet addressed
- **IN PROGRESS** — the relevant execution lane is underway
- **RESOLVED** — the corrective action was applied and validated
- **DEFERRED** — intentionally scoped to a later step

---

## Issue Set

### SI-ISS-001 — Ownership model is distributed and implicit

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-1A

**Description:**
Architect has real authoritative files, but the global ownership model is distributed across several of them and there is no single place where that model is expressed. Contributors must read multiple major files together to understand who owns what. The system is coherent once understood, but it is not readable at a glance.

**Risk:**
New contributors or agents operating on limited context will frequently misidentify which file is the real authority for a given concern, leading to writes in the wrong place, bypassed boundaries, or incorrect assumptions about where to look for truth.

**Desired Correction:**
The global ownership model should be made explicit enough that a contributor can quickly identify authorities, adapters, wrappers, and display consumers without an exploratory read across multiple files.

**Source:** Step 1 Review Record — "What Is Weak / Risky" §1

**Resolution Notes (2026-04-09):**
Added an Architect-wide ownership map and quick-answer section to `src/features/architect/ARCHITECT_FEATURE_README.md`, then added explicit ownership markers to the dashboard shell, dashboard hooks, and major authority files. A focused source-scan guardrail test now protects that ownership map from becoming implicit again.

---

### SI-ISS-002 — `mutationPipeline.ts` vs `seasonManager.ts` relationship is ambiguous

**Severity:** HIGH

**Status:** RESOLVED

**Related Lane:** SI-1C

**Description:**
`mutationPipeline.ts` owns the canonical mutation/apply/write authority (READ → COMPUTE → VALIDATE → PERSIST). `seasonManager.ts` owns season transition and world advancement authority. Both are major first-class authorities. The relationship between them — when each applies, when one defers or calls the other, what downstream surfaces should treat as committed truth — is not expressed clearly at the Architect-wide level.

**Risk:**
The two authority surfaces can appear to overlap or compete. Downstream code that needs to trigger either a general mutation or a season transition may make the wrong call. The boundary between "applying a world mutation" and "advancing a season" is the most important unresolved ambiguity in Step 1.

**Desired Correction:**
The repo should express the relationship and division of responsibility between these two authorities clearly enough that contributors can reason about each without needing to read both files in full to understand when one applies vs the other.

**Source:** Step 1 Review Record — "What Is Weak / Risky" §2

**Resolution Notes (2026-04-09):**
Moved shared transient-field persistence hygiene below both authorities into `persistenceContracts/enforcement.ts`, so `seasonManager.ts` no longer appears downstream of `mutationPipeline.ts` for execution ownership. Added explicit sibling-authority markers in `mutationPipeline.ts`, `seasonManager.ts`, `SeasonAdvanceModal.tsx`, and the Step 1 guardrail tests so the repo now states clearly that point-in-time world mutations go through `mutationPipeline.ts` while whole-world season transitions go through `seasonManager.ts`.

**Closeout Review Note (2026-04-09):**
Live repo closeout review found a remaining contradiction in `src/features/architect/utils/mutationPipeline.ts`: `applyWorldMutation(...)` still says it is the "SINGLE public entrypoint for all world mutations." That overbroad wording conflicts with the sibling-authority split above and is not currently covered by the Step 1 guardrails. Reopened for one narrow Step 1 follow-up.

**Narrow Follow-Up Resolution Note (2026-04-09):**
Updated `src/features/architect/utils/mutationPipeline.ts` so `applyWorldMutation(...)` now describes itself as the public entrypoint for general / point-in-time Architect world mutations, explicitly excluding season/world transitions. Updated `src/tests/architect/systemIntegration.step1Ownership.guardrail.test.ts` to require that narrowed wording and to fail if the old overbroad "SINGLE public entrypoint for all world mutations" claim returns.

**Closeout Rereview Confirmation (2026-04-09):**
Live rereview of the repo confirmed the contradiction is gone from `src/features/architect/utils/mutationPipeline.ts`, the Step 1 ownership guardrail now directly protects that exact wording seam, and the targeted rereview guardrail suite passed. No Step 1 blocker remains for `SI-ISS-002`.

---

### SI-ISS-003 — World/base read stack is coherent but fragile from a contributor standpoint

**Severity:** MEDIUM-HIGH

**Status:** RESOLVED

**Related Lane:** SI-1B

**Description:**
The read stack across `firebaseTeamPlanHelpers.ts` (base hydration), `teamLoader.ts` (world-aware fallback-chain), and `worldTeamData.ts` (dashboard-facing adapter) forms a coherent layered ownership model. The problem is that the layering is not self-evident. Each layer looks similar enough at import time that contributors can easily misread which one is the actual read authority for a given concern.

The world → parent → base fallback chain inside `teamLoader.ts` is especially important to understand as an explicit system contract, but it is not yet surfaced as such.

**Risk:**
Downstream surfaces may call the wrong layer directly, bypassing the fallback-chain contract or calling base hydration when world-aware resolution was intended. This is especially risky for any new feature development or future system extension.

**Desired Correction:**
The three-layer read contract should be made explicit enough that:

- base data hydration is clearly distinct from world-aware read resolution
- world-aware read resolution is clearly distinct from dashboard-friendly consumer loading
- the fallback-chain contract in `teamLoader.ts` is easier to identify as a system contract rather than an implementation detail

**Source:** Step 1 Review Record — "What Is Weak / Risky" §3

**Resolution Notes (2026-04-09):**
Marked the read stack explicitly as Layer 1 (`firebaseTeamPlanHelpers.ts` base hydration), Layer 2 (`teamLoader.ts` world-aware fallback authority), and Layer 3 (`worldTeamData.ts` dashboard-facing adapter). Added a README contract section and a guardrail test so the layered read story stays explicit.

---

### SI-ISS-004 — Shared adapter/modal surfaces can appear more authoritative than they are

**Severity:** MEDIUM

**Status:** RESOLVED

**Related Lane:** SI-1A

**Description:**
`EditContractModal.tsx`, `useArchitectActions.ts`, and `useArchitectState.ts` are all important shared surfaces. They coordinate substantial logic and handle complex interactions. As a result, contributors may treat them as final authorities when they are in fact adapters and orchestration layers over deeper first-class authorities.

**Risk:**
If these surfaces are misread as authorities, contributors may add persistence logic, mutation truth, or base-read resolution directly into them rather than into the correct upstream authority. This erodes the downstream/upstream boundary over time.

**Desired Correction:**
The orchestration/adapter role of these surfaces should be made more explicit, ideally both in documentation and through clearer naming or ownership markers at the boundary.

**Source:** Step 1 Review Record — "What Is Weak / Risky" §4

**Resolution Notes (2026-04-09):**
Added explicit adapter/shell ownership markers to `GMDashboard.tsx`, `useArchitectState.ts`, and `useArchitectActions.ts`, and documented those files as orchestration surfaces in the Architect feature README instead of final authorities.

---

### SI-ISS-005 — Preview vs committed-state boundary is not unified as an Architect-wide system story

**Severity:** MEDIUM

**Status:** DEFERRED (Step 4)

**Related Lane:** N/A — Step 4

**Description:**
The mutation pipeline makes committed-state authority explicit for its own scope. But the broader Architect-wide preview vs committed-state ownership story is not yet articulated at an integration level. Several Architect surfaces produce or display "preview" computations before a mutation is committed, and the boundary between those states is architecturally important but not yet unified.

**Risk:**
Confusion about what is preview-only and what is committed truth will become increasingly important as cross-surface handoff work progresses in later steps.

**Desired Correction:**
This risk is scoped to Step 4 (Preview vs Committed-State Consistency), not Step 1. Deferring is correct here. Step 1 execution should not expand into this concern.

**Source:** Step 1 Review Record — "What Is Weak / Risky" §5

---

### SI-ISS-006 — Adapter stacks add contributor navigation cost

**Severity:** LOW-MEDIUM

**Status:** RESOLVED

**Related Lane:** SI-1A, SI-1B

**Description:**
The adapter stack from authority → adapter → dashboard UI adds necessary abstraction but also adds navigation cost for contributors trying to understand where to make a change. `worldTeamData.ts` wrapping `teamLoader.ts` wrapping base hydration is correct structurally, but each wrapper can look like a potential place to make changes that only belong in one specific layer.

**Risk:**
Without clear ownership markers at each adapter layer, contributors may modify the wrong layer when implementing a change that should only touch the authority.

**Desired Correction:**
Addressed as part of SI-1A (global ownership clarity) and SI-1B (read stack contract). Not a standalone execution item.

**Source:** Step 1 Review Record — "Duplicate / Fallback / Legacy / Alternate Path Analysis"

**Resolution Notes (2026-04-09):**
The ownership map, read-stack contract, and in-hook comments now explain which layer should change for which job. The new guardrail test protects those navigation markers so contributors do not have to infer the adapter stack from imports alone.

---

## Issue Summary by Lane

| Lane   | Issues                                                                   | Severity                 |
| ------ | ------------------------------------------------------------------------ | ------------------------ |
| SI-1A  | SI-ISS-001, SI-ISS-004, SI-ISS-006                                       | HIGH, MEDIUM, LOW-MEDIUM |
| SI-1B  | SI-ISS-003, SI-ISS-006                                                   | MEDIUM-HIGH, LOW-MEDIUM  |
| SI-1C  | SI-ISS-002                                                               | HIGH                     |
| SI-1D  | (no standalone defect logged; proactive SSOT durability batch completed) | —                        |
| Step 4 | SI-ISS-005                                                               | MEDIUM (deferred)        |

---

## Resolution Protocol

When an execution lane is marked COMPLETE in the Review Tracker, update the corresponding issue entries here:

- Move status from OPEN → RESOLVED
- Note what was done in the Notes field of the issue entry
- If a correction was only partial, note what remains

## SI-1D Execution Note

`SI-1D` did not correspond to a standalone Step 1 defect entry. The batch still completed on April 9, 2026 by tightening the shared-authority fence around `contractUtils.ts` and adding source-scan guardrails proving that key Architect consumer surfaces continue to route cap totals and contract-year reads through `computeTeamCapTotals.ts` and `contractUtils.ts`.
