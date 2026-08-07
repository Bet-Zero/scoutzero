# Phase 2 Cross-Model Discrepancy Report (Stage B)

**Comparison:** Claude independent Stage A register (frozen at `a68fea3783b8b17b216ece400fc91d024f2b3d39`)
versus the Codex Phase 2 audit at `f63452d5c57ad3b9ef927de5dfedaf49272eaa9a`.

Stage A was frozen and committed before any Codex artifact was opened. Nothing in the
Stage A register was edited after the comparison began; every correction to it is
recorded here instead.

## 0. Universe

Both audits key exactly the same 815 active v2 LEAF identities, once each: A 151,
C 417, R 118, L 102, S 27. Set equality verified programmatically. Neither audit
invented, dropped, merged or renumbered an identity, and neither assigned a verdict
to a GROUP, a historical `CBA-…` ID, a scenario, or an evidence row.

*(The Stage A summary prose mis-stated the C-family count as 458; the register itself
carries 417 and the family sums to 815. Prose typo, corrected below in §7.)*

## 1. Exact agreement and disagreement counts

| Axis | Agreement | Rate |
|---|---:|---:|
| **Leaf is not fully satisfied** (the audit's actual conclusion) | **804 / 815** | **98.7%** |
| Implementation state, exact 4-value match | 316 / 815 | 38.8% |
| Implementation state, coarse (`absent\|incorrect` vs `partial\|correct`) | 374 / 815 | 45.9% |
| Severity, exact | 321 / 815 | 39.4% |
| Representation / data model | 516 / 815 | 63.3% |
| Calculation | 469 / 815 | 57.5% |
| Enforcement | 540 / 815 | 66.3% |
| Explanation / UI | 520 / 815 | 63.8% |
| Lifecycle / persistence | 516 / 815 | 63.3% |
| Intentional product exclusions | 0 = 0 | exact |

The headline is the first row. On the question Phase 2 was actually asked — *is this
obligation satisfied by the application at the pinned baseline?* — the two audits agree
on 804 of 815 leaves. Every other number below is a disagreement about **how** an
unsatisfied leaf should be labelled, not about **whether** it is unsatisfied.

## 2. Disagreements in implementation state

| Claude → Codex | Leaves |
|---|---:|
| partial → incorrect | 204 |
| partial → absent | 199 |
| absent → absent (agree) | 194 |
| partial → partial (agree) | 111 |
| absent → incorrect | 47 |
| absent → partial | 32 |
| incorrect → incorrect (agree) | 9 |
| partial → correct | 7 |
| incorrect → absent | 4 |
| correct → incorrect | 3 |
| incorrect → partial | 2 |
| correct → correct (agree) | 2 |
| absent → correct | 1 |

Aggregate distributions:

| State | Claude | Codex |
|---|---:|---:|
| correct | 5 | 10 |
| partial | 521 | 145 |
| incorrect | 15 | 263 |
| absent | 274 | 397 |

The disagreement is overwhelmingly directional: Codex is harsher on 450 leaves,
Claude on 42. Two distinct effects are mixed together here and must be separated,
because only one of them is a defect.

**(a) Codex's `incorrect` is broader than Claude's — and Codex's reading is defensible.**
Claude reserved `incorrect` for a behaviour that actively conflicts with the Canon
(a wrong constant, a wrong threshold, a false block). Codex additionally applies
`incorrect` where a partial implementation *produces a Canon-wrong answer* because it
is incomplete. Both are coherent; Codex's is arguably closer to "would this mislead a
GM today". This accounts for most of the 204 partial → incorrect moves and is **not**
grounds for rejection.

**(b) Codex's `absent` sometimes swallows a working route — and Claude's does too.**
199 partial → absent moves are Codex declining to credit fragments. But the reverse
error is Claude's and it is larger per family: see §7.

## 3. Disagreements in product-layer coverage

Layer-by-layer agreement runs 57–66% — markedly higher than the 38.8% headline,
because the layer scales are less sensitive to the `partial`/`incorrect` boundary.

| Layer | Codex absent | Claude absent |
|---|---:|---:|
| Representation | 400 | 252 |
| Calculation | 421 | 260 |
| Enforcement | 428 | 282 |
| Explanation / UI | 399 | 336 |
| Lifecycle / persistence | 472 | 270 |

Codex scores every layer more absent, with lifecycle/persistence the widest gap (472
vs 270). Reviewing the underlying notes, Codex is treating "persists a scalar but not
a dated governed event" as lifecycle-absent; Claude scores it partial. Codex's stricter
reading is the better one for Phase 3 planning: the Canon's lifecycle obligations are
about dated event histories, not stored values. **Codex is right on this axis.**

Codex additionally uses `not applicable` for calculation on 7 leaves (structural or
permission rules with nothing to compute). Claude used `not_applicable` nowhere.
Codex's handling is more precise.

## 4. Disagreements in runtime-input treatment

| Codex | Leaves | Claude | Leaves |
|---|---:|---|---:|
| missing | 718 | unavailable | 231 |
| available | 61 | available | 86 |
| external determination | 35 | *(folded into unavailable)* | — |
| not required | 1 | partial | 498 |

This is largely a **scale mismatch, not a factual dispute**. Claude carries a `partial`
bucket for "some required inputs exist, others do not"; Codex has no such value and
collapses those leaves into `missing`. Both agree on the 195 leaves where the input is
flatly unavailable, and both independently identify the same governing example — the
two-month aggregation bar retired at `timingValidation.ts:66-68,259-260` "until the live
payload carries a reliable acquisition-date field".

Codex's `external determination` value (35 leaves) is a genuine improvement over
Claude's treatment; Claude folded external determinations into the general unavailable
bucket and only separated them in prose.

The one real risk in Codex's presentation: 718/815 = 88% "missing" reads as though the
product is almost entirely data-blocked. That overstates it. Claude's 231 flatly
unavailable plus 498 partially available is the more actionable split, and a Phase 3
data-ingest plan needs the split, not the aggregate.

## 5. Disagreements in evidence strength

Near-exact agreement, and the strongest signal that both audits did real work.

| Claude | Leaves | Codex | Leaves |
|---|---:|---|---:|
| strong | 433 | proven | 446 |
| moderate + weak | 382 | insufficient | 369 |

Both audits independently converge on roughly 55% proven / 45% insufficient, and both
explicitly refuse to promote green tests to proof where the pinned expectation
conflicts with the Canon. Codex names the pinned-wrong behaviours: rounded Expanded
TPE, universal poison-pill treatment of rookie-scale players, trade-bonus suppression
on zero guaranteed money, the retired aggregation bar, advisory Trade Call room.
Claude independently found the first two and the fourth. **No dispute on this axis.**

Codex is also more rigorous in one specific respect: it demotes three otherwise-correct
leaves (`CBA2-A10.21`, `CBA2-C10.1`, `CBA2-R04.1`) to insufficient evidence because the
cited tests do not assert the Canon boundary — including noting that `R04.1`'s tests
never call `getStretchProvisionYears`. That is exactly the right discipline.

## 6. Disagreements in severity — the material one

| Severity | Claude | Codex |
|---|---:|---:|
| high | 330 (40.5%) | 613 (75.2%) |
| medium | 291 | 194 |
| low | 194 | **1** |
| none | 0 | 7 |

Codex is more severe on 435 leaves, Claude on 59.

The cleanest isolation of the disagreement: **of the 194 leaves both audits
independently call `absent`, severity agrees on only 42 (21.6%).** Same fact, opposite
label — Codex scores 119 of them High; Claude scores 129 of them Low.

The 94 leaves Claude scores Low and Codex scores High cluster almost perfectly on CBA
depth that no owner-approved V1 workflow requires:

| Family | Leaves | Subject |
|---|---:|---|
| C23 | 27 | deferrals, international payments, loans, insurance |
| C25 | 14 | retired / pending / circumvention / grievance amounts |
| C15 | 13 | Arenas offer sheets |
| C12 | 9 | Disabled Player Exception engine |
| C17 | 9 | Over-38 attribution |
| C09 | 7 | luxury-tax brackets and repeater |
| R08 | 7 | Two-Way active-game accounting |
| R07 | 3 | short-roster day clocks |

Both audits agree these are absent. The question is whether absent-and-not-required-by-V1
is a High-severity finding. **It is not**, on the owner-approved contract's own terms:
`architect-v1-completion-contract.md` defines completion as fifteen named workflows plus
a six-point behaviour standard, and none of them needs a repeater tax bill, an Over-38
reattribution, or an Under-Fifteen-Games ledger.

With 613 of 815 leaves marked High and exactly **one** marked Low, the severity field
carries almost no ordering information. A Phase 3 planner cannot use it to sequence
work. This is the one finding that requires correction before the audit is used as a
planning input — and it is a labelling correction, not a re-audit.

To be fair to Codex: nothing in its document claims severity is calibrated to product
risk. Read as *Canon-completeness severity*, 613 High is internally consistent. The
defect is that the field is unlabelled and will be read as priority.

## 7. Missed code paths and tests

**Claude missed a route; Codex did not.** Claude scored all 30 `CBA2-A10` leaves
`absent` after reading `capLegalityValidation/extension.ts`, and did not reach
`src/features/architect/utils/playerRulesProfile/extensionRules.eligibility.ts`.
That file is a real extension-eligibility engine: `:293` blocks `originalLength <= 2`,
`:300-311` implements the multi-year anniversary waits, and the profile carries the
140% veteran formula and ETO awareness. Codex scored 24 of those 30 leaves `partial`
and `CBA2-A10.21` `correct`. **Codex is right and Claude overstated absence on 30
leaves.** Claude's Stage A A10 verdicts are withdrawn in favour of Codex's.

Codex is also right on seven further leaves Claude under-credited by applying a family
profile where leaf-level verification was warranted:

| Leaf | Claude (frozen) | Codex | Adjudication |
|---|---|---|---|
| `CBA2-A02.3` | partial | correct | **Codex** — TPE expiry is persisted one year from trade date and enforced against the explicit trade date |
| `CBA2-A07.3` | partial | correct | **Codex** — four-season bound in `signAndTradeEligibility.ts` |
| `CBA2-A10.21` | absent | correct | **Codex** — verified at `extensionRules.eligibility.ts:293` |
| `CBA2-C10.1` | partial | correct | **Codex** — 90% floor carried and consumed |
| `CBA2-C20.3` | partial | correct | **Codex** — Claude found the same fact but keyed it to `C20.1` |
| `CBA2-L06.3` | partial | correct | **Codex** — partial-use balance persistence |
| `CBA2-R04.1` | partial | correct | **Codex** — Claude's own note said `2n+1` is correct but scored the family |
| `CBA2-R06.14` | partial | correct | **Codex** — Claude keyed the same fact to `C20.1` |

Accepting all of the above moves Claude's counts to 13 correct / 543 partial /
15 incorrect / 244 absent. It does not move Codex's.

**Codex missed nothing Claude found in code**, with one exception, in §8.

**Evidence-path hygiene.** 29 of 87 distinct `evidence.implementation` strings and 28 of
99 `evidence.tests` strings in the Codex register are not filesystem paths. On
inspection they are *negative-search statements* placed in a path array — e.g. "No
Over-38 trigger… located; adjacent term authoring inspected at
`…/extensionRules.ts`". The content is correct and the negative searches are exactly
what the audit should record. This is a schema-shape defect, not fabricated evidence,
and it will break any tool that treats those arrays as paths. It should be moved to a
dedicated `negative_search` field.

## 8. Where Claude is right and Codex is not

`CBA2-A05.3`, `CBA2-A05.4`, `CBA2-A05.5` — Transaction Restrictions Table rows A
(Bi-annual Exception), B (Non-Taxpayer MLE) and C (sign-and-trade acquisition). Each
row's own obligation is that the named transaction carries an Applicable Apron Level of
the First Apron Level. `hardCapUtils.ts:41-48` does exactly that for all three.

Codex marks all three `incorrect / High` and attaches an **identical inspection note to
all three** — a note about the *family*: that rows D–K, the TMLE cross-bar, post-state
Apron Team Salary and the dual-year hard cap are missing. Those are real findings, but
they are owned by `CBA2-A05.6`–`A05.13`, `A05.14`, `A05.1`/`A05.2` and
`A05.15`–`A05.17` respectively. Under the Canon's own atomicity discipline, a leaf is
scored on its own rule.

This is the mirror image of Claude's A10 error: a family-level judgement applied to
leaf-level verdicts. Claude made it in the lenient direction on 30 leaves; Codex made
it in the harsh direction on 3.

## 9. Scope and intentional-exclusion disagreements

**None.** Both audits independently return zero intentional product exclusions and zero
`not applicable` implementation states, and both explicitly decline to invent one.

Both are correct. The five owner-approved V1 exclusions (draft-night experience,
real-life franchise history, JSON/raw-data entry, the Offseason room, entitlement and
pick authoring controls) are product *surfaces*; none is a CBA rule, and W10 keeps
draft-asset rules in scope even while the draft-night room is excluded. No Canon leaf
is discharged by an exclusion.

This is a meaningful convergence: two independent audits both resisted the easy move of
writing down the universe by claiming exclusions.

## 10. Root-cause clusters

| | Claude | Codex |
|---|---:|---:|
| clusters | 12 | 57 |

Different granularity, same architecture. The correspondences are direct:

| Codex cluster | Leaves | Claude cluster | Leaves |
|---|---:|---|---:|
| `waiver-claim-lifecycle-absent` | 51 | RC9 no claim lifecycle | 51 |
| `roster-list-state-and-clocks-absent` | 21 | RC12 no list model | 51 |
| `hard-cap-trigger-table-incomplete` | 18 | RC5 3-of-11 rows | 17 |
| `trade-bonus-scalar-not-lifecycle` | 39 | RC8 no bonus model | 89 |
| `ledger-conflation` | — | RC1 single-ledger substitution | 23 |

Both audits independently identify the single-ledger substitution at
`computeTeamCapTotals.ts` as the foundation defect, cite the same two functions, and
reach `incorrect / High` on `CBA2-A01.1`. Both independently identify: the season-blind
Expanded TPE constant, the wrong incomplete-roster population/threshold/window, the
2024-25 rookie table inside cap holds, the aggregation bar retired for a missing
acquisition date, 3-of-11 hard-cap rows, the absent tax engine, the absent waiver claim
lifecycle, absent Over-38 / signing-bonus / Exhibit 9-10 / Arenas, and correct Two-Way
cap treatment.

**Clusters present in only one audit.** Claude's `RC10-DUP-CONSTANT-SOURCES` (46 leaves
— `CBA_THRESHOLDS` vs `capProjections`, `capHolds.ts` scales vs `minimumSalaryRules`) has
no direct Codex counterpart; Codex records the symptom ("source metadata is coarse and
permits silent fallbacks") without naming the duplicate-source mechanism. Codex's
`advanced-contract-route-model-incomplete` (50), `exhibit-and-summer-contracts-absent`
(43) and `exception-method-matrix-incomplete` (40) are finer decompositions of ground
Claude covered inside C13/C16/C21.

Neither audit found a cluster the other missed in substance.

## 11. Does any of this change Phase 3 size, foundations, or ordering?

**Foundations: no.** Codex's eight workstreams and Claude's twelve clusters land on the
same foundations in the same order: governed season inputs and world time; independent
Team/Apron/Tax ledgers; dated contract and transaction events; trade paths, hard-cap
rows, cash and pick history; contract authoring routes; exception and rights lifecycles;
lists, clocks and waivers; then explanation depth and Canon-aligned proofs. Both
independently conclude that starting with isolated leaf validators would entrench the
conflated state.

**Ordering: no.** The ledger split gates the apron and tax families in both audits.

**Size: not materially, once measured correctly.** The leaf-state counts differ a great
deal (263 vs 15 incorrect; 397 vs 274 absent), but leaf counts were never the size
metric — both audits say so explicitly. Measured in clusters and workstreams, the two
audits describe the same program. Accepting every Codex correction in §7 moves Claude
to 13/543/15/244 and does not add or remove a single workstream.

**The one thing that does change Phase 3 is severity.** With 613 High and one Low,
Codex's register cannot sequence work inside a workstream. Claude's 330/291/194 split
can. Re-scoring severity against the V1 completion contract — or, minimally, labelling
the existing field as Canon-completeness severity and adding a product-risk field — is
the correction Phase 3 needs.

## 12. Answers to the four specific risks

- **Overstates absence by missing an implementation route** — **Claude did, Codex did not.**
  30 A10 leaves, `playerRulesProfile/extensionRules.eligibility.ts`.
- **Calls incomplete functionality `incorrect` where `partial` is more accurate** —
  **Codex does, on roughly 204 leaves**, but under a defensible and internally consistent
  definition. Not a rejection ground; worth one line of definition in the summary.
- **Treats exhaustive CBA depth as an approved product requirement** — **Codex does,
  through severity.** 94 leaves both audits call absent are scored High by Codex and Low
  by Claude, concentrated in C23/C25/C15/C12/C17/C09/R08/R07. This is the material finding.
- **Inflates High severity** — **yes: 613 of 815 (75.2%), against Claude's 330 (40.5%),
  with exactly one Low.**
- **Overlooks owner-approved V1 exclusions** — **neither.** Both correctly return zero.
- **Confuses proof of current behaviour with proof of Canon-correct behaviour** —
  **neither.** Both explicitly refuse; Codex is the more rigorous of the two here.

## 13. Bounded adjudication list

Every material disagreement, with both verdicts, the exact evidence, and the decision
required. Nothing here is silently resolved in Claude's favour.

| # | Canon leaf(s) | Claude | Codex | Evidence | Decision required |
|---|---|---|---|---|---|
| 1 | 94 leaves across C23, C25, C15, C12, C17, C09, R08, R07, R03, A05 | Low severity | High severity | Both call these absent. No V1 workflow in `architect-v1-completion-contract.md` requires them. | **Owner/architect decision:** is Phase 2 severity Canon-completeness severity or product-risk severity? If the latter, re-score. If the former, label the field and add a product-risk field. **This is the only decision that blocks using the audit for Phase 3 planning.** |
| 2 | `CBA2-A05.3`, `A05.4`, `A05.5` | correct | incorrect / High | `hardCapUtils.ts:41-48` implements rows A, B, C exactly. Codex's note is a family note about rows D–K. | Adjudicate to Claude unless the Canon's atomicity discipline is being deliberately overridden. Low impact (3 leaves), high signal. |
| 3 | 30 `CBA2-A10` leaves | absent | partial (24) / incorrect (3) / correct (1) | `extensionRules.eligibility.ts:289-311` | **Adjudicate to Codex.** Claude's Stage A verdicts are withdrawn. |
| 4 | `CBA2-A02.3`, `A07.3`, `C10.1`, `C20.3`, `L06.3`, `R04.1`, `R06.14` | partial | correct | Per-leaf routes cited in §7 | **Adjudicate to Codex.** Claude applied family profiles where leaf verification was warranted. |
| 5 | ~204 leaves, `partial` vs `incorrect` | partial | incorrect | Definitional | No re-audit. Add one sentence defining `incorrect` as "partial implementation that yields a Canon-wrong result". Then Codex's counts stand. |
| 6 | 523 leaves, runtime input | partial | missing | Scale mismatch; Codex has no partial value | Add a `partial` value or publish the 231/498 split. Needed for a data-ingest plan; does not invalidate the audit. |
| 7 | `CBA2-S02.1/.2/.5/.6` | incorrect | absent | `CBA_THRESHOLDS` vs `capProjections`; `capHolds.ts` vs `minimumSalaryRules` | Either is defensible. Recommend recording Claude's duplicate-source mechanism in the cluster list, since it names the fix. |
| 8 | 57 `evidence.implementation` / `evidence.tests` entries | n/a | prose in path arrays | Verified: content correct, field misused | Schema fix — move to a `negative_search` field. Not a finding defect. |

## 14. Verdict

**ACCEPT WITH CORRECTIONS.**

The Codex Phase 2 audit is substantively reliable, not merely mechanically complete. It
covers the correct universe exactly once, reaches the same conclusion as a blind
independent audit on 804 of 815 leaves, identifies the same foundation defect from the
same source lines, converges on the same evidence-strength split, correctly refuses to
promote green tests to Canon proof, correctly returns zero intentional exclusions, and
proposes a Phase 3 decomposition that matches an independently derived one. Where the
two audits differ on facts, Codex is right more often than Claude — including on 30
leaves where Claude, not Codex, overstated absence by missing an implementation route.

The corrections required before it is used as a Phase 3 planning input:

1. **Severity must be resolved (adjudication item 1).** 613 High and one Low is not
   usable for sequencing, and it scores CBA depth no V1 workflow requires as High.
   This is the only blocking correction.
2. **Fix the three `CBA2-A05.3/.4/.5` leaf verdicts** (adjudication item 2), or state
   that family-level judgement is intentional there.
3. **Define `incorrect`** in the summary (item 5) and **publish the runtime-input
   split** (item 6).
4. **Move negative-search prose out of the evidence path arrays** (item 8).

None of these requires re-auditing a leaf. All are labelling, definition, or schema
corrections to an audit whose findings hold.

**Phase 2 can be accepted once correction 1 is made** — that is an owner/architect
decision about what severity means, not more audit work. Corrections 2–4 can land
alongside it.

Nothing in this report authorises implementing fixes, closing Phase 2, updating Linear,
or opening Phase 3. BZE-266 remains open and unchanged.

---

# 15. Reconciliation decision (owner, 2026-08-07)

Recorded after the Stage B comparison above. Stage A (`a68fea37`) and Stage B
(`ae01249b`) are unchanged in history; this section is additive. No audit was re-run
and no leaf was re-scored to produce it.

## 15.1 Severity is product risk — adjudication item 1 resolved

Adjudication item 1 asked whether Phase 2 severity means Canon completeness or product
risk. **The owner has chosen product risk.** The binding definition:

> **High** means the gap could materially produce a wrong, misleading, illegal, or
> unusable result in a currently approved Architect workflow, **or** it is a
> foundational model defect affecting many such workflows.

Two consequences follow, and both matter equally.

**Canon completeness is not lost.** It remains fully visible through the
implementation-state classifications (`correct` / `partial` / `incorrect` / `absent`)
and through the root-cause clusters. A rule that is genuinely absent stays recorded as
absent no matter how low its current product risk. **Lowering a severity score is not
permission to close, dismiss, defer indefinitely, or delete a real Canon gap.** The
absent count does not move.

**The Codex severity column must be re-scored.** Under the adopted definition, 613 High
out of 815 cannot stand: the ~94 leaves identified in §6 — concentrated in C23
(deferrals, international payments, loans), C25 (retired, pending, circumvention,
grievance), C15 (Arenas), C12 (DPE engine), C17 (Over-38), C09 (tax brackets and
repeater), R08 (Two-Way game usage) and R07 (short-roster clocks) — are absent Canon
obligations that no currently approved Architect workflow depends on. They are real
gaps at low current product risk.

The foundational clause of the definition is doing real work in the other direction.
Defects such as the single-ledger substitution at `CBA2-A01.1`, the absent Apron Team
Salary ledger (C07), the incomplete-roster charge (C03), the Bird cap-hold multipliers
(C01.4), the false December 15 trade block (L03.1) and the false below-cap trade block
(A02.11) remain **High** under product risk — several of them reach High specifically
through the foundational clause rather than through any single workflow.

Claude's Stage A severity distribution (330 High / 291 Medium / 194 Low) was derived
under approximately this definition and is directionally consistent with it. It is
**not** hereby adopted as the official scoring. Stage A carries its own errors (§7),
and the official Phase 2 register is the Codex one. Stage A severity is a cross-check,
not a substitute.

## 15.2 Implementation-verdict corrections — `CBA2-A05.3`, `A05.4`, `A05.5`

Adjudication item 2 is resolved in Claude's favour. These three leaves are corrected
from `incorrect` to **`correct`**, with severity **None** under the product-risk
definition.

| Leaf | Transaction Restrictions Table row | Corrected verdict | Evidence |
|---|---|---|---|
| `CBA2-A05.3` | Row A — Bi-annual Exception carries the First Apron Level | correct | `src/features/architect/utils/hardCapUtils.ts:41-48`, `case 'BAE': return 'FirstApron'` |
| `CBA2-A05.4` | Row B — Non-Taxpayer MLE carries the First Apron Level | correct | `src/features/architect/utils/hardCapUtils.ts:41-48`, `case 'NonTaxMLE': return 'FirstApron'` |
| `CBA2-A05.5` | Row C — sign-and-trade acquisition carries the First Apron Level | correct | `src/features/architect/utils/hardCapUtils.ts:41-48`, `case 'SignAndTrade': return 'FirstApron'` |

Each row's own obligation is the level assignment, and each is implemented. The
inspection note Codex attached identically to all three describes real failures that
belong to other leaves and **must be retained there, not deleted**: rows D–K to
`CBA2-A05.6`–`A05.13`, the TMLE cross-bar to `CBA2-A05.14`, post-transaction Apron Team
Salary to `CBA2-A05.1`/`A05.2`, and the post-Regular-Season dual-year hard cap to
`CBA2-A05.15`–`A05.17`. Correcting three leaves removes no finding from the register.

This correction does not disturb §7: on the 30 `CBA2-A10` leaves and the seven
under-credited leaves, Codex was right and Claude's Stage A verdicts stay withdrawn.

## 15.3 Required definition of `incorrect` — adjudication item 5

Codex's `incorrect` is broader than Claude's, which accounts for roughly 204 leaves of
disagreement. Codex's usage stands. It must be stated explicitly in the Phase 2 summary
so the register is readable without reverse-engineering the convention:

> **`incorrect`** — the application produces a result that conflicts with the Canon
> obligation. This includes an implementation that is present but incomplete where the
> incompleteness yields a Canon-wrong answer, not only a wrong constant, threshold, or
> inverted condition.
>
> **`partial`** — an implementation route exists and its outputs are consistent with the
> Canon as far as they go, but the obligation is not fully discharged.
>
> **`absent`** — no implementation route exists, established by negative search across
> the plausible vocabulary and surfaces, not by a single failed symbol lookup.

Adding this definition changes no verdict. It makes the existing 263 `incorrect`
classifications defensible on their face.

## 15.4 File-format correction — adjudication item 8, bounded

29 of 87 distinct `evidence.implementation` strings and 28 of 99 `evidence.tests`
strings in `ARCHITECT_CBA_CANON_V2_PHASE2_IMPLEMENTATION_GAPS.json` are prose
negative-search statements placed in arrays that otherwise hold filesystem paths — for
example, "No Over-38 trigger… located; adjacent term authoring inspected at
`…/extensionRules.ts`".

The content was independently verified as accurate, and recording negative searches is
correct audit practice. The defect is confined to field shape: any consumer treating
those arrays as paths will fail on roughly a third of the entries.

**Bounded correction:** move those strings into a dedicated `negative_search` field
alongside `implementation` and `tests`, leaving the path arrays containing only paths.
No evidence text is to be deleted or rewritten in the move, and `schema_version` should
be incremented. This is the whole of the correction; nothing else in the schema is in
scope.

## 15.5 Status — Phase 2 remains open

The official Phase 2 artifacts at `f63452d5` are **not corrected by this document.**
This branch is an independent verification record and holds no authority over them.
Before Phase 2 can close, the maker-side register requires:

1. severity re-scored against the §15.1 product-risk definition, with
   implementation-state classifications and absent counts left untouched;
2. the three `CBA2-A05.3/.4/.5` verdicts corrected per §15.2, with the displaced
   findings retained on their owning leaves;
3. the `incorrect` / `partial` / `absent` definitions from §15.3 stated in the summary;
4. the `negative_search` field split per §15.4;
5. the runtime-input scale published as a split rather than a single `missing` bucket
   (adjudication item 6) — Codex has no `partial` value, which is why it reports
   718/815 missing.

**Then a narrow independent re-verification is required** — not a re-audit. Its scope
is exactly: that severity moved only where the product-risk definition requires and
that no implementation state, absent count, root-cause cluster or evidence string was
weakened in the process; that the three corrected leaves read `correct` while their
displaced findings survive on the correct leaves; and that the schema split preserved
every evidence string. Nothing else is reopened.

Phase 2 closes on the outcome of that re-verification. Until then it stays open.

## 15.6 What this decision does not authorise (superseded by §16 status)

No application code, test, schema, data or configuration change. No modification of the
accepted Canon or of the Codex Phase 2 artifacts. No Linear update. No Phase 3 issues,
sizing, or ordering work. BZE-266 remains open and unchanged.

---

# 16. Bounded cross-model re-verification (final gate)

Scope: the correction `f63452d5` → `1035ae89` only. No implementation verdict was
reopened, no official artifact modified, no application test run (application code did
not change). Performed read-only from the Claude branch plus a temporary detached
worktree, since removed.

## 16.1 Result by check group

| # | Check | Result |
|---|---|---|
| 1 | Scope and ancestry | **PASS** |
| 2 | Implementation-state invariants | **PASS** |
| 3 | Product-risk severity | **PASS** |
| 4 | Runtime-input split | **PASS** |
| 5 | Evidence-schema preservation | **FAIL — one bounded defect (§16.6)** |
| 6 | Summary and validation | **PASS** |

45 discrete assertions were executed. 44 pass. One fails.

## 16.2 Check 1 — scope and ancestry

- `1035ae89` has exactly one parent, `f63452d5`; `git rev-list --count` is 1; it is a
  normal non-merge descendant. No amend, rebase or force-push.
- Exactly the three authorized artifacts changed (summary, register, integrity checker).
  A path-excluding diff over the rest of the tree returns empty.
- `src/`, `tests/`, `scripts/`, `package.json`, `package-lock.json`, `vite.config.ts`,
  `tsconfig.json`, `firestore.rules` and `data/` are byte-identical.
- The Canon still hashes to `23fe883f…7ff76` at `1035ae89`.
- `main` remains `69f8f6b6`. No Linear or Phase 3 state exists in the diff.

## 16.3 Check 2 — implementation-state invariants

- 815 records before and after; leaf identities **and positional ordering** compare
  equal as lists; no duplicates.
- Exactly `CBA2-A05.3`, `A05.4`, `A05.5` changed implementation state, each
  `incorrect → correct`, each with severity `None`.
- Final counts exactly **13 correct / 145 partial / 260 incorrect / 397 absent**, summing
  to 815.
- Canon-sourced fields (`canon_rule`, `canon_authority`, `canon_verification_method`,
  `canon_lifecycle_date_inputs`, `family`, `group_id`, `pass`) unchanged on all 815 — zero diffs.
- All five product layers unchanged on all 815 — zero diffs.
- `evidence_strength` unchanged on all 815 — zero diffs.
- All 57 root-cause clusters preserved with identical membership; no leaf reassigned.
- `canon_coverage_classification` changed on exactly the three corrected leaves
  (`partial → covered and proven`, moving the total 7 → 10), and
  `smallest_likely_remediation` changed on the same three. Both are **required
  consequences** of the verdict correction, not unauthorized edits; the new remediation
  text still names the sibling work rather than dropping it.

**Displaced findings retained.** The rows D–K, TMLE cross-bar, post-state Apron Team
Salary and dual-year hard-cap findings are each present on 14 A05 leaves — `A05.1`,
`A05.2` and `A05.6`–`A05.17` — in their own correctly-labelled `inspection_notes`. The
three corrected leaves no longer assert them. Nothing was lost by the correction.

## 16.4 Check 3 — product-risk severity

369 leaves changed severity; 446 unchanged. Transitions: High→Medium 162, Medium→Low
103, High→Low 91, Medium→High **7**, High→None 3, Medium→None 3.

**Reviewed against the §15.1 definition and accepted.**

- **Low-risk full-CBA depth was correctly de-escalated.** The 91 High→Low moves are
  C23 (27, deferrals/international/loans), C25 (14, retired/pending/circumvention/
  grievance), C15 (13, Arenas), C12 (9, DPE engine), C17 (9, Over-38), C09 (7, tax
  brackets/repeater), R08 (7, Two-Way game usage), R07 (3, roster clocks), R03 (2).
  This is precisely the cluster identified in §6. Each remains classified `absent`.
- **No real Canon gap was removed or weakened.** Implementation states, absent counts
  (397, unchanged), coverage classifications, evidence strengths and clusters are all
  untouched by the re-scoring. Canon completeness is fully preserved.
- **Foundational current-workflow defects remain High.** Spot-checked and confirmed
  High: `A01.1` (single ledger), `C07.1` (apron ledger), `C08.1` (tax ledger),
  `C03.1/.2` (incomplete-roster charge), `C01.4` (Bird multipliers), `A05.1/.2`
  (post-transaction apron test and hard cap), `A02.11`, `A02.12`, `A04.1` (trade-kicker
  doubling), `L03.1` (false December 15 block), `A08.1` (cash limit), `L08.1`,
  `C13.1`, `C14.1`, `R01.1`, `L06.1`, `S02.1`, `A02.8`.
- **No depth-only leaf was left High merely for being absent.** All 113 remaining
  High-and-absent leaves sit in families inside an approved workflow or are foundational:
  R01 48 (waiver claim lifecycle, W3), C07 10, A03 9 (W9), C08 8, C13 7, L08 7, C14 5,
  L06 4, S02 4, A06 3, C06 3, A12 2, R02 2, C16 1.
- **Seven leaves were raised** Medium→High: `C13.17` and `C14.25`–`C14.29`
  (renunciation and post-match rescission — W4 renounce-rights and W6/W7 own-FA and
  offer-sheet workflows, where an error produces wrong cap room on a shipped surface)
  and `R02.5` (unclaimed termination dead salary, W3). Raising these is correct under
  product risk and is good evidence the pass was a genuine re-evaluation rather than a
  blanket downgrade.

**Final distribution 364 High / 243 Medium / 195 Low / 13 None is defensible.** High
falls from 75.2% to 44.7% and Low from 1 leaf to 195, so the field now discriminates
and can sequence Phase 3.

**Material divergences from Claude's Stage A, reported not forced.** Four leaves where
Stage A scored Medium and the corrected register keeps High: `A02.11` (below-cap teams
cannot elect the (iii)/(iv) paths), `A02.8` (season-blind Expanded TPE input), `L03.1`
(false December 15 trade block), `A08.1` (cash limit ~$2.7M too tight). Each produces a
wrong or blocking result inside W9, so High is defensible under the definition's first
clause. **No change requested.** Stage A is a cross-check, not a replacement.

## 16.5 Check 4 — runtime-input split

- Before `{available 61, missing 718, external determination 35, not required 1}`;
  after `{available 61, partial 523, missing 195, external determination 35, not required 1}`.
- Exactly **523** rows changed runtime-input state, and **all 523** moved
  `missing → partial`. Zero rows moved in any other direction or between any other pair.
- `available`, `external determination` and `not required` are unchanged. 718 − 523 = 195.
- Membership reconciles for all 523. Sampling the shared-evidence groups (A06 timing,
  C07 apron, C13 exceptions, R01 waivers), each moved row's retained evidence names a
  located implementation route **and** at least one unavailable input — the pattern the
  `partial` value is for. The A06 rows are the clearest: an enforcement route exists and
  is deliberately disabled for a missing acquisition-date field.

## 16.6 Check 5 — evidence-schema preservation — **one defect**

Passing:

- `schema_version` is **2.0** (was `1.0`); all header fields unchanged; JSON well-formed
  with no duplicate object keys.
- **Zero** previous evidence strings lost register-wide: 1022 before, 1025 after, 0 lost.
- Exactly **729** prose occurrences moved from `implementation`/`tests` into
  `negative_search`.
- Path arrays contain paths only — zero prose remaining.
- `negative_search` contains prose only. *(An earlier heuristic flagged 35 entries as
  bare paths; inspection shows all 35 are full prose sentences that merely begin with a
  filename, e.g. "tests/trade/…test.ts and tests/trade/…test.ts explicitly pin absence
  of the two-month aggregation rule; no minimum-stacking test was located." The maker's
  own checker uses `fullmatch`, which classifies these correctly. Not a defect —
  my check was wrong.)*
- The updated integrity checker genuinely enforces the new schema (schema-version pin,
  `record_count` consistency, the `partial` runtime value, the four-field evidence set,
  and a path regex in both directions). It runs clean: `PASS: Canon/register
  integrity — 815 unique LEAFs; A 151, C 417, R 118, L 102, S 27`, exit 0.
- Exactly 3 evidence strings are new — the corrected verdict notes for `A05.3/.4/.5`.
  Necessary and correct.

**Failing — evidence reassigned to the wrong leaf.** The three superseded family notes
from the corrected leaves were archived onto sibling leaves:

| Archived string self-labelled | Now stored on | Field |
|---|---|---|
| `CBA2-A05.3: Hard-cap state and some first/second-apron validations exist…` | `CBA2-A05.1` | `evidence.negative_search` |
| `CBA2-A05.4: Hard-cap state…` | `CBA2-A05.6` | `evidence.negative_search` |
| `CBA2-A05.5: Hard-cap state…` | `CBA2-A05.15` | `evidence.negative_search` |

This violates the stated invariant "no evidence … reassigned to the wrong leaf" and
also the §15.4 definition of `negative_search`, which holds negative-search statements —
not superseded verdict notes. These three movements are **outside** the authorized 729
(those all moved within a single leaf, from path arrays); they are a separate cross-leaf
relocation.

The maker's intent is legible and good-faith: the instruction also required that every
previous string survive byte-for-byte, and once a verdict is corrected its old note has
nowhere to live on its own leaf. The two criteria genuinely pull against each other.

**Impact is nil.** No verdict, count, cluster, coverage classification or finding is
affected, and the substantive content is independently present on `A05.1`, `A05.2` and
`A05.6`–`A05.17` in their own correctly-labelled notes. These three strings are archived
duplicates of content that is already correctly placed elsewhere.

## 16.7 Check 6 — summary and validation

- The `incorrect` / `partial` / `absent` definitions are reproduced verbatim and
  correctly, attributed to the reconciliation decision.
- The product-risk severity definition is stated, with a Medium band defined beneath it.
- Summary count tables match the register exactly: 13/145/260/397 and
  364/243/195/13 (Critical 0).
- Status reads "Corrected Phase 2 audit candidate; awaiting narrow cross-model
  re-verification", and the closing section states the candidate "is not self-accepted
  and does not close Phase 2." Correct — the maker did not self-accept.
- Validation performed: updated integrity checker (exit 0), JSON well-formedness and
  duplicate-key validation, full before/after invariant comparison across all 815
  records and every field, register-wide evidence-preservation diffing, and git
  ancestry/scope diffs. No application tests were run.

## 16.8 Operational note

The shared worktree was found checked out on `architect/bze-266-cba-canon-v2-phase2-audit`
at `1035ae89` when this verification began — the maker session committed from the same
working copy. The three frozen Claude commits were unaffected. The branch was restored
and the temporary worktree removed. Concurrent sessions on this one worktree remain a
standing collision hazard.

## 16.9 Verdict

**REJECT** — pending exactly one correction.

Every substantive requirement passes. Scope and ancestry are clean; the three verdict
corrections are exactly right with severity `None`; the final counts are exactly
13/145/260/397; Canon fields, product layers, evidence strengths and all 57 clusters are
untouched; the displaced hard-cap findings are retained on their owning leaves; the
runtime-input split is exactly 523 `missing → partial` with no other movement; schema is
2.0 with 729 prose occurrences moved and nothing lost; the integrity checker was
genuinely hardened and runs clean; the summary is accurate and does not self-accept. The
severity re-scoring is a real, well-targeted re-evaluation that de-escalates low-risk
CBA depth, keeps every foundational current-workflow defect High, raises seven leaves
that deserved it, and weakens no Canon gap.

The single blocker:

> **Correction required.** Remove the three archived superseded notes from
> `CBA2-A05.1`, `CBA2-A05.6` and `CBA2-A05.15` `evidence.negative_search`. Each is a
> duplicate of a note whose substance is already correctly carried by the owning leaves'
> own `inspection_notes`, so deleting them loses no finding. If byte-level retention of
> superseded text is wanted, keep it on its own leaf in a distinct field (for example
> `superseded_notes` on `A05.3/.4/.5`) rather than in another leaf's `negative_search`.
> Extend the integrity checker with one assertion: a `negative_search` entry that begins
> with a `CBA2-` identifier must match its host `leaf_id`.

Nothing else is required. After that single edit and a re-run of the integrity checker
plus the leaf-attribution assertion, the corrected candidate is ready for owner
acceptance and Phase 2 closure. No re-audit, no severity change, no verdict change.

This document does not close Phase 2, update the official branch or Linear, or open
Phase 3. BZE-266 remains open and unchanged.

# 17. Final confirmation of the §16 repair (2026-08-07)

Narrowly bounded confirmation of the single correction required by §16.9. This is not a
re-audit: no verdict, severity, count, or classification was re-examined on its merits.
The official repair was inspected read-only from a detached temporary worktree at
`19dc84fc`; all writing happened on this Claude branch after `8d3f6b12`. No official
branch, application, Linear, or Phase 3 state was touched, and no application tests were
run.

- Previous corrected candidate: `1035ae898e31992e5de286f478ad4868c5b496c0`
- Final evidence-hygiene repair: `19dc84fc4050ce9cf749136dae1f9854adc72ef7`
  ("docs(cba): remove superseded evidence duplicates")

## 17.1 Result by required check

| # | Check | Result |
|---|---|---|
| 1 | `19dc84fc` is exactly one normal child of `1035ae89` | **PASS** |
| 2 | Only the three authorised audit artifacts changed | **PASS** |
| 3 | Exactly the three named superseded cross-leaf duplicates deleted | **PASS** |
| 4 | No other evidence, finding, verdict, severity, state, Canon field, layer, cluster, identity or ordering changed | **PASS** |
| 5 | Checker now rejects mismatched `negative_search` leaf prefixes | **PASS** |
| 6 | Summary records the three deletions and leaves Phase 2 open | **PASS** |
| 7 | All established counts unchanged | **PASS** |
| 8 | Checker, JSON validation, invariant comparison, attribution assertion, git diff | **PASS** |

## 17.2 Checks 1–2 — ancestry and scope

`git rev-list --parents -n 1 19dc84fc` returns a single parent, `1035ae89`. The range
`1035ae89..19dc84fc` contains exactly one commit, non-merge. `git diff --name-status`
reports three paths, all `M` — no additions, deletions, or renames:

| Path | Delta |
|---|---|
| `ARCHITECT_CBA_CANON_V2_PHASE2_AUDIT_SUMMARY.md` | +1 / −1 |
| `ARCHITECT_CBA_CANON_V2_PHASE2_IMPLEMENTATION_GAPS.json` | +3 / −9 |
| `cba_canon_v2_phase2_integrity.py` | +8 / −0 |

Zero paths changed outside `work/architect-completion/`; zero delta in `src/`, `tests/`,
`docs/`, or package manifests. The Canon file still hashes to
`23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`, matching the
register's declared `canon_sha256` — the frozen Canon is untouched. `git diff --check`
passes.

## 17.3 Check 3 — the three deletions, proved by the new guardrail itself

Running the **new** checker against the **pre-repair** register identifies exactly three
violations and no others — precisely the three deletions authorised in §16.9:

```
FAIL: CBA2-A05.1:  evidence.negative_search leaf prefix CBA2-A05.3 does not match host leaf_id
FAIL: CBA2-A05.6:  evidence.negative_search leaf prefix CBA2-A05.4 does not match host leaf_id
FAIL: CBA2-A05.15: evidence.negative_search leaf prefix CBA2-A05.5 does not match host leaf_id
```

Each host's `negative_search` went from exactly one entry to `[]`. The old checker still
passes against the repaired register, so the repair introduced no regression against the
previously accepted schema contract.

**Sharpening of §16.6.** §16 described these strings as superseded notes belonging to
`A05.3/.4/.5` and archived onto siblings. Mechanically the case is stronger: each removed
string's body is *byte-identical to its own host's* retained, correctly-attributed
`inspection_notes` entry — it was a stale duplicate of the host's own narrative wearing a
neighbour's identifier. Meanwhile `A05.3/.4/.5` each carry their own distinct current
note, which explicitly defers the rows D–K, TMLE cross-bar, post-state Apron Team Salary
and dual-year gaps to "their owning leaves." The deletion is therefore provably lossless
in both directions, and the §16.9 offer of a `superseded_notes` field was correctly
declined as unnecessary. This strengthens, and does not alter, the §16 conclusion.

## 17.4 Check 4 and 7 — mechanical invariant comparison

A 59-assertion before/after comparison across all 815 records and every field passed with
zero failures. Unchanged: all seven top-level header fields (including `record_count` 815
and `canon_sha256`); the `leaf_id` sequence byte-identical, so identity **and ordering**
are preserved; all 15 scalar fields on all 815 records; `product_layers` on all 815
records; and the 57 root-cause clusters.

Evidence census — the only delta register-wide:

| Field | Before | After |
|---|---|---|
| `implementation` | 1628 | 1628 |
| `tests` | 1602 | 1602 |
| `inspection_notes` | 815 | 815 |
| `negative_search` | 732 | **729** |

Zero evidence strings were added or altered; exactly three were dropped, all
`negative_search`, all on the three authorised hosts. Established distributions, all
unchanged and all reconciling with the summary tables:

- implementation state — 13 correct / 145 partial / 260 incorrect / 397 absent
- severity — 364 High / 243 Medium / 195 Low / 13 None (Critical 0)
- runtime input — 61 available / 523 partial / 195 missing / 35 external determination / 1 not required
- evidence strength — 446 proven / 369 insufficient
- Canon coverage — 10 covered and proven / 408 partial / 361 missing in scope / 14 data-blocked / 22 externally adjudicated
- pass — 173 deterministic correctness / 246 cap manager completeness / 396 full gm depth
- family — A 151, C 417, R 118, L 102, S 27 = 815

A register-wide attribution sweep finds zero remaining cross-leaf prefixes in
`negative_search` **or** `inspection_notes`.

## 17.5 Check 5 — the new guardrail, and a disposable negative probe

The checker adds `NEGATIVE_SEARCH_LEAF_RE` and one assertion: a `negative_search` entry
whose leading `CBA2` leaf identifier does not equal its host `leaf_id` is an error. It is
a pure addition — nothing was removed or weakened.

All 729 surviving `negative_search` entries are plain prose carrying no leading
identifier; the three removed were the only ones that carried one, and all three were
foreign. The guardrail is therefore a forward-looking regression guard, which is exactly
what §16.9 asked for.

Three disposable probes on isolated copies (never committed; discarded, worktree verified
clean afterwards):

| Probe | Injected | Expected | Observed |
|---|---|---|---|
| Mismatch | foreign prefix `CBA2-C09.7` onto host `CBA2-A04.1` | reject | **FAIL**, exit 1, expected message |
| Match | host's own prefix onto the same host | accept | **PASS**, exit 0 |
| Sibling-extension trap | `CBA2-A05.15` prefix onto host `CBA2-A05.1` | reject | **FAIL**, exit 1, expected message |

The third probe matters: the greedy `\d+` correctly reads `CBA2-A05.15` as a distinct
leaf rather than colliding with `CBA2-A05.1`, so sibling extensions cannot slip through.
The guardrail is neither under- nor over-broad.

## 17.6 Check 6 — summary accuracy and open state

The summary's single changed line is the evidence-schema preservation row, which now
reads: all 729 valid within-leaf prose moves preserved; exactly three checker-identified
superseded cross-leaf duplicates removed; no substantive finding or other evidence
removed; the candidate still awaits final independent confirmation and Phase 2 remains
open. Every clause is accurate against the register. The false clause flagged in §16.6 —
that the three displaced strings were "retained on their actual owning leaves" — is gone.

Phase 2 remains open in all four places it is asserted: the status header ("awaiting
narrow cross-model re-verification"), §"All three audit passes remain complete", the
changed validation row, and the closing statement that the candidate "is not self-accepted
and does not close Phase 2." The maker did not self-accept.

The surviving line "retaining every displaced hard-cap finding on its actual owning
leaves" is accurate as written: `A05.1`, `A05.6` and `A05.15` each retain the substantive
finding at `incorrect` / High. The "805 non-correct leaves" figure sits inside the
explicitly historical review record that predates the reconciliation (10 correct at the
time; 13 now, hence 802) and is untouched by this repair.

## 17.7 Check 8 — validation performed

| Check | Result |
|---|---|
| `python3 cba_canon_v2_phase2_integrity.py` on repaired state | **PASS** — 815 unique LEAFs; A 151, C 417, R 118, L 102, S 27; exit 0 |
| New checker vs pre-repair register | **FAIL** with exactly the 3 authorised violations; exit 1 |
| Old checker vs repaired register | **PASS**, exit 0 — no schema regression |
| `python3 -m json.tool` on the register | **PASS** — well-formed |
| 59-assertion before/after invariant comparison | **PASS** — 0 failures |
| Guardrail negative probe (3 cases) | **PASS** — rejects mismatch and sibling-extension, accepts match |
| `git diff --check`, `--name-status`, `--numstat`, ancestry | **PASS** |

No application tests were run, as instructed.

## 17.8 Verdict

**ACCEPT** — the corrected Phase 2 audit is ready for explicit owner acceptance and
closure.

The single blocker from §16.9 is fully discharged, in all three of its parts: the three
archived superseded notes are removed from `CBA2-A05.1`, `CBA2-A05.6` and `CBA2-A05.15`;
no finding was lost, now proved byte-for-byte in both directions; and the integrity
checker carries exactly the one requested attribution assertion, verified live against
both a true positive and a true negative. The repair is minimal, correctly scoped, and
changes nothing else — no verdict, severity, count, cluster, classification, layer,
identity or ordering moved.

This document does not close Phase 2, update the official branch or Linear, or open
Phase 3. Closure is the owner's explicit act. BZE-266 remains open pending that act.
