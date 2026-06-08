# START HERE — Architect UX Interconnectivity Implementation

**You are an implementation agent. This is your entry point. Read this file first, in full,
before doing anything else.**

Branch: `feature/architect-cockpit-intelligence` (you are already on it; do not create a new branch
unless it is missing).

---

## 0. The one instruction

Implement the Architect UX interconnectivity work defined by the spec set in this folder, **one
slice at a time, in order, fully verifying and committing each slice before starting the next**, and
keep `ARCHITECT_IMPLEMENTATION_PROGRESS.md` updated as you go so the work can be paused and resumed
at any time.

You do not need to ask the product owner anything to begin. All product decisions are already locked
in the specs (see each slice's "Resolved open questions" and the master spec's consolidated table).
If you hit a genuine blocker, record it in the progress ledger and stop — do not guess past it.

---

## 1. Read order (every session, including resumes)

1. `ARCHITECT_IMPLEMENTATION_PROGRESS.md` — **read this first.** It tells you exactly what is done
   and what the next incomplete step is. On a resume, start from the first unchecked item.
2. `ARCHITECT_IMPLEMENTATION_MASTER_SPEC.md` — the review, gap map, cross-cutting rules, authority-
   label vocabulary, build order, and global verification strategy.
3. The slice spec for the slice you are currently on (`…_SLICE_0N_*.md`).
4. The source UX contract that slice links to — a sibling `ARCHITECT_*_CONTRACT.md` file in **this
   same folder** — only if you need the product rationale.

All docs referenced in this spec set live as siblings in this one folder
(`active_working_docs/architect_ux_interconnectivity/`); references use bare filenames.

You do **not** need to re-read finished slices.

---

## 2. Build order (hard sequence — do not reorder)

| Order | Slice | File |
| --- | --- | --- |
| 1 | Activity Rail audit + shared `authorityLabel.ts` | `…_SLICE_01_ACTIVITY_RAIL_PLAYER_ACTIONS.md` |
| 2 | Unified `PlayerActionMenu` (foundational) | `…_SLICE_02_PLAYER_ACTION_MENU.md` |
| 3 | Trade overlay entry points + context | `…_SLICE_03_TRADE_OVERLAY_ENTRY.md` |
| 4 | History outbound links | `…_SLICE_04_HISTORY_OUTBOUND_LINKS.md` |
| 5 | Compare / Guide follow-through | `…_SLICE_05_COMPARE_GUIDE_FOLLOW_THROUGH.md` |

Dependencies (why the order is fixed): Slice 2 produces the `PlayerActionMenu` and player-context
payload that Slices 3, 4, and 5 reuse; Slice 3 produces the `TradeOpenRequest` that Slice 4 reuses;
Slice 5 consumes the context payloads finalized in 1–4. Slice 1 ships the shared authority-label
helper that 2/4/5 import.

---

## 3. The loop you run for EACH slice

Do these steps in order for the current slice, then move to the next slice:

1. **Mark started.** In `ARCHITECT_IMPLEMENTATION_PROGRESS.md`, set the slice's status to
   `IN PROGRESS` and check off sub-steps as you complete them.
2. **Implement** exactly the "Gap to close" and "Target files" of the slice spec. Reuse the existing
   code listed under "Current code state" — **do not rebuild what already exists** (this is gap-
   closing work; see master spec §2).
3. **Honor the guardrails** (master spec §4): no new mutation authority (all world writes stay in
   `useArchitectActions` → `mutationPipeline`); local/draft/pending/failed/DEV/sandbox never look
   like committed truth; pinning stays explicit; use `authorityLabel.ts` for every authority/mode
   string.
4. **Verify** with the slice's "Verification" commands (and the AGENTS.md menu in §4 below):
   - `npm run typecheck`
   - the slice's scoped test command (`npm run test:architect --reporter=dot`, plus
     `npm run test:trade --reporter=dot` for Slice 3)
   - `npm run validate:project` if you added files/exports
   - `npm run build`
   - a manual `npm run dev` walkthrough of the slice's acceptance criteria
5. **Check the acceptance criteria.** Every box in the slice's "Acceptance criteria" must pass. If
   any fails, fix it before continuing.
6. **Record results** in the progress ledger: test output summary (pass/fail), anything deferred,
   any follow-up.
7. **Commit** the slice (see §5).
8. **Mark complete.** Set the slice's status to `DONE` in the progress ledger, then start the next
   slice's loop.

If you run low on context/time mid-slice: make sure the progress ledger reflects the exact sub-step
you reached and any uncommitted state, then stop cleanly. The next session resumes from there.

---

## 4. Approved commands (from AGENTS.md — use only these unless a spec says otherwise)

- `npm run dev` — dev server at `http://localhost:5173` for manual verification.
- `npm run typecheck` — after any TS/TSX change.
- `npm run build` — after meaningful component/route changes.
- `npm run validate:project` — after structural changes (new files/folders/exports).
- `npm run test:architect --reporter=dot` — primary suite for this work.
- `npm run test:trade --reporter=dot` — Trade Machine (Slice 3).
- `npm run test:diff --reporter=dot` — when unsure of the narrowest scope.

Always append `--reporter=dot` to test commands. Targeted tests only — never run the full suite by
default.

---

## 5. Commit convention (per slice)

After a slice passes verification, commit just that slice's changes. You are already on
`feature/architect-cockpit-intelligence` (not `main`), so committing here is expected.

- Message form: `feat(architect): <slice summary>` (e.g.
  `feat(architect): unified player action menu (interconnectivity slice 2)`).
- End every commit message with the trailer:

  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

- Do **not** push or open a PR unless the product owner asks. Commit locally only.

---

## 6. When you are completely done

When all five slices are `DONE` in the progress ledger:

1. Run the whole-effort checks one final time: `npm run typecheck`, `npm run test:architect
   --reporter=dot`, `npm run build`.
2. Confirm the master spec's "Definition of done" (§9) holds — especially: no new mutation
   authority anywhere, consistent authority labels, local≠committed everywhere, and the Map's
   Action Lifecycle Flows A–E walk end-to-end in `npm run dev`.
3. Write a short completion note at the bottom of `ARCHITECT_IMPLEMENTATION_PROGRESS.md`.
4. Stop and report. Do not start unrelated work.

---

## 7. Hard stops — pause and record a blocker instead of guessing

- A spec's "Current code state" no longer matches the actual code (someone changed it). Re-map
  before proceeding.
- A required existing owner (`useArchitectActions`, `mutationPipeline`, `EditContractModal`) is
  missing or behaves differently than the spec describes.
- A locked product decision turns out to conflict with reality (e.g. FA-target subtype is infeasible
  with current pin state). Record the conflict; do not invent a new product direction.
- Verification fails in a way you cannot resolve within the slice's scope.

In all of these: write the blocker into `ARCHITECT_IMPLEMENTATION_PROGRESS.md` (with file paths and
what you observed) and stop. The product owner will decide.
