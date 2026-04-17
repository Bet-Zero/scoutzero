# Architect Next Steps — Living Plan

**How this doc works:** When the user says "keep working on docs/architect/ARCHITECT_NEXT_STEPS.md," find the first step below with status `TODO` or `IN PROGRESS`, do it, then update the status to `DONE` (or leave it `IN PROGRESS` with a note if blocked or partial). One step per session unless a step is trivial. Do not skip ahead. Do not invent new steps. When all steps are `DONE`, tell the user the plan is complete and ask what's next.

**Background context (read before starting any step):**

- The cast-ledger gate shipped 2026-04-17 (commit `a6518fd8`). It blocks new type-system shortcuts in `src/features/architect/**`. Source of truth: `scripts/architect-cast-gate.mjs`, baseline at `.architect-cast-baseline.json`, ledger at `docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md`.
- The architectural seams that produce most of the existing exceptions are documented in `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md` as Items 1–6.
- The protocol for adding new exceptions and removing old ones is in the header of `ARCHITECT_TYPE_CAST_LEDGER.md`.

**Universal constraints (apply to every step):**

- Never run an open-ended "find all type casts" audit. The gate replaces that workflow permanently.
- Never regenerate `ARCHITECT_TYPE_CAST_LEDGER.md` via `scripts/generate-architect-cast-ledger.mjs`. It would reset CAST-NNN IDs and lose any TODO rows that have been filled in. Edit the file in place.
- After any step that intentionally reduces violations, run `node scripts/architect-cast-gate.mjs --write` to update the baseline and commit it in the same PR.
- Run `npm test` (or the relevant subset) before declaring a step done if you changed source code. Skip if the step was doc-only.

---

## Step 1 — Fill in cast ledger TODO rows

**Status:** TODO

**Goal:** Every row in `docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md` has a real Seam value and a real Reason. No rows remain with `TODO` in either column.

**Instructions:**
Read `docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md`. The "Entries" table currently has 167 rows; ~21 are pre-filled and ~146 say `TODO` in both Seam and Reason columns. For each `TODO` row: read the file at the line number shown in the second column, look at the surrounding code, and decide which architectural seam from `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md` it belongs to (`Item 2`, `Item 3`, `Item 4`, `Item 5`, or `STANDALONE` if it doesn't fit any known seam). Update the row's Seam and Reason columns with that value plus a one-sentence reason explaining why the cast is load-bearing or what would need to change to remove it.

**Constraints specific to this step:**

- Do NOT modify any source code under `src/features/architect/`.
- Do NOT touch `.architect-cast-baseline.json`.
- This is doc-only work. Only `ARCHITECT_TYPE_CAST_LEDGER.md` changes.
- If a row looks like it could be removed today (the cast appears unnecessary), still leave it `TODO` and add it to a "Removable Candidates" section at the bottom of the ledger. Don't delete or fix in this step.

**Done when:** Zero rows in the Entries table contain `TODO` in either column. Commit message: `docs: fill in architect cast ledger reasons`.

---

## Step 2 — Get CI to green

**Status:** TODO

**Goal:** The CI workflow (`.github/workflows/ci.yml`) passes on every push to `main` so that any future red is a real signal, not background noise.

**Instructions:**
CI on `main` is currently red because of pre-existing test failures, not because of the cast-gate work. Go to the GitHub Actions page (the user can give you the run URL or paste the logs), identify every failing step, and categorize each failure into one of:

1. **Fix now** — small, clear, no architectural decisions involved.
2. **Skip with comment** — requires infrastructure CI doesn't have (e.g., `firestoreRules.integration.test.ts` requires the Firestore emulator). Add a guard so the test skips gracefully when the env var is missing, with a comment explaining why.
3. **Mark obsolete and remove** — source-scan tests grepping for code patterns that no longer exist (Item 6 in the deferred-work doc lists candidates).

Apply each fix. Run the full test suite locally to confirm the changes work. Push and verify CI is green.

**Constraints specific to this step:**

- Do not delete tests just because they're failing. A test failing is a signal that either the code is broken, the test is obsolete, or the test environment is misconfigured. Decide which, then act.
- Do not regress tests that currently pass.
- If a test must skip in CI, make sure it can still be run locally with the right env (e.g., `npm run test:rules` for the Firestore one).

**Done when:** A push to `main` shows all green checkmarks in GitHub Actions. Commit messages can be split per-fix or bundled, agent's call.

---

## Step 3 — Implement Item 1 from deferred-work doc

**Status:** TODO

**Goal:** `PickRuleDoc` is exported, the `as any` casts in `TradeSummaryPanel.tsx` and `TradeReceiptPanel.tsx` are removed, and the corresponding ledger rows are deleted.

**Instructions:**
Read Item 1 in `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md` and implement it exactly as described. Three files change. After the source edits:

1. Run `npm run lint:architect-gate` — should pass with a "ratchet went down" message.
2. Run `node scripts/architect-cast-gate.mjs --write` to regenerate the baseline.
3. Find the rows in `ARCHITECT_TYPE_CAST_LEDGER.md` that correspond to the now-removed casts (search for the file paths) and delete them.
4. Run the relevant tests (`npm test` or scoped subset).
5. Commit and push.

**Done when:** Baseline shrunk, ledger rows deleted, tests pass, CI green.

---

## Step 4 — Implement Item 2 from deferred-work doc

**Status:** TODO

**Goal:** `leagueInvariants.ts` no longer takes `payload: any`. Legacy `receiving`/`playersReceiving` fields are properly typed (either added to `ArchitectMutationPayload` or split into a `LegacyMutationPayload` intersection).

**Instructions:**
Read Item 2 in `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md`. Audit the call sites first to confirm which payload shape is actually passed, then choose between adding optional fields or creating an intersection type. Apply the chosen approach. Then run the gate, regenerate the baseline, delete the corresponding ledger rows (tagged `Item 2`), run league-invariant tests, commit, push.

**Done when:** `payload: any` removed from both function signatures in `leagueInvariants.ts`, baseline shrunk, ledger rows tagged `Item 2` deleted, league-invariant tests pass.

---

## Step 5 — Implement Item 3 from deferred-work doc (biggest payoff)

**Status:** TODO

**Goal:** `ArchitectContract` no longer has the `[key: string]: unknown` catch-all. All previously-undeclared fields (`years`, `contractYears`, `firstYearSalary`, `salariesByYear`, `originalLength`, etc.) are explicitly typed as optional fields on the type.

**Instructions:**
Read Item 3 in `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md`. Follow the four steps under "Where the fix lives." This will produce the largest single ratchet in the baseline (~25-30 violations). After the source edits, run the gate, regenerate the baseline, delete the rows tagged `Item 3` from the ledger, run mutation pipeline tests, commit, push.

**Done when:** Catch-all removed from `ArchitectContract`, baseline shrunk, ledger rows tagged `Item 3` deleted, mutation pipeline tests pass.

---

## Step 6 — Implement Item 4 from deferred-work doc

**Status:** TODO

**Goal:** `ArchitectMutationTeamRecord.totals` is split into `LoadedTeamCapTotals` (Firestore shape) and `ComputedTeamCapTotals` (output of `computeTeamCapTotals`). Type guards or unification eliminate the dual-shape `Record<string, unknown>` boundary.

**Instructions:**
Read Item 4 in `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md`. Follow the five steps under "Where the fix lives." This is medium-large effort because dozens of test fixtures use one shape and runtime computation produces another. After the source edits, run the gate, regenerate the baseline, delete the rows tagged `Item 4` from the ledger, run cap totals + season advance tests, commit, push.

**Done when:** `totals` is a proper union (or unified type) with no catch-all, baseline shrunk, ledger rows tagged `Item 4` deleted, cap totals tests pass.

---

## Step 7 — Implement Item 5 from deferred-work doc

**Status:** TODO

**Goal:** The `as never` casts in `TradePlayerRow.tsx`, `CapImpactTiles.tsx`, `OutgoingPlayersList.tsx`, `EntitlementPickRow.tsx`, and `miscRules.ts` are removed by widening the JS-migrated utility function signatures (not by narrowing the components).

**Instructions:**
Read Item 5 in `docs/architect/ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md`. Follow the recommended approach (export internal types and widen utility signatures). Touch each cast site listed in the table within Item 5. After the source edits, run the gate, regenerate the baseline, delete the rows tagged `Item 5` from the ledger, run trade machine render tests, commit, push.

**Done when:** Zero `as never` casts in the listed files, baseline shrunk, ledger rows tagged `Item 5` deleted, trade render tests pass.

---

## Step 8 — Audit remaining ledger rows

**Status:** TODO

**Goal:** Every remaining ledger row is either truly load-bearing (`STANDALONE` with a clear permanent reason) or has a planned fix path. No "we forgot why this is here" rows.

**Instructions:**
After Items 1–5 are done, the ledger should have shrunk substantially — probably to under 50 entries, all tagged `STANDALONE`. Read each remaining row, verify the reason still holds, and either confirm it as permanent or queue a tenth step to remove it. If any rows have stale reasons (referring to code that no longer exists), update them.

**Done when:** Every remaining ledger row has a current, accurate reason. Nothing tagged `TODO`.

---

## Status legend

- **TODO** — not started
- **IN PROGRESS** — partially done; agent should pick up where the last session left off (read the step's notes section if present)
- **DONE** — complete and merged
- **BLOCKED** — needs user input or external dependency; agent should explain why and stop

When marking a step DONE, agents may also append a brief "Completed YYYY-MM-DD: <one-line summary>" under the step header for future reference.
