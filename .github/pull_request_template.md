## Scope

Fixes BZE-XXX

<!-- Link completed foundations descriptively here. Do not use Refs for Done issues. -->

Foundation context: [descriptive foundation name](https://linear.app/...)

## Draft review and freeze record

- Focused failure-testing matrix derived from this tranche's risk contract:
- Available automated reviewers started while the PR was draft:
- Findings resolved or disproved:
- Optional reviewers unavailable or rate-limited (record; do not wait indefinitely):
- [ ] Author review is complete and every available automated-review finding is settled
- [ ] Candidate was frozen only after the preceding author and automated-review work
- [ ] Required hosted CI is green on the final exact head
- [ ] Immutable Claude prompt was generated only after that exact-head CI was green
- [ ] Claude prompt has been invalidated and replaced after any subsequent head change

## Exact candidate record

| Field               | Receipt                            |
| ------------------- | ---------------------------------- |
| Base SHA            | `...`                              |
| Candidate SHA       | `...`                              |
| Risk class          | `...`                              |
| Declared checks     | `...`                              |
| Canon family/leaves | `...` or `none — workflow/tooling` |

## Evidence

### Author

- Risk-contract-specific failure matrix:
- Focused positive proof:
- Fail-closed counterfactual:
- Other declared checks:

### Hosted exact-head CI

- Required checks and candidate:

### Independent review

- Immutable prompt generated after final-head CI, with prompt link:
- Reviewer, exact base/head, verdict, and request/receipt link:
- Adversarial probes and test non-vacuity:

### Browser/emulator

- Result and exact-candidate artifact link/path, or risk-based skip:

### Skipped checks and limitations

- Intentionally skipped:
- Known limitations:
- Source-blocked record (field, authority, last check, unblock event), if any:

### Repair and evidence reuse

- Candidate repairs, discriminating checks, affected evidence rerun, and
  unaffected evidence reused:

## Merge eligibility

- [ ] Candidate is frozen and unchanged since required evidence/review
- [ ] Base/head are clean, synchronized, and ancestry is verified
- [ ] Every available automated-review finding was resolved or disproved before freeze
- [ ] Optional automated-review unavailability/rate limiting is recorded without indefinite waiting
- [ ] Required hosted CI is green on the exact candidate
- [ ] Independent-Claude prompt was generated after that exact-head CI and still names the current head
- [ ] Independent Claude returned `ACCEPT` on the exact candidate
- [ ] Required browser/emulator proof passed, or the declared risk contract justifies a skip
- [ ] No unresolved thread, product decision, authority ambiguity, failed QA, scope expansion, or material architecture/data concern remains
- [ ] Linear receipt will link here instead of duplicating this report
