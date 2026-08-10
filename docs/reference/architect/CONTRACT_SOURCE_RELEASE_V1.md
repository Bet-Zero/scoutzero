# Governed contract-source release v1

This is the readable receipt for the immutable retained source artifact at
`/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json`.
The JSON release is the source of record and names every observation, baseline
contract, evidence path, state digest, missing fact, and later-route blocker.

## Release

- Release: `salaryswish-retained-2026-06-05@v1`
- Digest: `sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950`
- Source observation boundary: `2026-06-05T12:19:56.526Z`
- Salary Cap Year: `2026` (2025-26)
- Transformation: `bze-274-salaryswish-retained-contract-v1`
- Supersedes: none

## Coverage

- Retained observations: 827
- Contract records across all retained observations: 905
- Prior observation artifacts retained but not selected as the baseline: 129
- Prior contract observations retained but not selected as the baseline: 131
- Unique source players: 698
- Contracts in the deterministic latest-observation baseline: 774
- Complete for deterministic retained-source replay: 772
- Needs input for deterministic retained-source replay: 2
- Excluded for structural corruption: 0

- Missing a replayable salary schedule.: 2 (salaryswish:id-1630599:unknown:2025-26:2025-26:veteran-contract, salaryswish:yang-hansen:unknown:2025-26:2025-26:veteran-contract)
- Missing a source-supported signing date.: 2 (salaryswish:id-1630599:unknown:2025-26:2025-26:veteran-contract, salaryswish:yang-hansen:unknown:2025-26:2025-26:veteran-contract)

“Complete” above means the retained record can replay its supported salary and
term state. It does not convert unknown clauses or later-action evidence into
sourced facts.

### Field evidence

- Known field entries: 10783
- Derived field entries with named transformation limits: 15698
- Unknown field entries: 14841
- Unsupported field entries: 6324
- Conflicting field entries: 0

Unknown or conflicting record categories (salary-row indexes collapsed for
accounting only; the release retains each exact indexed path):

- `terms.salaries[].incentives`: 152 records
- `terms.salaries[].option`: 772 records
- `terms.salaries[].optionDecisionDate`: 772 records
- `terms.salaries[].optionDecisionDeadline`: 360 records
- `terms.salaries[].optionHolder`: 772 records
- `terms.salaries[].optionUsed`: 772 records
- `terms.salaries[].tradeBonus`: 772 records
- `terms.salaries[].voidedByExtension`: 772 records
- `terms.salaries[].voidedOn`: 772 records
- `terms.signedUsing`: 4 records
- `terms.signingDate`: 2 records
- `terms.signingExecutive`: 32 records

## Later route readiness

- Pending option contracts ready for action: 0
- Pending option contracts blocked by missing governed evidence: 243
- Contracts ready for extension action: 0
- Contracts blocked from extension action: 774

No option, ETO, extension, or renegotiation action is implemented or authorized
by this release. The release preserves SalarySwish-derived retained evidence and
its transformation limitations; it does not promote the source to an official
league contract feed or reconstruct historical signing transactions.
