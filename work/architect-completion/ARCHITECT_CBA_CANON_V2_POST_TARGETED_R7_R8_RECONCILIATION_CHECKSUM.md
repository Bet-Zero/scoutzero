# Architect CBA Canon v2 — Post-Targeted-R7 R8 Reconciliation and Checksum

## Status and exact boundary

R8 final maker reconciliation is complete for the renewed-R9 targeted-correction
candidate. The exact input is clean, synchronized, pushed topic-branch commit
`c4f3e20fec97aed27c6eb7948fbc3e7830ce0796`, whose direct parent is the complete
report-only renewed-R9 rejection commit
`eb43b3b730d9a7fd1857363070838a49487eadbf`. Local, tracking, and fetched
live-remote topic refs matched at input with zero ahead and zero behind. Local
and fetched live-remote `main` remained
`69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.

The input Canon was exactly 2,114,372 bytes with SHA-256
`02cc2363b63d2fcb9d2d3a42171cc02a8ed7500888089b85f371874ae073ef04`.
The reconciled Canon is exactly 2,114,569 bytes with SHA-256
`23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`.
The only R8 Canon delta is truthful status prose outside every governed table
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
  cases produce 959 unique case-to-LEAF Exercise edges and 959 exact matching
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

## Targeted scenario correction and preservation proof

Exactly 66 named case identities across 39 scenario families differ from the
governed rejected checkpoint `9b263272cad2f7643ea394beaa7bdd96cf1a1b97`.
Their ordered identity digest is
`a48405a6139de50f25ad983ac41ee420493213d059899f20c6f339587148e481`.
All 66 carry independently derived concrete positive/adverse records and exact
outputs. The other 662 named case rows are byte-identical to that checkpoint;
their ordered-byte digest is
`2fb552235818a90d0e0ea51a26ed99239fefd571d6bbd612fdcf7ba1d7d82fe0`.

Exactly seven LEAF detail rows changed in the targeted R7 commit: `A04.12`,
`A04.33`, `A05.10`, `A10.9`, `A10.17`, `C09.7`, and `C16.35`. Every other
governed table row is byte-identical. The 3,764 protected governed rows outside
the 66 case rows and seven authorized detail rows have ordered digest
`d28d08b0156bbd2c74dda43467e1c82767dace884c6a888c1b6b697d0cbf87b6`.
R8 changes none of those rows.

The protected R7 scenario/crosswalk boundary begins at the final
`### 16.v2 Active v2 scenario library and scenario crosswalk` heading and ends
immediately before `## 17. Recommended comparison sequence`. It remains
exactly 734,090 bytes with SHA-256
`56058b28df76416b9dac1c1bacbbf80e0b3b5e0d2d0c32e393f400ffb0b596bc`.
The nested historical scenario-crosswalk boundary remains exactly 21,909
bytes with SHA-256
`08c5ed69be1075ad7a9909337b09be30b7d43dcf4114188bee142d64c468d787`.

Every parsed GROUP, LEAF main/detail, SRC2, EV2, XW2, fragment, bundle,
search, search-set, DISP, SXW2, scenario-fragment, DR2, AMEND, scenario, and
case row is byte-identical to exact R8 input `c4f3e20f`. No accepted rule,
source, evidence, dependency, mapping, lineage, terminal disposition, scenario
identity, case identity, Exercise edge, backlink, historical receipt, frozen
route field, or validator changes in R8.

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
  all 82 scenarios, 728 cases, 959 Exercise/backlink pairs, 661 covered LEAFs,
  89 fragments, and 89 SXW2 dispositions.
- **G11:** PASS. The deterministic semantic recheck covered the complete
  66-case renewed-R9 correction ledger, 25 merge/split edges across every
  populated family/type bucket, and twelve non-express EV2 rows — three each
  DERIVED, INFERRED, NBA, and EXT. Every reviewed scope, target, owner,
  expected result, authority route, and limitation remains truthful and
  internally consistent.
- **G12:** PASS. Canon, plan, and this receipt record post-targeted-R7 R8 maker
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

The unchanged frozen parser's single top-level static document-tree path must
return zero problems on the exact final bytes. It must report the exact
preservation anchors, closed post-R3.1 migration state, every triggered G15R
population present, and the complete populations above.

## Targeted checks and final certification condition

The finalized three-file candidate records these required results:

- targeted Markdown lint over the exact three files, with only inherited
  `MD029` treatment disabled: PASS;
- `npm run test:diff` over the exact three files with the dot reporter: PASS;
  the approved runner selected `FAST`, and all 12 test files / 57 tests passed;
- `npm run docs:guardrails`: PASS;
- `npm run validate:project`: PASS;
- `git diff --check`: PASS; and
- exact repository scope: the Canon status prose, repair-plan R8 status and
  derived reconciliation prose, and this new receipt only.

The unchanged validator must execute in one fresh sequential process under a
15-minute hard ceiling. Commit and push are permitted only if it reports
exactly 20 accepting controls, 218 rejecting controls, 238/238 PASS,
`baseline_clean=yes`, zero failures, a successful negative self-test, a
successful cache-isolation self-check, and route checksum
`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
If recording that result changes a validator-consumed file, one final fresh
execution must run on the exact bytes to be committed and no repository file
may change afterward. The final exact-byte runtime belongs in the handoff.

The first fresh validator attempt ran for 86.61 seconds. Its baseline document
tree was clean and every governed population above matched, but the unchanged
negative-control harness stopped before running the 238 controls because the
plan no longer contained its approved literal mutation anchor, `R7 execution
status — complete in this checkpoint`. The plan now restores that exact frozen
anchor while retaining the truthful targeted-R7 and R8 completion status. No
Canon content, governed row, route field, or validator source changed in this
repair. A successful fresh run must be recorded before the final exact-byte
execution.

The second fresh validator attempt ran for 83.35 seconds. It confirmed the
first mutation anchor, again reported a clean baseline and the exact governed
populations, then stopped before the 238 controls at the adjacent approved
literal anchor, `The canon now contains the complete active scenario`. The
plan now restores that exact truthful sentence and corrects the derived edge
count there from the historical 955 to the current 959. Inspection of the
unchanged control block confirmed these are the complete prose anchors used by
this route-mode mutation. No validator source or governed Canon content
changed. A successful fresh run is still required before the final exact-byte
execution.

The third fresh validator attempt completed successfully in 147.52 seconds.
It reported exactly 20 accepting controls plus 218 rejecting regressions,
238/238 PASS, `baseline_clean=yes`, and zero failures. Its negative self-test
succeeded; the silent inventory cache-isolation self-check passed as part of
the clean baseline path; and the current-route controls retained exact SHA-256
`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`,
including the successful wrong-hash rejection. Because recording this result
changes the receipt, one final fresh validator execution follows on the exact
bytes to be committed. No repository edit may follow that execution; its
runtime belongs in the final handoff.

Full application tests, build, typecheck, E2E, source reacquisition,
application inspection, Graphify update, and the full test suite are
intentionally not run: this is a bounded documentation-only R8 maker gate,
`RUN FULL SUITE` was not authorized, accepted source content is protected,
and every downstream/application surface is explicitly out of scope.
