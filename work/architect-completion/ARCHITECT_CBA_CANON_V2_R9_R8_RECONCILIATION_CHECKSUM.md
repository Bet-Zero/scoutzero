# Architect CBA Canon v2 — Repaired-Candidate R8 Reconciliation and Checksum

## Status and boundary

R8 final maker reconciliation is complete for the repaired candidate. The
exact input baseline was clean, synchronized topic-branch commit
`95373507b165892beaf12acf21fc5aa09152af82`, whose direct parent is
`ab8451a4dac4a5d4d385bfdd420610d722bb5d19`. Local and remote `main` remained
fixed at `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.

The frozen route remains version `CBA-CANON-V2-R5-R9/1`, state
`frozen-through-phase-1-closure`, with SHA-256
`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
All nine approved normalized route values remain byte-for-byte unchanged.

The R8 output checkpoint is the exact pushed commit carrying this receipt,
the Canon status reconciliation, and the repair-plan status reconciliation.
Its literal Git SHA is supplied in the final handoff as renewed R9's pinned
input because a commit cannot embed its own hash. The final Canon is exactly
2,092,520 bytes with SHA-256
`85d84d6bb281b8c7355815798b8d4c5db13023a1eefa204cb79b3a79b9a810a0`.

The earlier R8 receipt and its checksum describe checkpoint `16920362`, which
the prior R9 rejected. They remain immutable historical evidence and are not
reused as proof for this repaired candidate. The Canon remains an unaccepted
working draft. Renewed R9 is unstarted and remains the next independent gate.

## Complete reconciled populations

- Relevant-rule checklist: 61 active GROUPs — A 12, C 25, R 10, L 10, S 4 —
  and 815 active LEAFs — A 151, C 417, R 118, L 102, S 27. All 815 main rows
  join one-to-one to 815 detail rows and 815 direct evidence owners.
- Sources and evidence: 6 current `SRC2` records and 823 current `EV2`
  components — CBA 647, BYL 17, NBA 4, DERIVED 6, INFERRED 137, and EXT 12.
  The evidence registry contains 838 `EV2`-to-`SRC2` references and 512
  `EV2` dependency edges. Every root, class, locator, source link, dependency,
  LEAF link, and backlink resolves; both dependency graphs are acyclic.
- Rule dependencies: 744 current LEAF dependency edges. Every target is active,
  every direction and consumption contract reconciles, and no cycle exists.
- Historical mapping: all 368 published v1.1 LEAFs resolve through 494 current
  `XW2` edges and 491 exhaustive fragments. Edge types are 191 equivalent,
  121 split, 41 merge, 106 partial-overlap, 13 moved, 12 invalid, 6
  process-only, and 4 unsupported-residual. Ten `BND` bundles, 17 current
  `SM2` searches, and 4 current `SS2` source sets reconcile with zero
  deferral.
- Terminal state: 22 terminal `XW2` edges and 7 terminal `SXW2` edges resolve
  one-to-one to 29 current `DISP` details. There are no open `BLK` findings,
  `RES` records, unresolved successors, or uncovered terminal dispositions.
- Scenario library: 82 contiguous top-level scenarios, 728 unique named cases,
  and 955 unique bidirectional named-case-to-LEAF Exercise edges. Exactly 661
  SCEN-designated LEAFs are covered: 581 primary plus 80 secondary-only. All
  case edges, LEAF Scenario references, and backlinks reconcile.
- Historical scenario mapping: 89 exact scenario fragments resolve through 89
  `SXW2` dispositions — 82 partial-overlap and 7 invalid — with no unresolved,
  cosmetic, one-sided, or deferred mapping.
- Decision and lineage support: 272 generic decisions — 141 ATOM, 45 OWN, 29
  DISP, 27 METHOD, 15 ORIGIN, 13 AMEND, and 2 TG — plus 822 structured AMEND
  details. The detail populations are 1 DISP, 26 DR2, 226 EV2, 22 GROUP, 367
  LEAF, 4 SRC2, 169 XW2, and 7 scenario-fragment rows. All current identities,
  versions, preservation anchors, references, and terminal amendment chains
  resolve without ID reuse or renumbering.

Current high-water marks are GROUP A12, C25, R10, L10, and S04; LEAF A12.9,
C25.14, R10.12, L10.10, and S04.7; `XW2-0499`; `SRC2-006`; `EV2-0850`;
`SXW2-0089`; `DR2-0272`; `BND-0010`; `SM2-0017`; `SS2-0004`; active scenario
`CBA2-SC-082`; historical rule fragment `CBA-S04.2:F5`; historical scenario
fragment `scenario-89:F1`; and date component `SRC2-005#D1`.

## G1–G15 disposition

G1–G4 pass complete checklist, crosswalk, fragment, target, bundle, search,
deferral, terminal-disposition, blocked-finding, and active-count closure.
G5–G7 pass the strict Phase 1, canon-only, and maker-versus-independent-review
boundary. G8 passes full LEAF and evidence dependency closure plus the semantic
direction review. G9 reconciles atomicity, ownership, disposition, generator,
and origin decisions without an unresolved candidate. G10 passes all scenario
structure, uniqueness, coverage, Exercise-edge, expected-result, and backlink
requirements.

G11 sampled 25 merge/split edges across every populated family/type bucket,
10 distributed named cases, and 12 non-express evidence rows — three each of
DERIVED, INFERRED, NBA, and EXT. Every sample preserved its exact scope, owner,
authority path, expected result, and limitation. G12 reconciles the Canon,
plan, and this receipt as R8 maker-complete while leaving the Canon unaccepted.
G13 records all governed populations, high-water marks, protected boundaries,
and the final checksum. G14 closes the complete source/evidence registry. G15
closes every live population and amendment chain. No substantive, source,
mapping, dependency, scenario, lineage, or terminal-disposition blocker
remains.

## Preservation proof

Every governed GROUP, LEAF main/detail, source, evidence, dependency, XW2,
fragment, bundle, search, source-set, disposition, scenario, case, Exercise,
SXW2, decision, and AMEND row is byte-identical to baseline `95373507`. The
current R7 boundary remains exactly 713,909 bytes with SHA-256
`6ed0154a7428b096fbbba2ea5626636e63b8f8daf23cc0dc31fa3a19b7d4261e`.
The historical crosswalk boundary remains exactly 21,909 bytes with SHA-256
`08c5ed69be1075ad7a9909337b09be30b7d43dcf4114188bee142d64c468d787`.

Only truthful status prose outside the protected route and R7 boundaries,
mechanically derived population prose, and this new receipt differ from the
baseline. No accepted source, rule, evidence, mapping, dependency, scenario,
lineage, route, or historical receipt content changed. Focused independent
re-review is therefore not triggered by this maker reconciliation.

## Frozen-validator execution record

- The unchanged frozen full-document validator was executed exactly once in a
  fresh sequential process with no profiling, cache warming, edits, or
  concurrent work. Its ceiling poll returned at 240.02 seconds; `Ctrl-C` was
  sent immediately, and the process exited 0.85 seconds later with exit 1 and
  `KeyboardInterrupt`.
- At interruption, the validator was executing control `P1`, “a committed XW2
  identity is silently deleted,” while `Tree._read` decoded the mutated Canon.
  The initial current-candidate parse had completed and printed the expected
  live populations, but the validator emitted no final control total,
  `baseline_clean` result, negative self-test result, cache-isolation result,
  or PASS verdict.
- The owner subsequently authorized exactly one additional execution of the
  unchanged frozen validator with a 15-minute hard wall-clock ceiling. For
  this execution only, the exact required correctness PASS within 15 minutes
  is sufficient even if runtime exceeds four minutes. This changes no
  validator, cache, control, expectation, ordering, route, Canon content, or
  performance requirement, and no under-four-minute compliance claim is made.
- Commit condition: this exact three-file byte state may be committed only if
  that fresh sequential execution reports 20 accepting controls, 218 rejecting
  controls, 238/238 PASS, `baseline_clean=yes`, zero failures, a successful
  negative self-test, a successful cache-isolation self-check, and route
  checksum
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`
  within the 15-minute ceiling. The actual runtime is recorded in the final
  handoff so this validator-consumed byte state remains unchanged.
- Complete governed-population, reference, closure, preservation, and checksum
  reconciliation: passed with zero diagnostics.
- Targeted G11 semantic sample review: passed.
- Commit condition: targeted Markdown lint with inherited historical MD029
  treatment, exact three-file `npm run test:diff` with the dot reporter,
  `npm run docs:guardrails`, `npm run validate:project`, and
  `git diff --check` must all pass. Their actual results are recorded in the
  final handoff without changing this receipt after the validator run.

This is maker evidence only. It is not renewed R9 acceptance or owner
acceptance, and it does not authorize Phase 2 or any application work.
