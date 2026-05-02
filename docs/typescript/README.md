# TypeScript Documentation Status

TypeScript migration, hardening, and zero-exception hardening are complete in this repository.

Treat TypeScript as a maintenance gate, not as an active repo-wide campaign.

- Do not reopen TypeScript hardening unless a documented gate regresses.
- Use [TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md](TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md) as the maintenance gate for future regressions.
- Use [TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md](TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md) for the completed zero-exception closure record.

## Current Required Docs

- [TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md](TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md) - current maintenance gate and regression checklist.
- [TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md](TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md) - completed zero-exception closure record and regression reference.
- [../INDEX.md](../INDEX.md) - repo-level documentation entry point.
- [../guides/DEVELOPER_GUIDE.md](../guides/DEVELOPER_GUIDE.md) - developer-facing conventions and routing.
- [../../AGENTS.md](../../AGENTS.md) - agent operating rules and the repo-wide reopen policy.

## Completed Historical TypeScript Campaign Docs

These files remain in the repository as evidence from the completed TypeScript campaign. Read them for history or audit context, not as active execution instructions.

- [../TYPESCRIPT_HARDENING_NEXT_STEPS.md](../TYPESCRIPT_HARDENING_NEXT_STEPS.md)
- [../TS_CONVERSION_NEXT_STEPS.md](../TS_CONVERSION_NEXT_STEPS.md)
- [../TS_CONVERSION_PILE_A_AUDIT.md](../TS_CONVERSION_PILE_A_AUDIT.md)
- [../TS_CONVERSION_PILE_B_AUDIT.md](../TS_CONVERSION_PILE_B_AUDIT.md)
- [../TS_CONVERSION_PILE_C_PLAN.md](../TS_CONVERSION_PILE_C_PLAN.md)
- [../TS_CONVERSION_PILE_D_TESTS_PLAN.md](../TS_CONVERSION_PILE_D_TESTS_PLAN.md)
- [TYPESCRIPT_CONTINUOUS_EXECUTION_PROTOCOL.md](TYPESCRIPT_CONTINUOUS_EXECUTION_PROTOCOL.md)
- [TYPESCRIPT_HARDENING_BASELINE.md](TYPESCRIPT_HARDENING_BASELINE.md)
- [TYPESCRIPT_HARDENING_EXECUTION_MAP.md](TYPESCRIPT_HARDENING_EXECUTION_MAP.md)
- [TYPESCRIPT_HARDENING_FINAL_REVIEW.md](TYPESCRIPT_HARDENING_FINAL_REVIEW.md)
- [TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md](TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md)
- [TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md](TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md)

## Return-Package Evidence Archives

Use these archives when you need execution evidence rather than current routing rules.

- [../../return_packages/typescript/](../../return_packages/typescript/) - TypeScript hardening and zero-exception execution evidence archive.
- [../../return_packages/docs/POST_TYPESCRIPT_DOC_STABILIZATION_2026-05-02.md](../../return_packages/docs/POST_TYPESCRIPT_DOC_STABILIZATION_2026-05-02.md) - bounded documentation stabilization evidence for this cleanup pass.

## Reopen Rule

Reopen TypeScript campaign work only if one of these conditions becomes true:

- the completion contract gates fail again
- zero-exception invariants regress
- a new TypeScript regression creates fresh maintenance debt that the completion contract does not already classify as closed

If that happens, start from the maintenance gate docs above and create a new bounded plan for the regression. Do not resume the old campaign plans by default.
