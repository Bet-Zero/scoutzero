# TS-ZERO-003C Partial - Local Fixture Mock Hardening

Date: 2026-04-29

## Summary

This partial TS-ZERO-003C checkpoint removed practical broad TypeScript escape
markers from nine local fixture/probe test files. Gate 4 remains open because
the repo-wide test/mock scan still includes other negative-boundary and emulator
clusters.

## Files Changed

- `src/tests/architect/mutationPipeline.catchallNarrowing.test.ts`
- `src/tests/architect/pickRightWizardDraft.test.ts`
- `src/tests/architect/tradeEntitlementRouting.test.ts`
- `src/tests/architect/phase15_trade_payload_entitlements_only_guardrail.test.ts`
- `src/tests/architect/phaseC_entitlement_invariants_integration.test.ts`
- `src/tests/architect/devSntInjector.utils.test.ts`
- `src/tests/architect/entitlementDedupe.test.ts`
- `src/tests/architect/architectCoreLogicBlockerTrio.test.ts`
- `src/tests/architect/architectCoreTrioPassR2.test.ts`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`
- `return_packages/typescript/TS-ZERO-003C-LOCAL-FIXTURE-MOCKS-2026-04-29.md`

## Validation

- PASS / FALSE POSITIVES: target file scan for `any`, `as any`,
  `Record<string, any>`, `as unknown as`, `@ts-ignore`, and
  `@ts-expect-error`; remaining hits are prose comments and `expect.any(Date)`.
- FAIL / PRE-EXISTING: `npm run typecheck` completed with diagnostics in
  `player-scrape/firestore_staging/push_staged_players.ts`,
  `src/shared/components/TeamSelectDropdown.tsx`, and
  `src/tests/security/firestoreRules.integration.test.ts`; no diagnostics
  referenced the edited files.
- PASS:
  `npm run test:node -- --reporter=dot src/tests/architect/mutationPipeline.catchallNarrowing.test.ts src/tests/architect/pickRightWizardDraft.test.ts src/tests/architect/tradeEntitlementRouting.test.ts src/tests/architect/phase15_trade_payload_entitlements_only_guardrail.test.ts src/tests/architect/phaseC_entitlement_invariants_integration.test.ts src/tests/architect/devSntInjector.utils.test.ts src/tests/architect/entitlementDedupe.test.ts src/tests/architect/architectCoreLogicBlockerTrio.test.ts src/tests/architect/architectCoreTrioPassR2.test.ts`
  passed with 8 reported files and 75 tests.
- PASS: `npm run validate:project`
- BLOCKED: `npm run lint:md` failed before linting because `markdownlint` is
  not installed in this checkout (`sh: markdownlint: command not found`).
- PASS: `git diff --check`

## Commands Intentionally Skipped

- `npm run test:full`: skipped because the prompt did not contain the required
  exact phrase `RUN FULL SUITE`.
- `npm run build`: skipped because this checkpoint only changes tests and docs,
  not runtime UI, route, or component behavior.

## Remaining Work

Continue TS-ZERO-003C on the remaining Gate 4 scan clusters, especially
negative-boundary and emulator mock files. The next checkpoint should also
re-run root typecheck after the unrelated existing diagnostics are resolved.
