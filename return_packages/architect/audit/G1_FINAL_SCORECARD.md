# G1 Final Scorecard

## Scoring Model Source
Scored using blueprint weights from:
`docs/architect/audits/ARCHITECT_FULL_SYSTEM_AUDIT_BLUEPRINT.md` -> `## 5) Agent-Orchestrated A->G Pipeline` -> `### Stage G - Confidence Scoring and Ship Verdict` -> `Scoring model (weighted)`.

## Weighted Category Scores

| Category | Weight | Score | Weighted Contribution | Rationale |
|---|---:|---:|---:|---|
| Functional flows | 20% | 74 | 14.80 | Core flows mostly wired, but offseason guardrail regression blocks one key workflow readiness signal. |
| Rules correctness | 25% | 84 | 21.00 | Trade and rules suites pass strongly; no critical rule violations found in sampled domains. |
| Persistence/data integrity | 20% | 82 | 16.40 | World-scoped write paths and contracts are strong; one constants-drift risk remains. |
| UX truthfulness | 15% | 65 | 9.75 | Fallback code-trace completed, but no runtime UX proof and an offseason truth/copy guardrail failure remains. |
| Security/boundaries | 15% | 90 | 13.50 | Rules deny base writes and fail closed; static guardrails align with policy. |
| Operational readiness | 5% | 60 | 3.00 | Mandatory checks ran, but architect scoped suite is not clean and runtime UX/security proofs are queued. |

## Final Score
- Total weighted score: `78.45 / 100`

## Verdict Threshold Application
- Critical findings present: `No`
- Score band: `<80`
- Final verdict: `Not Ready`

## Severity + Queue Snapshot
- Critical: `0`
- High: `1`
- Medium: `1`
- Low: `1`
- Verification Queue total: `3`
- Queued ship-blocking items: `1`
