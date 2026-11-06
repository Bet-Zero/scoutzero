# BZE-344: June 5 starting-state preparation

Implementation after [PR #617](https://github.com/Bet-Zero/scoutzero/pull/617),
base `6d090ed9b7f236eae7407249e8b4d6a9d647b6c0`. Live main, BZE-243,
BZE-309, governing instructions, V1 contract and the C6 assessment were verified
on November 6, 2026. They were unchanged at implementation entry. This delivery
does not close C6 normal-product admission, W9 or W10.

## Built

- `scripts/architect/prepareJune5DraftState.ts` compiles the recovered private
  evidence into one dated candidate, verifies original C6/archive/input hashes,
  and writes only to a new private directory outside the repository. It refuses
  overwrites and changed extracted source bytes. The adjacent recovery JSON is
  an offline integrity manifest, **not a runtime source trust pin**.
- `src/schemas/draftStartingState.ts` preserves the complete inventory, exact
  unresolved crosswalk, reported custody, scoped original-ownership facts,
  source terms, historical restrictions and explicit missing team inputs.
- `src/features/architect/utils/draftStartingState.ts` checks date, identity,
  source/Contract consistency and retained terms. Fresh-world preparation uses
  the existing Contract baseline builder and document-set validator. Original
  selection preparation feeds the existing ownership, Stepien, consideration,
  trading-window and Apron engines. There is no second rule engine.
- Prepared JSON must be validated again after reload. It cannot be supplied as
  an Apply capability. The world preparation has `writes: []`; no initializer,
  writer, capability, installed pin, permission, migration or product gate was
  modified. The existing initializer and atomic writer remain the owners of
  eventual adoption and saving after the separate approvals and required inputs.

This connects a private candidate to the existing **preparation and review**
interfaces. It does not install executable draft state into ordinary worlds.
The application does not import or fetch this private package.

## What the candidate actually establishes

Effective instant remains `2026-06-05T12:19:56.526Z`, SCY 2026, season 2025–26.
All 278 retained identities, 1,483 occurrence references, 877 dependency
identities, five predecessor references and the exact 29 unresolved mappings
remain in the original evidence/assessment lineage. No evidence disposition is
promoted. The accepted 331/389/128/29/0 accounting is unchanged.

| Prepared information | Scope and remaining limit |
| --- | --- |
| 177 explicit reported-holder values | Bound to retained cells or accepted corrections and the accepted June 5 holder partition. An ID, an empty cell, or a supported label is never the holder value. These scoped determinations do not establish every attached claim or an unconditional transfer. |
| 56 conditional-holder identities and seven unresolved holders | Alternatives, clauses and accepted limitations remain attached. No future election is fabricated, and a future simulated result is not requested as a present NBA fact. |
| 25 native grant mappings, one unresolved native identity and 12 archival aliases | Preserved with source context and later-event exclusions. Native identity is not complete allocation/transfer admission. The two WAS 2028 representations are not two spendable rights. |
| 57 of 60 historical Apron determinations | Explicit above/not-above values with the original source limitations; four above determinations remain. No salary amount is synthesized. The three unresolved GSW/LAC/NYK 2025–26 measurements remain unresolved. |
| 120 later measurement identities | Measurement outcomes remain future information. The separately accepted 89 conditional non-applicable lifecycle references retain their gate dependencies and restoration scope; they are not silently reopened or counted as missing present facts. Later audit closures do not automatically extend that 89-record disposition. |
| Trusted Contract baseline | Existing release digest `sha256:46db3137308ff1c05e0066edf09ef08d45b923bea7a2bcec93fd408adf5950`; existing builder produces all 774 Contract ledgers. Replay completeness remains 772, with the same two needs-input records. |
| 30 team financial input records | Existing salary-book schema, explicitly needs-input. No zero payroll, bonus, incentive, hard-cap capacity, cash balance or exception balance is invented. |

The seven additional historical Apron value bindings reuse existing accepted
reviews [a3925d77](https://linear.app/bzero/issue/BZE-309#comment-a3925d77-4e1e-4f5b-b4ed-776dcd711233)
and [b91d5c8d](https://linear.app/bzero/issue/BZE-309#comment-b91d5c8d-d2a7-43bf-9674-a8bce8a4a9df).
The frozen-holder scope comes from [32754373](https://linear.app/bzero/issue/BZE-309#comment-32754373-0d79-4a84-a10e-a8e1a5c51b95),
not the Frozen label alone. Conditional lifecycle relevance reuses
[e8c66157](https://linear.app/bzero/issue/BZE-309#comment-e8c66157-5c85-4086-95dd-56d1eb87401d).
Later reports used in those accepted historical determinations do not install
the later trades, forfeitures or ownership changes into the June 5 world.

## First ordinary transaction: exact limit

There is **no completely authenticated whole transaction** in these inputs.
The strongest already compiled custody anchor is Philadelphia's unprotected
Clippers 2028 original first. Its existing accepted ownership fact passes the
existing ownership engine; the existing engine also establishes the pre-rule
Apron treatment and June 5 trading window. The new package does not pretend
that the other 176 reported-holder values have that same complete claim scope.

The smallest supported path is an original-first exchange using that anchor
and an independently eligible return asset. It still requires:

1. Complete source-bound first-round possession/obligation branches for every
   affected team through the qualified 2026–2032 scope, including attached
   protections, reservations and any relevant continuation. The retained
   clauses are available; reported custody alone does not certify branch closure.
2. A concrete counterparty and complete exchange inputs for the existing
   consideration rule. No counterparty, return asset or hypothetical right was
   invented to manufacture a successful demonstration.
3. The affected teams' qualified June 5 roster/Contract associations, dead cap,
   cap holds, unsigned-first/incomplete-roster state, Apron adjustments/tax
   inputs and hard-cap history/capacity. Cash/exception ledgers and player
   mechanism evidence are required only when the chosen transaction uses them.
   The trusted Contract release does not supply these complete team books.

The private anchor preview therefore returns Stepien and consideration
needs-input, financial missing-input categories and blocked Apply. It is not a
trade proposal or a completed normal-world transaction. Unrelated unresolved
entitlements do not veto the component review; the focused test demonstrates
complete action-local inputs can pass existing component engines while the
separate financial and activation gates remain closed.

For full V1, complete the remaining source-to-operation bindings and supported
conditional/lifecycle inputs across the full retained scope, keep the exact 29
evidence blockers and C4/C5 residuals, then perform separately approved source
admission/publication/designation, fresh-world adoption, normal activation and
the required integrated hosted save/reload/lifecycle proof. This delivery does
not turn any remaining C4/C5 requirement into an exclusion.

## Validation and review boundary

Risk contract recorded in BZE-344 before implementation: supported status is not
custody; historical determinations are not numeric salary; later events cannot
be backdated; candidate hashes are not runtime authority. Failure checks cover
changed bytes, membership, mappings, unadmitted ownership, missing terms/history,
invented financial inputs, wrong Contract/date, stale operation context and
reloaded/unprepared objects. Tests also cover an unrelated unresolved right,
complete existing-engine component inputs, Contract world identity and rejection
by the existing Apply capability boundary.

Author evidence: focused tests (12), selected `test:diff` validation including
typecheck, schema check, Architect cast gate and build. The private compiler
reproduced identical candidate/world bytes across builds; all archive members
were verified. A tampered extracted source with unchanged original archive was
rejected before output. Original C6 deliverables remained byte-identical.
No browser/emulator/production proof is claimed: no user flow or writer changed.
The live PR records final exact-head CI and independent Claude code review.

The private source-binding candidate is **pending independent source admission**.
GitHub code review cannot independently inspect local private bytes. Reusing
accepted source judgments is not a claim that the newly compiled package has
already received that separate acceptance. Authorized durable private reviewer
access is a real prerequisite; no owner relay is needed for routine code review.

## Exact private delivery and recovery

Local candidate directory:
`/workspace/work/scoutzero-c6-implementation/candidate-r7/`.
Local archive: `/workspace/output/june5-draft-starting-state-candidate.tar.gz`.
These are working/task files, **not verified durable storage**.

| Artifact | SHA-256 |
| --- | --- |
| `candidate.json` (14,295,235 bytes) | `c6493e5aa1554abcd85fa3ac2922e030104c223186028fc8f45beb5613fa3108` |
| `world-preparation.json` (22,366,065 bytes) | `e01fd2c6cbb9566b98c4caeb1d6ccc89332f395dc20961cf270ff486b5b834ae` |
| `ownership-anchor-preview.json` (4,355 bytes) | `40305e8a60c7baea7644f9a2cd804c99015a6f821312b9cedef307d8e07087cf` |
| Candidate archive (6,654,967 bytes) | `4751d71f04b7834bf5d264bd49e3322b16afba4ae0663e1b4d9cbd235c9aea5a` |

The archive includes `RECOVERY.md`, exact member/source manifests, compiler,
private value bindings, four retained acceptance comments and local source/failure verification receipts.
It includes no installed source designation or normal-world write authorization.
The original C6 map SHA remains
`7b71c6f9c69addc66ead13d05102e3b4a5001adef3dfd168ef6fedf8d1c5ce88`;
original archive SHA remains
`43a129a009af323d0bd369f4bd173cb9cd00fd5995326651159aaa7b09d12ee9`.
Their original `/workspace/output/` and `/workspace/work/scoutzero-c6/` copies
remain present. They were never uploaded to Linear.

The [C6 assessment](C6_NORMAL_WORLD_ADMISSION.md) retains all six original
private attachment locators. Newly recovered existing inputs are BZE-309
attachments `ca3fbacf-5d7f-4c7f-a7e7-3d1b275126c7` (Family D archive SHA
`99828051873a1a88a55713c7347faa208706dcaf9943d3f27761286002df9aa1`)
and `9f56d9ac-2ba2-4ab1-9774-b82dd851b41c` (holder archive SHA
`c4a2c7952294482a1f359eaed5c518ec864f4ec8ba399118f0203606bb88d708`).
No fresh NBA source acquisition or exhausted C4 research was performed.

**Exact next action:** obtain authorization for a named durable private storage
and reviewer-access destination for this frozen package, then independently
review its new source bindings. Separately complete the dated affected-team
financial and branch inputs above; those factual gaps cannot be approved away.
The prior automatic-review denial of private archive export to Linear remains
in force. This delivery exports no private package and requests no production
activation. Stop here; no next investigation or implementation starts automatically.

## Output-alias repair in the same delivery

After PR #618 landed, a focused author check found that the CLI checked the
spelled destination for `public` but could lose that component when its parent
was a symlink. The accepted parent was shown to reach the deliberately missing
evidence read through a symlink to a temporary public directory; no source data
was used or written. The guard now checks both the canonical parent and spelled
destination before evidence access. Two focused CLI regressions cover that alias,
a public destination name and an alias into the repository.

Candidate, world-preparation and ownership-preview bytes remain identical to
PR #618. Only the bundled compiler and repair receipt change the archive hash.
The prior archive is retained at
`/workspace/work/scoutzero-c6-implementation/candidate-r6.tar.gz`, SHA-256
`8c1853b407de6a42a0070671ac6a2d8a318b782bcfc962e7dc7303a1a198fd72`.
The original 12 preparation tests, source checks and bounded independent review
remain applicable to unchanged behavior; the follow-up PR records the focused
repair checks and fresh exact-candidate independent review. No new source claim,
adoption or activation is introduced by this repair.
