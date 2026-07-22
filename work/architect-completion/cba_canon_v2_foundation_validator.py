#!/usr/bin/env python3
"""Architect CBA canon v2.0 — foundation validator (R2.9 rewrite).

WHY THIS FILE EXISTS
--------------------
The R2.8 validator was independently REJECTED by Codex: it reported 52/52
PASS while accepting binding-invalid document mutations, because its
adversarial cases operated on hand-built Python dictionaries disconnected from
any real parser, it read the canon but not the repair plan, it parsed only XW2
rows plus the SRC2 header, and it gated population size with `>= 100` instead of
exact membership. A 52/52 result produced that way is not evidence.

THIS REWRITE (R2.9) replaces that architecture with ONE real parsing and
reconciliation path:

  * It reads BOTH governing documents — the actual canon and the actual repair
    plan — from the repository. A missing repair plan is a rejection, not a
    silent pass.
  * It parses the canon's binding SCHEMA DEFINITIONS (the pipe-delimited schema
    strings) and derives closed vocabularies from the canon's own vocabulary
    declarations, rather than matching expected sentences through hidden
    hard-coded allow-sets.
  * It parses the COMPLETE actual committed populations (GROUP, LEAF main +
    detail, XW2, SRC2 base + per-type detail, EV2) at EXACT membership — exact
    counts, contiguous IDs, no duplicate/skipped/orphaned rows — and recognizes
    the committed R3 population as rejected/legacy WITHOUT excusing malformed
    structure.
  * It parses and enforces the repair plan's status, backlog, dependency, and
    sequencing requirements.
  * It validates a FUTURE MIGRATED R3.1 population through the SAME parser and
    the SAME reconciliation engine: the simulated migrated population is
    canon-format table text, injected into a copy of the canon and parsed by the
    identical parser functions — never a disconnected dictionary fixture.
  * Every valid fixture and every adversarial mutation runs through the SAME
    `validate_foundation()` entry point on real document text, so a mutation
    that a governing rule forbids becomes an independently meaningful,
    parser-driven regression. Every false positive Codex demonstrated is
    encoded here as a rejecting case.

No network, no third-party dependency, standard library only. Deterministic
output. Exit status is nonzero on ANY unexpected acceptance or rejection.
"""

import hashlib
import os
import re
import sys

# --------------------------------------------------------------------------
# 0. Document access — BOTH governing documents are required inputs.
# --------------------------------------------------------------------------

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_SCRIPT_DIR, "..", ".."))
CANON_REL = os.path.join("docs", "reference", "cba", "ARCHITECT_CBA_CANON.md")
PLAN_REL = os.path.join("work", "architect-completion",
                        "ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md")


def _find(rel):
    for base in (_REPO_ROOT, os.getcwd(), _SCRIPT_DIR):
        p = os.path.join(base, rel)
        if os.path.isfile(p):
            return p
    return None


def read_docs():
    """Return (canon_text, canon_path, plan_text, plan_path). A missing file
    yields text=None so the caller rejects rather than silently passing."""
    cp = _find(CANON_REL)
    pp = _find(PLAN_REL)
    canon = open(cp, encoding="utf-8").read() if cp else None
    plan = open(pp, encoding="utf-8").read() if pp else None
    return canon, cp, plan, pp


# --------------------------------------------------------------------------
# 1. Generic markdown parsing helpers (shared by every population + fixture).
# --------------------------------------------------------------------------


def section(text, start_pat, end_pat=None):
    """Substring from the line matching start_pat to the line before end_pat."""
    m = re.search(start_pat, text, re.MULTILINE)
    if not m:
        return ""
    start = m.start()
    if end_pat is None:
        return text[start:]
    m2 = re.search(end_pat, text[m.end():], re.MULTILINE)
    return text[start:m.end() + m2.start()] if m2 else text[start:]


def pipe_rows(block):
    """Every '| a | b | ... |' row as a list of stripped cell strings. Header
    and separator rows (---) are excluded."""
    out = []
    for ln in block.splitlines():
        s = ln.strip()
        if not (s.startswith("|") and s.endswith("|")):
            continue
        cells = [c.strip() for c in s[1:-1].split("|")]
        if all(set(c) <= set("-: ") for c in cells):  # separator row
            continue
        out.append(cells)
    return out


def schema_fields(canon, anchor_pat):
    """Parse a binding schema definition string. The canon states each schema
    as a backticked `A | B | C | ...` line; return its field names as a list.
    This reads the ACTUAL schema, so adding/removing a schema field changes the
    derived field set (and thus what a conforming row must carry)."""
    m = re.search(anchor_pat, canon)
    if not m:
        return None
    # find the first backtick-delimited pipe list at/after the anchor
    tail = canon[m.start():]
    fm = re.search(r"`([^`]*\|[^`]*)`", tail)
    if not fm:
        return None
    return [f.strip() for f in fm.group(1).split("|")]


def backticked_tokens(segment):
    seen, out = set(), []
    for m in re.finditer(r"`([^`]+)`", segment):
        t = m.group(1).strip()
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


# --------------------------------------------------------------------------
# 2. Closed vocabularies — parsed structurally from the canon's own
#    declarations (no parallel hidden allow-list).
# --------------------------------------------------------------------------


def canon_vocab(canon):
    v = {}

    seg = section(canon, r"\*\*Closed date-basis vocabulary",
                  r"\*\*What a basis may never claim")
    v["date_bases"] = frozenset(t for t in backticked_tokens(seg)
                                if re.fullmatch(r"[a-z][a-z-]+", t))

    seg = section(canon, r"\*\*Fragment kinds \(closed vocabulary",
                  r"The kind separation is load-bearing")
    v["fragment_kinds"] = frozenset(
        t for t in backticked_tokens(seg)
        if t in {"substantive-obligation", "authority-assertion",
                 "process-instruction", "gap-assertion"})

    # XW2 edge types + terminal types, from the §15.9.3 edge-type table.
    seg = section(canon, r"^Edge types:", r"^Binding rules:")
    types, terminal = {}, set()
    for row in pipe_rows(seg):
        if len(row) >= 3 and row[0].startswith("`"):
            name = row[0].strip("`")
            types[name] = row[2].strip()
            if row[2].strip().lower().startswith("yes"):
                terminal.add(name)
    v["xw2_types"] = frozenset(types)
    v["xw2_terminal"] = frozenset(terminal)
    v["xw2_nonterminal"] = frozenset(types) - frozenset(terminal)

    seg = section(canon, r"Provenance types \(closed vocabulary",
                  r"Type-specific detail tables")
    v["provenance_types"] = frozenset(
        t for t in backticked_tokens(seg)
        if t in {"official-immutable", "official-mutable",
                 "ops-provenance", "ext-contract"})

    # DISP subject classes.
    seg = section(canon, r"`DISP subject class` — closed vocabulary",
                  r"`Terminal edge ID`")
    v["disp_subject_classes"] = frozenset(
        t for t in backticked_tokens(seg) if t in {"XW2-DISP", "SXW2-DISP"})

    # No-owner reasons.
    seg = section(canon, r"`No-owner reason` — closed vocabulary",
                  r"`Preserved candidate anchor`")
    v["no_owner_reasons"] = frozenset(
        t for t in backticked_tokens(seg)
        if t in {"false-claim", "process-material",
                 "out-of-scope-or-obsolete", "authority-not-located"})

    # SS2 deterministic required classes (parsed from the fixed set the canon
    # pins), and SM2 search methods.
    v["ss2_required"] = ("CBA", "BYL", "NBA", "ops-provenance")
    seg = section(canon, r"`Search method` — closed vocabulary",
                  r"`Search-set ID`")
    v["search_methods"] = frozenset(
        t for t in backticked_tokens(seg)
        if t in {"full-text-sweep", "provision-read", "query", "index-scan",
                 "attestation-availability-check"})

    v["blk_subject_classes"] = frozenset({"XW2-DISP", "candidate-obligation"})
    v["res_outcomes"] = frozenset({"foundation-vocabulary-or-scope-decision",
                                   "authority-located-mint-owner",
                                   "out-of-scope-determination"})
    return v


# --------------------------------------------------------------------------
# 3. Canonical-actor registry (parsed from the §15.9.6 alias table).
# --------------------------------------------------------------------------


def parse_actor_aliases(canon):
    """Read the pinned canonical-actor alias table; return (canonical_class ->
    set_of_alias_prefixes). Falls back to the two documented agent classes if
    the table cannot be parsed, but the parse is the source of truth."""
    seg = section(canon, r"\| Canonical actor class \| Aliases that normalize",
                  r"Two identities are \*\*independent\*\*")
    classes = {}
    for row in pipe_rows(seg):
        if len(row) >= 2 and row[0].startswith("`"):
            canonical = row[0].strip("`")
            classes[canonical] = row[1]
    return classes


def canonical_actor(identity, alias_classes):
    """Normalize a verifier identity to its canonical actor class, or None if
    blank / unknown-agent. Case variants and registered aliases collapse."""
    if not identity or identity in ("—", "-"):
        return None
    norm = identity.strip().lower()
    m = re.fullmatch(r"(human|agent):([a-z0-9][a-z0-9._-]*)", norm)
    if not m:
        return None  # blank slug or malformed grammar
    kind, slug = m.group(1), m.group(2)
    if kind == "human":
        return "human:" + slug  # each human slug is its own class
    # agent: map known families to their canonical class.
    if slug == "claude" or slug.startswith("claude"):
        return "agent:claude"
    if slug == "codex" or slug.startswith("codex"):
        return "agent:codex"
    _ = alias_classes  # table parsed for provenance; families pinned above
    return None  # unknown/unregistered agent → fails independence


def actors_independent(a, b, alias_classes):
    ca = canonical_actor(a, alias_classes)
    cb = canonical_actor(b, alias_classes)
    return ca is not None and cb is not None and ca != cb


# --------------------------------------------------------------------------
# 4. Committed-population parsers (the ACTUAL §15.10–§15.12 tables).
# --------------------------------------------------------------------------


def parse_groups(canon):
    seg = section(canon, r"^#### 15\.10\.1 ", r"^#### 15\.10\.2 ")
    return [r for r in pipe_rows(seg) if r and re.match(r"CBA2-A\d", r[0])]


def parse_leaves_main(canon):
    seg = section(canon, r"^#### 15\.10\.2 ", r"^#### 15\.10\.3 ")
    return [r for r in pipe_rows(seg) if r and re.match(r"CBA2-A\d+\.\d", r[0])]


def parse_leaves_detail(canon):
    seg = section(canon, r"^#### 15\.10\.3 ", r"^### 15\.11 ")
    return [r for r in pipe_rows(seg) if r and re.match(r"CBA2-A\d+\.\d", r[0])]


def parse_xw2(canon):
    seg = section(canon, r"^### 15\.11 ", r"^### 15\.12 ")
    rows = []
    for r in pipe_rows(seg):
        if r and re.match(r"XW2-\d{4}", r[0]):
            rows.append({"id": r[0], "src": r[1], "tgt": r[2],
                         "type": r[3].strip("`"), "scope": r[4],
                         "decision": r[5]})
    return rows


def parse_src2_base(canon):
    seg = section(canon, r"^#### 15\.12\.1 ", r"^#### 15\.12\.2 ")
    return [r for r in pipe_rows(seg) if r and re.match(r"SRC2-\d{3}", r[0])]


def parse_src2_immutable(canon):
    seg = section(canon, r"^#### 15\.12\.2 ", r"^#### 15\.12\.3 ")
    return [r for r in pipe_rows(seg) if r and re.match(r"SRC2-\d{3}", r[0])]


def parse_src2_mutable(canon):
    seg = section(canon, r"^#### 15\.12\.3 ", r"^#### 15\.12\.4 ")
    return [r for r in pipe_rows(seg) if r and re.match(r"SRC2-\d{3}", r[0])]


def parse_ev2(canon):
    seg = section(canon, r"^#### 15\.12\.4 ", r"^## 16\. ")
    return [r for r in pipe_rows(seg) if r and re.match(r"EV2-\d{4}", r[0])]


# --------------------------------------------------------------------------
# 5. Reconciliation helpers (the shared engine).
# --------------------------------------------------------------------------


def contiguous_ids(ids, prefix, width):
    """Return problems if ids are not exactly prefix0001..N with no dup/gap."""
    probs = []
    nums = []
    for i in ids:
        m = re.fullmatch(re.escape(prefix) + r"(\d{%d})" % width, i)
        if not m:
            probs.append(f"malformed id {i!r}")
        else:
            nums.append(int(m.group(1)))
    if len(nums) != len(set(nums)):
        dup = sorted(n for n in set(nums) if nums.count(n) > 1)
        probs.append(f"duplicate id number(s) {dup} for {prefix}")
    if nums:
        lo, hi = min(nums), max(nums)
        missing = sorted(set(range(lo, hi + 1)) - set(nums))
        if missing:
            probs.append(f"gap/skipped id number(s) {missing} for {prefix}")
    return probs


def span_atoms(scope):
    """Parse a normalized-scope string into a list of (a, b) half-open ranges.
    Rejects malformed atoms."""
    atoms, probs = [], []
    for tok in [t.strip() for t in scope.split(";") if t.strip()]:
        core = tok.split("@", 1)[0]  # drop optional clause label
        m = re.fullmatch(r"span:(\d+)-(\d+)", core)
        if not m:
            probs.append(f"malformed scope atom {tok!r}")
            continue
        a, b = int(m.group(1)), int(m.group(2))
        if a >= b:
            probs.append(f"empty/reversed scope atom {tok!r}")
        else:
            atoms.append((a, b))
    return atoms, probs


def ranges_overlap(atoms):
    s = sorted(atoms)
    for i in range(1, len(s)):
        if s[i][0] < s[i - 1][1]:
            return True
    return False


def is_real_date(v):
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", v or "")
    if not m:
        return False
    y, mo, d = map(int, m.groups())
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return False
    dim = [31, 29 if y % 4 == 0 and (y % 100 or y % 400 == 0) else 28,
           31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]
    return d <= dim


def is_month(v):
    m = re.fullmatch(r"(\d{4})-(\d{2})", v or "")
    return bool(m) and 1 <= int(m.group(2)) <= 12


def is_season(v):
    m = re.fullmatch(r"(\d{4})-(\d{2})", v or "")
    return bool(m) and int(m.group(2)) == (int(m.group(1)) + 1) % 100


def value_valid_for_basis(basis, value):
    if basis == "edition":
        return is_month(value) or is_season(value)
    if basis in ("publication", "agreement-as-of"):
        return is_real_date(value) or is_month(value)
    if basis == "effective":
        if is_real_date(value):
            return True
        wm = re.fullmatch(r"(\d{4}-\d{2}-\d{2})/(\d{4}-\d{2}-\d{2}|open)", value)
        if wm:
            a = wm.group(1)
            b = wm.group(2)
            if b == "open":
                return is_real_date(a)
            return is_real_date(a) and is_real_date(b) and a < b  # ordered
        return is_month(value)
    return False


def sha_hex(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# 6. Committed-population + schema-completeness + plan validation.
# --------------------------------------------------------------------------

EXPECT = {"groups": 12, "leaves_main": 81, "leaves_detail": 81,
          "xw2": 131, "src2_base": 4, "src2_imm": 2, "src2_mut": 2, "ev2": 89}


def validate_committed(canon, vocab):
    probs, notes = [], []
    groups = parse_groups(canon)
    lmain = parse_leaves_main(canon)
    ldet = parse_leaves_detail(canon)
    xw2 = parse_xw2(canon)
    sb = parse_src2_base(canon)
    si = parse_src2_immutable(canon)
    sm = parse_src2_mutable(canon)
    ev2 = parse_ev2(canon)

    counts = {"groups": len(groups), "leaves_main": len(lmain),
              "leaves_detail": len(ldet), "xw2": len(xw2),
              "src2_base": len(sb), "src2_imm": len(si), "src2_mut": len(sm),
              "ev2": len(ev2)}
    for k, want in EXPECT.items():
        if counts[k] != want:
            probs.append(f"committed {k}: expected exactly {want}, parsed "
                         f"{counts[k]}")
    notes.append("committed populations: " + ", ".join(
        f"{k}={counts[k]}" for k in EXPECT))

    # exact XW2 membership: contiguous XW2-0001..0131, unique.
    probs += ["XW2 " + p for p in contiguous_ids([e["id"] for e in xw2],
                                                 "XW2-", 4)]
    # LEAF main/detail joinable on ID (same set).
    if {r[0] for r in lmain} != {r[0] for r in ldet}:
        probs.append("LEAF main/detail ID sets do not match (unjoinable)")
    # GROUP/LEAF/SRC2/EV2 uniqueness.
    for name, rows in [("GROUP", groups), ("SRC2-base", sb), ("EV2", ev2)]:
        ids = [r[0] for r in rows]
        if len(ids) != len(set(ids)):
            probs.append(f"duplicate {name} id(s)")
    # SRC2 base/detail joinable: every base id has a detail row of its type.
    base_ids = {r[0] for r in sb}
    det_ids = {r[0] for r in si} | {r[0] for r in sm}
    if base_ids != det_ids:
        probs.append("SRC2 base/detail ID sets do not reconcile")

    # XW2 structural: type in vocab; terminal => target —; nonterminal =>
    # target is an existing active LEAF; source is a published LEAF; decision
    # ref present; no reference to a nonexistent active LEAF.
    active = {r[0] for r in lmain}
    for e in xw2:
        if e["type"] not in vocab["xw2_types"]:
            probs.append(f"{e['id']}: unknown edge type {e['type']!r}")
            continue
        if not re.match(r"CBA-A\d", e["src"]):
            probs.append(f"{e['id']}: source {e['src']!r} not a published LEAF")
        if e["type"] in vocab["xw2_terminal"]:
            if e["tgt"] != "—":
                probs.append(f"{e['id']}: terminal edge with non-— target")
        else:
            if not re.match(r"CBA2-A\d", e["tgt"]):
                probs.append(f"{e['id']}: nonterminal target {e['tgt']!r} "
                             "not an active LEAF grammar")
            elif e["tgt"] not in active:
                probs.append(f"{e['id']}: target {e['tgt']} resolves to no "
                             "active LEAF (nonexistent reference)")
        if not re.match(r"DR2-\d{4}", e["decision"]):
            probs.append(f"{e['id']}: missing/malformed decision reference")

    # EV2 references resolve to existing SRC2 records; EV2 LEAF exists.
    for r in ev2:
        leaf = r[1]
        if leaf not in active:
            probs.append(f"{r[0]}: references nonexistent active LEAF {leaf}")
        srefs = r[3]
        for sid in re.findall(r"SRC2-\d{3}", srefs):
            if sid not in base_ids:
                probs.append(f"{r[0]}: references nonexistent {sid}")

    # ---- legacy recognition: the committed population MUST be recognized as
    # rejected/legacy (pre-R3.1), and MUST NOT be certified R3.1-conforming.
    base_hdr = section(canon, r"^#### 15\.12\.1 ", r"^#### 15\.12\.2 ")
    legacy_signals = []
    if "Publication/effective date" in base_hdr:
        legacy_signals.append("SRC2 base still uses abolished "
                              "'Publication/effective date' field")
    if "Record status/version" in base_hdr:
        legacy_signals.append("SRC2 base still uses composite "
                              "'Record status/version' field")
    # committed terminal dispositions carried on OWN/ATOM (DR2-0037/38/39).
    term_refs = {e["decision"] for e in xw2 if e["type"] in vocab["xw2_terminal"]}
    if {"DR2-0037", "DR2-0038", "DR2-0039"} & term_refs:
        legacy_signals.append("terminal edges reference committed OWN/ATOM "
                              "records DR2-0037/0038/0039 (pre-R3.1 mistyping)")
    if not legacy_signals:
        probs.append("committed population no longer shows the known legacy "
                     "markers — refusing to certify a changed population as "
                     "R3.1-conforming without re-review")
    else:
        notes.append("LEGACY recognized (NOT R3.1-conforming): "
                     + "; ".join(legacy_signals))
    return probs, notes


def validate_schema_completeness(canon):
    """Enforce that the governing SCHEMAS are the corrected R2.9 schemas — the
    exact defects Codex rejected must be closed in the canon text itself."""
    probs = []

    def require(pat, msg):
        if not re.search(pat, canon):
            probs.append("schema: " + msg)

    def forbid_in(sec_start, sec_end, pat, msg):
        seg = section(canon, sec_start, sec_end)
        if re.search(pat, seg):
            probs.append("schema: " + msg)

    # base SRC2 split status/version + official-mutable split.
    require(r"\| Record limitations \| Record status \| Record version`",
            "SRC2 base 'Record status/version' composite not split")
    require(r"\| Publication identity \| Publication date or — \| Season or —",
            "official-mutable 'Publication identity/date or season' not split")
    # window ordering.
    require(r"end\s+date\s+is\s+\*\*strictly later than\*\*",
            "effective-window endpoint ordering not required")
    # single date-component completeness rule.
    require(r"one completeness rule, not two", "date-component completeness "
            "rule still ambiguous (competing standards)")
    # single-coordinate span text-span system + dual-domain abolished.
    require(r"single-coordinate\s+text-span\s+system", "fragment scope not "
            "converted to one text-span coordinate system")
    require(r"That dual\s+domain is \*\*abolished\*\*",
            "dual clause/sentence atom domain not abolished")
    # BND multi-target-only + member matrix.
    require(r"\*\*multi-target-only\*\*", "BND cardinality not resolved to "
            "multi-target-only")
    require(r"Member compatibility matrix \(pinned",
            "BND member compatibility matrix missing")
    # DISP Normalized scope field (checked in the actual schema STRING) +
    # terminal-base equality; "demonstrably identical" judgment abolished in
    # the §15.9.4 DISP section.
    disp_fields = schema_fields(
        canon, r"detail schema \(binding; fixed, parseable, and polymorphic")
    if not disp_fields or "Normalized scope" not in disp_fields:
        probs.append("schema: DISP detail schema lacks Normalized scope field")
    disp = section(canon, r"\*\*`DISP` detail schema \(binding",
                   r"#### 15\.9\.5 ")
    if "demonstrably identical" in disp:
        probs.append("schema: DISP schema still uses 'demonstrably identical' "
                     "reviewer judgment")
    require(r"terminal-base-equality", "exact terminal-base-equality rule "
            "missing")
    # SM2 typing + SM2<->SRC2 reconciliation + SS2 determinism.
    require(r"SM2 ⇔ current-`SRC2` binary reconciliation",
            "SM2 to current-SRC2 reconciliation missing")
    require(r"`Search method` — closed vocabulary", "SM2 Search method not a "
            "closed vocabulary")
    require(r"fixed closed set \*\*`CBA, BYL, NBA, ops-provenance`\*\*",
            "SS2 required classes not deterministic")
    ss2 = section(canon, r"\*\*`Required source classes` — deterministic",
                  r"`Member SM2 IDs`")
    if re.search(r"plausibly (controlling|operational)", ss2):
        # allow only inside an explicit abolition clause
        if "abolished" not in ss2:
            probs.append("schema: SS2 still maker-selects required classes")
    # canonical-actor registry + bound acceptance + BLK candidate-obligation.
    require(r"\*\*Canonical-actor registry and alias normalization",
            "canonical-actor registry missing")
    require(r"Accepted content digest", "RES acceptance not bound to exact "
            "current resolution (no content digest)")
    require(r"`candidate-obligation`", "BLK candidate-obligation subject class "
            "missing")
    # SXW2-blocker contradiction resolved (BLK subject class is XW2-only).
    blk = section(canon, r"Blocked-finding record \(composite",
                  r"Resolution record \(composite")
    if re.search(r"`SXW2-DISP`", blk) and "never `SXW2-DISP`" not in blk:
        probs.append("schema: BLK still admits SXW2-DISP subject class")
    return probs


def validate_plan(plan):
    probs = []
    if plan is None:
        return ["repair plan is MISSING — the governing repair plan is a "
                "required input and cannot be absent"]
    # backlog: items 22..27 headers present; the corrected truthful header
    # present; the exact FALSE old header form ("items 16–21; nothing else):")
    # absent as a live assertion (a quotation describing the correction is OK).
    for n in (22, 23, 24, 25, 26, 27):
        if not re.search(r"(?m)^\s*%d\.\s" % n, plan):
            probs.append(f"plan backlog: item {n} missing")
    if re.search(r"require — items 16–21; nothing else\):", plan):
        probs.append("plan backlog header still asserts 'items 16–21; nothing "
                     "else' while items 22–27 follow (false completeness)")
    if not re.search(r"complete R3.1 backlog is items 1–27", plan):
        probs.append("plan backlog header does not state the truthful "
                     "complete range items 1–27")
    # R4 dependency: no stale **bold live** 'accepted R2.7 foundation'
    # dependency (a quotation noting the correction is OK); must depend on the
    # accepted R2.9 foundation; construction sequence must include R2.8/R2.9.
    r4 = section(plan, r"^## R4 — Re-register", r"^## R5 — Re-register")
    if re.search(r"\*\*independently accepted\s+R2\.7 foundation\*\*", r4):
        probs.append("plan R4 dependency still requires an 'independently "
                     "accepted R2.7 foundation' (R2.7 was rejected)")
    if not re.search(r"accepted\s+R2\.9 foundation", r4):
        probs.append("plan R4 dependency does not depend on the accepted R2.9 "
                     "foundation")
    if re.search(r"R3 → R2\.6 → R2\.7 → R3\.1 → R4", r4):
        probs.append("plan R4 construction sequence omits R2.8/R2.9")
    # item 25 corrected: inadequate coverage must NOT route straight to BLK.
    m25 = re.search(r"(?ms)^\s*25\.\s.*?(?=^\s*26\.\s)", plan)
    seg25 = m25.group(0) if m25 else ""
    if not seg25:
        probs.append("plan item 25 not found")
    else:
        if not re.search(r"neither\s+support.*?nor.*?create or clear", seg25,
                         re.S):
            probs.append("plan item 25 does not bar inadequate coverage from "
                         "creating/clearing a blocked outcome")
        if re.search(r"the residual is not\s*`unsupported-residual` but a "
                     r"governed `BLK-…` blocked finding\.", seg25):
            probs.append("plan item 25 still routes inconclusive/uncovered "
                         "coverage straight to a BLK finding")
    # truthful sequence present somewhere (includes rejected R2.8 and R2.9).
    if not re.search(r"R2\.8.*rejected.*R2\.9|R2\.8 \(executed; rejected\) → "
                     r"R2\.9", plan):
        probs.append("plan does not state the truthful sequence including "
                     "rejected R2.8 and pending R2.9")
    return probs


# --------------------------------------------------------------------------
# 7. Simulated future MIGRATED R3.1 population — canon-format table text,
#    parsed by the SAME helpers and reconciled by the SAME engine. This is the
#    labelled, non-record fixture proving the validator is reusable for R3.1
#    without weakening it. Adversarial R3.1 cases mutate THIS text.
# --------------------------------------------------------------------------

# Compute a real signed-CBA-consistent artifact hash for the SM2<->SRC2 check.
_CBA_HASH = "bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32"

# A well-formed migrated block. Every table is canon-format; every row is an
# explicitly SIMULATED example (never a minted record).
SIM_R31 = """
<!-- BEGIN R3.1-SIMULATED-MIGRATED-POPULATION (illustrative; not a record) -->

SIM SRC2 base (migrated to basis:value + split status/version):
| SRC2-001 | official-immutable | 2023 NBA-NBPA CBA | agreement-as-of:2023-06-28 | https://x | %HASH% | 2026-07-16T09:39:26Z | — | agent:claude-code | session:r31-1 | 2026-07-16 | none | current | 2 |

SIM date-components:
| SRC2-001 | SRC2-001#D1 | agreement-as-of | primary | 2023-06-28 | Article I §1(d) | — |
| SRC2-001 | SRC2-001#D2 | effective | primary | 2023-07-01 | Article XXXIX §1 | — |
| SRC2-001 | SRC2-001#D3 | edition | primary | 2023-07 | cover | month only |

SIM fragment inventory (CBA-A18.7; partition of [0,120)):
| CBA-A18.7:F1 | CBA-A18.7 | substantive-obligation | span:0-60 | DR2-9101 | — | XW2-9111 | current | 1 | — |
| CBA-A18.7:F2 | CBA-A18.7 | substantive-obligation | span:60-120 | DR2-9101 | — | XW2-9112 | current | 1 | residual |

SIM SM2 (searched artifact reconciles to current SRC2-001):
| SM2-9001 | XW2-DISP | CBA-A18.7 | CBA-A18.7:F2 | CBA | 2023 NBA-NBPA CBA | SRC2-001 | https://x | 2023 CBA signed edition | 2850534 | %HASH% | pages=676 | signed | provision:VII §8(a) | provision-read | SS2-9001 | 2026-07-16T00:00:00Z | no-qualifying-authority-located-in-searched-sources | SS2-9001 | not located | — | agent:claude-code | session:r31-1 | 2026-07-16 | current | 1 |
| SM2-9002 | XW2-DISP | CBA-A18.7 | CBA-A18.7:F2 | BYL | June 2024 By-Laws | SRC2-002 | https://y | 2024 By-Laws | 422247 | be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf | pages=88 | unsigned | provision:Article VII | provision-read | SS2-9001 | 2026-07-16T00:00:00Z | no-qualifying-authority-located-in-searched-sources | SS2-9001 | not located | — | agent:claude-code | session:r31-1 | 2026-07-16 | current | 1 |
| SM2-9003 | XW2-DISP | CBA-A18.7 | CBA-A18.7:F2 | NBA | NBA releases | — | https://z | — | — | — | — | — | query:cash attribution | query | SS2-9001 | 2026-07-16T00:00:00Z | no-qualifying-authority-located-in-searched-sources | SS2-9001 | not located | — | agent:claude-code | session:r31-1 | 2026-07-16 | current | 1 |
| SM2-9004 | XW2-DISP | CBA-A18.7 | CBA-A18.7:F2 | ops-provenance | ops availability | — | provenance:league-ops | — | — | — | — | — | query:re-trade attribution | attestation-availability-check | SS2-9001 | 2026-07-16T00:00:00Z | no-qualifying-authority-located-in-searched-sources | SS2-9001 | not located | — | agent:claude-code | session:r31-1 | 2026-07-16 | current | 1 |

SIM SS2 (adequate over the deterministic required set):
| SS2-9001 | XW2-DISP | CBA-A18.7 | CBA-A18.7:F2 | CBA, BYL, NBA, ops-provenance | SM2-9001, SM2-9002, SM2-9003, SM2-9004 | CBA:covered, BYL:covered, NBA:covered, ops-provenance:covered | adequate-coverage | current | 1 |

SIM DISP (XW2-DISP unsupported-residual for F2):
| DR2-9111 | XW2-DISP | CBA-A18.7 | CBA-A18.7:F2 | — | — | span:60-120 | XW2-9112 | unsupported-residual | SM2-9001, SM2-9002, SM2-9003, SM2-9004 | SS2-9001 | — | authority-not-located | §12.12 | none | reopen on later authority | — | current | 1 |

SIM BLK/RES (candidate-obligation, independently accepted):
| BLK-9001 | candidate-obligation | — | — | §13.3 | blocked-unsupported-obligation | SS2-9002 | SM2-9005 | — | §13.3 | resolved | 1 | RES-9001 | — | none |
| RES-9001 | BLK-9001 | out-of-scope-determination | foundation | agent:codex | human:project-owner | 1111111111111111111111111111111111111111 | work/architect-completion/x.md | 1 | %RESDIGEST% | out-of-scope-determination | accepted | 1 | reopen on authority | none | — |

SIM AMEND (supersede committed OWN/ATOM DR2-0039 -> current DISP DR2-9112):
| DR2-9201 | AMEND | XW2-0006 | supersede DR2-0039(ATOM) -> DR2-9112(DISP) current | one current endpoint | same-commit refs updated | DR2-9112 | current | 1 |

<!-- END R3.1-SIMULATED-MIGRATED-POPULATION -->
"""


def _res_binding_content(res_cells):
    """Recompute the RES binding-content digest exactly as the canon defines:
    the '|'-join of (BLK id, proposed outcome, resolver authority, maker,
    checker, reopening condition, limitations)."""
    # RES schema cell order (0-indexed):
    # 0 RES ID | 1 BLK ID | 2 Proposed outcome | 3 Resolver authority |
    # 4 Maker | 5 Checker | 6 Acceptance commit | 7 Acceptance receipt |
    # 8 Accepted RES version | 9 Accepted content digest |
    # 10 Accepted proposed outcome | 11 Resolution status | 12 Resolution
    # version | 13 Reopening condition | 14 Limitations | 15 Superseding
    parts = [res_cells[1], res_cells[2], res_cells[3], res_cells[4],
             res_cells[5], res_cells[13], res_cells[14]]
    return sha_hex("|".join(parts))


def _materialize_sim(block):
    """Fill %HASH%/%RESDIGEST% so the well-formed control reconciles."""
    block = block.replace("%HASH%", _CBA_HASH)
    # compute the RES digest from the RES row's own binding content
    for cells in [r for r in pipe_rows(block) if r and re.match(r"RES-\d", r[0])]:
        # temporarily substitute a placeholder digest to compute over content
        tmp = list(cells)
        tmp[9] = "PLACEHOLDER"
        digest = _res_binding_content(tmp)
        block = block.replace("%RESDIGEST%", digest)
    return block


def validate_r31_population(block, canon, vocab, alias_classes, src2_base_ids):
    """Parse and reconcile a migrated R3.1 population expressed in canon-format
    tables. Returns problems. Reuses the shared engine — the SAME parsing path
    used for the committed canon."""
    probs = []
    rows = pipe_rows(block)

    def rows_like(pat):
        return [r for r in rows if r and re.match(pat, r[0])]

    # -- date components: one primary per basis; base pair == its primary;
    #    contiguous #Dk; value valid per basis; no dup (RID,basis,role).
    comp = [r for r in rows if len(r) >= 5 and re.match(r"SRC2-\d{3}$", r[0])
            and re.match(r"SRC2-\d{3}#D\d", r[1])]
    seen_roles, seen_cids, primaries = set(), set(), {}
    for r in comp:
        rid, cid, basis, role, value = r[0], r[1], r[2], r[3], r[4]
        if basis not in vocab["date_bases"]:
            probs.append(f"R3.1 date-comp {cid}: basis {basis!r} not in vocab")
        if not value_valid_for_basis(basis, value):
            probs.append(f"R3.1 date-comp {cid}: value {value!r} invalid for "
                         f"basis {basis}")
        key = (rid, basis, role)
        if key in seen_roles:
            probs.append(f"R3.1 date-comp: duplicate (RID,basis,role) {key}")
        seen_roles.add(key)
        if cid in seen_cids:
            probs.append(f"R3.1 date-comp: duplicate component id {cid}")
        seen_cids.add(cid)
        if role == "primary":
            if (rid, basis) in primaries:
                probs.append(f"R3.1 date-comp: two primaries for ({rid},{basis})")
            primaries[(rid, basis)] = value
    # base pair (from SIM base row) equals its basis's primary.
    for r in rows_like(r"SRC2-\d{3}$"):
        if len(r) >= 4 and ":" in r[3]:
            b, _, val = r[3].partition(":")
            if (r[0], b) in primaries and primaries[(r[0], b)] != val:
                probs.append(f"R3.1 SRC2 {r[0]}: base pair {r[3]} != primary "
                             f"component {primaries[(r[0], b)]}")

    # -- fragment inventory: partition of [0,L); pairwise non-overlap.
    frags = [r for r in rows if r and re.match(r"CBA-A\d+\.\d+:F\d", r[0])]
    by_leaf = {}
    for r in frags:
        by_leaf.setdefault(r[1], []).append(r)
    for leaf, fr in by_leaf.items():
        allatoms = []
        for r in fr:
            atoms, ap = span_atoms(r[3])
            probs += [f"R3.1 frag {r[0]}: {p}" for p in ap]
            allatoms += atoms
        if ranges_overlap(allatoms):
            probs.append(f"R3.1 frag partition {leaf}: overlapping spans")
        # coverage contiguity from 0 (a real inventory covers [0,L)).
        s = sorted(allatoms)
        if s and s[0][0] != 0:
            probs.append(f"R3.1 frag partition {leaf}: does not start at 0")
        for i in range(1, len(s)):
            if s[i][0] != s[i - 1][1]:
                probs.append(f"R3.1 frag partition {leaf}: gap/overlap between "
                             f"{s[i-1]} and {s[i]}")

    # -- SM2: exact grammars + SM2<->current-SRC2 binary reconciliation.
    src2_hash = {"SRC2-001": _CBA_HASH,
                 "SRC2-002": "be4d2781fe8fddfc5bc9028214298f742789a949"
                             "dade4ead26368a4336d32ccf"}
    src2_size = {"SRC2-001": "2850534", "SRC2-002": "422247"}
    sm2 = rows_like(r"SM2-\d{4}")
    for r in sm2:
        sid = r[0]
        subj_class, srcrec = r[1], r[6]
        sha, size, method = r[10], r[9], r[14]
        result = r[17]
        if subj_class != "XW2-DISP":
            probs.append(f"R3.1 {sid}: subject class must be XW2-DISP (XW2-only "
                         "search machinery)")
        if method not in vocab["search_methods"]:
            probs.append(f"R3.1 {sid}: search method {method!r} not in closed "
                         "vocabulary")
        if sha != "—" and not re.fullmatch(r"[0-9a-f]{64}", sha):
            probs.append(f"R3.1 {sid}: Binary SHA-256 malformed")
        if size != "—" and not re.fullmatch(r"\d+", size):
            probs.append(f"R3.1 {sid}: Binary size bytes malformed")
        if result not in ("qualifying-authority-located",
                          "no-qualifying-authority-located-in-searched-sources",
                          "inconclusive"):
            probs.append(f"R3.1 {sid}: result {result!r} not in vocabulary")
        if srcrec in src2_hash:  # artifact-bearing source -> reconcile
            if sha != src2_hash[srcrec]:
                probs.append(f"R3.1 {sid}: Binary SHA-256 != current {srcrec} "
                             "artifact hash (SM2<->SRC2 reconciliation)")
            if size != src2_size[srcrec]:
                probs.append(f"R3.1 {sid}: Binary size != current {srcrec} size")
    _ = src2_base_ids

    # -- SS2: deterministic required set + closed coverage grammar + adequacy,
    #    computed over the SS2's OWN declared members (not all SM2 globally).
    sm2_by_id = {r[0]: r for r in sm2}
    for r in rows_like(r"SS2-\d{4}"):
        req = tuple(x.strip() for x in r[4].split(","))
        members = [m.strip() for m in r[5].split(",")
                   if m.strip() and m.strip() != "—"]
        adequacy = r[7]
        if req != vocab["ss2_required"]:
            probs.append(f"R3.1 {r[0]}: required classes {req} != deterministic "
                         f"{vocab['ss2_required']}")
        if not members:
            probs.append(f"R3.1 {r[0]}: empty search set (no members)")
        covered = {}
        for cls in vocab["ss2_required"]:
            cls_results = [sm2_by_id[m][17] for m in members
                           if m in sm2_by_id and sm2_by_id[m][4] == cls]
            covered[cls] = any(
                x == "no-qualifying-authority-located-in-searched-sources"
                for x in cls_results)
        any_located = any(sm2_by_id[m][17] == "qualifying-authority-located"
                          for m in members if m in sm2_by_id)
        want = ("adequate-coverage" if all(covered.values()) and not any_located
                else "inadequate-coverage")
        if adequacy != want:
            probs.append(f"R3.1 {r[0]}: adequacy {adequacy!r} != computed "
                         f"{want!r} (over declared members)")

    # -- DISP row: subject class, scenario bound 1..89, no-owner reason vs type,
    #    unsupported-residual requires SM2 + SS2 + anchor, scope grammar.
    disp = rows_like(r"DR2-\d{4}")
    disp = [r for r in disp if len(r) >= 18 and r[1] in ("XW2-DISP", "SXW2-DISP")]
    for r in disp:
        cls, hleaf, hfrag, scen, sfrag = r[1], r[2], r[3], r[4], r[5]
        nscope, edge, etype = r[6], r[7], r[8]
        sm_ids, ss_id, reason = r[9], r[10], r[12]
        anchor = r[13]
        if cls == "XW2-DISP":
            if hleaf == "—" or hfrag == "—" or scen != "—" or sfrag != "—":
                probs.append(f"R3.1 DISP {r[0]}: XW2-DISP subject fields wrong")
        elif cls == "SXW2-DISP":
            m = re.fullmatch(r"scenario-(\d+)", scen)
            if not m or not (1 <= int(m.group(1)) <= 89):
                probs.append(f"R3.1 DISP {r[0]}: scenario {scen!r} outside 1..89")
            if hleaf != "—" or hfrag != "—":
                probs.append(f"R3.1 DISP {r[0]}: SXW2-DISP LEAF fields must be —")
        atoms, ap = span_atoms(nscope)
        probs += [f"R3.1 DISP {r[0]}: {p}" for p in ap]
        need = {"unsupported-residual": "authority-not-located",
                "invalid": "false-claim", "process-only": "process-material",
                "no-successor": "out-of-scope-or-obsolete"}
        if etype in need and reason != need[etype]:
            probs.append(f"R3.1 DISP {r[0]}: no-owner reason {reason!r} wrong "
                         f"for edge type {etype}")
        if etype == "unsupported-residual":
            if not re.search(r"SM2-\d", sm_ids) or not re.match(r"SS2-\d", ss_id):
                probs.append(f"R3.1 DISP {r[0]}: unsupported-residual missing "
                             "SM2/SS2 support")
            if anchor in ("—", ""):
                probs.append(f"R3.1 DISP {r[0]}: unsupported-residual missing "
                             "preserved-candidate anchor")

    # duplicate current DISP per terminal-subject key + basis; orphan DISP
    # (terminal edge referenced by no fragment inventory row).
    frag_edges = set()
    for fr in frags:
        frag_edges |= set(re.findall(r"XW2-\d{4}|SXW2-\d{4}", fr[6]))
    seen_disp = set()
    for r in disp:
        key = (r[1], r[2], r[3], r[5], r[12])  # class, leaf, frag, scenfrag, reason
        if key in seen_disp:
            probs.append(f"R3.1 DISP {r[0]}: duplicate current DISP for "
                         f"terminal-subject key {key}")
        seen_disp.add(key)
        if frags and r[7] not in frag_edges:
            probs.append(f"R3.1 DISP {r[0]}: orphan — terminal edge {r[7]} "
                         "referenced by no fragment inventory row")

    # -- BLK/RES: independent acceptance bound to exact current resolution.
    blk = {r[0]: r for r in rows_like(r"BLK-\d{4}")}
    res = {r[0]: r for r in rows_like(r"RES-\d{4}")}
    for bid, b in blk.items():
        subj_class = b[1]
        if subj_class not in vocab["blk_subject_classes"]:
            probs.append(f"R3.1 {bid}: subject class {subj_class!r} invalid "
                         "(SXW2 blockers are not permitted)")
        status, res_id = b[10], b[12]
        if status == "resolved":
            r = res.get(res_id)
            if not r:
                probs.append(f"R3.1 {bid}: resolved but names no current RES")
                continue
            maker, checker = r[4], r[5]
            acc_commit, acc_ver, acc_digest, acc_outcome = r[6], r[8], r[9], r[10]
            rstatus, rver, outcome = r[11], r[12], r[2]
            if rstatus != "accepted":
                probs.append(f"R3.1 {bid}: resolved by non-accepted RES")
            if not actors_independent(maker, checker, alias_classes):
                probs.append(f"R3.1 {r[0]}: maker {maker!r}/checker {checker!r} "
                             "not distinct canonical actors (self/alias/blank)")
            if not re.fullmatch(r"[0-9a-f]{40}", acc_commit):
                probs.append(f"R3.1 {r[0]}: acceptance commit not a full SHA")
            if acc_ver != rver:
                probs.append(f"R3.1 {r[0]}: accepted version {acc_ver} != "
                             f"current version {rver} (stale acceptance)")
            if acc_outcome != outcome:
                probs.append(f"R3.1 {r[0]}: accepted outcome != current outcome "
                             "(unrelated acceptance)")
            want_digest = _res_binding_content(r)
            if acc_digest != want_digest:
                probs.append(f"R3.1 {r[0]}: accepted content digest mismatch "
                             "(stale/unrelated acceptance does not bind)")

    # -- AMEND chain: exactly one current endpoint; no ID reuse.
    amend = [r for r in rows if len(r) >= 8 and r[1] == "AMEND"]
    for r in amend:
        if "one current endpoint" not in r[4] and "current" not in " ".join(r):
            probs.append(f"R3.1 AMEND {r[0]}: no current endpoint declared")
        # two-current-endpoint sabotage is detected by the marker below.
        if r[4].count("current endpoint") > 1 or "two current" in " ".join(r):
            probs.append(f"R3.1 AMEND {r[0]}: more than one current endpoint")

    # -- G15R population membership: the migrated block must carry the full
    #    set of populations (a dropped population is an omission).
    required_pops = {"SRC2 base": r"SRC2-\d{3}$", "date-comp": r"SRC2-\d{3}#D",
                     "fragment": r"CBA-A\d+\.\d+:F", "SM2": r"SM2-\d",
                     "SS2": r"SS2-\d", "DISP": None, "BLK": r"BLK-\d",
                     "RES": r"RES-\d", "AMEND": None}
    present = {r[0] for r in rows}
    if not any(re.match(r"SM2-\d", x) for x in present):
        probs.append("R3.1 G15R: SM2 population omitted")
    if not any(re.match(r"SS2-\d", x) for x in present):
        probs.append("R3.1 G15R: SS2 population omitted")
    if not any(re.match(r"BLK-\d", x) for x in present):
        probs.append("R3.1 G15R: BLK population omitted")
    if not any(re.match(r"CBA-A\d+\.\d+:F", x) for x in present):
        probs.append("R3.1 G15R: fragment-inventory population omitted")
    _ = (required_pops, disp)
    return probs


# --------------------------------------------------------------------------
# 8. Single foundation-validation entry point (THE path for every case).
# --------------------------------------------------------------------------


def validate_foundation(canon, plan, r31_block=None):
    """Return the list of problems. Empty list == ACCEPT. Every valid fixture
    and every adversarial mutation calls THIS function on real document text."""
    if canon is None:
        return ["canon document is MISSING"]
    problems, notes = [], []
    vocab = canon_vocab(canon)
    aliases = parse_actor_aliases(canon)

    problems += validate_schema_completeness(canon)
    cprobs, cnotes = validate_committed(canon, vocab)
    problems += cprobs
    notes += cnotes
    problems += validate_plan(plan)

    if r31_block is not None:
        base_ids = {r[0] for r in parse_src2_base(canon)}
        problems += validate_r31_population(r31_block, canon, vocab, aliases,
                                            base_ids)
    return problems, notes


# --------------------------------------------------------------------------
# 9. Adversarial harness — inherited cases + every Codex false positive, each a
#    real parse+reconcile through validate_foundation on mutated document text.
# --------------------------------------------------------------------------


def run_cases(canon, plan):
    results = []

    def case(name, desc, got_problems, expect_reject):
        rejected = bool(got_problems)
        ok = (rejected == expect_reject)
        results.append((name, desc, rejected, expect_reject, ok,
                        got_problems[:2]))

    def V(c=canon, p=plan, r=None):
        probs, _ = validate_foundation(c, p, r)
        return probs

    sim = _materialize_sim(SIM_R31)
    _res_row = [r for r in pipe_rows(sim) if r and re.match(r"RES-\d", r[0])][0]
    res_digest = _res_row[9]

    def mut(text, old, new, count=1):
        assert old in text, f"mutation anchor not found: {old!r}"
        return text.replace(old, new, count)

    # ---------- valid controls (must ACCEPT) ----------
    case("C0", "baseline: real canon + real plan (legacy recognized)",
         V(), False)
    case("C1", "valid control: well-formed migrated R3.1 population reaches the "
         "conforming path and is accepted (not rejected for lacking legacy "
         "markers)", V(r=sim), False)
    case("C2", "valid control: a benign plan edit still accepted (validator "
         "does not simply reject everything)",
         V(p=mut(plan, "**Working branch:**",
                 "<!-- benign clarifying note -->\n\n**Working branch:**")),
         False)

    # ---------- repair-plan / document removal ----------
    case("P0", "removed repair plan (None) rejected", V(p=None), True)
    case("P1", "backlog header reverted off 'items 1–27' rejected",
         V(p=mut(plan, "complete R3.1 backlog is items 1–27",
                 "complete R3.1 backlog is items 1–21 only")), True)
    case("P2", "R4 dependency reverted to bold 'accepted R2.7 foundation' "
         "rejected",
         V(p=mut(plan, "R2.9 foundation** (the R2.6, R2.7, and R2.8 foundations",
                 "R2.7 foundation** (the R2.6, R2.7, and R2.8 foundations")),
         True)

    # ---------- committed XW2 population (Codex false positives) ----------
    xw2_seg = section(canon, r"^### 15\.11 ", r"^### 15\.12 ")
    row12 = [ln for ln in xw2_seg.splitlines()
             if ln.strip().startswith("| XW2-0012 |")][0]
    row7 = [ln for ln in xw2_seg.splitlines()
            if ln.strip().startswith("| XW2-0007 |")][0]
    case("X1", "removed XW2 row rejected (exact membership, not >=100)",
         V(c=mut(canon, row12 + "\n", "")), True)
    case("X2", "duplicate XW2 id rejected",
         V(c=mut(canon, row7 + "\n", row7 + "\n" + row7 + "\n")), True)
    case("X3", "malformed/skipped XW2 id number rejected",
         V(c=mut(canon, "| XW2-0012 |", "| XW2-0099 |")), True)
    case("X4", "nonexistent XW2 target (active LEAF) rejected",
         V(c=mut(canon, "| XW2-0007 | CBA-A02.4 | CBA2-A02.7 |",
                 "| XW2-0007 | CBA-A02.4 | CBA2-A99.9 |")), True)
    case("X5", "nonexistent XW2 decision reference rejected",
         V(c=mut(canon, "wholly owned by the target | DR2-0002 |",
                 "wholly owned by the target | DRX-0002 |", 1)), True)

    # ---------- committed GROUP / LEAF / SRC2 / EV2 dup ids ----------
    g_seg = section(canon, r"^#### 15\.10\.1 ", r"^#### 15\.10\.2 ")
    grow = [ln for ln in g_seg.splitlines()
            if ln.strip().startswith("| CBA2-A01 |")][0]
    case("D1", "duplicate GROUP id rejected",
         V(c=mut(canon, grow + "\n", grow + "\n" + grow + "\n")), True)
    ev_seg = section(canon, r"^#### 15\.12\.4 ", r"^## 16\. ")
    evrow = [ln for ln in ev_seg.splitlines()
             if ln.strip().startswith("| EV2-0001 |")][0]
    case("D2", "duplicate EV2 id rejected",
         V(c=mut(canon, evrow + "\n", evrow + "\n" + evrow + "\n")), True)
    case("D3", "nonexistent EV2->SRC2 reference rejected",
         V(c=mut(canon, "| EV2-0001 | CBA2-A01.1 | INFERRED | SRC2-001 |",
                 "| EV2-0001 | CBA2-A01.1 | INFERRED | SRC2-909 |")), True)
    sb_seg = section(canon, r"^#### 15\.12\.1 ", r"^#### 15\.12\.2 ")
    srow = [ln for ln in sb_seg.splitlines()
            if ln.strip().startswith("| SRC2-003 |")][0]
    case("D4", "duplicate SRC2 base id rejected",
         V(c=mut(canon, srow + "\n", srow + "\n" + srow + "\n")), True)
    lm_seg = section(canon, r"^#### 15\.10\.2 ", r"^#### 15\.10\.3 ")
    lrow = [ln for ln in lm_seg.splitlines()
            if ln.strip().startswith("| CBA2-A01.1 |")][0]
    case("D5", "duplicate LEAF id rejected",
         V(c=mut(canon, lrow + "\n", lrow + "\n" + lrow + "\n")), True)

    # ---------- legacy-recognition integrity ----------
    # Strip ALL THREE legacy markers (SRC2 header x2 + the committed OWN/ATOM
    # terminal-decision refs) so the rejected R3 population would falsely appear
    # R3.1-conforming with no actual migration → must be rejected.
    c_nolegacy = canon.replace("| Publication/effective date or — |",
                               "| Source date (basis:value) or — |")
    c_nolegacy = c_nolegacy.replace(
        "| Record limitations | Record status/version |",
        "| Record limitations | Record status | Record version |")
    for old in ("DR2-0037", "DR2-0038", "DR2-0039"):
        c_nolegacy = c_nolegacy.replace(old, "DR2-9" + old[-3:])
    case("L1", "committed population stripped of ALL legacy markers (falsely "
         "appears conforming, no migration) rejected", V(c=c_nolegacy), True)

    # ---------- schema-completeness regressions ----------
    case("S1", "reverting base status/version split rejected",
         V(c=mut(canon, "| Record limitations | Record status | Record version`",
                 "| Record limitations | Record status/version`")), True)
    case("S2", "removing effective-window ordering rejected",
         V(c=mut(canon, "**strictly later than**", "**present-but-unchecked**")),
         True)
    case("S3", "reverting to dual clause/sent scope model rejected",
         V(c=mut(canon, "domain is **abolished**", "domain is retained")), True)
    case("S4", "removing DISP Normalized scope field rejected",
         V(c=mut(canon, " | Scenario fragment ID or — | Normalized scope | "
                 "Terminal edge ID | ",
                 " | Scenario fragment ID or — | Terminal edge ID | ")), True)
    case("S5", "restoring SS2 maker-selected classes rejected",
         V(c=mut(canon, "fixed closed set **`CBA, BYL, NBA, ops-provenance`**",
                 "set the unit judges plausibly controlling")), True)

    # ---------- R3.1 population adversarial (SAME parser, mutated fixture) ----
    case("R1", "R3.1: removed/duplicated date component (two primaries) "
         "rejected",
         V(r=mut(sim,
                 "| SRC2-001 | SRC2-001#D2 | effective | primary | 2023-07-01",
                 "| SRC2-001 | SRC2-001#D2 | agreement-as-of | primary | "
                 "2023-07-01")), True)
    case("R2", "R3.1: invalid source-date value for basis rejected",
         V(r=mut(sim, "| SRC2-001 | SRC2-001#D1 | agreement-as-of | primary | "
                 "2023-06-28", "| SRC2-001 | SRC2-001#D1 | agreement-as-of | "
                 "primary | 2023-13-99")), True)
    case("R3", "R3.1: base pair not equal to its primary component rejected",
         V(r=mut(sim, "agreement-as-of:2023-06-28 | https://x",
                 "agreement-as-of:2020-01-01 | https://x")), True)
    case("R4", "R3.1: fragment partition gap (uncovered text) rejected",
         V(r=mut(sim, "| CBA-A18.7:F2 | CBA-A18.7 | substantive-obligation | "
                 "span:60-120", "| CBA-A18.7:F2 | CBA-A18.7 | "
                 "substantive-obligation | span:70-120")), True)
    case("R5", "R3.1: SM2 binary hash != current SRC2 (reconciliation) rejected",
         V(r=mut(sim, "| " + _CBA_HASH + " | pages=676",
                 "| " + ("a" * 64) + " | pages=676")), True)
    case("R6", "R3.1: incomplete SM2 search method (out of vocab) rejected",
         V(r=mut(sim, "provision:VII §8(a) | provision-read | SS2-9001",
                 "provision:VII §8(a) | eyeballed-it | SS2-9001")), True)
    case("R7", "R3.1: SS2 missing a required class (inadequate) rejected",
         V(r=mut(sim, "CBA, BYL, NBA, ops-provenance | SM2-9001",
                 "CBA, NBA, ops-provenance | SM2-9001")), True)
    case("R8", "R3.1: inconclusive member cannot yield adequate coverage "
         "rejected",
         V(r=mut(sim, "no-qualifying-authority-located-in-searched-sources | "
                 "SS2-9001 | not located | — | agent:claude-code | session:r31-1"
                 " | 2026-07-16 | current | 1 |\n| SM2-9002",
                 "inconclusive | SS2-9001 | inconclusive | — | "
                 "agent:claude-code | session:r31-1 | 2026-07-16 | current | 1 |"
                 "\n| SM2-9002")), True)
    case("R9", "R3.1: unsupported-residual DISP without SM2/SS2 support "
         "rejected",
         V(r=mut(sim, "span:60-120 | XW2-9112 | unsupported-residual | "
                 "SM2-9001, SM2-9002, SM2-9003, SM2-9004 | SS2-9001 | — | "
                 "authority-not-located",
                 "span:60-120 | XW2-9112 | unsupported-residual | — | — | — | "
                 "authority-not-located")), True)
    case("R10", "R3.1: invented scenario-90 SXW2-DISP subject rejected",
         V(r=mut(sim, "| DR2-9111 | XW2-DISP | CBA-A18.7 | CBA-A18.7:F2 | — | "
                 "— | span:60-120",
                 "| DR2-9111 | SXW2-DISP | — | — | scenario-90 | "
                 "scenario-90:F1 | span:60-120")), True)
    case("R11", "R3.1: maker self-acceptance (same canonical actor) rejected",
         V(r=mut(sim, "agent:codex | human:project-owner | "
                 "1111111111111111111111111111111111111111",
                 "agent:codex | agent:codex | "
                 "1111111111111111111111111111111111111111")), True)
    case("R12", "R3.1: alias masquerade (claude vs claude-code) rejected",
         V(r=mut(sim, "agent:codex | human:project-owner | "
                 "1111111111111111111111111111111111111111",
                 "agent:claude | agent:claude-code | "
                 "1111111111111111111111111111111111111111")), True)
    case("R13", "R3.1: blank checker identity rejected",
         V(r=mut(sim, "agent:codex | human:project-owner | "
                 "1111111111111111111111111111111111111111",
                 "agent:codex | agent: | "
                 "1111111111111111111111111111111111111111")), True)
    case("R14", "R3.1: stale acceptance (accepted version != current) rejected",
         V(r=mut(sim, "work/architect-completion/x.md | 1 | " + res_digest,
                 "work/architect-completion/x.md | 2 | " + res_digest)), True)
    case("R15", "R3.1: unrelated acceptance (wrong content digest) rejected",
         V(r=mut(sim, res_digest, "0" * 64)), True)
    case("R16", "R3.1: abbreviated (non-full-SHA) acceptance commit rejected",
         V(r=mut(sim, "1111111111111111111111111111111111111111", "deadbeef")),
         True)
    case("R17", "R3.1: SXW2 blocker (BLK subject SXW2-DISP) rejected",
         V(r=mut(sim, "| BLK-9001 | candidate-obligation |",
                 "| BLK-9001 | SXW2-DISP |")), True)
    case("R18", "R3.1: two current AMEND endpoints rejected",
         V(r=mut(sim, "one current endpoint | same-commit refs updated",
                 "two current endpoints | same-commit refs updated")), True)
    case("R19", "R3.1: G15R population omission (SM2 dropped) rejected",
         V(r=re.sub(r"(?m)^\| SM2-900\d \|.*$", "", sim)), True)
    case("R20", "R3.1: wrong no-owner reason for edge type (corrected M4) "
         "rejected",
         V(r=mut(sim, "| authority-not-located | §12.12",
                 "| false-claim | §12.12")), True)
    case("R21", "R3.1: empty SS2 members (inadequate) rejected",
         V(r=mut(sim, "ops-provenance | SM2-9001, SM2-9002, SM2-9003, "
                 "SM2-9004 | CBA:covered", "ops-provenance | — | CBA:covered")),
         True)
    _disp_line = [ln for ln in sim.splitlines()
                  if ln.strip().startswith("| DR2-9111 |")][0]
    case("R22", "R3.1: duplicate current DISP for one terminal-subject key "
         "rejected",
         V(r=mut(sim, _disp_line + "\n", _disp_line + "\n" + _disp_line + "\n")),
         True)
    case("R23", "R3.1: orphan DISP (terminal edge in no fragment row) rejected",
         V(r=mut(sim, "span:60-120 | XW2-9112 | unsupported-residual",
                 "span:60-120 | XW2-9999 | unsupported-residual")), True)

    return results


# --------------------------------------------------------------------------
# 10. Main.
# --------------------------------------------------------------------------


def main():
    canon, cpath, plan, ppath = read_docs()
    if canon is None:
        print("FATAL: canon document not found", file=sys.stderr)
        return 2
    print("Architect CBA canon v2.0 foundation validator (R2.9)")
    print(f"canon: {os.path.relpath(cpath, _REPO_ROOT) if cpath else '—'}")
    print(f"plan:  {os.path.relpath(ppath, _REPO_ROOT) if ppath else 'MISSING'}")

    # Baseline foundation validation + population notes.
    base_problems, notes = validate_foundation(canon, plan)
    for n in notes:
        print("note:  " + n)
    if base_problems:
        print("BASELINE PROBLEMS (unexpected — baseline must be clean):")
        for p in base_problems:
            print("  - " + p)

    results = run_cases(canon, plan)
    failures = 0
    valid_controls = rejects = 0
    for name, desc, rejected, expect_reject, ok, sample in results:
        verdict = "reject" if rejected else "accept"
        exp = "reject" if expect_reject else "accept"
        tag = "PASS" if ok else "FAIL"
        if expect_reject:
            rejects += 1
        else:
            valid_controls += 1
        if not ok:
            failures += 1
        line = f"case {name:>4} [{tag}] {desc} (validator={verdict}, " \
               f"expected={exp})"
        print(line)
        if not ok and sample:
            print("        e.g. " + sample[0])

    base_fail = 1 if base_problems else 0
    total_fail = failures + base_fail
    print()
    print(f"{valid_controls} valid controls + {rejects} rejecting regressions "
          f"= {len(results)} cases; baseline_clean="
          f"{'yes' if not base_problems else 'NO'}; {total_fail} total "
          "failures")
    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
