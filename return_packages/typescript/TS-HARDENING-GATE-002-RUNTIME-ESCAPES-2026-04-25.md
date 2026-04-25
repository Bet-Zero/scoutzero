# TS-HARDENING-GATE-002 — Runtime Type Escape Audit

Date: 2026-04-25

Verdict: PHASE COMPLETE — HARDENING STILL INCOMPLETE

## Summary

Completed Gate 2 by removing narrow production/runtime type escape markers and
documenting every remaining true runtime-source escape in
`docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`.

The Gate 2 scan now has 80 matches:

- 9 true type escape markers, all listed in the Gate 2 exception table.
- 71 false-positive prose, comment, UI text, or string-literal matches.

## Files Changed

- `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`
- `src/features/architect/hooks/useArchitectPlayerData.ts`
- `src/features/architect/hooks/useTradeMachine.ts`
- `src/features/architect/utils/capLegalityValidation.ts`
- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/features/architect/utils/contractSalaryUtils.ts`
- `src/features/architect/utils/leagueInvariants.ts`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/seasonFormat.ts`
- `src/features/architect/utils/seasonManager.ts`
- `src/features/architect/utils/tradeMachine/engine/validationUtils.ts`
- `src/features/architect/utils/tradeMachine/utils/capUtils.ts`
- `src/features/filters/FiltersPanel/FilterPanel/sections/PhysicalFilters.tsx`
- `src/features/roster/RosterSection/BenchCard.tsx`
- `src/features/roster/RosterSection/RotationCard.tsx`
- `src/features/roster/RosterSection/StarterCard.tsx`
- `src/shared/components/ui/filters/BadgeFilterSelect.tsx`
- `src/shared/components/ui/filters/RangeSelector.tsx`
- `src/shared/components/ui/filters/RoleChecklist.tsx`
- `src/shared/hooks/useFirebaseQuery.ts`
- `src/shared/utils/filtering/playerFilterUtils.ts`
- `src/tests/architect/myct_step2_guardrails.test.ts`

## Validation

- `rg -n "\bany\b|as any|as unknown as|Record<string, any>|@ts-ignore|@ts-expect-error" src -g '*.ts' -g '*.tsx' -g '*.d.ts' -g '!src/tests/**'` — PASS by classification; 80 hits, 9 true escapes exception-listed, 71 false positives.
- `npm run typecheck` — PASS.
- `npm run test:node -- --reporter=dot src/tests/architect/myct_step2_guardrails.test.ts src/tests/architect/finalSharedFilterBlockers.behavior.test.tsx src/tests/tradeMachine/validationUtils.contract.test.ts tests/contractSalaryUtils.test.ts src/tests/architect/phase86_league_invariants.test.ts src/tests/architect/useTradeMachine.compatibility.guardrail.test.ts` — PASS; 5 files and 52 tests passed.
- `npm run lint:md` — PASS.
- `git diff --check` — PASS.

## Validation Notes

- `npm run test:diff -- --reporter=dot` was attempted first. It unexpectedly selected guarded `npm run test:full` because of a pre-existing shared/config diff and failed after 379.05s on `src/tests/architect/myct_step2_guardrails.test.ts`, whose source-scan expectation still required the removed `as any`. The guardrail was updated, and targeted validation passed.

## Commands Intentionally Skipped

- `npm run validate:project` — skipped because this step did not add source exports, folders, or project-structure changes.
- `npm run build` — skipped because this step did not change routes or production UI behavior beyond type-only component prop narrowing.
- `npm run test:full` — not intentionally run; full-suite execution was selected internally by `test:diff` and failed as documented above. No completion claim relies on it.

## Remaining Hardening Gates

Gates 4, 5, 6, and 7 still fail pending runtime-boundary, test/mock,
JS-like-file, and schema-escape audits. Gate 8 cannot pass until all prior
gates pass and a final completion package is produced.
