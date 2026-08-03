# Architect CBA Canon v2 — R8 reconciliation and checksum

## Status and boundary

R8 maker reconciliation is complete. The exact input was clean, synchronized
commit `762f58e09f816f40c710c3a0a8906a5ff6387282`, direct parent
`4e49d799b9e0d3a482ce824c1c5298dea0dc6750`, with local and remote `main`
fixed at `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`. The independently accepted
frozen route contract remains version `CBA-CANON-V2-R5-R9/1`, SHA-256
`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.

The R8 output checkpoint is the exact pushed commit carrying this receipt,
the Canon status reconciliation, and the repair-plan status reconciliation.
Its literal Git SHA is pinned in the R8 final handoff and supplied as the R9
input; a commit cannot embed its own hash. The final Canon SHA-256 is
`a332748938c6564c936c7792a6827c06310832367e2680a693c4f01ea0c7982f`.

The Canon remains an unaccepted working draft. R9 is not started. Phase 2,
W1.1, the Architect comparison, application/runtime work, data/configuration,
tests, Linear, Graphify, and `main` remain untouched and blocked.

## Reconciled populations

- Relevant-rule checklist: 61 active GROUPs — A 12, C 25, R 10, L 10, S 4 —
  and 782 active LEAFs — A 151, C 417 (C01–C13 120; C14–C25 297), R 85,
  L 102, S 27. The 782 main rows and 782 detail rows are one-to-one.
- Historical mapping: all 368 published v1.1 LEAFs resolve through 494
  current `XW2` edges and 491 exhaustive fragments. Edge types are 191
  equivalent, 121 split, 41 merge, 106 partial-overlap, 13 moved, 12 invalid,
  6 process-only, and 4 unsupported-residual. Ten `BND` bundles reconcile;
  current deferrals and prose-only deferrals are zero.
- Terminal state: 22 terminal `XW2` edges (12 invalid, 6 process-only, 4
  unsupported-residual) and 7 terminal `SXW2` invalid edges resolve directly
  to 29 current `DISP` details. There are no no-successor edges, open `BLK`
  findings, or `RES` records. Each unsupported residual — `XW2-0145`,
  `XW2-0148`, `XW2-0191`, and `XW2-0495` — was individually reconciled to
  its exact fragment, supported sibling where required, preserved-candidate
  anchor, 17 current `SM2` searches, and one of 4 current `SS2` sets; every
  set covers CBA, BYL, NBA, and ops-provenance and reports adequate coverage.
- Sources/evidence: 6 current `SRC2` records — 2 official-immutable, 3
  official-mutable, 1 ext-contract, 0 ops-provenance — plus 7 date-component
  rows. The 790 current `EV2` components are CBA 621, BYL 18, NBA 4, DERIVED
  6, INFERRED 129, and EXT 12. All 782 LEAFs carry evidence; 790 LEAF-to-EV2
  backlinks cover all 790 components. The registry has 803 direct `SRC2`
  references and 487 `EV2` dependency edges, with complete typed roots,
  class reconciliation, and no orphan, dangling, cyclic, or laundering chain.
- Rule dependencies: 652 current LEAF dependency edges from 233 LEAFs. All
  targets are active, direction and consumption reconcile, and the graph is
  acyclic. The 26 cross-family edges (C→A 2, R→A 1, L→A 10, L→C 9, S→A 2,
  S→R 2) were each read during R8; none is a later-unit dependency or an
  omitted-owner workaround.
- Scenario library: 82 contiguous active scenarios, 713 unique named cases,
  and 902 unique bidirectional named-case-to-LEAF edges. SCEN-designated
  coverage is 559 primary plus 80 secondary-only LEAFs, or 639 total. The 89
  `SXW2` edges are 82 partial-overlap and 7 invalid, with 89 exact scenario
  fragments and zero unresolved, one-sided, cosmetic, or pending-R7 edge.
- Decision/lineage support: 264 current `DR2` records — 139 ATOM, 45 OWN, 29
  DISP, 27 METHOD, 13 ORIGIN, 9 AMEND, and 2 TG — plus 633 governed AMEND
  detail rows. All current references resolve directly, all receipt-era
  versions terminate in one current disposition or explicit removal, and no
  ID was reused or renumbered.

Current high-water marks remain `XW2-0499`, `SRC2-006`, `EV2-0817`,
`SXW2-0089`, `DR2-0264`, `BND-0010`, `SM2-0017`, and `SS2-0004`.

## G1–G15 result

G1–G4 pass the complete crosswalk, target, terminal-disposition, fragment,
blocked-finding, and active-count reconciliation above. G5–G7 pass the strict
Phase 1/canon-only/verdict boundary. G8 passes mechanical and semantic
dependency review. G9 reconciles the accepted seven-generator ownership and
atomicity populations to the current ATOM/OWN/DISP/TG/ORIGIN records with zero
unresolved candidate. G10 reruns SC1–SC7 over the complete scenario library.

G11 sampled 25 merge/split mappings across every populated family/type bucket,
10 evenly distributed named cases, and 12 non-express evidence components
(three each DERIVED, INFERRED, NBA, and EXT); every sample preserved its exact
scope, owner, expected result, authority route, and limitations. G12 reconciles
the Canon, plan, and this receipt as R8 maker-complete while leaving the Canon
unaccepted. G13 records the governed counts and checksum here. G14 reconciles
the complete source/evidence registry. G15 reconciles every live population and
its amendment chain. No substantive, source, mapping, dependency, scenario,
lineage, or terminal-disposition blocker remains.

## Finding handling and validation

R8 changed only status prose in the Canon and repair plan plus this receipt.
No accepted R3.1, R4, R5, or R6 requirement, authority class, source, evidence
component, origin, dependency, mapping, or scenario rule content changed.
Therefore the focused independent re-review trigger did not fire.

Final validation record:

- frozen full-document validator: the first intended-candidate run exposed one
  R8-authored status-mirror defect — the protected §15.10 register paragraph
  no longer preserved the frozen validator's exact current-route phrase. That
  paragraph was restored byte-for-byte to the accepted pre-R8 baseline. The
  corrected final-candidate run then passed: 20 accepting controls plus 218
  rejecting regressions, 238/238 PASS, baseline clean, zero failures, and the
  negative self-test and cache-isolation check successful;
- targeted governed-population/count/reference reconciliation: passed; the
  frozen route declaration recomputed to its recorded SHA-256 and all parsed
  inventory/population diagnostics were empty;
- targeted semantic cross-family dependency and G11 sample review: passed;
- targeted Markdown lint: repair plan and this receipt passed; the Canon
  reports only the same 74 inherited `MD029/ol-prefix` findings in preserved
  historical scenarios 16–89, with no R8-touched line implicated;
- `npm run docs:guardrails`: passed;
- `npm run validate:project`: passed;
- `git diff --check`: passed.

R9 must independently assess the exact pushed R8 checkpoint and checksum. No
statement here is R9 acceptance or owner acceptance.
