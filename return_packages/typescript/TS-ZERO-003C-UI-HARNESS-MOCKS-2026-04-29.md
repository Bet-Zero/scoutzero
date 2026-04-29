# TS-ZERO-003C Partial - UI Harness Mock Hardening

Date: 2026-04-29

## Summary

This partial TS-ZERO-003C checkpoint removed practical broad test/mock markers
from four Architect UI/mock harness files. Gate 4 remains open because the
repo-wide test/mock scan still includes other practical clusters.

## Files Changed

- `src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx`
- `src/tests/architect/grouped33FileScope.ui.behavior.test.tsx`
- `src/tests/architect/pickRightWizard.vacuumApply.test.tsx`
- `src/tests/architect/tradePlayerRow.signAndTradeInjector.test.tsx`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`
- `return_packages/typescript/TS-ZERO-003C-UI-HARNESS-MOCKS-2026-04-29.md`

## Validation

- PASS: target file scan for `any`, `as any`, `Record<string, any>`,
  `as unknown as`, `@ts-ignore`, and `@ts-expect-error`
- PASS: `npm run typecheck`
- PASS: `npm run test:architect -- --reporter=dot`
- PASS: `npm run lint:md`
- PASS: `npm run validate:project`
- PASS: `git diff --check`

## Commands Intentionally Skipped

- `npm run test:full`: skipped because the prompt did not contain the required
  exact phrase `RUN FULL SUITE`.
- `npm run build`: skipped because this checkpoint only changes tests and docs,
  not runtime UI, route, or component behavior.

## Remaining Work

Continue TS-ZERO-003C on the remaining Gate 4 scan clusters, especially
cap-sheet UI flow state bags, season-advance helper mocks, trade validator
result bags, and central Firebase/team-plan mock bags.
