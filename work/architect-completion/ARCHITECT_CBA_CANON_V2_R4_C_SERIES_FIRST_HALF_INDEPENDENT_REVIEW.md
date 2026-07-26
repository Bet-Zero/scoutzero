# Architect CBA Canon v2.0 — R4 independent review

## Verdict

**REJECT / BLOCK-R5**

The exact R4 maker checkpoint
`2fc11880025c917dc765fd2f18e5e3697c5661f2` is mechanically coherent but is
not source-accurate or atomic enough to accept. The signed CBA directly
contradicts material C09 and C10 rules, and several C13 rules combine
independently testable requirements. R4 remains in progress. R5, Phase 2,
W1.1, application comparison, and application implementation remain blocked
and unstarted.

Checker: independent role `/root/r4_checker`  
Review date: `2026-07-26`  
Maker base accepted before R4:
`9239c1d3dc595538beb048c77788cd2c453240a4`

## Reviewed scope and state

The worktree was clean at review start. Local `HEAD` and
`origin/architect/cba-canon-v2` both resolved to the exact maker checkpoint.
The maker commit changes only the three authorized files:

- `docs/reference/cba/ARCHITECT_CBA_CANON.md`
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_R4_C_SERIES_FIRST_HALF_CERTIFICATION.md`

The accepted R3.1 checkpoint is an ancestor. Local and remote `main` remained
at `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`. The retained recovery stash was
left untouched:

`stash@{0}: On cba-canon-v2: codex-r31-in-progress-before-authorized-same-family-compat-20260723`

The checker independently inspected the C01–C13 active rules, historical
fragment crosswalk, `EV2` source rows, decision records, search/disposition
records, AMEND detail, maker receipt, and maker diff.

## Independent source basis

The controlling artifact was the signed 2023 NBA–NBPA CBA, 676 PDF pages,
2,850,534 bytes, SHA-256
`bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`
(`SRC2-001`). The official NBPA CBA publication and the official 2025-26 NBA
cap release were also independently checked.

The primary review concentrated on Article VII §§2(c), 2(d), 2(e), 4, and 6
and Article II, while also sampling the remaining C01–C13 evidence chains and
checking each historical fragment's current owner or terminal disposition.

## Blocking repair findings

### 1. C09.1 confuses the Tax Bracket Amount with tax rates

`CBA2-C09.1` and `EV2-0205` state that the Tax Bracket Amount is 3.5% of the
Salary Cap in 2025-26 and 4.75% thereafter. Those percentages are tax-rate
values, not the Tax Bracket Amount.

Article VII §2(d)(1)(ii), printed page 181, defines the Tax Bracket Amount as
five million dollars multiplied by the current Salary Cap and divided by the
2023-24 Salary Cap. Repair the active rule and evidence, then update every
affected fragment, crosswalk, decision, AMEND, receipt, status, and derived
count through forward lineage.

### 2. C10 materially misstates the Minimum Team Salary system

The maker correctly recognized that the CBA uses distinct adjusted bases, but
the registered rules implement those bases and consequences incorrectly.
Repair the entire affected C10 chain rather than making isolated wording
changes.

1. `CBA2-C10.5` uses the lesser of the current and season-start shortfalls.
   Article VII §2(c)(3) instead subtracts the lesser of the two underlying
   Team Salary bases from the MTS. That produces the greater shortfall.

2. `CBA2-C10.6` and `EV2-0217` invent an unconditional rule removing the
   charge the day after the current base reaches the threshold and cite
   §2(c)(2). The signed provision contains no such general removal rule. In
   particular, a season-start shortfall can remain in the charge calculation
   even after the current base reaches the season-start threshold.

3. `DR2-0108` and `XW2-0231` classify historical fragment
   `CBA-C10.4:F2` as an invalid prompt-correction duty. Article VII §2(c)(4),
   printed page 178, expressly requires a team whose MTS Cap Hold Team Salary
   falls below the MTS Threshold during the Regular Season to increase it to
   the threshold by the end of the immediately following day. Restore that
   fragment to supported ownership through AMEND lineage.

4. `CBA2-C10.7`, `EV2-0218`, and `XW2-0227` describe MTS Payment Team Salary
   as a final or year-end base. Article VII §2(c)(1)(ii) fixes that defined
   base at the start of the first Regular Season day, subject to three stated
   adjustments. Section 2(c)(2) uses it for the first payment; §2(c)(5)
   separately supplies the end-of-year additional-payment calculation.

5. `CBA2-C10.9` and `EV2-0220` attribute final BRI, tax, and incentive
   accounting to §2(c)(3), which only defines the MTS Cap Hold. The
   end-of-year additional payment and earned/unearned incentive adjustments
   are in §2(c)(5). Rewrite this rule to the exact supported consequence and
   locator; do not retain unsupported BRI/tax claims.

6. `CBA2-C10.10` reduces the payment timing to ten days after a final
   determination. Article VII §2(c)(6) requires the team to pay the NBA within
   ten business days after completion of the Governing Audit Report, then
   requires the NBA to distribute the funds equally within ten business days
   after receipt.

7. The supporting locators are displaced:

   - `EV2-0212`: the 90% requirement is in §2(a)(4)(i), printed page 169,
     not §2(c)(1).
   - `EV2-0213`: MTS Cap Hold Team Salary is defined in §2(c)(1)(i), not
     §2(c)(4).
   - `EV2-0214`: MTS Payment Team Salary is defined in §2(c)(1)(ii), not
     §2(c)(5).
   - `EV2-0216`: the MTS Cap Hold formula is in §2(c)(3), not §2(c)(2).

Reconcile `XW2-0233` with the actual §2(c)(5) year-end additional-payment
rule. Re-run the atomicity test after the legal results are corrected, and
update the receipt's C10 narrative, evidence, decisions, dispositions, AMEND
detail, statuses, and counts to match the resulting active population.

### 3. Multiple C13 rules are not atomic

The canon's own atomicity contract permits a retained list only when its
members have the same authority, method, lifecycle, and one result. The
following active rules contain independently pass/fail requirements:

- `CBA2-C13.6` combines Minimum Exception term, salary/bonus terms, and
  conditional Regular Season proration.
- `CBA2-C13.11` combines the Taxpayer MLE signing-only method, divisibility,
  maximum term, and annual-change limit.
- `CBA2-C13.12` combines Room MLE contract shape with
  availability/exclusivity and replaces the exact historical three-year/5%
  requirement with vague “stated term/raise authority” language.
- `CBA2-C13.14` combines BAE term/annual-change requirements with its
  consecutive-year availability lifecycle.

Split these into independently evaluable owners, or use a governed bundle only
where the canon's same-kind homogeneous-list exception is actually satisfied.
`DR2-0104` does not justify the mixed results, and it does not cover
`CBA2-C13.14`.

The maker's three R4 deferral exits are mechanically present, but
`XW2-0147 → CBA2-C13.6` and `XW2-0155 → CBA2-C13.11` must be reconsidered
after the owners are made atomic. Preserve the existing identities and revise
through AMEND records.

### 4. C13 acquisition methods overstate the cited authority

`CBA2-C13.8` and `CBA2-C13.13` include waiver-claim methods, but their cited
Article VII §§6(e) and 6(d) passages expressly describe signing and/or
acquisition by assignment. Those passages do not expressly establish waiver
claims.

Either supply qualifying primary authority for the claim method or remove or
qualify the claim wording. Also preserve the signed transition: NTMLE and BAE
acquisition by assignment was not permitted before the 2024-25 Salary Cap
Year. Update the evidence and fragment ownership with the rule.

### 5. EV2-0204 carries an unrelated Article II locator

`CBA2-C08.8` is substantively supported by Article VII
§2(d)(1)(i)(E), including the NBA-paid 50% component and the suspension
compensation adjustment. `EV2-0204` also cites Article II §11, printed pages
48–50, which concerns Two-Way Contracts and does not support this tax
adjustment. Remove or correct the unrelated locator.

## Findings that do not block independently

- The historical C07.6 bundle is correctly split: `CBA2-C07.7` owns
  adjustment (vi), subtraction of unsigned First Round Pick amounts, while
  `CBA2-C07.8` owns adjustment (vii), addition of an outstanding Required
  Tender to a First Round Pick. The invalid second-round extension is
  properly rejected.
- The C05.4 reimbursement-extinction fragment has a documented bounded
  CBA/By-Laws/NBA/operations search and no located qualifying authority.
  Its unsupported-residual disposition is reasonable within the recorded
  source set and cutoff. The waived-contract Team Salary rule remains
  separately active.
- Treating the C13.1 application-ledger prescription as process-only is
  reasonable because the underlying legal amounts, methods, dates, and apron
  consequences have legal owners.
- Identity preservation, AMEND mechanics, historical-fragment partitioning,
  and the three R4 deferral-exit records pass mechanically. The substantive
  C10 and C13 repairs above still require those records to be revised through
  lineage rather than rewritten.
- No C14–C25, R/L/S, scenario, application, test, configuration, graph-output,
  Linear, or `main` work entered the maker checkpoint.

## Mechanical results

The committed complete-document validator passed its baseline, all 14
accepting cases, and all 109 rejecting cases. Its negative self-test failed as
intended. It reported zero failures and these current populations:

| Population | Result |
|---|---:|
| GROUP | 25 total: 12 A-family + 13 C-family |
| Active LEAF | 250 total: 151 A-family + 99 C-family |
| XW2 | 273 live; high-water `XW2-0278` |
| EV2 | 258; high-water `EV2-0258` |
| DR2 | 110; high-water `DR2-0110` |
| Fragment inventory | 263 |
| AMEND detail | 237 |
| BND | 10 inherited; zero added by R4 |
| DISP | 18 |
| Search records / sets | 9 `SM2` / 2 `SS2` |

These results prove conformance to the accepted mechanical contract; they do
not prove that the registered rule text matches the signed source.

## Validation actually run

- `python3 work/architect-completion/cba_canon_v2_foundation_validator.py`
  — PASS.
- `git diff --check` — PASS.
- `npm run docs:guardrails` — PASS.
- `npm run validate:project` — PASS.
- `npm run test:diff -- --files docs/reference/cba/ARCHITECT_CBA_CANON.md work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md work/architect-completion/ARCHITECT_CBA_CANON_V2_R4_C_SERIES_FIRST_HALF_CERTIFICATION.md --reporter=dot`
  — PASS, FAST support-file tier, 12 files and 57 tests.
- `npx markdownlint work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md work/architect-completion/ARCHITECT_CBA_CANON_V2_R4_C_SERIES_FIRST_HALF_CERTIFICATION.md`
  — PASS.
- `npm run lint:md` — FAIL only on pre-existing repository-wide findings,
  including unrelated documents and preserved canon scenario-list `MD029`
  findings. Running markdownlint against the canon from accepted R3.1
  reproduced the same scenario-list failure, so it is not maker-caused.

`npm run build`, `npm run typecheck`, and application suites were intentionally
skipped because R4 is documentation-only. The full suite was prohibited by
the task boundary. `graphify update .` was intentionally skipped because
graph output is expressly outside R4.

## Review limitations

This review is an independent R4 source and lineage audit, not the future R9
whole-program replay. The C05.4 negative-source conclusion remains bounded to
the recorded source set and cutoff. A fresh unauthenticated By-Laws CDN
request was unavailable, so the checker relied on the already-accepted
`SRC2-002` artifact identity for that bounded search. The mechanical validator
cannot detect the substantive source errors identified above.

## Required next checkpoint

The maker must repair all five finding groups within the authorized maker
files, preserve prior identities through the governed AMEND structures, run
the proportionate R4 gates, and commit and push a new clean maker checkpoint.
A separate checker review of that exact new maker commit is required. This
receipt does not accept R4 and does not unblock R5.
