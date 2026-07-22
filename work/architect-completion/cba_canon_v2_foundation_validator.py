#!/usr/bin/env python3
"""Architect CBA canon v2.0 — foundation validator (R2.10 rewrite).

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

THIS REWRITE (R2.10)
--------------------
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
  * Preservation and conformance are separate duties. Preservation resolves
    every identity committed at the pinned R3 checkpoint COMMIT (loaded through
    the same `Tree` loader at that ref) — so renames, substitutions, drops,
    duplicates, and shifted ranges fail even when counts match. Conformance
    carries no fixed totals — so valid append-only additions above today's
    high-water marks pass.
  * `RES-…` acceptance resolves the acceptance commit in the tree's repository,
    requires the receipt path to exist at that commit, parses the blob, and
    requires a matching `## Independent acceptance record` `ACCEPT` row. The
    positive acceptance control uses a genuinely resolvable commit in a
    complete temporary Git control repository, exercised through the same path.
  * Normalized text lengths are DERIVED from the pinned published v1.1 edition
    at its pinned commit, so a nonexistent scenario, an out-of-range span
    endpoint, and a non-partitioning fragment inventory are all detectable.

No network, no third-party dependency, standard library only. Deterministic
output. Exit status is nonzero on ANY unexpected acceptance or rejection, on
any control whose rejection carries the wrong diagnostic, or on a dirty
baseline.
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


# --------------------------------------------------------------------------
# 2. Git access (real commit / blob resolution — no simulation).
# --------------------------------------------------------------------------


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
    return _git(root, "cat-file", "-e", sha + "^{commit}") is not None


def git_blob(root, sha, relpath):
    """Bytes of relpath at commit sha, or None if either does not exist."""
    return _git(root, "show", "%s:%s" % (sha, relpath.replace(os.sep, "/")))


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
        self.canon = self._read(CANON_REL)
        self.plan = self._read(PLAN_REL)
        self.receipts = {}
        for rel in self._list_receipts():
            txt = self._read(rel)
            if txt is not None:
                self.receipts[rel] = txt

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
# 5. Canonical-actor registry — parsed from the governed alias table.
# --------------------------------------------------------------------------


def parse_actor_registry(canon, inv):
    """(classes, problems). classes maps a canonical class to a list of alias
    patterns, parsed from the pinned 15.9.6 alias table and reconciled with
    the inventory's `canonical-actor-class` vocabulary."""
    probs = []
    anc = inv.vocab_anchor.get("canonical-actor-class")
    classes = {}
    if not anc:
        return classes, ["canonical-actor registry anchor missing from the "
                         "governed inventory"]
    tbl = table_after(canon, anc)
    for row in pipe_rows(tbl):
        if len(row) < 2 or not row[0].startswith("`"):
            continue
        classes[unspan(row[0])] = [unspan(a) for a in row[1].split(", ")]
    if not classes:
        return classes, ["canonical-actor alias table is missing or "
                         "unparseable"]
    declared = set(inv.vocab.get("canonical-actor-class", []))
    if declared != set(classes):
        probs.append("canonical-actor registry: alias-table classes %s do not "
                     "match the governed inventory %s (registry/inventory "
                     "divergence)"
                     % (sorted(classes), sorted(declared)))
    return classes, probs


def canonical_actor(identity, classes):
    """Normalize an actor identity to its canonical class using ONLY the parsed
    governed alias table. Returns None for blank, malformed, or unregistered."""
    if identity is None:
        return None
    ident = identity.strip().strip("`")
    if not ident or ident in (DASH, "-"):
        return None
    import unicodedata
    norm = unicodedata.normalize("NFC", ident).lower()
    if not re.fullmatch(r"(human|agent):[a-z0-9][a-z0-9._-]{0,63}", norm):
        return None
    kind, slug = norm.split(":", 1)
    for cls, aliases in sorted(classes.items()):
        for alias in aliases:
            a = alias.strip().lower()
            m = re.fullmatch(r"(human|agent):<slug>", a)
            if m:
                if kind == m.group(1):
                    return "%s:%s" % (kind, slug)
                continue
            if a == "itself (identity)":
                if cls.endswith("<slug>") and kind == cls.split(":", 1)[0]:
                    return "%s:%s" % (kind, slug)
                continue
            m = re.fullmatch(r"(agent|human):([a-z0-9._-]+)-<any suffix>", a)
            if m:
                if kind == m.group(1) and (slug == m.group(2)
                                           or slug.startswith(m.group(2) + "-")):
                    return cls
                continue
            if norm == a:
                return cls
    return None


def actors_independent(a, b, classes):
    ca, cb = canonical_actor(a, classes), canonical_actor(b, classes)
    return ca is not None and cb is not None and ca != cb


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
        if not r or not re.fullmatch(idre, r[0].strip("`")):
            continue
        if len(r) != want:
            probs.append("%s %s: row has %d fields, the table header declares "
                         "%d (malformed row)" % (key, r[0], len(r), want))
            continue
        rows.append([c.strip() for c in r])
    return header, rows, probs


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
            if not r or not re.fullmatch(idre, r[0].strip("`")):
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
        self.scenario_len = {}
        if not repo or not sha or not git_commit_exists(repo, sha):
            return
        b = git_blob(repo, sha, CANON_REL)
        if b is None:
            return
        txt = b.decode("utf-8")
        for row in pipe_rows(txt):
            if len(row) >= 4 and re.fullmatch(
                    r"CBA-[A-Z][0-9]{2}(\.[0-9]+)?", row[0]):
                self.leaf_len.setdefault(row[0], len(normalize_text(row[3])))
        seg = line_range(txt, "## 16. Acceptance-test library",
                         "## 17. Recommended comparison sequence")
        if seg:
            for m in re.finditer(r"(?m)^(\d+)\.\s+(.*)$", seg):
                self.scenario_len[int(m.group(1))] = len(
                    normalize_text(m.group(2)))
        self.ok = bool(self.leaf_len) and len(self.scenario_len) == 89


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


# --------------------------------------------------------------------------
# 10. Governing repair-plan facts.
# --------------------------------------------------------------------------


def plan_section(plan, start, end):
    seg = line_range(plan or "", start, end)
    return seg or ""


def parse_migration_state(plan):
    """'pre-R3.1' while the plan states R3.1 has not started; 'post-R3.1' once
    it states R3.1 executed. This governed switch replaces the R2.9
    hard-coded 'legacy marker' list."""
    seg = plan_section(plan, "## R3.1 ", "## R4 ")
    m = re.search(r"(?m)^- \*\*Status:\*\*\s*(.*(?:\n(?!- \*\*).*)*)", seg)
    status = m.group(1) if m else ""
    if re.search(r"not started", status, re.I):
        return "pre-R3.1"
    if re.search(r"executed", status, re.I):
        return "post-R3.1"
    return "unknown"


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
    if re.search(r"\*\*independently accepted\s+R2\.[789] foundation\*\*", r4):
        probs.append("plan R4 dependency still requires an accepted R2.7/R2.8/"
                     "R2.9 foundation (each was independently rejected)")
    if not re.search(r"accepted\s*\n?\s*R2\.10 foundation", r4):
        probs.append("plan R4 dependency does not depend on the accepted R2.10 "
                     "foundation")
    if not re.search(r"R2\.8 . R2\.9 . R2\.10 . R3\.1 .\s*\n?\s*R4", r4):
        probs.append("plan R4 construction sequence omits R2.9/R2.10")

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
                  "SRC2-detail-official-mutable", "EV2-component",
                  "SXW2-edge"):
            h, rows, probs = parse_canon_population(tree.canon, inv, k)
            self.problems += probs
            self.header[k] = h
            self.pop[k] = rows
        for k in ("DR2-generic", "DISP-detail", "fragment-inventory",
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
        return [r[0].strip("`") for r in self.pop.get(key, [])]

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
    # child-ID contiguity at construction, per GROUP
    by_group = {}
    for lid in mids:
        p, _, n = lid.partition(".")
        try:
            by_group.setdefault(p, []).append(int(n))
        except ValueError:
            ctx.problems.append("LEAF %s: child number is not an integer" % lid)
    for g, nums in sorted(by_group.items()):
        ctx.problems += contiguous_from_one(sorted(nums),
                                            "LEAF children of %s" % g)
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
    ctx.problems += contiguous_from_one(nums, "XW2")

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
        if etype in terminal:
            if tgt != DASH:
                ctx.problems.append("XW2 %s: terminal edge carries a non-dash "
                                    "target %r" % (eid, tgt))
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
        if etype in terminal:
            k = (src, frag)
            if k in term_keys:
                ctx.problems.append("XW2 %s: terminal-edge uniqueness violated "
                                    "on (source LEAF, fragment ID) %s (also %s)"
                                    % (eid, k, term_keys[k]))
            term_keys[k] = eid
        parsed.append({"id": eid, "src": src, "tgt": tgt, "type": etype,
                       "scope": scope or "", "dec": dec, "frag": frag,
                       "terminal": etype in terminal})
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
        g = lambda f: (ctx.f("fragment-inventory", r, f) or "").strip()
        parent = g("Historical parent LEAF").strip("`")
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
        for eid in eids:
            e = edge_by_id.get(eid)
            if e is None:
                ctx.problems.append("scenario fragment %s: disposition edge %s "
                                    "resolves to no SXW2 edge" % (fid, eid))
            elif e["frag"] and e["frag"] != fid:
                ctx.problems.append("scenario fragment %s: edge %s names "
                                    "fragment %s (bidirectional mismatch)"
                                    % (fid, eid, e["frag"]))
        if not eids:
            ctx.problems.append("scenario fragment %s: orphan fragment (no "
                                "disposition)" % fid)
        rec = {"id": fid, "scen": parent, "atoms": atoms, "status": status}
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
    ev2 = ctx.pop["EV2-component"]
    base_ids = [r[0].strip("`") for r in base]
    if len(base_ids) != len(set(base_ids)):
        ctx.problems.append("SRC2 base: duplicate record id(s)")
    det_ids = [r[0].strip("`") for r in imm] + [r[0].strip("`") for r in mut]
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
            for fname, vkey in (("Record status", "record-status"),):
                vocab_check(ctx, vkey, ctx.f("SRC2-base", r, fname),
                            "SRC2 %s %s" % (rid, fname))
            ver = (ctx.f("SRC2-base", r, "Record version") or "").strip("`")
            if not re.fullmatch(r"[1-9]\d*", ver):
                ctx.problems.append("SRC2 %s: Record version %r is not an "
                                    "unpadded positive integer" % (rid, ver))
            sha = (ctx.f("SRC2-base", r, "Artifact SHA-256 or —") or "").strip("`")
            size = (ctx.f("SRC2-base", r,
                          "Artifact byte size or —") or "").strip("`")
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
            sd = (ctx.f("SRC2-base", r, "Source date (basis:value) or —")
                  or "").strip("`")
            if sd != DASH:
                if ":" not in sd:
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
                    rec["date"] = (b, v)
            rec["sha"] = sha
            rec["size"] = size
        src2[rid] = rec
    for r in imm:
        rid = r[0].strip("`")
        src2.setdefault(rid, {}).setdefault("identity", ctx.f(
            "SRC2-detail-official-immutable", r, "Source title and edition"))
    for r in mut:
        rid = r[0].strip("`")
        src2.setdefault(rid, {}).setdefault("identity", ctx.f(
            "SRC2-detail-official-mutable", r, "Publication identity"))
    for r in base:
        rid = r[0].strip("`")
        src2.setdefault(rid, {})["base_identity"] = ctx.f(
            "SRC2-base", r, "Source/provenance identity")

    ev_ids = [r[0].strip("`") for r in ev2]
    if len(ev_ids) != len(set(ev_ids)):
        ctx.problems.append("EV2: duplicate component id(s)")
    ctx.problems += contiguous_from_one(
        [int(i.split("-")[1]) for i in ev_ids
         if re.fullmatch(r"EV2-\d{4}", i)], "EV2")
    for r in ev2:
        eid = r[0].strip("`")
        leaf = (ctx.f("EV2-component", r, "Active v2 LEAF") or "").strip("`")
        cls = (ctx.f("EV2-component", r, "Authority class") or "").strip("`")
        vocab_check(ctx, "authority-class", cls, "EV2 %s authority class" % eid)
        if leaf not in active_leaves:
            ctx.problems.append("EV2 %s: references nonexistent active LEAF %s"
                                % (eid, leaf))
        srefs = ctx.f("EV2-component", r, "Source/provenance record IDs or —")
        drefs = ctx.f("EV2-component", r,
                      "Dependency evidence component IDs or —")
        if (srefs or "").strip() == DASH and (drefs or "").strip() == DASH:
            ctx.problems.append("EV2 %s: both reference fields are empty "
                                "(source-free terminal component)" % eid)
        for sid in re.findall(r"SRC2-\d{3}", srefs or ""):
            if sid not in src2:
                ctx.problems.append("EV2 %s: references nonexistent %s"
                                    % (eid, sid))
        for did in re.findall(r"EV2-\d{4}", drefs or ""):
            if did not in set(ev_ids):
                ctx.problems.append("EV2 %s: references nonexistent %s"
                                    % (eid, did))
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
        dr2[did] = {"id": did, "type": dtype,
                    "subjects": ctx.f("DR2-generic", r, "Subject(s)") or "",
                    "disposition": ctx.f("DR2-generic", r, "Disposition") or "",
                    "result": ctx.f("DR2-generic", r,
                                    "Resulting active LEAF(s) or —") or ""}
    ctx.problems += contiguous_from_one(sorted(nums), "DR2")

    # every DR2 result reference resolves to an existing active LEAF
    for did, d in sorted(dr2.items()):
        for lid in re.findall(r"CBA2-[ACRLS][0-9]{2}\.[0-9]+", d["result"]):
            if lid not in active_leaves:
                ctx.problems.append("DR2 %s: resulting LEAF %s does not exist"
                                    % (did, lid))

    # every register decision reference resolves to an existing DR2 record
    for e in edges:
        if e["dec"] not in dr2:
            ctx.problems.append("XW2 %s: decision reference %s resolves to no "
                                "DR2 record (nonexistent decision)"
                                % (e["id"], e["dec"]))
    for r in ctx.pop["LEAF-detail"]:
        lid = r[0].strip("`")
        cell = ctx.f("LEAF-detail", r, "Decision records") or ""
        for ref in re.findall(r"DR2-\d{4}", cell):
            if ref not in dr2:
                ctx.problems.append("LEAF %s: decision reference %s resolves to "
                                    "no DR2 record" % (lid, ref))
    return dr2


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
                escope = re.sub(r"^\[[^\]]*\]\s*", "", e["scope"]).strip()
                em = re.search(r"(span:\d+-\d+(?:@[^\s;|]*)?(?:;\s*span:\d+-\d+"
                               r"(?:@[^\s;|]*)?)*)", escope)
                if em:
                    eatoms, _ = span_atoms(em.group(1))
                    if not spans_equal(eatoms, atoms):
                        ctx.problems.append("DISP %s: Normalized scope is not "
                                            "span-set-equal to the edge's own "
                                            "fragment scope" % did)
                elif migration == "post-R3.1":
                    ctx.problems.append("DISP %s: edge %s carries no parseable "
                                        "span scope to join against" % (did, edge))
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
        rec = {"id": fid, "leaf": parent, "kind": kind, "scope": scope,
               "atoms": atoms, "bundle": bundle, "edges": eids,
               "status": status, "ver": ver}
        frags[fid] = rec
        by_leaf.setdefault(parent, []).append(rec)

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
                    if ge is not None and not ge["terminal"]:
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
    nonterminal = set(ctx.vocab("xw2-edge-type")) - set(
        ctx.vocab("xw2-terminal-edge-type"))
    sole_owner = {"equivalent", "moved"}
    seen = set()
    for r in rows:
        bid = r[0].strip("`")
        g = lambda f: (ctx.f("BND-bundle", r, f) or "").strip()
        leaf = g("Source historical LEAF").strip("`")
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
            if t not in nonterminal:
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
            if f["leaf"] != leaf:
                ctx.problems.append("BND %s: source LEAF %s does not own "
                                    "fragment %s" % (bid, leaf, sfrag))
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
                ctx.problems.append("BND %s: member edge %s resolves to no XW2 "
                                    "edge" % (bid, mids[i]))
                continue
            if e["frag"] and e["frag"] != sfrag:
                ctx.problems.append("BND %s: member edge %s names fragment %s, "
                                    "not the bundle's source fragment %s "
                                    "(wrong-fragment edge)"
                                    % (bid, e["id"], e["frag"], sfrag))
            if e["type"] != mtypes[i]:
                ctx.problems.append("BND %s: member %d declared type %r != the "
                                    "edge's own type %r"
                                    % (bid, i + 1, mtypes[i], e["type"]))
            if e["tgt"] != mtargets[i]:
                ctx.problems.append("BND %s: member %d declared target %r != "
                                    "the edge's own target %r"
                                    % (bid, i + 1, mtargets[i], e["tgt"]))
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
            if basis in ("publication", "effective") and re.search(
                    r"cover|edition", locator or "", re.I):
                ctx.problems.append("date component %s: a cover/edition month "
                                    "may support only basis 'edition', never "
                                    "%s (false basis)" % (cid, basis))
            if not re.search(r"month precision", lim or "", re.I):
                ctx.problems.append("date component %s: month-precision value "
                                    "carries no mandatory month-precision "
                                    "limitation entry" % cid)
        if re.search(r"metadata|PDF creation|creation/modification",
                     locator or "", re.I):
            ctx.problems.append("date component %s: value is derived from "
                                "artifact metadata, which establishes no "
                                "basis's value (fabricated semantic claim)"
                                % cid)
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
        if not r or not re.fullmatch(idre, r[0].strip("`")):
            continue
        if len(r) != want:
            continue
        fields = ctx.inv.schema["acceptance-receipt-record"]
        out[r[0].strip("`")] = dict(zip(fields, [c.strip() for c in r]))
    return out


def res_binding_digest(ctx, row):
    """SHA-256 of the canon's pinned '|'-joined RES binding content."""
    parts = [ctx.f("RES-record", row, f) for f in (
        "Blocked finding ID", "Proposed outcome", "Resolver authority",
        "Maker/proposer identity", "Independent checker identity",
        "Reopening condition", "Limitations")]
    return sha_hex("|".join((p or "").strip() for p in parts))


def check_blk_res(ctx, actors, sm2, ss2, frags):
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
        commit = g("Acceptance commit or —").strip("`")
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
                    "commit": commit, "receipt": receipt, "acc_ver": acc_ver,
                    "acc_dig": acc_dig, "acc_out": acc_out, "status": status,
                    "ver": ver, "accepted": False}

    for rid, R in sorted(res.items()):
        if R["status"] != "accepted":
            continue
        ok = True
        if not actors_independent(R["maker"], R["checker"], actors):
            ctx.problems.append("RES %s: maker %r and checker %r do not resolve "
                                "to distinct canonical actor identities "
                                "(self-acceptance, alias/case masquerade, or a "
                                "blank/unregistered actor)"
                                % (rid, R["maker"], R["checker"]))
            ok = False
        if not re.fullmatch(r"[0-9a-f]{40}", R["commit"]):
            ctx.problems.append("RES %s: Acceptance commit %r is not a full "
                                "40-hex commit SHA" % (rid, R["commit"]))
            ok = False
        elif not git_commit_exists(repo, R["commit"]):
            ctx.problems.append("RES %s: Acceptance commit %s does not resolve "
                                "to a real commit in the governing repository "
                                "(fabricated acceptance evidence)"
                                % (rid, R["commit"]))
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
        if re.fullmatch(r"[0-9a-f]{40}", R["commit"]) and \
                git_commit_exists(repo, R["commit"]):
            if R["receipt"] in ("", DASH):
                ctx.problems.append("RES %s: accepted resolution carries no "
                                    "Acceptance receipt path" % rid)
                ok = False
            else:
                b = git_blob(repo, R["commit"], R["receipt"])
                if b is None:
                    ctx.problems.append("RES %s: Acceptance receipt %r does not "
                                        "exist at acceptance commit %s "
                                        "(unresolvable acceptance evidence)"
                                        % (rid, R["receipt"], R["commit"][:12]))
                    ok = False
                else:
                    blob = b.decode("utf-8", "replace")
        if blob is not None:
            recs = parse_acceptance_records(blob, ctx)
            row = recs.get(rid)
            if row is None:
                ctx.problems.append("RES %s: the acceptance receipt at %s "
                                    "carries no Independent acceptance record "
                                    "row for this resolution (blank or "
                                    "unrelated receipt)" % (rid, R["commit"][:12]))
                ok = False
            else:
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
                         ("Independent checker identity", R["checker"]))
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


def check_amend(ctx, dr2):
    """Real AMEND lineage: no reuse, exactly one current endpoint per chain,
    every superseding relationship resolving, and no stale live reference."""
    amend_ids = {d for d, v in dr2.items() if v["type"] == "AMEND"}
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


# --------------------------------------------------------------------------
# 20. Identity preservation against the pinned R3 checkpoint COMMIT.
#     (Separate from conformance: no fixed totals anywhere.)
# --------------------------------------------------------------------------

PRESERVED_POPULATIONS = ("GROUP-index", "LEAF-main", "LEAF-detail", "XW2-edge",
                         "SRC2-base", "SRC2-detail-official-immutable",
                         "SRC2-detail-official-mutable", "EV2-component",
                         "DR2-generic")


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
    base = Tree(ctx.tree.root, ref=sha)
    if base.canon is None:
        return (["preservation: the canon does not exist at the pinned R3 "
                 "checkpoint %s" % sha[:12]], notes)
    binv, bprobs = parse_inventory(base.canon)
    if bprobs or not binv.sections:
        binv = ctx.inv  # the checkpoint predates 15.9.11; read it with today's
    bctx = Ctx(base, binv)
    resolved_forward = set()
    for key, _f, _s, idre in SUPERSEDE_FIELDS:
        for r in ctx.pop.get(key, []):
            sup = (ctx.f(key, r, _f) or "").strip()
            m = re.match(r"supersedes (\S+) per AMEND", sup)
            if m:
                resolved_forward.add(m.group(1))
    for d in ctx.pop.get("DR2-generic", []):
        if (ctx.f("DR2-generic", d, "Type") or "").strip("`") == "AMEND":
            body = " ".join(d)
            for tok in re.findall(
                    r"(?:CBA2-[ACRLS][0-9]{2}(?:\.[0-9]+)?|XW2-[0-9]{4}|"
                    r"SRC2-[0-9]{3}|EV2-[0-9]{4}|DR2-[0-9]{4})", body):
                resolved_forward.add(tok)

    for key in PRESERVED_POPULATIONS:
        if key == "DR2-generic":
            _h, brows, _ = parse_receipt_population(base, binv, key)
        else:
            _h, brows, _ = parse_canon_population(base.canon, binv, key)
        base_ids = [r[0].strip("`") for r in brows]
        live_ids = set(ctx.ids(key))
        if not base_ids:
            continue
        missing = [i for i in base_ids
                   if i not in live_ids and i not in resolved_forward]
        if missing:
            probs.append("preservation %s: %d committed identity/identities no "
                         "longer resolve and are not AMEND-resolved forward "
                         "(renamed, substituted, renumbered, or dropped): %s"
                         % (key, len(missing), missing[:6]))
        notes.append("preservation %s: %d committed identities, %d live"
                     % (key, len(base_ids), len(live_ids)))
    return probs, notes


# --------------------------------------------------------------------------
# 21. G15R — the enumerated twelve-population repair gate.
# --------------------------------------------------------------------------


def check_g15r(ctx, migration, need):
    """Each population is checked INDIVIDUALLY BY NAME. A population the
    document's own state requires, but which is absent or empty, fails G15R
    for that population."""
    rows = []
    order = (("R1", "SRC2-base", True),
             ("R2", "SRC2-date-component", need["date"]),
             ("R3", "fragment-inventory", need["frag"]),
             ("R4", "BND-bundle", need["bnd"]),
             ("R5", "SM2-record", need["sm2"]),
             ("R6", "SS2-record", need["ss2"]),
             ("R7", "DISP-detail", need["disp"]),
             ("R8", "BLK-record", need["blk"]),
             ("R9", "RES-record", need["res"]),
             ("R10", "DR2-AMEND", need["amend"]),
             ("R11", "DR2-generic", True),
             ("R12", "dependent-references", True))
    for tag, pop, required in order:
        if pop == "DR2-AMEND":
            present = any((ctx.f("DR2-generic", r, "Type") or "").strip("`")
                          == "AMEND" for r in ctx.pop.get("DR2-generic", []))
            count = sum(1 for r in ctx.pop.get("DR2-generic", [])
                        if (ctx.f("DR2-generic", r, "Type") or "").strip("`")
                        == "AMEND")
        elif pop == "dependent-references":
            present, count = True, len(ctx.pop.get("XW2-edge", []))
        else:
            count = len(ctx.pop.get(pop, []))
            present = count > 0
        state = "present(%d)" % count if present else "ABSENT"
        if required and not present:
            ctx.problems.append("G15R/%s %s: required population is absent or "
                                "empty in a state that requires it" % (tag, pop))
            state = "FAIL(absent)"
        rows.append("%s %s=%s" % (tag, pop, state))
    ctx.notes.append("G15R enumerated populations: " + "; ".join(rows))


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
    actors, ap = parse_actor_registry(tree.canon, inv)
    problems += ap
    problems += check_plan(tree.plan)
    migration = parse_migration_state(tree.plan)

    ctx = Ctx(tree, inv)
    ctx.problems += problems
    ctx.notes += notes

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
    check_scenario_fragments(ctx, sxw2_edges, dr2, published)
    frags = check_fragments(ctx, [e for e in edges
                                  if e.get("register") != "SXW2"],
                            dr2, published, migration)
    check_bundles(ctx, frags, [e for e in edges
                               if e.get("register") != "SXW2"], dr2)
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
    check_blk_res(ctx, actors, sm2, ss2, frags)
    check_amend(ctx, dr2)

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

RES_ID = "RES-0001"
RES_BLK = "BLK-0001"
RES_OUTCOME = "out-of-scope-determination"
RES_AUTHORITY = "foundation adjudication (canon 15.9.3)"
RES_MAKER = "agent:claude-code"
RES_CHECKER = "agent:codex"
RES_REOPEN = "reopen on qualifying first-party operational provenance"
RES_LIMITS = "none"
RES_DIGEST = sha_hex("|".join([RES_BLK, RES_OUTCOME, RES_AUTHORITY, RES_MAKER,
                               RES_CHECKER, RES_REOPEN, RES_LIMITS]))


def _run(cwd, *args):
    r = subprocess.run(args, cwd=cwd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("%s failed: %s" % (args, r.stderr.decode()[:400]))
    return r.stdout


class ControlRepo(object):
    """A real temporary Git repository holding: the pinned published v1.1
    edition, the pinned R3 checkpoint, the live documents, and an independent
    acceptance receipt at its own commit."""

    def __init__(self, src_root):
        self.src = os.path.abspath(src_root)
        self.dir = tempfile.mkdtemp(prefix="cba-canon-control-")
        src_tree = Tree(self.src)
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

        # (3) the live documents, repinned onto this repository's commits
        self._clear()
        self.live = {CANON_REL: self._repin(src_tree.canon, v11, r3),
                     PLAN_REL: src_tree.plan}
        for rel, txt in sorted(src_tree.receipts.items()):
            self.live[rel] = txt
        self.restore()
        self.head = self._commit("live documents")

        # (4) the checker's independent acceptance receipt, at its own commit
        self._write(ACCEPT_RECEIPT_REL, acceptance_receipt_text())
        self.accept = self._commit("independent acceptance receipt")
        self.live[ACCEPT_RECEIPT_REL] = acceptance_receipt_text()

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


def acceptance_receipt_text():
    return (
        "# Control independent acceptance receipt\n\n"
        "This receipt is the checker-side evidence a `RES-…` resolution's\n"
        "`Acceptance commit` resolves to. It is a control artifact of the\n"
        "R2.10 validator, not a governed record of any repair unit.\n\n"
        "## Independent acceptance record\n\n"
        "| Resolution ID | Accepted RES version | Accepted content digest | "
        "Accepted proposed outcome | Maker/proposer identity | "
        "Independent checker identity | Acceptance verdict |\n"
        "|---|---|---|---|---|---|---|\n"
        "| %s | 1 | %s | %s | %s | %s | ACCEPT |\n"
        % (RES_ID, RES_DIGEST, RES_OUTCOME, RES_MAKER, RES_CHECKER))


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


def _bounds(length, n):
    return [round(i * length / float(n)) for i in range(n + 1)]


def build_r31_document(repo, published, inv):
    """Return (canon_text, plan_text, receipt_text) for a complete migrated
    R3.1 document tree built from the live documents."""
    canon = repo.live[CANON_REL]
    plan = repo.live[PLAN_REL]
    _h, xrows, _p = parse_canon_population(canon, inv, "XW2-edge")
    hdr_i = {f: i for i, f in enumerate(inv.schema["XW2-edge"])}
    terminal = set(inv.vocab["xw2-terminal-edge-type"])

    by_leaf = {}
    for r in xrows:
        by_leaf.setdefault(r[hdr_i["Historical v1.1 LEAF"]].strip("`"),
                           []).append(r)

    frag_rows, bnd_rows, edge_scope, edge_dec = [], [], {}, {}
    disp_rows, dr2_rows = [], []
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
            bundle = DASH
            if len(grp) >= 2:
                bundle = "BND-%04d" % (len(bnd_rows) + 1)
                mb = _bounds(b - a, len(grp))
                mscopes, mtypes, mtargets = [], [], []
                for mi, r in enumerate(sorted(grp, key=lambda x: x[0])):
                    mscopes.append("span:%d-%d" % (a + mb[mi], a + mb[mi + 1]))
                    mtypes.append(r[hdr_i["Edge type"]].strip("`"))
                    mtargets.append(r[hdr_i["Active v2 LEAF or —"]].strip("`"))
                bnd_rows.append(
                    "| %s | %s | %s | %s | %s | %s | %s | %s | active | "
                    "current | 1 | %s |"
                    % (bundle, leaf, fid, ", ".join(eids), ", ".join(mtypes),
                       ", ".join(mtargets), ", ".join(mscopes), span, DASH))
            frag_rows.append(
                "| %s | %s | %s | %s | %s | %s | %s | current | 1 | none |"
                % (fid, leaf, kind, span, decomp, bundle, ", ".join(eids)))
            for r in grp:
                eid = r[0]
                edge_scope[eid] = "[%s] %s — %s" % (
                    fid, span, r[hdr_i["Scope/relationship"]])
                etype = r[hdr_i["Edge type"]].strip("`")
                if etype in terminal:
                    did = "DR2-%04d" % next_dr2
                    next_dr2 += 1
                    edge_dec[eid] = did
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
                        "OWN/ATOM typing through AMEND lineage | %s | R3.1 "
                        "control / temporary tree |"
                        % (did, leaf, etype, fid, DASH))

    dr2_rows.insert(0,
                    "| %s | `ATOM` | Complete historical-LEAF decomposition for "
                    "the committed A-series crosswalk | Declared exhaustive "
                    "fragment inventories | Enumeration floor over the "
                    "normalized requirement text | Every historical source LEAF "
                    "is partitioned into fragments whose spans cover exactly "
                    "[0,L) | %s | R3.1 control / temporary tree |"
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
            "per canon 15.9.8 | Control scenario disposition | %s | R3.1 "
            "control / temporary tree |" % (did, sname, etype, fid, DASH))

    amend = "DR2-%04d" % next_dr2
    next_dr2 += 1
    dr2_rows.append(
        "| %s | `AMEND` | DR2-0037, DR2-0038, DR2-0039 (committed terminal "
        "dispositions) | Superseded by the current DISP records minted above; "
        "every live terminal-edge reference updated in the same commit | "
        "AMEND lineage per canon 15.9.2 | The committed OWN/ATOM terminal "
        "typing is retroactively mistyped and is superseded, never renumbered "
        "or reused | %s | R3.1 control / temporary tree |" % (amend, DASH))

    # -- rewrite the canon: SRC2 tables, XW2 rows, and the SXW2 section
    canon = _rewrite_src2(canon, inv)
    canon = _rewrite_xw2(canon, inv, edge_scope, edge_dec)
    canon = _add_sxw2_section(canon, sxw2_rows)

    plan = plan.replace(
        "- **Status:** not started. Blocked until the independent Codex review\n"
        "  of the R2.10 foundation returns ACCEPT",
        "- **Status:** executed (R3.1 control tree). Blocked until the "
        "independent Codex review\n  of the R2.10 foundation returns ACCEPT",
        1)

    receipt = _r31_receipt(dr2_rows, disp_rows, frag_rows, bnd_rows,
                           sfrag_rows)
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
    block = ("### 15.13 Scenario crosswalk (R3.1 control population)\n\n"
             "Typed edges from the pinned published historical scenarios to "
             "active v2 scenarios, per canon 15.9.8.\n\n"
             + _table(["Edge ID", "Historical scenario",
                       "Active v2 scenario or " + DASH, "Edge type",
                       "Scope/relationship", "Decision record"], sxw2_rows)
             + "\n")
    lines = canon.splitlines(keepends=True)
    for i, ln in enumerate(lines):
        if ln.startswith("## 16. Acceptance-test library"):
            lines.insert(i, block)
            break
    return "".join(lines)


def _r31_receipt(dr2_rows, disp_rows, frag_rows, bnd_rows, sfrag_rows):
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
    res = ["| %s | %s | %s | %s | %s | %s | @ACCEPT_COMMIT@ | %s | 1 | %s | "
           "%s | accepted | 1 | %s | %s | %s |"
           % (RES_ID, RES_BLK, RES_OUTCOME, RES_AUTHORITY, RES_MAKER,
              RES_CHECKER, ACCEPT_RECEIPT_REL.replace(os.sep, "/"),
              RES_DIGEST, RES_OUTCOME, RES_REOPEN, RES_LIMITS, DASH)]
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
           "This document exists only inside the R2.10 validator's temporary "
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
                "Normalized fragment scope", "Decomposition decision record",
                "Disposition bundle ID or " + DASH, "Disposition edge ID(s)",
                "Fragment status", "Fragment version", "Limitations or " + DASH]
    sec("Fragment inventory", frag_hdr, frag_rows)
    sec("Scenario fragment inventory", frag_hdr, sfrag_rows)
    sec("Disposition bundles", ["Bundle ID", "Source historical LEAF",
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
                        "Acceptance commit or " + DASH,
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
    """The two complete document sets every case starts from."""
    base = dict(repo.live)
    inv, _ = parse_inventory(base[CANON_REL])
    published = Published(repo.dir, inv.commits["published-v1.1"])
    canon, plan, receipt = build_r31_document(repo, published, inv)
    receipt = receipt.replace("@ACCEPT_COMMIT@", repo.accept)
    r31 = dict(base)
    r31[CANON_REL] = canon
    r31[PLAN_REL] = plan
    r31[R31_RECEIPT_REL] = receipt
    return base, r31, inv, published


R3_RECEIPT_REL = os.path.join(
    "work", "architect-completion",
    "ARCHITECT_CBA_CANON_V2_R3_A_SERIES_CERTIFICATION.md")


def run_cases(repo):
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
                   "high-water mark | CBA | SCEN | — | EV2-0090 | new | "
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
    print("Architect CBA canon v2.0 foundation validator (R2.10)")
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

    repo = None
    failures = 0
    try:
        repo = ControlRepo(root)
        results, self_test_ok = run_cases(repo)
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
