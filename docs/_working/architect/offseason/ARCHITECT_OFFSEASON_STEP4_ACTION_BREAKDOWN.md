# STEP 4 — ACTION BREAKDOWN

## Draft Positions Input and Persistence Truth

---

## OS-4A — Make Draft Positions Persistence Ownership More Explicit

### Problem

The draft-positions seam is already mostly coherent, but its ownership still spans multiple layers:

- `OffseasonSection.tsx` places the surface in the world-backed Offseason flow
- `DraftPositionsInput.tsx` owns the editor, year selection, validation trigger, save trigger, and messaging
- `worldManager.ts` owns the actual persistence and validation truth
- `seasonManager.ts` later consumes the saved positions during season advance

That ownership model is real, but not yet as explicit and durable as it could be.

### Why It Matters

- Contributors can still blur what is UI staging vs real persistence ownership
- This is a high-value seam because saved draft positions affect later pick conveyance and swap resolution
- If ownership becomes less clear, UI changes can drift away from the actual persisted/consumed truth

### Goal

Make the draft-positions ownership model easier to trace and harder to misread.

### Success Criteria

- It is easier to identify the true persistence owner
- It is easier to distinguish editor behavior from committed persistence truth
- Contributors are less likely to treat the component as the final owner of saved draft-position state
- The downstream consumption story remains clearly connected to the same saved data

---

## OS-4B — Fix Reset / Clear Truth So the UI Does Not Mislead the User

### Problem

The UI currently offers **Reset to Template**, but that action resets only the local editor contents. It does **not** clear persisted draft positions for the selected year, even though `worldManager.ts` already exposes `clearDraftPositions(...)`.

That creates a real truth gap between what a user could reasonably think happened and what was actually persisted.

### Why It Matters

- This is the biggest concrete UX/truth problem in the seam
- A user can believe they reset saved draft positions when they only reset unsaved editor contents
- Draft positions directly affect later season-advance pick resolution, so misleading clear/reset behavior is especially risky

### Goal

Make reset/clear behavior truthful and explicit so the user can clearly distinguish:

- local editor reset
n- actual persisted draft-position clearing

### Success Criteria

- The UI no longer implies that local reset is equivalent to persistence clearing
- True persisted clearing is either exposed explicitly or the UI language is corrected so it cannot mislead
- Contributors are less likely to preserve or reintroduce ambiguous reset semantics

---

## OS-4C — Tighten Saved-Year / Used-Year Truth Through the World-Backed Flow

### Problem

The seam is structurally correct today, but the year that gets edited in the UI and the year that gets consumed during season advancement are only indirectly connected:

- `OffseasonSection.tsx` passes `defaultDraftYear`
- `DraftPositionsInput.tsx` allows selecting among multiple future years
- `advanceSeasonInWorld(...)` later uses `draftYear = fromYear` based on world season truth

That is coherent, but the user-facing “what year will actually be used next?” story is not as explicit as it could be.

### Why It Matters

- A user can save positions for the wrong year and assume they will be used on the next season advance
- This is a truth seam, not just a cosmetic one, because the saved data is later used for real conveyance/swap resolution
- Better year-truth wiring reduces the chance of silent user misunderstanding

### Goal

Make the relationship between saved year and actually-consumed year easier to understand and verify.

### Success Criteria

- The UI more clearly indicates what saved year will be used by the next season advance
- The linkage between world season truth and draft-year consumption is easier to trace
- Contributors are less likely to weaken or obscure this year-truth seam

---

## OS-4D — Add Focused Guardrails for Draft Positions Input / Persistence Truth

### Problem

Even with the current strong structure, this seam still depends on several assumptions continuing to hold:

- one UI owner for editor behavior
- one persistence owner for committed truth
- one real downstream consumer during season advance
- truthful reset/clear semantics
- correct year selection and year consumption behavior
- save/load/result messaging that does not drift from actual persistence truth

These are durable correctness seams and should not rely only on current readability.

### Why It Matters

- Draft positions affect downstream pick logic, so regressions here can cause real world-advance truth problems later
- UI truth can drift gradually even while save/load still appears to “work” at a basic level
- Focused guardrails reduce the chance of semantic regressions around save, clear, and year-truth behavior

### Goal

Add focused protection so the draft-positions input/persistence seam stays trustworthy instead of only currently understandable.

### Success Criteria

- Regressions in reset/clear semantics are easier to detect
- Save/load/year-truth behavior is better protected
- Downstream consumption of saved draft positions remains easier to trace and verify
- Contributors can more easily distinguish editor behavior from persistence truth

---

## Step 4 Summary

This step focuses on:

- making draft-positions persistence ownership more explicit
- fixing reset / clear semantics so the UI does not mislead the user
- tightening saved-year / used-year truth through the world-backed flow
- adding focused guardrails for draft-input / persistence truth

This is a **draft-input / persistence-truth step**, not a broad Offseason rewrite.

---

## Efficiency Note

Execution may batch naturally where the live code shows one shared seam:

- **OS-4A + OS-4B** may be executed together if ownership clarity and reset/clear semantics live in the same UI/persistence boundary
- **OS-4C + OS-4D** may be executed together if saved-year / used-year truth and draft-position guardrails share the same downstream-consumption seam

Validation can stay tiered:

- use targeted draft-input / world-manager / season-advance draft-resolution tests plus `typecheck` / `test:diff` / `build` for substeps
- reserve broader suite escalation for blocker follow-up or whole-feature closeout where needed

---

## Status

- Substeps defined
- Ready for bootstrap + execution
