# MASTER CLEANUP / QUALITY AUDIT — REVIEW PROMPT

**Mode:** PREFLIGHT (discovery / audit only; no functional code changes unless explicitly authorized)

## Mission

Review the entire scoped area as a broad cleanup / quality pass.

You are not being asked to check only one bug or one behavior.
You are being asked to inspect the section comprehensively and identify:

- anything broken
- anything likely wrong
- anything risky
- anything poorly wired
- anything confusing in UX
- anything stale / dead / duplicated / unnecessary
- anything inconsistent with surrounding patterns
- anything incomplete or misleading
- anything that should likely be cleaned up, simplified, hardened, or tested better

The goal is to surface the real issues and meaningful improvements without me having to specify them one by one.

---

## Review Lenses (Required)

You must inspect the scoped area through these lenses:

1. **Correctness / Logic**
   - broken logic
   - invalid assumptions
   - incorrect calculations
   - missing conditions
   - bad branching
   - hidden failure paths

2. **UX / Behavior**
   - confusing flows
   - misleading labels
   - controls appearing when they should not
   - missing user feedback
   - inconsistent behavior
   - awkward interaction patterns

3. **State / Data Flow**
   - stale state
   - derived state problems
   - bad prop flow
   - race conditions
   - incorrect source-of-truth usage
   - write/read mismatches
   - persistence gaps

4. **Architecture / Maintainability**
   - overly tangled code
   - poor separation of concerns
   - duplication
   - brittle coupling
   - helper logic in wrong layer
   - oversized components / files
   - hidden dependencies

5. **Cleanup / Consistency**
   - dead code
   - unused props / imports / paths
   - misleading names
   - inconsistent patterns
   - legacy leftovers
   - partial migrations
   - inconsistent styling / conventions

6. **Edge Cases / Safety**
   - invalid input handling
   - empty-state gaps
   - null / undefined risks
   - fallback issues
   - silent failure paths
   - missing guards

7. **Performance**
   - unnecessary rerenders
   - repeated expensive work
   - wasteful filtering / mapping
   - duplicated fetches
   - obvious inefficiencies
   - large avoidable renders

8. **Tests / Verification**
   - missing test coverage for meaningful logic
   - fragile tests
   - blind spots
   - important flows with no validation
   - regressions likely to slip through

9. **Docs / Reality Match**
   - docs or comments that no longer match behavior
   - feature claims not actually backed by implementation
   - implementation details missing from docs if they matter

10. **Anything Else That Feels Off**

- if something is suspicious, call it out
- if not fully provable, label it clearly as needing verification

---

## Required Depth

Do **not** only skim the top-level file names.

You must trace all materially connected logic relevant to this scope, including where applicable:

- components
- child components
- hooks
- utilities
- selectors
- schema / validators
- write paths
- read paths
- derived displays
- related tests
- docs tied to the feature
- any helper functions that materially affect behavior

If the scoped area depends on adjacent files outside the literal folder, include them when necessary.

---

## Hard Rules

- **Do not invent issues.**
- **Do not pad with generic best-practice fluff.**
- **Do not give style-only nitpicks unless they have actual payoff.**
- **Prioritize concrete findings over theoretical commentary.**
- **Every finding must include evidence.**
- **If unsure, say "Needs Verification" instead of overstating.**
- **If you find little or nothing, say so clearly rather than forcing findings.**
- **Balance the audit:** note what appears solid too, not just what looks wrong.
- **No functional code changes in this pass** unless this prompt is explicitly converted to EXECUTION mode.

---

## Evidence Standard

Every finding must include:

- **Severity:** Critical / High / Medium / Low / Polish
- **Type:** Bug / Risk / UX / Data Flow / Cleanup / Architecture / Performance / Tests / Docs / Consistency
- **Location:** exact file path(s) + relevant function/component/block name(s)
- **What you found:** concise issue statement
- **Why it matters:** impact / risk / consequence
- **Recommended action:** what should be changed
- **Confidence:** Certain / Likely / Needs Verification

Do not report vague findings without pointing to actual locations.

---

## Priority Rules

When ranking findings, prioritize in this order:

1. real broken behavior
2. incorrect logic / invalid calculations
3. unsafe or misleading UX
4. data flow / persistence / source-of-truth issues
5. major maintainability hazards
6. missing test coverage for important behavior
7. cleanup / polish

---

## Stop Conditions

Trigger a **STOP CONDITION** if you find any of the following:

1. The scoped feature appears to claim support for behavior that is not actually implemented.
2. A user-visible control appears to allow an invalid action.
3. A write path exists that can mutate data without passing the expected validation / guard layer.
4. A calculation / display appears materially wrong in a way that would mislead the user.
5. A major flow cannot be verified because the necessary code path, test, or documentation is missing.
6. The visible UI and underlying logic appear meaningfully out of sync.
7. A previously known issue appears to still exist despite being considered resolved.

If any STOP CONDITION is triggered, state it clearly in the Return Package summary.

---

## Deliverable Format

Return exactly one markdown document in this style:

# [SCOPE] — PREFLIGHT RETURN PACKAGE

**Date:** [YYYY-MM-DD]
**Mode:** PREFLIGHT
**Scope:** [SCOPE]
**Status:** COMPLETE

---

## Executive Summary

Provide a concise but real summary of the audit:

- overall health assessment
- whether the area is clean, mixed, or concerning
- whether STOP CONDITIONS were triggered
- whether this area appears ready for light cleanup, targeted execution, or deeper audit

---

## Overall Verdict

- **Verdict:** Healthy / Mostly Healthy / Needs Work / High Risk
- **Confidence Level:** High / Medium / Low
- **STOP CONDITIONS Triggered:** [number]
- **Recommended Next Step:** No action / Small cleanup pass / Targeted execution pass / Deep review / Blocker investigation

---

## Findings Inventory

For each finding, use this format:

### Finding [N] — [Short Title]

- **Severity:**
- **Type:**
- **Location:**
- **What I Found:**
- **Why It Matters:**
- **Recommended Action:**
- **Confidence:**

---

## Top Priorities

List the **3-7 highest-value items** to address first.

For each:

- short title
- why it ranks highly
- estimated type of follow-up needed:
  - cleanup
  - targeted fix
  - deeper investigation
  - tests only
  - docs update

---

## Quick Wins

List small, easy, high-payoff cleanup items.

---

## Needs Verification

List suspicious items that are not provable from the inspected evidence alone.

These should be real uncertainties, not filler.

---

## What Looks Good

Briefly list the parts that appear solid, coherent, or well-implemented.

This is required so the review is balanced and not just negative.

---

## Coverage Summary

State what you actually reviewed, including:

- major files / folders inspected
- connected helpers/hooks/utils/tests/docs traced
- any meaningful parts of the scoped area that were not fully verifiable

---

## Recommended Execution Plan

Based on the findings, propose one of these:

- **Option A:** No action needed
- **Option B:** Small cleanup pass
- **Option C:** Targeted execution pass against top findings
- **Option D:** Deeper subsystem audit before making changes

Include a brief reason.

---

## Final Judgment

Give a blunt closing assessment:

- Is this area basically fine?
- Does it have real cleanup debt?
- Does it contain anything dangerous or misleading?
- Would you trust it in its current state?

Be direct.

---

## Output Constraints

- Be concrete.
- Be evidence-backed.
- Do not bloat the package with generic commentary.
- Do not restate the prompt.
- Do not suggest improvements without grounding them in inspected code/behavior.
- If no meaningful issues are found, say that clearly and keep the package tight.
