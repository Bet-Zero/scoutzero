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

## 15.6 What this decision does not authorise

No application code, test, schema, data or configuration change. No modification of the
accepted Canon or of the Codex Phase 2 artifacts. No Linear update. No Phase 3 issues,
sizing, or ordering work. BZE-266 remains open and unchanged.
