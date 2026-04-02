# ARCHITECT_OFFSEASON_FINAL_POLISH_EXECUTION

Use the current local workspace as source of truth.

Do not rely on prior docs or audit results unless explicitly instructed. Verify everything directly from live code in the workspace.

This is a small final-polish execution pass before the Offseason whole-feature agent review.

---

## OBJECTIVE

Close the last two non-blocking whole-feature seams in one pass:

1. tighten the DEV/local preview gate durability so preview exposure is harder to widen accidentally
2. tighten the draft-positions saved-year / next-used-year seam so the user-facing truth stays maximally explicit and durable

This is a narrow polish/durability pass.
It is **not** a broad Offseason rewrite.
It is **not** a whole-feature review.

---

## WHY THESE ARE COMBINED

These are the two remaining non-blocking durability seams identified after the whole-feature read:

- the preview gate is structurally good, but still convention-based (`DEV` + localStorage intent)
- the draft-positions year seam is structurally good, but still benefits from one final explicitness/durability pass around "saved year" vs "next-used year"

Neither seam justifies a separate large review step.
They should be handled together in one small cleanup execution, then followed by the final whole-feature agent review.

---

## TASK

---

### PHASE 1 — Audit the two remaining polish seams (REQUIRED)

Audit the live code across at least:

- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx`
- `src/features/architect/GMDashboard/components/DraftPositionsInput.tsx`
- `src/features/architect/utils/seasonFormat.ts`
- `src/features/architect/utils/seasonManager.ts`
- focused preview-gate / draft-year tests already covering these seams

At minimum, identify:

- what about the current preview gate still depends on convention more than explicit durable structure
- what about the current saved-year / next-used-year truth is already good
- what still feels softer than ideal in those two seams
- which assumptions are already guarded by tests and which are not

Keep this phase short and directly tied to the two seams above.

---

### PHASE 2 — Tighten preview-gate durability (REQUIRED)

Improve the structure so the preview path is harder to widen accidentally and easier to verify as intentionally non-authoritative.

Preferred outcome:

- preview availability remains clearly owned by the wrapper
- the DEV/local intent contract is easier to trace
- contributors are less likely to widen preview exposure casually
- preview remains clearly separate from the authoritative world-backed path

Do NOT solve this with comments alone.
Tighten the actual structure.

Do not reopen preview-aftermath work already solved unless minimally necessary.

---

### PHASE 3 — Tighten draft-year explicitness/durability (REQUIRED)

Improve the structure so users and contributors can more easily understand:

- which year they are editing/saving
- which year the next season advance will actually consume
- how that next-used year stays tied to the world-backed season rule

Preferred outcome:

- the saved-year vs next-used-year distinction is even harder to misread
- the shared rule remains easy to trace from wrapper to editor to executor
- contributors are less likely to weaken this seam or obscure the next-used-year truth

Do not widen into broader draft-position rewrites.

---

### PHASE 4 — Add focused guardrails (REQUIRED)

Add or update focused guardrails so these two seams cannot silently drift.

At minimum, guard cases where:

- preview remains behind the intended DEV/local intent access contract
- preview remains clearly non-authoritative
- the selected saved draft year remains distinct from the next-used draft year
- season advancement continues consuming the intended shared draft-year rule

Keep guardrails narrow and directly tied to these two polish seams.

---

## CONSTRAINTS

- No broad Offseason rewrite
- No unrelated cleanup
- No whole-feature review work inside this prompt
- Do not solve this with comments alone
- Prefer the smallest structural change that improves durability and explicitness

---

## FILES TO MODIFY

Likely candidates:

- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`
- `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx`
- `src/features/architect/GMDashboard/components/DraftPositionsInput.tsx`
- `src/features/architect/utils/seasonFormat.ts`
- focused preview-gate / draft-year tests if helpful

Modify other files only if truly required.

---

## VALIDATION

Run:

- `npm run typecheck`
- targeted Offseason preview-gate / draft-year truth tests
- `npm run test:diff -- --reporter=dot`
- `npm run build`

Run `npm run validate:project` only if this execution introduces structural file/module changes.

Do not escalate to broader validation unless the live seam requires it.

If there are pre-existing unrelated failures, distinguish them clearly from this final polish work.

---

## RETURN PACKAGE (REQUIRED)

Create file:

`return_packages/architect/ARCHITECT_OFFSEASON_FINAL_POLISH_EXECUTION_RETURN_PACKAGE.md`

### REQUIRED CONTENT

#### Summary
What was implemented

#### Final Polish Audit
Clearly state:
- what the two remaining seams looked like before
- what ambiguity/drift risk existed
- how preview-gate durability is now clearer
- how draft-year explicitness/durability is now clearer

#### Files Changed
List all modified files

#### Implementation Details
Explain:
- what the old preview-gate seam looked like
- what the old draft-year seam looked like
- what changed
- how drift risk is now reduced

#### Validation Results
Results of:
- `npm run typecheck`
- targeted Offseason preview-gate / draft-year truth tests
- `npm run test:diff -- --reporter=dot`
- `npm run build`
- `npm run validate:project` if run

#### Remaining Gaps
Anything still unresolved before the final whole-feature agent review

### FINAL LINE (REQUIRED)

End with EXACTLY ONE of:

`READY FOR WHOLE-FEATURE AGENT REVIEW`

OR

`FOLLOW-UP EXECUTION REQUIRED`

# END
