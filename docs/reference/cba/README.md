# Architect CBA Canon — Status Notice

**There is currently no owner-accepted active Architect CBA audit canon.**

## Current status

| Edition | Status | SHA-256 |
|---|---|---|
| Canon v1.0 | Historical | `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef` |
| Canon v1.1 | Historical — **rejected by independent acceptance review** | `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6` |
| Canon v2.0 | Working draft — R3.1 and R4 independently accepted; R5 unstarted | — |

## What this means

- Canon v1.1 (`ARCHITECT_CBA_CANON.md` in this directory) was published at
  commit `9814939c` and subsequently **rejected** by an independent
  read-only acceptance review, upheld by a second independent adjudication.
- **v1.1 must not be used for Phase 2 verdicts, implementation decisions, or
  tests.** It contains confirmed substantive errors against the signed 2023
  NBA–NBPA CBA, a register that is not reliably unique or atomic, and
  scenario mappings that do not prove their assigned obligations.
- The published v1.1 artifact is preserved by its checksum and Git commit
  `9814939c`. On `architect/cba-canon-v2`, the same canon path now contains
  the v2.0 working draft and is therefore not byte-identical to v1.1. Use the
  pinned historical commit—not the branch working file—to verify v1.1.
- Canon v2.0 preserves the completed R1–R4 history and now follows the lean
  post-R4 R5–R9 sequence in the repair plan. Full relevant-rule coverage,
  per-rule primary-source certification, independent R5/R6 source review, a
  final independent whole-canon review, and owner acceptance remain required.

## Gates

- **Phase 1 remains open.**
- The process revision recorded with this notice must be committed and pushed
  on a clean synchronized topic branch before R5 begins. R5 remains unstarted.
- **Phase 2, the Architect comparison, application fixes, work unit W1.1,
  and Linear changes remain blocked** until Canon v2.0 receives R9
  independent whole-canon ACCEPT at a pinned clean commit and explicit owner
  acceptance.

## Review record

- Codex acceptance review (REJECT/BLOCK):
  `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_CODEX_ACCEPTANCE_REVIEW.md`
- Claude independent adjudication (rejection upheld):
  `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_CLAUDE_ADJUDICATION.md`
- v2.0 repair plan:
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
- R4 independent acceptance:
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_R4_C_SERIES_FIRST_HALF_INDEPENDENT_REVIEW.md`
