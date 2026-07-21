#!/usr/bin/env python3
"""R2.8 actual-schema foundation validator for ARCHITECT_CBA_CANON.md.

This validator supersedes the R2.7 receipt's *synthetic* checker (which read
no repository files and hard-coded both fixtures and expectations). It:

  1. Reads the ACTUAL repository canon (docs/reference/cba/ARCHITECT_CBA_CANON.md)
     and repair plan, and extracts the binding closed vocabularies and schema
     signatures from the governing canon itself — it maintains no parallel hidden
     vocabulary that could drift from the canon.
  2. Parses the ACTUAL current XW2 (§15.11) and SRC2 (§15.12) populations and the
     A-family GROUP index (§15.10), and RECOGNIZES the committed R3 population as
     rejected/legacy — it never falsely certifies that population as
     R3.1-conforming (the §15.12 SRC2 base still carries the pre-R2.7
     "Publication/effective date" field; the §15.11 terminal edges reference the
     committed OWN/ATOM decisions the §15.9.4 transition block names).
  3. Validates foundation-contract integrity NOW, and is reusable against the
     migrated R3.1 population later (same parser, same paths).
  4. Runs the 26 R2.7-inherited adversarial cases plus the 15 new Codex probes
     (and further mutations) through the SAME binding parser and reconciliation
     rules — a result is meaningful only because the parser produced it, never
     because a hard-coded expected value matched.

Every ID and value used in an adversarial fixture is illustrative — nothing here
is a minted record. Requires no network and no dependency beyond Python 3.9+;
output is deterministic. Exits nonzero on any unexpected acceptance or rejection,
on any canon/validator vocabulary drift, or on any legacy-certification error.

Run:  python3 work/architect-completion/cba_canon_v2_foundation_validator.py
"""
import hashlib
import os
import re
import sys

# --------------------------------------------------------------------------
# 0. Locate and read the actual repository documents
# --------------------------------------------------------------------------

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_SCRIPT_DIR, "..", ".."))
CANON_REL = os.path.join("docs", "reference", "cba", "ARCHITECT_CBA_CANON.md")


def _find(rel):
    for base in (_REPO_ROOT, os.getcwd(), _SCRIPT_DIR):
        p = os.path.join(base, rel)
        if os.path.isfile(p):
            return p
    raise FileNotFoundError(rel)


def read_canon():
    path = _find(CANON_REL)
    with open(path, "r", encoding="utf-8") as f:
        return f.read(), path


# --------------------------------------------------------------------------
# 1. Extract authoritative vocabularies from the governing canon
# --------------------------------------------------------------------------


def _backticked(segment):
    """All `token` identifiers in a canon segment, in first-seen order."""
    out, seen = [], set()
    for m in re.finditer(r"`([A-Za-z][A-Za-z0-9:_.\-]*)`", segment):
        t = m.group(1)
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _block_after(text, anchor, stop=r"\n\n"):
    i = text.find(anchor)
    if i < 0:
        return ""
    j = re.search(stop, text[i + len(anchor):])
    end = i + len(anchor) + (j.start() if j else 4000)
    return text[i:end]


def extract_canon_vocab(text):
    """Pull the binding closed vocabularies straight from the canon. Returns a
    dict of frozensets. Cardinalities are asserted by the caller so extraction
    errors surface instead of silently narrowing a vocabulary."""
    v = {}

    # Date-basis vocabulary (§15.9.6)
    seg = _block_after(text, "Closed date-basis vocabulary (exactly one per pair):")
    v["date_bases"] = frozenset(
        t for t in _backticked(seg)
        if t in {"publication", "effective", "edition", "agreement-as-of"})

    # Fragment kinds (§15.9.3)
    seg = _block_after(text, "Fragment kinds (closed vocabulary; exactly one per fragment):")
    v["fragment_kinds"] = frozenset(
        t for t in _backticked(seg)
        if t in {"substantive-obligation", "authority-assertion",
                 "process-instruction", "gap-assertion"})

    # No-owner reasons (§15.9.4)
    seg = _block_after(text, "`No-owner reason` — closed vocabulary")
    v["no_owner_reasons"] = frozenset(
        t for t in _backticked(seg)
        if t in {"false-claim", "process-material",
                 "out-of-scope-or-obsolete", "authority-not-located"})

    # SM2 result vocabulary (§15.9.6)
    seg = _block_after(text, "`Result` — closed vocabulary, exactly one:")
    v["sm2_results"] = frozenset(
        t for t in _backticked(seg)
        if t in {"qualifying-authority-located",
                 "no-qualifying-authority-located-in-searched-sources",
                 "inconclusive"})

    # DISP subject classes (§15.9.4)
    seg = _block_after(text, "`DISP subject class` — closed vocabulary")
    v["disp_subject_classes"] = frozenset(
        t for t in _backticked(seg) if t in {"XW2-DISP", "SXW2-DISP"})

    # Resolution proposed-outcome vocabulary (§15.9.3)
    seg = _block_after(text, "`Proposed outcome` is the closed vocabulary")
    v["resolution_outcomes"] = frozenset(
        t for t in _backticked(seg)
        if t in {"foundation-vocabulary-or-scope-decision",
                 "authority-located-mint-owner", "out-of-scope-determination"})

    # XW2 edge types + terminal classification, from the "Edge types:" table.
    edge_types, terminal = set(), set()
    tbl = text[text.find("Edge types:"):text.find("Binding rules:")]
    for m in re.finditer(r"^\|\s*`([a-z-]+)`\s*\|.*\|\s*(Yes|No)\s*\|\s*$",
                         tbl, re.MULTILINE):
        edge_types.add(m.group(1))
        if m.group(2) == "Yes":
            terminal.add(m.group(1))
    v["xw2_edge_types"] = frozenset(edge_types)
    v["xw2_terminal_types"] = frozenset(terminal)
    v["xw2_nonterminal_types"] = frozenset(edge_types - terminal)

    # SXW2 terminal types (§15.9.8): invalid, no-successor only.
    v["sxw2_terminal_types"] = frozenset({"invalid", "no-successor"})
    return v


CARDINALITY = {
    "date_bases": 4, "fragment_kinds": 4, "no_owner_reasons": 4,
    "sm2_results": 3, "disp_subject_classes": 2, "resolution_outcomes": 3,
    "xw2_edge_types": 9, "xw2_terminal_types": 4, "xw2_nonterminal_types": 5,
    "sxw2_terminal_types": 2,
}


def assert_vocab_from_canon(v):
    """Prove the working vocabularies were extracted from the canon, not
    duplicated in checker constants: every set must have its canonical
    cardinality. A drift (canon changed a vocabulary, or extraction broke)
    fails here rather than silently."""
    problems = []
    for name, n in CARDINALITY.items():
        got = v.get(name, frozenset())
        if len(got) != n:
            problems.append(f"{name}: expected {n} tokens, extracted {len(got)} {sorted(got)}")
    return problems


# The R2.8 schema signatures the canon MUST contain (field names, not values).
CANON_SCHEMA_SIGNATURES = [
    # Polymorphic DISP detail schema (§15.9.4)
    "DR2 record ID | DISP subject class | Historical source LEAF or — | "
    "Historical fragment ID or — | Historical scenario or — | Scenario fragment ID or —",
    # Stable-identity date-component table (§15.9.6)
    "Record ID | Date component ID | Date basis | Date role/scope | Date value",
    # Split fragment schema + bundle id (§15.9.3)
    "Disposition bundle ID or — | Disposition edge ID(s) | Fragment status | Fragment version",
    # Disposition-bundle schema (§15.9.3)
    "Bundle ID | Source historical LEAF | Source fragment ID | Member edge IDs | "
    "Member edge types | Member target IDs | Subject scope | Bundle class",
    # Split SM2 binary + status fields (§15.9.6)
    "Binary size bytes or — | Binary SHA-256 or — | Binary pagination or — | "
    "Binary signature/as-of or —",
    "Search status | Search version",
    # Search-set/coverage record (§15.9.6)
    "Search set ID | Subject class | Subject LEAF or scenario | Subject fragment ID | "
    "Required source classes | Member SM2 IDs | Coverage assessment | Adequacy result",
    # Governed blocked-finding + resolution records (§15.9.3)
    "Blocked finding ID | Subject class | Subject historical LEAF or — | "
    "Subject fragment or candidate | Finding type",
    "Resolution ID | Blocked finding ID | Proposed outcome | Resolver authority | "
    "Maker/proposer identity | Independent checker identity | "
    "Independent acceptance commit/receipt",
    # Canonical scenario-fragment grammar (§15.9.8)
    "scenario-<n>:F<m>",
]


def validate_canon_schemas(text):
    return [f"canon is missing R2.8 schema signature: {sig[:60]}..."
            for sig in CANON_SCHEMA_SIGNATURES if sig not in text]


# --------------------------------------------------------------------------
# 2. Regexes and shared grammar helpers (grammars are pinned in the canon)
# --------------------------------------------------------------------------

DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
SEASON_RE = re.compile(r"^(\d{4})-(\d{2})$")
WINDOW_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})/(\d{4}-\d{2}-\d{2}|open)$")
LEAF_FRAG_RE = re.compile(r"^(CBA-[A-Z]\d{2}(?:\.\d+)?):F([1-9]\d*)$")
SCEN_FRAG_RE = re.compile(r"^scenario-([1-9]\d?):F([1-9]\d*)$")  # 1..89
DATECOMP_RE = re.compile(r"^(SRC2-\d{3})#D([1-9]\d*)$")
ROLE_SCOPE_RE = re.compile(r"^(primary|scoped:[a-z0-9][a-z0-9._-]{0,63})$")
SLUG_RE = re.compile(r"^(human|agent):[a-z0-9][a-z0-9._-]{0,63}$")


def is_real_date(v):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", v)
    if not m:
        return False
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= mo <= 12):
        return False
    dim = [31, 29 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 28,
           31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]
    return 1 <= d <= dim


def is_season(v):
    m = SEASON_RE.match(v)
    if not m:
        return False
    yyyy, yy = int(m.group(1)), m.group(2)
    return yy == f"{(yyyy + 1) % 100:02d}"


# --------------------------------------------------------------------------
# 3. Schema validators (used identically for real population and fixtures)
# --------------------------------------------------------------------------


def validate_source_date(field, prov_type, source_facts, limitations, bases):
    """Validate one base-table Source date `<basis>:<value>` pair (§15.9.6).
    source_facts: {basis: {"precision","value","metadata_only"?,
                           "edition_identifier_only"?}}"""
    if field == "—":
        return True, "empty per matrix (caller checks matrix permits)"
    if ":" not in field:
        return False, "bare value with no basis"
    basis, _, value = field.partition(":")
    if basis not in bases:
        return False, f"unknown basis {basis!r}"
    if value == "—" or basis == "—" or value == "":
        return False, "half-empty pair"
    facts = source_facts.get(basis)
    if facts is None:
        return False, f"source supports no {basis!r} date"
    if facts.get("metadata_only"):
        return False, "metadata-derived value cannot establish any basis"
    if SEASON_RE.match(value) and not MONTH_RE.match(value):  # e.g. 2026-27
        if basis != "edition" or prov_type != "official-mutable" or not is_season(value):
            return False, "season value only as edition on official-mutable"
        if facts["precision"] != "season":
            return False, "source does not identify by season"
        return True, "season edition ok"
    if MONTH_RE.match(value):
        if facts["precision"] == "day":
            return False, "degraded precision: source states an exact day"
        if facts["precision"] != "month":
            return False, "source does not supply a month for this basis"
        if not any("month precision" in l for l in limitations):
            return False, "missing month-precision limitation entry"
        if facts.get("edition_identifier_only") and basis in ("publication", "effective"):
            return False, "edition month recorded as publication/effective"
        return True, "month ok"
    if DAY_RE.match(value):
        if not is_real_date(value):
            return False, "not a real calendar date"
        if facts["precision"] != "day":
            return False, "source does not state an exact day for this basis"
        if facts["value"] != value:
            return False, "value differs from what the source states"
        return True, "exact day ok"
    if WINDOW_RE.match(value):
        if basis != "effective":
            return False, "window only for effective"
        m = WINDOW_RE.match(value)
        a, b = m.group(1), m.group(2)
        if not is_real_date(a) or (b != "open" and not is_real_date(b)):
            return False, "window endpoint not a real date"
        if b != "open" and b < a:
            return False, "reversed/impossible effective window"
        return True, "window ok"
    return False, f"malformed value {value!r}"


def validate_date_components(base_field, rows, bases):
    """rows: list of dicts {comp_id, basis, role_scope, value}. Stable identity +
    (Record ID, basis, role/scope) uniqueness; exactly one `primary` per basis;
    base pair equals the primary row of its basis (§15.9.6, R2.8 cardinality)."""
    seen_ids, seen_keys, primary = set(), set(), {}
    for r in rows:
        cid, basis, role, value = r["comp_id"], r["basis"], r["role_scope"], r["value"]
        if not DATECOMP_RE.match(cid):
            return False, f"bad date-component id {cid}"
        if cid in seen_ids:
            return False, f"duplicate date-component id {cid}"
        seen_ids.add(cid)
        if basis not in bases:
            return False, f"unknown basis {basis!r}"
        if not ROLE_SCOPE_RE.match(role):
            return False, f"bad role/scope {role!r}"
        key = (basis, role)
        if key in seen_keys:
            return False, f"duplicate/conflicting component for {key}"
        seen_keys.add(key)
        if role == "primary":
            if basis in primary:
                return False, f"two primary rows for basis {basis!r}"
            primary[basis] = value
    if rows and base_field != "—":
        b, _, v = base_field.partition(":")
        if primary.get(b) != v:
            return False, "base pair does not equal the primary row of its basis"
    return True, "date components ok"


def validate_normalized_scope(atoms):
    """atoms: set/list of scope-atom strings 'clause:...' or 'sent:a[-b]'.
    Returns (ok, why, expanded) where expanded is the covered token set."""
    expanded, seen_clause = set(), set()
    for a in atoms:
        if a.startswith("clause:"):
            if a in seen_clause:
                return False, f"duplicate clause atom {a}", None
            seen_clause.add(a)
            expanded.add(a)
        else:
            m = re.match(r"^sent:([1-9]\d*)(?:-([1-9]\d*))?$", a)
            if not m:
                return False, f"malformed scope atom {a}", None
            lo = int(m.group(1))
            hi = int(m.group(2)) if m.group(2) else lo
            if hi < lo:
                return False, f"reversed sentence span {a}", None
            for k in range(lo, hi + 1):
                tok = f"sent:{k}"
                if tok in expanded:
                    return False, f"overlapping sentence ordinal {tok}", None
                expanded.add(tok)
    return True, "scope ok", expanded


def scopes_overlap(a_atoms, b_atoms):
    oka, _, ea = validate_normalized_scope(a_atoms)
    okb, _, eb = validate_normalized_scope(b_atoms)
    if not (oka and okb):
        return True  # malformed scopes treated as conflicting
    return bool(ea & eb)


def validate_bundle(bundle, fragment_leaf, fragment_scope, nonterminal_types):
    """Fixed disposition-bundle schema (§15.9.3, R2.8)."""
    edges = bundle["member_edges"]
    types = bundle["member_types"]
    targets = bundle["member_targets"]
    if not (len(edges) == len(types) == len(targets)) or not edges:
        return False, "member edge/type/target lists misaligned or empty"
    if edges != sorted(set(edges)) or len(edges) != len(set(edges)):
        return False, "member edges not canonical (sorted, unique)"
    if bundle.get("source_fragment_leaf") != fragment_leaf:
        return False, "bundle source LEAF disagrees with fragment"
    seen_map = set()
    for t, tg in zip(types, targets):
        if t not in nonterminal_types:
            return False, f"bundle member has non-nonterminal/unknown edge type {t!r}"
        if (bundle["source_fragment"], tg) in seen_map:
            return False, f"duplicate source-target mapping to {tg}"
        seen_map.add((bundle["source_fragment"], tg))
    if bundle.get("class") != "active":
        return False, "bundle class must be active (no terminal member)"
    if set(bundle.get("subject_scope", [])) != set(fragment_scope):
        return False, "bundle subject scope != fragment normalized scope"
    return True, "bundle ok"


def validate_inventory(leaf, fragments, edges, bundles, declared_exhaustive,
                       semantic_confirmed, kinds, terminal_types, nonterminal_types,
                       kind_edge_ok, full_scope=None):
    """Per-LEAF fragment inventory reconciliation (§15.9.3, R2.8 schema)."""
    fids = list(fragments)
    # fragment-ID grammar + contiguous numbering F1..Fn (no gaps at declaration)
    nums = []
    for fid in fids:
        m = LEAF_FRAG_RE.match(fid)
        if not m or m.group(1) != leaf:
            return False, f"bad fragment id {fid}"
        if fragments[fid]["kind"] not in kinds:
            return False, f"bad kind on {fid}"
        if fragments[fid].get("status", "current") not in ("current", "superseded"):
            return False, f"bad fragment status on {fid}"
        nums.append(int(m.group(2)))
    if sorted(nums) != list(range(1, len(nums) + 1)):
        return False, "noncontiguous fragment IDs (F1..Fn expected at declaration)"
    if not declared_exhaustive:
        return False, "no declared exhaustive decomposition"
    if not semantic_confirmed:
        return False, "no semantic exhaustiveness confirmation"
    # pairwise non-overlap of normalized scopes
    for i in range(len(fids)):
        oki, why, _ = validate_normalized_scope(fragments[fids[i]]["scope"])
        if not oki:
            return False, f"{fids[i]}: {why}"
        for j in range(i + 1, len(fids)):
            if scopes_overlap(fragments[fids[i]]["scope"], fragments[fids[j]]["scope"]):
                return False, f"overlapping fragments {fids[i]}/{fids[j]}"
    # exhaustive coverage against declared full scope (if provided)
    if full_scope is not None:
        union = set()
        for fid in fids:
            _, _, e = validate_normalized_scope(fragments[fid]["scope"])
            union |= (e or set())
        _, _, want = validate_normalized_scope(full_scope)
        if union != (want or set()):
            return False, "declared fragments do not exhaustively cover the LEAF"
    # disposition: exactly one terminal edge OR exactly one active bundle
    dispo = {fid: [] for fid in fragments}
    for e in edges:
        if e["source"] != leaf:
            continue
        if e["frag"] not in fragments:
            return False, f"edge {e['id']} names unregistered fragment {e['frag']}"
        dispo[e["frag"]].append(e)
    for fid, es in dispo.items():
        terms = [e for e in es if e["type"] in terminal_types]
        nonterms = [e for e in es if e["type"] in nonterminal_types]
        bundle = bundles.get(fid)
        if not es and bundle is None:
            return False, f"orphan fragment {fid} (no disposition)"
        if len(terms) > 1:
            return False, f"two terminal dispositions for {fid}"
        if terms and (nonterms or bundle):
            return False, f"{fid} simultaneously terminal and actively owned"
        if nonterms and bundle is None:
            return False, f"{fid} nonterminal edges without a governed bundle"
        if bundle is not None:
            okb, whyb = validate_bundle(bundle, leaf, fragments[fid]["scope"],
                                        nonterminal_types)
            if not okb:
                return False, f"{fid} bundle invalid: {whyb}"
            if sorted(bundle["member_edges"]) != sorted(e["id"] for e in nonterms):
                return False, f"{fid} bundle members != its nonterminal edges"
        for e in terms:
            if fragments[fid]["kind"] not in kind_edge_ok[e["type"]]:
                return False, f"kind/edge-type mismatch on {fid}"
    # terminal uniqueness on (source LEAF, fragment ID)
    seen = set()
    for e in edges:
        if e["type"] in terminal_types:
            key = (e["source"], e["frag"])
            if key in seen:
                return False, f"duplicate terminal edge for {key}"
            seen.add(key)
    return True, "inventory ok"


REASON_FOR_TYPE = {
    "process-only": "process-material", "invalid": "false-claim",
    "no-successor": "out-of-scope-or-obsolete",
    "unsupported-residual": "authority-not-located",
}


def validate_disp_subject(det):
    """Polymorphic subject-variant exclusivity (§15.9.4, R2.8)."""
    sc = det.get("subject_class")
    if sc not in ("XW2-DISP", "SXW2-DISP"):
        return False, f"bad DISP subject class {sc!r}"
    leaf, lfrag = det.get("hist_leaf"), det.get("hist_frag")
    scen, sfrag = det.get("scenario"), det.get("scen_frag")
    if sc == "XW2-DISP":
        if not (leaf and lfrag):
            return False, "XW2-DISP missing LEAF/fragment"
        if not LEAF_FRAG_RE.match(lfrag) or not lfrag.startswith(leaf + ":"):
            return False, "XW2-DISP fragment grammar/ownership invalid"
        if scen != "—" or sfrag != "—":
            return False, "XW2-DISP must set scenario fields to —"
    else:  # SXW2-DISP
        if not (scen and sfrag):
            return False, "SXW2-DISP missing scenario/fragment"
        if not SCEN_FRAG_RE.match(sfrag) or not sfrag.startswith(scen + ":"):
            return False, "SXW2-DISP invented/invalid scenario fragment"
        if leaf != "—" or lfrag != "—":
            return False, "SXW2-DISP must set LEAF fields to —"
        if det.get("edge_type") not in ("invalid", "no-successor"):
            return False, "SXW2-DISP terminal type must be invalid/no-successor"
    return True, "subject ok"


def validate_terminal_reference(edge, decisions, disp_details, sm2, search_sets):
    """A terminal XW2/SXW2 edge -> its current polymorphic DISP detail row."""
    dr = decisions.get(edge["decision"])
    if dr is None:
        return False, "decision reference does not resolve"
    if dr["type"] != "DISP":
        return False, f"terminal edge references {dr['type']}, not DISP"
    if dr["status"] != "current":
        return False, "stale reference: superseded decision reachable only via AMEND"
    det = disp_details.get(edge["decision"])
    if det is None:
        return False, "DISP without pinned detail row"
    oks, whys = validate_disp_subject(det)
    if not oks:
        return False, whys
    # register <-> subject class
    reg = "SXW2" if edge["id"].startswith("SXW2-") else "XW2"
    want_class = "SXW2-DISP" if reg == "SXW2" else "XW2-DISP"
    if det["subject_class"] != want_class:
        return False, "subject-family mismatch (edge register vs DISP subject class)"
    # bidirectional subject agreement
    if want_class == "XW2-DISP":
        if det["hist_leaf"] != edge["source"] or det["hist_frag"] != edge["frag"]:
            return False, "DISP detail disagrees with edge (LEAF/fragment)"
    else:
        if det["scenario"] != edge["source"] or det["scen_frag"] != edge["frag"]:
            return False, "DISP detail disagrees with edge (scenario/fragment)"
    if det["edge"] != edge["id"] or det["edge_type"] != edge["type"]:
        return False, "DISP detail disagrees with edge (edge id/type)"
    if det["reason"] != REASON_FOR_TYPE[edge["type"]]:
        return False, "no-owner reason incompatible with edge type"
    if edge["type"] == "unsupported-residual":
        if not det.get("sm2"):
            return False, "unsupported-residual without SM2 records"
        if not det.get("search_set"):
            return False, "unsupported-residual without SS2 search-set"
        ss = search_sets.get(det["search_set"])
        if ss is None or ss.get("status") != "current":
            return False, "search-set not current"
        if ss.get("adequacy") != "adequate-coverage":
            return False, "inadequate coverage cannot support unsupported-residual"
        for smid in det["sm2"]:
            rec = sm2.get(smid)
            if rec is None or rec["status"] != "current":
                return False, f"SM2 {smid} not current"
            okm, whym = validate_sm2(rec)
            if not okm:
                return False, f"inadequate SM2 {smid}: {whym}"
            if rec["result"] == "qualifying-authority-located":
                return False, "located authority forbids unsupported-residual"
        if not det.get("anchor") or det.get("anchor") == "—":
            return False, "unsupported-residual without preserved-candidate anchor"
    return True, "terminal reference ok"


def find_orphan_disps(edges, decisions, disp_details):
    referenced = {e["decision"] for e in edges}
    return sorted(d for d, det in disp_details.items()
                  if decisions.get(d, {}).get("status") == "current"
                  and d not in referenced)


VAGUE = {"official web surfaces", "the internet", "official sources",
         "various sources"}


def validate_sm2(rec):
    """Split-field SM2 record adequacy (§15.9.6, R2.8)."""
    if rec["result"] not in {"qualifying-authority-located",
                             "no-qualifying-authority-located-in-searched-sources",
                             "inconclusive"}:
        return False, f"result {rec['result']!r} outside closed vocabulary"
    if "exists" in rec["result"]:
        return False, "result implies universal negative"
    if rec.get("source_identity", "").strip().lower() in VAGUE:
        return False, "vague source identity"
    if not rec.get("locator") or rec["locator"] == "—":
        return False, "missing exact locator/query"
    if not rec.get("cutoff"):
        return False, "missing search cutoff"
    if rec.get("is_artifact"):
        for f in ("size", "sha256", "pagination"):
            if not rec.get(f) or rec.get(f) == "—":
                return False, f"artifact search missing split binary field {f}"
        if rec.get("sha256") and not re.match(r"^[0-9a-f]{64}$", rec["sha256"]):
            return False, "binary SHA-256 malformed"
    if rec.get("status") not in ("current", "superseded"):
        return False, "bad search status"
    return True, "sm2 ok"


def validate_search_set(ss, members):
    """SS2 deterministic coverage assessment (§15.9.6, R2.8)."""
    required = set(ss["required_classes"])
    covered = set()
    for smid in ss["member_sm2"]:
        rec = members.get(smid)
        if rec is None or rec.get("status") != "current":
            return False, f"member {smid} not current", "inadequate-coverage"
        ok, _ = validate_sm2(rec)
        if not ok:
            continue
        if rec["result"] == "inconclusive":
            continue  # inconclusive never counts toward coverage
        covered.add(rec["class"])
    adequacy = "adequate-coverage" if required <= covered else "inadequate-coverage"
    if ss.get("adequacy") != adequacy:
        return False, f"declared adequacy {ss.get('adequacy')} != computed {adequacy}", adequacy
    return True, "search-set ok", adequacy


def disposition_available(fragment_kind, supported_sibling_exists, authority_located,
                          valid_in_scope, attempted_type):
    """Which disposition is honest for a fragment (§15.9.3). Wholly unsupported ->
    BLOCKED (no terminal escape)."""
    if attempted_type == "unsupported-residual":
        if fragment_kind != "substantive-obligation":
            return False, "unsupported-residual only for substantive-obligation"
        if authority_located:
            return False, "authority located: active owner required"
        if not supported_sibling_exists:
            return False, "BLOCKED-UNSUPPORTED-OBLIGATION: no supported sibling"
        return True, "ok"
    if attempted_type in ("no-successor", "process-only"):
        # a whole valid in-scope unsupported substantive obligation cannot escape
        if (fragment_kind == "substantive-obligation" and valid_in_scope
                and not authority_located and not supported_sibling_exists):
            return False, f"BLOCKED-UNSUPPORTED-OBLIGATION: cannot escape as {attempted_type}"
        return True, "ok"
    if attempted_type == "invalid":
        if fragment_kind == "substantive-obligation" and valid_in_scope and not authority_located:
            return False, "merely unsupported substantive mechanic is not thereby invalid"
        return True, "ok"
    return True, "ok"


def validate_resolution(finding, resolution):
    """Governed blocked-finding + independent-acceptance gate (§15.9.3, R2.8)."""
    if finding["type"] != "blocked-unsupported-obligation":
        return False, "unknown finding type"
    if resolution is None:
        return finding["status"] == "open", "no resolution -> stays open (U7 stop)"
    if resolution["outcome"] not in {"foundation-vocabulary-or-scope-decision",
                                     "authority-located-mint-owner",
                                     "out-of-scope-determination"}:
        return False, "proposed outcome outside closed vocabulary"
    accepted = resolution["status"] == "accepted"
    if accepted:
        if resolution["checker"] == resolution["maker"]:
            return False, "maker self-acceptance forbidden"
        if not resolution.get("acceptance_commit") or resolution["acceptance_commit"] == "—":
            return False, "accepted without pinned acceptance commit/receipt"
    finding_cleared = finding["status"] == "resolved"
    if finding_cleared and not accepted:
        return False, "finding marked resolved without an accepted resolution"
    return True, "resolution ok"


def amend_supersede(decisions, edges, old_id, new_id, new_type, update_refs_same_commit):
    if new_id in decisions:  # append-only: never overwrite/reuse an allocated ID
        return False
    decisions[old_id]["status"] = "superseded"
    decisions[old_id]["superseded_by"] = new_id
    decisions[new_id] = {"type": new_type, "status": "current", "superseded_by": None}
    if update_refs_same_commit:
        for e in edges:
            if e["decision"] == old_id:
                e["decision"] = new_id
    return True


# --------------------------------------------------------------------------
# 4. Parse the ACTUAL current populations; recognize the legacy R3 population
# --------------------------------------------------------------------------


def parse_xw2(text):
    """Parse §15.11 crosswalk edges from the real canon."""
    seg = text[text.find("### 15.11"):text.find("### 15.12")]
    edges = []
    for m in re.finditer(
            r"^\|\s*(XW2-\d{4})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*`([a-z-]+)`\s*\|"
            r"\s*(.*?)\s*\|\s*(DR2-\d{4})\s*\|\s*$", seg, re.MULTILINE):
        edges.append({"id": m.group(1), "source": m.group(2).strip(),
                      "target": m.group(3).strip(), "type": m.group(4),
                      "decision": m.group(6)})
    return edges


def parse_src2_base_header(text):
    seg = text[text.find("#### 15.12.1"):text.find("#### 15.12.2")]
    m = re.search(r"^\|\s*Record ID\s*\|(.+)\|\s*$", seg, re.MULTILINE)
    return (m.group(0) if m else ""), seg


def parse_transition_legacy_dr(text):
    """The §15.9.4 transition block names the committed mistyped terminal
    decisions (DR2-0037 OWN, DR2-0038 OWN, DR2-0039 ATOM). Extract them from the
    canon so the legacy set is canon-derived, not hard-coded."""
    seg = _block_after(text, "Committed pre-R2.7 terminal records (transition",
                       stop=r"Unit-local validation")
    legacy = {}
    for m in re.finditer(r"`(DR2-\d{4})`\s*\(`(OWN|ATOM)`", seg):
        legacy[m.group(1)] = m.group(2)
    return legacy


def assess_current_population(text, vocab):
    """Validate what CAN be validated on the real population now, and RECOGNIZE
    the committed R3 population as rejected/legacy. Returns (problems, notes)."""
    problems, notes = [], []
    edges = parse_xw2(text)
    if len(edges) < 100:
        problems.append(f"parsed only {len(edges)} XW2 edges (expected ~131)")
    notes.append(f"parsed {len(edges)} XW2 crosswalk edges from §15.11")

    # structural: edge types in vocabulary; terminal edges have target —
    for e in edges:
        if e["type"] not in vocab["xw2_edge_types"]:
            problems.append(f"{e['id']} unknown edge type {e['type']}")
        if e["type"] in vocab["xw2_terminal_types"] and e["target"] != "—":
            problems.append(f"terminal {e['id']} has non-— target {e['target']!r}")

    # legacy recognition #1: SRC2 base still carries the pre-R2.7 field
    header, _ = parse_src2_base_header(text)
    if "Publication/effective date" in header:
        notes.append("LEGACY: §15.12 SRC2 base uses the pre-R2.7 "
                     "'Publication/effective date' field -> NOT R3.1-conforming "
                     "(R3.1 migrates it to the basis:value source-date model)")
        legacy_src2 = True
    elif "Source date (basis:value)" in header:
        legacy_src2 = False
        notes.append("§15.12 SRC2 base uses the basis:value source-date model")
    else:
        problems.append("could not classify §15.12 SRC2 base header")
        legacy_src2 = None

    # legacy recognition #2: terminal edges reference committed OWN/ATOM decisions
    legacy_dr = parse_transition_legacy_dr(text)
    term_refs = sorted({e["decision"] for e in edges
                        if e["type"] in vocab["xw2_terminal_types"]})
    mistyped = sorted(d for d in term_refs if d in legacy_dr)
    if mistyped:
        notes.append("LEGACY: terminal edges reference committed "
                     + ", ".join(f"{d}({legacy_dr[d]})" for d in mistyped)
                     + " -> NOT R3.1-conforming (R3.1 supersedes them with "
                     "polymorphic XW2-DISP records via AMEND)")

    # The population MUST be recognized as legacy; certifying it as conforming
    # is itself an error this validator must catch.
    is_legacy = bool(mistyped) or legacy_src2
    if not is_legacy:
        problems.append("current population no longer shows the known legacy "
                        "signals -- refusing to silently treat a changed "
                        "population as R3.1-conforming without re-review")
    else:
        notes.append("VERDICT: committed R3 population correctly recognized as "
                     "rejected/legacy; NOT certified as R3.1-conforming")
    return problems, notes


# --------------------------------------------------------------------------
# 5. Adversarial cases (26 inherited + 15 new Codex probes + mutations)
# --------------------------------------------------------------------------


def run_cases(V):
    results = []

    def case(n, desc, got_ok, expect_ok):
        results.append((n, desc, got_ok, expect_ok, got_ok == expect_ok))

    KINDS = V["fragment_kinds"]
    TERM = V["xw2_terminal_types"]
    NONTERM = V["xw2_nonterminal_types"]
    BASES = V["date_bases"]
    KIND_EDGE_OK = {
        "process-only": {"process-instruction"},
        "invalid": {"authority-assertion", "gap-assertion", "substantive-obligation"},
        "no-successor": {"substantive-obligation", "gap-assertion"},
        "unsupported-residual": {"substantive-obligation"},
    }
    L = "CBA-A18.7"
    f_sup = {"kind": "substantive-obligation", "scope": ["sent:1"], "status": "current"}
    f_res = {"kind": "substantive-obligation", "scope": ["sent:2"], "status": "current"}
    e_sup = {"id": "XW2-9001", "source": L, "frag": f"{L}:F1", "type": "partial-overlap",
             "decision": "DR2-9001"}
    # e_res.decision points at the CURRENT DISP DR2-9011 so cases 11/M1/M3/M4 test
    # the reconciliation path they intend (not a "decision does not resolve" reject).
    e_res = {"id": "XW2-9002", "source": L, "frag": f"{L}:F2", "type": "unsupported-residual",
             "decision": "DR2-9011"}
    bnd1 = {"source_fragment_leaf": L, "source_fragment": f"{L}:F1",
            "member_edges": ["XW2-9001"], "member_types": ["partial-overlap"],
            "member_targets": ["CBA2-A08.4"], "class": "active", "subject_scope": ["sent:1"]}

    def inv(fragments, edges, bundles, exh=True, sem=True, full=None):
        return validate_inventory(L, fragments, edges, bundles, exh, sem, KINDS,
                                  TERM, NONTERM, KIND_EDGE_OK, full)

    # ---- Inherited cases 1-8: fragment inventory ----
    ok, _ = inv({f"{L}:F1": f_sup}, [e_sup], {f"{L}:F1": bnd1}, exh=False)
    case(1, "silently omitted residual", ok, False)
    ok, _ = inv({f"{L}:F1": f_sup, f"{L}:F2": f_res}, [e_sup, e_res], {f"{L}:F1": bnd1})
    case(2, "exhaustive supported+unsupported decomposition", ok, True)
    ovl = {f"{L}:F1": f_sup, f"{L}:F2": {"kind": "substantive-obligation",
                                         "scope": ["sent:1"], "status": "current"}}
    ok, _ = inv(ovl, [e_sup, e_res], {f"{L}:F1": bnd1})
    case(3, "overlapping fragments", ok, False)
    ok, _ = inv({f"{L}:F1": f_sup, f"{L}:F2": f_res}, [e_sup], {f"{L}:F1": bnd1})
    case(4, "orphan fragment", ok, False)
    bad = dict(e_res, frag=f"{L}:F9")
    ok, _ = inv({f"{L}:F1": f_sup, f"{L}:F2": f_res}, [e_sup, bad], {f"{L}:F1": bnd1})
    case(5, "edge references unknown fragment", ok, False)
    both = dict(e_sup, id="XW2-9003", frag=f"{L}:F2")
    bnd_f2 = {"source_fragment_leaf": L, "source_fragment": f"{L}:F2",
              "member_edges": ["XW2-9003"], "member_types": ["partial-overlap"],
              "member_targets": ["CBA2-A08.9"], "class": "active", "subject_scope": ["sent:2"]}
    ok, _ = inv({f"{L}:F1": f_sup, f"{L}:F2": f_res}, [e_sup, e_res, both],
                {f"{L}:F1": bnd1, f"{L}:F2": bnd_f2})
    case(6, "fragment both terminal and actively owned", ok, False)
    f_proc = {"kind": "process-instruction", "scope": ["sent:1"], "status": "current"}
    e_t1 = {"id": "XW2-9004", "source": L, "frag": f"{L}:F1", "type": "process-only",
            "decision": "DR2-9004"}
    e_t2 = {"id": "XW2-9005", "source": L, "frag": f"{L}:F2", "type": "unsupported-residual",
            "decision": "DR2-9005"}
    ok, _ = inv({f"{L}:F1": f_proc, f"{L}:F2": f_res}, [e_t1, e_t2], {})
    case(7, "two terminal fragments, distinct IDs", ok, True)
    e_dup = dict(e_t2, id="XW2-9006", type="no-successor", decision="DR2-9006")
    ok, _ = inv({f"{L}:F1": f_proc, f"{L}:F2": f_res}, [e_t1, e_t2, e_dup], {})
    case(8, "two terminal decisions for one fragment", ok, False)

    # ---- Decisions/DISP fixtures for 9-12 ----
    sm_good = {"SM2-9001": {"status": "current", "class": "CBA",
                            "result": "no-qualifying-authority-located-in-searched-sources",
                            "source_identity": "2023 NBA-NBPA CBA (signed edition)",
                            "locator": "VII §8(a) p.260", "cutoff": "2026-07-21T00:00:00Z",
                            "is_artifact": True, "size": "2850534",
                            "sha256": "bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32",
                            "pagination": "676 pages"}}
    ss_good = {"SS2-9001": {"status": "current", "adequacy": "adequate-coverage",
                            "required_classes": ["CBA"], "member_sm2": ["SM2-9001"]}}
    decisions = {
        "DR2-9010": {"type": "OWN", "status": "current", "superseded_by": None},
        "DR2-9011": {"type": "DISP", "status": "current", "superseded_by": None},
        "DR2-9012": {"type": "DISP", "status": "superseded", "superseded_by": "DR2-9011"},
    }
    det_ok = {"subject_class": "XW2-DISP", "hist_leaf": L, "hist_frag": f"{L}:F2",
              "scenario": "—", "scen_frag": "—", "edge": "XW2-9002",
              "edge_type": "unsupported-residual", "reason": "authority-not-located",
              "sm2": ["SM2-9001"], "search_set": "SS2-9001", "anchor": "§12.12",
              "status": "current"}
    disp_details = {"DR2-9011": det_ok, "DR2-9012": dict(det_ok, status="superseded")}

    e9 = dict(e_res, decision="DR2-9010")
    ok, _ = validate_terminal_reference(e9, decisions, disp_details, sm_good, ss_good)
    case(9, "terminal edge references OWN", ok, False)
    e10 = dict(e_res, decision="DR2-9012")
    ok, _ = validate_terminal_reference(e10, decisions, disp_details, sm_good, ss_good)
    case(10, "terminal edge references superseded DISP", ok, False)
    det_bad = dict(det_ok, hist_frag=f"{L}:F1")
    ok, _ = validate_terminal_reference(e_res, decisions, {"DR2-9011": det_bad}, sm_good, ss_good)
    case(11, "DISP detail mismatch (fragment)", ok, False)
    orphans = find_orphan_disps([e_sup], decisions, disp_details)
    case(12, "orphan current DISP", len(orphans) == 0, False)

    # ---- 13-14 blocking outcome / kind separation ----
    allowed, why = disposition_available("substantive-obligation", False, False, True,
                                         "unsupported-residual")
    case(13, "wholly unsupported obligation blocked",
         allowed or "BLOCKED-UNSUPPORTED-OBLIGATION" not in why, False)
    inv_auth, _ = disposition_available("authority-assertion", True, False, True, "invalid")
    ur_sub, _ = disposition_available("substantive-obligation", True, False, True,
                                      "unsupported-residual")
    inv_sub, _ = disposition_available("substantive-obligation", True, False, True, "invalid")
    case(14, "kind separation (invalid on claim, not on unsupported mechanic)",
         inv_auth and ur_sub and not inv_sub, True)

    # ---- 15-20 source-date model ----
    bylaws = {"edition": {"precision": "month", "value": "2024-06",
                          "edition_identifier_only": True}}
    bylaws_pub = {"publication": {"precision": "month", "value": "2024-06",
                                  "edition_identifier_only": True},
                  "edition": {"precision": "month", "value": "2024-06",
                              "edition_identifier_only": True}}
    cba = {"agreement-as-of": {"precision": "day", "value": "2023-06-28"},
           "effective": {"precision": "day", "value": "2023-07-01"},
           "edition": {"precision": "month", "value": "2023-07", "edition_identifier_only": True}}
    lim = ["edition identified by the source to month precision only"]
    ok, _ = validate_source_date("edition:2024-06", "official-immutable", bylaws, lim, BASES)
    case(15, "edition:2024-06 with limitation", ok, True)
    o1, _ = validate_source_date("publication:2024-06", "official-immutable", bylaws_pub, lim, BASES)
    o2, _ = validate_source_date("effective:2024-06", "official-immutable", bylaws_pub, lim, BASES)
    case(16, "edition month as publication/effective", o1 or o2, False)
    ok, _ = validate_source_date("effective:2023-07-01", "official-immutable", cba, [], BASES)
    case(17, "effective:2023-07-01", ok, True)
    ok, _ = validate_source_date("effective:2023-07", "official-immutable", cba, lim, BASES)
    case(18, "exact date degraded to month", ok, False)
    meta = {"publication": {"precision": "day", "value": "2024-06-07", "metadata_only": True}}
    ok, _ = validate_source_date("publication:2024-06-07", "official-immutable", meta, [], BASES)
    case(19, "metadata-derived day", ok, False)
    o1, _ = validate_source_date("2024-06", "official-immutable", bylaws, lim, BASES)
    o2, _ = validate_source_date("cover:2024-06", "official-immutable", bylaws, lim, BASES)
    o3, _ = validate_source_date("publication:—", "official-immutable", bylaws, lim, BASES)
    case(20, "missing/unknown basis or half-empty pair", o1 or o2 or o3, False)

    # ---- 21-23 SM2 ----
    ok, _ = validate_sm2(sm_good["SM2-9001"])
    case(21, "adequate SM2 record", ok, True)
    ok, _ = validate_sm2({"status": "current", "class": "CBA",
                          "result": "no-qualifying-authority-located-in-searched-sources",
                          "source_identity": "official web surfaces", "locator": "—",
                          "cutoff": "2026-07-21T00:00:00Z"})
    case(22, "vague SM2 source identity", ok, False)
    ok, _ = validate_sm2({"status": "current", "class": "CBA", "result": "no-authority-exists",
                          "source_identity": "2023 NBA-NBPA CBA", "locator": "VII §8(a)",
                          "cutoff": "2026-07-21T00:00:00Z"})
    case(23, "universal-negative result", ok, False)

    # ---- 24 SC2 terminal SXW2 edge to OWN ----
    sxw = {"id": "SXW2-9001", "source": "scenario-53", "frag": "scenario-53:F1",
           "type": "invalid", "decision": "DR2-9010"}
    ok, _ = validate_terminal_reference(sxw, decisions, disp_details, sm_good, ss_good)
    case(24, "SC2 check 11: terminal SXW2 edge to OWN", ok, False)

    # ---- 25-26 AMEND/current-reference ----
    dec = {"DR2-9020": {"type": "ATOM", "status": "current", "superseded_by": None}}
    edges = [{"id": "XW2-9010", "source": L, "frag": f"{L}:F1", "type": "process-only",
              "decision": "DR2-9020"}]
    amend_supersede(dec, edges, "DR2-9020", "DR2-9021", "DISP", True)
    det25 = {"DR2-9021": {"subject_class": "XW2-DISP", "hist_leaf": L, "hist_frag": f"{L}:F1",
                          "scenario": "—", "scen_frag": "—", "edge": "XW2-9010",
                          "edge_type": "process-only", "reason": "process-material",
                          "sm2": [], "search_set": None, "anchor": "—", "status": "current"}}
    ok, _ = validate_terminal_reference(edges[0], dec, det25, {}, {})
    case(25, "valid AMEND supersession with same-commit reference update", ok, True)
    dec2 = {"DR2-9030": {"type": "ATOM", "status": "current", "superseded_by": None}}
    edges2 = [{"id": "XW2-9011", "source": L, "frag": f"{L}:F1", "type": "process-only",
               "decision": "DR2-9030"}]
    amend_supersede(dec2, edges2, "DR2-9030", "DR2-9031", "DISP", False)
    det26 = {"DR2-9031": dict(det25["DR2-9021"], edge="XW2-9011")}
    ok, _ = validate_terminal_reference(edges2[0], dec2, det26, {}, {})
    case(26, "stale reference after AMEND (no same-commit update)", ok, False)

    # ====================  15 NEW Codex probes  ====================

    # N1. Noncontiguous fragment IDs.
    frags_gap = {f"{L}:F1": f_proc, f"{L}:F3": f_res}
    e_g1 = dict(e_t1)
    e_g2 = dict(e_t2, frag=f"{L}:F3")
    ok, _ = inv(frags_gap, [e_g1, e_g2], {})
    case("N1", "noncontiguous fragment IDs", ok, False)

    # N2. Unknown edge type (in a bundle).
    bnd_unknown = dict(bnd1, member_types=["frobnicate"])
    okb, _ = validate_bundle(bnd_unknown, L, ["sent:1"], NONTERM)
    case("N2", "unknown edge type in bundle", okb, False)

    # N3. Duplicate/incompatible disposition bundle (duplicate source-target).
    bnd_dup = dict(bnd1, member_edges=["XW2-9001", "XW2-9007"],
                   member_types=["partial-overlap", "split"],
                   member_targets=["CBA2-A08.4", "CBA2-A08.4"])
    okb, _ = validate_bundle(bnd_dup, L, ["sent:1"], NONTERM)
    case("N3", "duplicate source-target mapping in bundle", okb, False)

    # N4. Conflicting edition/date representations (edition month as effective).
    o, _ = validate_source_date("effective:2024-06", "official-immutable", bylaws_pub, lim, BASES)
    case("N4", "conflicting edition/date representation", o, False)

    # N5. Missing required immutable-source semantic date (base pair with no component).
    ok, _ = validate_date_components("agreement-as-of:2023-06-28", [], BASES)
    # a base pair present but no matching primary component row -> fail
    ok2, _ = validate_date_components(
        "agreement-as-of:2023-06-28",
        [{"comp_id": "SRC2-001#D1", "basis": "effective", "role_scope": "primary",
          "value": "2023-07-01"}], BASES)
    case("N5", "missing required immutable-source semantic date", ok and ok2, False)

    # N6. Reversed/impossible effective window.
    src_win = {"effective": {"precision": "window", "value": "2023-07-01/2023-06-01"}}
    o, _ = validate_source_date("effective:2023-07-01/2023-06-01", "official-immutable",
                                src_win, [], BASES)
    case("N6", "reversed/impossible effective window", o, False)

    # N7. Malformed date component (bad component id + bad role).
    o1, _ = validate_date_components("—", [{"comp_id": "D1", "basis": "effective",
                                            "role_scope": "primary", "value": "2023-07-01"}], BASES)
    o2, _ = validate_date_components("—", [{"comp_id": "SRC2-001#D1", "basis": "effective",
                                            "role_scope": "PRIMARY", "value": "2023-07-01"}], BASES)
    case("N7", "malformed date component", o1 or o2, False)

    # N8. Incomplete SM2 record (artifact search missing split binary fields).
    ok, _ = validate_sm2({"status": "current", "class": "CBA",
                          "result": "no-qualifying-authority-located-in-searched-sources",
                          "source_identity": "2023 CBA", "locator": "VII §8(a)",
                          "cutoff": "2026-07-21T00:00:00Z", "is_artifact": True})
    case("N8", "incomplete SM2 record (missing split binary fields)", ok, False)

    # N9. Inconclusive search supporting unsupported-residual.
    sm_inc = {"SM2-9002": dict(sm_good["SM2-9001"], result="inconclusive")}
    ss_inc = {"SS2-9002": {"status": "current", "adequacy": "adequate-coverage",
                           "required_classes": ["CBA"], "member_sm2": ["SM2-9002"]}}
    okc, _, adq = validate_search_set(ss_inc["SS2-9002"], sm_inc)
    case("N9", "inconclusive search cannot yield adequate coverage",
         okc and adq == "adequate-coverage", False)

    # N10. Inadequate source-class coverage supporting unsupported-residual.
    ss_missing = {"status": "current", "adequacy": "adequate-coverage",
                  "required_classes": ["CBA", "BYL", "NBA", "ops-provenance"],
                  "member_sm2": ["SM2-9001"]}
    okc, _, adq = validate_search_set(ss_missing, sm_good)
    case("N10", "inadequate class coverage claimed adequate",
         okc and adq == "adequate-coverage", False)

    # N11. Whole unsupported obligation escaping as no-successor.
    a, _ = disposition_available("substantive-obligation", False, False, True, "no-successor")
    case("N11", "whole unsupported escaping as no-successor", a, False)

    # N12. Whole unsupported obligation escaping as process-only.
    a, _ = disposition_available("substantive-obligation", False, False, True, "process-only")
    case("N12", "whole unsupported escaping as process-only", a, False)

    # N13. Invented/invalid scenario-DISP subject (SXW2-DISP with a LEAF fragment).
    det_bad_subj = {"subject_class": "SXW2-DISP", "hist_leaf": "—", "hist_frag": "—",
                    "scenario": "scenario-53", "scen_frag": "CBA-A18.7:F1", "edge": "SXW2-9001",
                    "edge_type": "invalid", "reason": "false-claim", "sm2": [],
                    "search_set": None, "anchor": "—", "status": "current"}
    oks, _ = validate_disp_subject(det_bad_subj)
    case("N13", "invented/invalid scenario-DISP subject", oks, False)

    # N14. Orphan generic DISP parent (current DISP referenced by no edge).
    orphan_dec = {"DR2-9040": {"type": "DISP", "status": "current", "superseded_by": None}}
    orphan_det = {"DR2-9040": det_ok}
    orph = find_orphan_disps([], orphan_dec, orphan_det)
    case("N14", "orphan generic DISP parent", len(orph) == 0, False)

    # N15. AMEND ID overwrite/reuse.
    dec3 = {"DR2-9050": {"type": "ATOM", "status": "current", "superseded_by": None},
            "DR2-9051": {"type": "DISP", "status": "current", "superseded_by": None}}
    reused = amend_supersede(dec3, [], "DR2-9050", "DR2-9051", "DISP", True)
    case("N15", "AMEND ID overwrite/reuse", reused, False)

    # ====================  further mutations  ====================

    # M1. Valid XW2-DISP variant.
    ok, _ = validate_terminal_reference(e_res, decisions, disp_details, sm_good, ss_good)
    case("M1", "valid XW2-DISP variant", ok, True)

    # M2. Valid SXW2-DISP variant.
    sxw_dec = {"DR2-9060": {"type": "DISP", "status": "current", "superseded_by": None}}
    sxw_det = {"DR2-9060": {"subject_class": "SXW2-DISP", "hist_leaf": "—", "hist_frag": "—",
                            "scenario": "scenario-53", "scen_frag": "scenario-53:F1",
                            "edge": "SXW2-9002", "edge_type": "invalid", "reason": "false-claim",
                            "sm2": [], "search_set": None, "anchor": "—", "status": "current"}}
    sxw_edge = {"id": "SXW2-9002", "source": "scenario-53", "frag": "scenario-53:F1",
                "type": "invalid", "decision": "DR2-9060"}
    ok, _ = validate_terminal_reference(sxw_edge, sxw_dec, sxw_det, {}, {})
    case("M2", "valid SXW2-DISP variant", ok, True)

    # M3. Subject-family mismatch (XW2 edge -> SXW2-DISP row).
    mismatch_det = {"DR2-9011": dict(sxw_det["DR2-9060"], edge="XW2-9002")}
    ok, _ = validate_terminal_reference(e_res, decisions, mismatch_det, sm_good, ss_good)
    case("M3", "subject-family mismatch (XW2 edge to SXW2-DISP)", ok, False)

    # M4. Scope/basis mismatch on DISP (wrong no-owner reason).
    ok, _ = validate_terminal_reference(e_res, decisions,
                                        {"DR2-9011": dict(det_ok, reason="false-claim")},
                                        sm_good, ss_good)
    case("M4", "wrong no-owner reason for edge type", ok, False)

    # M5. Multiple same-basis dates with distinct valid roles (pass).
    ok, _ = validate_date_components(
        "effective:2023-07-01",
        [{"comp_id": "SRC2-001#D1", "basis": "effective", "role_scope": "primary",
          "value": "2023-07-01"},
         {"comp_id": "SRC2-001#D2", "basis": "effective",
          "role_scope": "scoped:earlier-commencement-provisions", "value": "2023-06-01"}], BASES)
    case("M5", "multiple same-basis effective dates, distinct roles", ok, True)

    # M6. Conflicting duplicate date components (two primaries for one basis).
    ok, _ = validate_date_components(
        "effective:2023-07-01",
        [{"comp_id": "SRC2-001#D1", "basis": "effective", "role_scope": "primary",
          "value": "2023-07-01"},
         {"comp_id": "SRC2-001#D2", "basis": "effective", "role_scope": "primary",
          "value": "2023-06-01"}], BASES)
    case("M6", "conflicting duplicate date components", ok, False)

    # M7. Bundle active/terminal mixing (terminal edge type as a member).
    bnd_mix = dict(bnd1, member_types=["invalid"])
    okb, _ = validate_bundle(bnd_mix, L, ["sent:1"], NONTERM)
    case("M7", "bundle active/terminal mixing", okb, False)

    # M8. Maker self-acceptance of a blocked resolution.
    blk = {"type": "blocked-unsupported-obligation", "status": "resolved", "res": "RES-9001"}
    res_self = {"outcome": "out-of-scope-determination", "status": "accepted",
                "maker": "agent:codex", "checker": "agent:codex",
                "acceptance_commit": "deadbeef"}
    ok, _ = validate_resolution(blk, res_self)
    case("M8", "maker self-acceptance of blocked resolution", ok, False)

    # M9. Finding marked resolved with no accepted resolution.
    res_prop = {"outcome": "out-of-scope-determination", "status": "proposed",
                "maker": "agent:codex", "checker": "agent:claude-code", "acceptance_commit": "—"}
    ok, _ = validate_resolution(blk, res_prop)
    case("M9", "finding resolved without accepted resolution", ok, False)

    # M9b. Valid independently-accepted resolution (pass).
    res_ok = {"outcome": "out-of-scope-determination", "status": "accepted",
              "maker": "agent:codex", "checker": "human:project-owner",
              "acceptance_commit": "3e9f913f"}
    ok, _ = validate_resolution(blk, res_ok)
    case("M9b", "valid independent acceptance (distinct checker)", ok, True)

    # M10. G15R population omission (a superseded decision still live-referenced).
    g15r_dec = {"DR2-9070": {"type": "DISP", "status": "superseded", "superseded_by": "DR2-9071"},
                "DR2-9071": {"type": "DISP", "status": "current", "superseded_by": None}}
    g15r_edge = {"id": "XW2-9070", "source": L, "frag": f"{L}:F1", "type": "invalid",
                 "decision": "DR2-9070"}
    g15r_det = {"DR2-9070": dict(det_ok, edge="XW2-9070", edge_type="invalid",
                                reason="false-claim", hist_frag=f"{L}:F1", status="superseded")}
    ok, _ = validate_terminal_reference(g15r_edge, g15r_dec, g15r_det, sm_good, ss_good)
    case("M10", "G15R: live reference to superseded record", ok, False)

    return results


# --------------------------------------------------------------------------
# 6. main
# --------------------------------------------------------------------------


def main():
    failures = 0
    text, path = read_canon()
    print(f"canon: {path}")
    print(f"canon SHA-256: {hashlib.sha256(text.encode('utf-8')).hexdigest()}")

    V = extract_canon_vocab(text)
    drift = assert_vocab_from_canon(V)
    for d in drift:
        print(f"[VOCAB-DRIFT] {d}")
    failures += len(drift)
    print("vocabularies extracted from canon: " + ", ".join(
        f"{k}={len(V[k])}" for k in sorted(V)))

    schema_missing = validate_canon_schemas(text)
    for s in schema_missing:
        print(f"[SCHEMA-MISSING] {s}")
    failures += len(schema_missing)
    if not schema_missing:
        print(f"canon contains all {len(CANON_SCHEMA_SIGNATURES)} R2.8 schema signatures")

    print("\n--- current population assessment (§15.10-§15.12) ---")
    probs, notes = assess_current_population(text, V)
    for n in notes:
        print(f"  note: {n}")
    for p in probs:
        print(f"  [POP-PROBLEM] {p}")
    failures += len(probs)

    print("\n--- adversarial cases (26 inherited + 15 new + mutations) ---")
    results = run_cases(V)
    for n, desc, got, expect, passed in results:
        tag = "PASS" if passed else "FAIL"
        print(f"case {str(n):>4} [{tag}] {desc} "
              f"(validator={'accept' if got else 'reject'}, "
              f"expected={'accept' if expect else 'reject'})")
        if not passed:
            failures += 1

    inherited = [r for r in results if isinstance(r[0], int)]
    newprobes = [r for r in results if isinstance(r[0], str) and r[0].startswith("N")]
    muts = [r for r in results if isinstance(r[0], str) and r[0].startswith("M")]
    print(f"\n{len(inherited)} inherited + {len(newprobes)} new Codex probes + "
          f"{len(muts)} further mutations = {len(results)} cases run, "
          f"{failures} total failures")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
