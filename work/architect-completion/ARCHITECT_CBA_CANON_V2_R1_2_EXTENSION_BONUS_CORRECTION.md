# Architect CBA Canon v2.0 — R1.2 Receipt: Extension-Bonus Allocation Branch

## Provenance

| Field | Value |
|---|---|
| Repair unit | R1.2 — the omitted CBA VII §3(b)(3)(ii) extension-bonus allocation branch, ordered by the independent Codex foundation review of R1.1/R2.1/R2.2 |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | `6aa616fd646c620183c8458919a69bc30044cff5` (R2.2 checkpoint = origin at session start; R2.1 = `05c1b28e…`; R1.1 = `1532c928…`; R2 = `056b9d02…`; R1 = `af931e90…`; `main` = `origin/main` = `69f8f6b6…`) |
| Ordering review | The independent Codex foundation review of the combined R1.1/R2.1/R2.2 foundation at `6aa616fd`, which returned **REJECT/BLOCK-R3** and ordered R1.2 (this unit) and R2.3 (the next separate unit) as bounded repairs with separate checkpoints |
| Scope | The §3(b)(3)(ii) missing-branch correction only. R2.3, R3–R9, Phase 2, and W1.1 not started |
| Edition status after R1.2 | Canon v2.0 **working draft** — not accepted, not active; v2.0 checksum deliberately **not** computed (R8) |

Files changed in R1.2 — exactly three:
`docs/reference/cba/ARCHITECT_CBA_CANON.md` (the §5.9 extension-bonus
bullet, the header "What v2.0 changes" paragraph, and one new amendment-log
row), `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
(the R1.2 unit plus status/sequencing reconciliation), and this receipt.
Nothing else. The R1, R1.1, R2, R2.1, and R2.2 receipts are untouched
immutable review history.

## Formal finding being repaired

The independent Codex foundation review found that canon §5.9 and the
immutable R1.1 receipt omitted one branch of signed CBA VII §3(b)(3)(ii):
when the extending team's Team Salary is below the Salary Cap and the
Extension calls for the signing bonus to be paid **no sooner than** the
first day of the first Salary Cap Year covered by the extended term, the
bonus is allocated under §3(b)(3)(i)'s extended-term-only proration rules
(the lack-of-skill-protected-percentage basis over the extended term's
Salary Cap Years; zero protection → the extended term's first Salary Cap
Year) — never under ordinary §3(b)(2) signing-bonus allocation. The R1.1
receipt's §3(b)(3)(ii) summary described only the early-payment branch
("if paid before the extended term: (A)…(B)…(C)…") and therefore
**overclaimed completeness**; this receipt corrects that overclaim without
rewriting the historical review evidence — the R1.1 receipt itself is not
edited.

## Shared source artifact (re-verified and read directly this session)

| Field | Value |
|---|---|
| Source title / edition | 2023 NBA–NBPA Collective Bargaining Agreement (signed agreement; 2023 edition) |
| Official URL | <https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf> |
| Retrieval timestamp | 2026-07-15T09:27:54Z |
| Byte count (recomputed) | 2,850,534 bytes — matches the previously verified artifact |
| Page count (recomputed) | 676 PDF pages (printed page = PDF page − 24) — matches |
| SHA-256 (independently recomputed) | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` — matches |
| Verifier / session / date | Claude (R1.2 repair session on `architect/cba-canon-v2`), July 15, 2026 |
| Committed? | **No.** The PDF was downloaded to the session scratchpad only; the hash-plus-citation chain above is the durable evidence |

Passages read verbatim this session before editing: CBA VII §3(b)(1)–(2)
(printed pp. 200–201); VII §3(b)(3)(i)–(ii) including (ii)(A)–(C) (printed
pp. 201–203); VII §3(b)(3)(iii)–(iv) (printed pp. 203–205); VII §3(b)(3)(v)
(printed p. 205); the surrounding VII §3(a)(2) text on printed pp. 199–200
incidentally to locating §3(b).

## Controlling locator and passage

**Locator:** CBA VII §3(b)(3)(ii), second sentence, printed p. 201 (PDF
page 225).

**Controlling text (read this session):** "*A Team with a Team Salary
below the Salary Cap may enter into an Extension that calls for or
contains a signing bonus to be paid at any time during the Contract's
original or extended term. In the event that a Team with a Team Salary
below the Salary Cap enters into an Extension that calls for or contains a
signing bonus to be paid no sooner than the first day of the Salary Cap
Year covered by such extended term, the bonus shall be allocated in
accordance with the proration rules set forth in Section 3(b)(3)(i)
above.*" The third sentence then opens the early-payment branch: "*In the
event a Team with a Team Salary below the Salary Cap enters into an
Extension that calls for or contains a signing bonus to be paid prior to
the first day of the first Salary Cap Year covered by the extended term,
the following rules shall apply:*" followed by (A)–(C) (printed
pp. 201–203).

The incorporated proration rules, §3(b)(3)(i) (printed p. 201): the bonus
"*shall be allocated, in equal parts, over the number of Salary Cap Years
covered by the extended term in proportion to the percentage of Base
Compensation in each such Salary Cap Year that, at the time of allocation,
is protected for lack of skill. In the event that, at the time of the
allocation, none of the Base Compensation provided for during the extended
term is protected for lack of skill, then the entire amount of the signing
bonus shall be allocated to the first Salary Cap Year of the extended
term.*"

## Passage-to-rule mapping

| Passage element | Canon rule it creates |
|---|---|
| "A Team with a Team Salary below the Salary Cap … enters into an Extension" | The branch trigger's cap-status condition is measured when the team enters into the Extension |
| "a signing bonus to be paid no sooner than the first day of the Salary Cap Year covered by such extended term" | The branch trigger's timing condition: payment on or after the extended term's first day (the third sentence's "prior to the first day of the first Salary Cap Year covered by the extended term" fixes the same boundary from the other side, confirming the fork is at the extended term's first day) |
| "shall be allocated in accordance with the proration rules set forth in Section 3(b)(3)(i) above" | §3(b)(3)(i)'s **extended-term-only** allocation governs — not §3(b)(2), and not the (A)–(C) combined-term rules |
| §3(b)(3)(i): "in proportion to the percentage of Base Compensation in each such Salary Cap Year that, at the time of allocation, is protected for lack of skill" | The protected-**percentage** allocation basis over the Salary Cap Years covered by the extended term |
| §3(b)(3)(i): "none of the Base Compensation provided for during the extended term is protected for lack of skill, then the entire amount … to the first Salary Cap Year of the extended term" | The zero-protection fallback collapses the allocation to the extended term's first Salary Cap Year |

## Three-way branch table (canon §5.9 after R1.2)

| Branch | Trigger (cap status at Extension + payment timing) | Allocation span | Basis | Zero-protection fallback | Extra rules | Authority |
|---|---|---|---|---|---|---|
| (1) At/over cap | Team Salary at or over the Salary Cap; the bonus must be paid no sooner than the extended term's first day | Extended term only | Lack-of-skill-protected percentage of Base Compensation per year | Extended term's first Salary Cap Year | — | VII §3(b)(3)(i), p. 201 |
| (2) Below cap, paid on/after the extended term's first day **(added by R1.2)** | Team Salary below the Salary Cap; bonus to be paid no sooner than the first day of the first Salary Cap Year covered by the extended term | Extended term only (per §3(b)(3)(i)'s proration rules, incorporated by reference) | Same protected-percentage basis | Extended term's first Salary Cap Year | Ordinary §3(b)(2) allocation does **not** govern | VII §3(b)(3)(ii), second sentence, p. 201 |
| (3) Below cap, paid before the extended term begins | Team Salary below the Salary Cap; bonus to be paid prior to the first day of the first Salary Cap Year covered by the extended term | Then-current + remaining original-term years + extended term | Same protected-percentage basis | The Salary Cap Year in which the Extension is signed | Deemed a Renegotiation; two mandatory installments (original-term portion before the extended term; extended-term portion on/after its first day) | VII §3(b)(3)(ii)(A)–(C), pp. 201–03 |

All three branches are stated distinctly in the corrected §5.9 bullet; the
canon text expressly forbids collapsing them into one rule.

## §3(b)(2) not incorrectly substituted

The corrected canon text states expressly that ordinary §3(b)(2)
signing-bonus allocation does **not** govern the added branch. The signed
text routes the branch to "*the proration rules set forth in
Section 3(b)(3)(i) above*" — not to §3(b)(2) — and the §5.9 lead sentence
continues to state that ordinary signing bonuses, trade-earned bonuses,
and extension bonuses are three distinct allocation regimes. The practical
difference is verified against the text: §3(b)(2) would allocate over the
Salary Cap Years covered by the whole Contract with a zero-protection
collapse to the Contract's **first** Salary Cap Year, while the corrected
branch allocates over the **extended term only** with a zero-protection
collapse to the **extended term's first** Salary Cap Year.

## Adjacent-provision check

Read this session to distinguish every timing/cap-status branch:

- **VII §3(b)(2), printed pp. 200–201** — the ordinary and trade-earned
  allocation regimes (unchanged; re-verified so the "does not govern"
  statement is accurate).
- **VII §3(b)(3)(i), printed p. 201** — the incorporated proration rules;
  also the at/over-cap branch's own payment-timing requirement.
- **VII §3(b)(3)(ii)(A)–(C), printed pp. 201–203** — the early-payment
  branch: combined-term allocation, deemed Renegotiation, and the two
  mandatory installments (re-verified unchanged; the existing canon
  statement was correct).
- **VII §3(b)(3)(iii)–(iv), printed pp. 203–205** — trade-earned bonus
  (§3(b)(1)(ii)) allocation where an Extension disclaims or retains the
  original trade-bonus provision. These govern trade-earned bonuses
  interacting with Extensions, not the extension signing bonus itself;
  they remain cited-as-adjacent only and stay in the R5 registration queue
  per the R1.1 receipt's recorded limitation.
- **VII §3(b)(3)(v), printed p. 205** — coordination of §3(b)(3)(i),
  (ii)(C), and (iv) installment amounts with Article II §7(c) deemed
  amendments. It adjusts payment amounts after deemed amendments; it
  creates no additional allocation branch and is noted here as adjacent
  context only.

No further §3(b)(3) branch was found beyond the three now stated; the
signed text supports the ordered correction exactly, so the stop condition
was not triggered.

## Canon locations changed

1. **§5.9 extension-bonus bullet** — rewritten as the explicit three-branch
   statement above. The previously correct content (the three-regimes lead
   sentence, the §3(b)(3)(i) branch, and the §3(b)(3)(ii)(A)–(C)
   early-payment branch including the deemed-Renegotiation and
   two-installment rules) is preserved; the below-cap/on-or-after branch is
   added with its trigger, the §3(b)(3)(i) incorporation, the
   protected-percentage basis, the zero-protection fallback, and the
   express §3(b)(2) exclusion.
2. **Header "What v2.0 changes" paragraph** — one sentence recording R1.2.
3. **Amendment log** — one new R1.2 row.

No other canon text changed. Scenario 69's lack of a discriminating
before/after-5:00-p.m. ETO case (a separate Codex observation) is
**deferred to R7** and was not touched.

## Confirmations

- **R1.1 receipt not edited:** `git diff` for this unit touches exactly the
  three authorized files; `ARCHITECT_CBA_CANON_V2_R1_1_CORRECTIONS.md` and
  every other prior receipt are byte-unchanged. This receipt corrects
  R1.1's completeness overclaim in prose here, not by rewriting the
  historical record.
- **No scenario text changed:** the §16 section (scenarios 1–89 and all
  §16 headings) is byte-identical to the R2.2 checkpoint (verified by
  section hash, recorded in the R1.2 report).
- **No historical register row changed:** §15.1–§15.8 byte-identical to the
  R2.2 checkpoint.
- **Canon §15.9 not changed:** §15.9–§15.9.10 byte-identical to the R2.2
  checkpoint.
- **No concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record created** — the
  namespaces remain defined-only.
- **No application code, tests, schemas, fixtures, configuration, data,
  code map, or README changed; Linear not read or written.**
- **`main` unchanged** (`69f8f6b6…` before and after).

## Validation performed (R1.2)

- **Baseline verified before work:** HEAD = `origin/architect/cba-canon-v2`
  = `6aa616fd646c620183c8458919a69bc30044cff5`; `main` = `origin/main` =
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`; working tree, index, and
  untracked state clean; ahead/behind 0/0.
- **Source artifact re-verified:** byte count, page count, and SHA-256
  independently recomputed this session and matched (table above).
- `git diff --check`: clean (no whitespace errors).
- `npm run lint:md`: **exits 1** — pre-existing findings only: the
  accepted MD029 continuous-numbering class in canon §16 plus pre-existing
  errors confined to unrelated documentation files. A before/after
  markdownlint comparison on the three changed files shows **zero new
  findings introduced by R1.2**: the canon's 74-finding MD029 set is
  identical before and after by file, rule, and expected/actual values
  (line positions shifted by exactly the one amendment-log row added above
  §16), and the repair plan and this receipt lint clean. The global exit
  code is reported truthfully as a failure caused by pre-existing
  findings, not claimed as a pass.
- `npm run docs:guardrails`: pass.
- No app tests run (documentation-only change per repair-plan global
  rule 6).

## Boundaries

R1.2 corrected the one omitted §3(b)(3)(ii) branch and the minimal
amendment/status surfaces recording it. **R2.3 — the ordered standards
corrections — is the next separate repair unit and was not started.** R3
remains blocked until R1.2 and R2.3 both receive another independent Codex
foundation review. R3–R9, Phase 2, W1.1, register construction, scenario
edits, code-map, README, application, test, data, and Linear work were not
performed. The CBA PDF was not committed.
