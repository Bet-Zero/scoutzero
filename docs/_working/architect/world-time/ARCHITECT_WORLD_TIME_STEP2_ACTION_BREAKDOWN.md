# STEP 2 — ACTION BREAKDOWN

## World Selection Lifecycle and Persistence Truth

---

## WT-2A — Tighten Archive and Delete Action Ownership So Each Lifecycle Action Routes Through One Explicit Persistence Owner

### Problem

The world-selection lifecycle is mostly clean now, but two actions still weaken the “one clear owner path per action” story:

- `WorldSelector.tsx` archives by calling `updateWorldMetadata(..., { isArchived: true })` directly instead of routing through the dedicated `archiveWorld(...)` helper
- `worldManager.ts` still exposes a deprecated `deleteWorld(...)` path alongside the real `purgeWorld(...)` path

That means the UI uses the right full-delete path today, but the persistence surface still advertises overlapping or less-explicit lifecycle paths.

### Why It Matters

- World lifecycle actions are top-level user actions and should be easy to trace from UI to the single intended persistence owner
- Multiple valid-looking persistence paths make it easier for contributors to route future lifecycle actions through weaker or inconsistent helpers
- Archive and delete are especially sensitive because they change whether a world continues to exist or be visible

### Goal

Make archive and delete ownership more explicit so each lifecycle action routes through one intended persistence owner path.

### Success Criteria

- Archive behavior is easier to trace through one explicit persistence owner
- Full delete behavior is easier to trace through one explicit persistence owner
- Deprecated or weaker lifecycle paths are less likely to be mistaken for valid primary paths
- Contributors are less likely to choose the wrong lifecycle helper in future world work

---

## WT-2B — Tighten Selection Lifecycle Durability Around Restore / Persist / Invalidate / Switch Flows

### Problem

Active world state ownership is now centered in `useArchitectState.ts`, which is good. But Step 2 still needs to verify and, if necessary, harden the full selection lifecycle around:

- restoring a stored world id
- persisting a changed world id
- clearing invalid stored world ids
- switching to a newly created or branched world
- clearing active world after archive/delete

These flows are cleaner now, but they are still the core lifecycle seam and need stronger explicitness and protection if any weak spots remain.

### Why It Matters

- World selection drives downstream loading, reload, and world-scoped Architect behavior
- Even if CRUD persistence is correct, a weak restore/switch/clear lifecycle can still produce stale or misleading active-world truth
- This seam is especially important because it sits between widget flow, state ownership, and persistence outcomes

### Goal

Make the full active-world lifecycle easier to trace and harder to drift across restore, persist, invalidate, switch, and clear flows.

### Success Criteria

- The active-world lifecycle is easier to follow end-to-end
- Restore/persist/invalidate/switch behavior is more visibly coherent as one lifecycle model
- Contributors are less likely to reintroduce stale or split active-world transitions
- Any remaining lifecycle edge cases are explicitly fenced or fail-closed

---

## WT-2C — Add Focused Guardrails for World Selection Lifecycle Truth

### Problem

Even though the lifecycle is broadly coherent, it still depends on several important assumptions continuing to hold:

- the selector remains a control surface, not a persistence owner
- archive and delete continue to use the intended persistence paths
- active world restore/persist/invalidate/switch behavior continues to flow through the state owner
- weaker or deprecated lifecycle helpers do not quietly become active again
- selection lifecycle behavior remains aligned with the visible UI flow

Those are durable lifecycle seams and should not rely only on current readability.

### Why It Matters

- World selection is one of the highest-leverage system seams in Architect
- Lifecycle drift can silently distort many downstream features without immediately looking broken
- Focused guardrails reduce the chance that future cleanup or feature work reopens duplicate or weak selection paths

### Goal

Add focused protection so the world-selection lifecycle remains trustworthy and easier to audit.

### Success Criteria

- Regressions in lifecycle ownership are easier to detect
- Archive/delete path drift is easier to detect
- Restore/persist/invalidate/switch lifecycle drift is easier to detect
- Contributors can more easily distinguish intended lifecycle owners from deprecated or weaker paths

---

## Step 2 Summary

This step focuses on:

- tightening archive and delete action ownership so each lifecycle action routes through one explicit persistence owner
- tightening selection lifecycle durability around restore / persist / invalidate / switch flows
- adding focused guardrails for world selection lifecycle truth

This is a **world-selection lifecycle / persistence-truth step**, not a broad world-time rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **WT-2A + WT-2B** may be executed together if archive/delete ownership and selection lifecycle durability both live in the same selector/state/persistence chain
- **WT-2C** can then close the step with focused guardrails once the lifecycle seam itself is clearer

Validation can stay tiered:

- use targeted world selector / world manager / state-hook lifecycle tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for blocker follow-up or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution
