# Architect CBA Canon — Status Notice

**There is currently no owner-accepted active Architect CBA audit canon.**

## Current status

| Edition | Status | SHA-256 |
|---|---|---|
| Canon v1.0 | Historical | `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef` |
| Canon v1.1 | Historical — **rejected by independent acceptance review** | `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6` |
| Canon v2.0 | In development via the approved R1–R9 repair process | — |

## What this means

- Canon v1.1 (`ARCHITECT_CBA_CANON.md` in this directory) was published at
  commit `9814939c` and subsequently **rejected** by an independent
  read-only acceptance review, upheld by a second independent adjudication.
- **v1.1 must not be used for Phase 2 verdicts, implementation decisions, or
  tests.** It contains confirmed substantive errors against the signed 2023
  NBA–NBPA CBA, a register that is not reliably unique or atomic, and
  scenario mappings that do not prove their assigned obligations.
- The v1.1 file is deliberately **unmodified** — its published checksum is
  historical evidence and must remain byte-identical. This README, not a
  banner inside the canon, is the rejection notice.
- Canon v2.0 is being developed through the approved R1–R9 repair process
  with full per-LEAF primary-source certification.

## Gates

- **Phase 1 remains open.**
- **Phase 2 and work unit W1.1 are blocked** until Canon v2.0 passes a new
  independent Reviews A–F acceptance gate at a pinned clean commit.

## Review record

- Codex acceptance review (REJECT/BLOCK):
  `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_CODEX_ACCEPTANCE_REVIEW.md`
- Claude independent adjudication (rejection upheld):
  `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_CLAUDE_ADJUDICATION.md`
- v2.0 repair plan:
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
