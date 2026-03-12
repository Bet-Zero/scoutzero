# TypeScript Migration Re-Evaluation Prompt

Paste the prompt below into a new Claude Code session to get a fresh migration status report.

---

## Prompt

```
Re-evaluate the Architect TypeScript migration status. The previous roadmap is at `.claude/plans/replicated-floating-moon.md` and baseline notes are in memory at `memory/ts-migration-roadmap.md`.

Do the following:

1. Scan `src/features/architect/` for all .js/.jsx/.ts/.tsx files using glob patterns:
   - `src/features/architect/**/*.js`
   - `src/features/architect/**/*.jsx`
   - `src/features/architect/**/*.ts`
   - `src/features/architect/**/*.tsx`

2. For each .js/.jsx file, classify it as:
   - **Shim**: re-exports from a .ts/.tsx peer (skip — already migrated)
   - **Live**: real business logic with no .ts peer (needs migration)
   - **Barrel**: index.js re-export surface (low priority)
   - **Garbage**: 0 importers, unused (candidate for deletion)

3. Compare to the previous roadmap's file lists. Report:
   - Files that have been migrated since last evaluation (moved from JS to TS)
   - Files that are new (didn't exist before)
   - Files that were deleted
   - Updated completion percentage

4. Check the latest E-scope return package in `return_packages/trade_machine/` to see what scope was most recently completed.

5. Produce an updated summary table:
   | Category | Remaining JS | Already TS | % Complete |
   With rows for: Utils, Hooks, Components (by subdirectory), Total

6. List the next 5 recommended migration scopes in order, with file names, line counts, and risk level.

7. Update `memory/ts-migration-roadmap.md` with the new baseline numbers and date.

Output format: structured markdown with tables. Be concise — focus on what changed since last evaluation and what's next.
```
