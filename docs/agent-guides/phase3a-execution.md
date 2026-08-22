---
name: phase3a-execution.md
description: Accepted maker/checker execution profile for Architect Phase 3A lanes.
---

# Architect Phase 3A Execution Profile

This is the standing lane profile for Phase 3A Canon-correctness and its
execution tooling. `AGENTS.md` remains the repository-wide contract;
`docs/agent-guides/architect-boundary.md` remains the product boundary.

## Authorities

- Accepted Canon candidate:
  `6cf8aaf358c158a88e630e8a7336f7e9c3febc17`.
- Durable accepted-authority ref:
  `refs/remotes/origin/architect/cba-canon-v2`. If it is absent, fetch only that
  ref using the exact instruction printed by the lookup command.
- Accepted Canon artifact:
  `docs/reference/cba/ARCHITECT_CBA_CANON.md` at that candidate only.
- Accepted Canon SHA-256:
  `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`.
- Phase 2 audit summary: the artifact at commit
  `4b21456d491f9593edc2961afae47ef64ae28e32`.
- Phase 2 exact 815-leaf gap register: the artifact at commit
  `19dc84fc4050ce9cf749136dae1f9854adc72ef7`.
- Phase 3A program record: Linear BZE-267 and its live child lane.

The working-tree Canon is not an authority fallback. Use
`npm run architect:canon:lookup -- <CBA2-LEAF>`; the command reads the pinned
git object, verifies the candidate and fingerprint, and fails closed before
printing content if any authority check fails.

## Tranche selection

Select the largest coherent, independently reviewable workflow or Canon family
supported by common inputs and lifecycle. Do not create arbitrary one-leaf
tranches when the adjacent obligations share the same inputs, state transition,
and review proof. Keep distinct workflows separate when combining them would
blur authority, validation, or landing decisions.

Before candidate freeze, derive a focused failure-testing matrix from the
tranche's declared risk contract. Cover the realistic ways that specific change
could incorrectly authorize, calculate, mutate, persist, or report a result;
do not impose one enormous generic mutation checklist on unrelated work. Repair
every author-known suspicion or resolve it with evidence that discriminates the
suspected failure from the intended behavior. An unresolved concern means the
candidate is not ready for freeze or independent review.

## Preflight and declared risk contract

Verify live state; never inherit SHAs or statuses from a prior conversation.

1. Verify clean `main`, `origin/main`, their equality or explained divergence,
   and the proposed branch ancestry.
2. Hosted required CI passing on the exact clean synchronized `origin/main` SHA
   satisfies ordinary green-main preflight. Run a local main check only when a
   concrete known risk, unavailable hosted receipt, or stale signal justifies it.
3. Read BZE-267, the proposed child, relevant parent/foundation issues, their PR
   evidence, and the accepted Canon/audit authority for the selected scope.
4. Before implementation, record a risk class and the intended author, hosted
   CI, independent-review, browser/emulator, and landing checks. Expand the
   contract only when a newly discovered risk explains why.
5. Create one BZE-267 child, one BZE-numbered branch, and one PR. The live child
   is the sole High / In Progress execution lane.

For source-blocked work, record the exact missing field, controlling authority,
last authority-gate check and result, and the event that would unblock it. On
retry, run the authority gate first. Do not repeat implementation preflight
until the authority gate changes.

When a mutable external source will become governed authority, its bytes must
be durable before its fingerprint can be certified or used as an implementation
pin:

1. Retrieve the source twice and confirm that both retrieves have identical
   bytes.
2. Retain those exact bytes in the governed content-addressed location.
3. Recompute and verify the hash and size from the retained copy.
4. Verify that the retained copy is independently recoverable.
5. Only then present its fingerprint for owner certification or use it as an
   implementation pin.

If the exact bytes are not already retained and recoverable, stop the authority
gate before owner certification. A hash or retrieval receipt without retained
bytes cannot authorize runtime behavior.

## Validation responsibilities

| Actor                       | Distinct responsibility                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Author                      | Risk-contract-specific failure matrix, focused implementation tests, and discriminating positive/fail-closed proof before freeze. |
| Automated review            | Review the draft early. Finish each started review and settle its findings before freeze; record optional-reviewer unavailability without waiting indefinitely. |
| Hosted CI                   | Established domain, static, project-validation, and build checks on the exact candidate.                                       |
| Independent Claude reviewer | Canon judgment, adversarial probes, test non-vacuity, limitations, and exact base/head scope. The reviewer chooses the probes. |
| Browser/emulator            | Only rendered, persistence, or cross-room risks. Use deterministic governed fixtures and retain exact-candidate evidence.      |
| Landing                     | Exact candidate, ancestry, synchronization, unresolved threads, records, and limitations. Do not repeat implementation suites. |

Automated reviewers are useful best-effort signals, not evidence of Canon
correctness. An optional reviewer being unavailable or rate-limited does not
block the lane indefinitely, but the PR must record that fact. Every finding
that an available reviewer does produce must be resolved or disproved before
candidate freeze. A review that has started but remains pending is not settled.

## Candidate freeze and evidence reuse

Open the draft PR as soon as it has a reviewable diff. Start available automated
review while author work and self-review are still underway. Before candidate
freeze:

1. Complete the focused author failure-testing matrix and resolve every
   author-known concern with discriminating evidence.
2. Let every started available automated review complete, then resolve or
   disprove every finding it produced.
3. Record any optional reviewer that was unavailable or rate-limited instead of
   waiting indefinitely.
4. Declare the candidate frozen only when author review is complete, every
   started automated review has completed or is recorded unavailable, and all
   available automated-review findings are settled.

Draft PR checks may start automatically before freeze, but only the green hosted
CI receipt for the frozen final head counts as required evidence. After freeze,
confirm that exact-head CI and any declared browser/emulator proof. Only then
generate the immutable independent-Claude prompt. Any subsequent head change
invalidates that prompt and requires a replacement prompt for the new exact head
after the applicable author, automated-review, and hosted-CI gates are satisfied
again.

Associate every receipt with the exact candidate SHA. Reuse unaffected evidence
while the SHA is unchanged.

After a narrow repair, require discriminating repair tests, affected risk checks,
exact-head CI, and delta-focused independent re-review. Do not reconstruct
untouched accepted evidence without a concrete reason. If the repair changes the
candidate, any evidence that depends on the changed surface is stale; unaffected
evidence remains usable when its scope is stated.

Reviewers can run a temporary, independently authored TypeScript probe without
changing the source worktree:

```bash
npm run review:probe -- \
  --candidate <exact-40-character-sha> \
  --fixture /tmp/reviewer-probe.ts
```

The helper exports an exact git archive, copies the reviewer fixture into that
temporary snapshot, points Firebase variables only at the local demo emulators,
removes common production credential variables, and deletes the snapshot after
the run. It supplies setup, not cases or judgment. For speed it shares the
checked-out `node_modules`; it fails when the candidate and checked-out
`package-lock.json` differ, but cannot prove that the installed tree is fresh.
Run `npm ci` against the checked-out lockfile when dependency freshness matters.

For the first permanent rendered path, run:

```bash
npm run architect:proof:trade-receipt
```

It requires a clean frozen HEAD and runs the deterministic MIA/DEN Trade
Machine/Trade Receipt proof at 1280×720. The harness creates exactly one
emulator-only governed proof world, demonstrates the changed receipt surface,
and verifies that validation creates no additional world. It retains a
screenshot, trace, HTML report, proof record, and SHA-bearing manifest under
`tmp/browser-proofs/trade-receipt/<candidate>-<timestamp>/`, then verifies that
all harness ports are closed. These are ignored local/PR-session artifacts; no
hosted retention is claimed until a future, separately scoped CI artifact
change.

## Evidence hub and status conventions

The PR is the detailed evidence hub. Its description or exact-head comments
record base/candidate SHAs, risk class, declared and performed checks, hosted
checks, independent verdict, browser result or justified skip, skipped checks,
known limitations, repair/evidence-reuse notes, and merge eligibility.

Linear receives concise linked receipts: status, PR, accepted candidate, landed
commit, validation summary, Canon accounting, and remaining scope. Do not paste
the full PR narrative into Linear or the final handoff.

Linear's GitHub automation advances every issue linked to an open PR, including
non-closing `Refs` links. Therefore:

- use `Fixes BZE-XXX` for the active child that should close on merge;
- use `Refs BZE-XXX` only for another still-active issue whose status is intended
  to participate in that PR lifecycle;
- never use a magic word, issue ID in the branch/title, or another PR link for a
  completed foundation issue;
- preserve completed-foundation traceability with a descriptive Markdown link
  in a `Foundation context` section, without a magic word.

If vendor automation still moves a completed foundation, restore it to Done,
record the triggering PR, and do not alter its implementation.

## Landing decision

An objective Canon-correctness or workflow tranche may land automatically only
when all of these remain true:

- candidate unchanged since the accepted review;
- required exact-head hosted CI green;
- independent Claude verdict `ACCEPT`;
- no unresolved review thread;
- no product decision or limitation requires owner judgment; and
- base/head, clean state, and ancestry checks pass.

Stop for owner judgment for subjective UI decisions, source-authority ambiguity,
scope expansion, failed required QA, or material architecture/data concerns.
Do not recast those concerns as tooling limitations to bypass the stop.

## Fresh-session reconstruction

A fresh session reads `AGENTS.md`, this profile, and the Architect boundary;
verifies live git state; reads BZE-267 and its live child plus linked PR evidence;
uses the pinned Canon lookup for selected leaves; then declares the lane's risk
contract before making changes. Conversation memory is never an authority.
