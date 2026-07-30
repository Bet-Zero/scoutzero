#!/usr/bin/env python3
"""Architect CBA canon v2.0 — R3.1 A-series document-tree validator.

WHY THIS FILE EXISTS
--------------------
The R2.9 validator was independently REJECTED by Codex. Its defects were
architectural, not cosmetic:

  * The complete 47-row `DR2-…` population was never parsed. A shaped but
    nonexistent `DR2-9999` decision reference produced zero problems.
  * A future migrated R3.1 population was validated through a SEPARATE,
    simulation-only path (`SIM_R31` + `validate_r31_population()`) that never
    inserted anything into a governed document, so the committed-canon path was
    never exercised by a migrated document and a real migrated canon would have
    been rejected for lacking hard-coded "legacy markers".
  * `G15R` declared nine required populations and executed four.
  * `RES-…` acceptance was granted to a repeated-digit SHA that resolves to no
    commit and a receipt path that does not exist, against a digest the maker
    itself wrote.
  * The canon's governing vocabularies and the canonical-actor alias table were
    replaced by hard-coded Python allow-sets and a hard-coded actor-family
    function, so canon edits could not be detected.
  * Fixed population totals (`EXPECT`) simultaneously false-rejected valid
    append-only additions and admitted count-preserving substitutions.

R2.14 ID NORMALIZATION AND STATUS CLOSURE
-----------------------------------------
One document-tree loader, one parser set, one reconciliation engine, one
top-level entry point:

  * `Tree` loads a real governed document tree from a real directory (or from a
    pinned git commit): the canon, the repair plan, and every performing-unit
    receipt. There is no fixture path, no simulated block, and no alternate
    entry point. `validate_tree()` is THE function; the committed baseline,
    every adversarial mutation, every positive control, and the complete
    future-R3.1 migrated document all call it on real files.
  * Every closed vocabulary, pinned schema field list, cross-schema dependency,
    immutable-range anchor, pinned commit, canon-side population section, and
    receipt-side population heading is PARSED from canon §15.9.11 (the governed
    inventory) and reconciled bidirectionally with its governing clause. This
    module contains no vocabulary allow-set, no schema field list, no actor
    family table, and no source hash/size table of its own.
  * One balanced-backtick record-ID normalizer is shared by normal population
    parsing and the whole-canon Inventory-F location audit. Plain IDs and valid
    one-or-more-backtick Markdown code spans therefore receive identical
    membership and location treatment; no population-specific ID list exists.
  * Preservation and conformance are separate duties. Preservation resolves
    every identity committed at the pinned R3 checkpoint COMMIT (loaded through
    the same `Tree` loader at that ref) — so renames, substitutions, drops,
    duplicates, and shifted ranges fail even when counts match. Conformance
    carries no fixed totals — so valid append-only additions above today's
    high-water marks pass.
  * `RES-…` acceptance resolves the maker checkpoint and requires that commit
    to contain exactly one matching proposed/unaccepted RES row at the row's
    governed proposal path. It then resolves a later descendant checker-receipt
    commit, parses exactly one matching ACCEPT row, and binds both blobs to the
    same ID/version/outcome/digest/actor/backlink content. This proves recorded
    content and Git chronology, not actual intellectual independence; the
    independent checker judges authorship and separation.
  * Normalized text lengths are DERIVED from the pinned published v1.1 edition
    at its pinned commit, so a nonexistent scenario, an out-of-range span
    endpoint, and a non-partitioning fragment inventory are all detectable.

No network, no third-party dependency, standard library only. Deterministic
output. The default bounded controls are the mechanical acceptance gate;
`--extended` runs the historical diagnostic library. Neither mode claims to
prove source truth, semantic completeness, or legal persuasiveness.

OWNER-AUTHORIZED SAME-FAMILY DEFERRAL COMPATIBILITY
----------------------------------------------------
The ordinary `deferred` shape still names distinct source/target families.
The sole identical-family exception is mechanical only: a different sibling
fragment must already map to an existing active target in another family, the
source family must map to the named later R4-R6 construction unit, no active
target may exist for the deferred fragment, and the current OWN decision must
carry the canon-pinned sibling/target/family/unit join in its
`Test/tiebreak applied` field. The validator proves those joins. It does not
pretend that a token proves the semantic natural-owner judgment; the
independent checker remains responsible for that judgment.
"""

import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile

# --------------------------------------------------------------------------
# 1. Generic markdown/text helpers (shared by every parser).
# --------------------------------------------------------------------------

DASH = "—"  # em dash: the canon's "empty permitted field" value


def line_range(text, start_prefix, end_prefix):
    """Bytes/chars from the first line beginning with start_prefix to the last
    character before the first later line beginning with end_prefix."""
    lines = text.splitlines(keepends=True)
    start = None
    pos = 0
    offs = []
    for ln in lines:
        offs.append(pos)
        pos += len(ln)
    for i, ln in enumerate(lines):
        if ln.startswith(start_prefix):
            start = i
            break
    if start is None:
        return None
    for j in range(start + 1, len(lines)):
        if lines[j].startswith(end_prefix):
            return text[offs[start]:offs[j]]
    return text[offs[start]:]


def pipe_rows(block):
    """Every '| a | b | ... |' row as a list of stripped cells (header and
    separator rows excluded)."""
    out = []
    for ln in block.splitlines():
        s = ln.strip()
        if not (s.startswith("|") and s.endswith("|") and len(s) > 1):
            continue
        cells = [c.strip() for c in s[1:-1].split("|")]
        if all(set(c) <= set("-: ") for c in cells):
            continue
        out.append(cells)
    return out


def table_after(text, anchor):
    """The contiguous pipe-table block that follows `anchor`."""
    k = text.find(anchor)
    if k < 0:
        return ""
    tail = text[k:]
    rows, started = [], False
    for ln in tail.splitlines():
        s = ln.strip()
        if s.startswith("|") and s.endswith("|"):
            started = True
            rows.append(ln)
        elif started:
            break
    return "\n".join(rows)


def heading_block(text, token):
    """Every markdown heading whose text contains `token`, through the next
    heading of the same or higher level. Returns the concatenated blocks."""
    lines = text.splitlines()
    out, i = [], 0
    while i < len(lines):
        m = re.match(r"^(#{1,6})\s+(.*)$", lines[i])
        if m and token in m.group(2):
            level = len(m.group(1))
            j = i + 1
            while j < len(lines):
                m2 = re.match(r"^(#{1,6})\s+", lines[j])
                if m2 and len(m2.group(1)) <= level:
                    break
                j += 1
            out.append("\n".join(lines[i:j]))
            i = j
        else:
            i += 1
    return "\n\n".join(out)


def backticked(seg):
    return [m.group(1).strip() for m in re.finditer(r"`([^`]+)`", seg)]


def bolded(seg):
    return [m.group(1).strip() for m in re.finditer(r"\*\*([^*]+)\*\*", seg)]


def unspan(cell):
    """Strip exactly one leading and one trailing backtick from a code span."""
    c = cell.strip()
    if len(c) >= 2 and c.startswith("`") and c.endswith("`"):
        return c[1:-1]
    return c


def normalize_record_id_cell(cell):
    """Return a governed record ID from a plain or balanced code-span cell.

    A Markdown record-ID cell may be plain or wrapped by an equal, nonempty
    run of backticks. The record body itself cannot contain a backtick under
    any governed ID grammar. Malformed or unbalanced fencing is left intact,
    so it cannot be silently normalized into a valid ID.
    """
    value = (cell or "").strip()
    match = re.fullmatch(
        r"(?P<fence>`+)(?P<record>[^`\r\n]+)(?P=fence)", value)
    return match.group("record") if match else value


def sha_hex(s):
    if isinstance(s, str):
        s = s.encode("utf-8")
    return hashlib.sha256(s).hexdigest()


def normalize_text(s):
    """The canon's pinned normalization: NFC; strip one leading and one
    trailing whitespace run; collapse whitespace runs to a single space."""
    import unicodedata
    s = unicodedata.normalize("NFC", s)
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def contiguous_from_one(nums, label):
    probs = []
    if len(nums) != len(set(nums)):
        dup = sorted(n for n in set(nums) if nums.count(n) > 1)
        probs.append("%s: duplicate id number(s) %s" % (label, dup))
    if nums:
        lo, hi = min(nums), max(nums)
        if lo != 1:
            probs.append("%s: numbering does not start at 1 (starts at %d)"
                         % (label, lo))
        missing = sorted(set(range(lo, hi + 1)) - set(nums))
        if missing:
            probs.append("%s: gap/skipped id number(s) %s" % (label, missing))
    return probs


def duplicate_numbers(nums, label):
    """Duplicate-only half of ``contiguous_from_one``.

    LEAF, XW2, and EV2 current registers may acquire governed gaps after an
    AMEND split/replacement/removal.  Their historical allocation continuity
    is therefore checked later against the pinned checkpoint plus structured
    lineage; duplicates remain an immediate current-register error.
    """
    dup = sorted(n for n in set(nums) if nums.count(n) > 1)
    return (["%s: duplicate id number(s) %s" % (label, dup)] if dup else [])


# --------------------------------------------------------------------------
# 2. Git access (real commit / blob resolution — no simulation).
# --------------------------------------------------------------------------

_GIT_COMMIT_EXISTS_CACHE = {}
_GIT_BLOB_CACHE = {}
_TREE_REF_CACHE = {}


def _git(root, *args):
    try:
        r = subprocess.run(("git", "-C", root) + args, capture_output=True)
    except OSError:
        return None
    if r.returncode != 0:
        return None
    return r.stdout


def git_repo_root(path):
    out = _git(path, "rev-parse", "--show-toplevel")
    return out.decode().strip() if out else None


def git_commit_exists(root, sha):
    key = (os.path.abspath(root), sha)
    if key not in _GIT_COMMIT_EXISTS_CACHE:
        _GIT_COMMIT_EXISTS_CACHE[key] = \
            _git(root, "cat-file", "-e", sha + "^{commit}") is not None
    return _GIT_COMMIT_EXISTS_CACHE[key]


def git_is_strict_ancestor(root, older, newer):
    """True only when both refs resolve and older is an ancestor of a
    different newer commit."""
    if older == newer or not git_commit_exists(root, older) or \
            not git_commit_exists(root, newer):
        return False
    return _git(root, "merge-base", "--is-ancestor", older, newer) is not None


def git_is_ancestor(root, older, newer):
    """True when both refs resolve and older is an ancestor of or equal to
    newer. A working tree may truthfully pin its current HEAD as the clean
    pre-mutation control tree until the migration changes are committed."""
    if not git_commit_exists(root, older) or not git_commit_exists(root, newer):
        return False
    return _git(root, "merge-base", "--is-ancestor", older, newer) is not None


def git_head(root):
    out = _git(root, "rev-parse", "HEAD")
    return out.decode().strip() if out else None


def git_blob(root, sha, relpath):
    """Bytes of relpath at commit sha, or None if either does not exist."""
    key = (os.path.abspath(root), sha, relpath.replace(os.sep, "/"))
    if key not in _GIT_BLOB_CACHE:
        _GIT_BLOB_CACHE[key] = _git(
            root, "show", "%s:%s" % (sha, key[2]))
    return _GIT_BLOB_CACHE[key]


# --------------------------------------------------------------------------
# 3. The document tree — the ONE loader. Every case uses this.
# --------------------------------------------------------------------------

CANON_REL = os.path.join("docs", "reference", "cba", "ARCHITECT_CBA_CANON.md")
PLAN_REL = os.path.join("work", "architect-completion",
                        "ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md")
RECEIPT_DIR = os.path.join("work", "architect-completion")


class Tree(object):
    """A governed document tree: the canon, the repair plan, and every
    performing-unit receipt, loaded from a working directory or from a pinned
    git commit of the same repository."""

    def __init__(self, root, ref=None):
        self.root = os.path.abspath(root)
        self.ref = ref
        self.repo = git_repo_root(self.root)
        cache_key = ((self.repo or self.root), ref)
        if ref and cache_key in _TREE_REF_CACHE:
            cached = _TREE_REF_CACHE[cache_key]
            self.canon = cached["canon"]
            self.plan = cached["plan"]
            self.receipts = dict(cached["receipts"])
            return
        self.canon = self._read(CANON_REL)
        self.plan = self._read(PLAN_REL)
        self.receipts = {}
        for rel in self._list_receipts():
            txt = self._read(rel)
            if txt is not None:
                self.receipts[rel] = txt
        if ref:
            _TREE_REF_CACHE[cache_key] = {
                "canon": self.canon,
                "plan": self.plan,
                "receipts": dict(self.receipts),
            }

    def _read(self, rel):
        if self.ref:
            b = git_blob(self.repo or self.root, self.ref, rel)
            return b.decode("utf-8") if b is not None else None
        p = os.path.join(self.root, rel)
        if not os.path.isfile(p):
            return None
        with open(p, encoding="utf-8") as fh:
            return fh.read()

    def _list_receipts(self):
        if self.ref:
            out = _git(self.repo or self.root, "ls-tree", "-r", "--name-only",
                       self.ref, RECEIPT_DIR.replace(os.sep, "/") + "/")
            if not out:
                return []
            names = [n for n in out.decode().splitlines() if n.endswith(".md")]
            return sorted(names)
        d = os.path.join(self.root, RECEIPT_DIR)
        if not os.path.isdir(d):
            return []
        return sorted(os.path.join(RECEIPT_DIR, n) for n in os.listdir(d)
                      if n.endswith(".md"))

    # -- receipt-side text, concatenated in deterministic path order
    def receipt_text(self):
        return "\n\n".join(self.receipts[k] for k in sorted(self.receipts))


# --------------------------------------------------------------------------
# 4. The governed inventory (canon §15.9.11) — the sole source of truth.
# --------------------------------------------------------------------------

INV_A = "**Inventory A "
INV_B = "**Inventory B "
INV_C = "**Inventory C "
INV_D = "**Inventory D "
INV_E = "**Inventory E "
INV_F = "**Inventory F "
INV_G = "**Inventory G "
INV_END = "**Preservation versus conformance"
VOCAB_WINDOW = 2000


class Inventory(object):
    def __init__(self):
        self.vocab = {}        # key -> [values]
        self.vocab_anchor = {}
        self.schema = {}       # key -> [fields]
        self.schema_anchor = {}
        self.deps = []         # (dependent, counterpart, rule)
        self.ranges = {}       # key -> (from_prefix, to_prefix, sha)
        self.commits = {}      # key -> sha
        self.sections = {}     # population -> (from_prefix, to_prefix, idre)
        self.headings = {}     # population -> (token, idre)


def parse_inventory(canon):
    """Parse canon §15.9.11. Returns (Inventory, problems)."""
    probs = []
    inv = Inventory()
    if canon is None or INV_A not in canon:
        return inv, ["governed inventory (canon 15.9.11) is MISSING - a "
                     "validator has no admissible source of vocabularies, "
                     "schemas, dependencies, or anchors without it"]

    def block(a, b):
        try:
            return canon[canon.index(a):canon.index(b)]
        except ValueError:
            return ""

    for ln in pipe_rows(block(INV_A, INV_B)):
        if len(ln) != 3 or not ln[0].startswith("`"):
            continue
        key, anc = unspan(ln[0]), unspan(ln[1])
        vals = [unspan(v) for v in ln[2].split(", ")]
        inv.vocab[key] = vals
        inv.vocab_anchor[key] = anc
    for ln in pipe_rows(block(INV_B, INV_C)):
        if len(ln) != 4 or not ln[0].startswith("`"):
            continue
        key, anc = unspan(ln[0]), unspan(ln[1])
        try:
            cnt = int(ln[2])
        except ValueError:
            continue
        fields = [f.strip() for f in unspan(ln[3]).split(";")]
        if len(fields) != cnt:
            probs.append("inventory B %s: Count %d != %d listed fields"
                         % (key, cnt, len(fields)))
        inv.schema[key] = fields
        inv.schema_anchor[key] = anc
    for ln in pipe_rows(block(INV_C, INV_D)):
        if len(ln) != 3 or not ln[0].startswith("`"):
            continue
        inv.deps.append((unspan(ln[0]), unspan(ln[1]), ln[2]))
    for ln in pipe_rows(block(INV_D, INV_E)):
        if len(ln) != 4 or not ln[0].startswith("`"):
            continue
        inv.ranges[unspan(ln[0])] = (unspan(ln[1]), unspan(ln[2]),
                                     unspan(ln[3]))
    for ln in pipe_rows(block(INV_E, INV_F)):
        if len(ln) != 3 or not ln[0].startswith("`"):
            continue
        inv.commits[unspan(ln[0])] = unspan(ln[1])
    for ln in pipe_rows(block(INV_F, INV_G)):
        if len(ln) != 4 or not ln[0].startswith("`"):
            continue
        inv.sections[unspan(ln[0])] = (unspan(ln[1]), unspan(ln[2]),
                                       unspan(ln[3]))
    for ln in pipe_rows(block(INV_G, INV_END)):
        if len(ln) != 3 or not ln[0].startswith("`"):
            continue
        inv.headings[unspan(ln[0])] = (unspan(ln[1]), unspan(ln[2]))

    for name, d in (("A vocabularies", inv.vocab), ("B schemas", inv.schema),
                    ("D ranges", inv.ranges), ("E commits", inv.commits),
                    ("F sections", inv.sections), ("G headings", inv.headings)):
        if not d:
            probs.append("governed inventory %s is empty or unparseable" % name)
    if not inv.deps:
        probs.append("governed inventory C dependencies is empty or "
                     "unparseable")
    return inv, probs


def reconcile_inventory(canon, inv):
    """Bidirectional inventory <-> governing-clause reconciliation, by the
    exact procedure canon 15.9.11 rule 2 pins."""
    probs = []
    try:
        body = canon[:canon.index(INV_A)] + canon[canon.index(INV_END):]
    except ValueError:
        return ["governed inventory block boundaries not found"]

    for key, anc in sorted(inv.vocab_anchor.items()):
        if "`" in anc or "|" in anc or anc != anc.strip():
            probs.append("inventory A %s: anchor is not a clean code span" % key)
            continue
        n = body.count(anc)
        if n != 1:
            probs.append("inventory A %s: anchor resolves %d times outside the "
                         "inventory (must be exactly 1)" % (key, n))
            continue
        k = canon.find(anc)
        win = canon[k:k + VOCAB_WINDOW]
        toks = set(backticked(win)) | set(bolded(win))
        joined = ", ".join(inv.vocab[key])
        for v in inv.vocab[key]:
            if v not in toks and joined not in toks:
                probs.append("inventory A %s: value %r is not declared by its "
                             "governing clause (inventory/clause divergence)"
                             % (key, v))

    for key, anc in sorted(inv.schema_anchor.items()):
        if "`" in anc or "|" in anc or anc != anc.strip():
            probs.append("inventory B %s: anchor is not a clean code span" % key)
            continue
        n = body.count(anc)
        if n != 1:
            probs.append("inventory B %s: anchor resolves %d times outside the "
                         "inventory (must be exactly 1)" % (key, n))
            continue
        k = canon.find(anc)
        m = re.search(r"`([^`]*\|[^`]*)`", canon[k:])
        if not m:
            probs.append("inventory B %s: governing clause carries no pinned "
                         "schema string at its anchor" % key)
            continue
        got = [f.strip() for f in m.group(1).split("|")]
        if got != inv.schema[key]:
            probs.append("inventory B %s: pinned schema string does not match "
                         "the inventory field list (governing field "
                         "added/removed/reordered)" % key)

    # Cross-schema dependencies: both sides must exist in their own schema.
    for dep, counterpart, _rule in inv.deps:
        for side in (dep, counterpart):
            if "." not in side:
                continue  # a bare vocabulary key
            skey, field = side.split(".", 1)
            if skey not in inv.schema:
                probs.append("inventory C: unknown schema %r in dependency %r"
                             % (skey, side))
            elif field not in inv.schema[skey]:
                probs.append("inventory C: %s.%s is required by dependency "
                             "%r -> %r but that field is absent from the pinned "
                             "schema (dependency broken by a schema weakening)"
                             % (skey, field, dep, counterpart))
        if "." not in counterpart and counterpart not in inv.vocab:
            probs.append("inventory C: unknown vocabulary %r in dependency %r"
                         % (counterpart, dep))
    return probs


# --------------------------------------------------------------------------
# 6. Population parsing — inventory-driven, one code path for every source.
# --------------------------------------------------------------------------


def _table_header(block):
    """The rendered header cells of the first pipe table in `block`."""
    for ln in block.splitlines():
        s = ln.strip()
        if s.startswith("|") and s.endswith("|") and len(s) > 1:
            cells = [c.strip() for c in s[1:-1].split("|")]
            if not all(set(c) <= set("-: ") for c in cells):
                return cells
    return None


def parse_canon_population(canon, inv, key):
    """Rows of a canon-side population, per Inventory F. Returns
    (header, rows, problems). Rows are taken at the RENDERED header's arity so
    that identities and references still resolve in a population whose header
    has not yet been migrated to the pinned schema; the header/schema
    divergence is reported separately as a migration-state nonconformity."""
    if key not in inv.sections:
        return None, [], ["inventory F carries no section for population %r"
                          % key]
    frm, to, idre = inv.sections[key]
    seg = line_range(canon, frm, to)
    if seg is None:
        return None, [], []
    header = _table_header(seg)
    want = len(header) if header else len(inv.schema.get(key, []))
    rows, probs = [], []
    for r in pipe_rows(seg):
        if not r or not re.fullmatch(idre, normalize_record_id_cell(r[0])):
            continue
        if len(r) != want:
            probs.append("%s %s: row has %d fields, the table header declares "
                         "%d (malformed row)" % (key, r[0], len(r), want))
            continue
        rows.append([c.strip() for c in r])
    return header, rows, probs


def parse_canon_population_by_exact_header(canon, inv, key):
    """Historical-table fallback for checkpoints predating Inventory F.

    The fallback is still population-scoped: it admits rows only from a
    Markdown table whose rendered header exactly equals the currently pinned
    schema and whose first cells match this population's Inventory-F grammar.
    It never searches arbitrary prose or arbitrary pipe rows for shaped IDs.
    """
    expected = inv.schema.get(key)
    declaration = inv.sections.get(key)
    if not expected or not declaration:
        return None, [], []
    matcher = re.compile(r"^(?:%s)$" % declaration[2])
    lines = (canon or "").splitlines()
    matching_tables = []

    def cells_of(line):
        stripped = line.strip()
        if not (stripped.startswith("|") and stripped.endswith("|")):
            return None
        return [cell.strip() for cell in stripped[1:-1].split("|")]

    for index, line in enumerate(lines[:-1]):
        cells = cells_of(line)
        if cells != expected:
            continue
        delimiter = cells_of(lines[index + 1])
        if delimiter is None or len(delimiter) != len(expected) or not all(
                re.fullmatch(r":?-{3,}:?", cell) for cell in delimiter):
            continue
        rows = []
        cursor = index + 2
        while cursor < len(lines):
            row = cells_of(lines[cursor])
            if row is None:
                break
            if len(row) == len(expected) and matcher.fullmatch(
                    normalize_record_id_cell(row[0])):
                rows.append([cell.strip() for cell in row])
            cursor += 1
        if rows:
            matching_tables.append(rows)
    if len(matching_tables) > 1:
        return expected, [], [
            "%s: exact pinned header resolves to %d populated historical "
            "tables" % (key, len(matching_tables))]
    return (expected, matching_tables[0], []) if matching_tables \
        else (expected, [], [])


def check_canon_population_locations(canon, inv):
    """Reject governed-ID pipe rows outside Inventory F's declared ranges.

    Inventory F is the only population list. A row may match more than one
    population grammar (all SRC2 base/detail populations intentionally share
    one), so location admission is the union of every matching declaration's
    interval. The normal per-range parsers still enforce the exact schema and
    base-type/detail-location reconciliation inside that union.
    """
    lines = canon.splitlines()
    declarations = []
    for population, (start_prefix, end_prefix, id_pattern) in sorted(
            inv.sections.items()):
        matcher = re.compile(r"^(?:%s)$" % id_pattern)
        start = next((i for i, line in enumerate(lines)
                      if line.startswith(start_prefix)), None)
        end = None
        if start is not None:
            end = next((i for i in range(start + 1, len(lines))
                        if lines[i].startswith(end_prefix)), len(lines))
        declarations.append({
            "population": population,
            "start_prefix": start_prefix,
            "end_prefix": end_prefix,
            "matcher": matcher,
            "start": start,
            "end": end,
        })

    problems = []
    for line_index, line in enumerate(lines):
        stripped = line.strip()
        if not (stripped.startswith("|") and stripped.endswith("|")
                and len(stripped) > 1):
            continue
        first = stripped[1:-1].split("|", 1)[0].strip()
        record_id = normalize_record_id_cell(first)
        matching = [d for d in declarations
                    if d["matcher"].fullmatch(record_id)]
        if not matching:
            continue
        if any(d["start"] is not None
               and d["start"] <= line_index < d["end"] for d in matching):
            continue
        permitted = "; ".join(
            "%s [%s -> %s]" % (
                d["population"], d["start_prefix"], d["end_prefix"])
            for d in matching)
        problems.append(
            "governed location %s: pipe row at canon line %d is outside "
            "every matching Inventory F range; permitted population/range(s): "
            "%s" % (record_id, line_index + 1, permitted))
    return problems


def parse_receipt_population(tree, inv, key):
    """Rows of a receipt-side support population, per Inventory G."""
    if key not in inv.headings:
        return None, [], ["inventory G carries no heading for population %r"
                          % key]
    token, idre = inv.headings[key]
    header, rows, probs = None, [], []
    for path in sorted(tree.receipts):
        blk = heading_block(tree.receipts[path], token)
        if not blk:
            continue
        h = _table_header(blk)
        if h and header is None:
            header = h
        want = len(h) if h else len(inv.schema.get(key, []))
        for r in pipe_rows(blk):
            if not r or not re.fullmatch(
                    idre, normalize_record_id_cell(r[0])):
                continue
            if len(r) != want:
                probs.append("%s %s (%s): row has %d fields, the table header "
                             "declares %d (malformed row)"
                             % (key, r[0], os.path.basename(path), len(r), want))
                continue
            rows.append([c.strip() for c in r])
    return header, rows, probs


# --------------------------------------------------------------------------
# 7. Pinned published v1.1 derivations (real normalized text lengths).
# --------------------------------------------------------------------------


class Published(object):
    """The frozen v1.1 edition at its pinned commit: published LEAF requirement
    texts and scenarios 1-89, with their pinned normalized lengths."""

    def __init__(self, repo, sha):
        self.ok = False
        self.leaf_len = {}
        self.leaf_authority = {}
        self.scenario_len = {}
        if not repo or not sha or not git_commit_exists(repo, sha):
            return
        b = git_blob(repo, sha, CANON_REL)
        if b is None:
            return
        txt = b.decode("utf-8")
        # Resolve historical requirement text only from the exact v1.1 LEAF
        # register.  The same top-level IDs also occur in the hierarchy table,
        # whose fourth cell is the marker "*(top-level leaf)*"; a whole-file
        # setdefault scan would mistake that marker for the governed condition.
        leaf_register = line_range(
            txt, "### 15.7 Index amendment — LEAF register (v1.1)",
            "### 15.8 Index amendment — coverage, methods, and non-code "
            "dispositions (v1.1)")
        duplicate_leaves = set()
        if leaf_register:
            for row in pipe_rows(leaf_register):
                if len(row) != 7 or not re.fullmatch(
                        r"CBA-[A-Z][0-9]{2}(?:\.[0-9]+)?", row[0]):
                    continue
                if row[0] in self.leaf_len:
                    duplicate_leaves.add(row[0])
                    continue
                self.leaf_len[row[0]] = len(normalize_text(row[3]))
                self.leaf_authority[row[0]] = normalize_text(row[4])
        seg = line_range(txt, "## 16. Acceptance-test library",
                         "## 17. Recommended comparison sequence")
        if seg:
            for m in re.finditer(r"(?m)^(\d+)\.\s+(.*)$", seg):
                self.scenario_len[int(m.group(1))] = len(
                    normalize_text(m.group(2)))
        self.ok = (bool(self.leaf_len) and not duplicate_leaves
                   and len(self.scenario_len) == 89)


# --------------------------------------------------------------------------
# 8. Scope-atom machinery (single-coordinate span domain).
# --------------------------------------------------------------------------


def span_atoms(scope):
    """Parse a normalized scope into (atoms, problems). Atoms are half-open
    (a, b) character ranges; an optional @label is annotation only."""
    atoms, probs = [], []
    s = (scope or "").strip()
    if not s or s == DASH:
        return atoms, ["empty scope"]
    for tok in [t.strip() for t in s.split(";") if t.strip()]:
        core = tok.split("@", 1)[0].strip().strip("`")
        m = re.fullmatch(r"span:(\d+)-(\d+)", core)
        if not m:
            probs.append("malformed scope atom %r (only span:<a>-<b> exists)"
                         % tok)
            continue
        a, b = int(m.group(1)), int(m.group(2))
        if a >= b:
            probs.append("empty/reversed scope atom %r" % tok)
        else:
            atoms.append((a, b))
    return atoms, probs


def merge_spans(atoms):
    out = []
    for a, b in sorted(atoms):
        if out and a <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], b))
        else:
            out.append((a, b))
    return [tuple(x) for x in out]


def spans_equal(x, y):
    return merge_spans(x) == merge_spans(y)


def spans_overlap(atoms):
    s = sorted(atoms)
    for i in range(1, len(s)):
        if s[i][0] < s[i - 1][1]:
            return True
    return False


def edge_scope_atoms(edge):
    """The normalized span set embedded after an edge's leading fragment."""
    cell = re.sub(r"^\[[^\]]*\]\s*", "", edge.get("scope", "")).strip()
    m = re.search(r"span:\d+-\d+(?:@[^\s;|]*)?(?:;\s*span:\d+-\d+"
                  r"(?:@[^\s;|]*)?)*", cell)
    if not m:
        return [], ["edge %s carries no parseable span scope" % edge["id"]]
    return span_atoms(m.group(0))


def exact_ref_list(cell, pattern, label, allow_dash=True):
    """Parse an exact ', '-separated reference list with no prose."""
    raw = (cell or "").strip().strip("`")
    if allow_dash and raw == DASH:
        return [], []
    if not raw:
        return [], ["%s: blank reference field" % label]
    refs = raw.split(", ")
    probs = []
    if any(not re.fullmatch(pattern, r) for r in refs):
        probs.append("%s: field is not an exact comma-separated reference "
                     "list: %r" % (label, raw))
    if len(refs) != len(set(refs)):
        probs.append("%s: duplicate reference(s)" % label)
    natural = lambda value: [
        int(part) if part.isdigit() else part
        for part in re.split(r"(\d+)", value)]
    if refs != sorted(refs, key=natural):
        probs.append("%s: references are not ascending" % label)
    return refs, probs


def partition_problems(atoms, length, label):
    """The union must equal exactly [0, length) with no overlap."""
    probs = []
    if spans_overlap(atoms):
        probs.append("%s: overlapping spans (not a partition)" % label)
    merged = merge_spans(atoms)
    if length is not None:
        for a, b in atoms:
            if b > length:
                probs.append("%s: span endpoint %d exceeds the normalized text "
                             "length %d (impossible coordinate)"
                             % (label, b, length))
        if merged != [(0, length)]:
            probs.append("%s: fragments do not partition exactly [0,%d) "
                         "(gap or uncovered residual; merged=%s)"
                         % (label, length, merged))
    elif len(merged) > 1:
        probs.append("%s: fragment spans are not contiguous from 0 (gap)"
                     % label)
    elif merged and merged[0][0] != 0:
        probs.append("%s: fragment spans do not start at 0" % label)
    return probs


# --------------------------------------------------------------------------
# 9. Source-date grammars.
# --------------------------------------------------------------------------


def is_real_date(v):
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", v or "")
    if not m:
        return False
    y, mo, d = map(int, m.groups())
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return False
    leap = y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
    dim = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return d <= dim[mo - 1]


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
        wm = re.fullmatch(r"(\d{4}-\d{2}-\d{2})/(\d{4}-\d{2}-\d{2}|open)",
                          value or "")
        if wm:
            a, b = wm.group(1), wm.group(2)
            if b == "open":
                return is_real_date(a)
            return is_real_date(a) and is_real_date(b) and a < b
        return is_month(value)
    return False


def is_utc_timestamp(v):
    m = re.fullmatch(
        r"(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})Z", v or "")
    return bool(m) and is_real_date(m.group(1)) and \
        0 <= int(m.group(2)) <= 23 and 0 <= int(m.group(3)) <= 59 and \
        0 <= int(m.group(4)) <= 59


def is_absolute_http_url(v):
    value = (v or "").strip().strip("`")
    if value.startswith("<") and value.endswith(">"):
        value = value[1:-1]
    return bool(re.fullmatch(r"https?://[^\s<>]+", value))


# --------------------------------------------------------------------------
# 10. Governing repair-plan facts.
# --------------------------------------------------------------------------


def plan_section(plan, start, end):
    seg = line_range(plan or "", start, end)
    return seg or ""


def replace_plan_section_status(plan, start, end, status):
    """Replace one governed plan section's parseable Status field."""
    seg = plan_section(plan, start, end)
    match = re.search(
        r"(?m)^- \*\*Status:\*\*\s*(.*(?:\n(?!- \*\*).*)*)", seg)
    if not seg or not match:
        raise AssertionError("plan section %r has no parseable Status field"
                             % start)
    replacement = "- **Status:** " + status
    revised = seg[:match.start()] + replacement + seg[match.end():]
    return plan.replace(seg, revised, 1)


def parse_migration_state(plan):
    """'pre-R3.1' while the plan states R3.1 has not started; 'post-R3.1' once
    it states R3.1 executed. This governed switch replaces the R2.9
    hard-coded 'legacy marker' list."""
    seg = plan_section(plan, "## R3.1 ", "## R4 ")
    m = re.search(r"(?m)^- \*\*Status:\*\*\s*(.*(?:\n(?!- \*\*).*)*)", seg)
    status = m.group(1) if m else ""
    if (re.search(r"independently\s+\*\*ACCEPTED\*\*", status, re.I)
            or re.search(r"executed", status, re.I)):
        return "post-R3.1"
    if re.search(r"R3\.1.{0,120}not started", status, re.I | re.S):
        return "pre-R3.1"
    return "unknown"


CONTROL_TREE_FIELD = "Accepted-status control tree"


def parse_accepted_status_control_tree(plan):
    """Return the compatibility section's sole full-SHA control-tree field.

    ``None`` means the field is absent, duplicated, or not an exact
    forty-character lowercase commit ID.
    """
    compat = plan_section(
        plan,
        "## One-time pre-R3.1 foundation-compatibility checkpoint",
        "## R3.1 ")
    rows = re.findall(
        r"(?m)^- \*\*%s:\*\*\s*`([^`]+)`" % re.escape(CONTROL_TREE_FIELD),
        compat)
    if len(rows) != 1 or not re.fullmatch(r"[0-9a-f]{40}", rows[0]):
        return None
    return rows[0]


def set_accepted_status_control_tree(plan, commit):
    """Set or add the governed control-tree pointer in a synthetic plan."""
    line = "- **%s:** `%s`." % (CONTROL_TREE_FIELD, commit)
    pattern = (
        r"(?m)^- \*\*%s:\*\*\s*`[^`]+`\.[^\n]*(?:\n"
        r"  (?!- \*\*).*)*" % re.escape(CONTROL_TREE_FIELD))
    if re.search(pattern, plan or ""):
        return re.sub(pattern, line, plan, count=1)
    compat = plan_section(
        plan,
        "## One-time pre-R3.1 foundation-compatibility checkpoint",
        "## R3.1 ")
    status = re.search(r"(?m)^- \*\*Status:\*\*.*$", compat)
    if not compat or not status:
        raise AssertionError(
            "compatibility section has no Status anchor for control pointer")
    revised = (compat[:status.end()] + "\n" + line
               + compat[status.end():])
    return plan.replace(compat, revised, 1)


def check_accepted_status_control_tree(tree):
    """Require a resolvable governed pre-R3.1 control-tree ancestor."""
    compat = plan_section(
        tree.plan,
        "## One-time pre-R3.1 foundation-compatibility checkpoint",
        "## R3.1 ")
    raw = re.findall(
        r"(?m)^- \*\*%s:\*\*\s*`([^`]+)`" % re.escape(CONTROL_TREE_FIELD),
        compat)
    if len(raw) != 1:
        return [
            "plan accepted-status control tree: expected exactly one governed "
            "full-commit field, found %d" % len(raw)]
    commit = raw[0]
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        return [
            "plan accepted-status control tree: %r is not an exact "
            "forty-character lowercase commit ID" % commit]
    repo = tree.repo or tree.root
    if not git_commit_exists(repo, commit):
        return [
            "plan accepted-status control tree: commit %s does not resolve"
            % commit]
    current = tree.ref or git_head(repo)
    if not current or not git_is_ancestor(repo, commit, current):
        return [
            "plan accepted-status control tree: commit %s is not an ancestor "
            "of the validated tree" % commit]
    return []


def r8_has_started(plan):
    """The live plan must expose R8 execution before its zero-deferral gate."""
    seg = plan_section(plan, "## R8 ", "## R9 ")
    match = re.search(
        r"(?m)^- \*\*Status:\*\*\s*(.*(?:\n(?!- \*\*).*)*)", seg)
    status = match.group(1) if match else ""
    return bool(re.search(r"\b(?:executed|complete|in progress|started)\b",
                          status, re.I))


def plan_route_field(section, *labels):
    """Return one named R5-R9 route field without depending on its prose."""
    for label in labels:
        match = re.search(
            r"(?ms)^- \*\*(%s):\*\*\s*(.*?)"
            r"(?=^- \*\*|^\*\*|^#{2,6} |\Z)" % re.escape(label),
            section)
        if match:
            return match.group(2).strip()
    return ""


def replace_plan_route_field(plan, start, end, label, replacement):
    """Replace one named route field for a bounded negative control."""
    section = plan_section(plan, start, end)
    match = re.search(
        r"(?ms)^- \*\*(%s):\*\*\s*(.*?)"
        r"(?=^- \*\*|^\*\*|^#{2,6} |\Z)" % re.escape(label),
        section)
    if not section or not match:
        raise AssertionError(
            "plan section %r has no parseable %s route field"
            % (start, label))
    revised = (
        section[:match.start()]
        + "- **%s:** %s\n" % (match.group(1), replacement.strip())
        + section[match.end():])
    return plan.replace(section, revised, 1)


def route_text(value):
    """Normalize Markdown decoration and wrapping for semantic route checks."""
    return re.sub(r"\s+", " ", re.sub(r"[`*_]+", "", value or "")).lower()


def route_names_unit(value, unit):
    """Recognize a named unit, including the governed R4-R6 shorthand."""
    text = route_text(value)
    token = unit.lower()
    if re.search(r"\b%s\b" % re.escape(token), text):
        return True
    return token == "r5" and bool(
        re.search(r"\br4\s*[–—-]\s*r6\b", text))


def route_has_independent_acceptance(value, *units):
    """A prerequisite names every unit and independent ACCEPT/acceptance."""
    text = route_text(value)
    return (
        all(route_names_unit(text, unit) for unit in units)
        and "independent" in text
        and bool(re.search(r"\baccept(?:ed|ance)?\b", text))
        and not re.search(
            r"\b(?:without|omit(?:s|ted)?|not require[ds]?)\b.{0,80}"
            r"\bindependent\b.{0,50}\baccept", text))


def route_has_completed_unit(value, unit):
    """A dependency positively requires a completed unit."""
    text = route_text(value)
    if not route_names_unit(text, unit):
        return False
    if re.search(
            r"\b(?:without|omit(?:s|ted)?|not require[ds]?|need not)\b"
            r".{0,80}\b%s\b.{0,50}\bcomplet" % re.escape(unit.lower()),
            text):
        return False
    if re.search(r"\b%s\b.{0,40}\b(?:incomplete|still in progress)\b"
                 % re.escape(unit.lower()), text):
        return False
    return bool(re.search(r"\b%s\b.{0,60}\bcomplet(?:e|ed|ion)\b"
                          % re.escape(unit.lower()), text)
                or re.search(r"\bcomplet(?:e|ed|ion)\b.{0,60}\b%s\b"
                             % re.escape(unit.lower()), text))


def route_has_standalone_r7_exclusion(value):
    """The current route must expressly bar a separate R7 acceptance pass."""
    text = route_text(value)
    return (
        route_names_unit(text, "r7")
        and "standalone" in text
        and "independent" in text
        and bool(re.search(r"\b(?:accept|checker|review|pass)", text))
        and bool(re.search(
            r"\b(?:no|without|not required|not authorized)\b.{0,100}"
            r"\bstandalone\b", text)))


def route_affirmatively_requires_standalone_r7(section):
    """Reject a positive standalone-R7-checker route, but not its exclusion."""
    blocks = re.split(r"\n\n+|(?=^- \*\*)", section, flags=re.M)
    for block in blocks:
        text = route_text(block)
        if not route_names_unit(text, "r7"):
            continue
        if re.search(
                r"\b(?:no|without|not required|not authorized)\b.{0,100}"
                r"\bstandalone\b", text):
            continue
        if re.search(r"\bindependently accepted r7\b", text):
            return True
        if ("independent" in text
                and re.search(r"\b(?:checker|acceptance|review)\b", text)
                and re.search(
                    r"\b(?:must|require[ds]?|receives?|before r8)\b", text)):
            return True
    return False


def current_r7_r9_route(r7):
    """True only for the approved completed-R7/no-standalone-checker route."""
    return bool(re.search(
        r"\br7 execution status\b.{0,100}\bcomplete\b",
        route_text(r7)))


def check_plan(plan):
    probs = []
    if plan is None:
        return ["repair plan is MISSING - the governing repair plan is a "
                "required input and cannot be absent"]
    r31 = plan_section(plan, "## R3.1 ", "## R4 ")
    for n in range(1, 28):
        if not re.search(r"(?m)^\s*%d\.\s" % n, r31):
            probs.append("plan backlog: item %d missing" % n)
    if re.search(r"require . items 16.21; nothing else\):", plan):
        probs.append("plan backlog header still asserts 'items 16-21; nothing "
                     "else' while items 22-27 follow (false completeness)")
    if not re.search(r"complete R3\.1 backlog is items 1.27", plan):
        probs.append("plan backlog header does not state the truthful complete "
                     "range items 1-27")

    r4 = plan_section(plan, "## R4 ", "## R5 ")
    r4_flat = re.sub(r"\s+", " ", r4)
    if re.search(r"\*\*independently accepted\s+R2\.[789] foundation\*\*", r4):
        probs.append("plan R4 dependency still requires an accepted R2.7/R2.8/"
                     "R2.9 foundation (each was independently rejected)")
    if ("R2.14 foundation accepted under current goal authority"
            not in r4_flat
            or "independently accepted pre-R3.1 compatibility checkpoint"
            not in r4_flat
            or "independently accepted owner-authorized same-family "
               "deferral compatibility checkpoint" not in r4_flat):
        probs.append("plan R4 dependency does not require both the goal-"
                     "accepted R2.14 foundation and both independently "
                     "accepted compatibility checkpoints")
    if not re.search(
            r"R2\.14 accepted . compatibility checkpoint . checker . "
            r"same-family compatibility checkpoint . checker . R3\.1 . "
            r"checker . R4 . checker . R5 . checker . R6", r4_flat):
        probs.append("plan R4 construction sequence omits a maker/checker "
                     "checkpoint between sequential construction units")

    m25 = re.search(r"(?ms)^\s*25\.\s.*?(?=^\s*26\.\s)", r31)
    seg25 = m25.group(0) if m25 else ""
    if not seg25:
        probs.append("plan item 25 not found")
    else:
        if not re.search(r"neither\s+support.*?nor.*?create or clear", seg25,
                         re.S):
            probs.append("plan item 25 does not bar inadequate coverage from "
                         "creating/clearing a blocked outcome")

    m23 = re.search(r"(?ms)^\s*23\.\s.*?(?=^\s*24\.\s)", r31)
    seg23 = m23.group(0) if m23 else ""
    if not seg23:
        probs.append("plan item 23 not found")
    else:
        if re.search(r"normalized-scope atoms\s+\(clause/sentence\s+"
                     r"coordinates\)", seg23):
            probs.append("plan item 23 still orders the abolished "
                         "clause/sentence coordinate model, contradicting the "
                         "canon's sole span:<a>-<b> domain")
        if "span:<a>-<b>" not in seg23:
            probs.append("plan item 23 does not order the sole "
                         "span:<a>-<b> text-span grammar")
        if "Member subject scopes" not in seg23:
            probs.append("plan item 23 does not carry the BND member "
                         "sub-scope coverage duty")
        if "Historical authority qualifier or —" not in seg23:
            probs.append("plan item 23 does not carry the historical-fragment "
                         "authority qualifier migration duty")
        if "`deferred`" not in seg23 or "resolving-unit" not in seg23:
            probs.append("plan item 23 does not carry the governed "
                         "deferred-edge migration duty")
        if ("same-family-sibling:<XW2-edge>-><active-v2-LEAF>"
                not in seg23
                or "`Test/tiebreak applied` field" not in seg23):
            probs.append("plan item 23 does not pin the same-family sibling "
                         "join to the current OWN Test/tiebreak applied field")

    m14 = re.search(r"(?ms)^\s*14\.\s.*?(?=^\s*15\.\s)", r31)
    seg14 = m14.group(0) if m14 else ""
    if not seg14:
        probs.append("plan item 14 not found")
    else:
        required_item14 = (
            "underlying governed GROUP/LEAF/SRC2/EV2/DR2 records",
            "untyped live canon/plan status prose",
            "immutable receipt assertions",
            "never fabricate an `AMEND` row for free prose",
        )
        if any(phrase not in re.sub(r"\s+", " ", seg14)
               for phrase in required_item14):
            probs.append("plan item 14 does not distinguish governed-record "
                         "AMEND lineage from direct live-prose correction and "
                         "immutable-receipt contradiction")

    m24 = re.search(r"(?ms)^\s*24\.\s.*?(?=^\s*25\.\s)", r31)
    seg24 = m24.group(0) if m24 else ""
    if not seg24:
        probs.append("plan item 24 not found")
    else:
        if "Artifact byte size" not in seg24:
            probs.append("plan item 24 does not carry the SRC2 Artifact byte "
                         "size migration duty")
        if not re.search(r"SM2 . current-`SRC2` reconciliation", seg24):
            probs.append("plan item 24 does not explicitly carry the complete "
                         "SM2 <-> current-SRC2 reconciliation duty")

    if not re.search(r"R2\.9\s*\n?\s*\(executed; rejected\)|R2\.9 is\s*\n?\s*"
                     r"\*\*rejected\*\*|R2\.9 \(rejected\)", plan):
        probs.append("plan does not state the truthful sequence including the "
                     "rejected R2.9 checkpoint")
    if parse_migration_state(plan) == "unknown":
        probs.append("plan R3.1 status is not parseable (neither 'not started' "
                     "nor 'executed')")

    r213 = plan_section(plan, "## R2.13 ", "## R2.14 ")
    if ("818a5d03accbebfec810521a49ef9554ca4f79fa" not in r213
            or not re.search(r"independently \*\*REJECTED/BLOCK-R3\.1\*\*",
                             r213)):
        probs.append("plan does not preserve the exact rejected R2.13 "
                     "checkpoint and independent verdict")

    r214 = plan_section(plan, "## R2.14 ", "## R3.1 ")
    for phrase in ("Authorized files (exact)", "Shared ID normalizer",
                   "Validator gate", "Truthful status", "Preservation",
                   "Explicit exclusions"):
        if phrase not in r214:
            probs.append("plan R2.14 omits required ID-normalization/status "
                         "control %r" % phrase)
    r214_flat = re.sub(r"\s+", " ", r214)
    if ("accepted as settled by the current goal objective authority"
            not in r214_flat
            or not re.search(
                r"R2\.14 accepted under current goal authority . "
                r"(?:one-time pre-R3\.1 foundation-)?compatibility maker "
                r"checkpoint . independent compatibility checker ACCEPT . "
                r"owner-authorized same-family deferral compatibility maker "
                r"checkpoint . independent same-family compatibility checker "
                r"ACCEPT . R3\.1 maker checkpoint . independent R3\.1 "
                r"checker ACCEPT",
                r214_flat)):
        probs.append("plan R2.14/compatibility/R3.1 live maker-checker "
                     "sequence is incomplete")

    migration = parse_migration_state(plan)
    compat = plan_section(
        plan,
        "## One-time pre-R3.1 foundation-compatibility checkpoint",
        "## Owner-authorized same-family deferral compatibility checkpoint")
    compat_flat = re.sub(r"\s+", " ", compat)
    for phrase in (
            "not an R2.x unit and not substantive R3.1 migration",
            "Every earlier receipt and every active §15.10–§15.12 row remains "
            "immutable",
            "ARCHITECT_CBA_CANON_V2_R3_1_COMPATIBILITY_CHECKPOINT.md"):
        if phrase not in compat_flat:
            probs.append("plan compatibility checkpoint omits required live "
                         "status/route control %r" % phrase)
    same_compat = plan_section(
        plan,
        "## Owner-authorized same-family deferral compatibility checkpoint",
        "## R3.1 ")
    same_flat = re.sub(r"\s+", " ", same_compat)
    for phrase in (
            "not an R2.x unit and not substantive R3.1 migration",
            "ARCHITECT_CBA_CANON_V2_R3_1_SAME_FAMILY_DEFERRAL_COMPATIBILITY.md",
            "same-family-sibling:<XW2-edge>-><active-v2-LEAF>",
            "`Test/tiebreak applied` field",
            "Mechanical validation proves",
            "independent checker judges"):
        if phrase not in same_flat:
            probs.append("plan same-family compatibility checkpoint omits "
                         "required contract %r" % phrase)
    if migration == "pre-R3.1":
        accepted = "independently **ACCEPTED** before R3.1 construction" \
            in compat_flat
        same_pending = (
            "pending independent same-family compatibility checker review "
            "and not accepted" in same_flat)
        same_accepted = (
            "independently **ACCEPTED** before R3.1 construction"
            in same_flat)
        r31_flat = re.sub(r"\s+", " ", r31)
        if not accepted:
            probs.append(
                "pre-R3.1 plan does not preserve independent acceptance of "
                "the first compatibility checkpoint")
        if same_pending == same_accepted:
            probs.append(
                "pre-R3.1 plan must record exactly one same-family "
                "compatibility state: pending/not accepted or independently "
                "ACCEPTED")
        elif same_pending:
            if ("R3.1 remains blocked" not in same_flat
                    or "R3.1 remains blocked and not started" not in r31_flat):
                probs.append(
                    "pending same-family compatibility state does not keep "
                    "R3.1 blocked on an independent checker ACCEPT")
        elif same_accepted:
            if ("R3.1 is now unblocked and is the next construction unit"
                    not in same_flat
                    or "not started" not in r31_flat
                    or "R3.1 is unblocked and is the next construction unit"
                       not in r31_flat):
                probs.append(
                    "accepted same-family compatibility state does not "
                    "record the checker ACCEPT and truthful unblocked/"
                    "not-started R3.1 route")
    elif migration == "post-R3.1":
        if ("independently **ACCEPTED** before R3.1 execution"
                not in compat_flat
                or "R3.1 proceeded only after an independent compatibility "
                   "checker returned ACCEPT" not in compat_flat):
            probs.append(
                "post-R3.1 plan does not record independent compatibility-"
                "checkpoint ACCEPT before R3.1 execution")
        if ("independently **ACCEPTED** before R3.1 execution"
                not in same_flat
                or "R3.1 proceeded only after an independent same-family "
                   "compatibility checker returned ACCEPT" not in same_flat):
            probs.append(
                "post-R3.1 plan does not record independent same-family "
                "compatibility-checkpoint ACCEPT before R3.1 execution")
        if ("pending independent compatibility checker review" in compat_flat
                or "not accepted" in compat_flat
                or "pending independent same-family compatibility checker "
                   "review" in same_flat
                or "not accepted" in same_flat):
            probs.append(
                "post-R3.1 plan leaves a compatibility checkpoint pending/"
                "not accepted even though R3.1 is executed")
        r31_flat = re.sub(r"\s+", " ", r31)
        r31_done = (
            "executed" in r31_flat
            or ("independently **ACCEPTED** by `/root/validation_scout`"
                in r31_flat
                and "9239c1d3dc595538beb048c77788cd2c453240a4"
                in r31_flat))
        if (not r31_done
                or "after an independent compatibility checker ACCEPT of the "
                   "one-time compatibility checkpoint" not in r31_flat
                or "independent same-family compatibility checker ACCEPT"
                   not in r31_flat):
            probs.append(
                "post-R3.1 plan does not bind R3.1 execution to the prior "
                "independent compatibility-checkpoint ACCEPTs")

    stale_current = re.search(
        r"(?is)\b(?:current|controlling)\s+sequence(?:\s+is(?:\s+now)?)?"
        r".{0,500}\b(?P<stale_current>R2\.(?:12|13)) maker checkpoint\b"
        r".{0,250}\bindependent R2\.(?:12|13) checker ACCEPT\b", plan)
    stale_block = re.search(
        r"(?is)\bR3\.1 remains blocked\b.{0,180}"
        r"\bindependent (?P<stale_block>R2\.(?:12|13))\b"
        r".{0,100}\bACCEPT\b", plan)
    if stale_current or stale_block:
        stale_version = (
            stale_current.group("stale_current") if stale_current
            else stale_block.group("stale_block"))
        probs.append(
            "plan status: stale live %s current/controlling route remains; "
            "R2.12 and R2.13 are rejected and R3.1 requires independent "
            "compatibility-checkpoint ACCEPT" % stale_version)

    r5 = plan_section(plan, "## R5 ", "## R6 ")
    r6 = plan_section(plan, "## R6 ", "## R7 ")
    r7 = plan_section(plan, "## R7 ", "## R8 ")
    r8 = plan_section(plan, "## R8 ", "## R9 ")
    r9 = plan_section(plan, "## R9 ", "## Standing prohibitions")
    r5_dependency = plan_route_field(r5, "Dependency")
    r6_dependency = plan_route_field(r6, "Dependency")
    r7_dependency = plan_route_field(r7, "Dependency")
    r8_dependency = plan_route_field(r8, "Dependency")
    r8_exclusions = plan_route_field(r8, "Exclusions",
                                     "Explicit exclusions")
    r9_inputs = plan_route_field(r9, "Inputs")
    r9_gate = plan_route_field(r9, "Owner gate", "Validation gate")
    revised_route = current_r7_r9_route(r7)

    if not route_has_independent_acceptance(r5_dependency, "r4"):
        probs.append("plan R5 does not require independent R4 acceptance")
    if not route_has_independent_acceptance(r6_dependency, "r5"):
        probs.append("plan R6 does not require independent R5 acceptance")
    if not route_has_independent_acceptance(
            r7_dependency, "r3.1", "r4", "r5", "r6"):
        probs.append("plan R7 dependency does not require independent checker "
                     "acceptance of R3.1 and R4-R6")
    if revised_route:
        if not route_has_completed_unit(r8_dependency, "r7"):
            probs.append(
                "plan R8 does not require completed R7 before maker "
                "reconciliation")
        r7_review = plan_route_field(r7, "Review boundary")
        if (not route_has_standalone_r7_exclusion(r7_review)
                or route_affirmatively_requires_standalone_r7(r7 + r8)):
            probs.append(
                "plan current R7-R9 route does not exclude a standalone R7 "
                "checker")
        r9_consistency = plan_route_field(r9, "Consistency scope")
        consistency_text = route_text(r9_consistency)
        if (not re.search(r"\bscenario", consistency_text)
                or not re.search(r"\btruth\b", consistency_text)
                or not re.search(r"\bsufficien", consistency_text)
                or "independent" not in route_text(r9)):
            probs.append(
                "plan R9 does not independently review scenario truth and "
                "sufficiency")
    elif not route_has_independent_acceptance(r8_dependency, "r7"):
        probs.append(
            "historical plan R8 does not preserve independently accepted R7")

    exclusion_text = route_text(r8_exclusions)
    r8_exclusion_concepts = (
        ("README", r"\breadme\b"),
        ("code-map", r"\bcode[- ]map\b"),
        ("application inspection", r"\bapplication\b"),
        ("runtime inspection", r"\bruntime\b"),
        ("Phase 2", r"\bphase\s*2\b"),
    )
    if (not r8_exclusions
            or any(not re.search(pattern, exclusion_text)
                   for _label, pattern in r8_exclusion_concepts)):
        probs.append("plan R8 does not explicitly exclude README/code-map/"
                     "runtime/Phase-2 expansion")

    input_text = route_text(r9_inputs)
    pinned_clean_topic = (
        bool(re.search(r"\b(?:pinned|exact)\b", input_text))
        and "clean" in input_text
        and bool(re.search(r"\btopic[- ]branch\b", input_text))
        and "checkpoint" in input_text
        and not re.search(
            r"\b(?:unpinned|dirty|non[- ]topic|local[- ]only|unpushed)\b",
            input_text))
    if revised_route:
        pinned_clean_topic = (
            pinned_clean_topic
            and route_names_unit(input_text, "r8")
            and "pushed" in input_text
            and "checksum" in input_text)
    if not pinned_clean_topic:
        probs.append("plan R9 input is not a pinned clean topic-branch "
                     "checkpoint")

    gate_text = route_text(r9_gate)
    joint_gate = (
        route_names_unit(gate_text, "r9")
        and bool(re.search(r"\baccept\b", gate_text))
        and "owner acceptance" in gate_text
        and "explicit" in gate_text
        and bool(re.search(r"\bphase\s*1\b", gate_text))
        and bool(re.search(r"\bclose[sd]?\b", gate_text))
        and bool(re.search(
            r"\b(?:both|plus)\b|"
            r"\br9\b.{0,40}\baccept\b.{0,80}\band\b.{0,40}"
            r"\bowner acceptance\b",
            gate_text))
        and not re.search(
            r"\b(?:alone|either|optional|not required|without)\b",
            gate_text))
    if not joint_gate:
        probs.append("plan R9 does not require both reviewer and owner "
                     "acceptance to close Phase 1")
    if "ARCHITECT_CBA_CANON_V2_R9_INDEPENDENT_ACCEPTANCE.md" not in r9:
        probs.append("plan R9 does not name its sole authorized report path")
    return probs


def check_canon_live_status(canon, plan):
    """Reject stale live route claims in pending and accepted states.

    Historical checkpoint prose remains immutable. This is limited to the
    canon's live amendment field, current migration status, edition summaries,
    §15.9 foundation-status mirror, §15.10 register status, and §19.3
    current-family status.
    """
    probs = []
    migration = parse_migration_state(plan)
    if migration == "post-R3.1":
        r31_plan = plan_section(plan, "## R3.1 ", "## R4 ")
        r31_plan_flat = re.sub(r"\s+", " ", r31_plan)
        accepted_checkpoint = \
            "9239c1d3dc595538beb048c77788cd2c453240a4"
        r31_accepted = (
            "independently **ACCEPTED** by `/root/validation_scout`"
            in r31_plan_flat
            and accepted_checkpoint in r31_plan_flat)
        amendment = re.search(
            r"(?m)^\*\*Amendment date:\*\*\s*([^\\\n]+)", canon)
        if not amendment or amendment.group(1).strip() != "July 24, 2026":
            probs.append(
                "canon live post-R3.1 status: maker execution requires the "
                "July 24, 2026 amendment date")

        if r31_accepted:
            top = line_range(
                canon,
                "**Current R3.1 accepted status "
                "(supersedes the R2.13 sequencing sentence above):**",
                "> **Use rule:**") or ""
            top_flat = re.sub(r"\s+", " ", top)
            accepted_required = (
                accepted_checkpoint,
                "/root/validation_scout",
                "R3.1 was independently **ACCEPTED**",
                "R4 is unblocked as the next construction unit but remains "
                "not started",
                "Phase 1 continues",
                "Phase 2 and W1.1 remain blocked pending R9 ACCEPT plus owner "
                "acceptance",
            )
            if (not top
                    or any(x not in top_flat for x in accepted_required)
                    or "pending an independent R3.1 checker" in top_flat
                    or "R4 remains blocked" in top_flat):
                probs.append(
                    "canon live accepted R3.1 status: top mirror omits the "
                    "exact ACCEPT, unblocked/not-started R4, continuing Phase "
                    "1, or blocked Phase 2/W1.1")

            first_edition_row = next(
                (line for line in canon.splitlines()
                 if line.startswith(
                     "| **Repair v2.0 — working draft, pre-R3.1 "
                     "compatibility** |")),
                "")
            same_edition_row = next(
                (line for line in canon.splitlines()
                 if line.startswith(
                     "| **Repair v2.0 — working draft, same-family deferral "
                     "compatibility** |")),
                "")
            r31_edition_row = next(
                (line for line in canon.splitlines()
                 if line.startswith(
                     "| **Repair v2.0 — working draft, R3.1** |")),
                "")
            for row_name, row in (
                    ("pre-R3.1 compatibility", first_edition_row),
                    ("same-family compatibility", same_edition_row),
                    ("R3.1", r31_edition_row)):
                if (not row
                        or accepted_checkpoint not in row
                        or "/root/validation_scout" not in row
                        or (row_name != "R3.1"
                            and "R3.1 was independently ACCEPTED" not in row)
                        or (row_name == "R3.1"
                            and "Independently ACCEPTED by" not in row)
                        or "R4 is unblocked but not started" not in row
                        or "Phase 1 continues" not in row
                        or "Phase 2/W1.1 remain blocked pending R9 ACCEPT plus "
                           "owner acceptance" not in row
                        or "pending independent R3.1 checker" in row
                        or "R4 remains blocked" in row):
                    probs.append(
                        "canon live accepted R3.1 status: %s edition mirror "
                        "omits the exact ACCEPT/current R4/Phase route"
                        % row_name)
            if (not r31_edition_row
                    or "| **July 24, 2026** |" not in r31_edition_row):
                probs.append(
                    "canon live accepted R3.1 status: R3.1 edition row must "
                    "retain July 24, 2026")

            foundation_status = line_range(
                canon,
                "The R2.10–R2.13 review findings are classified exhaustively "
                "below.",
                "| Foundation review finding | Balanced disposition |") or ""
            foundation_flat = re.sub(r"\s+", " ", foundation_status)
            if (not foundation_status
                    or any(x not in foundation_flat
                           for x in accepted_required[0:3])
                    or "R4 is unblocked but remains not started"
                       not in foundation_flat
                    or "Phase 1 continues" not in foundation_flat
                    or "Phase 2/W1.1 remain blocked pending R9 ACCEPT plus "
                       "owner acceptance" not in foundation_flat
                    or "pending an independent R3.1 checker"
                       in foundation_flat
                    or "R4 remains blocked" in foundation_flat):
                probs.append(
                    "canon live accepted R3.1 status: §15.9 foundation mirror "
                    "omits the exact ACCEPT/current R4/Phase route")

            register_status = line_range(
                canon,
                "This section is the active v2 registry of §15.9.1.",
                "#### 15.10.1 A family — GROUP index") or ""
            register_flat = re.sub(r"\s+", " ", register_status)
            if (not register_status
                    or accepted_checkpoint not in register_flat
                    or "/root/validation_scout" not in register_flat
                    or "independently **ACCEPTED**" not in register_flat
                    or "R4 is unblocked but remains not started"
                       not in register_flat
                    or "Phase 1 continues" not in register_flat
                    or "nothing here carries a Phase 2 verdict before R9 "
                       "ACCEPT plus owner acceptance" not in register_flat):
                probs.append(
                    "canon live accepted R3.1 status: §15.10 register mirror "
                    "omits the exact ACCEPT/current R4/Phase route")

            family_status = line_range(
                canon,
                "**A-family v2 status (R3.1 independently ACCEPTED; R4 "
                "unblocked but not started).**",
                "### 19.4 CBA Guide sections reviewed for discovery") or ""
            family_flat = re.sub(r"\s+", " ", family_status)
            if (not family_status
                    or accepted_checkpoint not in family_flat
                    or "/root/validation_scout" not in family_flat
                    or "independently **ACCEPTED**" not in family_flat
                    or "R4 is unblocked but remains not started"
                       not in family_flat
                    or "Phase 1 continues" not in family_flat
                    or "no Phase 2 verdict exists before R9 ACCEPT plus owner "
                       "acceptance" not in family_flat
                    or "pending an independent R3.1 checker" in family_flat
                    or "R4 remains blocked" in family_flat):
                probs.append(
                    "canon §19.3 live accepted R3.1 status omits the exact "
                    "ACCEPT/current R4/Phase route")
            return probs

        top = line_range(
            canon,
            "**Current R3.1 maker status "
            "(supersedes the R2.13 sequencing sentence above):**",
            "> **Use rule:**")
        top_flat = re.sub(r"\s+", " ", top)
        top_required = (
            "d6101f82b40f5c1e8c45c8be090e9b4743daefe5",
            "/root/validation_scout",
            "The R3.1 maker checkpoint has executed after both independently "
            "accepted compatibility checkpoints",
            "pending an independent R3.1 checker ACCEPT",
            "R4 remains blocked until that ACCEPT",
        )
        if (not top
                or any(x not in top_flat for x in top_required)
                or "R3.1 remains not started" in top_flat
                or "R3.1 is now unblocked and is the next construction unit "
                   "but remains not started" in top_flat):
            probs.append(
                "canon live post-R3.1 status: top maker mirror omits executed/"
                "pending-checker R3.1 or blocked R4, or retains a stale "
                "not-started route")

        first_edition_row = next(
            (line for line in canon.splitlines()
             if line.startswith(
                 "| **Repair v2.0 — working draft, pre-R3.1 "
                 "compatibility** |")),
            "")
        same_edition_row = next(
            (line for line in canon.splitlines()
             if line.startswith(
                 "| **Repair v2.0 — working draft, same-family deferral "
                 "compatibility** |")),
            "")
        edition_route = (
            "R3.1 maker checkpoint has executed and is pending an independent "
            "R3.1 checker ACCEPT; no A-series record is accepted, and R4 "
            "remains blocked until that ACCEPT.")
        if (not first_edition_row or not same_edition_row
                or edition_route not in first_edition_row
                or edition_route not in same_edition_row
                or "R3.1 remains not started" in first_edition_row
                or "R3.1 remains not started" in same_edition_row
                or "but remains not started" in first_edition_row
                or "but remains not started" in same_edition_row):
            probs.append(
                "canon live post-R3.1 status: compatibility edition mirrors "
                "must record maker execution, pending checker, no accepted "
                "A-series record, and blocked R4")

        r31_edition_row = next(
            (line for line in canon.splitlines()
             if line.startswith(
                 "| **Repair v2.0 — working draft, R3.1** |")),
            "")
        if (not r31_edition_row
                or "| **July 24, 2026** |" not in r31_edition_row
                or "Maker executed" not in r31_edition_row
                or "pending independent R3.1 checker" not in r31_edition_row
                or "R4 and Phase 2 remain blocked" not in r31_edition_row):
            probs.append(
                "canon live post-R3.1 status: R3.1 edition row must use "
                "July 24, 2026 and record maker execution, pending checker, "
                "and blocked R4/Phase 2")

        foundation_status = line_range(
            canon,
            "The R2.10–R2.13 review findings are classified exhaustively "
            "below.",
            "| Foundation review finding | Balanced disposition |")
        foundation_flat = re.sub(r"\s+", " ", foundation_status)
        foundation_required = (
            "d6101f82",
            "/root/validation_scout",
            "Neither compatibility acceptance nor maker execution accepts an "
            "active A-series record",
            "The R3.1 maker checkpoint has executed and is pending an "
            "independent R3.1 checker ACCEPT",
            "R4 remains blocked until that ACCEPT",
        )
        if (not foundation_status
                or any(x not in foundation_flat
                       for x in foundation_required)
                or "R3.1 remains not started" in foundation_flat):
            probs.append(
                "canon live post-R3.1 status: §15.9 foundation mirror omits "
                "maker execution/pending checker/no accepted A-series record/"
                "blocked R4, or retains a stale not-started route")

        family_status = line_range(
            canon,
            "**A-family v2 status (R3.1 maker executed; independent checker "
            "pending — not accepted).**",
            "### 19.4 CBA Guide sections reviewed for discovery")
        family_flat = re.sub(r"\s+", " ", family_status)
        if (not family_status
                or "R3.1 maker executed" not in family_flat
                or "no A-family record is an accepted audit oracle"
                   not in family_flat
                or "R4 remains blocked pending an independent R3.1 checker "
                   "ACCEPT" not in family_flat
                or "R3.1 remains not started" in family_flat):
            probs.append(
                "canon §19.3 live post-R3.1 status omits maker execution, "
                "pending checker/no accepted A-series record, or blocked R4")
        return probs

    if migration != "pre-R3.1":
        return probs
    same_compat = plan_section(
        plan,
        "## Owner-authorized same-family deferral compatibility checkpoint",
        "## R3.1 ")
    same_flat = re.sub(r"\s+", " ", same_compat)
    pending = (
        "pending independent same-family compatibility checker review "
        "and not accepted" in same_flat)
    accepted = (
        "independently **ACCEPTED** before R3.1 construction" in same_flat)
    if pending == accepted:
        return probs

    amendment = re.search(
        r"(?m)^\*\*Amendment date:\*\*\s*([^\\\n]+)", canon)
    if not amendment or amendment.group(1).strip() != "July 24, 2026":
        probs.append(
            "canon live status: pending same-family compatibility checkpoint "
            "requires the July 24, 2026 amendment date")

    top = line_range(
        canon,
        "**Current pre-R3.1 status "
        "(supersedes the R2.13 sequencing sentence above):**",
        "> **Use rule:**")
    top_flat = re.sub(r"\s+", " ", top)
    first_edition_row = next(
        (line for line in canon.splitlines()
         if line.startswith(
             "| **Repair v2.0 — working draft, pre-R3.1 compatibility** |")),
        "")
    first_edition_flat = re.sub(r"\s+", " ", first_edition_row)
    same_edition_row = next(
        (line for line in canon.splitlines()
         if line.startswith(
             "| **Repair v2.0 — working draft, same-family deferral "
             "compatibility** |")),
        "")
    same_edition_flat = re.sub(r"\s+", " ", same_edition_row)

    foundation_status = line_range(
        canon,
        "The R2.10–R2.13 review findings are classified exhaustively below.",
        "| Foundation review finding | Balanced disposition |")
    foundation_flat = re.sub(r"\s+", " ", foundation_status)

    family_status = line_range(
        canon,
        "**A-family v2 status (R3 executed; independently REJECTED — not "
        "certified).**",
        "### 19.4 CBA Guide sections reviewed for discovery")
    family_flat = re.sub(r"\s+", " ", family_status)

    if pending:
        if (not top
                or "owner-authorized same-family deferral compatibility "
                   "checkpoint is pending independent checker acceptance"
                   not in top_flat
                or "R3.1 remains blocked and not started" not in top_flat
                or re.search(r"\bR3\.1 is unblocked\b", top_flat)):
            probs.append(
                "canon live status: pending same-family compatibility "
                "checkpoint is paired with a stale top-level R3.1 unblocked/"
                "current-route claim")
        if (not first_edition_row
                or "same-family compatibility checkpoint is pending "
                   "independent checker acceptance" not in first_edition_flat
                or "R3.1 remains blocked and not started"
                   not in first_edition_flat
                or re.search(r"\bR3\.1 is unblocked\b", first_edition_flat)):
            probs.append(
                "canon live status: pre-R3.1 compatibility edition row does "
                "not mirror the pending same-family checkpoint and blocked "
                "R3.1")
        if (not family_status
                or "owner-authorized same-family compatibility checkpoint is "
                   "now pending independent checker acceptance"
                   not in family_flat
                or "R3.1 remains blocked and not started" not in family_flat
                or "same-family compatibility maker checkpoint → independent "
                   "same-family compatibility checker ACCEPT → R3.1 maker "
                   "checkpoint" not in family_flat
                or re.search(r"\bR3\.1 is unblocked\b", family_flat)):
            probs.append(
                "canon §19.3 live status: pending same-family compatibility "
                "checkpoint is paired with a stale R3.1 unblocked/current-"
                "sequence claim")
    elif accepted:
        accept_sha = "d6101f82b40f5c1e8c45c8be090e9b4743daefe5"
        if (not top
                or accept_sha not in top_flat
                or "/root/validation_scout" not in top_flat
                or "R3.1 is now unblocked and is the next construction unit "
                   "but remains not started" not in top_flat
                or "R4 remains blocked until an independent R3.1 checker "
                   "ACCEPT" not in top_flat
                or "pending independent checker acceptance" in top_flat
                or "R3.1 remains blocked" in top_flat):
            probs.append(
                "canon live accepted status: top pre-R3.1 mirror omits the "
                "exact same-family ACCEPT, unblocked/not-started R3.1, or "
                "blocked R4")
        edition_required = (
            accept_sha,
            "/root/validation_scout",
            "R3.1 is now unblocked and is the next construction unit but "
            "remains not started",
            "R4 remains blocked until an independent R3.1 checker ACCEPT",
        )
        if (not first_edition_row or not same_edition_row
                or any(x not in first_edition_flat for x in edition_required)
                or any(x not in same_edition_flat for x in edition_required)
                or "pending independent checker" in first_edition_flat
                or "pending independent checker" in same_edition_flat):
            probs.append(
                "canon live accepted status: both compatibility edition rows "
                "must mirror the exact same-family ACCEPT and current R3.1/R4 "
                "route")
        if (not foundation_status
                or "d6101f82" not in foundation_flat
                or "/root/validation_scout" not in foundation_flat
                or "unblock R3.1 as the next construction unit"
                   not in foundation_flat
                or "R3.1 remains not started" not in foundation_flat
                or "R4 remains blocked until an independent R3.1 checker "
                   "ACCEPT" not in foundation_flat
                or "remains pending independent review" in foundation_flat):
            probs.append(
                "canon live accepted status: §15.9 foundation mirror omits "
                "the same-family ACCEPT or current R3.1/R4 route")
        if (not family_status
                or accept_sha not in family_flat
                or "/root/validation_scout" not in family_flat
                or "R3.1 is now unblocked and is the next construction unit "
                   "but remains not started" not in family_flat
                or "same-family compatibility checkpoint independently "
                   "accepted → R3.1 maker checkpoint" not in family_flat
                or "R4 remains blocked until that independent R3.1 checker "
                   "ACCEPT" not in family_flat
                or "pending independent checker acceptance" in family_flat
                or "R3.1 remains blocked" in family_flat):
            probs.append(
                "canon §19.3 live accepted status: current sequence omits the "
                "same-family ACCEPT or truthful R3.1/R4 route")
    return probs


# --------------------------------------------------------------------------
# 11. The reconciliation context: every population, parsed once.
# --------------------------------------------------------------------------


class Ctx(object):
    def __init__(self, tree, inv):
        self.tree = tree
        self.inv = inv
        self.problems = []
        self.notes = []
        self.pop = {}
        self.header = {}

        for k in ("GROUP-index", "LEAF-main", "LEAF-detail", "XW2-edge",
                  "SRC2-base", "SRC2-detail-official-immutable",
                  "SRC2-detail-official-mutable",
                  "SRC2-detail-ops-provenance",
                  "SRC2-detail-ext-contract", "EV2-component", "SXW2-edge"):
            h, rows, probs = parse_canon_population(tree.canon, inv, k)
            self.problems += probs
            self.header[k] = h
            self.pop[k] = rows
        for k in ("DR2-generic", "AMEND-detail", "DISP-detail",
                  "fragment-inventory",
                  "BND-bundle", "SM2-record", "SS2-record", "BLK-record",
                  "RES-record", "SRC2-date-component",
                  "scenario-fragment-inventory"):
            h, rows, probs = parse_receipt_population(tree, inv, k)
            self.problems += probs
            self.header[k] = h
            self.pop[k] = rows

    def f(self, key, row, field):
        """Field access BY GOVERNED NAME against the table's rendered header -
        never by a magic index. Returns None where the rendered table carries
        no such column (an unmigrated legacy table)."""
        hdr = self.header.get(key)
        if hdr and field in hdr:
            i = hdr.index(field)
        else:
            try:
                i = self.inv.schema[key].index(field)
            except (KeyError, ValueError):
                return None
            if hdr is not None and len(hdr) != len(self.inv.schema.get(key, [])):
                return None
            if key == "LEAF-detail":
                i += 1
        return row[i] if i < len(row) else None

    def ids(self, key):
        return [normalize_record_id_cell(r[0])
                for r in self.pop.get(key, [])]

    def vocab(self, key):
        return self.inv.vocab.get(key, [])

    def header_conforms(self, key):
        """True iff the rendered header equals the pinned schema field list."""
        hdr = self.header.get(key)
        pinned = list(self.inv.schema.get(key, []))
        if hdr is None:
            return None
        if key in ("LEAF-detail",):
            pinned = ["ID"] + pinned
        return hdr == pinned


def vocab_check(ctx, vkey, value, label):
    """Closure at use sites: an unlisted value fails the row."""
    v = (value or "").strip().strip("`")
    if v not in ctx.vocab(vkey):
        ctx.problems.append("%s: value %r is not in the governed %s vocabulary"
                            % (label, v, vkey))
        return False
    return True


def check_headers(ctx, migration):
    """Exact rendered-header conformance for every present population.

    The two committed R3 legacy headers are explicitly backlogged until
    R3.1; every other populated table must already match its governed schema.
    """
    legacy = {"SRC2-base", "SRC2-detail-official-mutable"}
    for key in sorted(ctx.pop):
        rows = ctx.pop.get(key, [])
        header = ctx.header.get(key)
        if not rows and header is None:
            continue
        if migration == "pre-R3.1" and key in legacy:
            continue
        conforms = ctx.header_conforms(key)
        if header is None and rows:
            ctx.problems.append("header %s: populated table has no parseable "
                                "header" % key)
        elif conforms is False:
            ctx.problems.append("header %s: rendered header does not exactly "
                                "match the pinned schema" % key)


# --------------------------------------------------------------------------
# 12. Immutable-range preservation (Inventory D).
# --------------------------------------------------------------------------


def check_immutable_ranges(canon, inv):
    probs = []
    for key in sorted(inv.ranges):
        frm, to, want = inv.ranges[key]
        seg = line_range(canon, frm, to)
        if seg is None:
            probs.append("immutable range %s: not found (%r .. %r)"
                         % (key, frm, to))
            continue
        got = sha_hex(seg)
        if got != want:
            probs.append("immutable range %s: SHA-256 %s != pinned %s "
                         "(a never-edited range was modified)"
                         % (key, got, want))
    return probs


# --------------------------------------------------------------------------
# 13. Canon-side population conformance.
# --------------------------------------------------------------------------


def check_group_leaf(ctx):
    groups = ctx.pop["GROUP-index"]
    lmain = ctx.pop["LEAF-main"]
    ldet = ctx.pop["LEAF-detail"]
    gids = [r[0].strip("`") for r in groups]
    if len(gids) != len(set(gids)):
        ctx.problems.append("GROUP: duplicate id(s) %s"
                            % sorted(x for x in set(gids) if gids.count(x) > 1))
    for g in gids:
        if not re.fullmatch(r"CBA2-[ACRLS][0-9]{2}", g):
            ctx.problems.append("GROUP %s: id does not match the 15.9.2 "
                                "grammar" % g)
    mids = [r[0].strip("`") for r in lmain]
    dids = [r[0].strip("`") for r in ldet]
    if len(mids) != len(set(mids)):
        ctx.problems.append("LEAF main: duplicate id(s) %s"
                            % sorted(x for x in set(mids) if mids.count(x) > 1))
    if len(dids) != len(set(dids)):
        ctx.problems.append("LEAF detail: duplicate id(s) %s"
                            % sorted(x for x in set(dids) if dids.count(x) > 1))
    if set(mids) != set(dids):
        only_m = sorted(set(mids) - set(dids))
        only_d = sorted(set(dids) - set(mids))
        ctx.problems.append("LEAF main/detail ID sets do not join "
                            "(main-only=%s detail-only=%s)" % (only_m, only_d))
    for lid in mids:
        parent = lid.split(".")[0]
        if parent not in set(gids):
            ctx.problems.append("LEAF %s: parent GROUP %s does not exist"
                                % (lid, parent))
    # Current child IDs may have governed AMEND gaps.  Historical allocation
    # continuity and no-reuse are checked after structured lineage is parsed.
    by_group = {}
    for lid in mids:
        p, _, n = lid.partition(".")
        try:
            by_group.setdefault(p, []).append(int(n))
        except ValueError:
            ctx.problems.append("LEAF %s: child number is not an integer" % lid)
    for g, nums in sorted(by_group.items()):
        ctx.problems += duplicate_numbers(
            sorted(nums), "LEAF children of %s" % g)
    # The GROUP row's declared range/count is a mechanical assertion, not
    # decoration. It must describe the actual active children exactly.
    for r in groups:
        gid = r[0].strip("`")
        declared = (ctx.f("GROUP-index", r, "Active LEAF children")
                    or "").strip().replace("`", "")
        cm = re.search(r"\(([1-9]\d*)\)\s*$", declared)
        actual = sorted(by_group.get(gid, []))
        body = re.sub(r"\s*\([1-9]\d*\)\s*$", "", declared).strip()
        declared_ids = []
        parseable = bool(body and cm)
        for part in [p.strip() for p in body.split(",") if p.strip()]:
            match = re.fullmatch(
                r"(CBA2-[ACRLS]\d{2}\.\d+)"
                r"(?:\s*[–-]\s*(CBA2-[ACRLS]\d{2}\.\d+))?", part)
            if not match:
                parseable = False
                continue
            first, last = match.group(1), match.group(2)
            first_parent, first_number = first.rsplit(".", 1)
            if last is None:
                declared_ids.append(first)
                continue
            last_parent, last_number = last.rsplit(".", 1)
            if first_parent != last_parent or int(first_number) > int(
                    last_number):
                parseable = False
                continue
            declared_ids.extend(
                "%s.%d" % (first_parent, number)
                for number in range(int(first_number), int(last_number) + 1))
        if not parseable or not declared_ids:
            ctx.problems.append("GROUP %s: Active LEAF children %r lacks a "
                                "parseable declared range/list and count"
                                % (gid, declared))
            continue
        if any(ref.split(".")[0] != gid for ref in declared_ids):
            ctx.problems.append("GROUP %s: declared child range/list names a "
                                "different GROUP" % gid)
        declared_count = int(cm.group(1))
        if declared_count != len(actual):
            ctx.problems.append("GROUP %s: declared child count %d != actual "
                                "active child count %d"
                                % (gid, declared_count, len(actual)))
        declared_numbers = [
            int(ref.rsplit(".", 1)[1]) for ref in declared_ids
            if ref.split(".")[0] == gid]
        if len(declared_numbers) != len(set(declared_numbers)):
            ctx.problems.append("GROUP %s: declared child range/list overlaps "
                                "or repeats an identity" % gid)
        if set(declared_numbers) != set(actual):
            ctx.problems.append(
                "GROUP %s: declared child identity set %s does not exactly "
                "match actual active child identity set %s"
                % (gid, sorted(set(declared_numbers)), actual))
    return set(mids)


def check_xw2(ctx, published, active_leaves, migration):
    edges = ctx.pop["XW2-edge"]
    ids = [r[0].strip("`") for r in edges]
    nums = []
    for i in ids:
        m = re.fullmatch(r"XW2-(\d{4})", i)
        if m:
            nums.append(int(m.group(1)))
        else:
            ctx.problems.append("XW2: malformed edge id %r" % i)
    ctx.problems += duplicate_numbers(nums, "XW2")

    terminal = set(ctx.vocab("xw2-terminal-edge-type"))
    pairs, term_keys = {}, {}
    parsed = []
    for r in edges:
        eid = r[0].strip("`")
        src = ctx.f("XW2-edge", r, "Historical v1.1 LEAF").strip("`")
        tgt = ctx.f("XW2-edge", r, "Active v2 LEAF or —").strip("`")
        etype = ctx.f("XW2-edge", r, "Edge type").strip("`")
        scope = ctx.f("XW2-edge", r, "Scope/relationship")
        dec = ctx.f("XW2-edge", r, "Decision record").strip("`")
        if not vocab_check(ctx, "xw2-edge-type", etype, "XW2 %s edge type" % eid):
            continue
        if published.ok and src not in published.leaf_len:
            ctx.problems.append("XW2 %s: source %s is not a published v1.1 LEAF "
                                "in the pinned population" % (eid, src))
        deferred = etype == "deferred"
        deferral = None
        if etype in terminal:
            if tgt != DASH:
                ctx.problems.append("XW2 %s: terminal edge carries a non-dash "
                                    "target %r" % (eid, tgt))
        elif deferred:
            if tgt != DASH:
                ctx.problems.append(
                    "XW2 %s: deferred nonterminal edge must carry target —"
                    % eid)
            deferral = re.search(
                r"families:([ACRLS]),([ACRLS]); "
                r"resolving-unit:(R[4-6])\s*$", scope or "")
            if not deferral:
                ctx.problems.append(
                    "XW2 %s: deferred scope must end with exact "
                    "source/target families and resolving-unit:R4|R5|R6"
                    % eid)
            else:
                source_family, target_family, _unit = deferral.groups()
                source_match = re.fullmatch(
                    r"CBA-([ACRLS])\d{2}(?:\.\d+)?", src)
                if source_match and source_family != source_match.group(1):
                    ctx.problems.append(
                        "XW2 %s: deferred source family %s does not match "
                        "historical source %s" % (eid, source_family, src))
            if r8_has_started(ctx.tree.plan):
                ctx.problems.append(
                    "XW2 %s: deferred edge survives into R8, whose G1 gate "
                    "requires zero current deferrals" % eid)
        else:
            if not re.fullmatch(r"CBA2-[ACRLS][0-9]{2}\.[0-9]+", tgt):
                ctx.problems.append("XW2 %s: nonterminal target %r is not an "
                                    "active LEAF id" % (eid, tgt))
            elif tgt not in active_leaves:
                ctx.problems.append("XW2 %s: target %s resolves to no active "
                                    "LEAF (nonexistent reference)" % (eid, tgt))
            else:
                key = (src, tgt)
                if key in pairs:
                    ctx.problems.append("XW2 %s: duplicate source-target pair "
                                        "%s (already typed by %s)"
                                        % (eid, key, pairs[key]))
                pairs[key] = eid
        if not re.fullmatch(r"DR2-\d{4}", dec):
            ctx.problems.append("XW2 %s: missing/malformed decision reference "
                                "%r" % (eid, dec))
        frag = None
        fm = re.match(r"\[([^\]]+)\]", (scope or "").strip())
        if fm:
            frag = fm.group(1).strip("`")
            if not frag.startswith(src + ":F"):
                ctx.problems.append("XW2 %s: leading fragment token %r does not "
                                    "belong to source LEAF %s"
                                    % (eid, frag, src))
        elif migration == "post-R3.1":
            ctx.problems.append("XW2 %s: no pinned leading fragment token in "
                                "Scope/relationship (fragment-inventory "
                                "contract)" % eid)
        if migration == "post-R3.1":
            fragment_tokens = re.findall(r"\[([^\]]+)\]", scope or "")
            span_tokens = re.findall(
                r"(?<![A-Za-z0-9_-])span:\d+-\d+(?:@[^\s;|]*)?",
                scope or "")
            if len(fragment_tokens) != 1:
                ctx.problems.append(
                    "XW2 %s: Scope/relationship must carry exactly one "
                    "leading fragment token" % eid)
            if len(span_tokens) != 1:
                ctx.problems.append(
                    "XW2 %s: Scope/relationship must carry exactly one "
                    "normalized span" % eid)
        if etype in terminal:
            k = (src, frag)
            if k in term_keys:
                ctx.problems.append("XW2 %s: terminal-edge uniqueness violated "
                                    "on (source LEAF, fragment ID) %s (also %s)"
                                    % (eid, k, term_keys[k]))
            term_keys[k] = eid
        parsed.append({"id": eid, "src": src, "tgt": tgt, "type": etype,
                       "scope": scope or "", "dec": dec, "frag": frag,
                       "terminal": etype in terminal,
                       "deferred": deferred,
                       "deferral": deferral.groups() if deferral else None})

    # The sole same-family exception is a join over existing governed
    # structures, not a semantic keyword test. The checker still decides
    # whether the natural-owner conclusion itself is honest.
    for edge in parsed:
        if not edge["deferred"]:
            continue
        fragment_tokens = re.findall(r"\[([^\]]+)\]", edge["scope"])
        span_tokens = re.findall(
            r"(?<![A-Za-z0-9_-])span:\d+-\d+(?:@[^\s;|]*)?",
            edge["scope"])
        if len(fragment_tokens) != 1:
            ctx.problems.append(
                "XW2 %s: deferred edge must carry exactly one leading "
                "fragment token" % edge["id"])
        if len(span_tokens) != 1:
            ctx.problems.append(
                "XW2 %s: deferred edge must carry exactly one normalized "
                "span" % edge["id"])
        if not edge["deferral"]:
            continue
        source_family, target_family, unit = edge["deferral"]
        if source_family != target_family:
            continue
        source = re.fullmatch(
            r"CBA-([ACRLS])(\d{2})(?:\.\d+)?", edge["src"])
        expected_unit = None
        if source:
            family, number = source.group(1), int(source.group(2))
            if family == "C" and 1 <= number <= 13:
                expected_unit = "R4"
            elif family == "C" and 14 <= number <= 25:
                expected_unit = "R5"
            elif family in ("R", "L", "S"):
                expected_unit = "R6"
        edge["same_family"] = True
        edge["same_family_expected_unit"] = expected_unit
        if expected_unit is None:
            ctx.problems.append(
                "XW2 %s: same-family deferral source %s has no governed "
                "later-unit mapping (ordinary same-family deferral is "
                "forbidden)" % (edge["id"], edge["src"]))
        elif unit != expected_unit:
            ctx.problems.append(
                "XW2 %s: same-family deferral resolving unit %s does not "
                "match the governed source-family map %s"
                % (edge["id"], unit, expected_unit))

        existing_targets = [
            other for other in parsed
            if other["id"] != edge["id"]
            and other["src"] == edge["src"]
            and other["frag"] == edge["frag"]
            and not other["terminal"] and not other["deferred"]
            and other["tgt"] in active_leaves]
        if existing_targets:
            ctx.problems.append(
                "XW2 %s: same-family deferred fragment already has active "
                "target edge(s) %s; the ordinary target-bearing edge is "
                "required" % (edge["id"], ", ".join(
                    sorted(other["id"] for other in existing_targets))))

        qualifying = []
        for other in parsed:
            if other["id"] == edge["id"] or other["src"] != edge["src"]:
                continue
            if not edge["frag"] or not other["frag"] \
                    or other["frag"] == edge["frag"]:
                continue
            if other["terminal"] or other["deferred"] \
                    or other["tgt"] not in active_leaves:
                continue
            target = re.fullmatch(
                r"CBA2-([ACRLS])\d{2}\.\d+", other["tgt"])
            if target and target.group(1) != source_family:
                qualifying.append((other["id"], other["tgt"]))
        edge["same_family_siblings"] = qualifying
        if not qualifying:
            ctx.problems.append(
                "XW2 %s: same-family deferral has no qualifying different-"
                "fragment sibling edge to an existing cross-family active "
                "target" % edge["id"])
    return parsed


def check_sxw2(ctx, published):
    """Scenario-crosswalk edges and the scenario-fragment partition. Returns
    edge dicts in the SAME shape as XW2 edges, so one DISP engine serves both
    registers."""
    edges = []
    rows = ctx.pop.get("SXW2-edge", [])
    if not rows:
        return edges
    terminal = set(ctx.vocab("sxw2-terminal-edge-type"))
    nums, term_keys = [], {}
    for r in rows:
        eid = r[0].strip("`")
        m = re.fullmatch(r"SXW2-(\d{4})", eid)
        if m:
            nums.append(int(m.group(1)))
        else:
            ctx.problems.append("SXW2: malformed edge id %r" % eid)
            continue
        g = lambda f: (ctx.f("SXW2-edge", r, f) or "").strip()
        scen = g("Historical scenario").strip("`")
        tgt = g("Active v2 scenario or —").strip("`")
        etype = g("Edge type").strip("`")
        scope = g("Scope/relationship")
        dec = g("Decision record").strip("`")
        if not vocab_check(ctx, "sxw2-edge-type", etype,
                           "SXW2 %s edge type" % eid):
            continue
        sm = re.fullmatch(r"scenario-(\d+)", scen)
        if not sm:
            ctx.problems.append("SXW2 %s: historical scenario %r is malformed"
                                % (eid, scen))
        elif published.ok and int(sm.group(1)) not in published.scenario_len:
            ctx.problems.append("SXW2 %s: scenario %s is outside the pinned "
                                "published 1-89 population" % (eid, scen))
        if etype in terminal:
            if tgt != DASH:
                ctx.problems.append("SXW2 %s: terminal edge carries a non-dash "
                                    "target %r" % (eid, tgt))
        elif not re.fullmatch(r"CBA2-SC-\d{3}", tgt):
            ctx.problems.append("SXW2 %s: nonterminal target %r is not an "
                                "active v2 scenario id" % (eid, tgt))
        if not re.fullmatch(r"DR2-\d{4}", dec):
            ctx.problems.append("SXW2 %s: missing/malformed decision reference "
                                "%r" % (eid, dec))
        frag = None
        fm = re.match(r"\[([^\]]+)\]", (scope or "").strip())
        if fm:
            frag = fm.group(1).strip("`")
            if not frag.startswith(scen + ":F"):
                ctx.problems.append("SXW2 %s: leading fragment token %r does "
                                    "not belong to scenario %s"
                                    % (eid, frag, scen))
        else:
            ctx.problems.append("SXW2 %s: no pinned leading scenario-fragment "
                                "token in Scope/relationship" % eid)
        if etype in terminal:
            k = (scen, frag)
            if k in term_keys:
                ctx.problems.append("SXW2 %s: terminal-edge uniqueness violated "
                                    "on (scenario, scenario fragment ID) %s "
                                    "(also %s)" % (eid, k, term_keys[k]))
            term_keys[k] = eid
        edges.append({"id": eid, "src": scen, "tgt": tgt, "type": etype,
                      "scope": scope or "", "dec": dec, "frag": frag,
                      "terminal": etype in terminal, "register": "SXW2"})
    ctx.problems += contiguous_from_one(sorted(nums), "SXW2")
    return edges


def check_scenario_fragments(ctx, sxw2_edges, dr2, published):
    rows = ctx.pop.get("scenario-fragment-inventory", [])
    edge_by_id = {e["id"]: e for e in sxw2_edges}
    frags, by_scen = {}, {}
    for r in rows:
        fid = r[0].strip("`")
        g = lambda f: (ctx.f("scenario-fragment-inventory", r, f)
                       or "").strip()
        parent = g("Historical scenario").strip("`")
        kind = g("Fragment kind").strip("`")
        scope = g("Normalized fragment scope")
        decomp = g("Decomposition decision record").strip("`")
        bundle = g("Disposition bundle ID or —").strip("`")
        eids = [x.strip().strip("`") for x in
                g("Disposition edge ID(s)").split(",")
                if x.strip() and x.strip() != DASH]
        status = g("Fragment status").strip("`")
        if fid in frags:
            ctx.problems.append("scenario fragment %s: duplicate id" % fid)
            continue
        if not fid.startswith(parent + ":F"):
            ctx.problems.append("scenario fragment %s: id does not belong to "
                                "its declared scenario %s" % (fid, parent))
        vocab_check(ctx, "fragment-kind", kind,
                    "scenario fragment %s kind" % fid)
        vocab_check(ctx, "record-status", status,
                    "scenario fragment %s status" % fid)
        if decomp not in dr2:
            ctx.problems.append("scenario fragment %s: decomposition decision "
                                "record %s resolves to no DR2 record"
                                % (fid, decomp))
        atoms, ap = span_atoms(scope)
        ctx.problems += ["scenario fragment %s scope: %s" % (fid, p)
                         for p in ap]
        m = re.fullmatch(r"scenario-(\d+)", parent)
        if not m:
            ctx.problems.append("scenario fragment %s: parent %r is not a "
                                "scenario identifier" % (fid, parent))
        elif published.ok and int(m.group(1)) not in published.scenario_len:
            ctx.problems.append("scenario fragment %s: scenario %s does not "
                                "exist in the pinned 1-89 population"
                                % (fid, parent))
        if bundle != DASH and len(eids) < 2:
            ctx.problems.append("scenario fragment %s: single-edge fragment "
                                "carries a bundle (multi-target-only rule)"
                                % fid)
        terminal_count = 0
        for eid in eids:
            e = edge_by_id.get(eid)
            if e is None:
                ctx.problems.append("scenario fragment %s: disposition edge %s "
                                    "resolves to no SXW2 edge" % (fid, eid))
            elif e["frag"] and e["frag"] != fid:
                ctx.problems.append("scenario fragment %s: edge %s names "
                                    "fragment %s (bidirectional mismatch)"
                                    % (fid, eid, e["frag"]))
            elif e["terminal"]:
                terminal_count += 1
        if not eids:
            ctx.problems.append("scenario fragment %s: orphan fragment (no "
                                "disposition)" % fid)
        elif terminal_count and terminal_count != len(eids):
            ctx.problems.append("scenario fragment %s: mixes terminal and "
                                "nonterminal dispositions" % fid)
        elif terminal_count:
            if terminal_count != 1 or bundle != DASH:
                ctx.problems.append("scenario fragment %s: terminal shape "
                                    "requires one edge and no bundle" % fid)
        elif len(eids) == 1 and bundle != DASH:
            ctx.problems.append("scenario fragment %s: single-target shape "
                                "must not carry a bundle" % fid)
        elif len(eids) >= 2 and bundle == DASH:
            ctx.problems.append("scenario fragment %s: multi-target shape "
                                "requires an SXW2-BND bundle" % fid)
        ver = g("Fragment version").strip("`")
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("scenario fragment %s: Fragment version %r "
                                "is not an unpadded positive integer"
                                % (fid, ver))
        rec = {"id": fid, "scen": parent, "leaf": parent,
               "parent": parent, "register": "SXW2", "atoms": atoms,
               "scope": scope, "status": status, "kind": kind,
               "bundle": bundle, "edges": eids, "ver": ver}
        frags[fid] = rec
        by_scen.setdefault(parent, []).append(rec)
    for scen, fl in sorted(by_scen.items()):
        nums = []
        for f in fl:
            m = re.fullmatch(re.escape(scen) + r":F([0-9]+)", f["id"])
            if m:
                nums.append(int(m.group(1)))
        ctx.problems += contiguous_from_one(sorted(nums),
                                            "scenario fragment IDs of %s" % scen)
        length = None
        m = re.fullmatch(r"scenario-(\d+)", scen)
        if m and published.ok:
            length = published.scenario_len.get(int(m.group(1)))
        allatoms = []
        for f in fl:
            if f["status"] == "current":
                allatoms += f["atoms"]
        ctx.problems += partition_problems(
            allatoms, length, "scenario-fragment partition of %s" % scen)
    for e in sxw2_edges:
        if e["frag"] and e["frag"] not in frags:
            ctx.problems.append("SXW2 %s: names unregistered scenario fragment "
                                "%s" % (e["id"], e["frag"]))
    return frags


def check_src2_ev2(ctx, active_leaves, migration):
    base = ctx.pop["SRC2-base"]
    imm = ctx.pop["SRC2-detail-official-immutable"]
    mut = ctx.pop["SRC2-detail-official-mutable"]
    ops = ctx.pop["SRC2-detail-ops-provenance"]
    ext = ctx.pop["SRC2-detail-ext-contract"]
    ev2 = ctx.pop["EV2-component"]
    base_ids = [r[0].strip("`") for r in base]
    if len(base_ids) != len(set(base_ids)):
        ctx.problems.append("SRC2 base: duplicate record id(s)")
    for rid in base_ids:
        if not re.fullmatch(r"SRC2-\d{3}", rid):
            ctx.problems.append("SRC2 base: malformed record id %r" % rid)
    ctx.problems += contiguous_from_one(
        [int(rid.split("-")[1]) for rid in base_ids
         if re.fullmatch(r"SRC2-\d{3}", rid)], "SRC2")
    details = {
        "official-immutable": ("SRC2-detail-official-immutable", imm),
        "official-mutable": ("SRC2-detail-official-mutable", mut),
        "ops-provenance": ("SRC2-detail-ops-provenance", ops),
        "ext-contract": ("SRC2-detail-ext-contract", ext),
    }
    det_ids = [r[0].strip("`") for _ptype, (_key, rows) in details.items()
               for r in rows]
    if len(det_ids) != len(set(det_ids)):
        ctx.problems.append("SRC2 detail: duplicate record id(s)")
    if set(base_ids) != set(det_ids):
        ctx.problems.append("SRC2 base/detail ID sets do not reconcile "
                            "(base-only=%s detail-only=%s)"
                            % (sorted(set(base_ids) - set(det_ids)),
                               sorted(set(det_ids) - set(base_ids))))
    src2 = {}
    for r in base:
        rid = r[0].strip("`")
        ptype = (ctx.f("SRC2-base", r, "Provenance type") or "").strip("`")
        vocab_check(ctx, "provenance-type", ptype, "SRC2 %s provenance type"
                    % rid)
        rec = {"id": rid, "type": ptype}
        if migration == "post-R3.1":
            val = lambda f: (ctx.f("SRC2-base", r, f)
                             or "").strip().strip("`")
            identity = val("Source/provenance identity")
            sd = val("Source date (basis:value) or —")
            url = val("Official URL or —")
            sha = val("Artifact SHA-256 or —")
            size = val("Artifact byte size or —")
            retrieval = val("Retrieval timestamp or —")
            auth = val("Authentication timestamp or —")
            verifier = val("Verifier identity")
            session = val("Verification session ID")
            vdate = val("Verification date")
            limits = val("Record limitations")
            status = val("Record status")
            ver = val("Record version")
            vocab_check(ctx, "record-status", status,
                        "SRC2 %s Record status" % rid)
            if not re.fullmatch(r"[1-9]\d*", ver):
                ctx.problems.append("SRC2 %s: Record version %r is not an "
                                    "unpadded positive integer" % (rid, ver))
            if not identity or identity == DASH:
                ctx.problems.append("SRC2 %s: Source/provenance identity is "
                                    "required and never —" % rid)
            if not re.fullmatch(
                    r"(?:human|agent):[a-z0-9][a-z0-9._-]{0,63}", verifier):
                ctx.problems.append("SRC2 %s: Verifier identity %r is "
                                    "malformed" % (rid, verifier))
            if not re.fullmatch(
                    r"session:[a-z0-9][a-z0-9._-]{0,95}", session):
                ctx.problems.append("SRC2 %s: Verification session ID %r is "
                                    "malformed" % (rid, session))
            if not is_real_date(vdate):
                ctx.problems.append("SRC2 %s: Verification date %r is not a "
                                    "real YYYY-MM-DD date" % (rid, vdate))
            if not limits or limits == DASH:
                ctx.problems.append("SRC2 %s: Record limitations is required "
                                    "(state none expressly)" % rid)
            if sha != DASH and not re.fullmatch(r"[0-9a-f]{64}", sha):
                ctx.problems.append("SRC2 %s: Artifact SHA-256 is malformed"
                                    % rid)
            if (sha == DASH) != (size == DASH):
                ctx.problems.append("SRC2 %s: Artifact SHA-256 and Artifact "
                                    "byte size must both be present or both be "
                                    "absent (artifact recorded hashless or "
                                    "sizeless)" % rid)
            if size != DASH and not re.fullmatch(r"[1-9]\d*", size):
                ctx.problems.append("SRC2 %s: Artifact byte size %r is not an "
                                    "unpadded positive integer" % (rid, size))
            official = ptype in ("official-immutable", "official-mutable")
            if official and (url == DASH or not is_absolute_http_url(url)):
                ctx.problems.append("SRC2 %s: %s requires an absolute "
                                    "Official URL" % (rid, ptype))
            elif url != DASH and not is_absolute_http_url(url):
                ctx.problems.append("SRC2 %s: Official URL %r is not absolute"
                                    % (rid, url))
            if official and (sha == DASH or size == DASH):
                ctx.problems.append("SRC2 %s: %s requires artifact hash and "
                                    "byte size" % (rid, ptype))
            if official and not is_utc_timestamp(retrieval):
                ctx.problems.append("SRC2 %s: %s requires a valid UTC "
                                    "Retrieval timestamp" % (rid, ptype))
            elif retrieval != DASH and not is_utc_timestamp(retrieval):
                ctx.problems.append("SRC2 %s: Retrieval timestamp %r is "
                                    "malformed" % (rid, retrieval))
            if ptype in ("ops-provenance", "ext-contract"):
                if not is_utc_timestamp(auth):
                    ctx.problems.append("SRC2 %s: %s requires a valid UTC "
                                        "Authentication timestamp"
                                        % (rid, ptype))
                if sha != DASH and not is_utc_timestamp(retrieval):
                    ctx.problems.append("SRC2 %s: artifact-bearing %s requires "
                                        "a Retrieval timestamp" % (rid, ptype))
            elif auth != DASH and not is_utc_timestamp(auth):
                ctx.problems.append("SRC2 %s: Authentication timestamp %r is "
                                    "malformed" % (rid, auth))
            if official and sd == DASH:
                ctx.problems.append("SRC2 %s: %s requires a Source date pair"
                                    % (rid, ptype))
            if sd != DASH:
                if sd.count(":") != 1:
                    ctx.problems.append("SRC2 %s: Source date %r is not a "
                                        "<basis>:<value> pair" % (rid, sd))
                else:
                    b, _, v = sd.partition(":")
                    if vocab_check(ctx, "date-basis", b,
                                   "SRC2 %s source-date basis" % rid):
                        if not value_valid_for_basis(b, v):
                            ctx.problems.append("SRC2 %s: source-date value %r "
                                                "is invalid for basis %s"
                                                % (rid, v, b))
                        if ptype == "official-mutable" and b == "edition" and \
                                not is_season(v):
                            ctx.problems.append("SRC2 %s: official-mutable "
                                                "edition value %r is not a "
                                                "YYYY-YY season" % (rid, v))
                        if ptype == "official-immutable" and is_season(v):
                            ctx.problems.append("SRC2 %s: official-immutable "
                                                "Source date may not use a "
                                                "season value" % rid)
                    rec["date"] = (b, v)
            rec["sha"] = sha
            rec["size"] = size
            rec["status"] = status
            rec["ver"] = ver
        src2[rid] = rec
    identity_field = {
        "official-immutable": "Source title and edition",
        "official-mutable": "Publication identity",
        "ops-provenance": "Named first-party provenance identity",
        "ext-contract": "External determination class",
    }
    optional_detail = {
        "official-immutable": set(),
        "official-mutable": {"Publication date or —", "Season or —",
                             "Archive/snapshot reference or —"},
        "ops-provenance": {"Artifact identity or —"},
        "ext-contract": {"Controlling source/rule reference or —"},
    }
    for expected, (key, rows) in details.items():
        for r in rows:
            rid = r[0].strip("`")
            ident = ctx.f(key, r, identity_field[expected])
            src2.setdefault(rid, {}).setdefault("identity", ident)
            if migration != "post-R3.1":
                continue
            if rid in src2 and src2[rid].get("type") != expected:
                ctx.problems.append("SRC2 %s: detail row is in %s, but base "
                                    "Provenance type is %s"
                                    % (rid, key, src2[rid].get("type")))
            for field in ctx.inv.schema.get(key, [])[1:]:
                value = (ctx.f(key, r, field) or "").strip().strip("`")
                if (not value or value == DASH) and \
                        field not in optional_detail[expected]:
                    ctx.problems.append("SRC2 %s: required %s detail field %s "
                                        "is blank/dash" % (rid, expected, field))
            if expected == "official-mutable":
                pub = (ctx.f(key, r, "Publication date or —")
                       or "").strip().strip("`")
                season = (ctx.f(key, r, "Season or —")
                          or "").strip().strip("`")
                populated = int(pub != DASH) + int(season != DASH)
                if populated != 1:
                    ctx.problems.append("SRC2 %s: official-mutable detail "
                                        "requires exactly one Publication "
                                        "date or Season" % rid)
                if pub != DASH and not (is_real_date(pub) or is_month(pub)):
                    ctx.problems.append("SRC2 %s: Publication date %r is "
                                        "malformed" % (rid, pub))
                if season != DASH and not is_season(season):
                    ctx.problems.append("SRC2 %s: Season %r is not valid "
                                        "YYYY-YY" % (rid, season))
                want = ("publication", pub) if pub != DASH else \
                    ("edition", season)
                if src2.get(rid, {}).get("date") != want:
                    ctx.problems.append("SRC2 %s: official-mutable detail "
                                        "date/season does not equal the base "
                                        "Source date primary pair" % rid)
            elif expected == "ops-provenance":
                effective = (ctx.f(key, r, "Effective date or window")
                             or "").strip().strip("`")
                if not value_valid_for_basis("effective", effective):
                    ctx.problems.append("SRC2 %s: ops-provenance Effective "
                                        "date/window %r is malformed"
                                        % (rid, effective))
                base_date = src2.get(rid, {}).get("date")
                if base_date and base_date != ("effective", effective):
                    ctx.problems.append("SRC2 %s: ops-provenance base Source "
                                        "date does not mirror its governed "
                                        "detail effective date/window" % rid)
    for r in base:
        rid = r[0].strip("`")
        src2.setdefault(rid, {})["base_identity"] = ctx.f(
            "SRC2-base", r, "Source/provenance identity")

    ev_ids = [r[0].strip("`") for r in ev2]
    if len(ev_ids) != len(set(ev_ids)):
        ctx.problems.append("EV2: duplicate component id(s)")
    ctx.problems += duplicate_numbers(
        [int(i.split("-")[1]) for i in ev_ids
         if re.fullmatch(r"EV2-\d{4}", i)], "EV2")

    # Parse the canon's declared compatibility matrix rather than maintaining
    # a second vocabulary table in code.
    matrix = {}
    mt = table_after(ctx.tree.canon, "Compatibility matrix (parseable;")
    classes = set(ctx.vocab("authority-class"))
    ptypes = set(ctx.vocab("provenance-type"))
    for row in pipe_rows(mt):
        cls = row[0].strip().strip("`") if row else ""
        if len(row) != 5 or cls not in classes:
            continue
        matrix[cls] = {
            "deps": set(re.findall(r"\b(?:%s)\b" % "|".join(
                re.escape(x) for x in sorted(classes, key=len, reverse=True)),
                row[1])),
            "roots": set(re.findall(r"\b(?:%s)\b" % "|".join(
                re.escape(x) for x in sorted(ptypes, key=len, reverse=True)),
                row[2])),
        }
    if set(matrix) != classes:
        ctx.problems.append("EV2 compatibility matrix: declared classes do "
                            "not exactly match the authority vocabulary")

    ev = {}
    for r in ev2:
        eid = r[0].strip("`")
        leaf = (ctx.f("EV2-component", r, "Active v2 LEAF") or "").strip("`")
        cls = (ctx.f("EV2-component", r, "Authority class") or "").strip("`")
        vocab_check(ctx, "authority-class", cls, "EV2 %s authority class" % eid)
        if leaf not in active_leaves:
            ctx.problems.append("EV2 %s: references nonexistent active LEAF %s"
                                % (eid, leaf))
        for field in ("Exact locator(s)",
                      "Controlling passage or tight paraphrase",
                      "Passage-to-obligation mapping"):
            value = (ctx.f("EV2-component", r, field)
                     or "").strip().strip("`")
            if not value or value == DASH:
                ctx.problems.append("EV2 %s: required field %s is blank/dash"
                                    % (eid, field))
        srefs, sp = exact_ref_list(
            ctx.f("EV2-component", r, "Source/provenance record IDs or —"),
            r"SRC2-\d{3}", "EV2 %s source references" % eid)
        drefs, dp = exact_ref_list(
            ctx.f("EV2-component", r,
                  "Dependency evidence component IDs or —"),
            r"EV2-\d{4}", "EV2 %s dependency references" % eid)
        ctx.problems += sp + dp
        if not srefs and not drefs:
            ctx.problems.append("EV2 %s: both reference fields are empty "
                                "(source-free terminal component)" % eid)
        for sid in srefs:
            if sid not in src2:
                ctx.problems.append("EV2 %s: references nonexistent %s"
                                    % (eid, sid))
        ev[eid] = {"id": eid, "leaf": leaf, "class": cls,
                   "sources": srefs, "deps": drefs}
    for eid, rec in sorted(ev.items()):
        for did in rec["deps"]:
            if did not in ev:
                ctx.problems.append("EV2 %s: references nonexistent %s"
                                    % (eid, did))

    # Acyclic full closure and terminal provenance-root matrix.
    state, memo = {}, {}

    def roots(eid, stack):
        if eid in memo:
            return memo[eid]
        if state.get(eid) == 1:
            ctx.problems.append("EV2 dependency cycle: %s -> %s"
                                % (" -> ".join(stack), eid))
            return set()
        state[eid] = 1
        rec = ev[eid]
        out = set(rec["sources"])
        allowed_deps = matrix.get(rec["class"], {}).get("deps", set())
        for did in rec["deps"]:
            if did not in ev:
                continue
            dclass = ev[did]["class"]
            if dclass not in allowed_deps:
                ctx.problems.append("EV2 %s: dependency %s class %s is not "
                                    "permitted for consuming class %s"
                                    % (eid, did, dclass, rec["class"]))
            out.update(roots(did, stack + [eid]))
        state[eid] = 2
        memo[eid] = out
        return out

    for eid, rec in sorted(ev.items()):
        rset = roots(eid, [])
        if not rset:
            ctx.problems.append("EV2 %s: complete dependency closure has no "
                                "terminal SRC2 root" % eid)
            continue
        got_types = {src2[s]["type"] for s in rset if s in src2}
        allowed = matrix.get(rec["class"], {}).get("roots", set())
        bad = sorted(got_types - allowed)
        if bad:
            ctx.problems.append("EV2 %s: terminal provenance root type(s) %s "
                                "are forbidden for class %s"
                                % (eid, bad, rec["class"]))
        required = {"OPS": "ops-provenance", "EXT": "ext-contract"}.get(
            rec["class"])
        if required and required not in got_types:
            ctx.problems.append("EV2 %s: class %s has no required %s terminal "
                                "root" % (eid, rec["class"], required))

    # Exact bidirectional LEAF <-> EV2 membership and authority classes.
    listed = {}
    for r in ctx.pop["LEAF-main"]:
        lid = r[0].strip("`")
        erefs, ep = exact_ref_list(ctx.f("LEAF-main", r, "Evidence"),
                                   r"EV2-\d{4}",
                                   "LEAF %s Evidence" % lid,
                                   allow_dash=False)
        ctx.problems += ep
        listed[lid] = set(erefs)
        auths = {x.strip().strip("`") for x in
                 (ctx.f("LEAF-main", r, "Authority") or "").split(",")}
        for eid in erefs:
            if eid not in ev:
                ctx.problems.append("LEAF %s: Evidence references nonexistent "
                                    "%s" % (lid, eid))
            elif ev[eid]["leaf"] != lid:
                ctx.problems.append("LEAF %s: Evidence %s belongs to %s"
                                    % (lid, eid, ev[eid]["leaf"]))
            elif ev[eid]["class"] not in auths:
                ctx.problems.append("LEAF %s: EV2 %s class %s is absent from "
                                    "the LEAF Authority field"
                                    % (lid, eid, ev[eid]["class"]))
        ev_classes = {ev[e]["class"] for e in erefs if e in ev}
        if auths != ev_classes:
            ctx.problems.append("LEAF %s: Authority classes %s do not exactly "
                                "match its EV2 classes %s"
                                % (lid, sorted(auths), sorted(ev_classes)))
    for eid, rec in sorted(ev.items()):
        if eid not in listed.get(rec["leaf"], set()):
            ctx.problems.append("EV2 %s: absent from owning LEAF %s Evidence "
                                "field" % (eid, rec["leaf"]))
    return src2


# --------------------------------------------------------------------------
# 14. DR2 decision records (the COMPLETE population) and DISP detail rows.
# --------------------------------------------------------------------------


def check_dr2(ctx, edges, active_leaves, migration):
    rows = ctx.pop["DR2-generic"]
    if not rows:
        ctx.problems.append("G15R/R11 DR2-generic: the decision-record "
                            "population is absent - no governed decision "
                            "reference can be resolved")
        return {}
    dr2 = {}
    nums = []
    for r in rows:
        did = r[0].strip("`")
        m = re.fullmatch(r"DR2-(\d{4})", did)
        if not m:
            ctx.problems.append("DR2: malformed decision id %r" % did)
            continue
        if did in dr2:
            ctx.problems.append("DR2 %s: duplicate decision record id" % did)
            continue
        nums.append(int(m.group(1)))
        dtype = (ctx.f("DR2-generic", r, "Type") or "").strip("`")
        vocab_check(ctx, "dr2-type", dtype, "DR2 %s type" % did)
        fields = {f: (ctx.f("DR2-generic", r, f) or "").strip()
                  for f in ctx.inv.schema.get("DR2-generic", [])}
        for fname, value in fields.items():
            if not value or (value.strip("`") == DASH and
                             fname != "Resulting active LEAF(s) or —"):
                ctx.problems.append("DR2 %s: required field %s is blank/dash"
                                    % (did, fname))
        unit = fields.get("Unit/commit", "").strip("`")
        if not re.fullmatch(r"R\d+(?:\.\d+)? / (?:[0-9a-f]{40}|this "
                            r"checkpoint|temporary (?:tree|control))", unit):
            ctx.problems.append("DR2 %s: Unit/commit %r does not match the "
                                "governed <R-unit> / <commit reference> grammar"
                                % (did, unit))
        result = fields.get("Resulting active LEAF(s) or —", "").strip("`")
        if result != DASH and not re.search(
                r"CBA2-[ACRLS][0-9]{2}\.[0-9]+", result):
            ctx.problems.append("DR2 %s: result is neither the explicit dash "
                                "nor an active LEAF reference" % did)
        if dtype in ("DISP", "AMEND") and result != DASH:
            ctx.problems.append("DR2 %s: %s records must carry result — in the "
                                "active-LEAF result field" % (did, dtype))
        dr2[did] = {"id": did, "type": dtype,
                    "subjects": fields.get("Subject(s)", ""),
                    "disposition": fields.get("Disposition", ""),
                    "test": fields.get("Test/tiebreak applied", "").strip("`"),
                    "unit": unit, "result": result, "row": r}
    ctx.problems += contiguous_from_one(sorted(nums), "DR2")

    # A generic DR2 row may be an immutable historical receipt row.  Its
    # formerly-current record references therefore resolve either directly
    # now or through structured AMEND lineage.  Collect the latter cases here
    # and decide them only after the AMEND population has been parsed.
    pending_amended_refs = []
    for did, d in sorted(dr2.items()):
        for lid in re.findall(r"CBA2-[ACRLS][0-9]{2}\.[0-9]+", d["result"]):
            if lid not in active_leaves:
                pending_amended_refs.append((
                    "LEAF", lid,
                    "DR2 %s: resulting LEAF %s does not exist" % (did, lid)))
        body = " ".join(d["row"])
        resolvers = {
            "XW2": set(ctx.ids("XW2-edge")),
            "SXW2": set(ctx.ids("SXW2-edge")),
            "SRC2": set(ctx.ids("SRC2-base")),
            "EV2": set(ctx.ids("EV2-component")),
            "BND": set(ctx.ids("BND-bundle")),
            "SM2": set(ctx.ids("SM2-record")),
            "SS2": set(ctx.ids("SS2-record")),
            "BLK": set(ctx.ids("BLK-record")),
            "RES": set(ctx.ids("RES-record")),
        }
        for prefix, known in resolvers.items():
            width = {"XW2": 4, "SXW2": 4, "SRC2": 3, "EV2": 4,
                     "BND": 4, "SM2": 4, "SS2": 4, "BLK": 4,
                     "RES": 4}[prefix]
            for ref in re.findall(r"%s-\d{%d}" % (prefix, width), body):
                if ref not in known:
                    pending_amended_refs.append((
                        prefix, ref,
                        "DR2 %s: record reference %s does not resolve"
                        % (did, ref)))
    ctx.pending_amended_dr2_references = pending_amended_refs

    # every register decision reference resolves to an existing DR2 record
    for e in edges:
        if e["dec"] not in dr2:
            ctx.problems.append("XW2 %s: decision reference %s resolves to no "
                                "DR2 record (nonexistent decision)"
                                % (e["id"], e["dec"]))
        elif e.get("deferred") and dr2[e["dec"]]["type"] != "OWN":
            ctx.problems.append(
                "XW2 %s: deferred edge must directly reference one current "
                "OWN decision, not %s"
                % (e["id"], dr2[e["dec"]]["type"]))
        elif e.get("deferred") and dr2[e["dec"]]["result"] != DASH:
            ctx.problems.append(
                "XW2 %s: deferred OWN decision must carry result — while no "
                "active target exists" % e["id"])
        elif e.get("same_family"):
            decision = dr2[e["dec"]]
            join = re.fullmatch(
                r"same-family-sibling:(XW2-\d{4})->"
                r"(CBA2-[ACRLS]\d{2}\.\d+); "
                r"natural-family:([ACRLS]); resolving-unit:(R[4-6])",
                decision["test"])
            if not join:
                ctx.problems.append(
                    "XW2 %s: same-family deferred OWN Test/tiebreak applied "
                    "field must equal the canon-pinned structural join token"
                    % e["id"])
            else:
                sibling_id, sibling_target, natural_family, unit = \
                    join.groups()
                e["same_family_join"] = (sibling_id, sibling_target)
                if (sibling_id, sibling_target) not in \
                        e.get("same_family_siblings", []):
                    ctx.problems.append(
                        "XW2 %s: same-family OWN structural join "
                        "%s->%s does not resolve to a qualifying different-"
                        "fragment cross-family sibling"
                        % (e["id"], sibling_id, sibling_target))
                source_family = e["deferral"][0]
                if natural_family != source_family:
                    ctx.problems.append(
                        "XW2 %s: same-family OWN natural-family %s does not "
                        "equal historical source family %s"
                        % (e["id"], natural_family, source_family))
                if unit != e["deferral"][2] or \
                        unit != e.get("same_family_expected_unit"):
                    ctx.problems.append(
                        "XW2 %s: same-family OWN resolving unit %s does not "
                        "join both the edge and governed later-unit map"
                        % (e["id"], unit))
            current_unit = re.match(r"R(\d+)(?:\.(\d+))? /", decision["unit"])
            later_unit = re.fullmatch(
                r"R(\d+)", e.get("same_family_expected_unit") or "")
            if current_unit and later_unit:
                current_key = (int(current_unit.group(1)),
                               int(current_unit.group(2) or 0))
                later_key = (int(later_unit.group(1)), 0)
                if current_key >= later_key:
                    ctx.problems.append(
                        "XW2 %s: same-family deferral is a same-unit or "
                        "non-later-unit deferral (%s -> %s)"
                        % (e["id"], decision["unit"].split(" /", 1)[0],
                           e.get("same_family_expected_unit")))
    for r in ctx.pop["LEAF-detail"]:
        lid = r[0].strip("`")
        cell = ctx.f("LEAF-detail", r, "Decision records") or ""
        for ref in re.findall(r"DR2-\d{4}", cell):
            if ref not in dr2:
                ctx.problems.append("LEAF %s: decision reference %s resolves to "
                                    "no DR2 record" % (lid, ref))
            elif (int(ref.rsplit("-", 1)[1]) >= 59
                  and dr2[ref]["type"] in ("ATOM", "ORIGIN")):
                results = set(re.findall(
                    r"CBA2-[ACRLS][0-9]{2}\.[0-9]+",
                    dr2[ref]["result"]))
                if lid not in results:
                    ctx.problems.append(
                        "LEAF %s: %s %s does not name this LEAF in its "
                        "Resulting active LEAF(s) field"
                        % (lid, dr2[ref]["type"], ref))
    return dr2


def check_leaf_references(ctx, edges, dr2, active_leaves):
    """Resolve the two LEAF reference surfaces R2.11 left unchecked."""
    xedges = {e["id"]: e for e in edges
              if e.get("register", "XW2") == "XW2"}
    origins = {}
    for r in ctx.pop["LEAF-main"]:
        lid = r[0].strip("`")
        raw = (ctx.f("LEAF-main", r, "Origin") or "").strip()
        nm = re.fullmatch(r"new \((DR2-\d{4})\)", raw.strip("`"))
        if nm:
            did = nm.group(1)
            if did not in dr2:
                ctx.problems.append("LEAF %s: new Origin decision %s does not "
                                    "resolve" % (lid, did))
            origins[lid] = set()
            continue
        refs, rp = exact_ref_list(raw, r"XW2-\d{4}",
                                  "LEAF %s Origin" % lid,
                                  allow_dash=False)
        ctx.problems += rp
        origins[lid] = set(refs)
        for eid in refs:
            edge = xedges.get(eid)
            if edge is None:
                ctx.problems.append("LEAF %s: Origin references nonexistent "
                                    "%s" % (lid, eid))
            elif edge["terminal"] or edge["tgt"] != lid:
                ctx.problems.append("LEAF %s: Origin %s does not target this "
                                    "active LEAF" % (lid, eid))

    for eid, edge in sorted(xedges.items()):
        if edge["terminal"] or edge.get("deferred"):
            continue
        if eid not in origins.get(edge["tgt"], set()):
            ctx.problems.append("XW2 %s: nonterminal target %s does not "
                                "back-reference the edge in its Origin field"
                                % (eid, edge["tgt"]))

    for r in ctx.pop["LEAF-detail"]:
        lid = r[0].strip("`")
        refs, rp = exact_ref_list(
            ctx.f("LEAF-detail", r, "Dependencies"),
            r"CBA2-[ACRLS]\d{2}\.\d+", "LEAF %s Dependencies" % lid)
        ctx.problems += rp
        for dep in refs:
            if dep not in active_leaves:
                ctx.problems.append("LEAF %s: dependency %s does not resolve "
                                    "to an active LEAF" % (lid, dep))


def check_disp(ctx, edges, dr2, published, sm2_ids, ss2_ids, migration):
    """DISP detail rows: subject polymorphism, joins, uniqueness, grouping."""
    rows = ctx.pop["DISP-detail"]
    edge_by_id = {e["id"]: e for e in edges}
    terminal_types = set(ctx.vocab("xw2-terminal-edge-type"))
    reason_for = {"invalid": "false-claim", "process-only": "process-material",
                  "no-successor": "out-of-scope-or-obsolete",
                  "unsupported-residual": "authority-not-located"}
    details = []
    seen_key, seen_key_basis = {}, {}
    by_parent = {}
    for r in rows:
        did = r[0].strip("`")
        g = lambda f: (ctx.f("DISP-detail", r, f) or "").strip()
        cls = g("DISP subject class").strip("`")
        hleaf = g("Historical source LEAF or —").strip("`")
        hfrag = g("Historical fragment ID or —").strip("`")
        scen = g("Historical scenario or —").strip("`")
        sfrag = g("Scenario fragment ID or —").strip("`")
        nscope = g("Normalized scope")
        edge = g("Terminal edge ID").strip("`")
        etype = g("Terminal edge type").strip("`")
        smids = g("Search-manifest IDs or —")
        ssid = g("Search-set ID or —").strip("`")
        evref = g("Evidence/provenance references or —")
        reason = g("No-owner reason").strip("`")
        anchor = g("Preserved candidate anchor or —")
        lim = g("Limitations")
        reopen = g("Reopening condition")
        sup = g("Superseding/current relationship or —")
        status = g("Status").strip("`")
        ver = g("Version").strip("`")
        if not vocab_check(ctx, "disp-subject-class", cls,
                           "DISP %s subject class" % did):
            continue
        vocab_check(ctx, "record-status", status, "DISP %s status" % did)
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("DISP %s: Version %r is not an unpadded "
                                "positive integer" % (did, ver))
        parent = dr2.get(did)
        if not parent:
            ctx.problems.append("DISP %s: detail row has no current generic "
                                "DR2 parent (orphan detail row)" % did)
        elif parent["type"] != "DISP":
            ctx.problems.append("DISP %s: generic parent is typed %r, not DISP "
                                "(compatibility matrix)" % (did, parent["type"]))
        if cls == "XW2-DISP":
            if hleaf == DASH or hfrag == DASH:
                ctx.problems.append("DISP %s: XW2-DISP requires both Historical "
                                    "source LEAF and Historical fragment ID"
                                    % did)
            if scen != DASH or sfrag != DASH:
                ctx.problems.append("DISP %s: XW2-DISP forbids scenario subject "
                                    "fields (must be exactly the dash)" % did)
            if hfrag != DASH and not hfrag.startswith(hleaf + ":F"):
                ctx.problems.append("DISP %s: fragment %s does not belong to "
                                    "LEAF %s" % (did, hfrag, hleaf))
            if published.ok and hleaf not in published.leaf_len:
                ctx.problems.append("DISP %s: historical LEAF %s is not in the "
                                    "pinned published population"
                                    % (did, hleaf))
            subject_key = (cls, hleaf, hfrag)
        else:
            if scen == DASH or sfrag == DASH:
                ctx.problems.append("DISP %s: SXW2-DISP requires both Historical "
                                    "scenario and Scenario fragment ID" % did)
            if hleaf != DASH or hfrag != DASH:
                ctx.problems.append("DISP %s: SXW2-DISP forbids LEAF subject "
                                    "fields (must be exactly the dash)" % did)
            m = re.fullmatch(r"scenario-(\d+)", scen)
            if not m:
                ctx.problems.append("DISP %s: scenario identifier %r is "
                                    "malformed" % (did, scen))
            elif published.ok and int(m.group(1)) not in published.scenario_len:
                ctx.problems.append("DISP %s: scenario %s does not exist in the "
                                    "pinned published 1-89 population"
                                    % (did, scen))
            if sfrag != DASH and not re.fullmatch(
                    re.escape(scen) + r":F[0-9]+", sfrag):
                ctx.problems.append("DISP %s: scenario fragment %r does not "
                                    "belong to %s" % (did, sfrag, scen))
            if smids != DASH or ssid != DASH:
                ctx.problems.append("DISP %s: SXW2-DISP carries search "
                                    "machinery (SM2/SS2 are XW2-only)" % did)
            subject_key = (cls, scen, sfrag)
        atoms, ap = span_atoms(nscope)
        ctx.problems += ["DISP %s normalized scope: %s" % (did, p) for p in ap]
        length = None
        if cls == "XW2-DISP" and published.ok:
            length = published.leaf_len.get(hleaf)
        elif cls == "SXW2-DISP" and published.ok:
            mm = re.fullmatch(r"scenario-(\d+)", scen)
            if mm:
                length = published.scenario_len.get(int(mm.group(1)))
        if length is not None:
            for a, b in atoms:
                if b > length:
                    ctx.problems.append("DISP %s: normalized-scope endpoint %d "
                                        "exceeds the subject's normalized text "
                                        "length %d (impossible coordinate)"
                                        % (did, b, length))
        allowed = (ctx.vocab("xw2-terminal-edge-type") if cls == "XW2-DISP"
                   else ctx.vocab("sxw2-terminal-edge-type"))
        if etype not in allowed:
            ctx.problems.append("DISP %s: terminal edge type %r is not allowed "
                                "for subject class %s" % (did, etype, cls))
        vocab_check(ctx, "no-owner-reason", reason, "DISP %s no-owner reason"
                    % did)
        if etype in reason_for and reason != reason_for[etype]:
            ctx.problems.append("DISP %s: no-owner reason %r is wrong for "
                                "terminal edge type %s (compatibility matrix "
                                "requires %r)" % (did, reason, etype,
                                                  reason_for[etype]))
        if etype == "unsupported-residual":
            if not re.search(r"SM2-\d{4}", smids or ""):
                ctx.problems.append("DISP %s: unsupported-residual carries no "
                                    "SM2 search records" % did)
            if not re.fullmatch(r"SS2-\d{4}", ssid or ""):
                ctx.problems.append("DISP %s: unsupported-residual carries no "
                                    "SS2 search-set reference" % did)
            if anchor in (DASH, ""):
                ctx.problems.append("DISP %s: unsupported-residual carries no "
                                    "preserved-candidate anchor" % did)
        for sid in re.findall(r"SM2-\d{4}", smids or ""):
            if sid not in sm2_ids:
                ctx.problems.append("DISP %s: cites nonexistent %s"
                                    % (did, sid))
        if ssid not in (DASH, "") and ssid not in ss2_ids:
            ctx.problems.append("DISP %s: cites nonexistent search set %s"
                                % (did, ssid))
        e = edge_by_id.get(edge)
        if e is not None:
            reg = "SXW2" if e.get("register") == "SXW2" else "XW2"
            want = "SXW2-DISP" if reg == "SXW2" else "XW2-DISP"
            if cls != want:
                ctx.problems.append("DISP %s: subject class %s does not agree "
                                    "with the register of terminal edge %s "
                                    "(subject-family mismatch)"
                                    % (did, cls, edge))
        if cls == "SXW2-DISP":
            if e is None:
                ctx.problems.append("DISP %s: terminal edge %s resolves to no "
                                    "SXW2 edge (orphan disposition)"
                                    % (did, edge))
            else:
                if not e["terminal"]:
                    ctx.problems.append("DISP %s: edge %s is not a terminal "
                                        "edge" % (did, edge))
                if e["type"] != etype:
                    ctx.problems.append("DISP %s: terminal edge type %r != the "
                                        "edge's own type %r (edge/detail "
                                        "disagreement)" % (did, etype, e["type"]))
                if e["src"] != scen:
                    ctx.problems.append("DISP %s: subject scenario %s != edge "
                                        "source %s" % (did, scen, e["src"]))
                if e["frag"] and e["frag"] != sfrag:
                    ctx.problems.append("DISP %s: subject scenario fragment %s "
                                        "!= the edge's leading fragment token "
                                        "%s" % (did, sfrag, e["frag"]))
                if e["dec"] != did:
                    ctx.problems.append("DISP %s: edge %s names decision %s, "
                                        "not this record (bidirectional "
                                        "disagreement)" % (did, edge, e["dec"]))
        if cls == "XW2-DISP":
            if e is None:
                ctx.problems.append("DISP %s: terminal edge %s resolves to no "
                                    "XW2 edge (orphan disposition)"
                                    % (did, edge))
            else:
                if not e["terminal"]:
                    ctx.problems.append("DISP %s: edge %s is not a terminal "
                                        "edge" % (did, edge))
                if e["type"] != etype:
                    ctx.problems.append("DISP %s: terminal edge type %r != the "
                                        "edge's own type %r (edge/detail "
                                        "disagreement)" % (did, etype, e["type"]))
                if e["src"] != hleaf:
                    ctx.problems.append("DISP %s: subject LEAF %s != edge "
                                        "source %s (edge/detail disagreement)"
                                        % (did, hleaf, e["src"]))
                if e["frag"] and e["frag"] != hfrag:
                    ctx.problems.append("DISP %s: subject fragment %s != the "
                                        "edge's leading fragment token %s"
                                        % (did, hfrag, e["frag"]))
                if e["dec"] != did:
                    ctx.problems.append("DISP %s: edge %s names decision %s, "
                                        "not this record (bidirectional "
                                        "disagreement)" % (did, edge, e["dec"]))
        # The normalized-scope join is identical for XW2 and SXW2. R2.10
        # accidentally placed it only inside the XW2 branch.
        if e is not None:
            eatoms, ep = edge_scope_atoms(e)
            if ep and migration == "post-R3.1":
                ctx.problems += ["DISP %s: %s" % (did, p) for p in ep]
            elif eatoms and not spans_equal(eatoms, atoms):
                ctx.problems.append("DISP %s: Normalized scope is not "
                                    "span-set-equal to the %s edge's own "
                                    "fragment scope" % (did, e.get(
                                        "register", "XW2")))
        if status == "current":
            if subject_key in seen_key:
                ctx.problems.append("DISP %s: duplicate current disposition for "
                                    "terminal-subject key %s (also %s)"
                                    % (did, subject_key, seen_key[subject_key]))
            seen_key[subject_key] = did
            kb = subject_key + (reason,)
            if kb in seen_key_basis:
                ctx.problems.append("DISP %s: duplicate current DISP detail row "
                                    "for subject key and basis %s" % (did, kb))
            seen_key_basis[kb] = did
        d = {"did": did, "cls": cls, "leaf": hleaf, "frag": hfrag,
             "scen": scen, "sfrag": sfrag, "scope": nscope, "atoms": atoms,
             "edge": edge, "etype": etype, "sm": smids, "ss": ssid,
             "ev": evref, "reason": reason, "anchor": anchor, "lim": lim,
             "reopen": reopen, "status": status, "ver": ver, "sup": sup}
        details.append(d)
        by_parent.setdefault(did, []).append(d)

    # Terminal-base equality: rows grouped under one DR2 record must be equal.
    def base_tuple(d):
        return (d["cls"], d["etype"], d["reason"],
                tuple(merge_spans(d["atoms"])),
                d["leaf"], d["frag"], d["scen"], d["sfrag"],
                frozenset(re.findall(r"SM2-\d{4}", d["sm"])),
                d["ss"], frozenset(re.findall(r"(?:SRC2-\d{3}|EV2-\d{4})",
                                              d["ev"])),
                d["anchor"], d["lim"], d["reopen"])
    for did, ds in sorted(by_parent.items()):
        if len(ds) < 2:
            continue
        if len({d["cls"] for d in ds}) > 1:
            ctx.problems.append("DISP %s: one record carries rows of more than "
                                "one subject class (subject-family mismatch)"
                                % did)
        bases = {base_tuple(d) for d in ds}
        if len(bases) > 1:
            ctx.problems.append("DISP %s: one record covers detail rows whose "
                                "terminal bases are not exactly equal "
                                "(differing fragment, destination, scope, "
                                "basis, or evidence) - distinct dispositions "
                                "require distinct records" % did)

    # Every terminal edge must carry a current DISP detail row (post-migration).
    if migration == "post-R3.1":
        have = {d["edge"] for d in details if d["status"] == "current"}
        for e in edges:
            if e["terminal"] and e["id"] not in have:
                ctx.problems.append("XW2 %s: terminal edge has no current DISP "
                                    "detail row (terminal-edge discipline)"
                                    % e["id"])
            if e["terminal"]:
                d = dr2.get(e["dec"])
                if d and d["type"] != "DISP":
                    ctx.problems.append("XW2 %s: terminal edge references a %s "
                                        "record, not a current DISP "
                                        "(compatibility matrix)"
                                        % (e["id"], d["type"]))
            else:
                d = dr2.get(e["dec"])
                if d and d["type"] == "DISP":
                    ctx.problems.append("XW2 %s: nonterminal edge references a "
                                        "DISP record (compatibility matrix)"
                                        % e["id"])
    return details


# --------------------------------------------------------------------------
# 15. Fragment inventories and disposition bundles.
# --------------------------------------------------------------------------


def check_fragments(ctx, edges, dr2, published, migration):
    rows = ctx.pop["fragment-inventory"]
    bnds = ctx.pop["BND-bundle"]
    edge_by_id = {e["id"]: e for e in edges}
    terminal_types = set(ctx.vocab("xw2-terminal-edge-type"))
    kind_pairing = {"unsupported-residual": "substantive-obligation",
                    "process-only": "process-instruction"}

    frags = {}
    by_leaf = {}
    for r in rows:
        fid = r[0].strip("`")
        g = lambda f: (ctx.f("fragment-inventory", r, f) or "").strip()
        parent = g("Historical parent LEAF").strip("`")
        kind = g("Fragment kind").strip("`")
        authority_qualifier = g(
            "Historical authority qualifier or —").strip("`")
        scope = g("Normalized fragment scope")
        decomp = g("Decomposition decision record").strip("`")
        bundle = g("Disposition bundle ID or —").strip("`")
        edge_ids = g("Disposition edge ID(s)")
        status = g("Fragment status").strip("`")
        ver = g("Fragment version").strip("`")
        if fid in frags:
            ctx.problems.append("fragment %s: duplicate fragment id" % fid)
            continue
        if not fid.startswith(parent + ":F"):
            ctx.problems.append("fragment %s: id does not belong to its "
                                "declared parent LEAF %s" % (fid, parent))
        vocab_check(ctx, "fragment-kind", kind, "fragment %s kind" % fid)
        vocab_check(ctx, "record-status", status, "fragment %s status" % fid)
        if kind == "authority-assertion":
            pinned = published.leaf_authority.get(parent) \
                if published.ok else None
            if not authority_qualifier or authority_qualifier == DASH:
                ctx.problems.append(
                    "fragment %s: authority-assertion requires the exact "
                    "pinned Historical authority qualifier" % fid)
            elif pinned is not None and \
                    normalize_text(authority_qualifier) != pinned:
                ctx.problems.append(
                    "fragment %s: Historical authority qualifier %r does not "
                    "equal pinned published Authority cell %r"
                    % (fid, authority_qualifier, pinned))
        elif authority_qualifier != DASH:
            ctx.problems.append(
                "fragment %s: non-authority fragment kind %s requires "
                "Historical authority qualifier —"
                % (fid, kind))
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("fragment %s: Fragment version %r is not an "
                                "unpadded positive integer" % (fid, ver))
        if decomp not in dr2:
            ctx.problems.append("fragment %s: decomposition decision record %s "
                                "resolves to no DR2 record" % (fid, decomp))
        atoms, ap = span_atoms(scope)
        ctx.problems += ["fragment %s scope: %s" % (fid, p) for p in ap]
        eids = [x.strip().strip("`") for x in edge_ids.split(",")
                if x.strip() and x.strip() != DASH]
        if eids != sorted(eids):
            ctx.problems.append("fragment %s: Disposition edge ID(s) are not "
                                "ascending" % fid)
        if len(eids) != len(set(eids)):
            ctx.problems.append("fragment %s: duplicate disposition edge id(s)"
                                % fid)
        rec = {"id": fid, "leaf": parent, "kind": kind,
               "authority_qualifier": authority_qualifier, "scope": scope,
               "atoms": atoms, "bundle": bundle, "edges": eids,
               "status": status, "ver": ver, "parent": parent,
               "register": "XW2"}
        frags[fid] = rec
        by_leaf.setdefault(parent, []).append(rec)

    # A same-family exception may qualify only through current fragments.
    # Edge-level checks establish the sibling/target/family join; this
    # fragment-level pass closes the lifecycle side of that same join.
    for edge in edges:
        if not edge.get("same_family"):
            continue
        deferred_fragment = frags.get(edge.get("frag"))
        if deferred_fragment is not None \
                and deferred_fragment["status"] != "current":
            ctx.problems.append(
                "XW2 %s: same-family deferred fragment %s is not current"
                % (edge["id"], edge.get("frag")))
        sibling_id, _target = edge.get("same_family_join", (None, None))
        sibling = edge_by_id.get(sibling_id)
        sibling_fragment = frags.get(
            sibling.get("frag")) if sibling is not None else None
        if sibling is not None and (
                sibling_fragment is None
                or sibling_fragment["status"] != "current"):
            ctx.problems.append(
                "XW2 %s: qualifying same-family sibling edge %s does not "
                "resolve to a current sibling fragment"
                % (edge["id"], sibling_id))

    for leaf, fl in sorted(by_leaf.items()):
        nums = []
        for f in fl:
            m = re.fullmatch(re.escape(leaf) + r":F([0-9]+)", f["id"])
            if m:
                nums.append(int(m.group(1)))
        ctx.problems += contiguous_from_one(sorted(nums),
                                            "fragment IDs of %s" % leaf)
        length = published.leaf_len.get(leaf) if published.ok else None
        allatoms = []
        for f in fl:
            if f["status"] == "current":
                allatoms += f["atoms"]
        ctx.problems += partition_problems(allatoms, length,
                                           "fragment partition of %s" % leaf)

    # exactly-once disposition in exactly one of the three shapes
    bnd_by_id = {r[0].strip("`"): r for r in bnds}
    for fid, f in sorted(frags.items()):
        if f["status"] != "current":
            continue
        terminal_edges, nonterminal_edges = [], []
        for eid in f["edges"]:
            e = edge_by_id.get(eid)
            if e is None:
                ctx.problems.append("fragment %s: disposition edge %s resolves "
                                    "to no XW2 edge" % (fid, eid))
                continue
            if e["src"] != f["leaf"]:
                ctx.problems.append("fragment %s: edge %s has historical source "
                                    "%s, not this fragment's LEAF %s"
                                    % (fid, eid, e["src"], f["leaf"]))
            if e["frag"] and e["frag"] != fid:
                ctx.problems.append("fragment %s: edge %s names fragment %s "
                                    "(bidirectional edge/fragment mismatch)"
                                    % (fid, eid, e["frag"]))
            (terminal_edges if e["terminal"] else nonterminal_edges).append(e)
            want_kind = kind_pairing.get(e["type"])
            if want_kind and f["kind"] != want_kind:
                ctx.problems.append("fragment %s: kind %r is incompatible with "
                                    "edge type %r (kind <-> edge-type pairing "
                                    "requires %r)"
                                    % (fid, f["kind"], e["type"], want_kind))
        if not f["edges"]:
            ctx.problems.append("fragment %s: orphan fragment (no disposition)"
                                % fid)
            continue
        # Blocking outcome: `unsupported-residual` is available ONLY to a
        # residual fragment with at least one supported sibling on the same
        # historical LEAF. A whole unsupported valid in-scope obligation is a
        # governed BLK finding, never any terminal edge.
        if any(e["type"] == "unsupported-residual" for e in terminal_edges):
            siblings = [g for g in by_leaf.get(f["leaf"], [])
                        if g["id"] != fid and g["status"] == "current"]
            supported = False
            for g in siblings:
                for geid in g["edges"]:
                    ge = edge_by_id.get(geid)
                    if ge is not None and not ge["terminal"] and \
                            not ge.get("deferred"):
                        supported = True
            if not supported:
                ctx.problems.append(
                    "fragment %s: an `unsupported-residual` disposition with no "
                    "supported sibling fragment on %s is a WHOLE unsupported "
                    "valid in-scope obligation - the mandatory outcome is a "
                    "governed `blocked-unsupported-obligation` finding, never "
                    "a terminal edge" % (fid, f["leaf"]))
        if terminal_edges and nonterminal_edges:
            ctx.problems.append("fragment %s: carries both a terminal and a "
                                "nonterminal disposition (no fragment is "
                                "simultaneously terminal and actively owned)"
                                % fid)
        if len(terminal_edges) > 1:
            ctx.problems.append("fragment %s: carries %d terminal edges (a "
                                "fragment is dispositioned exactly once)"
                                % (fid, len(terminal_edges)))
        if terminal_edges:
            if f["bundle"] != DASH:
                ctx.problems.append("fragment %s: terminal fragment carries a "
                                    "disposition bundle (multi-target-only "
                                    "rule)" % fid)
        elif len(nonterminal_edges) == 1:
            edge = nonterminal_edges[0]
            edge_atoms, edge_problems = edge_scope_atoms(edge)
            ctx.problems += [
                "fragment %s single-target edge %s: %s"
                % (fid, edge["id"], problem)
                for problem in edge_problems]
            if not spans_equal(edge_atoms, f["atoms"]):
                ctx.problems.append(
                    "fragment %s: single-target nonterminal edge %s scope is "
                    "not span-set-equal to the fragment's Normalized fragment "
                    "scope" % (fid, edge["id"]))
            if f["bundle"] != DASH:
                ctx.problems.append("fragment %s: single-target nonterminal "
                                    "fragment carries a bundle (multi-target-"
                                    "only rule requires no bundle)" % fid)
        else:
            if f["bundle"] == DASH:
                ctx.problems.append("fragment %s: multi-target fragment carries "
                                    "no governed BND bundle (required by the "
                                    "multi-target-only rule)" % fid)
            elif f["bundle"] not in bnd_by_id:
                ctx.problems.append("fragment %s: bundle %s resolves to no BND "
                                    "record" % (fid, f["bundle"]))

    # edges naming an unregistered fragment
    if migration == "post-R3.1":
        for e in edges:
            if e["frag"] and e["frag"] not in frags:
                ctx.problems.append("XW2 %s: names unregistered fragment %s "
                                    "(zero edges may name an unregistered "
                                    "fragment)" % (e["id"], e["frag"]))
    return frags


def check_bundles(ctx, frags, edges, dr2):
    rows = ctx.pop["BND-bundle"]
    edge_by_id = {e["id"]: e for e in edges}
    sole_owner = {"equivalent", "moved"}
    seen = set()
    for r in rows:
        bid = r[0].strip("`")
        g = lambda f: (ctx.f("BND-bundle", r, f) or "").strip()
        subject_class = g("BND subject class").strip("`")
        leaf = g("Source historical LEAF or —").strip("`")
        scen = g("Historical scenario or —").strip("`")
        sfrag = g("Source fragment ID").strip("`")
        mids = [x.strip().strip("`") for x in g("Member edge IDs").split(",")
                if x.strip()]
        mtypes = [x.strip().strip("`") for x in g("Member edge types").split(",")
                  if x.strip()]
        mtargets = [x.strip().strip("`") for x in
                    g("Member target IDs").split(",") if x.strip()]
        mscopes = [x.strip() for x in g("Member subject scopes").split(",")
                   if x.strip()]
        subj = g("Subject scope")
        bclass = g("Bundle class").strip("`")
        status = g("Bundle status").strip("`")
        ver = g("Bundle version").strip("`")
        if bid in seen:
            ctx.problems.append("BND %s: duplicate bundle id" % bid)
            continue
        seen.add(bid)
        if not vocab_check(ctx, "bundle-subject-class", subject_class,
                           "BND %s subject class" % bid):
            continue
        if subject_class == "XW2-BND":
            if leaf == DASH or scen != DASH or not sfrag.startswith(leaf + ":F"):
                ctx.problems.append("BND %s: XW2-BND requires a LEAF/fragment "
                                    "subject and forbids Historical scenario"
                                    % bid)
            register = "XW2"
            parent = leaf
            nonterminal = set(ctx.vocab("xw2-edge-type")) - set(
                ctx.vocab("xw2-terminal-edge-type"))
            nonterminal.discard("deferred")
        else:
            if scen == DASH or leaf != DASH or not sfrag.startswith(scen + ":F"):
                ctx.problems.append("BND %s: SXW2-BND requires a scenario/"
                                    "fragment subject and forbids Source "
                                    "historical LEAF" % bid)
            register = "SXW2"
            parent = scen
            nonterminal = set(ctx.vocab("sxw2-edge-type")) - set(
                ctx.vocab("sxw2-terminal-edge-type"))
        vocab_check(ctx, "bundle-class", bclass, "BND %s class" % bid)
        vocab_check(ctx, "record-status", status, "BND %s status" % bid)
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("BND %s: Bundle version %r is not an unpadded "
                                "positive integer" % (bid, ver))
        if len(mids) < 2:
            ctx.problems.append("BND %s: a bundle requires at least 2 member "
                                "edges (a one-member bundle is malformed)"
                                % bid)
        if mids != sorted(mids):
            ctx.problems.append("BND %s: member edge IDs are not ascending"
                                % bid)
        if len(mids) != len(set(mids)):
            ctx.problems.append("BND %s: duplicate member edge id(s)" % bid)
        if not (len(mids) == len(mtypes) == len(mtargets) == len(mscopes)):
            ctx.problems.append("BND %s: member edge IDs/types/targets/subject "
                                "scopes are not aligned position-for-position "
                                "(%d/%d/%d/%d)" % (bid, len(mids), len(mtypes),
                                                   len(mtargets), len(mscopes)))
            continue
        if len(set(mtargets)) != len(mtargets):
            ctx.problems.append("BND %s: duplicate (source fragment, target) "
                                "mapping" % bid)
        for t in mtypes:
            if subject_class == "XW2-BND" and t == "deferred":
                ctx.problems.append(
                    "BND %s: deferred edge may never appear as a bundle "
                    "member; it is an unbundled temporary single-fragment "
                    "shape" % bid)
            elif t not in nonterminal:
                ctx.problems.append("BND %s: member edge type %r is not a "
                                    "nonterminal type (active/terminal mixing "
                                    "fails)" % (bid, t))
            elif t in sole_owner:
                ctx.problems.append("BND %s: member edge type %r is a "
                                    "whole-fragment sole-owner type and may "
                                    "never appear as a bundle member "
                                    "(member-compatibility matrix)" % (bid, t))
        f = frags.get(sfrag)
        if f is None:
            ctx.problems.append("BND %s: source fragment %s resolves to no "
                                "inventoried fragment" % (bid, sfrag))
        else:
            if f.get("parent", f.get("leaf")) != parent or \
                    f.get("register") != register:
                ctx.problems.append("BND %s: %s subject %s does not own "
                                    "fragment %s" % (bid, register, parent,
                                                      sfrag))
            if f["bundle"] != bid:
                ctx.problems.append("BND %s: fragment %s does not back-reference "
                                    "this bundle (orphan bundle)" % (bid, sfrag))
            if sorted(f["edges"]) != sorted(mids):
                ctx.problems.append("BND %s: member edge set != the fragment's "
                                    "Disposition edge ID(s) (set equality "
                                    "required)" % bid)
        subj_atoms, sp = span_atoms(subj)
        ctx.problems += ["BND %s subject scope: %s" % (bid, p) for p in sp]
        if f is not None and not spans_equal(subj_atoms, f["atoms"]):
            ctx.problems.append("BND %s: Subject scope is not span-set-equal to "
                                "the fragment's Normalized fragment scope"
                                % bid)
        member_atoms = []
        for i, ms in enumerate(mscopes):
            ats, mp = span_atoms(ms)
            ctx.problems += ["BND %s member %d subject scope: %s"
                             % (bid, i + 1, p) for p in mp]
            member_atoms += ats
            merged_subj = merge_spans(subj_atoms)
            for a, b in ats:
                inside = any(a >= x and b <= y for x, y in merged_subj)
                if not inside:
                    ctx.problems.append("BND %s: member %d sub-scope span:%d-%d "
                                        "lies outside the bundle's Subject "
                                        "scope" % (bid, i + 1, a, b))
            e = edge_by_id.get(mids[i]) if i < len(mids) else None
            if e is None:
                ctx.problems.append("BND %s: member edge %s resolves to no "
                                    "%s edge" % (bid, mids[i], register))
                continue
            ereg = e.get("register", "XW2")
            if ereg != register:
                ctx.problems.append("BND %s: member edge %s belongs to %s, "
                                    "not %s" % (bid, e["id"], ereg, register))
            if e["frag"] and e["frag"] != sfrag:
                ctx.problems.append("BND %s: member edge %s names fragment %s, "
                                    "not the bundle's source fragment %s "
                                    "(wrong-fragment edge)"
                                    % (bid, e["id"], e["frag"], sfrag))
            if e["type"] != mtypes[i]:
                ctx.problems.append("BND %s: member %d declared type %r != the "
                                    "edge's own type %r"
                                    % (bid, i + 1, mtypes[i], e["type"]))
            if register == "XW2" and e.get("deferred"):
                ctx.problems.append(
                    "BND %s: deferred edge %s may never be a bundle member"
                    % (bid, e["id"]))
            if e["tgt"] != mtargets[i]:
                ctx.problems.append("BND %s: member %d declared target %r != "
                                    "the edge's own target %r"
                                    % (bid, i + 1, mtargets[i], e["tgt"]))
            eatoms, ep = edge_scope_atoms(e)
            ctx.problems += ["BND %s member %d: %s" % (bid, i + 1, p)
                             for p in ep]
            if eatoms and not spans_equal(ats, eatoms):
                ctx.problems.append("BND %s: member %d subject scope is not "
                                    "span-set-equal to member edge %s's own "
                                    "scope (positional scope join)"
                                    % (bid, i + 1, e["id"]))
        if spans_overlap(member_atoms):
            ctx.problems.append("BND %s: member sub-scopes overlap (a character "
                                "is carried twice)" % bid)
        if member_atoms and not spans_equal(member_atoms, subj_atoms):
            ctx.problems.append("BND %s: the union of member sub-scopes does "
                                "not equal the Subject scope (undispositioned "
                                "residual - the members do not together carry "
                                "the whole fragment)" % bid)


# --------------------------------------------------------------------------
# 16. Source-date components (with the R2.10 lifecycle fields).
# --------------------------------------------------------------------------


def check_date_components(ctx, src2, dr2, migration):
    rows = ctx.pop["SRC2-date-component"]
    comps, by_record = {}, {}
    seen_triple, primaries = {}, {}
    for r in rows:
        g = lambda f: (ctx.f("SRC2-date-component", r, f) or "").strip()
        rid = r[0].strip("`")
        cid = g("Date component ID").strip("`")
        basis = g("Date basis").strip("`")
        role = g("Date role/scope").strip("`")
        value = g("Date value").strip("`")
        locator = g("Source statement locator")
        lim = g("Limitations or —")
        status = g("Component status").strip("`")
        ver = g("Component version").strip("`")
        sup = g("Superseding/current relationship or —").strip("`")
        if cid in comps:
            ctx.problems.append("date component %s: duplicate component id"
                                % cid)
            continue
        if not re.fullmatch(re.escape(rid) + r"#D[1-9][0-9]*", cid):
            ctx.problems.append("date component %s: id does not match "
                                "<Record ID>#D<k> for record %s" % (cid, rid))
        if rid not in src2:
            ctx.problems.append("date component %s: parent record %s does not "
                                "exist (orphan component)" % (cid, rid))
        vocab_check(ctx, "date-basis", basis, "date component %s basis" % cid)
        vocab_check(ctx, "record-status", status,
                    "date component %s status" % cid)
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("date component %s: Component version %r is not "
                                "an unpadded positive integer" % (cid, ver))
        if role != "primary" and not re.fullmatch(
                r"scoped:[a-z0-9][a-z0-9._-]{0,63}", role):
            ctx.problems.append("date component %s: role/scope %r is neither "
                                "'primary' nor scoped:<slug>" % (cid, role))
        if not value_valid_for_basis(basis, value):
            ctx.problems.append("date component %s: value %r is invalid for "
                                "basis %s" % (cid, value, basis))
        if is_month(value) and not is_season(value):
            if not re.search(r"month precision", lim or "", re.I):
                ctx.problems.append("date component %s: month-precision value "
                                    "carries no mandatory month-precision "
                                    "limitation entry" % cid)
        if sup != DASH:
            m = re.fullmatch(r"supersedes (\S+#D[0-9]+) per AMEND (DR2-\d{4})",
                             sup)
            if not m:
                ctx.problems.append("date component %s: superseding relationship "
                                    "%r does not match the governed grammar"
                                    % (cid, sup))
            else:
                if m.group(2) not in dr2 or dr2[m.group(2)]["type"] != "AMEND":
                    ctx.problems.append("date component %s: superseding "
                                        "relationship names %s, which is not a "
                                        "current AMEND record"
                                        % (cid, m.group(2)))
        rec = {"id": cid, "rid": rid, "basis": basis, "role": role,
               "value": value, "status": status, "ver": ver, "sup": sup}
        comps[cid] = rec
        by_record.setdefault(rid, []).append(rec)
        if status == "current":
            triple = (rid, basis, role)
            if triple in seen_triple:
                ctx.problems.append("date component %s: duplicate current row "
                                    "for (Record ID, basis, role/scope) %s "
                                    "(also %s)"
                                    % (cid, triple, seen_triple[triple]))
            seen_triple[triple] = cid
            if role == "primary":
                pk = (rid, basis)
                if pk in primaries:
                    ctx.problems.append("date component %s: a second current "
                                        "'primary' row for %s (exactly one "
                                        "primary per basis)" % (cid, pk))
                primaries[pk] = rec

    for cid, c in sorted(comps.items()):
        if c["sup"] != DASH:
            m = re.fullmatch(r"supersedes (\S+#D[0-9]+) per AMEND DR2-\d{4}",
                             c["sup"])
            if m:
                prior = m.group(1)
                if prior not in comps:
                    ctx.problems.append("date component %s: supersedes %s, "
                                        "which does not exist" % (cid, prior))
                elif comps[prior]["status"] != "superseded":
                    ctx.problems.append("date component %s: supersedes %s, "
                                        "which is still marked current "
                                        "(supersession chain does not "
                                        "terminate in exactly one current "
                                        "endpoint)" % (cid, prior))
    for rid, cl in sorted(by_record.items()):
        nums = []
        for c in cl:
            m = re.fullmatch(re.escape(rid) + r"#D([0-9]+)", c["id"])
            if m:
                nums.append(int(m.group(1)))
        ctx.problems += contiguous_from_one(sorted(nums),
                                            "date component IDs of %s" % rid)

    if migration == "post-R3.1":
        for rid, rec in sorted(src2.items()):
            if "date" not in rec:
                continue
            b, v = rec["date"]
            if b == "" or v == "":
                continue
            p = primaries.get((rid, b))
            if p is None:
                ctx.problems.append("SRC2 %s: base Source date pair %s:%s has "
                                    "no current 'primary' date-component row "
                                    "(the base pair is always its basis's "
                                    "primary component)" % (rid, b, v))
            elif p["value"] != v:
                ctx.problems.append("SRC2 %s: base Source date value %r != its "
                                    "current primary component value %r"
                                    % (rid, v, p["value"]))
            if rid in src2 and not any(c["rid"] == rid for c in comps.values()):
                ctx.problems.append("SRC2 %s: carries a Source date pair but "
                                    "no date-component rows at all" % rid)
        for rid in sorted(src2):
            if rid not in by_record and src2[rid].get("date"):
                ctx.problems.append("SRC2 %s: date-component population is "
                                    "absent for a record that relies on a "
                                    "semantic date" % rid)
    return comps, primaries


# --------------------------------------------------------------------------
# 17. SM2 / SS2 — search manifests and search sets.
# --------------------------------------------------------------------------


def check_sm2_ss2(ctx, src2, frags, disp_details, blk_anchors):
    sm2_rows = ctx.pop["SM2-record"]
    ss2_rows = ctx.pop["SS2-record"]
    sm2, uniq = {}, {}
    for r in sm2_rows:
        sid = r[0].strip("`")
        g = lambda f: (ctx.f("SM2-record", r, f) or "").strip()
        cls = g("Subject class").strip("`")
        leaf = g("Subject historical LEAF or —").strip("`")
        frag = g("Subject historical fragment ID or —").strip("`")
        anchor = g("Subject candidate anchor or —").strip("`")
        acls = g("Authority/provenance class searched").strip("`")
        ident = g("Source identity")
        srec = g("Source record ID or —").strip("`")
        url = g("Canonical URL or authenticated provenance identifier or —")
        bident = g("Binary/version identity or —")
        bsize = g("Binary size bytes or —").strip("`")
        bsha = g("Binary SHA-256 or —").strip("`")
        bpag = g("Binary pagination or —").strip("`")
        bsig = g("Binary signature/as-of or —").strip("`")
        locator = g("Exact locator/query/provision")
        method = g("Search method").strip("`")
        setid = g("Search-set ID or —").strip("`")
        cutoff = g("Search cutoff timestamp").strip("`")
        result = g("Result").strip("`")
        status = g("Search status").strip("`")
        ver = g("Search version").strip("`")
        if sid in sm2:
            ctx.problems.append("SM2 %s: duplicate search record id" % sid)
            continue
        if not vocab_check(ctx, "sm2-subject-class", cls,
                           "SM2 %s subject class" % sid):
            continue
        vocab_check(ctx, "search-method", method, "SM2 %s search method" % sid)
        vocab_check(ctx, "search-result", result, "SM2 %s result" % sid)
        vocab_check(ctx, "record-status", status, "SM2 %s status" % sid)
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("SM2 %s: Search version %r is not an unpadded "
                                "positive integer" % (sid, ver))
        if cls == "XW2-DISP":
            if leaf == DASH or frag == DASH:
                ctx.problems.append("SM2 %s: XW2-DISP requires both subject "
                                    "LEAF and subject fragment" % sid)
            if anchor != DASH:
                ctx.problems.append("SM2 %s: XW2-DISP forbids a candidate "
                                    "anchor" % sid)
            if frag != DASH and frags and frag not in frags:
                ctx.problems.append("SM2 %s: subject fragment %s resolves to no "
                                    "inventoried fragment" % (sid, frag))
            subject = (cls, leaf, frag)
        else:
            if leaf != DASH or frag != DASH:
                ctx.problems.append("SM2 %s: candidate-obligation forbids LEAF "
                                    "and fragment subject fields" % sid)
            if anchor == DASH:
                ctx.problems.append("SM2 %s: candidate-obligation requires a "
                                    "subject candidate anchor" % sid)
            if blk_anchors and anchor not in blk_anchors:
                ctx.problems.append("SM2 %s: candidate anchor %r matches no "
                                    "governed BLK finding anchor"
                                    % (sid, anchor))
            subject = (cls, anchor)
        if acls not in (list(ctx.vocab("authority-class"))
                        + list(ctx.vocab("provenance-type"))):
            ctx.problems.append("SM2 %s: Authority/provenance class searched "
                                "%r is in neither governed vocabulary"
                                % (sid, acls))
        if not ident or ident == DASH:
            ctx.problems.append("SM2 %s: Source identity is never a dash" % sid)
        if re.search(r"official web surfaces|various sources|the web",
                     ident or "", re.I):
            ctx.problems.append("SM2 %s: vague source identity %r is inadequate"
                                % (sid, ident))
        if not re.match(r"(provision|locator|query):\S", locator or ""):
            ctx.problems.append("SM2 %s: Exact locator/query/provision must "
                                "begin with provision:, locator:, or query:"
                                % sid)
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z",
                            cutoff or ""):
            ctx.problems.append("SM2 %s: Search cutoff timestamp is not "
                                "ISO-8601 UTC" % sid)
        if bsha != DASH and not re.fullmatch(r"[0-9a-f]{64}", bsha):
            ctx.problems.append("SM2 %s: Binary SHA-256 is malformed" % sid)
        if bsize != DASH and not re.fullmatch(r"[1-9]\d*", bsize):
            ctx.problems.append("SM2 %s: Binary size bytes is malformed" % sid)
        if bpag != DASH and not re.match(r"pages=[1-9]\d*", bpag):
            ctx.problems.append("SM2 %s: Binary pagination must begin with "
                                "pages=<n>" % sid)
        if bsig != DASH and not (bsig in ("signed", "unsigned")
                                 or re.fullmatch(r"as-of:\d{4}-\d{2}-\d{2}",
                                                 bsig)):
            ctx.problems.append("SM2 %s: Binary signature/as-of %r is not in "
                                "the governed vocabulary" % (sid, bsig))
        if url != DASH and not (re.match(r"https?://", url)
                                or re.fullmatch(
                                    r"provenance:[a-z0-9][a-z0-9._-]{0,63}",
                                    url)):
            ctx.problems.append("SM2 %s: canonical URL/provenance identifier "
                                "%r is malformed" % (sid, url))
        # SM2 <-> current SRC2 binary reconciliation, against GOVERNED fields
        if srec != DASH:
            rec = src2.get(srec)
            if rec is None:
                ctx.problems.append("SM2 %s: Source record ID %s resolves to no "
                                    "SRC2 record" % (sid, srec))
            else:
                rsha = rec.get("sha", DASH)
                rsize = rec.get("size", DASH)
                if rsha not in (None, DASH):
                    if bsha != rsha:
                        ctx.problems.append("SM2 %s: Binary SHA-256 != current "
                                            "%s Artifact SHA-256 (SM2 <-> "
                                            "current-SRC2 reconciliation)"
                                            % (sid, srec))
                    if bsize != rsize:
                        ctx.problems.append("SM2 %s: Binary size bytes != "
                                            "current %s Artifact byte size "
                                            "(SM2 <-> current-SRC2 "
                                            "reconciliation)" % (sid, srec))
                    ident_ok = (bident and rec.get("base_identity")
                                and (bident in rec["base_identity"]
                                     or (rec.get("identity")
                                         and bident in rec["identity"])))
                    if not ident_ok:
                        ctx.problems.append("SM2 %s: Binary/version identity "
                                            "does not match current %s "
                                            "Source/provenance identity or "
                                            "Source title/edition"
                                            % (sid, srec))
        if status == "current":
            key = subject + (acls, ident, cutoff)
            if key in uniq:
                ctx.problems.append("SM2 %s: duplicate current record on the "
                                    "uniqueness key %s (also %s)"
                                    % (sid, key, uniq[key]))
            uniq[key] = sid
        sm2[sid] = {"id": sid, "cls": cls, "subject": subject, "class": acls,
                    "result": result, "set": setid, "status": status,
                    "leaf": leaf, "frag": frag, "anchor": anchor}

    ss2, ss_uniq = {}, {}
    required = ctx.vocab("ss2-required-source-class")
    for r in ss2_rows:
        sid = r[0].strip("`")
        g = lambda f: (ctx.f("SS2-record", r, f) or "").strip()
        cls = g("Subject class").strip("`")
        leaf = g("Subject LEAF or —").strip("`")
        frag = g("Subject fragment ID or —").strip("`")
        anchor = g("Subject candidate anchor or —").strip("`")
        req = [x.strip().strip("`") for x in
               g("Required source classes").split(",") if x.strip()]
        members = [x.strip().strip("`") for x in g("Member SM2 IDs").split(",")
                   if x.strip() and x.strip() != DASH]
        cover = [x.strip().strip("`") for x in
                 g("Coverage assessment").split(",") if x.strip()]
        adequacy = g("Adequacy result").strip("`")
        status = g("Set status").strip("`")
        ver = g("Set version").strip("`")
        if sid in ss2:
            ctx.problems.append("SS2 %s: duplicate search set id" % sid)
            continue
        if not vocab_check(ctx, "ss2-subject-class", cls,
                           "SS2 %s subject class" % sid):
            continue
        vocab_check(ctx, "adequacy-result", adequacy, "SS2 %s adequacy" % sid)
        vocab_check(ctx, "record-status", status, "SS2 %s status" % sid)
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("SS2 %s: Set version %r is not an unpadded "
                                "positive integer" % (sid, ver))
        if cls == "XW2-DISP":
            if leaf == DASH or frag == DASH:
                ctx.problems.append("SS2 %s: XW2-DISP requires both subject "
                                    "LEAF and subject fragment" % sid)
            if anchor != DASH:
                ctx.problems.append("SS2 %s: XW2-DISP forbids a candidate "
                                    "anchor" % sid)
            subject = (cls, leaf, frag)
        else:
            if leaf != DASH or frag != DASH:
                ctx.problems.append("SS2 %s: candidate-obligation forbids LEAF "
                                    "and fragment subject fields" % sid)
            if anchor == DASH:
                ctx.problems.append("SS2 %s: candidate-obligation requires a "
                                    "subject candidate anchor" % sid)
            subject = (cls, anchor)
        if req != list(required):
            ctx.problems.append("SS2 %s: Required source classes %s != the "
                                "deterministic governed set %s"
                                % (sid, req, list(required)))
        if not members:
            ctx.problems.append("SS2 %s: empty search set (no members)" % sid)
        if members != sorted(members):
            ctx.problems.append("SS2 %s: Member SM2 IDs are not ascending" % sid)
        if len(members) != len(set(members)):
            ctx.problems.append("SS2 %s: duplicate member SM2 id(s)" % sid)
        for m in members:
            rec = sm2.get(m)
            if rec is None:
                ctx.problems.append("SS2 %s: member %s resolves to no SM2 "
                                    "record" % (sid, m))
                continue
            if rec["status"] != "current":
                ctx.problems.append("SS2 %s: member %s is superseded (stale "
                                    "member)" % (sid, m))
            if rec["set"] != sid:
                ctx.problems.append("SS2 %s: member %s back-references %r, not "
                                    "this set (orphan/stale member)"
                                    % (sid, m, rec["set"]))
            if rec["subject"] != subject:
                ctx.problems.append("SS2 %s: member %s has subject %s, not the "
                                    "set's subject %s"
                                    % (sid, m, rec["subject"], subject))
        for mid, rec in sorted(sm2.items()):
            if rec["set"] == sid and mid not in members:
                ctx.problems.append("SS2 %s: SM2 %s back-references this set but "
                                    "is absent from Member SM2 IDs (incomplete "
                                    "membership)" % (sid, mid))
        covered = {}
        for c in required:
            res = [sm2[m]["result"] for m in members
                   if m in sm2 and sm2[m]["class"] == c
                   and sm2[m]["status"] == "current"]
            covered[c] = ("no-qualifying-authority-located-in-searched-sources"
                          in res)
        want_cov = ["%s:%s" % (c, "covered" if covered[c] else "uncovered")
                    for c in required]
        if cover != want_cov:
            ctx.problems.append("SS2 %s: Coverage assessment %s != the "
                                "deterministic computation %s"
                                % (sid, cover, want_cov))
        any_located = any(sm2[m]["result"] == "qualifying-authority-located"
                          for m in members if m in sm2)
        want = ("adequate-coverage" if all(covered.values()) and not any_located
                else "inadequate-coverage")
        if adequacy != want:
            ctx.problems.append("SS2 %s: Adequacy result %r != the "
                                "deterministic computation %r"
                                % (sid, adequacy, want))
        if status == "current":
            if subject in ss_uniq:
                ctx.problems.append("SS2 %s: a second current set for subject "
                                    "%s (also %s)"
                                    % (sid, subject, ss_uniq[subject]))
            ss_uniq[subject] = sid
        ss2[sid] = {"id": sid, "subject": subject, "adequacy": adequacy,
                    "status": status, "cls": cls}

    for mid, rec in sorted(sm2.items()):
        if rec["status"] == "current" and rec["set"] == DASH:
            cited = any(mid in (d["sm"] or "") for d in disp_details)
            if not cited:
                ctx.problems.append("SM2 %s: current record belongs to no "
                                    "search set and is cited by no current "
                                    "disposition (orphan)" % mid)

    # use-site adequacy: an unsupported-residual DISP needs an adequate set
    for d in disp_details:
        if d["etype"] != "unsupported-residual" or d["status"] != "current":
            continue
        s = ss2.get(d["ss"])
        if s is None:
            continue
        if s["adequacy"] != "adequate-coverage":
            ctx.problems.append("DISP %s: unsupported-residual is supported by "
                                "%s, whose Adequacy result is %r - inadequate "
                                "coverage can never support the disposition"
                                % (d["did"], d["ss"], s["adequacy"]))
        if s["status"] != "current":
            ctx.problems.append("DISP %s: search set %s is superseded (stale "
                                "reference)" % (d["did"], d["ss"]))
        if s["cls"] == "XW2-DISP" and s["subject"] != ("XW2-DISP", d["leaf"],
                                                       d["frag"]):
            ctx.problems.append("DISP %s: search set %s covers subject %s, not "
                                "this disposition's fragment"
                                % (d["did"], d["ss"], s["subject"]))
    return sm2, ss2


# --------------------------------------------------------------------------
# 18. BLK / RES — real, resolved, parsed independent acceptance.
# --------------------------------------------------------------------------


def parse_acceptance_records(text, ctx):
    """Rows of the governed `## Independent acceptance record` table in a
    receipt blob, keyed by Resolution ID."""
    token, idre = ctx.inv.headings.get("acceptance-receipt-record",
                                       ("Independent acceptance record",
                                        r"RES-[0-9]{4}"))
    want = len(ctx.inv.schema.get("acceptance-receipt-record", []))
    out = {}
    for r in pipe_rows(heading_block(text, token)):
        if not r or not re.fullmatch(idre, normalize_record_id_cell(r[0])):
            continue
        if len(r) != want:
            continue
        fields = ctx.inv.schema["acceptance-receipt-record"]
        rid = normalize_record_id_cell(r[0])
        out.setdefault(rid, []).append(
            dict(zip(fields, [c.strip() for c in r])))
    return out


def parse_proposal_records(text, ctx):
    """Parse the exact governed RES table from one proposal-receipt blob."""
    token, idre = ctx.inv.headings.get("RES-record",
                                       ("Resolutions", r"RES-[0-9]{4}"))
    fields = ctx.inv.schema.get("RES-record", [])
    rows = pipe_rows(heading_block(text, token))
    probs = []
    headers = [r for r in rows if r == fields]
    if len(headers) != 1:
        probs.append("proposal receipt: expected exactly one RES table with "
                     "the exact governed header, found %d" % len(headers))
    out = {}
    for r in rows:
        if not r or not re.fullmatch(idre, normalize_record_id_cell(r[0])):
            continue
        rid = normalize_record_id_cell(r[0])
        if len(r) != len(fields):
            probs.append("proposal receipt: RES %s row width %d != governed "
                         "%d" % (rid, len(r), len(fields)))
            continue
        out.setdefault(rid, []).append(
            dict(zip(fields, [c.strip() for c in r])))
    return out, probs


def res_binding_digest(ctx, row):
    """SHA-256 of the canon's pinned '|'-joined RES binding content."""
    parts = [ctx.f("RES-record", row, f) for f in (
        "Blocked finding ID", "Proposed outcome", "Resolver authority",
        "Maker/proposer identity", "Independent checker identity",
        "Proposal receipt path", "Reopening condition", "Limitations")]
    return sha_hex("|".join((p or "").strip() for p in parts))


def check_blk_res(ctx, sm2, ss2, frags):
    blk_rows = ctx.pop["BLK-record"]
    res_rows = ctx.pop["RES-record"]
    repo = ctx.tree.repo or ctx.tree.root

    res = {}
    for r in res_rows:
        rid = r[0].strip("`")
        g = lambda f: (ctx.f("RES-record", r, f) or "").strip()
        if rid in res:
            ctx.problems.append("RES %s: duplicate resolution id" % rid)
            continue
        outcome = g("Proposed outcome").strip("`")
        maker = g("Maker/proposer identity").strip("`")
        checker = g("Independent checker identity").strip("`")
        proposal = g("Proposal receipt path").strip("`")
        checkpoint = g("Accepted checkpoint commit or —").strip("`")
        receipt_commit = g("Acceptance receipt commit or —").strip("`")
        receipt = g("Acceptance receipt or —").strip("`")
        acc_ver = g("Accepted RES version or —").strip("`")
        acc_dig = g("Accepted content digest or —").strip("`")
        acc_out = g("Accepted proposed outcome or —").strip("`")
        status = g("Resolution status").strip("`")
        ver = g("Resolution version").strip("`")
        vocab_check(ctx, "res-proposed-outcome", outcome,
                    "RES %s proposed outcome" % rid)
        vocab_check(ctx, "res-resolution-status", status,
                    "RES %s resolution status" % rid)
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("RES %s: Resolution version %r is not an "
                                "unpadded positive integer" % (rid, ver))
        res[rid] = {"id": rid, "row": r, "blk": g("Blocked finding ID"),
                    "outcome": outcome, "maker": maker, "checker": checker,
                    "proposal": proposal,
                    "checkpoint": checkpoint,
                    "receipt_commit": receipt_commit, "receipt": receipt,
                    "acc_ver": acc_ver,
                    "acc_dig": acc_dig, "acc_out": acc_out, "status": status,
                    "ver": ver, "accepted": False}

    for rid, R in sorted(res.items()):
        acceptance_values = (R["checkpoint"], R["receipt_commit"],
                             R["receipt"], R["acc_ver"], R["acc_dig"],
                             R["acc_out"])
        if R["status"] == "proposed" and any(
                value != DASH for value in acceptance_values):
            ctx.problems.append("RES %s: proposed row must carry — in every "
                                "later acceptance field" % rid)
        if R["status"] != "accepted":
            continue
        ok = True
        actor_re = r"(?:human|agent):[a-z0-9][a-z0-9._-]{0,63}"
        if not re.fullmatch(actor_re, R["maker"]):
            ctx.problems.append("RES %s: Maker/proposer identity %r is not a "
                                "grammar-valid recorded actor" % (rid,
                                                                  R["maker"]))
            ok = False
        if not re.fullmatch(actor_re, R["checker"]):
            ctx.problems.append("RES %s: Independent checker identity %r is "
                                "not a grammar-valid recorded actor"
                                % (rid, R["checker"]))
            ok = False
        if R["maker"] == R["checker"]:
            ctx.problems.append("RES %s: maker and checker fields are "
                                "string-identical (structural separation "
                                "assertion fails)" % rid)
            ok = False
        for label, key in (("Accepted checkpoint commit", "checkpoint"),
                           ("Acceptance receipt commit", "receipt_commit")):
            if not re.fullmatch(r"[0-9a-f]{40}", R[key]):
                ctx.problems.append("RES %s: %s %r is not a full 40-hex "
                                    "commit SHA" % (rid, label, R[key]))
                ok = False
            elif not git_commit_exists(repo, R[key]):
                ctx.problems.append("RES %s: %s %s does not resolve to a real "
                                    "commit in the governing repository"
                                    % (rid, label, R[key]))
                ok = False
        if re.fullmatch(r"[0-9a-f]{40}", R["checkpoint"]) and \
                re.fullmatch(r"[0-9a-f]{40}", R["receipt_commit"]) and \
                git_commit_exists(repo, R["checkpoint"]) and \
                git_commit_exists(repo, R["receipt_commit"]) and \
                not git_is_strict_ancestor(repo, R["checkpoint"],
                                           R["receipt_commit"]):
            ctx.problems.append("RES %s: acceptance-receipt commit is not a "
                                "strict descendant of the maker proposal "
                                "checkpoint (retroactive or unordered "
                                "acceptance)" % rid)
            ok = False

        proposal_blob = None
        proposal_path = R["proposal"].replace("\\", "/")
        normalized = os.path.normpath(proposal_path).replace(os.sep, "/")
        if R["proposal"] in ("", DASH) or proposal_path != normalized or \
                proposal_path.startswith("../") or \
                not proposal_path.startswith("work/architect-completion/") or \
                not proposal_path.endswith(".md"):
            ctx.problems.append("RES %s: Proposal receipt path %r is not a "
                                "normalized repository-relative markdown path "
                                "under work/architect-completion" %
                                (rid, R["proposal"]))
            ok = False
        elif re.fullmatch(r"[0-9a-f]{40}", R["checkpoint"]) and \
                git_commit_exists(repo, R["checkpoint"]):
            b = git_blob(repo, R["checkpoint"], proposal_path)
            if b is None:
                ctx.problems.append("RES %s: Proposal receipt path %r does not "
                                    "exist at maker checkpoint %s"
                                    % (rid, proposal_path,
                                       R["checkpoint"][:12]))
                ok = False
            else:
                proposal_blob = b.decode("utf-8", "replace")
        if proposal_blob is not None:
            proposed, pp = parse_proposal_records(proposal_blob, ctx)
            ctx.problems += ["RES %s: %s" % (rid, p) for p in pp]
            matches = proposed.get(rid, [])
            if len(matches) != 1:
                ctx.problems.append("RES %s: maker checkpoint proposal "
                                    "contains %d matching rows; exactly one is "
                                    "required" % (rid, len(matches)))
                ok = False
            else:
                prow = matches[0]
                if prow.get("Resolution status", "").strip("`") != "proposed":
                    ctx.problems.append("RES %s: maker checkpoint row is not "
                                        "proposed/unaccepted" % rid)
                    ok = False
                later = ("Accepted checkpoint commit or —",
                         "Acceptance receipt commit or —",
                         "Acceptance receipt or —",
                         "Accepted RES version or —",
                         "Accepted content digest or —",
                         "Accepted proposed outcome or —")
                for field in later:
                    if (prow.get(field) or "").strip("`") != DASH:
                        ctx.problems.append("RES %s: maker checkpoint proposal "
                                            "already populates %s"
                                            % (rid, field))
                        ok = False
                same = ("Resolution ID", "Blocked finding ID",
                        "Proposed outcome", "Resolver authority",
                        "Maker/proposer identity",
                        "Independent checker identity",
                        "Proposal receipt path", "Resolution version",
                        "Reopening condition", "Limitations",
                        "Superseding/current relationship or —")
                current = dict(zip(ctx.inv.schema["RES-record"], R["row"]))
                for field in same:
                    mine = (current.get(field) or "").strip().strip("`")
                    theirs = (prow.get(field) or "").strip().strip("`")
                    if mine != theirs:
                        ctx.problems.append("RES %s: maker checkpoint proposal "
                                            "%s %r != current row %r"
                                            % (rid, field, theirs, mine))
                        ok = False
        if R["acc_ver"] != R["ver"]:
            ctx.problems.append("RES %s: Accepted RES version %r != current "
                                "Resolution version %r (stale acceptance)"
                                % (rid, R["acc_ver"], R["ver"]))
            ok = False
        if R["acc_out"] != R["outcome"]:
            ctx.problems.append("RES %s: Accepted proposed outcome %r != "
                                "current Proposed outcome %r (unrelated "
                                "acceptance)" % (rid, R["acc_out"], R["outcome"]))
            ok = False
        want_dig = res_binding_digest(ctx, R["row"])
        if R["acc_dig"] != want_dig:
            ctx.problems.append("RES %s: Accepted content digest does not equal "
                                "the recomputed digest of the record's current "
                                "binding content (the proposed content changed "
                                "after acceptance)" % rid)
            ok = False
        blob = None
        if re.fullmatch(r"[0-9a-f]{40}", R["receipt_commit"]) and \
                git_commit_exists(repo, R["receipt_commit"]):
            if R["receipt"] in ("", DASH):
                ctx.problems.append("RES %s: accepted resolution carries no "
                                    "Acceptance receipt path" % rid)
                ok = False
            else:
                b = git_blob(repo, R["receipt_commit"], R["receipt"])
                if b is None:
                    ctx.problems.append("RES %s: Acceptance receipt %r does not "
                                        "exist at receipt commit %s "
                                        "(unresolvable acceptance evidence)"
                                        % (rid, R["receipt"],
                                           R["receipt_commit"][:12]))
                    ok = False
                else:
                    blob = b.decode("utf-8", "replace")
        if blob is not None:
            recs = parse_acceptance_records(blob, ctx)
            matches = recs.get(rid, [])
            if not matches:
                ctx.problems.append("RES %s: the acceptance receipt at %s "
                                    "carries no Independent acceptance record "
                                    "row for this resolution (blank or "
                                    "unrelated receipt)"
                                    % (rid, R["receipt_commit"][:12]))
                ok = False
            elif len(matches) != 1:
                ctx.problems.append("RES %s: the acceptance receipt carries "
                                    "%d rows for this resolution; exactly one "
                                    "is required (duplicates never overwrite)"
                                    % (rid, len(matches)))
                ok = False
            else:
                row = matches[0]
                verdict = row.get("Acceptance verdict", "").strip("`")
                if verdict != "ACCEPT":
                    ctx.problems.append("RES %s: the acceptance receipt records "
                                        "verdict %r, not ACCEPT"
                                        % (rid, verdict))
                    ok = False
                pairs = (("Accepted RES version", R["acc_ver"]),
                         ("Accepted content digest", R["acc_dig"]),
                         ("Accepted proposed outcome", R["acc_out"]),
                         ("Maker/proposer identity", R["maker"]),
                         ("Independent checker identity", R["checker"]),
                         ("Accepted checkpoint commit", R["checkpoint"]))
                for fname, mine in pairs:
                    theirs = (row.get(fname) or "").strip().strip("`")
                    if theirs != mine:
                        ctx.problems.append("RES %s: receipt %s %r != the "
                                            "resolution's %r (the receipt does "
                                            "not accept this exact resolution)"
                                            % (rid, fname, theirs, mine))
                        ok = False
                rdig = (row.get("Accepted content digest") or "").strip("`")
                if rdig != want_dig:
                    ctx.problems.append("RES %s: the digest recorded in the "
                                        "immutable acceptance receipt does not "
                                        "equal the recomputed digest of the "
                                        "resolution's current binding content "
                                        "(maker self-certification by digest "
                                        "substitution)" % rid)
                    ok = False
        R["accepted"] = ok

    blk = {}
    anchors = set()
    for r in blk_rows:
        bid = r[0].strip("`")
        g = lambda f: (ctx.f("BLK-record", r, f) or "").strip()
        cls = g("Subject class").strip("`")
        leaf = g("Subject historical LEAF or —").strip("`")
        frag = g("Subject fragment ID or —").strip("`")
        anchor = g("Subject candidate anchor or —").strip("`")
        ftype = g("Finding type").strip("`")
        setid = g("Search-set ID or —").strip("`")
        smids = g("Search-manifest IDs or —")
        status = g("Finding status").strip("`")
        ver = g("Finding version").strip("`")
        resid = g("Resolution ID or —").strip("`")
        if bid in blk:
            ctx.problems.append("BLK %s: duplicate blocked-finding id" % bid)
            continue
        if not vocab_check(ctx, "blk-subject-class", cls,
                           "BLK %s subject class" % bid):
            continue
        vocab_check(ctx, "blk-finding-type", ftype, "BLK %s finding type" % bid)
        vocab_check(ctx, "blk-finding-status", status, "BLK %s status" % bid)
        if not re.fullmatch(r"[1-9]\d*", ver):
            ctx.problems.append("BLK %s: Finding version %r is not an unpadded "
                                "positive integer" % (bid, ver))
        if cls == "XW2-DISP":
            if leaf == DASH or frag == DASH:
                ctx.problems.append("BLK %s: XW2-DISP requires subject LEAF and "
                                    "fragment" % bid)
            if anchor != DASH:
                ctx.problems.append("BLK %s: XW2-DISP forbids a subject "
                                    "candidate anchor" % bid)
        else:
            if leaf != DASH or frag != DASH:
                ctx.problems.append("BLK %s: candidate-obligation forbids LEAF "
                                    "and fragment subject fields" % bid)
            if anchor == DASH:
                ctx.problems.append("BLK %s: candidate-obligation requires a "
                                    "subject candidate anchor" % bid)
            anchors.add(anchor)
        if setid != DASH and setid not in ss2:
            ctx.problems.append("BLK %s: search set %s resolves to no SS2 "
                                "record" % (bid, setid))
        elif setid in ss2 and ss2[setid]["adequacy"] != "adequate-coverage":
            ctx.problems.append("BLK %s: its search set %s reports %r - a "
                                "blocked finding itself requires a complete "
                                "adequate not-located search"
                                % (bid, setid, ss2[setid]["adequacy"]))
        for m in re.findall(r"SM2-\d{4}", smids or ""):
            if m not in sm2:
                ctx.problems.append("BLK %s: cites nonexistent %s" % (bid, m))
        if status == "open":
            ctx.problems.append("BLK %s: an open blocked-unsupported-obligation "
                                "finding fails U7 and stops the unit" % bid)
        elif status == "resolved":
            if resid == DASH or resid not in res:
                ctx.problems.append("BLK %s: resolved but names no current RES "
                                    "resolution (%r)" % (bid, resid))
            else:
                R = res[resid]
                if R["status"] != "accepted":
                    ctx.problems.append("BLK %s: resolved by a %r resolution, "
                                        "not an accepted one" % (bid, R["status"]))
                elif not R["accepted"]:
                    ctx.problems.append("BLK %s: its resolution %s did not "
                                        "satisfy the independent-acceptance "
                                        "gate" % (bid, resid))
                if R["blk"].strip("`") != bid:
                    ctx.problems.append("BLK %s: resolution %s back-references "
                                        "%r (broken BLK/RES backlink)"
                                        % (bid, resid, R["blk"]))
        blk[bid] = {"id": bid, "status": status, "anchor": anchor, "res": resid}
    for rid, R in sorted(res.items()):
        b = R["blk"].strip("`")
        if b not in blk:
            ctx.problems.append("RES %s: Blocked finding ID %r resolves to no "
                                "BLK record (orphan resolution)" % (rid, b))
    return blk, res, anchors


# --------------------------------------------------------------------------
# 19. AMEND lineage across every population carrying a superseding field.
# --------------------------------------------------------------------------


SUPERSEDE_FIELDS = (
    ("DISP-detail", "Superseding/current relationship or —", "Status",
     r"DR2-\d{4}"),
    ("BND-bundle", "Superseding/current relationship or —", "Bundle status",
     r"BND-\d{4}"),
    ("BLK-record", "Superseding/current relationship or —", "Finding status",
     r"BLK-\d{4}"),
    ("RES-record", "Superseding/current relationship or —", "Resolution status",
     r"RES-\d{4}"),
)

VERSION_LINEAGE_SUPPORT = (
    ("SRC2", "SRC2-base", "Record version"),
    ("SRC2-date-component", "SRC2-date-component", "Component version"),
    ("DISP", "DISP-detail", "Version"),
    ("fragment", "fragment-inventory", "Fragment version"),
    ("scenario-fragment", "scenario-fragment-inventory", "Fragment version"),
    ("BND", "BND-bundle", "Bundle version"),
    ("SM2", "SM2-record", "Search version"),
    ("SS2", "SS2-record", "Set version"),
    ("BLK", "BLK-record", "Finding version"),
    ("RES", "RES-record", "Resolution version"),
)
VERSION_LINEAGE_BY_POPULATION = {
    population: (key, field)
    for population, key, field in VERSION_LINEAGE_SUPPORT
}

# A population is a logical governed identity, not merely one rendered table.
# LEAF spans its main and detail rows; SRC2 spans its base and the one applicable
# provenance-detail row.  CBA2-SC is deliberately not guessed from prose: no
# machine-readable population declaration exists yet, so an attempted AMEND is
# mechanically deferred/rejected until the governing inventory adds one.
AMEND_POPULATION_KEYS = {
    "GROUP": ("GROUP-index",),
    "LEAF": ("LEAF-main", "LEAF-detail"),
    "XW2": ("XW2-edge",),
    "SRC2": ("SRC2-base", "SRC2-detail-official-immutable",
             "SRC2-detail-official-mutable",
             "SRC2-detail-ops-provenance", "SRC2-detail-ext-contract"),
    "SRC2-date-component": ("SRC2-date-component",),
    "EV2": ("EV2-component",),
    "CBA2-SC": None,
    "SXW2": ("SXW2-edge",),
    "DR2": ("DR2-generic",),
    "DISP": ("DISP-detail",),
    "fragment": ("fragment-inventory",),
    "scenario-fragment": ("scenario-fragment-inventory",),
    "BND": ("BND-bundle",),
    "SM2": ("SM2-record",),
    "SS2": ("SS2-record",),
    "BLK": ("BLK-record",),
    "RES": ("RES-record",),
}

CANON_POPULATION_KEYS = {
    "GROUP-index", "LEAF-main", "LEAF-detail", "XW2-edge", "SRC2-base",
    "SRC2-detail-official-immutable", "SRC2-detail-official-mutable",
    "SRC2-detail-ops-provenance", "SRC2-detail-ext-contract",
    "EV2-component", "SXW2-edge",
}


def governed_population_snapshot(tree, inv, population, ctx=None):
    """Return exact logical records for one named AMEND population.

    The lookup is scoped to Inventory F/G population tables.  It never searches
    canon, plan, or receipt prose for a shaped identifier.  A record value is a
    tuple of its governed table components, so LEAF and SRC2 changes are
    detected coherently while still requiring one population-level AMEND row.
    """
    keys = AMEND_POPULATION_KEYS.get(population)
    if keys is None:
        return {
            "records": {},
            "versions": {},
            "versioned": False,
            "problems": [
                "population %s has no governed parser declaration; exact "
                "lineage is deferred and cannot be admitted mechanically"
                % population],
        }

    checkpoint_inv = None
    if ctx is None:
        checkpoint_inv, checkpoint_problems = parse_inventory(tree.canon)
        if checkpoint_problems:
            checkpoint_inv = None

    components, headers, problems = {}, {}, []
    for key in keys:
        if ctx is not None:
            header = ctx.header.get(key)
            rows = ctx.pop.get(key, [])
            parse_problems = []
        else:
            # Historical checkpoints may carry an earlier partial Inventory
            # F/G. Prefer their own exact declaration when this population is
            # declared there; otherwise use today's governed declaration to
            # parse the historical table. Both paths remain table/range scoped
            # and never fall back to a whole-file prose search.
            if key in CANON_POPULATION_KEYS:
                declared_at_checkpoint = (
                    checkpoint_inv is not None
                    and key in checkpoint_inv.sections)
            else:
                declared_at_checkpoint = (
                    checkpoint_inv is not None
                    and key in checkpoint_inv.headings)
            use_inv = checkpoint_inv if declared_at_checkpoint else inv
            if key in CANON_POPULATION_KEYS:
                header, rows, parse_problems = parse_canon_population(
                    tree.canon, use_inv, key)
            else:
                header, rows, parse_problems = parse_receipt_population(
                    tree, use_inv, key)
            if not rows and use_inv is not inv:
                if key in CANON_POPULATION_KEYS:
                    fallback_header, fallback_rows, fallback_problems = \
                        parse_canon_population(tree.canon, inv, key)
                else:
                    fallback_header, fallback_rows, fallback_problems = \
                        parse_receipt_population(tree, inv, key)
                if fallback_rows:
                    header, rows, parse_problems = (
                        fallback_header, fallback_rows, fallback_problems)
            if not rows and key in CANON_POPULATION_KEYS:
                fallback_header, fallback_rows, fallback_problems = \
                    parse_canon_population_by_exact_header(
                        tree.canon, inv, key)
                if fallback_rows:
                    header, rows, parse_problems = (
                        fallback_header, fallback_rows, fallback_problems)
        headers[key] = header
        problems.extend("%s: %s" % (key, p) for p in parse_problems)
        seen_in_key = set()
        for row in rows:
            rid = normalize_record_id_cell(row[0])
            if rid in seen_in_key:
                problems.append("%s: identity %s resolves more than once"
                                % (key, rid))
            seen_in_key.add(rid)
            normalized = [cell.strip() for cell in row]
            normalized[0] = rid
            components.setdefault(rid, []).append(
                (key, tuple(normalized)))

    records = {
        rid: tuple(sorted(parts, key=lambda item: item[0]))
        for rid, parts in components.items()
    }
    versions = {}
    version_spec = VERSION_LINEAGE_BY_POPULATION.get(population)
    versioned = False
    if version_spec:
        version_key, version_field = version_spec
        header = headers.get(version_key)
        versioned = bool(header and version_field in header)
        if versioned:
            index = header.index(version_field)
            for rid, parts in records.items():
                matches = [
                    row[index] for key, row in parts
                    if key == version_key and index < len(row)]
                if len(matches) == 1:
                    versions[rid] = matches[0].strip().strip("`")
                else:
                    problems.append(
                        "%s: identity %s resolves %d version-bearing rows"
                        % (population, rid, len(matches)))
    return {
        "records": records,
        "versions": versions,
        "versioned": versioned,
        "problems": problems,
    }


def pinned_baseline_tree(ctx):
    """Load the pinned R3 tree once per top-level validation."""
    if not hasattr(ctx, "_pinned_baseline_tree"):
        sha = ctx.inv.commits.get("r3-checkpoint")
        repo = ctx.tree.repo or ctx.tree.root
        ctx._pinned_baseline_tree = (
            Tree(ctx.tree.root, ref=sha)
            if sha and git_commit_exists(repo, sha) else None)
    return ctx._pinned_baseline_tree


def cached_population_snapshot(ctx, population, baseline=False):
    """Reuse logical population parses within one validation pass."""
    attr = ("_baseline_population_snapshots" if baseline
            else "_current_population_snapshots")
    cache = getattr(ctx, attr, None)
    if cache is None:
        cache = {}
        setattr(ctx, attr, cache)
    if population not in cache:
        tree = pinned_baseline_tree(ctx) if baseline else ctx.tree
        cache[population] = (
            governed_population_snapshot(
                tree, ctx.inv, population, ctx=None if baseline else ctx)
            if tree is not None else {
                "records": {}, "versions": {}, "versioned": False,
                "problems": ["pinned R3 tree does not resolve"],
            })
    return cache[population]


def check_amend(ctx, dr2):
    """Real AMEND lineage: no reuse, exactly one current endpoint per chain,
    every superseding relationship resolving, and no stale live reference."""
    amend_ids = {d for d, v in dr2.items() if v["type"] == "AMEND"}
    detail_rows = ctx.pop.get("AMEND-detail", [])
    detail_by_parent, prior_seen = {}, set()
    checkpoint_tree_cache, checkpoint_population_cache = {}, {}
    lineage_edges = {}
    current_snapshots = {
        population: cached_population_snapshot(ctx, population)
        for population in AMEND_POPULATION_KEYS
    }
    current_population = {
        population: set(snapshot["records"])
        for population, snapshot in current_snapshots.items()
    }
    resolved_forward = set()
    parsed_details = []
    for r in detail_rows:
        aid = r[0].strip("`")
        g = lambda f: (ctx.f("AMEND-detail", r, f) or "").strip()
        population = g("Population").strip("`")
        prior = g("Prior record ID").strip("`")
        prior_ver = g("Prior version or —").strip("`")
        checkpoint = g("Prior checkpoint commit").strip("`")
        action = g("Action").strip("`")
        current_raw = g("Current record ID(s) or —").strip("`")
        current_ver_raw = g("Current version(s) or —").strip("`")
        reason = g("Reason")
        if aid not in amend_ids:
            ctx.problems.append("AMEND detail %s: parent is not a current "
                                "generic AMEND decision record" % aid)
        detail_by_parent.setdefault(aid, []).append(r)
        if not vocab_check(ctx, "amend-population", population,
                           "AMEND detail %s population" % aid):
            continue
        vocab_check(ctx, "amend-action", action,
                    "AMEND detail %s action" % aid)
        key = (population, prior)
        # Sequential same-ID revisions are distinguished by exact checkpoint
        # and prior version.  A non-revise lineage may consume an identity only
        # once.
        seen_key = ((population, prior, prior_ver, checkpoint)
                    if action == "revise" else key)
        if seen_key in prior_seen:
            ctx.problems.append("AMEND detail %s: duplicate prior-lineage row "
                                "for %s %s" % (aid, population, prior))
        prior_seen.add(seen_key)
        if not prior or prior == DASH:
            ctx.problems.append("AMEND detail %s: Prior record ID is blank/dash"
                                % aid)
        if prior_ver != DASH and not re.fullmatch(r"[1-9]\d*", prior_ver):
            ctx.problems.append("AMEND detail %s: Prior version %r is neither "
                                "— nor an unpadded positive integer"
                                % (aid, prior_ver))
        if not re.fullmatch(r"[0-9a-f]{40}", checkpoint) or not \
                git_commit_exists(ctx.tree.repo or ctx.tree.root, checkpoint):
            ctx.problems.append("AMEND detail %s: Prior checkpoint commit %r "
                                "does not resolve to a full Git commit"
                                % (aid, checkpoint))
            prior_snapshot = None
        else:
            if checkpoint not in checkpoint_tree_cache:
                pinned = ctx.inv.commits.get("r3-checkpoint")
                checkpoint_tree_cache[checkpoint] = (
                    pinned_baseline_tree(ctx) if checkpoint == pinned
                    else Tree(ctx.tree.repo or ctx.tree.root, ref=checkpoint))
            cache_key = (checkpoint, population)
            if cache_key not in checkpoint_population_cache:
                checkpoint_population_cache[cache_key] = \
                    governed_population_snapshot(
                        checkpoint_tree_cache[checkpoint], ctx.inv, population)
            prior_snapshot = checkpoint_population_cache[cache_key]
            for problem in prior_snapshot["problems"]:
                ctx.problems.append(
                    "AMEND detail %s: prior-checkpoint %s parse failed: %s"
                    % (aid, population, problem))
            if prior not in prior_snapshot["records"]:
                ctx.problems.append(
                    "AMEND detail %s: prior %s identity %s resolves 0 times "
                    "in the exact governed population at checkpoint %s"
                    % (aid, population, prior, checkpoint[:12]))
        currents = [] if current_raw == DASH else current_raw.split(", ")
        if action == "remove":
            if currents or current_ver_raw != DASH:
                ctx.problems.append("AMEND detail %s: remove requires — for "
                                    "both current identity and version" % aid)
        elif not currents:
            ctx.problems.append("AMEND detail %s: action %s requires a direct "
                                "current identity" % (aid, action))
        if action == "split" and len(currents) < 2:
            ctx.problems.append("AMEND detail %s: split requires at least two "
                                "current identities" % aid)
        if action != "split" and len(currents) > 1:
            ctx.problems.append("AMEND detail %s: only split may branch to "
                                "multiple current identities" % aid)
        if action == "revise" and currents != [prior]:
            ctx.problems.append("AMEND detail %s: revise must retain exactly "
                                "the prior stable identity" % aid)
        if action != "revise" and prior in currents:
            ctx.problems.append("AMEND detail %s: lineage cycles to/reuses its "
                                "prior identity %s" % (aid, prior))
        if len(currents) != len(set(currents)):
            ctx.problems.append("AMEND detail %s: duplicate current identities"
                                % aid)
        known = current_population.get(population, set())
        for cid in currents:
            if cid not in known:
                ctx.problems.append("AMEND detail %s: current %s identity %s "
                                    "does not resolve directly"
                                    % (aid, population, cid))
        versions = ([] if current_ver_raw == DASH
                    else current_ver_raw.split(", "))
        if versions and (len(versions) != len(currents) or any(
                not re.fullmatch(r"[1-9]\d*", v) for v in versions)):
            ctx.problems.append("AMEND detail %s: current versions do not "
                                "align with current identities" % aid)

        prior_is_versioned = bool(
            prior_snapshot and prior_snapshot["versioned"])
        current_is_versioned = bool(
            current_snapshots.get(population, {}).get("versioned"))
        pinned = ctx.inv.commits.get("r3-checkpoint")
        if action != "revise" and checkpoint != pinned:
            pinned_snapshot = cached_population_snapshot(
                ctx, population, baseline=True)
            if prior in pinned_snapshot["records"]:
                ctx.problems.append(
                    "AMEND detail %s: protected pinned-R3 %s identity %s is "
                    "consumed by %s and must name the exact r3-checkpoint %s"
                    % (aid, population, prior, action, pinned))
        if prior_is_versioned:
            recorded_prior = prior_snapshot["versions"].get(prior)
            if recorded_prior != prior_ver:
                ctx.problems.append(
                    "AMEND detail %s: prior checkpoint records version %s, "
                    "not claimed prior version %s for %s %s"
                    % (aid, recorded_prior or "none", prior_ver,
                       population, prior))
        elif prior_ver != DASH:
            ctx.problems.append(
                "AMEND detail %s: prior %s population is versionless at "
                "checkpoint %s, so Prior version must be —"
                % (aid, population, checkpoint[:12]))

        if action == "revise":
            if prior_is_versioned:
                if len(versions) != 1 or \
                        not re.fullmatch(r"[1-9]\d*", prior_ver) or \
                        int(versions[0]) != int(prior_ver) + 1:
                    ctx.problems.append(
                        "AMEND detail %s: same-identity revise must advance "
                        "exactly one numeric version" % aid)
            elif current_is_versioned:
                if prior_ver != DASH or versions != ["1"]:
                    ctx.problems.append(
                        "AMEND detail %s: first versioned revision from a "
                        "versionless checkpoint requires — -> version 1"
                        % aid)
            elif prior_ver != DASH or current_ver_raw != DASH:
                ctx.problems.append(
                    "AMEND detail %s: versionless same-identity revise "
                    "requires — for both prior and current versions" % aid)
        elif current_is_versioned and currents:
            if len(versions) != len(currents) or any(v != "1"
                                                    for v in versions):
                ctx.problems.append(
                    "AMEND detail %s: new versioned replacement/split/merge "
                    "identities must begin at version 1" % aid)
        elif current_ver_raw != DASH:
            ctx.problems.append(
                "AMEND detail %s: versionless %s lineage requires — for "
                "current versions" % (aid, population))
        if not reason or reason == DASH:
            ctx.problems.append("AMEND detail %s: Reason is blank/dash" % aid)
        parsed_details.append({
            "amend": aid, "population": population, "prior": prior,
            "prior_version": prior_ver, "checkpoint": checkpoint,
            "action": action, "currents": currents,
            "current_versions": versions, "reason": reason,
        })
        if action != "revise":
            lineage_edges.setdefault(key, []).extend(
                (population, cid) for cid in currents)
            resolved_forward.add((population, prior))

    # Join each terminal versioned endpoint to the exact live logical record.
    # A version that is the prior endpoint of a later same-ID revise is an
    # intermediate checkpoint state, not the current terminal endpoint.
    revised_from = {
        (detail["population"], detail["prior"], detail["prior_version"])
        for detail in parsed_details
        if detail["action"] == "revise"}
    for detail in parsed_details:
        population = detail["population"]
        snapshot = current_snapshots.get(population, {})
        if not snapshot.get("versioned") or \
                len(detail["current_versions"]) != len(detail["currents"]):
            continue
        for cid, claimed_version in zip(
                detail["currents"], detail["current_versions"]):
            if (population, cid, claimed_version) in revised_from:
                continue
            recorded_current = snapshot["versions"].get(cid)
            if recorded_current != claimed_version:
                ctx.problems.append(
                    "AMEND detail %s: terminal current %s identity %s records "
                    "version %s, not claimed current version %s"
                    % (detail["amend"], population, cid,
                       recorded_current or "none", claimed_version))

    # Cross-row cycles are checked on population-qualified identities. A
    # same-ID `revise` is version lineage and is deliberately excluded above.
    visit = {}

    def walk(node, stack):
        if visit.get(node) == 1:
            ctx.problems.append("AMEND detail lineage cycle: %s -> %s"
                                % (" -> ".join("%s:%s" % x for x in stack),
                                   "%s:%s" % node))
            return
        if visit.get(node) == 2:
            return
        visit[node] = 1
        for nxt in lineage_edges.get(node, []):
            walk(nxt, stack + [node])
        visit[node] = 2

    for node in sorted(lineage_edges):
        walk(node, [])
    if parse_migration_state(ctx.tree.plan) == "post-R3.1":
        for aid in sorted(amend_ids):
            if not detail_by_parent.get(aid):
                ctx.problems.append("AMEND %s: generic record has no structured "
                                    "AMEND detail row" % aid)
    ctx.amend_resolved = resolved_forward
    ctx.amend_details = parsed_details
    for key, supfield, statusfield, idre in SUPERSEDE_FIELDS:
        rows = ctx.pop.get(key, [])
        if not rows:
            continue
        status_of, sup_of = {}, {}
        for r in rows:
            rid = r[0].strip("`")
            status_of[rid] = (ctx.f(key, r, statusfield) or "").strip().strip("`")
            sup_of[rid] = (ctx.f(key, r, supfield) or "").strip()
        successors = {}
        for rid, sup in sorted(sup_of.items()):
            if sup in ("", DASH):
                continue
            m = re.fullmatch(r"supersedes (%s) per AMEND (DR2-\d{4})"
                             % idre, sup)
            if not m:
                ctx.problems.append("%s %s: superseding relationship %r does "
                                    "not match the governed grammar"
                                    % (key, rid, sup))
                continue
            prior, amend = m.group(1), m.group(2)
            if amend not in amend_ids:
                ctx.problems.append("%s %s: names %s as its AMEND record, but "
                                    "that is not a current AMEND decision "
                                    "record" % (key, rid, amend))
            if prior not in status_of:
                ctx.problems.append("%s %s: supersedes %s, which does not exist "
                                    "(broken forward reference)"
                                    % (key, rid, prior))
                continue
            if prior == rid:
                ctx.problems.append("%s %s: supersedes itself (ID reuse)"
                                    % (key, rid))
            if status_of[prior] != "superseded":
                ctx.problems.append("%s %s: supersedes %s, which is still "
                                    "marked %r - a supersession chain must "
                                    "terminate in exactly one current endpoint"
                                    % (key, rid, prior, status_of[prior]))
            successors.setdefault(prior, []).append(rid)
        for prior, succ in sorted(successors.items()):
            cur = [s for s in succ if status_of.get(s) == "current"]
            if len(cur) > 1:
                ctx.problems.append("%s: %s has %d current successors %s - a "
                                    "supersession chain terminates in exactly "
                                    "one current disposition"
                                    % (key, prior, len(cur), sorted(cur)))
        for rid, st in sorted(status_of.items()):
            if st == "superseded" and rid not in successors:
                ctx.problems.append("%s %s: marked superseded but no current "
                                    "record supersedes it (the AMEND chain does "
                                    "not resolve forward)" % (key, rid))

    # stale live references: no live citation of a superseded DISP record
    superseded_disp = {d[0].strip("`") for d in ctx.pop.get("DISP-detail", [])
                       if (ctx.f("DISP-detail", d, "Status") or "").strip()
                       == "superseded"}
    current_disp = {d[0].strip("`") for d in ctx.pop.get("DISP-detail", [])
                    if (ctx.f("DISP-detail", d, "Status") or "").strip()
                    == "current"}
    for r in ctx.pop.get("XW2-edge", []):
        eid = r[0].strip("`")
        dec = (ctx.f("XW2-edge", r, "Decision record") or "").strip("`")
        if dec in superseded_disp and dec not in current_disp:
            ctx.problems.append("XW2 %s: live edge references superseded "
                                "decision record %s (stale live reference; "
                                "every live reference must point directly at "
                                "the current record)" % (eid, dec))


def check_version_lineage(ctx):
    """Every version above 1 needs the exact structured same-ID revise that
    explains the immediate one-step transition."""
    details = ctx.pop.get("AMEND-detail", [])
    revise = {}
    for r in details:
        g = lambda f: (ctx.f("AMEND-detail", r, f)
                       or "").strip().strip("`")
        if g("Action") != "revise":
            continue
        key = (g("Population"), g("Prior record ID"))
        revise.setdefault(key, []).append({
            "prior": g("Prior version or —"),
            "current_ids": g("Current record ID(s) or —"),
            "current_versions": g("Current version(s) or —"),
        })

    for population, key, field in VERSION_LINEAGE_SUPPORT:
        for r in ctx.pop.get(key, []):
            rid = r[0].strip("`")
            version = (ctx.f(key, r, field) or "").strip().strip("`")
            if not re.fullmatch(r"[1-9]\d*", version) or version == "1":
                continue
            expected_prior = str(int(version) - 1)
            matches = [
                d for d in revise.get((population, rid), [])
                if d["prior"] == expected_prior
                and d["current_ids"] == rid
                and d["current_versions"] == version
            ]
            if len(matches) != 1:
                ctx.problems.append(
                    "%s %s: version %s requires exactly one same-identity "
                    "AMEND revise from immediate version %s; found %d"
                    % (population, rid, version, expected_prior, len(matches)))


def check_amended_dr2_references(ctx):
    """Resolve immutable historical DR2 narrative references after AMEND.

    Live register references still resolve directly in their own validators.
    This exception is only for a generic DR2 receipt row whose once-current
    LEAF/register identity has been consumed by structured non-revise lineage.
    """
    resolved = set(getattr(ctx, "amend_resolved", set()))
    for population, rid, diagnostic in getattr(
            ctx, "pending_amended_dr2_references", []):
        if (population, rid) not in resolved:
            ctx.problems.append(diagnostic)


# --------------------------------------------------------------------------
# 20. Identity preservation against the pinned R3 checkpoint COMMIT.
#     (Separate from conformance: no fixed totals anywhere.)
# --------------------------------------------------------------------------

PRESERVED_POPULATIONS = ("GROUP-index", "LEAF-main", "LEAF-detail", "XW2-edge",
                         "SRC2-base", "SRC2-detail-official-immutable",
                         "SRC2-detail-official-mutable", "EV2-component",
                         "DR2-generic")
PRESERVED_AMEND_POPULATION = {
    "GROUP-index": "GROUP",
    "LEAF-main": "LEAF",
    "LEAF-detail": "LEAF",
    "XW2-edge": "XW2",
    "SRC2-base": "SRC2",
    "SRC2-detail-official-immutable": "SRC2",
    "SRC2-detail-official-mutable": "SRC2",
    "EV2-component": "EV2",
    "DR2-generic": "DR2",
}


def check_preservation(ctx):
    """Every identity committed at the pinned R3 checkpoint must still resolve
    in the live tree - present as a current record, or resolved forward through
    a valid AMEND chain to a current successor or an explicit removal."""
    probs, notes = [], []
    sha = ctx.inv.commits.get("r3-checkpoint")
    repo = ctx.tree.repo or ctx.tree.root
    if not sha:
        return (["preservation: the governed inventory pins no r3-checkpoint "
                 "commit"], notes)
    if not git_commit_exists(repo, sha):
        return (["preservation: pinned R3 checkpoint %s does not resolve in the "
                 "governing repository - identity preservation cannot be "
                 "verified" % sha[:12]], notes)
    base = pinned_baseline_tree(ctx)
    if base is None:
        return (["preservation: pinned R3 checkpoint tree is unavailable"],
                notes)
    if base.canon is None:
        return (["preservation: the canon does not exist at the pinned R3 "
                 "checkpoint %s" % sha[:12]], notes)
    binv, bprobs = parse_inventory(base.canon)
    if bprobs or not binv.sections:
        binv = ctx.inv  # the checkpoint predates 15.9.11; read it with today's
    bctx = Ctx(base, binv)
    resolved_forward = set(getattr(ctx, "amend_resolved", set()))
    for key in PRESERVED_POPULATIONS:
        if key == "DR2-generic":
            _h, brows, _ = parse_receipt_population(base, binv, key)
        else:
            _h, brows, _ = parse_canon_population(base.canon, binv, key)
        base_ids = [r[0].strip("`") for r in brows]
        live_ids = set(ctx.ids(key))
        if not base_ids:
            continue
        population = PRESERVED_AMEND_POPULATION[key]
        missing = [i for i in base_ids
                   if i not in live_ids
                   and (population, i) not in resolved_forward]
        if missing:
            probs.append("preservation %s: %d committed identity/identities no "
                         "longer resolve and are not AMEND-resolved forward "
                         "(renamed, substituted, renumbered, or dropped): %s"
                         % (key, len(missing), missing[:6]))
        notes.append("preservation %s: %d committed identities, %d live"
                     % (key, len(base_ids), len(live_ids)))
    return probs, notes


BASELINE_LOGICAL_POPULATIONS = (
    "GROUP", "LEAF", "XW2", "SRC2", "EV2", "DR2")


def check_baseline_row_amendments(ctx):
    """Every same-ID pinned-R3 row change needs one direct structured revise.

    This is the reverse half of AMEND validation: it detects silent mutations
    even when no AMEND row happens to exist.  Composite LEAF/SRC2 records are
    compared once as logical identities.
    """
    sha = ctx.inv.commits.get("r3-checkpoint")
    repo = ctx.tree.repo or ctx.tree.root
    if not sha or not git_commit_exists(repo, sha):
        return
    baseline = pinned_baseline_tree(ctx)
    if baseline is None:
        return
    details = getattr(ctx, "amend_details", [])
    for population in BASELINE_LOGICAL_POPULATIONS:
        old = cached_population_snapshot(ctx, population, baseline=True)
        current = cached_population_snapshot(ctx, population)
        for problem in old["problems"]:
            ctx.problems.append(
                "baseline %s population parse failed: %s"
                % (population, problem))
        for rid in sorted(set(old["records"]) & set(current["records"])):
            if old["records"][rid] == current["records"][rid]:
                continue
            matches = [
                detail for detail in details
                if detail["population"] == population
                and detail["prior"] == rid
                and detail["checkpoint"] == sha
                and detail["action"] == "revise"
                and detail["currents"] == [rid]
            ]
            if len(matches) != 1:
                ctx.problems.append(
                    "baseline %s %s: same-ID governed row changed from pinned "
                    "R3 checkpoint without exactly one direct AMEND revise "
                    "(found %d)" % (population, rid, len(matches)))


def _allocated_number(identity, population):
    if population == "LEAF":
        match = re.fullmatch(r"(CBA2-[ACRLS]\d{2})\.(\d+)", identity)
        return ((match.group(1), int(match.group(2))) if match else None)
    width = {"XW2": 4, "EV2": 4}[population]
    match = re.fullmatch(r"%s-(\d{%d})" % (population, width), identity)
    return ((population, int(match.group(1))) if match else None)


def check_amended_allocation_continuity(ctx):
    """Admit current gaps only when historical allocation remains complete.

    Allocated identity history is the pinned R3 register plus every structured
    AMEND prior/current identity and every live identity.  The union may never
    skip a number; a missing live identity must resolve through a non-revise
    AMEND; and a consumed prior identity may never reappear live.
    """
    sha = ctx.inv.commits.get("r3-checkpoint")
    repo = ctx.tree.repo or ctx.tree.root
    if not sha or not git_commit_exists(repo, sha):
        return
    baseline = pinned_baseline_tree(ctx)
    if baseline is None:
        return
    details = getattr(ctx, "amend_details", [])
    resolved = set(getattr(ctx, "amend_resolved", set()))
    for population in ("LEAF", "XW2", "EV2"):
        old = cached_population_snapshot(ctx, population, baseline=True)
        current = cached_population_snapshot(ctx, population)
        old_ids = set(old["records"])
        current_ids = set(current["records"])
        allocated = set(old_ids) | set(current_ids)
        for detail in details:
            if detail["population"] != population:
                continue
            allocated.add(detail["prior"])
            allocated.update(detail["currents"])

        by_family = {}
        malformed = []
        for rid in allocated:
            parsed = _allocated_number(rid, population)
            if parsed is None:
                malformed.append(rid)
                continue
            family, number = parsed
            by_family.setdefault(family, set()).add(number)
        if malformed:
            ctx.problems.append(
                "%s allocation history: malformed identity/identities %s"
                % (population, sorted(malformed)))
        for family, numbers in sorted(by_family.items()):
            ctx.problems += contiguous_from_one(
                sorted(numbers), "%s allocated identity history" % family)

        base_high_water = {}
        for rid in old_ids:
            parsed = _allocated_number(rid, population)
            if parsed:
                family, number = parsed
                base_high_water[family] = max(
                    number, base_high_water.get(family, 0))
        for rid in sorted(current_ids - old_ids):
            parsed = _allocated_number(rid, population)
            if not parsed:
                continue
            family, number = parsed
            if number <= base_high_water.get(family, 0):
                ctx.problems.append(
                    "%s %s: fills/reuses an identity at or below the pinned "
                    "historical high-water %d"
                    % (population, rid, base_high_water[family]))

        for rid in sorted(allocated - current_ids):
            if (population, rid) not in resolved:
                ctx.problems.append(
                    "%s %s: previously allocated identity is absent from the "
                    "current register without governed AMEND lineage"
                    % (population, rid))
        for rid in sorted(current_ids):
            if (population, rid) in resolved:
                ctx.problems.append(
                    "%s %s: a non-revise AMEND consumed this identity, but it "
                    "was reused in the current register" % (population, rid))


# --------------------------------------------------------------------------
# 21. G15R — actual touched/required-population repair gate.
# --------------------------------------------------------------------------


def check_g15r(ctx, migration, need):
    """Report and enforce only populations actually touched or triggered.

    DR2 is universal. Post-R3.1 migration also triggers SRC2, fragments,
    dispositions, AMEND, and structured AMEND details. Other support
    populations trigger from their governed dependency or their presence.
    """
    rows = []
    post = migration == "post-R3.1"
    order = (("SRC2-base", post),
             ("SRC2-date-component", need["date"]),
             ("fragment-inventory", need["frag"]),
             ("scenario-fragment-inventory",
              bool(ctx.pop.get("SXW2-edge"))),
             ("BND-bundle", need["bnd"]),
             ("SM2-record", need["sm2"]),
             ("SS2-record", need["ss2"]),
             ("DISP-detail", need["disp"]),
             ("BLK-record", bool(ctx.pop.get("BLK-record"))),
             ("RES-record", need["res"] or bool(ctx.pop.get("RES-record"))),
             ("DR2-AMEND", need["amend"]),
             ("AMEND-detail", need["amend"]),
             ("DR2-generic", True))
    for pop, required in order:
        triggered = required or bool(ctx.pop.get(pop, []))
        if not triggered:
            continue
        if pop == "DR2-AMEND":
            present = any((ctx.f("DR2-generic", r, "Type") or "").strip("`")
                          == "AMEND" for r in ctx.pop.get("DR2-generic", []))
            count = sum(1 for r in ctx.pop.get("DR2-generic", [])
                        if (ctx.f("DR2-generic", r, "Type") or "").strip("`")
                        == "AMEND")
        else:
            count = len(ctx.pop.get(pop, []))
            present = count > 0
        state = "present(%d)" % count if present else "ABSENT"
        if required and not present:
            ctx.problems.append("G15R/%s: triggered population is absent or "
                                "empty in a state that requires it" % pop)
            state = "FAIL(absent)"
        rows.append("%s=%s" % (pop, state))
    ctx.notes.append("G15R triggered populations: " + "; ".join(rows))


# --------------------------------------------------------------------------
# 22. THE single top-level entry point.
# --------------------------------------------------------------------------


def validate_tree(tree):
    """Validate a complete governed document tree. Returns (problems, notes).
    An empty problem list is ACCEPT. Every case in this module - the committed
    baseline, every adversarial mutation, every positive control, and the
    complete future-R3.1 migrated document - calls exactly this function."""
    problems, notes = [], []
    if tree.canon is None:
        return ["canon document is MISSING - the governing standard is a "
                "required input and cannot be absent"], notes
    inv, ip = parse_inventory(tree.canon)
    problems += ip
    if ip:
        return problems, notes
    problems += reconcile_inventory(tree.canon, inv)
    problems += check_immutable_ranges(tree.canon, inv)
    problems += check_canon_population_locations(tree.canon, inv)
    problems += check_plan(tree.plan)
    problems += check_canon_live_status(tree.canon, tree.plan)
    problems += check_accepted_status_control_tree(tree)
    migration = parse_migration_state(tree.plan)

    ctx = Ctx(tree, inv)
    ctx.problems += problems
    ctx.notes += notes
    check_headers(ctx, migration)

    published = Published(tree.repo or tree.root,
                          inv.commits.get("published-v1.1"))
    if not published.ok:
        ctx.problems.append("pinned published v1.1 edition at %r could not be "
                            "loaded - normalized text lengths, the 1-89 "
                            "scenario population, and the published LEAF "
                            "population cannot be derived"
                            % inv.commits.get("published-v1.1"))

    active = check_group_leaf(ctx)
    edges = check_xw2(ctx, published, active, migration)
    sxw2_edges = check_sxw2(ctx, published)
    edges += sxw2_edges
    src2 = check_src2_ev2(ctx, active, migration)
    dr2 = check_dr2(ctx, edges, active, migration)
    check_leaf_references(ctx, edges, dr2, active)
    scenario_frags = check_scenario_fragments(
        ctx, sxw2_edges, dr2, published)
    frags = check_fragments(ctx, [e for e in edges
                                  if e.get("register") != "SXW2"],
                            dr2, published, migration)
    all_frags = dict(frags)
    all_frags.update(scenario_frags)
    check_bundles(ctx, all_frags, edges, dr2)
    comps, primaries = check_date_components(ctx, src2, dr2, migration)
    sm2_ids = {r[0].strip("`") for r in ctx.pop["SM2-record"]}
    ss2_ids = {r[0].strip("`") for r in ctx.pop["SS2-record"]}
    details = check_disp(ctx, edges, dr2, published, sm2_ids, ss2_ids,
                         migration)
    blk_anchors = {(ctx.f("BLK-record", r, "Subject candidate anchor or —")
                    or "").strip().strip("`")
                   for r in ctx.pop["BLK-record"]}
    blk_anchors.discard(DASH)
    sm2, ss2 = check_sm2_ss2(ctx, src2, frags, details, blk_anchors)
    check_blk_res(ctx, sm2, ss2, frags)
    check_amend(ctx, dr2)
    check_amended_dr2_references(ctx)
    check_version_lineage(ctx)
    check_baseline_row_amendments(ctx)
    check_amended_allocation_continuity(ctx)

    pprobs, pnotes = check_preservation(ctx)
    ctx.problems += pprobs
    ctx.notes += pnotes

    # migration-state conformance: the governed switch that replaces R2.9's
    # hard-coded "legacy marker" list.
    terminal_types = set(ctx.vocab("xw2-terminal-edge-type"))
    mistyped = [e["id"] for e in edges
                if e["terminal"] and dr2.get(e["dec"])
                and dr2[e["dec"]]["type"] != "DISP"]
    nonconformities = {
        "SRC2 base table header does not match the pinned SRC2-base schema":
            ctx.header_conforms("SRC2-base") is False,
        "official-mutable detail header does not match its pinned schema":
            ctx.header_conforms("SRC2-detail-official-mutable") is False,
        "terminal edges carry non-DISP decision records":
            bool(mistyped),
        "no fragment inventory exists for the committed XW2 edges":
            bool(edges) and not frags,
        "no date-component rows exist for the committed SRC2 records":
            bool(src2) and not comps,
    }
    open_nc = sorted(k for k, v in nonconformities.items() if v)
    if migration == "pre-R3.1":
        closed = sorted(k for k, v in nonconformities.items() if not v)
        if closed:
            ctx.problems.append(
                "migration state: the repair plan states R3.1 has NOT started, "
                "yet the document no longer shows the backlogged legacy "
                "nonconformity/ies %s - refusing to treat an unmigrated "
                "population as R3.1-conforming without the governed migration"
                % closed)
        else:
            ctx.notes.append("migration state pre-R3.1: legacy nonconformities "
                             "recognized and backlogged: " + "; ".join(open_nc))
    elif migration == "post-R3.1":
        if open_nc:
            ctx.problems.append(
                "migration state: the repair plan states R3.1 executed, yet "
                "these legacy nonconformities remain unmigrated: %s" % open_nc)
        else:
            ctx.notes.append("migration state post-R3.1: every legacy "
                             "nonconformity is closed")

    need = {
        "date": migration == "post-R3.1" and bool(src2),
        "frag": migration == "post-R3.1" and bool(edges),
        "bnd": any(f["bundle"] != DASH for f in frags.values()),
        "sm2": any(d["etype"] == "unsupported-residual" for d in details)
               or bool(ctx.pop["BLK-record"]),
        "ss2": bool(ctx.pop["SM2-record"]),
        "disp": migration == "post-R3.1" and any(e["terminal"] for e in edges),
        "blk": False,
        "res": any((ctx.f("BLK-record", r, "Finding status") or "").strip()
                   == "resolved" for r in ctx.pop["BLK-record"]),
        "amend": migration == "post-R3.1",
    }
    check_g15r(ctx, migration, need)

    ctx.notes.append("populations: " + ", ".join(
        "%s=%d" % (k, len(v)) for k, v in sorted(ctx.pop.items()) if v))
    ctx.notes.append("migration state: %s" % migration)
    # deterministic ordering, de-duplicated
    seen, out = set(), []
    for p in ctx.problems:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out, ctx.notes


# --------------------------------------------------------------------------
# 23. The control repository — a COMPLETE temporary Git document tree.
#
#     Every case below materializes real files in this repository and calls
#     validate_tree() on them. There is no in-memory fixture, no simulated
#     block, and no second validation path.
# --------------------------------------------------------------------------

ACCEPT_RECEIPT_REL = os.path.join(
    "work", "architect-completion", "CONTROL_INDEPENDENT_ACCEPTANCE.md")
R31_RECEIPT_REL = os.path.join(
    "work", "architect-completion",
    "ARCHITECT_CBA_CANON_V2_R3_1_A_SERIES_REPAIR.md")
PROPOSAL_RECEIPT_REL = R31_RECEIPT_REL

RES_ID = "RES-0001"
RES_BLK = "BLK-0001"
RES_OUTCOME = "out-of-scope-determination"
RES_AUTHORITY = "foundation adjudication (canon 15.9.3)"
RES_MAKER = "agent:claude-code"
RES_CHECKER = "agent:codex"
RES_REOPEN = "reopen on qualifying first-party operational provenance"
RES_LIMITS = "none"
RES_DIGEST = sha_hex("|".join([RES_BLK, RES_OUTCOME, RES_AUTHORITY, RES_MAKER,
                               RES_CHECKER,
                               PROPOSAL_RECEIPT_REL.replace(os.sep, "/"),
                               RES_REOPEN, RES_LIMITS]))


def _run(cwd, *args):
    r = subprocess.run(args, cwd=cwd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("%s failed: %s" % (args, r.stderr.decode()[:400]))
    return r.stdout


class ControlRepo(object):
    """A real temporary Git repository holding: the pinned published v1.1
    edition, the pinned R3 checkpoint, and the live documents. `build_bases`
    later adds a maker checkpoint containing the exact proposed RES row and a
    strict descendant checker-receipt commit."""

    def __init__(self, src_root, source_ref):
        self.src = os.path.abspath(src_root)
        self.dir = tempfile.mkdtemp(prefix="cba-canon-control-")
        src_tree = Tree(self.src, ref=source_ref)
        inv, _ = parse_inventory(src_tree.canon)
        self.src_inv = inv
        v11 = inv.commits["published-v1.1"]
        r3 = inv.commits["r3-checkpoint"]
        _run(self.dir, "git", "init", "-q", ".")
        _run(self.dir, "git", "config", "user.email", "control@example.invalid")
        _run(self.dir, "git", "config", "user.name", "control")
        _run(self.dir, "git", "config", "commit.gpgsign", "false")

        # (1) the published v1.1 edition
        blob = git_blob(src_tree.repo, v11, CANON_REL)
        self._write_bytes(CANON_REL, blob)
        self.v11 = self._commit("published v1.1 edition")

        # (2) the R3 checkpoint documents
        base = Tree(self.src, ref=r3)
        self._clear()
        self._write(CANON_REL, base.canon)
        self._write(PLAN_REL, base.plan)
        for rel, txt in sorted(base.receipts.items()):
            self._write(rel, txt)
        self.r3 = self._commit("R3 checkpoint")

        # (3) the accepted pre-R3.1 status tree, repinned onto this
        # repository's commits. The historical source commit predates the
        # control-pointer field, so first commit its equivalent document tree,
        # then point the synthetic live plan to that strict ancestor.
        self._clear()
        seed = {CANON_REL: self._repin(src_tree.canon, v11, r3),
                PLAN_REL: src_tree.plan}
        for rel, txt in sorted(src_tree.receipts.items()):
            seed[rel] = txt
        for rel, txt in sorted(seed.items()):
            self._write(rel, txt)
        self.control = self._commit("accepted pre-R3.1 status control tree")

        self.live = dict(seed)
        self.live[PLAN_REL] = set_accepted_status_control_tree(
            self.live[PLAN_REL], self.control)
        self.restore()
        self.head = self._commit("live documents with control-tree pointer")
        self.maker = None
        self.accept = None
        self._bases = None

    # -- file helpers
    def _abs(self, rel):
        return os.path.join(self.dir, rel)

    def _write(self, rel, text):
        p = self._abs(rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(text)

    def _write_bytes(self, rel, data):
        p = self._abs(rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as fh:
            fh.write(data)

    def _clear(self):
        for sub in ("docs", "work"):
            d = os.path.join(self.dir, sub)
            if os.path.isdir(d):
                shutil.rmtree(d)

    def _commit(self, msg):
        _run(self.dir, "git", "add", "-A", ".")
        _run(self.dir, "git", "commit", "-q", "-m", msg)
        return _run(self.dir, "git", "rev-parse", "HEAD").decode().strip()

    def _repin(self, canon, v11, r3):
        """Repin Inventory E onto this repository's own commits."""
        canon = canon.replace(v11, "@V11@").replace(r3, "@R3@")
        return canon.replace("@V11@", self.v11).replace("@R3@", self.r3)

    def restore(self):
        """Reset the working tree to the pristine live documents."""
        self._clear()
        for rel, txt in sorted(self.live.items()):
            self._write(rel, txt)

    def remove(self, rel):
        p = self._abs(rel)
        if os.path.isfile(p):
            os.remove(p)

    def tree(self):
        return Tree(self.dir)

    def cleanup(self):
        shutil.rmtree(self.dir, ignore_errors=True)


def acceptance_receipt_text(accepted_checkpoint):
    return (
        "# Control independent acceptance receipt\n\n"
        "This receipt is the checker-side evidence a `RES-…` resolution's\n"
        "`Accepted checkpoint commit` resolves to. It is a control artifact "
        "of the\nR2.14 validator, not a governed record of any repair unit.\n\n"
        "## Independent acceptance record\n\n"
        "| Resolution ID | Accepted RES version | Accepted content digest | "
        "Accepted proposed outcome | Maker/proposer identity | "
        "Independent checker identity | Accepted checkpoint commit | "
        "Acceptance verdict |\n"
        "|---|---|---|---|---|---|---|---|\n"
        "| %s | 1 | %s | %s | %s | %s | %s | ACCEPT |\n"
        % (RES_ID, RES_DIGEST, RES_OUTCOME, RES_MAKER, RES_CHECKER,
           accepted_checkpoint))


# --------------------------------------------------------------------------
# 24. The complete future-R3.1 migrated document.
#
#     This is a DOCUMENT, not a fixture: it is written into the control
#     repository as real canon / plan / receipt files and validated through the
#     same top-level entry point as the committed baseline. It mints no record
#     of any governed repair unit - every identity below exists only inside the
#     temporary control tree.
# --------------------------------------------------------------------------

BUNDLE_LEAF = "CBA-A02.4"
KIND_FOR = {"process-only": "process-instruction",
            "unsupported-residual": "substantive-obligation",
            "invalid": "authority-assertion"}


def _hydrate_post_r31_status(canon, live_canon):
    """Copy only the current live status surfaces into a control-tree canon.

    The accepted control ancestor intentionally predates both the same-family
    checkpoint and R3.1 execution. The synthetic migrated tree must preserve
    that historical population while carrying the same truthful live route as
    the document being validated.
    """
    def exact_line(text, prefix):
        return next((ln for ln in text.splitlines()
                     if ln.startswith(prefix)), "")

    old_amendment = exact_line(canon, "**Amendment date:**")
    live_amendment = exact_line(live_canon, "**Amendment date:**")
    if not old_amendment or not live_amendment:
        raise AssertionError("post-R3.1 amendment status is absent")
    canon = canon.replace(old_amendment, live_amendment, 1)

    old_top = line_range(
        canon,
        "**Current pre-R3.1 status "
        "(supersedes the R2.13 sequencing sentence above):**",
        "> **Use rule:**")
    live_top = line_range(
        live_canon,
        "**Current R3.1 accepted status "
        "(supersedes the R2.13 sequencing sentence above):**",
        "> **Use rule:**")
    if not old_top or not live_top:
        raise AssertionError("post-R3.1 top status mirror is absent")
    canon = canon.replace(old_top, live_top, 1)

    edition_prefixes = (
        "| **Repair v2.0 — working draft, pre-R3.1 compatibility** |",
        "| **Repair v2.0 — working draft, same-family deferral "
        "compatibility** |",
        "| **Repair v2.0 — working draft, R3.1** |",
    )
    prior_live_row = ""
    for prefix in edition_prefixes:
        live_row = exact_line(live_canon, prefix)
        old_row = exact_line(canon, prefix)
        if not live_row:
            raise AssertionError("post-R3.1 edition status row is absent")
        if old_row:
            canon = canon.replace(old_row, live_row, 1)
        elif prior_live_row and prior_live_row in canon:
            canon = canon.replace(
                prior_live_row, prior_live_row + "\n" + live_row, 1)
        else:
            raise AssertionError(
                "post-R3.1 edition status insertion anchor is absent")
        prior_live_row = live_row

    foundation_start = (
        "The R2.10–R2.13 review findings are classified exhaustively below.")
    foundation_end = "| Foundation review finding | Balanced disposition |"
    old_foundation = line_range(canon, foundation_start, foundation_end)
    live_foundation = line_range(
        live_canon, foundation_start, foundation_end)
    if not old_foundation or not live_foundation:
        raise AssertionError("post-R3.1 §15.9 status mirror is absent")
    canon = canon.replace(old_foundation, live_foundation, 1)

    register_start = "### 15.10 Active v2 register (created by R3; A family)"
    register_end = "#### 15.10.1 A family — GROUP index"
    old_register = line_range(canon, register_start, register_end)
    live_register = line_range(live_canon, register_start, register_end)
    if not old_register or not live_register:
        raise AssertionError("post-R3.1 §15.10 status mirror is absent")
    canon = canon.replace(old_register, live_register, 1)

    old_family_start = (
        "**A-family v2 status (R3 executed; independently REJECTED — not "
        "certified).**")
    live_family_start = (
        "**A-family v2 status (R3.1 independently ACCEPTED; R4 unblocked but "
        "not started).**")
    family_end = "### 19.4 CBA Guide sections reviewed for discovery"
    old_family = line_range(canon, old_family_start, family_end)
    live_family = line_range(live_canon, live_family_start, family_end)
    if not old_family or not live_family:
        raise AssertionError("post-R3.1 §19.3 status mirror is absent")
    return canon.replace(old_family, live_family, 1)


def _bounds(length, n):
    return [round(i * length / float(n)) for i in range(n + 1)]


def build_r31_document(repo, published, inv):
    """Return (canon_text, plan_text, receipt_text) for a complete migrated
    R3.1 document tree built from the live documents."""
    canon = repo.live[CANON_REL]
    source_live_canon = Tree(repo.src).canon
    if source_live_canon is None:
        raise AssertionError("live post-R3.1 canon is not resolvable")
    canon = _hydrate_post_r31_status(canon, source_live_canon)
    # The reusable accepted-status tree predates the later independently
    # accepted same-family compatibility contract. Construct the future R3.1
    # plan from the exact accepted status descendant so its R4 dependency,
    # sequencing, and item-23 join requirements are present, then repin the
    # accepted-control pointer to this temporary repository.
    accepted_status_commit = \
        "41096c8f3a8277e56ad38f98482520176a551521"
    accepted_plan_blob = git_blob(repo.src, accepted_status_commit, PLAN_REL)
    if not accepted_plan_blob:
        raise AssertionError(
            "accepted same-family status plan is not resolvable")
    plan = set_accepted_status_control_tree(
        accepted_plan_blob.decode("utf-8"), repo.control)
    _h, xrows, _p = parse_canon_population(canon, inv, "XW2-edge")
    hdr_i = {f: i for i, f in enumerate(inv.schema["XW2-edge"])}
    terminal = set(inv.vocab["xw2-terminal-edge-type"])

    by_leaf = {}
    for r in xrows:
        by_leaf.setdefault(r[hdr_i["Historical v1.1 LEAF"]].strip("`"),
                           []).append(r)

    frag_rows, bnd_rows, edge_scope, edge_dec = [], [], {}, {}
    bundle_member_scope = {}
    disp_rows, dr2_rows = [], []
    amend_successors = {}
    next_dr2 = max(int(i.split("-")[1]) for i in
                   [r[0] for r in xrows] or ["XW2-0000"]) and 48
    decomp = "DR2-%04d" % next_dr2
    next_dr2 += 1

    for leaf in sorted(by_leaf):
        rows = by_leaf[leaf]
        length = published.leaf_len.get(leaf)
        groups = []
        if leaf == BUNDLE_LEAF:
            multi = [r for r in rows
                     if r[hdr_i["Edge type"]].strip("`")
                     in ("split", "merge", "partial-overlap")][:3]
            if len(multi) >= 2:
                groups.append(multi)
                groups += [[r] for r in rows if r not in multi]
            else:
                groups = [[r] for r in rows]
        else:
            groups = [[r] for r in rows]
        bounds = _bounds(length, len(groups))
        for gi, grp in enumerate(groups):
            fid = "%s:F%d" % (leaf, gi + 1)
            a, b = bounds[gi], bounds[gi + 1]
            span = "span:%d-%d" % (a, b)
            eids = sorted(r[0] for r in grp)
            kinds = {KIND_FOR.get(r[hdr_i["Edge type"]].strip("`"),
                                  "substantive-obligation") for r in grp}
            kind = ("substantive-obligation" if len(kinds) > 1
                    else list(kinds)[0])
            qualifier = (published.leaf_authority.get(leaf, DASH)
                         if kind == "authority-assertion" else DASH)
            bundle = DASH
            if len(grp) >= 2:
                bundle = "BND-%04d" % (len(bnd_rows) + 1)
                mb = _bounds(b - a, len(grp))
                mscopes, mtypes, mtargets = [], [], []
                for mi, r in enumerate(sorted(grp, key=lambda x: x[0])):
                    member_scope = "span:%d-%d" % (a + mb[mi],
                                                    a + mb[mi + 1])
                    mscopes.append(member_scope)
                    bundle_member_scope[r[0]] = member_scope
                    mtypes.append(r[hdr_i["Edge type"]].strip("`"))
                    mtargets.append(r[hdr_i["Active v2 LEAF or —"]].strip("`"))
                bnd_rows.append(
                    "| %s | XW2-BND | %s | %s | %s | %s | %s | %s | %s | "
                    "%s | active | current | 1 | %s |"
                    % (bundle, leaf, DASH, fid, ", ".join(eids),
                       ", ".join(mtypes), ", ".join(mtargets),
                       ", ".join(mscopes), span, DASH))
            frag_rows.append(
                "| %s | %s | %s | %s | %s | %s | %s | %s | current | 1 | "
                "none |"
                % (fid, leaf, kind, qualifier, span, decomp, bundle,
                   ", ".join(eids)))
            for r in grp:
                eid = r[0]
                edge_scope[eid] = "[%s] %s — %s" % (
                    fid, bundle_member_scope.get(eid, span),
                    r[hdr_i["Scope/relationship"]])
                etype = r[hdr_i["Edge type"]].strip("`")
                if etype in terminal:
                    prior_did = r[hdr_i["Decision record"]].strip("`")
                    did = "DR2-%04d" % next_dr2
                    next_dr2 += 1
                    edge_dec[eid] = did
                    amend_successors.setdefault(prior_did, []).append(did)
                    reason = {"invalid": "false-claim",
                              "process-only": "process-material",
                              "no-successor": "out-of-scope-or-obsolete",
                              "unsupported-residual": "authority-not-located"
                              }[etype]
                    ev = "SRC2-001" if etype == "invalid" else DASH
                    anchor = "§12.2" if etype == "invalid" else DASH
                    disp_rows.append(
                        "| %s | XW2-DISP | %s | %s | %s | %s | %s | %s | %s | "
                        "%s | %s | %s | %s | %s | none | superseded on later "
                        "qualifying authority | %s | current | 1 |"
                        % (did, leaf, fid, DASH, DASH, span, eid, etype,
                           DASH, DASH, ev, reason, anchor, DASH))
                    dr2_rows.append(
                        "| %s | `DISP` | %s terminal %s disposition of %s | "
                        "No active owner selected | Terminal disposition per "
                        "canon 15.9.4 | Migrated from the committed "
                        "OWN/ATOM typing through AMEND lineage | %s | R3.1 / "
                        "temporary tree |"
                        % (did, leaf, etype, fid, DASH))

    dr2_rows.insert(0,
                    "| %s | `ATOM` | Complete historical-LEAF decomposition for "
                    "the committed A-series crosswalk | Declared exhaustive "
                    "fragment inventories | Enumeration floor over the "
                    "normalized requirement text | Every historical source LEAF "
                    "is partitioned into fragments whose spans cover exactly "
                    "[0,L) | %s | R3.1 / temporary tree |"
                    % (decomp, DASH))

    # -- SXW2 control population (genuine, partition-exact)
    sxw2_rows, sfrag_rows = [], []
    for idx, (scen, etype) in enumerate(
            ((1, "invalid"), (2, "no-successor")), start=1):
        length = published.scenario_len[scen]
        sid = "SXW2-%04d" % idx
        sname = "scenario-%d" % scen
        fid = "%s:F1" % sname
        span = "span:0-%d" % length
        did = "DR2-%04d" % next_dr2
        next_dr2 += 1
        sxw2_rows.append("| %s | %s | %s | `%s` | [%s] %s — whole published "
                         "scenario | %s |"
                         % (sid, sname, DASH, etype, fid, span, did))
        sfrag_rows.append("| %s | %s | substantive-obligation | %s | %s | %s | "
                          "%s | current | 1 | none |"
                          % (fid, sname, span, decomp, DASH, sid))
        reason = ("false-claim" if etype == "invalid"
                  else "out-of-scope-or-obsolete")
        disp_rows.append(
            "| %s | SXW2-DISP | %s | %s | %s | %s | %s | %s | %s | %s | %s | "
            "%s | %s | %s | none | superseded on a later foundation amendment "
            "| %s | current | 1 |"
            % (did, DASH, DASH, sname, fid, span, sid, etype, DASH, DASH,
               DASH, reason, DASH, DASH))
        dr2_rows.append(
            "| %s | `DISP` | %s terminal %s scenario disposition of %s | "
            "No active scenario owner selected | Terminal scenario disposition "
            "per canon 15.9.8 | Control scenario disposition | %s | R3.1 / "
            "temporary tree |" % (did, sname, etype, fid, DASH))

    amend = "DR2-%04d" % next_dr2
    next_dr2 += 1
    dr2_rows.append(
        "| %s | `AMEND` | DR2-0037, DR2-0038, DR2-0039 (committed terminal "
        "dispositions) | Superseded by the current DISP records minted above; "
        "every live terminal-edge reference updated in the same commit | "
        "AMEND lineage per canon 15.9.2 | The committed OWN/ATOM terminal "
        "typing is retroactively mistyped and is superseded, never renumbered "
        "or reused | %s | R3.1 / temporary tree |" % (amend, DASH))

    amend_rows = []
    for prior, currents in sorted(amend_successors.items()):
        action = "split" if len(currents) > 1 else "replace"
        amend_rows.append(
            "| %s | DR2 | %s | %s | %s | %s | %s | %s | %s |"
            % (amend, prior, DASH, repo.r3, action, ", ".join(currents),
               DASH, "terminal disposition retyped through current DISP "
                     "records"))

    # Every committed XW2 row receives a governed same-ID revision because the
    # fragment migration rewrites its normalized scope (and terminal rows also
    # receive a current DISP decision reference).  The four legacy SRC2 logical
    # records likewise receive one coherent base+detail schema-onboarding
    # revision from a versionless checkpoint to version 1.
    for row in xrows:
        eid = normalize_record_id_cell(row[0])
        amend_rows.append(
            "| %s | XW2 | %s | %s | %s | revise | %s | %s | "
            "fragment-scoped R3.1 crosswalk revision |"
            % (amend, eid, DASH, repo.r3, eid, DASH))
    for rid, *_rest in SRC2_BASE_ROWS:
        amend_rows.append(
            "| %s | SRC2 | %s | %s | %s | revise | %s | 1 | "
            "legacy SRC2 base+detail schema migrated coherently to version 1 |"
            % (amend, rid, DASH, repo.r3, rid))

    # -- rewrite the canon: SRC2 tables, XW2 rows, and the SXW2 section
    canon = _rewrite_src2(canon, inv)
    canon = _rewrite_xw2(canon, inv, edge_scope, edge_dec)
    canon = _add_sxw2_section(canon, sxw2_rows)

    plan = replace_plan_section_status(
        plan,
        "## One-time pre-R3.1 foundation-compatibility checkpoint",
        "## Owner-authorized same-family deferral compatibility checkpoint",
        "independently **ACCEPTED** before R3.1 execution (R3.1 control "
        "tree). This remains a one-time compatibility checkpoint, not an "
        "R2.x unit and not substantive R3.1 migration.")
    plan = re.sub(
        r"(?:R3\.1 is the next construction unit only after an independent\s+"
        r"compatibility checker returns ACCEPT|The independent compatibility "
        r"checker returned ACCEPT on\s+corrective checkpoint "
        r"`?[0-9a-f]{40}`?;\s+"
        r"R3\.1 is\s+now unblocked and is the next construction unit)\.",
        "R3.1 proceeded only after an independent compatibility checker "
        "returned ACCEPT.",
        plan,
        count=1)
    # The reusable accepted-status control tree predates the separately
    # owner-authorized same-family compatibility checkpoint. Rehydrate that
    # checkpoint's governed plan section from its exact accepted maker tree
    # before constructing the synthetic post-R3.1 document. This is a real
    # committed input, not a parallel hard-coded status fixture.
    same_family_checkpoint = \
        "d6101f82b40f5c1e8c45c8be090e9b4743daefe5"
    if not plan_section(
            plan,
            "## Owner-authorized same-family deferral compatibility "
            "checkpoint",
            "## R3.1 "):
        same_plan_blob = git_blob(repo.src, same_family_checkpoint, PLAN_REL)
        if not same_plan_blob:
            raise AssertionError(
                "accepted same-family compatibility plan is not resolvable")
        same_plan = same_plan_blob.decode("utf-8")
        same_section = plan_section(
            same_plan,
            "## Owner-authorized same-family deferral compatibility "
            "checkpoint",
            "## R3.1 ")
        if not same_section:
            raise AssertionError(
                "accepted same-family compatibility plan section is absent")
        r31_heading = next(
            line for line in plan.splitlines(keepends=True)
            if line.startswith("## R3.1 "))
        plan = plan.replace(r31_heading, same_section + r31_heading, 1)
    plan = replace_plan_section_status(
        plan,
        "## Owner-authorized same-family deferral compatibility checkpoint",
        "## R3.1 ",
        "independently **ACCEPTED** before R3.1 execution (R3.1 control "
        "tree). This remains a narrowly owner-authorized compatibility "
        "checkpoint, not an R2.x unit and not substantive R3.1 migration.")
    plan = plan.replace(
        "Maker completion alone accepts nothing.",
        "R3.1 proceeded only after an independent same-family compatibility "
        "checker returned ACCEPT.",
        1)
    plan = replace_plan_section_status(
        plan,
        "## R3.1 ",
        "## R4 ",
        "independently **ACCEPTED** by `/root/validation_scout` at exact maker "
        "checkpoint `9239c1d3dc595538beb048c77788cd2c453240a4`, after an "
        "independent compatibility checker ACCEPT of the one-time "
        "compatibility checkpoint and an independent same-family "
        "compatibility checker ACCEPT.")

    receipt = _r31_receipt(dr2_rows, disp_rows, frag_rows, bnd_rows,
                           sfrag_rows, amend_rows)
    return canon, plan, receipt


SRC2_BASE_ROWS = [
    ("SRC2-001", "`official-immutable`",
     "2023 NBA-NBPA Collective Bargaining Agreement (signed agreement, 2023 "
     "edition)", "agreement-as-of:2023-06-28",
     "<https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/"
     "2023-NBA-Collective-Bargaining-Agreement.pdf>",
     "`bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`",
     "2850534", "2026-07-16T09:39:26Z", DASH, "`agent:claude-code`",
     "`session:r3-20260716-01`", "2026-07-16", "none", "current", "1"),
    ("SRC2-002", "`official-immutable`",
     "NBA Constitution and By-Laws, June 2024 edition", "edition:2024-06",
     "<https://official.nba.com/wp-content/uploads/sites/4/2024/06/"
     "NBA-Consitution-By-Laws-June-2024.pdf>",
     "`be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf`",
     "422247", "2026-07-16T09:40:09Z", DASH, "`agent:claude-code`",
     "`session:r3-20260716-01`", "2026-07-16",
     "edition identified by the source to month precision only",
     "current", "1"),
    ("SRC2-003", "`official-mutable`",
     "NBA Communications official release: NBA Salary Cap for 2023-24 season "
     "set at $136.021 million", "publication:2023-06-30",
     "<https://pr.nba.com/nba-salary-cap-for-2023-24-season-set-at-136-021-"
     "million/>",
     "`c162ae4a821c8ed38e1af37a75a5368d558ae941455210c0cd5b301d0e42329b`",
     "51234", "2026-07-16T09:59:50Z", DASH, "`agent:claude-code`",
     "`session:r3-20260716-01`", "2026-07-16",
     "Mutable webpage; hash is of the content retrieved at the recorded "
     "timestamp", "current", "1"),
    ("SRC2-004", "`official-mutable`",
     "NBA Communications official release: NBA sets Salary Cap for 2026-27 "
     "season at $164.961 million", "publication:2026-06-30",
     "<https://pr.nba.com/2026-27-salary-cap/>",
     "`cdc91324694aea16627b8e938d1c86c4865667e18e76d0beeb789d48628f4766`",
     "48211", "2026-07-16T09:59:51Z", DASH, "`agent:claude-code`",
     "`session:r3-20260716-01`", "2026-07-16",
     "Mutable webpage; hash is of the content retrieved at the recorded "
     "timestamp", "current", "1"),
]

SRC2_MUT_ROWS = [
    ("SRC2-003", "Official Release, June 30, 2023", "2023-06-30", DASH,
     "2023-24 Salary Cap $136.021 million", DASH),
    ("SRC2-004", "Official Release, June 30, 2026", "2026-06-30", DASH,
     "2026-27 Salary Cap $164.961 million; First Apron Level $209.015 million; "
     "Second Apron Level $221.686 million; Tax Level $200.428 million; "
     "Minimum Team Salary $148.465 million", DASH),
]

DATE_COMPONENTS = [
    ("SRC2-001", 1, "agreement-as-of", "primary", "2023-06-28",
     "Article I §1(d)", "none"),
    ("SRC2-001", 2, "effective", "primary", "2023-07-01",
     "Article XXXIX §1", "none"),
    ("SRC2-001", 3, "edition", "primary", "2023-07", "cover page",
     "edition identified by the source to month precision only"),
    ("SRC2-002", 1, "edition", "primary", "2024-06", "cover page",
     "edition identified by the source to month precision only"),
    ("SRC2-003", 1, "publication", "primary", "2023-06-30",
     "official release dateline", "none"),
    ("SRC2-004", 1, "publication", "primary", "2026-06-30",
     "official release dateline", "none"),
]


def _table(header, rows):
    return ("| " + " | ".join(header) + " |\n"
            + "|" + "|".join("---" for _ in header) + "|\n"
            + "\n".join(rows) + "\n")


def _rewrite_src2(canon, inv):
    base = _table(inv.schema["SRC2-base"],
                  ["| " + " | ".join(r) + " |" for r in SRC2_BASE_ROWS])
    mut = _table(inv.schema["SRC2-detail-official-mutable"],
                 ["| " + " | ".join(r) + " |" for r in SRC2_MUT_ROWS])
    for key, new in (("SRC2-base", base),
                     ("SRC2-detail-official-mutable", mut)):
        frm, to, _ = inv.sections[key]
        seg = line_range(canon, frm, to)
        lines = seg.splitlines(keepends=True)
        head = [ln for ln in lines if not ln.strip().startswith("|")]
        # keep every non-table line, then the rebuilt table
        rebuilt = "".join(head).rstrip("\n") + "\n\n" + new + "\n"
        canon = canon.replace(seg, rebuilt, 1)
    return canon


def _rewrite_xw2(canon, inv, edge_scope, edge_dec):
    frm, to, _ = inv.sections["XW2-edge"]
    seg = line_range(canon, frm, to)
    out = []
    hdr = None
    for ln in seg.splitlines(keepends=True):
        s = ln.strip()
        if s.startswith("|") and s.endswith("|"):
            cells = [c.strip() for c in s[1:-1].split("|")]
            if all(set(c) <= set("-: ") for c in cells):
                out.append(ln)
                continue
            if hdr is None:
                hdr = cells
                out.append(ln)
                continue
            eid = cells[0]
            if eid in edge_scope:
                cells[hdr.index("Scope/relationship")] = edge_scope[eid]
            if eid in edge_dec:
                cells[hdr.index("Decision record")] = edge_dec[eid]
            out.append("| " + " | ".join(cells) + " |\n")
        else:
            out.append(ln)
    return canon.replace(seg, "".join(out), 1)


def _add_sxw2_section(canon, sxw2_rows):
    block = ("#### 16.v2.2 Scenario crosswalk\n\n"
             "Typed edges from the pinned published historical scenarios to "
             "active v2 scenarios, per canon 15.9.8.\n\n"
             + _table(["Edge ID", "Historical scenario",
                       "Active v2 scenario or " + DASH, "Edge type",
                       "Scope/relationship", "Decision record"], sxw2_rows)
             + "\n")
    seg = line_range(canon, "#### 16.v2.2 Scenario crosswalk", "## 17.")
    if seg is None:
        raise AssertionError("governed 16.v2.2 SXW2 location is absent")
    return canon.replace(seg, block, 1)


def _r31_receipt(dr2_rows, disp_rows, frag_rows, bnd_rows, sfrag_rows,
                 amend_rows):
    sm2 = [
        "| SM2-0001 | candidate-obligation | %s | %s | §13.3 | CBA | 2023 "
        "NBA-NBPA Collective Bargaining Agreement (signed agreement, 2023 "
        "edition) | SRC2-001 | https://ak-static.cms.nba.com/cba.pdf | 2023 "
        "NBA-NBPA Collective Bargaining Agreement | 2850534 | "
        "bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32 | "
        "pages=676 | signed | provision:XIII §1 | full-text-sweep | SS2-0001 | "
        "2026-07-22T00:00:00Z | "
        "no-qualifying-authority-located-in-searched-sources | SS2-0001 | no "
        "qualifying authority located in the searched provisions | none | "
        "agent:claude-code | session:r31-control | 2026-07-22 | current | 1 |"
        % (DASH, DASH),
        "| SM2-0002 | candidate-obligation | %s | %s | §13.3 | BYL | NBA "
        "Constitution and By-Laws, June 2024 edition | SRC2-002 | "
        "https://official.nba.com/bylaws.pdf | NBA Constitution and By-Laws | "
        "422247 | "
        "be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf | "
        "pages=88 | unsigned | provision:Article VII | provision-read | "
        "SS2-0001 | 2026-07-22T00:00:00Z | "
        "no-qualifying-authority-located-in-searched-sources | SS2-0001 | no "
        "qualifying authority located in the searched provisions | none | "
        "agent:claude-code | session:r31-control | 2026-07-22 | current | 1 |"
        % (DASH, DASH),
        "| SM2-0003 | candidate-obligation | %s | %s | §13.3 | NBA | NBA "
        "Communications official release index | %s | https://pr.nba.com/ | "
        "%s | %s | %s | %s | %s | query:pick protection deferral processing | "
        "query | SS2-0001 | 2026-07-22T00:00:00Z | "
        "no-qualifying-authority-located-in-searched-sources | SS2-0001 | no "
        "qualifying official publication located | none | agent:claude-code | "
        "session:r31-control | 2026-07-22 | current | 1 |"
        % (DASH, DASH, DASH, DASH, DASH, DASH, DASH, DASH),
        "| SM2-0004 | candidate-obligation | %s | %s | §13.3 | ops-provenance "
        "| League operations first-party provenance availability | %s | "
        "provenance:league-ops | %s | %s | %s | %s | %s | "
        "query:first-party operational provenance availability | "
        "attestation-availability-check | SS2-0001 | 2026-07-22T00:00:00Z | "
        "no-qualifying-authority-located-in-searched-sources | SS2-0001 | no "
        "qualifying first-party operational provenance available | none | "
        "agent:claude-code | session:r31-control | 2026-07-22 | current | 1 |"
        % (DASH, DASH, DASH, DASH, DASH, DASH, DASH, DASH),
    ]
    ss2 = ["| SS2-0001 | candidate-obligation | %s | %s | §13.3 | CBA, BYL, "
           "NBA, ops-provenance | SM2-0001, SM2-0002, SM2-0003, SM2-0004 | "
           "CBA:covered, BYL:covered, NBA:covered, ops-provenance:covered | "
           "adequate-coverage | current | 1 |" % (DASH, DASH)]
    blk = ["| %s | candidate-obligation | %s | %s | §13.3 | "
           "blocked-unsupported-obligation | SS2-0001 | SM2-0001, SM2-0002, "
           "SM2-0003, SM2-0004 | %s | §13.3 | resolved | 1 | %s | %s | none |"
           % (RES_BLK, DASH, DASH, DASH, RES_ID, DASH)]
    res = ["| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | "
           "%s | %s | proposed | 1 | %s | %s | %s |"
           % (RES_ID, RES_BLK, RES_OUTCOME, RES_AUTHORITY, RES_MAKER,
              RES_CHECKER, PROPOSAL_RECEIPT_REL.replace(os.sep, "/"),
              DASH, DASH, DASH, DASH, DASH, DASH, RES_REOPEN, RES_LIMITS,
              DASH)]
    dates = ["| %s | %s#D%d | %s | %s | %s | %s | %s | current | 1 | %s |"
             % (r, r, k, b, role, v, loc, lim, DASH)
             for (r, k, b, role, v, loc, lim) in DATE_COMPONENTS]

    inv_fields = {
        "Decision records": ["DR ID", "Type", "Subject(s)", "Disposition",
                             "Test/tiebreak applied", "Rationale",
                             "Resulting active LEAF(s) or " + DASH,
                             "Unit/commit"],
    }
    out = ["# R3.1 A-series repair (control document tree)",
           "",
           "This document exists only inside the R2.14 validator's temporary "
           "control repository. It is the complete migrated R3.1 support "
           "population, written as real receipt tables and validated through "
           "the same top-level entry point as the committed baseline. It "
           "mints no governed record: no identity below exists in the real "
           "repository.", ""]

    def sec(title, header, rows):
        out.append("## " + title)
        out.append("")
        out.append("| " + " | ".join(header) + " |")
        out.append("|" + "|".join("---" for _ in header) + "|")
        out.extend(rows)
        out.append("")

    sec("Decision records", inv_fields["Decision records"], dr2_rows)
    sec("AMEND detail rows", ["AMEND record ID", "Population",
                               "Prior record ID", "Prior version or " + DASH,
                               "Prior checkpoint commit", "Action",
                               "Current record ID(s) or " + DASH,
                               "Current version(s) or " + DASH, "Reason"],
        amend_rows)
    sec("DISP detail rows", ["DR2 record ID", "DISP subject class",
                             "Historical source LEAF or " + DASH,
                             "Historical fragment ID or " + DASH,
                             "Historical scenario or " + DASH,
                             "Scenario fragment ID or " + DASH,
                             "Normalized scope", "Terminal edge ID",
                             "Terminal edge type",
                             "Search-manifest IDs or " + DASH,
                             "Search-set ID or " + DASH,
                             "Evidence/provenance references or " + DASH,
                             "No-owner reason",
                             "Preserved candidate anchor or " + DASH,
                             "Limitations", "Reopening condition",
                             "Superseding/current relationship or " + DASH,
                             "Status", "Version"], disp_rows)
    frag_hdr = ["Fragment ID", "Historical parent LEAF", "Fragment kind",
                "Historical authority qualifier or " + DASH,
                "Normalized fragment scope", "Decomposition decision record",
                "Disposition bundle ID or " + DASH, "Disposition edge ID(s)",
                "Fragment status", "Fragment version", "Limitations or " + DASH]
    sec("Fragment inventory", frag_hdr, frag_rows)
    sec("Scenario fragment inventory", ["Scenario fragment ID",
                                         "Historical scenario",
                                         "Fragment kind",
                                         "Normalized fragment scope",
                                         "Decomposition decision record",
                                         "Disposition bundle ID or " + DASH,
                                         "Disposition edge ID(s)",
                                         "Fragment status", "Fragment version",
                                         "Limitations or " + DASH], sfrag_rows)
    sec("Disposition bundles", ["Bundle ID", "BND subject class",
                                "Source historical LEAF or " + DASH,
                                "Historical scenario or " + DASH,
                                "Source fragment ID", "Member edge IDs",
                                "Member edge types", "Member target IDs",
                                "Member subject scopes", "Subject scope",
                                "Bundle class", "Bundle status",
                                "Bundle version",
                                "Superseding/current relationship or " + DASH],
        bnd_rows)
    sec("Search manifests", ["Search record ID", "Subject class",
                             "Subject historical LEAF or " + DASH,
                             "Subject historical fragment ID or " + DASH,
                             "Subject candidate anchor or " + DASH,
                             "Authority/provenance class searched",
                             "Source identity", "Source record ID or " + DASH,
                             "Canonical URL or authenticated provenance "
                             "identifier or " + DASH,
                             "Binary/version identity or " + DASH,
                             "Binary size bytes or " + DASH,
                             "Binary SHA-256 or " + DASH,
                             "Binary pagination or " + DASH,
                             "Binary signature/as-of or " + DASH,
                             "Exact locator/query/provision", "Search method",
                             "Search-set ID or " + DASH,
                             "Search cutoff timestamp", "Result",
                             "Result linkage or " + DASH, "Result details",
                             "Limitations or " + DASH, "Verifier identity",
                             "Verification session ID", "Verification date",
                             "Search status", "Search version"], sm2)
    sec("Search sets", ["Search set ID", "Subject class",
                        "Subject LEAF or " + DASH,
                        "Subject fragment ID or " + DASH,
                        "Subject candidate anchor or " + DASH,
                        "Required source classes", "Member SM2 IDs",
                        "Coverage assessment", "Adequacy result", "Set status",
                        "Set version"], ss2)
    sec("Blocked findings", ["Blocked finding ID", "Subject class",
                             "Subject historical LEAF or " + DASH,
                             "Subject fragment ID or " + DASH,
                             "Subject candidate anchor or " + DASH,
                             "Finding type", "Search-set ID or " + DASH,
                             "Search-manifest IDs or " + DASH,
                             "Evidence references or " + DASH,
                             "Preserved candidate anchor", "Finding status",
                             "Finding version", "Resolution ID or " + DASH,
                             "Superseding/current relationship or " + DASH,
                             "Limitations"], blk)
    sec("Resolutions", ["Resolution ID", "Blocked finding ID",
                        "Proposed outcome", "Resolver authority",
                        "Maker/proposer identity",
                        "Independent checker identity",
                        "Proposal receipt path",
                        "Accepted checkpoint commit or " + DASH,
                        "Acceptance receipt commit or " + DASH,
                        "Acceptance receipt or " + DASH,
                        "Accepted RES version or " + DASH,
                        "Accepted content digest or " + DASH,
                        "Accepted proposed outcome or " + DASH,
                        "Resolution status", "Resolution version",
                        "Reopening condition", "Limitations",
                        "Superseding/current relationship or " + DASH], res)
    sec("Date components", ["Record ID", "Date component ID", "Date basis",
                            "Date role/scope", "Date value",
                            "Source statement locator", "Limitations or "
                            + DASH, "Component status", "Component version",
                            "Superseding/current relationship or " + DASH],
        dates)
    return "\n".join(out) + "\n"


def _accept_proposed_resolution(receipt, inv, maker_commit, receipt_commit):
    """Return the current accepted-state receipt derived from the exact
    proposed row that was committed at `maker_commit`. The proposal blob
    itself remains immutable in Git."""
    fields = inv.schema["RES-record"]
    lines = receipt.splitlines(keepends=True)
    found = 0
    for i, line in enumerate(lines):
        if not line.strip().startswith("| %s |" % RES_ID):
            continue
        cells = [c.strip() for c in line.strip()[1:-1].split("|")]
        if len(cells) != len(fields):
            raise AssertionError("proposed RES control row has wrong width")
        row = dict(zip(fields, cells))
        if row["Resolution status"] != "proposed":
            raise AssertionError("maker checkpoint RES row is not proposed")
        updates = {
            "Accepted checkpoint commit or —": maker_commit,
            "Acceptance receipt commit or —": receipt_commit,
            "Acceptance receipt or —":
                ACCEPT_RECEIPT_REL.replace(os.sep, "/"),
            "Accepted RES version or —": "1",
            "Accepted content digest or —": RES_DIGEST,
            "Accepted proposed outcome or —": RES_OUTCOME,
            "Resolution status": "accepted",
        }
        for field, value in updates.items():
            cells[fields.index(field)] = value
        lines[i] = "| " + " | ".join(cells) + " |\n"
        found += 1
    if found != 1:
        raise AssertionError("expected exactly one proposed RES control row")
    return "".join(lines)


# --------------------------------------------------------------------------
# 25. The case harness.
#
#     Every case materializes a complete governed document tree in the control
#     repository and calls validate_tree() on it. A rejecting case must reject
#     FOR ITS INTENDED DIAGNOSTIC, so an incidental failure can never mask a
#     false positive.
# --------------------------------------------------------------------------


def mut(text, old, new, count=1):
    if old not in text:
        raise AssertionError("mutation anchor not found: %r" % old[:120])
    return text.replace(old, new, count)


def row_line(text, prefix):
    for ln in text.splitlines():
        if ln.strip().startswith(prefix):
            return ln
    raise AssertionError("row not found: %r" % prefix)


class Harness(object):
    def __init__(self, repo, base, r31):
        self.repo = repo
        self.base = base
        self.r31 = r31
        self.results = []

    def run(self, name, desc, docs, expect_reject, diagnostic=None,
            drop=()):
        self.repo.restore()
        for rel in drop:
            self.repo.remove(rel)
        for rel, txt in sorted(docs.items()):
            if txt is None:
                self.repo.remove(rel)
            else:
                self.repo._write(rel, txt)
        problems, _notes = validate_tree(self.repo.tree())
        rejected = bool(problems)
        ok = (rejected == expect_reject)
        diag_ok = True
        if expect_reject and ok and diagnostic:
            diag_ok = any(diagnostic in p for p in problems)
            ok = ok and diag_ok
        self.results.append({
            "name": name, "desc": desc, "rejected": rejected,
            "expect_reject": expect_reject, "ok": ok, "diag": diagnostic,
            "diag_ok": diag_ok,
            "sample": problems[:3]})
        return problems

    def docs(self, migrated=False, **over):
        d = dict(self.r31 if migrated else self.base)
        d.update(over)
        return d


def build_bases(repo):
    """Build the committed baseline and accepted migrated control tree.

    Chronology is intentional and observable:
      1. commit the complete migrated tree with the exact RES row proposed;
      2. commit the independent acceptance receipt as a strict descendant;
      3. expose the later accepted row only as the current document state.
    """
    if repo._bases is not None:
        return repo._bases
    base = dict(repo.live)
    # The accepted-status control commit intentionally remains the clean
    # ancestor immediately before substantive R3.1 mutation. The separately
    # accepted same-family compatibility checkpoint is a later standards-only
    # descendant, so hydrate that exact accepted status tree as the reusable
    # baseline while keeping the ancestor pointer repinned to this temporary
    # repository.
    accepted_status_commit = \
        "41096c8f3a8277e56ad38f98482520176a551521"
    accepted_canon_blob = git_blob(
        repo.src, accepted_status_commit, CANON_REL)
    accepted_plan_blob = git_blob(repo.src, accepted_status_commit, PLAN_REL)
    same_receipt_rel = os.path.join(
        RECEIPT_DIR,
        "ARCHITECT_CBA_CANON_V2_R3_1_SAME_FAMILY_DEFERRAL_COMPATIBILITY.md")
    accepted_same_receipt_blob = git_blob(
        repo.src, accepted_status_commit, same_receipt_rel)
    if not all((accepted_canon_blob, accepted_plan_blob,
                accepted_same_receipt_blob)):
        raise AssertionError(
            "accepted same-family status baseline is not fully resolvable")
    base[CANON_REL] = repo._repin(
        accepted_canon_blob.decode("utf-8"),
        repo.src_inv.commits["published-v1.1"],
        repo.src_inv.commits["r3-checkpoint"])
    base[PLAN_REL] = set_accepted_status_control_tree(
        accepted_plan_blob.decode("utf-8"), repo.control)
    base[same_receipt_rel] = accepted_same_receipt_blob.decode("utf-8")
    inv, _ = parse_inventory(base[CANON_REL])
    published = Published(repo.dir, inv.commits["published-v1.1"])
    canon, plan, proposal = build_r31_document(repo, published, inv)

    proposal_docs = dict(base)
    proposal_docs[CANON_REL] = canon
    proposal_docs[PLAN_REL] = plan
    proposal_docs[R31_RECEIPT_REL] = proposal
    repo.restore()
    for rel, txt in sorted(proposal_docs.items()):
        repo._write(rel, txt)
    repo.maker = repo._commit("R3.1 control maker proposal checkpoint")

    checker_receipt = acceptance_receipt_text(repo.maker)
    repo._write(ACCEPT_RECEIPT_REL, checker_receipt)
    repo.accept = repo._commit("independent acceptance receipt")
    if not git_is_strict_ancestor(repo.dir, repo.maker, repo.accept):
        raise AssertionError("checker receipt is not a strict descendant of "
                             "the maker proposal checkpoint")

    accepted = _accept_proposed_resolution(
        proposal, inv, repo.maker, repo.accept)
    repo.live[ACCEPT_RECEIPT_REL] = checker_receipt
    base[ACCEPT_RECEIPT_REL] = checker_receipt
    r31 = dict(base)
    r31[CANON_REL] = canon
    r31[PLAN_REL] = plan
    r31[R31_RECEIPT_REL] = accepted
    repo._bases = (base, r31, inv, published)
    return repo._bases


R3_RECEIPT_REL = os.path.join(
    "work", "architect-completion",
    "ARCHITECT_CBA_CANON_V2_R3_A_SERIES_CERTIFICATION.md")


def run_extended_cases(repo):
    base, r31, inv, published = build_bases(repo)
    H = Harness(repo, base, r31)
    C, P, R = CANON_REL, PLAN_REL, R31_RECEIPT_REL
    canon, plan = base[C], base[P]
    mcanon, mplan, mrcpt = r31[C], r31[P], r31[R]
    r3rcpt = base[R3_RECEIPT_REL]

    # ================= valid controls (must ACCEPT) =================
    H.run("C0", "committed baseline: the real canon, repair plan, and every "
          "receipt, loaded through the one document-tree loader",
          H.docs(), False)
    H.run("C1", "benign clarifying edit to the repair plan (the validator does "
          "not simply reject everything)",
          H.docs(**{P: mut(plan, "**Working branch:**",
                           "<!-- benign clarifying note -->\n\n"
                           "**Working branch:**")}), False)
    H.run("C2", "COMPLETE future-R3.1 migrated document tree - migrated SRC2 "
          "base/detail schemas, fragment inventories, bundles, DISP records, "
          "date components, SM2/SS2, BLK/RES, AMEND lineage and an SXW2 "
          "population - through the SAME top-level entry point",
          H.docs(migrated=True), False)
    # valid append-only additions above every current high-water mark
    add_group = row_line(canon, "| CBA2-A12 |")
    add_lmain = row_line(canon, "| CBA2-A12.5 |")
    add_ldet = row_line(canon, "| CBA2-A12.5 |")
    ldet_line = [ln for ln in
                 line_range(canon, "#### 15.10.3", "### 15.11").splitlines()
                 if ln.strip().startswith("| CBA2-A12.5 |")][0]
    lmain_line = [ln for ln in
                  line_range(canon, "#### 15.10.2", "#### 15.10.3").splitlines()
                  if ln.strip().startswith("| CBA2-A12.5 |")][0]
    xw_last = row_line(canon, "| XW2-0131 |")
    ev_last = row_line(canon, "| EV2-0089 |")
    grow = row_line(canon, "| CBA2-A12 |")
    future = canon
    future = mut(future, grow + "\n", grow + "\n"
                 + "| CBA2-A13 | Future GROUP appended above the high-water "
                   "mark | `CBA2-A13.1` (1) | GROUP anchor; no obligation, "
                   "verdict, method, locator, or evidence |\n")
    future = mut(future, lmain_line + "\n", lmain_line + "\n"
                 + "| CBA2-A13.1 | Future appended obligation above the "
                   "high-water mark | CBA | SCEN | — | EV2-0090 | XW2-0132 | "
                   "Appended by a future construction unit. |\n")
    future = mut(future, ldet_line + "\n", ldet_line + "\n"
                 + "| CBA2-A13.1 | pending R7 | — | Transaction date | "
                   "DR2-0047 |\n")
    future = mut(future, xw_last + "\n", xw_last + "\n"
                 + "| XW2-0132 | CBA-A21 | CBA2-A13.1 | `equivalent` | Whole "
                   "obligation appended above the high-water mark | DR2-0047 |"
                   "\n")
    future = mut(future, ev_last + "\n", ev_last + "\n"
                 + "| EV2-0090 | CBA2-A13.1 | CBA | SRC2-001 | — | CBA VII "
                   "§6(j)(1)(i), p. 240 | Appended controlling passage | Maps "
                   "the appended obligation | — | — |\n")
    H.run("C3", "valid future append-only additions ABOVE every current "
          "high-water mark (GROUP, LEAF main+detail, XW2, EV2) conform - no "
          "fixed population total false-rejects them",
          H.docs(**{C: future}), False)
    # multiple same-basis dates with distinct roles/scopes
    scoped = mut(mrcpt,
                 "| SRC2-001 | SRC2-001#D3 | edition | primary | 2023-07 |",
                 "| SRC2-001 | SRC2-001#D4 | effective | scoped:early-"
                 "commencement | 2023-06-30 | Article XXXIX §1 proviso | none "
                 "| current | 1 | — |\n"
                 "| SRC2-001 | SRC2-001#D3 | edition | primary | 2023-07 |")
    H.run("C4", "[R3.1] two valid same-basis `effective` dates with distinct "
          "roles/scopes (one primary, one scoped) are accepted",
          H.docs(migrated=True, **{R: scoped}), False)

    # ================= governing-document removal =================
    H.run("P0", "the repair plan is removed",
          H.docs(**{P: None}), True, "repair plan is MISSING")
    H.run("P1", "the canon is removed",
          H.docs(**{C: None}), True, "canon document is MISSING")
    H.run("P2", "the R3 receipt carrying the committed DR2 population is "
          "removed", H.docs(**{R3_RECEIPT_REL: None}), True, "G15R/R11")
    H.run("P3", "the governed inventory (canon 15.9.11) is removed",
          H.docs(**{C: canon[:canon.index("#### 15.9.11 ")]
                    + canon[canon.index("### 15.10 "):]}), True,
          "governed inventory")

    # ================= repair-plan contract =================
    H.run("P4", "backlog header reverted off the truthful items 1-27 range",
          H.docs(**{P: mut(plan, "complete R3.1 backlog is items 1–27",
                           "complete R3.1 backlog is items 1–21 only")}), True,
          "items 1-27")
    H.run("P5", "R4 dependency reverted to the rejected R2.9 foundation",
          H.docs(**{P: mut(plan, "**independently accepted\n  R2.10 "
                           "foundation**", "**independently accepted\n  R2.9 "
                           "foundation**")}), True, "accepted R2.10 foundation")
    H.run("P6", "plan item 23 reverted to the abolished clause/sentence "
          "coordinate model",
          H.docs(**{P: mut(plan, "normalized-scope atoms in the **sole "
                           "single-coordinate", "normalized-scope atoms "
                           "(clause/sentence\n      coordinates) in the "
                           "**sole single-coordinate")}), True,
          "clause/sentence")
    H.run("P7", "plan item 24 stripped of the SM2 <-> current-SRC2 "
          "reconciliation duty",
          H.docs(**{P: mut(plan, "SM2 ⇔ current-`SRC2` reconciliation duty",
                           "reconciliation duty")}), True,
          "SM2 <-> current-SRC2 reconciliation duty")
    H.run("P8", "plan item 25 weakened so inadequate coverage may create or "
          "clear a blocked outcome",
          H.docs(**{P: mut(plan, "**inadequate coverage can neither support "
                           "the\n      `unsupported-residual` disposition nor, "
                           "by itself, create or clear\n      a governed "
                           "`blocked-unsupported-obligation` finding**",
                           "inadequate coverage routes straight to a governed "
                           "`blocked-unsupported-obligation` finding")}), True,
          "item 25 does not bar")
    H.run("P9", "plan R4 construction sequence reverted to omit R2.9/R2.10",
          H.docs(**{P: mut(plan, "R3 → R2.6 → R2.7 → R2.8 → R2.9 → R2.10 → "
                           "R3.1 →\n  R4 → R5 → R6",
                           "R3 → R2.6 → R2.7 → R3.1 →\n  R4 → R5 → R6")}),
          True, "construction sequence omits")

    _cases_inventory(H, canon, plan)
    _cases_canon_populations(H, canon)
    _cases_dr2(H, canon, r3rcpt)
    _cases_migration(H, canon, plan, mplan, mcanon, mrcpt)
    _cases_r31(H, mcanon, mplan, mrcpt, repo)
    _cases_extra(H, canon, mcanon, mplan, mrcpt, repo)
    _cases_g15r_omissions(H, mrcpt)

    # Negative self-test: assert a knowingly WRONG expectation on the committed
    # baseline. The harness must report FAIL - proving it is not rigged to pass.
    H.run("SELFTEST", "negative self-test (wrong expectation injected)",
          H.docs(), True, None)
    st = H.results.pop()
    H.self_test_ok = (st["ok"] is False)
    return H.results, H.self_test_ok


def _cases_inventory(H, canon, plan):
    C = CANON_REL
    H.run("V1", "a governed vocabulary value is changed in the inventory while "
          "its clause is left alone (inventory/clause divergence)",
          H.docs(**{C: mut(canon,
                           "| `no-owner-reason` | `one the edge type requires:`"
                           " | `false-claim`",
                           "| `no-owner-reason` | `one the edge type requires:`"
                           " | `authority-inconvenient`, `false-claim`")}),
          True, "not declared by its governing clause")
    H.run("V2", "a governing field is removed from a pinned schema string "
          "while the inventory is left alone",
          H.docs(**{C: mut(canon,
                           "| Artifact SHA-256 or — | Artifact byte size or — "
                           "| Retrieval timestamp or —",
                           "| Artifact SHA-256 or — | Retrieval timestamp or —")
                    }), True, "pinned schema string does not match")
    H.run("V3", "the SRC2 `Artifact byte size` field is removed from BOTH the "
          "clause and the inventory, breaking the SM2 <-> SRC2 dependency",
          H.docs(**{C: mut(mut(canon,
                               "| Artifact SHA-256 or — | Artifact byte size "
                               "or — | Retrieval timestamp or —",
                               "| Artifact SHA-256 or — | Retrieval timestamp "
                               "or —"),
                           "`Record ID; Provenance type; Source/provenance "
                           "identity; Source date (basis:value) or —; Official "
                           "URL or —; Artifact SHA-256 or —; Artifact byte "
                           "size or —; Retrieval timestamp or —",
                           "`Record ID; Provenance type; Source/provenance "
                           "identity; Source date (basis:value) or —; Official "
                           "URL or —; Artifact SHA-256 or —; Retrieval "
                           "timestamp or —").replace(
                               "| `SRC2-base` | `Base table (one row per "
                               "record; all fifteen fields present;` | 15 |",
                               "| `SRC2-base` | `Base table (one row per "
                               "record; all fifteen fields present;` | 14 |")}),
          True, "dependency")
    H.run("V4", "a canonical-actor class is removed from the governed alias "
          "table",
          H.docs(**{C: mut(canon, "| `agent:codex` | `agent:codex`, "
                           "`agent:codex-cli`, `agent:codex.cli`, "
                           "`agent:codex-<any suffix>` |\n", "")}), True,
          "canonical-actor registry")
    H.run("V5", "an immutable never-edited range (§5.9) is modified",
          H.docs(**{C: mut(canon, "### 5.9 Bonuses, incentives, and other "
                           "compensation adjustments",
                           "### 5.9 Bonuses, incentives, and other "
                           "compensation adjustments (edited)")}), True,
          "immutable range sec-5.9")
    H.run("V6", "an inventory anchor is made ambiguous (resolves more than "
          "once)",
          H.docs(**{C: mut(canon, "| `bundle-class` | `equals the fragment's "
                           "Normalized fragment scope.` | `active` |",
                           "| `bundle-class` | `Rules (all binding)` | "
                           "`active` |")}), True, "anchor resolves")


def _cases_canon_populations(H, canon):
    C = CANON_REL
    x12 = row_line(canon, "| XW2-0012 |")
    x07 = row_line(canon, "| XW2-0007 |")
    g01 = row_line(canon, "| CBA2-A01 |")
    ev1 = row_line(canon, "| EV2-0001 |")
    s03 = row_line(canon, "| SRC2-003 |")
    lm1 = [ln for ln in line_range(canon, "#### 15.10.2",
                                   "#### 15.10.3").splitlines()
           if ln.strip().startswith("| CBA2-A01.1 |")][0]
    H.run("X1", "a committed XW2 row is removed",
          H.docs(**{C: mut(canon, x12 + "\n", "")}), True, "preservation")
    H.run("X2", "a committed XW2 id is duplicated",
          H.docs(**{C: mut(canon, x07 + "\n", x07 + "\n" + x07 + "\n")}), True,
          "duplicate id number")
    H.run("X3", "a committed XW2 id is renumbered (0012 -> 0099)",
          H.docs(**{C: mut(canon, "| XW2-0012 |", "| XW2-0099 |")}), True,
          "preservation")
    shifted = canon
    for n in range(131, 0, -1):
        shifted = shifted.replace("| XW2-%04d |" % n, "| XW2-%04d |" % (n + 1))
    H.run("X4", "the entire XW2 range is shifted 0001..0131 -> 0002..0132 "
          "(count-preserving substitution)",
          H.docs(**{C: shifted}), True, "preservation")
    H.run("X5", "an XW2 edge targets a nonexistent active LEAF",
          H.docs(**{C: mut(canon, "| XW2-0007 | CBA-A02.4 | CBA2-A02.7 |",
                           "| XW2-0007 | CBA-A02.4 | CBA2-A99.9 |")}), True,
          "resolves to no active LEAF")
    H.run("X6", "an XW2 edge names a shaped but nonexistent decision record "
          "DR2-9999 (the exact R2.9 false positive)",
          H.docs(**{C: mut(canon,
                           "wholly owned by the target | DR2-0002 |",
                           "wholly owned by the target | DR2-9999 |")}), True,
          "resolves to no DR2 record")
    H.run("X7", "an XW2 edge carries an unknown edge type",
          H.docs(**{C: mut(canon, "| `split` | Expanded-path structure",
                           "| `absorbed` | Expanded-path structure")}), True,
          "governed xw2-edge-type vocabulary")
    H.run("X8", "the edge-type vocabulary is weakened in the inventory AND an "
          "edge is retyped to the invented value together",
          H.docs(**{C: mut(mut(canon, "| `split` | Expanded-path structure",
                               "| `absorbed` | Expanded-path structure"),
                           "`moved`, `process-only`, `invalid`, "
                           "`no-successor`, `unsupported-residual` |",
                           "`moved`, `process-only`, `invalid`, "
                           "`no-successor`, `unsupported-residual`, "
                           "`absorbed` |")}), True,
          "not declared by its governing clause")
    H.run("X9", "a terminal XW2 edge carries a non-dash target",
          H.docs(**{C: mut(canon, "| XW2-0006 | CBA-A02.3 | — | `process-only`",
                           "| XW2-0006 | CBA-A02.3 | CBA2-A02.8 | "
                           "`process-only`")}), True,
          "terminal edge carries a non-dash target")
    H.run("X10", "an XW2 edge names a source outside the pinned published v1.1 "
          "LEAF population",
          H.docs(**{C: mut(canon, "| XW2-0007 | CBA-A02.4 |",
                           "| XW2-0007 | CBA-A99.9 |")}), True,
          "not a published v1.1 LEAF")
    H.run("D1", "a committed GROUP id is duplicated",
          H.docs(**{C: mut(canon, g01 + "\n", g01 + "\n" + g01 + "\n")}), True,
          "GROUP: duplicate id")
    H.run("D2", "a committed EV2 id is duplicated",
          H.docs(**{C: mut(canon, ev1 + "\n", ev1 + "\n" + ev1 + "\n")}), True,
          "EV2: duplicate")
    H.run("D3", "an EV2 component references a nonexistent SRC2 record",
          H.docs(**{C: mut(canon,
                           "| EV2-0001 | CBA2-A01.1 | INFERRED | SRC2-001 |",
                           "| EV2-0001 | CBA2-A01.1 | INFERRED | SRC2-909 |")}),
          True, "references nonexistent SRC2-909")
    H.run("D4", "a committed SRC2 base id is duplicated",
          H.docs(**{C: mut(canon, s03 + "\n", s03 + "\n" + s03 + "\n")}), True,
          "SRC2 base: duplicate")
    H.run("D5", "a committed LEAF identity is duplicated (count-preserving)",
          H.docs(**{C: mut(canon, lm1 + "\n", lm1 + "\n" + lm1 + "\n")}), True,
          "LEAF main: duplicate id")
    H.run("D6", "a committed GROUP id is renamed CBA2-A01 -> CBA2-A99 "
          "(count-preserving rename)",
          H.docs(**{C: canon.replace("CBA2-A01", "CBA2-A99")}), True,
          "preservation")
    H.run("D7", "a committed SRC2 identity is renamed SRC2-003 -> SRC2-009",
          H.docs(**{C: canon.replace("SRC2-003", "SRC2-009")}), True,
          "preservation")
    H.run("D8", "the LEAF main and detail tables are made unjoinable",
          H.docs(**{C: mut(canon, "| CBA2-A01.1 | pending R7 |",
                           "| CBA2-A01.9 | pending R7 |")}), True,
          "do not join")
    H.run("D9", "an EV2 row carries both reference fields empty (a source-free "
          "terminal component)",
          H.docs(**{C: mut(canon,
                           "| EV2-0001 | CBA2-A01.1 | INFERRED | SRC2-001 | — |",
                           "| EV2-0001 | CBA2-A01.1 | INFERRED | — | — |")}),
          True, "source-free terminal component")


def _cases_dr2(H, canon, r3rcpt):
    C, RR = CANON_REL, R3_RECEIPT_REL
    d02 = row_line(r3rcpt, "| DR2-0002 |")
    d05 = row_line(r3rcpt, "| DR2-0005 |")
    H.run("R1", "a committed DR2 row is removed from the immutable population",
          H.docs(**{RR: mut(r3rcpt, d05 + "\n", "")}), True, "preservation")
    H.run("R2", "a committed DR2 id is duplicated",
          H.docs(**{RR: mut(r3rcpt, d02 + "\n", d02 + "\n" + d02 + "\n")}),
          True, "duplicate decision record id")
    H.run("R3", "a DR2 record carries a type outside the governed vocabulary",
          H.docs(**{RR: mut(r3rcpt, "| DR2-0002 | `ATOM` |",
                            "| DR2-0002 | `ABSORB` |")}), True,
          "governed dr2-type vocabulary")
    H.run("R4", "a committed DR2 identity is replaced by a nonexistent "
          "DR2-9999 (count-preserving substitution)",
          H.docs(**{RR: mut(r3rcpt, "| DR2-0002 |", "| DR2-9999 |")}), True,
          "preservation")
    H.run("R5", "a DR2 record names a resulting active LEAF that does not "
          "exist",
          H.docs(**{RR: mut(r3rcpt, "| CBA2-A01.1 | R3 / this checkpoint |",
                            "| CBA2-A77.7 | R3 / this checkpoint |")}), True,
          "resulting LEAF CBA2-A77.7 does not exist")
    H.run("R6", "a LEAF detail row cites a nonexistent decision record",
          H.docs(**{C: mut(canon, "| CBA2-A01.1 | pending R7 | — | asOfDate; "
                           "Salary Cap Year; team context | DR2-0001, DR2-0036 "
                           "|", "| CBA2-A01.1 | pending R7 | — | asOfDate; "
                           "Salary Cap Year; team context | DR2-0001, DR2-9998 "
                           "|")}), True, "resolves to no DR2 record")


def _cases_migration(H, canon, plan, mplan, mcanon, mrcpt):
    C, P, R = CANON_REL, PLAN_REL, R31_RECEIPT_REL
    # strip the backlogged legacy nonconformities while the plan still says
    # R3.1 has not started - the exact R2.9 "legacy markers" regression, now
    # driven by the governed plan status rather than a hard-coded marker list.
    stripped = mcanon
    H.run("L1", "the committed population is stripped of every backlogged "
          "legacy nonconformity while the plan still states R3.1 NOT started "
          "(a population falsely presented as migrated)",
          H.docs(**{C: stripped}), True,
          "refusing to treat an unmigrated population")
    H.run("L2", "[R3.1] the plan states R3.1 executed while the legacy "
          "nonconformities remain unmigrated",
          H.docs(**{P: mplan}), True,
          "legacy nonconformities remain unmigrated")


def _cases_r31(H, mcanon, mplan, mrcpt, repo):
    """Every adversarial case on the COMPLETE migrated R3.1 document tree."""
    C, P, R = CANON_REL, PLAN_REL, R31_RECEIPT_REL

    def M(**over):
        return H.docs(migrated=True, **over)

    frag1 = row_line(mrcpt, "| CBA-A02.4:F1 |")
    frag2 = row_line(mrcpt, "| CBA-A02.4:F2 |")
    bnd = row_line(mrcpt, "| BND-0001 |")
    sm1 = row_line(mrcpt, "| SM2-0001 |")
    ss1 = row_line(mrcpt, "| SS2-0001 |")
    blk = row_line(mrcpt, "| BLK-0001 |")
    res = row_line(mrcpt, "| RES-0001 |")
    d1 = row_line(mrcpt, "| SRC2-001 | SRC2-001#D1 |")
    scen1 = row_line(mrcpt, "| scenario-1:F1 |")
    sx1 = row_line(mcanon, "| SXW2-0001 |")
    disp_x = [ln for ln in mrcpt.splitlines()
              if ln.strip().startswith("| DR2-00") and " | XW2-DISP | " in ln][0]
    disp_s = [ln for ln in mrcpt.splitlines()
              if ln.strip().startswith("| DR2-00")
              and " | SXW2-DISP | " in ln][0]
    disp_x_id = disp_x.strip().split("|")[1].strip()
    disp_s_id = disp_s.strip().split("|")[1].strip()

    # -- fragments and partitions
    H.run("F1", "[R3.1] a fragment partition leaves a gap (uncovered residual)",
          M(**{R: mut(mrcpt, frag2,
                      frag2.replace("span:74-147", "span:80-147"))}),
          True, "do not partition exactly")
    H.run("F2", "[R3.1] a fragment ID is duplicated",
          M(**{R: mut(mrcpt, frag2 + "\n", frag2 + "\n" + frag2 + "\n")}), True,
          "duplicate fragment id")
    H.run("F3", "[R3.1] fragment IDs are noncontiguous (F2 renumbered to F9)",
          M(**{R: mut(mrcpt, "| CBA-A02.4:F2 | CBA-A02.4 |",
                      "| CBA-A02.4:F9 | CBA-A02.4 |")}), True, "gap/skipped")
    H.run("F4", "[R3.1] a fragment span endpoint exceeds the normalized "
          "requirement text length (an impossible coordinate)",
          M(**{R: mut(mrcpt, frag2,
                      frag2.replace("span:74-147", "span:74-999"))}), True,
          "exceeds the normalized text")
    H.run("F5", "[R3.1] an orphan fragment carries no disposition",
          M(**{R: mut(mrcpt, frag2,
                      frag2.replace("| XW2-0010 |", "| " + DASH + " |"))}),
          True, "orphan fragment")
    H.run("F6", "[R3.1] an edge names an unregistered fragment",
          M(**{C: mut(mcanon, "[CBA-A02.4:F2]", "[CBA-A02.4:F7]")}), True,
          "unregistered fragment")
    H.run("F7", "[R3.1] a `process-only` edge dispositions a fragment whose "
          "kind is not `process-instruction` (kind <-> edge-type pairing)",
          M(**{R: mrcpt.replace("| CBA-A02.3:F1 | CBA-A02.3 | "
                                "process-instruction |",
                                "| CBA-A02.3:F1 | CBA-A02.3 | "
                                "substantive-obligation |")}), True,
          "kind <-> edge-type pairing")

    # -- bundles
    H.run("B1", "[R3.1] the multi-target fragment's bundle is removed",
          M(**{R: mut(mut(mrcpt, bnd + "\n", ""),
                      frag1, frag1.replace("| BND-0001 |", "| " + DASH + " |"))
               }), True, "carries no governed BND bundle")
    H.run("B2", "[R3.1] the bundle's member sub-scopes leave a residual "
          "character range uncovered",
          M(**{R: mut(mrcpt, bnd, bnd.replace("span:0-25, span:25-49, "
                                              "span:49-74",
                                              "span:0-25, span:25-49, "
                                              "span:49-70"))}), True,
          "undispositioned residual")
    H.run("B3", "[R3.1] the bundle's member sub-scopes overlap",
          M(**{R: mut(mrcpt, bnd, bnd.replace("span:0-25, span:25-49, "
                                              "span:49-74",
                                              "span:0-30, span:25-49, "
                                              "span:49-74"))}), True,
          "member sub-scopes overlap")
    H.run("B4", "[R3.1] a bundle carries an `equivalent` whole-fragment "
          "sole-owner member",
          M(**{R: mut(mrcpt, bnd, bnd.replace("split, partial-overlap",
                                              "equivalent, partial-overlap"))}),
          True, "sole-owner type")
    H.run("B5", "[R3.1] a bundle carries a duplicate (source fragment, target) "
          "mapping",
          M(**{R: mut(mrcpt, bnd, bnd.replace(
              "CBA2-A02.7, CBA2-A02.8, CBA2-A05.7",
              "CBA2-A02.7, CBA2-A02.7, CBA2-A05.7"))}), True,
          "duplicate (source fragment, target) mapping")
    H.run("B6", "[R3.1] a bundle names a fragment that does not back-reference "
          "it",
          M(**{R: mut(mrcpt, bnd, bnd.replace("| CBA-A02.4:F1 |",
                                              "| CBA-A02.4:F2 |", 1))}), True,
          "does not back-reference this bundle")

    # -- DISP
    H.run("S1", "[R3.1] a DISP detail row names a subject fragment that is "
          "not the edge's own leading fragment token",
          M(**{R: mut(mrcpt, disp_x, disp_x.replace("| CBA-A02.3:F1 |",
                                                    "| CBA-A02.3:F2 |"))}),
          True, "!= the edge's leading fragment token")
    H.run("S2", "[R3.1] a terminal edge is left with no current DISP detail row",
          M(**{R: mut(mrcpt, disp_x + "\n", "")}), True,
          "has no current DISP detail row")
    H.run("S3", "[R3.1] a DISP detail row is duplicated for one "
          "terminal-subject key",
          M(**{R: mut(mrcpt, disp_x + "\n", disp_x + "\n" + disp_x + "\n")}),
          True, "duplicate current disposition")
    H.run("S4", "[R3.1] a DISP row carries the wrong no-owner reason for its "
          "terminal edge type",
          M(**{R: mut(mrcpt, disp_x,
                      disp_x.replace("| false-claim |", "| process-material |")
                      if "| false-claim |" in disp_x else
                      disp_x.replace("| process-material |",
                                     "| false-claim |"))}), True,
          "no-owner reason")
    H.run("S5", "[R3.1] a DISP row's Normalized scope is not span-set-equal to "
          "the edge's own fragment scope",
          M(**{R: mut(mrcpt, disp_x,
                      disp_x.replace("| span:0-84 |", "| span:0-40 |"))}),
          True, "not span-set-equal")
    H.run("S6", "[R3.1] an XW2 terminal edge is dispositioned by an SXW2-DISP "
          "row (subject-family mismatch)",
          M(**{R: mut(mrcpt, disp_s, disp_s.replace("| SXW2-DISP |",
                                                    "| XW2-DISP |", 1))}),
          True, "subject-family mismatch")
    H.run("S7", "[R3.1] a scenario disposition names a scenario outside the "
          "pinned published 1-89 population",
          M(**{C: mut(mcanon, "| SXW2-0001 | scenario-1 |",
                      "| SXW2-0001 | scenario-90 |")}), True,
          "outside the pinned published 1-89 population")
    H.run("S8", "[R3.1] a scenario fragment's span endpoint exceeds the "
          "scenario's normalized text length",
          M(**{R: mut(mrcpt, scen1, scen1.replace("span:0-80",
                                                  "span:0-999"))}), True,
          "exceeds the normalized text")
    H.run("S9", "[R3.1] a DISP record groups two detail rows whose terminal "
          "bases are not exactly equal (different fragments and destinations)",
          M(**{R: mut(mrcpt, disp_x + "\n",
                      disp_x + "\n"
                      + disp_x.replace("| CBA-A02.3:F1 |", "| CBA-A02.3:F2 |")
                      .replace("| XW2-0006 |", "| XW2-0012 |") + "\n")}), True,
          "terminal bases are not exactly equal")

    # -- date components
    H.run("T1", "[R3.1] every date component is removed",
          M(**{R: re.sub(r"(?m)^\| SRC2-00\d \| SRC2-00\d#D\d \|.*$", "",
                         mrcpt)}), True, "date-component")
    H.run("T2", "[R3.1] a date-component id is skipped (D1 -> D5)",
          M(**{R: mut(mrcpt, "| SRC2-001 | SRC2-001#D1 |",
                      "| SRC2-001 | SRC2-001#D5 |")}), True, "gap/skipped")
    H.run("T3", "[R3.1] an orphan date component names a nonexistent record",
          M(**{R: mut(mrcpt, "| SRC2-002 | SRC2-002#D1 |",
                      "| SRC2-009 | SRC2-009#D1 |")}), True,
          "orphan component")
    H.run("T4", "[R3.1] a date component carries an invalid role/scope",
          M(**{R: mut(mrcpt, "| SRC2-001#D2 | effective | primary |",
                      "| SRC2-001#D2 | effective | banana |")}), True,
          "neither 'primary' nor scoped")
    H.run("T5", "[R3.1] a date component carries a basis outside the closed "
          "vocabulary",
          M(**{R: mut(mrcpt, "| SRC2-001#D2 | effective |",
                      "| SRC2-001#D2 | inferred-from-metadata |")}), True,
          "governed date-basis vocabulary")
    H.run("T6", "[R3.1] a second current `primary` row exists for one basis",
          M(**{R: mut(mrcpt, d1 + "\n", d1 + "\n"
                      + d1.replace("#D1", "#D2").replace("2023-06-28",
                                                         "2023-06-29") + "\n")
               }), True, "second current 'primary'")
    H.run("T7", "[R3.1] a reversed effective window",
          M(**{R: mut(mrcpt, "| effective | primary | 2023-07-01 |",
                      "| effective | primary | 2023-07-01/2023-06-01 |")}),
          True, "invalid for basis")
    H.run("T8", "[R3.1] the base Source date pair no longer equals its "
          "basis's current primary component",
          M(**{C: mut(mcanon,
                      "| SRC2-001 | `official-immutable` | 2023 NBA-NBPA "
                      "Collective Bargaining Agreement (signed agreement, "
                      "2023 edition) | agreement-as-of:2023-06-28 |",
                      "| SRC2-001 | `official-immutable` | 2023 NBA-NBPA "
                      "Collective Bargaining Agreement (signed agreement, "
                      "2023 edition) | agreement-as-of:2020-01-01 |")}), True,
          "current primary component value")
    H.run("T9", "[R3.1] an exact stated day is degraded to month precision",
          M(**{R: mut(mrcpt, "| agreement-as-of | primary | 2023-06-28 |",
                      "| agreement-as-of | primary | 2023-06 |")}), True,
          "month-precision limitation entry")
    H.run("T10", "[R3.1] a date value is derived from artifact metadata",
          M(**{R: mut(mrcpt, "| SRC2-002#D1 | edition | primary | 2024-06 | "
                      "cover page |", "| SRC2-002#D1 | publication | primary | "
                      "2024-06-07 | embedded PDF creation/modification "
                      "metadata |")}), True, "artifact metadata")
    H.run("T11", "[R3.1] a cover/edition month is recorded under a "
          "publication basis (a false basis)",
          M(**{R: mut(mrcpt, "| SRC2-002#D1 | edition | primary | 2024-06 | "
                      "cover page |", "| SRC2-002#D1 | publication | primary | "
                      "2024-06 | cover page |")}), True, "false basis")
    H.run("T12", "[R3.1] a superseded date component is still marked current "
          "by its successor",
          M(**{R: mut(mrcpt, d1, d1.replace("| current | 1 | " + DASH + " |",
                                            "| current | 2 | supersedes "
                                            "SRC2-001#D2 per AMEND DR2-0061 |"))
               }), True, "still marked current")

    # -- SM2 / SS2
    H.run("E1", "[R3.1] an SM2 record's Binary SHA-256 does not equal the "
          "current SRC2 record's Artifact SHA-256",
          M(**{R: mut(mrcpt,
                      "bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d63"
                      "2584f7ab32 | pages=676", "a" * 64 + " | pages=676")}),
          True, "SM2 <-> current-SRC2 reconciliation")
    H.run("E2", "[R3.1] an SM2 record's Binary size bytes does not equal the "
          "current SRC2 record's Artifact byte size",
          M(**{R: mut(mrcpt, "| 2850534 | bf178ca0", "| 2850999 | bf178ca0")}),
          True, "SM2 <-> current-SRC2 reconciliation")
    H.run("E3", "[R3.1] an SM2 record names a nonexistent SRC2 record",
          M(**{R: mut(mrcpt, "| SRC2-001 | https://ak-static",
                      "| SRC2-909 | https://ak-static")}), True,
          "resolves to no SRC2 record")
    H.run("E4", "[R3.1] an SM2 record's search method is outside the closed "
          "vocabulary",
          M(**{R: mut(mrcpt, "| full-text-sweep | SS2-0001 |",
                      "| eyeballed-it | SS2-0001 |")}), True,
          "governed search-method vocabulary")
    H.run("E5", "[R3.1] an SM2 record names a vague source identity",
          M(**{R: mut(mrcpt, "| NBA | NBA Communications official release "
                      "index |", "| NBA | official web surfaces |")}), True,
          "vague source identity")
    H.run("E6", "[R3.1] two current SM2 records share the uniqueness key",
          M(**{R: mut(mrcpt, sm1 + "\n",
                      sm1 + "\n" + sm1.replace("| SM2-0001 |", "| SM2-0005 |")
                      + "\n")}), True, "duplicate current record")
    H.run("E7", "[R3.1] a candidate-obligation SM2 record carries LEAF and "
          "fragment subject fields",
          M(**{R: mut(mrcpt, "| SM2-0001 | candidate-obligation | " + DASH
                      + " | " + DASH + " | §13.3 |",
                      "| SM2-0001 | candidate-obligation | CBA-A18.7 | "
                      "CBA-A18.7:F1 | §13.3 |")}), True,
          "forbids LEAF and fragment subject fields")
    H.run("E8", "[R3.1] an SS2 set omits a deterministic required source class",
          M(**{R: mut(mrcpt, "| CBA, BYL, NBA, ops-provenance |",
                      "| CBA, NBA, ops-provenance |")}), True,
          "deterministic governed set")
    H.run("E9", "[R3.1] an SS2 coverage assessment contradicts the "
          "deterministic computation",
          M(**{R: mut(mrcpt, "| CBA:covered, BYL:covered, NBA:covered, "
                      "ops-provenance:covered |",
                      "| CBA:covered, BYL:uncovered, NBA:covered, "
                      "ops-provenance:covered |")}), True,
          "deterministic computation")
    H.run("E10", "[R3.1] an `inconclusive` member is used to claim adequate "
          "coverage",
          M(**{R: mut(mrcpt, "no-qualifying-authority-located-in-searched-"
                      "sources | SS2-0001 | no qualifying authority located in "
                      "the searched provisions | none | agent:claude-code | "
                      "session:r31-control | 2026-07-22 | current | 1 |",
                      "inconclusive | SS2-0001 | no qualifying authority "
                      "located in the searched provisions | none | "
                      "agent:claude-code | session:r31-control | 2026-07-22 | "
                      "current | 1 |")}), True, "deterministic computation")
    H.run("E11", "[R3.1] an SS2 member does not back-reference its set",
          M(**{R: mut(mrcpt, "| full-text-sweep | SS2-0001 |",
                      "| full-text-sweep | SS2-0009 |")}), True,
          "back-references")
    H.run("E12", "[R3.1] a current SM2 record back-references the set but is "
          "omitted from Member SM2 IDs",
          M(**{R: mut(mrcpt, "| SM2-0001, SM2-0002, SM2-0003, SM2-0004 | "
                      "CBA:covered", "| SM2-0002, SM2-0003, SM2-0004 | "
                      "CBA:covered")}), True, "incomplete membership")
    H.run("E13", "[R3.1] a second current SS2 set covers one subject",
          M(**{R: mut(mrcpt, ss1 + "\n",
                      ss1 + "\n" + ss1.replace("| SS2-0001 |", "| SS2-0002 |")
                      + "\n")}), True, "a second current set")

    # -- BLK / RES: real acceptance evidence
    H.run("A1", "[R3.1] the acceptance commit is a shaped but nonexistent SHA "
          "(the exact R2.9 accepting control)",
          M(**{R: mut(mrcpt, "| " + repo.accept + " |", "| " + "1" * 40 + " |")
               }), True, "does not resolve to a real commit")
    H.run("A2", "[R3.1] the acceptance receipt path does not exist at the "
          "acceptance commit (the exact R2.9 accepting control)",
          M(**{R: mut(mrcpt, ACCEPT_RECEIPT_REL.replace(os.sep, "/"),
                      "work/architect-completion/x.md")}), True,
          "does not exist at acceptance commit")
    H.run("A3", "[R3.1] the acceptance receipt exists but carries no "
          "acceptance record for this resolution",
          M(**{R: mut(mrcpt, ACCEPT_RECEIPT_REL.replace(os.sep, "/"),
                      PLAN_REL.replace(os.sep, "/"))}), True,
          "carries no Independent acceptance record row")
    H.run("A4", "[R3.1] the maker accepts its own resolution",
          M(**{R: mut(mrcpt, "| agent:claude-code | agent:codex |",
                      "| agent:claude-code | agent:claude-code |")}), True,
          "distinct canonical actor identities")
    H.run("A5", "[R3.1] alias masquerade: agent:claude accepting "
          "agent:claude-code",
          M(**{R: mut(mrcpt, "| agent:claude-code | agent:codex |",
                      "| agent:claude-code | agent:claude |")}), True,
          "distinct canonical actor identities")
    H.run("A6", "[R3.1] a blank checker identity",
          M(**{R: mut(mrcpt, "| agent:claude-code | agent:codex |",
                      "| agent:claude-code | agent: |")}), True,
          "distinct canonical actor identities")
    H.run("A7", "[R3.1] an unregistered prefix-similar checker "
          "(agent:claudeevil)",
          M(**{R: mut(mrcpt, "| agent:claude-code | agent:codex |",
                      "| agent:claude-code | agent:claudeevil |")}), True,
          "distinct canonical actor identities")
    H.run("A8", "[R3.1] a case-variant checker that is the same canonical actor",
          M(**{R: mut(mrcpt, "| agent:claude-code | agent:codex |",
                      "| agent:claude-code | agent:CLAUDE-CODE |")}), True,
          "distinct canonical actor identities")
    H.run("A9", "[R3.1] the maker changes the proposed content and writes a "
          "matching digest into its own row (self-certification by digest "
          "substitution)",
          M(**{R: mut(mut(mrcpt, "| foundation adjudication (canon 15.9.3) |",
                          "| maker-rewritten authority |"),
                      RES_DIGEST,
                      sha_hex("|".join([RES_BLK, RES_OUTCOME,
                                        "maker-rewritten authority", RES_MAKER,
                                        RES_CHECKER, RES_REOPEN, RES_LIMITS])),
                      1)}), True, "immutable acceptance receipt")
    H.run("A10", "[R3.1] a stale acceptance (accepted version != current "
          "resolution version)",
          M(**{R: mut(mrcpt, "| 1 | " + RES_DIGEST, "| 2 | " + RES_DIGEST)}),
          True, "stale acceptance")
    H.run("A11", "[R3.1] an unrelated acceptance (accepted outcome != current "
          "proposed outcome)",
          M(**{R: mut(mrcpt, "| " + RES_DIGEST + " | out-of-scope-"
                      "determination | accepted |",
                      "| " + RES_DIGEST + " | authority-located-mint-owner | "
                      "accepted |")}), True, "unrelated acceptance")
    H.run("A12", "[R3.1] an invented RES proposed outcome",
          M(**{R: mut(mrcpt, "| BLK-0001 | out-of-scope-determination |",
                      "| BLK-0001 | maker-waiver |")}), True,
          "governed res-proposed-outcome vocabulary")
    H.run("A13", "[R3.1] a blocked finding resolved by a non-accepted "
          "resolution",
          M(**{R: mut(mrcpt, "| accepted | 1 | reopen on qualifying",
                      "| proposed | 1 | reopen on qualifying")}), True,
          "not an accepted one")
    H.run("A14", "[R3.1] an open blocked finding (U7 fails and the unit stops)",
          M(**{R: mut(mrcpt, "| resolved | 1 | RES-0001 |",
                      "| open | 1 | " + DASH + " |")}), True,
          "fails U7 and stops the unit")
    H.run("A15", "[R3.1] an orphan resolution whose blocked finding does not "
          "exist",
          M(**{R: mut(mrcpt, "| RES-0001 | BLK-0001 |",
                      "| RES-0001 | BLK-0009 |")}), True,
          "orphan resolution")
    H.run("A16", "[R3.1] a blocked finding cleared on inadequate coverage",
          M(**{R: mut(mrcpt, "| adequate-coverage | current | 1 |",
                      "| inadequate-coverage | current | 1 |")}), True,
          "adequate not-located search")
    H.run("A17", "[R3.1] a duplicate BLK identity",
          M(**{R: mut(mrcpt, blk + "\n", blk + "\n" + blk + "\n")}), True,
          "duplicate blocked-finding id")
    H.run("A18", "[R3.1] a duplicate RES identity",
          M(**{R: mut(mrcpt, res + "\n", res + "\n" + res + "\n")}), True,
          "duplicate resolution id")

    # -- AMEND lineage
    H.run("N1", "[R3.1] the AMEND population is removed while the migration "
          "requires it",
          M(**{R: re.sub(r"(?m)^\| DR2-\d{4} \| `AMEND` \|.*$", "", mrcpt)}),
          True, "G15R/R10")
    H.run("N2", "[R3.1] a superseding relationship names a record that is "
          "still marked current (two current endpoints)",
          M(**{R: mut(mrcpt, disp_x, disp_x.replace(
              "| " + DASH + " | current | 1 |",
              "| supersedes " + disp_s_id + " per AMEND DR2-0061 | current | 2 |"
          ))}), True, "still marked")
    H.run("N3", "[R3.1] a superseding relationship names a record that does "
          "not exist",
          M(**{R: mut(mrcpt, disp_x, disp_x.replace(
              "| " + DASH + " | current | 1 |",
              "| supersedes DR2-9999 per AMEND DR2-0061 | current | 2 |"))}),
          True, "broken forward reference")
    H.run("N4", "[R3.1] a superseding relationship names a non-AMEND decision "
          "record",
          M(**{R: mut(mrcpt, disp_x, disp_x.replace(
              "| " + DASH + " | current | 1 |",
              "| supersedes " + disp_s_id + " per AMEND DR2-0001 | current | 2 |"
          ))}), True, "not a current AMEND decision record")
    H.run("N5", "[R3.1] a live edge references a superseded decision record "
          "(stale live reference)",
          M(**{R: mut(mrcpt, disp_x, disp_x.replace("| current | 1 |",
                                                    "| superseded | 1 |"))}),
          True, "stale live reference")


def _cases_extra(H, canon, mcanon, mplan, mrcpt, repo):
    C, P, R = CANON_REL, PLAN_REL, R31_RECEIPT_REL

    def M(**over):
        return H.docs(migrated=True, **over)

    frag1 = row_line(mrcpt, "| CBA-A02.4:F1 |")
    frag2 = row_line(mrcpt, "| CBA-A02.4:F2 |")
    bnd = row_line(mrcpt, "| BND-0001 |")
    scen1 = row_line(mrcpt, "| scenario-1:F1 |")
    a153 = row_line(mrcpt, "| CBA-A15.1:F1 |")
    sm1 = row_line(mrcpt, "| SM2-0001 |")

    H.run("F8", "[R3.1] two fragments of one LEAF overlap (pairwise "
          "non-overlap violated)",
          M(**{R: mut(mrcpt, frag2, frag2.replace("span:74-147",
                                                  "span:60-147"))}), True,
          "overlapping spans")
    H.run("F9", "[R3.1] one fragment carries both a terminal and a "
          "nonterminal disposition (active/terminal mixture)",
          M(**{R: mut(mrcpt, frag2, frag2.replace("| XW2-0010 |",
                                                  "| XW2-0006, XW2-0010 |"))}),
          True, "simultaneously terminal and actively owned")
    H.run("F10", "[R3.1] one fragment carries two terminal edges",
          M(**{R: mut(mrcpt, a153, a153.replace(
              a153.strip().split("|")[7].strip(),
              a153.strip().split("|")[7].strip() + ", XW2-0006"))}), True,
          "dispositioned exactly once")
    H.run("B7", "[R3.1] a bundle mixes in a terminal member edge type",
          M(**{R: mut(mrcpt, bnd, bnd.replace("split, partial-overlap",
                                              "invalid, partial-overlap"))}),
          True, "not a nonterminal type")
    H.run("S10", "[R3.1] an SXW2 edge names an unregistered scenario fragment",
          M(**{C: mut(mcanon, "[scenario-1:F1]", "[scenario-1:F7]")}), True,
          "unregistered scenario fragment")
    H.run("U1", "[R3.1] a WHOLE unsupported valid in-scope obligation escapes "
          "as an `unsupported-residual` terminal edge with no supported "
          "sibling (the blocking outcome bypassed)",
          M(**{C: mut(mcanon,
                      "| XW2-0086 | CBA-A15.1 | — | `invalid` |",
                      "| XW2-0086 | CBA-A15.1 | — | `unsupported-residual` |"),
               R: mut(mrcpt, a153,
                      a153.replace("| authority-assertion |",
                                   "| substantive-obligation |"))}), True,
          "governed `blocked-unsupported-obligation` finding")
    H.run("E14", "[R3.1] an SM2 result outside the closed vocabulary "
          "(a universal negative)",
          M(**{R: mut(mrcpt, "| no-qualifying-authority-located-in-searched-"
                      "sources | SS2-0001 | no qualifying authority located in "
                      "the searched provisions |",
                      "| no-such-authority-exists | SS2-0001 | no qualifying "
                      "authority located in the searched provisions |")}),
          True, "governed search-result vocabulary")
    disp_x2 = [ln for ln in mrcpt.splitlines()
               if ln.strip().startswith("| DR2-00")
               and " | XW2-DISP | " in ln][0]
    H.run("S11", "[R3.1] an orphan DISP detail row names a terminal edge that "
          "does not exist",
          M(**{R: mut(mrcpt, disp_x2, disp_x2.replace("| XW2-0006 |",
                                                      "| XW2-9999 |"))}), True,
          "orphan disposition")
    H.run("S12", "[R3.1] a DISP detail row has no current generic DR2 parent",
          M(**{R: mut(mrcpt, disp_x2, disp_x2.replace("| DR2-0049 |",
                                                      "| DR2-0090 |", 1))}),
          True, "no current generic DR2 parent")
    H.run("T13", "[R3.1] a base Source date carries a half-empty basis:value "
          "pair",
          M(**{C: mut(mcanon, "| agreement-as-of:2023-06-28 |",
                      "| agreement-as-of: |")}), True, "invalid for basis")

    # valid future DR2 addition above the committed high-water mark
    d47 = row_line(H.base[R3_RECEIPT_REL], "| DR2-0047 |")
    fut = mut(H.base[R3_RECEIPT_REL], d47 + "\n", d47 + "\n"
              + "| DR2-0048 | `ORIGIN` | A future newly-certified obligation | "
                "Newly certified; no predecessor | Primary-source discovery | "
                "Appended above the committed high-water mark | — | R4 / a "
                "future checkpoint |\n")
    H.run("C5", "valid future DR2 addition above the committed high-water mark "
          "conforms (future decision records are not ignored)",
          H.docs(**{R3_RECEIPT_REL: fut}), False)
    H.run("C6", "a malformed future DR2 addition above the high-water mark is "
          "rejected (the same parser reaches it)",
          H.docs(**{R3_RECEIPT_REL: fut.replace("| DR2-0048 | `ORIGIN` |",
                                                "| DR2-0050 | `ORIGIN` |")}),
          True, "gap/skipped")


def _cases_g15r_omissions(H, mrcpt):
    """Individually remove each G15R-required population from the migrated
    document. Each must fail FOR THAT POPULATION."""
    R = R31_RECEIPT_REL
    removals = [
        ("G1", "SRC2 base", r"(?m)^\| SRC2-00\d \| `official-.*$",
         "SRC2-base", CANON_REL),
        ("G2", "date components", r"(?m)^\| SRC2-00\d \| SRC2-00\d#D\d \|.*$",
         "SRC2-date-component", R31_RECEIPT_REL),
        ("G3", "fragment inventory", r"(?m)^\| CBA-[A-Z]\d\d(\.\d+)?:F\d+ \|.*$",
         "fragment-inventory", R31_RECEIPT_REL),
        ("G4", "disposition bundles", r"(?m)^\| BND-\d{4} \|.*$", "BND-bundle",
         R31_RECEIPT_REL),
        ("G5", "search manifests", r"(?m)^\| SM2-\d{4} \|.*$", "SM2-record",
         R31_RECEIPT_REL),
        ("G6", "search sets", r"(?m)^\| SS2-\d{4} \|.*$", "SS2-record",
         R31_RECEIPT_REL),
        ("G7", "DISP detail rows",
         r"(?m)^\| DR2-\d{4} \| (XW2|SXW2)-DISP \|.*$", "DISP-detail",
         R31_RECEIPT_REL),
        ("G8", "blocked findings", r"(?m)^\| BLK-\d{4} \|.*$", "RES",
         R31_RECEIPT_REL),
        ("G9", "resolutions", r"(?m)^\| RES-\d{4} \| BLK-\d{4} \|.*$", "RES",
         R31_RECEIPT_REL),
        ("G10", "AMEND records", r"(?m)^\| DR2-\d{4} \| `AMEND` \|.*$",
         "G15R/R10", R31_RECEIPT_REL),
        ("G11", "the complete DR2 population",
         r"(?m)^\| DR2-\d{4} \| `(ATOM|DISP|AMEND)` \|.*$", "DR2",
         R31_RECEIPT_REL),
    ]
    for name, label, pattern, diag, target in removals:
        src = H.r31[target]
        docs = H.docs(migrated=True, **{target: re.sub(pattern, "", src)})
        H.run(name, "[R3.1] G15R population omission: %s removed individually"
              % label, docs, True, diag)


def run_cases(repo):
    """Bounded R3.1 A-series document-tree controls.

    These controls exercise every newly corrected mechanical boundary without
    replaying the historical exhaustive mutation library. Use --extended for
    that diagnostic-only library.
    """
    base, r31, inv, _published = build_bases(repo)
    H = Harness(repo, base, r31)
    C, P, R = CANON_REL, PLAN_REL, R31_RECEIPT_REL
    canon, plan = base[C], base[P]
    mcanon, mplan, mrcpt = r31[C], r31[P], r31[R]
    same_receipt_rel = os.path.join(
        RECEIPT_DIR,
        "ARCHITECT_CBA_CANON_V2_R3_1_SAME_FAMILY_DEFERRAL_COMPATIBILITY.md")
    accepted_checkpoint = "d6101f82b40f5c1e8c45c8be090e9b4743daefe5"
    pending_canon_blob = git_blob(repo.src, accepted_checkpoint, C)
    pending_plan_blob = git_blob(repo.src, accepted_checkpoint, P)
    pending_receipt_blob = git_blob(
        repo.src, accepted_checkpoint, same_receipt_rel)
    if not all((pending_canon_blob, pending_plan_blob, pending_receipt_blob)):
        raise AssertionError(
            "exact accepted same-family checkpoint is not fully resolvable")
    pending_canon = repo._repin(
        pending_canon_blob.decode("utf-8"),
        inv.commits["published-v1.1"], inv.commits["r3-checkpoint"])
    pending_plan = pending_plan_blob.decode("utf-8")
    pending_receipt = pending_receipt_blob.decode("utf-8")
    pending_docs = {
        C: pending_canon,
        P: pending_plan,
        same_receipt_rel: pending_receipt,
    }
    accepted_status_commit = \
        "41096c8f3a8277e56ad38f98482520176a551521"
    accepted_canon_blob = git_blob(repo.src, accepted_status_commit, C)
    accepted_plan_blob = git_blob(repo.src, accepted_status_commit, P)
    accepted_same_receipt_blob = git_blob(
        repo.src, accepted_status_commit, same_receipt_rel)
    if not all((accepted_canon_blob, accepted_plan_blob,
                accepted_same_receipt_blob)):
        raise AssertionError(
            "exact accepted same-family status tree is not fully resolvable")
    accepted_canon = repo._repin(
        accepted_canon_blob.decode("utf-8"),
        repo.src_inv.commits["published-v1.1"],
        repo.src_inv.commits["r3-checkpoint"])
    accepted_docs = {
        C: accepted_canon,
        P: set_accepted_status_control_tree(
            accepted_plan_blob.decode("utf-8"), repo.control),
        same_receipt_rel: accepted_same_receipt_blob.decode("utf-8"),
    }

    def replace_cell(text, row, index, value):
        cells = [c.strip() for c in row.strip()[1:-1].split("|")]
        cells[index] = value
        return mut(text, row, "| " + " | ".join(cells) + " |")

    proposal = git_blob(repo.dir, repo.maker, R31_RECEIPT_REL).decode("utf-8")

    # Live R3.1 regression controls added with the final source/ownership
    # repair. Every XW scope has exactly one fragment token and one normalized
    # span, and a post-R3.1 ATOM/ORIGIN reference on a LEAF detail row must
    # name that same LEAF in the decision's Result field.
    xw_scope_row = next(
        line for line in mcanon.splitlines()
        if line.startswith("| XW2-") and "[CBA-" in line
        and "span:" in line)
    xw_scope_cells = [
        cell.strip() for cell in xw_scope_row.strip()[1:-1].split("|")]
    xw_scope = xw_scope_cells[4]
    fragment_span = re.match(
        r"(\[[^\]]+\]\s+span:\d+-\d+(?:@[^\s;|]*)?)", xw_scope)
    if not fragment_span:
        raise AssertionError("live R3.1 XW scope control row is malformed")
    doubled_scope_row = replace_cell(
        mcanon, xw_scope_row, 4,
        fragment_span.group(1) + " " + xw_scope)
    H.run(
        "R31-XW-SCOPE",
        "post-R3.1 XW scope repeats its fragment token and normalized span",
        H.docs(migrated=True, **{C: doubled_scope_row}),
        True,
        "must carry exactly one leading fragment token")

    generic_control_rows = [
        line for line in mrcpt.splitlines()
        if re.match(
            r"^\| DR2-\d{4} \| "
            r"`(?:ORIGIN|OWN|ATOM|METHOD|DISP|AMEND)` \|", line)]
    atom_control_id = "DR2-%04d" % (
        max(int(re.match(r"^\| DR2-(\d{4})", line).group(1))
            for line in generic_control_rows) + 1)
    atom_control_leaf = "CBA2-A01.1"
    atom_control_row = (
        "| %s | `ATOM` | %s | Temporary atomic join control | "
        "One-owner result test | Control row for LEAF-detail reconciliation "
        "| %s | R3.1 / temporary control |"
        % (atom_control_id, atom_control_leaf, atom_control_leaf))
    dr_join_receipt = mut(
        mrcpt, generic_control_rows[-1] + "\n",
        generic_control_rows[-1] + "\n" + atom_control_row + "\n")
    leaf_detail_row = next(
        line for line in mcanon.splitlines()
        if line.startswith("| CBA2-") and " | pending R7 |" in line
        and line.strip()[1:-1].split("|")[0].strip()
        != atom_control_leaf)
    leaf_detail_cells = [
        cell.strip() for cell in leaf_detail_row.strip()[1:-1].split("|")]
    wrong_leaf_detail = replace_cell(
        mcanon, leaf_detail_row, 4,
        leaf_detail_cells[4] + ", " + atom_control_id)
    H.run(
        "R31-DR-JOIN",
        "post-R3.1 LEAF detail cites an ATOM decision whose Result names a "
        "different LEAF",
        H.docs(migrated=True, **{
            C: wrong_leaf_detail,
            R: dr_join_receipt,
        }),
        True,
        "does not name this LEAF in its Resulting active LEAF")

    def acceptance_history(checkpoint_proposal, receipt_mutator=None):
        """Create a real variant maker checkpoint and strict descendant
        checker receipt; return the later current accepted document set."""
        repo.restore()
        repo.remove(ACCEPT_RECEIPT_REL)
        for rel, txt in sorted(r31.items()):
            if rel not in (R31_RECEIPT_REL, ACCEPT_RECEIPT_REL):
                repo._write(rel, txt)
        repo._write(R31_RECEIPT_REL, checkpoint_proposal)
        maker = repo._commit("variant maker proposal checkpoint")
        checker = acceptance_receipt_text(maker)
        if receipt_mutator:
            checker = receipt_mutator(checker)
        repo._write(ACCEPT_RECEIPT_REL, checker)
        accepted = repo._commit("variant independent acceptance receipt")
        current = _accept_proposed_resolution(proposal, inv, maker, accepted)
        return H.docs(migrated=True, **{
            R31_RECEIPT_REL: current,
            ACCEPT_RECEIPT_REL: checker,
        })

    def compatibility_receipt(dr_rows, amend_rows):
        return (
            "# Foundation compatibility control receipt\n\n"
            "This file exists only in the validator's temporary control "
            "repository.\n\n"
            "## Decision records\n\n"
            + _table(inv.schema["DR2-generic"], dr_rows)
            + "\n## AMEND detail rows\n\n"
            + _table(inv.schema["AMEND-detail"], amend_rows))

    H.run("C0", "accepted compatibility baseline document tree",
          H.docs(**accepted_docs), False)
    H.run("C12", "both compatibility checkpoints are independently accepted; "
          "R3.1 maker is pending checker and R4 remains blocked",
          H.docs(**accepted_docs), False)
    stale_top = mut(
        pending_canon,
        "The owner-authorized same-family\n"
        "deferral compatibility checkpoint is pending independent checker "
        "acceptance.\n"
        "R3 remains rejected, no A-series record is accepted, and R3.1 "
        "remains blocked\n"
        "and not started.",
        "R3 remains rejected, no A-series record is accepted, and R3.1 is "
        "unblocked but not started.")
    H.run("P13", "pending same-family compatibility review is paired with a "
          "stale top-level canon claim that R3.1 is unblocked",
          H.docs(**dict(pending_docs, **{C: stale_top})), True,
          "stale top-level R3.1 unblocked/current-route claim")
    stale_family = mut(
        pending_canon,
        "the owner-authorized same-family compatibility checkpoint is now "
        "pending independent checker acceptance, so R3.1 remains blocked and "
        "not started",
        "R3.1 is unblocked but not started")
    stale_family = mut(
        stale_family,
        "first compatibility checkpoint independently accepted → same-family "
        "compatibility maker checkpoint → independent same-family "
        "compatibility checker ACCEPT → R3.1 maker checkpoint",
        "compatibility checkpoint independently accepted → R3.1 maker "
        "checkpoint")
    H.run("P14", "pending same-family compatibility review is omitted from "
          "the canon §19.3 current sequence while R3.1 is called unblocked",
          H.docs(**dict(pending_docs, **{C: stale_family})), True,
          "canon §19.3 live status")
    status_start = (
        "**Current pre-R3.1 status "
        "(supersedes the R2.13 sequencing sentence above):**")
    stale_accepted_top = mut(
        accepted_canon,
        line_range(accepted_canon, status_start, "> **Use rule:**"),
        line_range(pending_canon, status_start, "> **Use rule:**"))
    H.run("P15", "accepted same-family checkpoint retains the prior pending "
          "top-level canon route",
          H.docs(**dict(accepted_docs, **{C: stale_accepted_top})), True,
          "canon live accepted status: top pre-R3.1 mirror")
    stale_accepted_editions = accepted_canon
    for prefix in (
            "| **Repair v2.0 — working draft, pre-R3.1 compatibility** |",
            "| **Repair v2.0 — working draft, same-family deferral "
            "compatibility** |"):
        live_row = next(
            line for line in stale_accepted_editions.splitlines()
            if line.startswith(prefix))
        pending_row = next(
            line for line in pending_canon.splitlines()
            if line.startswith(prefix))
        stale_accepted_editions = mut(
            stale_accepted_editions, live_row, pending_row)
    H.run("P16", "accepted same-family checkpoint leaves both compatibility "
          "edition rows at the prior pending route",
          H.docs(**dict(accepted_docs, **{C: stale_accepted_editions})), True,
          "both compatibility edition rows")
    foundation_start = (
        "The R2.10–R2.13 review findings are classified exhaustively below.")
    foundation_end = "| Foundation review finding | Balanced disposition |"
    stale_accepted_foundation = mut(
        accepted_canon,
        line_range(accepted_canon, foundation_start, foundation_end),
        line_range(pending_canon, foundation_start, foundation_end))
    H.run("P17", "accepted same-family checkpoint leaves the §15.9 live "
          "foundation mirror pending",
          H.docs(**dict(accepted_docs, **{C: stale_accepted_foundation})),
          True,
          "§15.9 foundation mirror")
    family_start = (
        "**A-family v2 status (R3 executed; independently REJECTED — not "
        "certified).**")
    family_end = "### 19.4 CBA Guide sections reviewed for discovery"
    stale_accepted_family = mut(
        accepted_canon,
        line_range(accepted_canon, family_start, family_end),
        line_range(pending_canon, family_start, family_end))
    H.run("P18", "accepted same-family checkpoint leaves §19.3 at the prior "
          "pending sequence",
          H.docs(**dict(accepted_docs, **{C: stale_accepted_family})), True,
          "canon §19.3 live accepted status")
    control_line = "- **%s:** `%s`." % (
        CONTROL_TREE_FIELD, repo.control)
    H.run("C13", "accepted-status control-tree pointer is absent",
          H.docs(**{P: mut(plan, control_line + "\n", "")}), True,
          "plan accepted-status control tree")
    H.run("C14", "accepted-status control-tree pointer is shaped but does not "
          "resolve to a commit",
          H.docs(**{P: mut(plan, repo.control, "f" * 40)}), True,
          "does not resolve")
    accepted_but_blocked = replace_plan_section_status(
        accepted_docs[P],
        "## Owner-authorized same-family deferral compatibility checkpoint",
        "## R3.1 ",
        "independently **ACCEPTED** before R3.1 construction, but R3.1 "
        "remains blocked (contradictory route control). This is not an R2.x "
        "unit and not substantive R3.1 migration.")
    H.run("P11", "accepted same-family compatibility status still describes "
          "R3.1 as blocked",
          H.docs(**dict(accepted_docs, **{P: accepted_but_blocked})), True,
          "accepted same-family compatibility state")
    H.run("C1", "complete future-R3.1 migrated document tree through the "
          "same top-level validator", H.docs(migrated=True), False)
    stale_post_top = mut(
        mcanon,
        "**Current R3.1 accepted status "
        "(supersedes the R2.13 sequencing sentence above):**",
        "**Current R3.1 maker status "
        "(supersedes the R2.13 sequencing sentence above):**")
    H.run("P19", "accepted R3.1 top mirror retains the stale maker-pending "
          "heading",
          H.docs(migrated=True, **{C: stale_post_top}), True,
          "top mirror omits the exact ACCEPT")
    first_post_edition = row_line(
        mcanon,
        "| **Repair v2.0 — working draft, pre-R3.1 compatibility** |")
    stale_post_edition = mut(
        mcanon,
        first_post_edition,
        first_post_edition.replace(
            "R3.1 was independently ACCEPTED",
            "R3.1 maker is pending independent checker acceptance"))
    H.run("P20", "accepted R3.1 compatibility edition mirror retains a stale "
          "maker-pending route",
          H.docs(migrated=True, **{C: stale_post_edition}), True,
          "pre-R3.1 compatibility edition mirror omits the exact ACCEPT")
    foundation_start = (
        "The R2.10–R2.13 review findings are classified exhaustively below.")
    foundation_end = "| Foundation review finding | Balanced disposition |"
    accepted_foundation = line_range(
        mcanon, foundation_start, foundation_end)
    stale_post_foundation = mut(
        mcanon,
        accepted_foundation,
        accepted_foundation.replace(
            "R3.1 was independently **ACCEPTED**",
            "R3.1 maker remains pending independent checker acceptance"))
    H.run("P21", "accepted R3.1 §15.9 foundation mirror retains a stale "
          "maker-pending route",
          H.docs(migrated=True, **{C: stale_post_foundation}), True,
          "§15.9 foundation mirror omits the exact ACCEPT")
    stale_post_date = mut(
        mcanon,
        "| **Repair v2.0 — working draft, R3.1** | **July 24, 2026** |",
        "| **Repair v2.0 — working draft, R3.1** | **July 23, 2026** |")
    H.run("P22", "accepted R3.1 edition row retains the pre-execution date",
          H.docs(migrated=True, **{C: stale_post_date}), True,
          "R3.1 edition row must retain July 24, 2026")
    register_start = (
        "This section is the active v2 registry of §15.9.1.")
    register_end = "#### 15.10.1 A family — GROUP index"
    accepted_register = line_range(mcanon, register_start, register_end)
    stale_post_register = mut(
        mcanon,
        accepted_register,
        accepted_register.replace(
            "was independently **ACCEPTED**",
            "remains pending independent checker acceptance"))
    H.run("P23", "accepted R3.1 §15.10 register mirror retains a stale "
          "maker-pending route",
          H.docs(migrated=True, **{C: stale_post_register}), True,
          "§15.10 register mirror omits the exact ACCEPT")
    family_start = (
        "**A-family v2 status (R3.1 independently ACCEPTED; R4 unblocked but "
        "not started).**")
    family_end = "### 19.4 CBA Guide sections reviewed for discovery"
    accepted_family = line_range(mcanon, family_start, family_end)
    stale_post_family = mut(
        mcanon,
        accepted_family,
        accepted_family.replace(
            "was independently **ACCEPTED**",
            "remains pending independent checker acceptance"))
    H.run("P24", "accepted R3.1 §19.3 family mirror retains a stale "
          "maker-pending route",
          H.docs(migrated=True, **{C: stale_post_family}), True,
          "§19.3 live accepted R3.1 status omits the exact ACCEPT")
    contradictory_plan = replace_plan_section_status(
        mplan,
        "## One-time pre-R3.1 foundation-compatibility checkpoint",
        "## Owner-authorized same-family deferral compatibility checkpoint",
        "maker correction complete; **pending independent compatibility "
        "checker review and not accepted**. This is a one-time compatibility "
        "checkpoint, not an R2.x unit and not substantive R3.1 migration.")
    H.run("P10", "post-R3.1 plan leaves its prerequisite compatibility "
          "checkpoint pending and not accepted",
          H.docs(migrated=True, **{P: contradictory_plan}), True,
          "leaves a compatibility checkpoint pending/not accepted")
    same_pending_post = replace_plan_section_status(
        mplan,
        "## Owner-authorized same-family deferral compatibility checkpoint",
        "## R3.1 ",
        "maker correction complete; **pending independent same-family "
        "compatibility checker review and not accepted**. This is not an "
        "R2.x unit and not substantive R3.1 migration.")
    H.run("P12", "post-R3.1 plan leaves the same-family compatibility "
          "checkpoint pending and not accepted",
          H.docs(migrated=True, **{P: same_pending_post}), True,
          "leaves a compatibility checkpoint pending/not accepted")

    # Current R5-R9 route controls use the live plan while retaining the
    # accepted-status control-tree pointer inside this temporary repository.
    # They prove the completed-R7 route without inventing a standalone R7
    # checker and leave every canon/parser/source/scenario control untouched.
    current_plan = Tree(repo.src).plan
    if current_plan is None:
        raise AssertionError("live plan is not resolvable for route controls")
    route_plan = set_accepted_status_control_tree(current_plan, repo.control)

    def route_variant(start, end, label, replacement):
        return replace_plan_route_field(
            route_plan, start, end, label, replacement)

    H.run(
        "RT0",
        "current R5-R9 route: independently accepted prerequisites, "
        "completed R7, maker-only R8, independent whole-canon R9, and the "
        "two-part Phase 1 close gate",
        H.docs(migrated=True, **{P: route_plan}),
        False)
    H.run(
        "RT1",
        "current R5 route omits independent R4 acceptance before R5",
        H.docs(migrated=True, **{
            P: route_variant(
                "## R5 ", "## R6 ", "Dependency",
                "R5 may begin after the R4 maker checkpoint.")
        }),
        True,
        "plan R5 does not require independent R4 acceptance")
    H.run(
        "RT2",
        "current R6 route omits independent R5 acceptance before R6",
        H.docs(migrated=True, **{
            P: route_variant(
                "## R6 ", "## R7 ", "Dependency",
                "R6 may begin after the R5 maker checkpoint.")
        }),
        True,
        "plan R6 does not require independent R5 acceptance")
    H.run(
        "RT3",
        "current R7 route omits accepted R3.1/R4/R5/R6 prerequisites",
        H.docs(migrated=True, **{
            P: route_variant(
                "## R7 ", "## R8 ", "Dependency",
                "R7 requires only the completed R6 maker checkpoint.")
        }),
        True,
        "plan R7 dependency does not require independent checker acceptance")
    H.run(
        "RT4",
        "current R8 route permits maker reconciliation while R7 is still in "
        "progress",
        H.docs(migrated=True, **{
            P: route_variant(
                "## R8 ", "## R9 ", "Dependency",
                "Accepted R3.1/R4/R5/R6 rule checkpoints; R8 may begin while "
                "R7 is still in progress.")
        }),
        True,
        "plan R8 does not require completed R7")
    H.run(
        "RT5",
        "current route reintroduces a standalone R7 checker before R8",
        H.docs(migrated=True, **{
            P: route_variant(
                "## R7 ", "## R8 ", "Review boundary",
                "R7 receives its own standalone independent checker, whose "
                "ACCEPT is required before R8.")
        }),
        True,
        "does not exclude a standalone R7 checker")
    H.run(
        "RT6",
        "current R9 consistency scope removes independent scenario truth and "
        "sufficiency review",
        H.docs(migrated=True, **{
            P: route_variant(
                "## R9 ", "## Standing prohibitions", "Consistency scope",
                "Confirm stable and atomic active rule IDs, dependency and "
                "evidence closure, source quality, truthful unsupported "
                "items, complete old-rule-to-current-rule mapping, and "
                "consistency across accepted unit checkpoints.")
        }),
        True,
        "does not independently review scenario truth and sufficiency")

    r8_route = plan_section(route_plan, "## R8 ", "## R9 ")
    r8_exclusions = plan_route_field(r8_route, "Exclusions")
    for case_name, concept, old, new in (
            ("RT7A", "README", "README", "documentation-index"),
            ("RT7B", "code-map", "code-map", "repository-map"),
            ("RT7C", "application inspection", "application", "product"),
            ("RT7D", "runtime inspection", "runtime", "execution"),
            ("RT7E", "Phase 2", "Phase 2", "later-phase")):
        H.run(
            case_name,
            "current R8 exclusions omit %s" % concept,
            H.docs(migrated=True, **{
                P: route_variant(
                    "## R8 ", "## R9 ", "Exclusions",
                    mut(r8_exclusions, old, new))
            }),
            True,
            "plan R8 does not explicitly exclude README/code-map/runtime/"
            "Phase-2 expansion")

    r9_route = plan_section(
        route_plan, "## R9 ", "## Standing prohibitions")
    r9_inputs = plan_route_field(r9_route, "Inputs")
    for case_name, state, old, new in (
            ("RT8A", "unpinned", "pinned exact", "unpinned"),
            ("RT8B", "dirty", "clean", "dirty"),
            ("RT8C", "unpushed", "pushed", "unpushed"),
            ("RT8D", "non-topic branch", "topic-branch", "non-topic branch"),
            ("RT8E", "checksum-free", " and\n  checksum", "")):
        H.run(
            case_name,
            "current R9 input permits a %s candidate" % state,
            H.docs(migrated=True, **{
                P: route_variant(
                    "## R9 ", "## Standing prohibitions", "Inputs",
                    mut(r9_inputs, old, new))
            }),
            True,
            "plan R9 input is not a pinned clean topic-branch checkpoint")

    H.run(
        "RT9A",
        "current route allows R9 ACCEPT alone to close Phase 1",
        H.docs(migrated=True, **{
            P: route_variant(
                "## R9 ", "## Standing prohibitions", "Owner gate",
                "R9 ACCEPT alone closes Phase 1; explicit owner acceptance "
                "is optional.")
        }),
        True,
        "does not require both reviewer and owner acceptance")
    H.run(
        "RT9B",
        "current route allows explicit owner acceptance alone to close "
        "Phase 1",
        H.docs(migrated=True, **{
            P: route_variant(
                "## R9 ", "## Standing prohibitions", "Owner gate",
                "Explicit owner acceptance alone closes Phase 1; R9 ACCEPT "
                "is optional.")
        }),
        True,
        "does not require both reviewer and owner acceptance")

    # Semantic source truth belongs to the checker: a structurally valid
    # locator is not rejected by software merely because of a keyword.
    date_row = row_line(mrcpt, "| SRC2-001 | SRC2-001#D3 |")
    date_meta = replace_cell(mrcpt, date_row, 5,
                             "artifact metadata candidate for checker review")
    H.run("C2", "structurally valid source-date row remains software-valid "
          "when source-truth judgment is left to the checker",
          H.docs(migrated=True, **{R: date_meta}), False)

    # A valid future append-only construction above every current high-water
    # mark must conform. This proves preservation is identity-based rather
    # than a fixed-total freeze.
    lmain_line = [ln for ln in
                  line_range(canon, "#### 15.10.2",
                             "#### 15.10.3").splitlines()
                  if ln.strip().startswith("| CBA2-A12.5 |")][0]
    ldet_line = [ln for ln in
                 line_range(canon, "#### 15.10.3",
                            "### 15.11").splitlines()
                 if ln.strip().startswith("| CBA2-A12.5 |")][0]
    grow = row_line(canon, "| CBA2-A12 |")
    xw_last = row_line(canon, "| XW2-0131 |")
    ev_last = row_line(canon, "| EV2-0089 |")
    future = canon
    future = mut(
        future, grow + "\n", grow + "\n"
        + "| CBA2-A13 | Future GROUP appended above the high-water mark | "
          "`CBA2-A13.1` (1) | GROUP anchor; no obligation, verdict, method, "
          "locator, or evidence |\n")
    future = mut(
        future, lmain_line + "\n", lmain_line + "\n"
        + "| CBA2-A13.1 | Future appended obligation above the high-water "
          "mark | CBA | SCEN | — | EV2-0090 | XW2-0132 | Appended by a future "
          "construction unit. |\n")
    future = mut(
        future, ldet_line + "\n", ldet_line + "\n"
        + "| CBA2-A13.1 | pending R7 | — | Transaction date | DR2-0047 |\n")
    future = mut(
        future, xw_last + "\n", xw_last + "\n"
        + "| XW2-0132 | CBA-A21 | CBA2-A13.1 | `equivalent` | Whole "
          "obligation appended above the high-water mark | DR2-0047 |\n")
    future = mut(
        future, ev_last + "\n", ev_last + "\n"
        + "| EV2-0090 | CBA2-A13.1 | CBA | SRC2-001 | — | CBA VII "
          "§6(j)(1)(i), p. 240 | Appended controlling passage | Maps the "
          "appended obligation | — | — |\n")
    H.run("C3", "valid future append-only GROUP/LEAF/XW2/EV2 additions above "
          "the current high-water marks", H.docs(**{C: future}), False)

    # Compatibility checkpoint: reverse AMEND detection, governed gaps, and
    # exact logical-population lineage.
    xw1 = row_line(canon, "| XW2-0001 |")
    xw1_revised = replace_cell(
        canon, xw1, 4, "Versionless same-ID clarification control")
    compat_dr = [
        "| DR2-0048 | `AMEND` | Versionless governed-row control | "
        "Same stable identity revised | Structured AMEND reverse check | "
        "Control-only clarification | — | R3.1 / temporary control |"
    ]
    compat_amend = [
        "| DR2-0048 | XW2 | XW2-0001 | — | %s | revise | XW2-0001 | "
        "— | versionless same-ID revision control |" % repo.r3
    ]
    versionless_receipt = compatibility_receipt(compat_dr, compat_amend)
    H.run("C6", "same-ID versionless XW2 revision with one exact direct AMEND "
          "row", H.docs(**{C: xw1_revised,
                           R31_RECEIPT_REL: versionless_receipt}), False)
    H.run("A7", "silent same-ID governed-row mutation without AMEND",
          H.docs(**{C: xw1_revised}), True,
          "same-ID governed row changed")

    wrong_population = compatibility_receipt(
        compat_dr,
        ["| DR2-0048 | EV2 | CBA2-A12.5 | — | %s | replace | EV2-0001 | "
         "— | prose-shaped wrong-population prior control |" % repo.r3])
    H.run("A8", "AMEND prior appears elsewhere in checkpoint prose but not in "
          "the exact named governed population",
          H.docs(**{R31_RECEIPT_REL: wrong_population}), True,
          "resolves 0 times in the exact governed population")

    a12_group = row_line(canon, "| CBA2-A12 |")
    a12_main = next(
        line for line in line_range(
            canon, "#### 15.10.2", "#### 15.10.3").splitlines()
        if line.startswith("| CBA2-A12.5 |"))
    a12_detail = next(
        line for line in line_range(
            canon, "#### 15.10.3", "### 15.11").splitlines()
        if line.startswith("| CBA2-A12.5 |"))
    ev89 = row_line(canon, "| EV2-0089 |")
    xw100 = row_line(canon, "| XW2-0100 |")
    split_canon = replace_cell(
        canon, a12_group, 2,
        "`CBA2-A12.1`–`CBA2-A12.4`, `CBA2-A12.6`–`CBA2-A12.7` (6)")
    split_canon = mut(
        split_canon, a12_main + "\n",
        "| CBA2-A12.6 | Unfreeze timing control obligation | CBA | "
        "LIFECYCLE | SCEN | EV2-0090 | XW2-0132 | Compatibility split "
        "control. |\n"
        "| CBA2-A12.7 | No-penalty control obligation | CBA | LIFECYCLE | "
        "SCEN | EV2-0091 | XW2-0133 | Compatibility split control. |\n")
    split_canon = mut(
        split_canon, a12_detail + "\n",
        "| CBA2-A12.6 | pending R7 | CBA2-A12.4 | Four-year Second Apron "
        "history | DR2-0048, DR2-0049 |\n"
        "| CBA2-A12.7 | pending R7 | CBA2-A12.4 | Four-year Second Apron "
        "history | DR2-0048, DR2-0049 |\n")

    ev_cells = [cell.strip() for cell in ev89.strip()[1:-1].split("|")]
    ev90 = list(ev_cells)
    ev90[0], ev90[1] = "EV2-0090", "CBA2-A12.6"
    ev90[7] = "Maps the timing branch of the split control"
    ev91 = list(ev_cells)
    ev91[0], ev91[1] = "EV2-0091", "CBA2-A12.7"
    ev91[7] = "Maps the no-penalty branch of the split control"
    split_canon = mut(
        split_canon, ev89 + "\n",
        "| " + " | ".join(ev90) + " |\n"
        "| " + " | ".join(ev91) + " |\n")

    xw_cells = [cell.strip() for cell in xw100.strip()[1:-1].split("|")]
    xw132 = list(xw_cells)
    xw132[0], xw132[2], xw132[3], xw132[4], xw132[5] = (
        "XW2-0132", "CBA2-A12.6", "`split`",
        "Compatibility split branch one", "DR2-0049")
    xw133 = list(xw_cells)
    xw133[0], xw133[2], xw133[3], xw133[4], xw133[5] = (
        "XW2-0133", "CBA2-A12.7", "`split`",
        "Compatibility split branch two", "DR2-0049")
    split_canon = mut(
        split_canon, xw100 + "\n",
        "| " + " | ".join(xw132) + " |\n"
        "| " + " | ".join(xw133) + " |\n")

    split_dr = [
        "| DR2-0048 | `AMEND` | Governed LEAF/XW2/EV2 split control | "
        "Prior identities split through append-only successors | AMEND "
        "identity rules | Tests gaps without renumbering or reuse | — | "
        "R3.1 / temporary control |",
        "| DR2-0049 | `OWN` | Compatibility split successor ownership | "
        "Two current branches selected | Natural-family ownership control | "
        "Control-only owners for structural validation | CBA2-A12.6, "
        "CBA2-A12.7 | R3.1 / temporary control |",
    ]
    split_amend = [
        "| DR2-0048 | GROUP | CBA2-A12 | — | %s | revise | CBA2-A12 | — | "
        "declared child set revised for governed gap |" % repo.r3,
        "| DR2-0048 | LEAF | CBA2-A12.5 | — | %s | split | CBA2-A12.6, "
        "CBA2-A12.7 | — | real logical LEAF split control |" % repo.r3,
        "| DR2-0048 | XW2 | XW2-0100 | — | %s | split | XW2-0132, "
        "XW2-0133 | — | crosswalk replacement gap control |" % repo.r3,
        "| DR2-0048 | EV2 | EV2-0089 | — | %s | split | EV2-0090, "
        "EV2-0091 | — | evidence replacement gap control |" % repo.r3,
    ]
    split_receipt = compatibility_receipt(split_dr, split_amend)
    split_docs = H.docs(**{
        C: split_canon,
        R31_RECEIPT_REL: split_receipt,
    })
    H.run("C7", "real logical LEAF split plus governed XW2/EV2 replacement "
          "gaps, high-water successors, and exact GROUP declaration",
          split_docs, False)
    ev_split_row = split_amend[-1]
    wrong_pinned_checkpoint = ev_split_row.replace(repo.r3, repo.maker)
    H.run("A20", "a pinned-R3 EV2 identity is consumed by non-revise lineage "
          "through a later checkpoint",
          H.docs(**{
              C: split_canon,
              R31_RECEIPT_REL: mut(
                  split_receipt, ev_split_row, wrong_pinned_checkpoint),
          }), True, "must name the exact r3-checkpoint")

    H.run("A9", "unexplained current XW2 gap with no AMEND lineage",
          H.docs(**{C: mut(canon, xw100 + "\n", "")}), True,
          "absent from the current register without governed AMEND lineage")
    reused_canon = mut(
        split_canon, "| " + " | ".join(xw132) + " |\n",
        xw100 + "\n| " + " | ".join(xw132) + " |\n")
    H.run("A10", "consumed XW2 identity is filled/reused in the current "
          "register", H.docs(**{C: reused_canon,
                                R31_RECEIPT_REL: split_receipt}), True,
          "was reused in the current register")
    bad_declared_group = replace_cell(
        split_canon,
        row_line(split_canon, "| CBA2-A12 |"), 2,
        "`CBA2-A12.1`–`CBA2-A12.5`, `CBA2-A12.7` (6)")
    H.run("A11", "GROUP declaration has correct count/bounds but wrong exact "
          "child identity set",
          H.docs(**{C: bad_declared_group,
                    R31_RECEIPT_REL: split_receipt}), True,
          "does not exactly match actual active child identity set")

    # Versioned populations retain exact one-step arithmetic even though
    # versionless governed registers may revise in place with — -> —.
    src1 = row_line(mcanon, "| SRC2-001 |")
    src1_cells = [cell.strip() for cell in src1.strip()[1:-1].split("|")]
    src1_cells[12] = "second-step version-lineage compatibility control"
    src1_cells[14] = "2"
    src1_v2 = "| " + " | ".join(src1_cells) + " |"
    src2_v2_canon = mut(mcanon, src1, src1_v2)
    src2_amend_anchor = [
        line for line in mrcpt.splitlines()
        if re.match(r"^\| DR2-\d{4} \| SRC2 \| SRC2-004 \|", line)
    ][0]
    amend_parent = src2_amend_anchor.split("|")[1].strip()
    src2_v2_amend = (
        "| %s | SRC2 | SRC2-001 | 1 | %s | revise | SRC2-001 | 2 | "
        "versioned same-ID SRC2 revision advances exactly one version |"
        % (amend_parent, repo.maker))
    src2_v2_receipt = mut(
        mrcpt, src2_amend_anchor + "\n",
        src2_amend_anchor + "\n" + src2_v2_amend + "\n")
    H.run("C8", "versioned same-ID SRC2 revision resolves the exact version-1 "
          "logical record and advances to version 2",
          H.docs(migrated=True, **{
              C: src2_v2_canon,
              R: src2_v2_receipt,
          }), False)
    H.run("A21", "AMEND claims SRC2 version 1 to 2 while the live logical "
          "record remains version 1",
          H.docs(migrated=True, **{
              C: mut(src2_v2_canon, src1_v2, src1),
              R: src2_v2_receipt,
          }), True, "records version 1, not claimed current version 2")

    # The published parser must use the actual §15.7 LEAF register, never the
    # earlier hierarchy marker row whose prose happens to begin with CBA-A04.
    a04_fragments = [
        line for line in mrcpt.splitlines()
        if re.match(r"^\| CBA-A04:F\d+ \|", line)
    ]
    a04_fragment = a04_fragments[0]
    if not a04_fragments or "span:0-" not in a04_fragments[0] or not any(
            ("-%d" % _published.leaf_len["CBA-A04"]) in line
            for line in a04_fragments):
        raise AssertionError(
            "top-level CBA-A04 control fragments did not use the §15.7 "
            "published requirement boundaries")
    H.run("C9", "top-level CBA-A04 fragments partition the exact normalized "
          "§15.7 requirement rather than the hierarchy marker",
          H.docs(migrated=True), False)
    marker_length_fragment = replace_cell(
        mrcpt, a04_fragment, 4, "span:0-18")
    H.run("A12", "top-level CBA-A04 fragment reuses the 18-character "
          "hierarchy-marker length",
          H.docs(migrated=True, **{R: marker_length_fragment}), True,
          "fragment partition of CBA-A04")

    # An authority-assertion fragment pins the normalized published Authority
    # cell. The qualifier narrows only the authority/enforceability claim.
    a151_fragment = next(
        line for line in mrcpt.splitlines()
        if line.startswith("| CBA-A15.1:F1 |"))
    a151_cells = [
        cell.strip() for cell in a151_fragment.strip()[1:-1].split("|")]
    if a151_cells[2] != "authority-assertion" or a151_cells[3] != "OPS":
        raise AssertionError(
            "CBA-A15.1 control fragment did not retain its pinned OPS "
            "authority qualifier")
    H.run("C10", "CBA-A15.1 authority-assertion fragment carries the exact "
          "normalized published OPS qualifier",
          H.docs(migrated=True), False)
    H.run("A13", "CBA-A15.1 authority-assertion omits its historical "
          "authority qualifier",
          H.docs(migrated=True, **{
              R: replace_cell(mrcpt, a151_fragment, 3, DASH),
          }), True, "requires the exact pinned Historical authority qualifier")
    H.run("A14", "CBA-A15.1 authority-assertion carries the wrong historical "
          "authority qualifier",
          H.docs(migrated=True, **{
              R: replace_cell(mrcpt, a151_fragment, 3, "CBA"),
          }), True, "does not equal pinned published Authority cell")

    # A governed cross-family deferral is a temporary nonterminal shape: one
    # fragment, no bundle, direct current OWN, exact family/unit metadata, and
    # no survival into R8.
    deferred_leaf = "CBA-C01.1"
    deferred_fid = deferred_leaf + ":F1"
    deferred_span = "span:0-%d" % _published.leaf_len[deferred_leaf]
    generic_rows = [
        line for line in mrcpt.splitlines()
        if re.match(
            r"^\| DR2-(\d{4}) \| "
            r"`(?:ORIGIN|OWN|ATOM|METHOD|DISP|AMEND)` \|", line)
    ]
    if not generic_rows:
        raise AssertionError("migrated control has no generic DR2 rows")
    deferred_decision = "DR2-%04d" % (
        max(int(re.match(r"^\| DR2-(\d{4})", line).group(1))
            for line in generic_rows) + 1)
    deferred_dr = (
        "| %s | `OWN` | Cross-family C-to-R deferral control | "
        "Prospective owner intentionally deferred to the R family | "
        "Natural-family tiebreak plus exact resolving-unit metadata | "
        "R6 must mint the target owner and AMEND this edge out | — | "
        "R3.1 / temporary control |" % deferred_decision)
    deferred_xw = (
        "| XW2-0132 | %s | — | `deferred` | [%s] %s — "
        "families:C,R; resolving-unit:R6 | %s |"
        % (deferred_leaf, deferred_fid, deferred_span, deferred_decision))
    decomp_decision = a04_fragment.strip()[1:-1].split("|")[5].strip()
    deferred_fragment = (
        "| %s | %s | substantive-obligation | — | %s | %s | — | "
        "XW2-0132 | current | 1 | temporary cross-family deferral control |"
        % (deferred_fid, deferred_leaf, deferred_span, decomp_decision))
    xw_anchor = row_line(mcanon, "| XW2-0131 |")
    fragment_anchor = [
        line for line in mrcpt.splitlines()
        if re.match(r"^\| CBA-[ACRLS]\d{2}(?:\.\d+)?:F\d+ \|", line)
    ][-1]
    deferred_canon = mut(
        mcanon, xw_anchor + "\n", xw_anchor + "\n" + deferred_xw + "\n")
    deferred_receipt = mut(
        mrcpt, generic_rows[-1] + "\n",
        generic_rows[-1] + "\n" + deferred_dr + "\n")
    deferred_receipt = mut(
        deferred_receipt, fragment_anchor + "\n",
        fragment_anchor + "\n" + deferred_fragment + "\n")
    deferred_docs = H.docs(migrated=True, **{
        C: deferred_canon,
        R: deferred_receipt,
    })
    H.run("C11", "governed cross-family deferred edge has target —, exact "
          "families/resolving unit, one unbundled fragment, and direct OWN",
          deferred_docs, False)
    deferred_short_xw = deferred_xw.replace(
        deferred_span, "span:0-1", 1)
    H.run("A18", "single deferred edge carries only a proper subset of its "
          "inventoried fragment span",
          H.docs(migrated=True, **{
              C: mut(deferred_canon, deferred_xw, deferred_short_xw),
              R: deferred_receipt,
          }), True, "single-target nonterminal edge XW2-0132 scope is not "
                    "span-set-equal")

    # A deferred edge is never one member of a mixed multi-target bundle.
    # This control is otherwise a complete two-member fragment partition.
    bundle_split = max(1, _published.leaf_len[deferred_leaf] // 2)
    bundle_deferred_span = "span:0-%d" % bundle_split
    bundle_target_span = "span:%d-%d" % (
        bundle_split, _published.leaf_len[deferred_leaf])
    candidate_xw = next(
        line for line in mcanon.splitlines()
        if line.startswith("| XW2-")
        and line.strip()[1:-1].split("|")[2].strip() != DASH
        and line.strip()[1:-1].split("|")[3].strip(" `")
        in ("split", "merge", "partial-overlap"))
    candidate_cells = [
        cell.strip() for cell in candidate_xw.strip()[1:-1].split("|")]
    bundle_target = candidate_cells[2].strip("`")
    bundle_decision = candidate_cells[5].strip("`")
    bundle_deferred_xw = deferred_xw.replace(
        deferred_span, bundle_deferred_span, 1)
    bundle_target_xw = (
        "| XW2-0133 | %s | %s | `partial-overlap` | [%s] %s — "
        "mixed deferred-bundle prohibition control | %s |"
        % (deferred_leaf, bundle_target, deferred_fid, bundle_target_span,
           bundle_decision))
    bundle_canon = mut(
        deferred_canon, deferred_xw,
        bundle_deferred_xw + "\n" + bundle_target_xw)
    target_leaf_row = row_line(bundle_canon, "| %s |" % bundle_target)
    target_origin = [
        cell.strip()
        for cell in target_leaf_row.strip()[1:-1].split("|")][6]
    bundle_canon = mut(
        bundle_canon, target_leaf_row,
        replace_cell(
            target_leaf_row, target_leaf_row, 6,
            target_origin + ", XW2-0133"))
    bnd_rows = [
        line for line in mrcpt.splitlines()
        if re.match(r"^\| BND-(\d{4}) \|", line)]
    bundle_id = "BND-%04d" % (
        max(int(re.match(r"^\| BND-(\d{4})", line).group(1))
            for line in bnd_rows) + 1)
    bundle_fragment = deferred_fragment.replace(
        "| — | XW2-0132 |",
        "| %s | XW2-0132, XW2-0133 |" % bundle_id)
    bundle_row = (
        "| %s | XW2-BND | %s | — | %s | XW2-0132, XW2-0133 | "
        "deferred, partial-overlap | —, %s | %s, %s | %s | active | "
        "current | 1 | — |"
        % (bundle_id, deferred_leaf, deferred_fid, bundle_target,
           bundle_deferred_span, bundle_target_span, deferred_span))
    bundle_receipt = mut(
        deferred_receipt, deferred_fragment, bundle_fragment)
    bundle_receipt = mut(
        bundle_receipt, bnd_rows[-1] + "\n",
        bnd_rows[-1] + "\n" + bundle_row + "\n")
    H.run("A19", "a deferred edge is admitted as one member of a mixed "
          "multi-target bundle",
          H.docs(migrated=True, **{
              C: bundle_canon,
              R: bundle_receipt,
          }), True, "deferred edge may never appear as a bundle member")
    H.run("A15", "deferred edge omits its exact source/target-family and "
          "resolving-unit metadata",
          H.docs(migrated=True, **{
              C: mut(deferred_canon,
                     " — families:C,R; resolving-unit:R6", ""),
              R: deferred_receipt,
          }), True, "deferred scope must end")
    H.run("A16", "deferred edge points to a DISP rather than a direct current "
          "OWN decision",
          H.docs(migrated=True, **{
              C: deferred_canon,
              R: mut(deferred_receipt, deferred_dr,
                     deferred_dr.replace("| `OWN` |", "| `DISP` |")),
          }), True, "deferred edge must directly reference")
    r8_started_plan = mut(
        mplan,
        "## R8 — Global canon/register reconciliation and final checksum\n",
        "## R8 — Global canon/register reconciliation and final checksum\n\n"
        "- **Status:** in progress (deferred-edge survival control).\n")
    H.run("A17", "a current deferred edge survives after R8 has started",
          H.docs(migrated=True, **{
              C: deferred_canon,
              P: r8_started_plan,
              R: deferred_receipt,
          }), True, "deferred edge survives into R8")

    # Sole owner-authorized same-family exception: C13 maps to R4, a
    # different sibling fragment has an existing cross-family A target, and
    # the OWN Test/tiebreak field carries the exact structural join. These
    # controls do not attempt to prove the semantic natural-owner conclusion.
    same_leaf = "CBA-C13.8"
    same_length = _published.leaf_len[same_leaf]
    same_split = max(1, same_length // 2)
    same_f1 = same_leaf + ":F1"
    same_f2 = same_leaf + ":F2"
    same_span1 = "span:0-%d" % same_split
    same_span2 = "span:%d-%d" % (same_split, same_length)
    same_deferred_decision = deferred_decision
    same_sibling_decision = "DR2-%04d" % (
        int(deferred_decision.split("-")[1]) + 1)
    same_amend_decision = "DR2-%04d" % (
        int(deferred_decision.split("-")[1]) + 2)
    same_target = bundle_target
    same_join = (
        "same-family-sibling:XW2-0133->%s; natural-family:C; "
        "resolving-unit:R4" % same_target)
    same_deferred_dr = (
        "| %s | `OWN` | %s | Deferred pending C-family owner | %s | "
        "R4 must mint the natural C owner and replace this edge through "
        "AMEND | — | R3.1 / temporary control |"
        % (same_deferred_decision, same_f1, same_join))
    same_sibling_dr = (
        "| %s | `OWN` | %s | Existing cross-family sibling owner selected | "
        "Current active-target ownership join | The different sibling "
        "fragment maps to the existing A-family target | %s | "
        "R3.1 / temporary control |"
        % (same_sibling_decision, same_f2, same_target))
    same_amend_dr = (
        "| %s | `AMEND` | %s | Current Origin field revised to include the "
        "new sibling edge | Same-ID governed-row lineage | Direct current "
        "back-reference added without identity reuse | — | "
        "R3.1 / temporary control |"
        % (same_amend_decision, same_target))
    same_deferred_xw = (
        "| XW2-0132 | %s | — | `deferred` | [%s] %s — "
        "families:C,C; resolving-unit:R4 | %s |"
        % (same_leaf, same_f1, same_span1, same_deferred_decision))
    same_sibling_xw = (
        "| XW2-0133 | %s | %s | `partial-overlap` | [%s] %s — "
        "current cross-family sibling control | %s |"
        % (same_leaf, same_target, same_f2, same_span2,
           same_sibling_decision))
    same_fragment1 = (
        "| %s | %s | substantive-obligation | — | %s | %s | — | "
        "XW2-0132 | current | 1 | same-family deferred control |"
        % (same_f1, same_leaf, same_span1, decomp_decision))
    same_fragment2 = (
        "| %s | %s | substantive-obligation | — | %s | %s | — | "
        "XW2-0133 | current | 1 | qualifying cross-family sibling control |"
        % (same_f2, same_leaf, same_span2, decomp_decision))
    same_canon = mut(
        mcanon, xw_anchor + "\n",
        xw_anchor + "\n" + same_deferred_xw + "\n"
        + same_sibling_xw + "\n")
    same_target_row = row_line(same_canon, "| %s |" % same_target)
    same_target_origin = [
        cell.strip()
        for cell in same_target_row.strip()[1:-1].split("|")][6]
    same_canon = mut(
        same_canon, same_target_row,
        replace_cell(
            same_target_row, same_target_row, 6,
            same_target_origin + ", XW2-0133"))
    same_receipt = mut(
        mrcpt, generic_rows[-1] + "\n",
        generic_rows[-1] + "\n" + same_deferred_dr + "\n"
        + same_sibling_dr + "\n" + same_amend_dr + "\n")
    amend_control_rows = [
        line for line in mrcpt.splitlines()
        if re.match(
            r"^\| DR2-\d{4} \| "
            r"(?:GROUP|LEAF|XW2|SXW2|SRC2|EV2|DR2|BND|SM2|SS2|BLK|RES|"
            r"fragment|scenario-fragment|SRC2-date-component) \|",
            line)
    ]
    if not amend_control_rows:
        raise AssertionError("migrated control has no AMEND detail rows")
    same_amend_detail = (
        "| %s | LEAF | %s | — | %s | revise | %s | — | "
        "same-family sibling Origin back-reference revision |"
        % (same_amend_decision, same_target, repo.r3, same_target))
    same_receipt = mut(
        same_receipt, amend_control_rows[-1] + "\n",
        amend_control_rows[-1] + "\n" + same_amend_detail + "\n")
    same_receipt = mut(
        same_receipt, fragment_anchor + "\n",
        fragment_anchor + "\n" + same_fragment1 + "\n"
        + same_fragment2 + "\n")
    same_docs = H.docs(migrated=True, **{
        C: same_canon,
        R: same_receipt,
    })
    H.run("C13", "owner-authorized C/C deferred edge has a different "
          "fragment sibling joined to an existing A-family active target, "
          "the exact R4 map, no F1 target, and a pinned OWN structural join",
          same_docs, False)

    no_sibling_deferred_xw = same_deferred_xw.replace(
        same_span1, "span:0-%d" % same_length, 1)
    no_sibling_fragment = same_fragment1.replace(
        same_span1, "span:0-%d" % same_length, 1)
    no_sibling_canon = mut(
        same_canon, same_sibling_xw + "\n", "")
    no_sibling_canon = mut(
        no_sibling_canon, same_deferred_xw, no_sibling_deferred_xw)
    no_sibling_target_row = row_line(
        no_sibling_canon, "| %s |" % same_target)
    no_sibling_canon = mut(
        no_sibling_canon, no_sibling_target_row,
        no_sibling_target_row.replace(", XW2-0133", ""))
    no_sibling_receipt = mut(
        same_receipt, same_fragment2 + "\n", "")
    no_sibling_receipt = mut(
        no_sibling_receipt, same_fragment1, no_sibling_fragment)
    H.run("A22", "same-family deferral has no qualifying different-fragment "
          "cross-family sibling",
          H.docs(migrated=True, **{
              C: no_sibling_canon,
              R: no_sibling_receipt,
          }), True, "has no qualifying different-fragment sibling edge")

    wrong_unit_canon = same_canon.replace(
        "families:C,C; resolving-unit:R4",
        "families:C,C; resolving-unit:R5", 1)
    wrong_unit_receipt = same_receipt.replace(
        "natural-family:C; resolving-unit:R4",
        "natural-family:C; resolving-unit:R5", 1)
    H.run("A23", "C13 same-family deferral names R5 instead of its governed "
          "R4 construction unit",
          H.docs(migrated=True, **{
              C: wrong_unit_canon,
              R: wrong_unit_receipt,
          }), True, "does not match the governed source-family map R4")

    source_mismatch_canon = same_canon.replace(
        "families:C,C; resolving-unit:R4",
        "families:R,R; resolving-unit:R4", 1)
    source_mismatch_receipt = same_receipt.replace(
        "natural-family:C; resolving-unit:R4",
        "natural-family:R; resolving-unit:R4", 1)
    H.run("A24", "same-family deferral's declared source family mismatches "
          "the historical source and sibling-family join",
          H.docs(migrated=True, **{
              C: source_mismatch_canon,
              R: source_mismatch_receipt,
          }), True, "deferred source family R does not match historical "
                    "source")

    existing_target_xw = same_sibling_xw.replace(
        "[%s] %s" % (same_f2, same_span2),
        "[%s] %s" % (same_f1, same_span1), 1)
    existing_target_canon = mut(
        same_canon, same_sibling_xw, existing_target_xw)
    H.run("A25", "same-family deferred fragment already has a current active "
          "target-bearing edge",
          H.docs(migrated=True, **{
              C: existing_target_canon,
              R: same_receipt,
          }), True, "same-family deferred fragment already has active target")
    stale_sibling_fragment = same_fragment2.replace(
        "| current | 1 |", "| superseded | 1 |", 1)
    H.run("A26", "same-family join names a sibling edge whose fragment is no "
          "longer current",
          H.docs(migrated=True, **{
              C: same_canon,
              R: mut(same_receipt, same_fragment2, stale_sibling_fragment),
          }), True, "does not resolve to a current sibling fragment")

    # Valid populated OPS/EXT locations prove those governed sections are
    # real parser inputs rather than prose-only inventory entries.
    src4 = row_line(mcanon, "| SRC2-004 |")
    ops_base = ("| SRC2-005 | `ops-provenance` | League operations roster "
                "system | — | — | — | — | — | 2026-07-22T01:00:00Z | "
                "`agent:codex` | `session:r31-control` | 2026-07-22 | "
                "authenticated first-party statement; no durable artifact | "
                "current | 1 |")
    ext_base = ("| SRC2-006 | `ext-contract` | Medical determination input "
                "contract | — | — | — | — | — | 2026-07-22T01:05:00Z | "
                "`agent:codex` | `session:r31-control` | 2026-07-22 | "
                "runtime external determination required | current | 1 |")
    ops_row = ("| SRC2-005 | League operations roster system | league "
               "operations administrator | pick-processing practice | "
               "2026-07-01/open | authenticated system access | configurable "
               "by league operation | — |")
    ext_row = ("| SRC2-006 | medical determination | player-id; "
               "examination-date | licensed physician identity; signed "
               "determination | roster availability | effective on "
               "authenticated decision; expires when superseded | CBA Article "
               "VII | authenticated signed decision |")
    ops_ext = mut(mcanon, src4 + "\n",
                  src4 + "\n" + ops_base + "\n" + ext_base + "\n")
    ops_seg = line_range(ops_ext, "#### 15.12.4", "#### 15.12.5")
    ops_ext = ops_ext.replace(
        ops_seg, ops_seg.rstrip() + "\n\n"
        + _table(inv.schema["SRC2-detail-ops-provenance"], [ops_row]) + "\n",
        1)
    ext_seg = line_range(ops_ext, "#### 15.12.5", "#### 15.12.6")
    ops_ext = ops_ext.replace(
        ext_seg, ext_seg.rstrip() + "\n\n"
        + _table(inv.schema["SRC2-detail-ext-contract"], [ext_row]) + "\n",
        1)
    H.run("C4", "valid populated OPS-provenance and EXT-contract records in "
          "their governed canon locations",
          H.docs(migrated=True, **{C: ops_ext}), False)

    # Whole-canon Inventory-F location closure. These exact-width duplicates
    # sit outside every matching governed interval, so downstream population
    # parsers intentionally cannot see them; the generic audit must.
    registry_heading = (
        "### 15.12 Source/provenance and evidence registries (created by R3)")

    def before_registry(text, row):
        return mut(text, registry_heading, row + "\n\n" + registry_heading)

    def refence_id(row, fence):
        cells = [c.strip() for c in row.strip()[1:-1].split("|")]
        cells[0] = (fence + normalize_record_id_cell(cells[0]) + fence)
        return "| " + " | ".join(cells) + " |"

    misplaced_ops = before_registry(ops_ext, ops_row)
    H.run("O1", "exact-width OPS-provenance detail row is displaced before "
          "the Inventory F SRC2 intervals",
          H.docs(migrated=True, **{C: misplaced_ops}), True,
          "governed location SRC2-005: pipe row")
    misplaced_ext = before_registry(ops_ext, ext_row)
    H.run("O2", "exact-width EXT-contract detail row is displaced before "
          "the Inventory F SRC2 intervals",
          H.docs(migrated=True, **{C: misplaced_ext}), True,
          "governed location SRC2-006: pipe row")
    ev_location_row = row_line(mcanon, "| EV2-0001 |")
    misplaced_ev = before_registry(mcanon, ev_location_row)
    H.run("O3", "exact-width EV2 component row is displaced before its "
          "Inventory F interval",
          H.docs(migrated=True, **{C: misplaced_ev}), True,
          "governed location EV2-0001: pipe row")
    sxw_location_row = row_line(mcanon, "| SXW2-0001 |")
    misplaced_sxw = before_registry(mcanon, sxw_location_row)
    H.run("O4", "exact-width SXW2 edge row is displaced before its Inventory "
          "F interval",
          H.docs(migrated=True, **{C: misplaced_sxw}), True,
          "governed location SXW2-0001: pipe row")

    # R2.14 closes the normalization split demonstrated by the independent
    # R2.13 checker. Balanced multi-backtick Markdown code spans must take the
    # same location path as plain IDs for every governed grammar.
    multi_ops = before_registry(ops_ext, refence_id(ops_row, "``"))
    H.run("N1", "multi-backtick OPS-provenance detail row is displaced before "
          "the Inventory F SRC2 intervals",
          H.docs(migrated=True, **{C: multi_ops}), True,
          "governed location SRC2-005: pipe row")
    multi_ext = before_registry(ops_ext, refence_id(ext_row, "``"))
    H.run("N2", "multi-backtick EXT-contract detail row is displaced before "
          "the Inventory F SRC2 intervals",
          H.docs(migrated=True, **{C: multi_ext}), True,
          "governed location SRC2-006: pipe row")
    multi_ev = before_registry(
        mcanon, refence_id(ev_location_row, "``"))
    H.run("N3", "multi-backtick EV2 component row is displaced before its "
          "Inventory F interval",
          H.docs(migrated=True, **{C: multi_ev}), True,
          "governed location EV2-0001: pipe row")
    multi_sxw = before_registry(
        mcanon, refence_id(sxw_location_row, "``"))
    H.run("N4", "multi-backtick SXW2 edge row is displaced before its "
          "Inventory F interval",
          H.docs(migrated=True, **{C: multi_sxw}), True,
          "governed location SXW2-0001: pipe row")

    # A synthetic Inventory-F declaration proves the generic audit derives
    # both grammar and range dynamically rather than from a Python list.
    inv_f_last = row_line(
        mcanon, "| `SXW2-edge` | `#### 16.v2.2 Scenario crosswalk` |")
    synthetic = mut(
        mcanon, inv_f_last + "\n",
        inv_f_last + "\n"
        + "| `synthetic-location-control` | `#### 15.12.6` | `## 16.` | "
          "`ZZ2-[0-9]{4}` |\n")
    synthetic = before_registry(
        synthetic, "| ``ZZ2-0001`` | synthetic location control |")
    H.run("N5", "multi-backtick ID governed only by a synthetic Inventory-F "
          "declaration is displaced outside its declared interval",
          H.docs(migrated=True, **{C: synthetic}), True,
          "governed location ZZ2-0001: pipe row")

    stale_plan = mut(
        base[P], "## R2.14 ",
        "Current sequence is **R2.12 maker checkpoint → independent R2.12 "
        "checker ACCEPT → R3.1 maker checkpoint**.\n\n## R2.14 ")
    H.run("N6", "repair plan reintroduces a stale live R2.12-current route",
          H.docs(**{P: stale_plan}), True,
          "stale live R2.12 current/controlling route")

    stale_r213_plan = mut(
        base[P], "## R2.14 ",
        "Controlling sequence is now **R2.13 maker checkpoint → independent "
        "R2.13 checker ACCEPT → R3.1 maker checkpoint**.\n\n## R2.14 ")
    H.run("N7", "repair plan reintroduces a stale live R2.13-current route",
          H.docs(**{P: stale_r213_plan}), True,
          "stale live R2.13 current/controlling route")

    bnd_inventory = row_line(canon, "| `BND-bundle` |")
    bad_inventory = replace_cell(canon, bnd_inventory, 2, "13")
    H.run("I1", "governed schema count diverges from its field list",
          H.docs(**{C: bad_inventory}), True, "Count 13 != 14")

    xw12 = row_line(canon, "| XW2-0012 |")
    H.run("P1", "a committed XW2 identity is silently deleted",
          H.docs(**{C: mut(canon, xw12 + "\n", "")}), True,
          "preservation")

    bad_group = replace_cell(canon, grow, 2, "`CBA2-A12.1`–`CBA2-A12.5` (4)")
    H.run("L1", "GROUP declared child count differs from actual children",
          H.docs(**{C: bad_group}), True, "declared child count")
    origin_row = row_line(canon, "| CBA2-A02.2 |")
    bad_origin = replace_cell(canon, origin_row, 6, "XW2-9999")
    H.run("L2", "LEAF Origin references a nonexistent XW2 edge",
          H.docs(**{C: bad_origin}), True, "Origin references nonexistent")
    detail_seg = line_range(canon, "#### 15.10.3", "### 15.11")
    dep_row = next(
        ln for ln in detail_seg.splitlines()
        if ln.startswith("| CBA2-")
        and len([c.strip() for c in ln.strip()[1:-1].split("|")]) > 2
        and [c.strip() for c in ln.strip()[1:-1].split("|")][2] != DASH)
    bad_dep = replace_cell(canon, dep_row, 2, "CBA2-A99.1")
    H.run("L3", "LEAF dependency references a nonexistent active LEAF",
          H.docs(**{C: bad_dep}), True, "does not resolve to an active LEAF")

    # SRC2 base and type-detail minima: one focused mutation per mechanically
    # required field class that R2.11 omitted.
    src1 = row_line(mcanon, "| SRC2-001 |")
    src3 = row_line(mcanon, "| SRC2-003 |")
    src_base_cases = (
        ("F1", 2, DASH, "Source/provenance identity"),
        ("F2", 3, DASH, "requires a Source date pair"),
        ("F3", 4, DASH, "requires an absolute Official URL"),
        ("F4", 5, DASH, "requires artifact hash and byte size"),
        ("F5", 6, DASH, "requires artifact hash and byte size"),
        ("F6", 7, DASH, "requires a valid UTC Retrieval timestamp"),
        ("F7", 9, "agent:UPPER", "Verifier identity"),
        ("F8", 10, "bad-session", "Verification session ID"),
        ("F9", 11, "2026-02-30", "Verification date"),
        ("F10", 12, DASH, "Record limitations"),
        ("F11", 13, "live", "governed record-status vocabulary"),
        ("F12", 14, "0", "Record version"),
    )
    for name, index, value, diagnostic in src_base_cases:
        H.run(name, "SRC2 required base field/grammar mutation at column %d"
              % index,
              H.docs(migrated=True,
                     **{C: replace_cell(mcanon, src1, index, value)}),
              True, diagnostic)
    mut_seg = line_range(mcanon, "#### 15.12.3", "#### 15.12.4")
    mut_detail = next(ln for ln in mut_seg.splitlines()
                      if ln.startswith("| SRC2-003 |"))
    for name, index, diagnostic in (
            ("F13", 1, "Publication identity"),
            ("F14", 2, "exactly one Publication date or Season"),
            ("F15", 4, "Exact values or text relied upon")):
        H.run(name, "official-mutable required detail field %d is dash" % index,
              H.docs(migrated=True,
                     **{C: replace_cell(mcanon, mut_detail, index, DASH)}),
              True, diagnostic)
    imm_seg = line_range(mcanon, "#### 15.12.2", "#### 15.12.3")
    imm_detail = next(ln for ln in imm_seg.splitlines()
                      if ln.startswith("| SRC2-001 |"))
    H.run("F16", "official-immutable Page geometry is dash",
          H.docs(migrated=True,
                 **{C: replace_cell(mcanon, imm_detail, 2, DASH)}),
          True, "Page geometry")
    H.run("F17", "OPS-provenance Authentication timestamp is dash",
          H.docs(migrated=True,
                 **{C: replace_cell(ops_ext, ops_base, 8, DASH)}),
          True, "requires a valid UTC Authentication timestamp")
    H.run("F18", "OPS-provenance Authority/role detail is dash",
          H.docs(migrated=True,
                 **{C: replace_cell(ops_ext, ops_row, 2, DASH)}),
          True, "Authority/role of the source")
    H.run("F19", "EXT-contract Runtime input schema detail is dash",
          H.docs(migrated=True,
                 **{C: replace_cell(ops_ext, ext_row, 2, DASH)}),
          True, "Runtime input schema")

    bad_scenario_header = mut(
        mrcpt, "| Scenario fragment ID | Historical scenario | Fragment kind |",
        "| Fragment ID | Historical scenario | Fragment kind |")
    H.run("H1", "scenario-fragment table reuses the historical-LEAF header",
          H.docs(migrated=True, **{R: bad_scenario_header}), True,
          "header scenario-fragment-inventory")

    dr_row = row_line(mrcpt, "| DR2-0048 |")
    bad_dr = replace_cell(mrcpt, dr_row, 2, DASH)
    H.run("D1", "a required DR2 field is dash",
          H.docs(migrated=True, **{R: bad_dr}), True, "required field Subject")
    bad_unit = mut(mrcpt, "R3.1 / temporary tree",
                   "R3.1 control / temporary tree", 1)
    H.run("D2", "DR2 Unit/commit violates the governed grammar",
          H.docs(migrated=True, **{R: bad_unit}), True, "Unit/commit")

    bnd_row = row_line(mrcpt, "| BND-0001 |")
    bnd_cells = [c.strip() for c in bnd_row.strip()[1:-1].split("|")]
    scopes = bnd_cells[8].split(", ")
    scopes[0] = bnd_cells[9]
    bad_bnd = replace_cell(mrcpt, bnd_row, 8, ", ".join(scopes))
    H.run("B1", "BND member scope does not match its positional edge scope",
          H.docs(migrated=True, **{R: bad_bnd}), True,
          "positional scope join")
    sx_bnd_cells = [c.strip() for c in
                    bnd_row.strip()[1:-1].split("|")]
    sx_bnd_cells[1] = "SXW2-BND"
    sx_bnd_cells[2] = DASH
    sx_bnd_cells[3] = "scenario-1"
    sx_bnd_cells[4] = "scenario-1:F1"
    bad_sx_bnd = mut(mrcpt, bnd_row,
                     "| " + " | ".join(sx_bnd_cells) + " |")
    H.run("B2", "an SXW2-BND variant reuses XW2 member edges",
          H.docs(migrated=True, **{R: bad_sx_bnd}), True,
          "belongs to XW2, not SXW2")

    sxdisp = next(ln for ln in mrcpt.splitlines()
                  if ln.startswith("| DR2-") and " | SXW2-DISP | " in ln)
    sx_cells = [c.strip() for c in sxdisp.strip()[1:-1].split("|")]
    sm = re.fullmatch(r"span:(\d+)-(\d+)", sx_cells[6])
    bad_sx_scope = "span:%d-%s" % (int(sm.group(1)) + 1, sm.group(2))
    bad_sxdisp = replace_cell(mrcpt, sxdisp, 6, bad_sx_scope)
    H.run("S1", "SXW2 DISP scope disagrees with its scenario edge",
          H.docs(migrated=True, **{R: bad_sxdisp}), True,
          "SXW2 edge's own fragment scope")

    ev_row = row_line(mcanon, "| EV2-0001 |")
    ev_cycle = replace_cell(mcanon, ev_row, 4, "EV2-0001")
    H.run("E1", "EV2 dependency graph contains a self-cycle",
          H.docs(migrated=True, **{C: ev_cycle}), True,
          "EV2 dependency cycle")
    ev_ops = replace_cell(mcanon, ev_row, 2, "OPS")
    H.run("E2", "OPS evidence closure has no required ops-provenance root",
          H.docs(migrated=True, **{C: ev_ops}), True,
          "no required ops-provenance terminal root")
    for name, index, field in (
            ("E3", 5, "Exact locator(s)"),
            ("E4", 6, "Controlling passage or tight paraphrase"),
            ("E5", 7, "Passage-to-obligation mapping")):
        H.run(name, "EV2 required %s is dash" % field,
              H.docs(migrated=True,
                     **{C: replace_cell(mcanon, ev_row, index, DASH)}),
              True, "required field %s" % field)
    H.run("E6", "EV2 source reference does not resolve",
          H.docs(migrated=True,
                 **{C: replace_cell(mcanon, ev_row, 3, "SRC2-999")}),
          True, "references nonexistent SRC2-999")

    amend_row = next(ln for ln in mrcpt.splitlines()
                     if ln.startswith("| DR2-") and " | DR2 | DR2-" in ln)
    bad_amend = replace_cell(mrcpt, amend_row, 6, "DR2-9999")
    H.run("A1", "AMEND detail points to a nonexistent current identity",
          H.docs(migrated=True, **{R: bad_amend}), True,
          "does not resolve directly")
    amend_population_pattern = "|".join(
        re.escape(population) for population in sorted(
            AMEND_POPULATION_KEYS, key=len, reverse=True))
    no_amend_detail = re.sub(
        r"(?m)^\| DR2-\d{4} \| (?:%s) \|.*\n?"
        % amend_population_pattern, "", mrcpt)
    H.run("A2", "post-R3.1 AMEND detail population is absent",
          H.docs(migrated=True, **{R: no_amend_detail}), True,
          "G15R/AMEND-detail")
    missing_prior = replace_cell(mrcpt, amend_row, 2, "DR2-9999")
    H.run("A3", "AMEND detail prior identity is absent at its checkpoint",
          H.docs(migrated=True, **{R: missing_prior}), True,
          "prior DR2 identity DR2-9999 resolves 0 times")
    cycle_cells = [c.strip() for c in
                   amend_row.strip()[1:-1].split("|")]
    cycle_cells[5] = "replace"
    cycle_cells[6] = cycle_cells[2]
    cycle_amend = mut(mrcpt, amend_row,
                      "| " + " | ".join(cycle_cells) + " |")
    H.run("A4", "AMEND detail cycles to and reuses its prior identity",
          H.docs(migrated=True, **{R: cycle_amend}), True,
          "lineage cycles to/reuses its prior identity")
    branch_amend = replace_cell(mrcpt, amend_row, 5, "replace")
    H.run("A5", "a non-split AMEND action branches to multiple identities",
          H.docs(migrated=True, **{R: branch_amend}), True,
          "only split may branch")
    missing_checkpoint = replace_cell(mrcpt, amend_row, 4, "1" * 40)
    H.run("A6", "AMEND detail prior checkpoint does not resolve",
          H.docs(migrated=True, **{R: missing_checkpoint}), True,
          "does not resolve to a full Git commit")

    no_dates = re.sub(
        r"(?m)^\| SRC2-00\d \| SRC2-00\d#D\d \|.*\n?", "", mrcpt)
    H.run("T1", "post-R3.1 source-date component population is absent",
          H.docs(migrated=True, **{R: no_dates}), True,
          "G15R/SRC2-date-component")

    fragment_row = next(ln for ln in mrcpt.splitlines()
                        if re.match(r"^\| CBA-[A-Z]\d{2}(?:\.\d+)?:F\d+ \|",
                                    ln))
    scenario_row = next(ln for ln in mrcpt.splitlines()
                        if re.match(r"^\| scenario-\d+:F\d+ \|", ln))
    sm2_row = row_line(mrcpt, "| SM2-0001 |")
    ss2_row = row_line(mrcpt, "| SS2-0001 |")
    amend_id = amend_row.split("|")[1].strip().strip("`")
    fragment_id = fragment_row.split("|")[1].strip().strip("`")
    valid_revise = (
        "| %s | fragment | %s | 1 | %s | revise | %s | 2 | "
        "legitimate same-identity one-step version control |"
        % (amend_id, fragment_id, repo.maker, fragment_id))
    valid_version2 = replace_cell(mrcpt, fragment_row, 9, "2")
    valid_version2 = mut(
        valid_version2, amend_row + "\n",
        amend_row + "\n" + valid_revise + "\n")
    H.run("C5", "legitimate fragment version 1 to 2 same-ID revise resolves "
          "the exact version 1 row at its pinned prior checkpoint",
          H.docs(migrated=True, **{R: valid_version2}), False)

    for name, row, index, population in (
            ("V1", fragment_row, 9, "fragment"),
            ("V2", scenario_row, 8, "scenario-fragment"),
            ("V3", bnd_row, 12, "BND"),
            ("V4", sm2_row, 26, "SM2"),
            ("V5", ss2_row, 10, "SS2")):
        H.run(name, "%s version jumps from 1 to 2 without a same-ID AMEND "
              "revise" % population,
              H.docs(migrated=True,
                     **{R: replace_cell(mrcpt, row, index, "2")}),
              True, "%s %s: version 2 requires exactly one" %
              (population, row.split("|")[1].strip()))

    fabricated_revise = (
        "| %s | fragment | %s | 8 | %s | revise | %s | 9 | "
        "fabricated prior-version control |"
        % (amend_id, fragment_id, repo.maker, fragment_id))
    fabricated_version9 = replace_cell(mrcpt, fragment_row, 9, "9")
    fabricated_version9 = mut(
        fabricated_version9, amend_row + "\n",
        amend_row + "\n" + fabricated_revise + "\n")
    H.run("V6", "same-ID revise claims version 8 to 9 while the pinned prior "
          "checkpoint contains version 1",
          H.docs(migrated=True, **{R: fabricated_version9}), True,
          "prior checkpoint records version 1, not claimed prior version 8")

    res_row = row_line(mrcpt, "| RES-0001 |")
    # Exact proposal-at-maker-checkpoint chronology. Each history helper
    # creates a real maker commit followed by a strict descendant receipt.
    no_proposal = mut(proposal, row_line(proposal, "| RES-0001 |") + "\n", "")
    H.run("Q1", "maker checkpoint does not contain the proposed RES row",
          acceptance_history(no_proposal), True,
          "proposal contains 0 matching rows")
    proposal_row = row_line(proposal, "| RES-0001 |")
    duplicate_proposal = mut(
        proposal, proposal_row + "\n",
        proposal_row + "\n" + proposal_row + "\n")
    H.run("Q2", "maker checkpoint contains duplicate proposed RES rows",
          acceptance_history(duplicate_proposal), True,
          "proposal contains 2 matching rows")
    mismatch_proposal = mut(
        proposal, RES_AUTHORITY, "different maker-proposed authority", 1)
    H.run("Q3", "maker checkpoint proposal content differs from the accepted "
          "current RES row", acceptance_history(mismatch_proposal), True,
          "maker checkpoint proposal Resolver authority")
    H.run("Q4", "maker checkpoint already carries an accepted rather than "
          "proposed RES row", acceptance_history(mrcpt), True,
          "maker checkpoint row is not proposed/unaccepted")
    wrong_path = replace_cell(mrcpt, res_row, 6,
                              PLAN_REL.replace(os.sep, "/"))
    H.run("Q5", "current RES row points to the wrong maker proposal path",
          H.docs(migrated=True, **{R: wrong_path}), True,
          "maker checkpoint proposal contains 0 matching rows")
    same_commit = replace_cell(mrcpt, res_row, 7, repo.accept)
    H.run("Q6", "checker receipt is not later than the maker checkpoint",
          H.docs(migrated=True, **{R: same_commit}), True,
          "not a strict descendant")

    # Duplicate checker-receipt rows must never overwrite one another.
    def duplicate_receipt(text):
        row = row_line(text, "| RES-0001 |")
        return mut(text, row + "\n", row + "\n" + row + "\n")

    H.run("R1", "acceptance receipt contains duplicate rows for one RES",
          acceptance_history(proposal, duplicate_receipt), True,
          "exactly one is required")
    missing_commit_res = replace_cell(mrcpt, res_row, 8, "1" * 40)
    H.run("R2", "acceptance receipt commit is shaped but nonexistent",
          H.docs(migrated=True, **{R: missing_commit_res}), True,
          "does not resolve to a real commit")

    def mismatch_receipt(text):
        return mut(text, "| agent:claude-code | agent:codex |",
                   "| agent:other-maker | agent:codex |", 1)

    H.run("R3", "acceptance receipt maker field mismatches the exact RES",
          acceptance_history(proposal, mismatch_receipt), True,
          "receipt Maker/proposer identity")

    no_scenario = re.sub(r"(?m)^\| scenario-\d+:F\d+ \|.*\n?", "", mrcpt)
    H.run("G1", "triggered scenario-fragment population is omitted",
          H.docs(migrated=True, **{R: no_scenario}), True,
          "G15R/scenario-fragment-inventory")

    H.run("SELFTEST", "negative self-test (wrong expectation injected)",
          H.docs(), True)
    st = H.results.pop()
    H.self_test_ok = not st["ok"]
    return H.results, H.self_test_ok


# --------------------------------------------------------------------------
# 26. Main.
# --------------------------------------------------------------------------


def main():
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(
        __file__)), "..", ".."))
    tree = Tree(root)
    if tree.canon is None:
        print("FATAL: canon document not found", file=sys.stderr)
        return 2
    extended = "--extended" in sys.argv[1:]
    unknown = [a for a in sys.argv[1:] if a != "--extended"]
    if unknown:
        print("usage: %s [--extended]" % os.path.basename(__file__),
              file=sys.stderr)
        return 2
    print("Architect CBA canon v2.0 R3.1 A-series document-tree validator")
    print("control mode: %s" % ("extended diagnostic" if extended
                                else "bounded default"))
    print("canon: %s" % CANON_REL.replace(os.sep, "/"))
    print("plan:  %s" % (PLAN_REL.replace(os.sep, "/")
                         if tree.plan is not None else "MISSING"))
    print("receipts parsed: %d" % len(tree.receipts))

    base_problems, notes = validate_tree(tree)
    for n in notes:
        print("note:  " + n)
    if base_problems:
        print("BASELINE PROBLEMS (unexpected - the committed baseline must be "
              "clean):")
        for p in base_problems:
            print("  - " + p)

    control_ref = parse_accepted_status_control_tree(tree.plan)
    current_ref = tree.ref or git_head(tree.repo or tree.root)
    if (not control_ref
            or not git_commit_exists(tree.repo or tree.root, control_ref)
            or not current_ref
            or not git_is_ancestor(
                tree.repo or tree.root, control_ref, current_ref)):
        print("CONTROL HARNESS NOT RUN: the governed accepted-status control-"
              "tree pointer is absent, invalid, unresolved, or not an "
              "ancestor.")
        return 1

    repo = None
    failures = 0
    try:
        repo = ControlRepo(root, control_ref)
        results, self_test_ok = (run_extended_cases(repo) if extended
                                 else run_cases(repo))
    finally:
        if repo is not None:
            repo.cleanup()

    accepts = rejects = 0
    for r in results:
        verdict = "reject" if r["rejected"] else "accept"
        exp = "reject" if r["expect_reject"] else "accept"
        tag = "PASS" if r["ok"] else "FAIL"
        if r["expect_reject"]:
            rejects += 1
        else:
            accepts += 1
        if not r["ok"]:
            failures += 1
        print("case %5s [%s] %s (validator=%s, expected=%s%s)"
              % (r["name"], tag, r["desc"], verdict, exp,
                 "" if not r["expect_reject"]
                 else ", diagnostic=%s" % ("matched" if r["diag_ok"]
                                           else "MISMATCH")))
        if not r["ok"]:
            if r["expect_reject"] and r["rejected"] and not r["diag_ok"]:
                print("        intended diagnostic %r not found; got:"
                      % r["diag"])
            for s in r["sample"]:
                print("        e.g. " + s)

    print()
    print("negative self-test: injecting a knowingly wrong expectation on the "
          "committed baseline produces FAIL: %s"
          % ("yes" if self_test_ok else "NO - THE HARNESS IS RIGGED"))
    base_fail = 1 if base_problems else 0
    total = failures + base_fail + (0 if self_test_ok else 1)
    print("%d accepting controls + %d rejecting regressions = %d cases; "
          "baseline_clean=%s; %d total failures"
          % (accepts, rejects, len(results),
             "yes" if not base_problems else "NO", total))
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
