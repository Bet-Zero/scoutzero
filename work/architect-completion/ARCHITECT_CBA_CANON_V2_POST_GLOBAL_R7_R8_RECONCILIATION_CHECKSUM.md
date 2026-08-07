# Architect CBA Canon v2 — Post-Global-R7 R8 Reconciliation and Checksum

## Status and exact boundary

R8 final maker reconciliation is complete for the post-global-R7 candidate.
The exact input was the clean, synchronized topic-branch checkpoint
`b2ef24dc20e0646c3583b39053b3f0222f5b5838`, whose direct parent is
`d618e65c5377999cd0543a5b17a3fa7cc29e6fe4`. Local, tracking, and fetched
live-remote topic refs matched at input with zero ahead and zero behind. Local
and fetched live-remote `main` remained
`69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.

The input Canon was exactly 2,103,395 bytes with SHA-256
`02b6a6e6374fa051129ec86c330ed97719d05ed34fed28ad3113c6c1a5d2d583`.
The reconciled Canon is exactly 2,104,588 bytes with SHA-256
`4bf1c587e844990d5dda26eedf382c632ef90a663700f221d68c9c2ef66524f0`.
The only Canon delta is truthful R8 status prose outside every governed table
and the frozen R7 boundary.

The frozen current route remains version `CBA-CANON-V2-R5-R9/1`, state
`frozen-through-phase-1-closure`, with independently recomputed SHA-256
`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
All nine actual normalized route fields match the frozen values. The output
checkpoint is the exact pushed commit carrying this receipt and the two status
reconciliations; its Git SHA belongs in the final handoff because a commit
cannot embed its own hash.

The Canon remains an unaccepted working draft. Renewed R9 is unstarted and is
the next and only next gate. This receipt is maker evidence, not renewed R9 or
owner acceptance, and authorizes no Phase 2, W1.1, Architect comparison,
application/runtime, Linear, Graphify, data/configuration, or `main` work.

## Complete recomputed populations

- Active register: 61 GROUPs — A 12, C 25, R 10, L 10, S 4 — and 815
  active LEAFs — A 151, C 417, R 118, L 102, S 27. All 815 main rows join
  one-to-one to 815 detail rows and all carry evidence.
- Source/evidence registry: 6 current SRC2 records, 7 date-component rows,
  and 823 EV2 components — CBA 647, BYL 17, NBA 4, DERIVED 6, INFERRED 137,
  and EXT 12. The registry has 838 direct EV2-to-SRC2 references and 512 EV2
  dependency edges. Every root, locator, class, dependency, owner, LEAF link,
  and backlink resolves; the evidence graph is acyclic.
- Rule dependencies: 744 LEAF dependency edges. Every target is active, every
  direction and consumption contract reconciles, and the graph is acyclic.
  The complete cross-family population remains 26: C→A 2, R→A 1, L→A 10,
  L→C 9, S→A 2, and S→R 2.
- Historical-rule mapping: all 368 published v1.1 LEAFs resolve through 494
  XW2 edges and 491 exhaustive fragment rows. Edge types are 191 equivalent,
  121 split, 41 merge, 106 partial-overlap, 13 moved, 12 invalid, 6
  process-only, and 4 unsupported-residual. Ten BND bundles, 17 SM2 searches,
  and 4 SS2 source sets reconcile with zero current deferral.
- Terminal state: 22 terminal XW2 edges and 7 terminal SXW2 edges resolve
  one-to-one to 29 current DISP details. There are zero `no-successor` edges,
  open BLK findings, RES records, unresolved successors, or uncovered terminal
  dispositions. The four individually reviewed unsupported residuals remain
  `XW2-0145`, `XW2-0148`, `XW2-0191`, and `XW2-0495`; each retains its exact
  residual scope, supported sibling, adequate current search set, truthful
  not-located basis, and preserved-candidate anchor.
- Scenario library: 82 contiguous top-level scenarios and 728 unique named
  cases produce 955 unique case-to-LEAF Exercise edges and 955 exact matching
  detail-table backlinks. Exactly 661 SCEN-designated LEAFs are covered: 581
  primary plus 80 secondary-only.
- Historical scenario mapping: 89 exact scenario fragments resolve through 89
  SXW2 edges — 82 partial-overlap and 7 invalid — with zero unresolved,
  cosmetic, one-sided, or deferred mapping.
- Decision and lineage support: 272 generic decisions — 141 ATOM, 45 OWN, 29
  DISP, 27 METHOD, 15 ORIGIN, 13 AMEND, and 2 TG — plus 822 structured AMEND
  details. The detail populations are 1 DISP, 26 DR2, 226 EV2, 22 GROUP, 367
  LEAF, 4 SRC2, 169 XW2, and 7 fragment rows. All identities, versions,
  references, and terminal amendment chains resolve without ID reuse or
  renumbering.

Current high-water marks remain GROUP A12, C25, R10, L10, and S04; LEAF
A12.9, C25.14, R10.12, L10.10, and S04.7; `XW2-0499`; `SRC2-006`;
`EV2-0850`; `SXW2-0089`; `DR2-0272`; `BND-0010`; `SM2-0017`; `SS2-0004`;
active scenario `CBA2-SC-082`; historical rule fragment `CBA-S04.2:F5`;
historical scenario fragment `scenario-89:F1`; and date component
`SRC2-005#D1`.

## Repaired scenario population and preservation proof

The exact rejected-R9 literal criterion independently re-enumerates 614 unique
case identities across 81 families from checkpoint `3efe90d2755e49a169b699d8884681c074a0dc42`.
Every identity remains present. `CBA2-SC-072` remains the sole family with no
affected case. The other 114 active case rows are byte-identical to that
baseline.

For all 614 repaired rows, the case ID, boundary, controlling
authority/evidence cell, and Exercises cell remain byte-identical. Every row
contains a fully assigned `P+ record`, a byte-identical `P− record` with an
explicit meaningful override, a `P+ exact output`, and a distinct `P− exact
output` containing an independently checkable calculation, date, state or
lifecycle result, or permitted/prohibited action. The rejected literal occurs
zero times; the complete mechanical/semantic screen finds zero equivalent
predicate-only construction, unexpanded placeholder, asserted ultimate legal
result as input, missing adverse difference, or oracle-only PASS/FAIL row.

The complete family accounting remains exactly the 81-family distribution in
the immutable global-R7 receipt and sums to 614. Scenario IDs, case IDs,
Exercise edges, backlinks, and SCEN coverage reconcile bidirectionally at
82 / 728 / 955 / 955 / 661.

The protected R7 scenario/crosswalk boundary begins at the final
`### 16.v2 Active v2 scenario library and scenario crosswalk` heading and ends
immediately before `## 17. Recommended comparison sequence`. It remains
exactly 724,784 bytes with SHA-256
`f558f126743f2eb1a64baaeec404a6952030399749ba538d7b799110966b309a`.
The nested historical scenario-crosswalk boundary remains exactly 21,909
bytes with SHA-256
`08c5ed69be1075ad7a9909337b09be30b7d43dcf4114188bee142d64c468d787`.

Every parsed GROUP, LEAF main/detail, SRC2, EV2, XW2, fragment, bundle,
search, search-set, DISP, SXW2, scenario-fragment, DR2, and AMEND row is
byte-identical to the repaired-candidate R8 baseline `3efe90d2`; the later
global-R7 delta is confined to the 614 authorized case input/oracle cells,
non-contract plan status prose, and its immutable maker receipt. This R8 delta
changes no governed row at all. No accepted rule, source, evidence,
dependency, mapping, lineage, terminal disposition, scenario identity, case
identity, Exercise edge, backlink, historical receipt, frozen route field, or
validator changes in this candidate.

## G1–G15 reconciliation

- **G1:** PASS. All 368 published LEAFs, 491 fragments, 494 XW2 edges, ten
  bundles, and all receipt/current endpoints reconcile; zero deferred edge,
  prose-only deferral, orphan fragment, or open blocker remains.
- **G2:** PASS. Every nonterminal target resolves to one active LEAF; no
  current deferred target exists.
- **G3:** PASS. All 29 terminal dispositions join directly and uniquely to
  correctly typed current DISP details. There are no `no-successor` edges.
  All four unsupported residuals and their 17-search/four-set support surface
  pass individual scope, sibling, coverage, not-located, and preservation
  review.
- **G4:** PASS at the complete 61-GROUP / 815-LEAF active population, with
  support and historical rows excluded.
- **G5–G7:** PASS. The Phase 1, canon-only, and no-product-verdict boundaries
  remain intact; no README, code map, Phase 2, application/runtime, or
  downstream packet is read or changed.
- **G8:** PASS. Both complete dependency graphs are closed and acyclic. All
  26 cross-family edges were semantically re-read; none reverses the accepted
  construction order or substitutes an aggregate for a missing direct owner.
- **G9:** PASS. Global ATOM/OWN/DISP/TG/ORIGIN populations and all seven
  duplicate-candidate generators reconcile with zero unresolved candidate.
- **G10:** PASS. SC1–SC7 and the complete sixteen-check SC2 contract reconcile
  all 82 scenarios, 728 cases, 955 Exercise/backlink pairs, 661 covered LEAFs,
  89 fragments, and 89 SXW2 dispositions.
- **G11:** PASS. The deterministic semantic recheck covered 25 merge/split
  edges across every populated family/type bucket, ten evenly distributed
  named cases, and twelve non-express EV2 rows — three each DERIVED, INFERRED,
  NBA, and EXT. The edge sample was `XW2-0001`, `XW2-0002`, `XW2-0004`,
  `XW2-0011`, `XW2-0014`–`XW2-0017`, `XW2-0021`–`XW2-0024`, `XW2-0032`,
  `XW2-0081`–`XW2-0083`, `XW2-0112`, `XW2-0117`, `XW2-0161`, `XW2-0220`,
  `XW2-0341`, `XW2-0380`, `XW2-0440`, `XW2-0490`, and `XW2-0494`. The case
  sample was `CBA2-SC-001(a)`, `CBA2-SC-009(a)`, `CBA2-SC-017(e)`,
  `CBA2-SC-030(b)`, `CBA2-SC-037(k)`, `CBA2-SC-045(b)`, `CBA2-SC-052(k)`,
  `CBA2-SC-061(b)`, `CBA2-SC-068(h34)`, and `CBA2-SC-082(h61)`. The EV2
  sample was `EV2-0001`, `EV2-0010`, `EV2-0012`, `EV2-0634`, `EV2-0663`,
  `EV2-0668`, `EV2-0785`, `EV2-0790`, `EV2-0796`, `EV2-0814`, `EV2-0816`,
  and `EV2-0850`. Every sampled scope, target, owner, expected result,
  authority route, and limitation remains truthful and internally consistent.
- **G12:** PASS. Canon, plan, and this receipt record post-global-R7 R8 maker
  completion while keeping the Canon unaccepted and renewed R9 unstarted.
- **G13:** PASS. Complete actual populations, protected boundaries, final
  Canon byte count, and final Canon SHA-256 are recorded above.
- **G14:** PASS. The complete source/evidence registry passes typed-root,
  class, locator, dependency, closure, SM2/SRC2 binary, SS2 coverage, and
  bidirectional owner/reference reconciliation with zero diagnostic.
- **G15:** PASS. Every live identity and receipt-era version resolves through
  exactly one current endpoint or explicit removal. There is no stale live
  reference, duplicate/orphan correction, broken chain, unexplained child
  gap, ID reuse, or renumbering.

The unchanged frozen parser's single top-level static document-tree path
returns zero problems. It reports the exact preservation anchors, closed
post-R3.1 migration state, every triggered G15R population present, and the
complete populations above.

## Targeted checks and final certification condition

The finalized three-file candidate records these required targeted results:

- targeted Markdown lint over the exact three files, with only inherited
  `MD029` treatment disabled: PASS;
- `npm run test:diff` over the exact three files with the dot reporter: PASS;
- `npm run docs:guardrails`: PASS;
- `npm run validate:project`: PASS;
- `git diff --check`: PASS; and
- exact repository scope: the Canon status prose, repair-plan status and
  derived checksum prose, and this new receipt only.

The first post-global-R7 R8 frozen-validator attempt ran in 151.68 seconds.
Its baseline document tree was clean, its negative self-test succeeded, and
all 20 accepting controls and 217 of 218 rejecting controls passed. It
correctly reported one total failure: `SI-C1` accepted its deliberately wrong
route hash because earlier historical R7 status prose repeated the declaration
checksum before the sole machine-shaped declaration, so the control's
first-occurrence mutation did not reach the declaration. This finalized retry
state records that earlier historical checksum as two explicit 32-character
halves while preserving its value and leaving the frozen declaration itself
unchanged. No validator source, route field, governed row, or protected Canon
content changed.

The unchanged validator must now execute again in one fresh sequential process
under a 15-minute hard ceiling. Commit and push are permitted only if that run
reports exactly 20 accepting controls, 218 rejecting controls, 238/238 PASS,
`baseline_clean=yes`, zero failures, a successful negative self-test, a
successful cache-isolation self-check, and route checksum
`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
Its actual runtime and the final three file hashes belong in the final handoff.
After that successful execution, no repository file may change before commit.

Full application tests, build, typecheck, E2E, source reacquisition,
application inspection, Graphify update, and the full test suite are
intentionally not run: this is a bounded documentation-only R8 maker gate,
`RUN FULL SUITE` was not authorized, accepted source content is protected,
and every downstream/application surface is explicitly out of scope.
