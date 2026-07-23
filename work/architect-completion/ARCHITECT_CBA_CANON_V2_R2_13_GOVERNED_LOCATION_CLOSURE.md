# Architect CBA Canon v2.0 — R2.13 Governed-Location Closure

## Status

R2.13 is a maker-only bounded correction prepared on the rejected R2.12
checkpoint `68db497240b22a997d472f67a62929358b81cc1e`. The independent R2.12
review returned **REJECT/BLOCK-R3.1** for one mechanical defect: a pipe row
whose ID matched a governed canon-side population could be placed outside
every matching Inventory F range and be silently ignored.

R2.12 and its receipt remain immutable rejected history. This receipt is
maker evidence, not independent acceptance. R2.13 accepts no active record
and does not authorize R3.1. The next required event is an independent
checker review of a pinned clean R2.13 checkpoint.

## Exact Scope

The authorized change set is exactly:

- `docs/reference/cba/ARCHITECT_CBA_CANON.md`
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
- `work/architect-completion/cba_canon_v2_foundation_validator.py`
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_13_GOVERNED_LOCATION_CLOSURE.md`

No prior receipt is edited.

## Closure

The validator now derives a whole-canon location audit from Inventory F
itself:

1. Parse every governed canon-side population, start prefix, end prefix, and
   ID grammar from Inventory F.
2. Resolve every declared interval in the canon.
3. Scan every pipe-delimited row in the entire canon.
4. If the first cell matches one or more Inventory F ID grammars, admit the
   row only when it is physically inside the union of all matching
   intervals.
5. Otherwise reject with the displaced ID and every permitted
   population/range declaration.

Union admission is required for identical or overlapping grammars. In
particular, all five SRC2 base/detail declarations intentionally share the
same `SRC2-[0-9]{3}` grammar. A valid row inside any matching SRC2 interval
therefore passes the generic location audit, after which the existing
per-range parsers enforce exact schemas, provenance-type/detail placement,
and all normal reconciliation.

Inventory F remains the only location authority. The validator adds no
parallel population list, ID grammar, or fixed canon range.

## Validator Evidence

The default suite retains its valid controls:

- C0: the committed R2.13 document tree is accepted.
- C1: the complete migrated-document control is accepted.
- C4: populated OPS and EXT detail rows at their governed locations are
  accepted.

It adds four displaced-row regressions through the same top-level loader,
parser, and reconciliation path:

- O1: an exact-width OPS detail row carrying `SRC2-005` outside every
  matching Inventory F interval is rejected on the governed-location
  diagnostic.
- O2: an exact-width EXT detail row carrying `SRC2-006` outside every
  matching Inventory F interval is rejected on the governed-location
  diagnostic.
- O3: an `EV2-0001` row outside its Inventory F interval is rejected on the
  governed-location diagnostic.
- O4: an `SXW2-0001` row outside its Inventory F interval is rejected on the
  governed-location diagnostic.

The complete default validator was then executed twice with
`PYTHONDONTWRITEBYTECODE=1`:

- Run 1: 69/69 controls passed (6 accepting controls and 63 rejecting
  regressions), `baseline_clean=yes`, zero failures; 124.62 seconds.
- Run 2: the same 69/69 result, `baseline_clean=yes`, zero failures;
  106.94 seconds.
- Each complete report is 89 lines and 10,681 bytes with SHA-256
  `be9f3e371bf1973a58aa3d08e55f74c326f8705b9e7648d25bbb05d0bb036943`.
  A byte-for-byte `cmp` returned zero.

Both runs remained below the four-minute gate. O1–O4 each rejected on the
intended governed-location diagnostic; C0, C1, and C4 each accepted.

## Preservation

The correction changes no active §15.10–§15.12 table row. It preserves
§5.9, historical §15.1–§15.8, scenarios 1–89, the sixteen-check SC2
contract, every committed governed identity, and every prior receipt.
R2.13 mints no concrete CBA2, XW2, SXW2, SRC2, EV2, DR2, SM2, SS2, BND,
BLK, RES, fragment, scenario-fragment, or date-component record.

## Explicit Exclusions

No R3.1 repair or active-row edit; no C/R/L/S registration; no scenario
construction; no README, code-map, application, runtime, test-fixture,
schema, configuration, data, Firestore, Linear, Phase 2, W1.1, main-branch,
release, or production work. No prior receipt, especially the R2.12
receipt, may be changed.

## Gate

The maker checkpoint must pass two byte-for-byte deterministic executions of
the committed default validator in under four minutes each, plus bounded
documentation, preservation, syntax, and clean-scope checks. Maker
completion alone accepts nothing:

**R2.12 rejected → R2.13 maker checkpoint → independent R2.13 checker
ACCEPT → R3.1 maker checkpoint → independent R3.1 checker ACCEPT → R4.**
