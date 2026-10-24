---
name: independent-review-boundary.md
description: Owner-set division of labor between ScoutZero author agents and independent reviewers.
---

# Independent Review Boundary

Owner decision: 2026-09-10.

This guide clarifies the ScoutZero maker/checker model. Independent review is required where the governing workflow requires it, but the reviewer is a checker, not a second author. This guidance narrows reviewer scope without weakening source qualification, Canon correctness, privacy, candidate freeze, owner gates, or required verdicts.

## When review is required

Use the three execution levels in [AGENTS.md](../../AGENTS.md). Isolated local
cosmetic or ordinary content changes have no routine independent Claude gate.
For ordinary behavior, the agent decides from consequences, complexity and
uncertainty; record the reason briefly. Consequential changes (including this
validation policy, financial/legality logic, persistence, shared state,
authorization, integrity and source qualification) retain independent review.
Mixed changes inherit the strongest relevant obligation. A label never waives it.
These rules do not replace any existing owner approval or production boundary.
The detailed invocation/freeze requirements below apply when review is required.

## Author responsibilities

The authoring agent (normally Codex) owns the complete deterministic execution path for the assignment, including:

- authorized source acquisition and retention;
- extraction, parsing, normalization, mapping, and builders;
- hashing, preservation, recovery checks, and deterministic replay;
- full membership, lineage, accounting, and consistency checks;
- author failure matrices and routine mechanical validation;
- preparing a concise claim/delta map and direct evidence locators for review.

The author must finish and validate that work before asking an independent reviewer to judge it. Author evidence is not independent acceptance.

## Independent reviewer responsibilities

The independent reviewer (normally a fresh Claude session) verifies the author's material conclusions rather than reproducing the author's entire pipeline.

The reviewer should:

- judge whether changed or material conclusions are justified by the cited evidence;
- challenge assumptions, especially unsupported promotion and unjustified withholding;
- inspect the exact underlying evidence needed for disputed, high-risk, or sampled claims;
- check relevant accepted Canon interpretation when the conclusion depends on it;
- choose targeted adversarial probes or spot checks sufficient to establish independence and non-vacuity;
- verify that the changed accounting and downstream conclusions follow from accepted findings;
- identify limitations and return the required verdict.

The reviewer may expand its checks when a concrete concern is discovered. That expansion should follow the identified risk rather than be the default assignment.

## What independent review should not do by default

Do not ask the reviewer to:

- rerun the author's complete extraction/build/replay/test pipeline;
- re-authenticate every unchanged artifact in the historical corpus;
- reconstruct all previously accepted evidence merely because a fresh review is required;
- repeat broad deterministic checks that the author already ran and that are not material to independent judgment;
- consume reviewer context or tool usage in proportion to the entire corpus when the changed risk surface is narrow.

A full independent reconstruction is reserved for a concrete integrity, determinism, provenance, source-recovery, or contradiction risk that cannot be resolved by a smaller discriminating check. Record that reason before incurring the larger review cost.

## Delta reviews

After an in-scope repair, scope the reviewer to:

1. the changed conclusions or outputs;
2. affected accounting and lineage;
3. unresolved findings from the prior review;
4. a small independently chosen sample of underlying evidence; and
5. any newly introduced risk.

Reuse unaffected accepted evidence with its dependencies, scope, and limitations stated. Do not turn a narrow repair into a full historical re-review.

## Review handoff format

A reviewer handoff should be compact and decision-oriented. Provide:

- exact frozen candidate identity;
- base or accepted predecessor;
- changed claims and affected IDs/decisions;
- direct evidence locators for those claims;
- author checks already completed;
- specific material questions the reviewer must judge;
- known limitations and unresolved prior findings;
- explicit instruction that the reviewer chooses its own targeted spot checks and may widen only when a concrete concern warrants it.

Do not make the reviewer ingest or replay the full corpus when a claim/delta map and direct locators are sufficient.

## Automated invocation route

When `.github/workflows/claude-independent-review.yml` is available and the governing workflow requires a fresh Claude review, the author invokes the checker directly instead of asking the owner to relay prompts or verdicts.

1. Finish author work, settle author/automated findings, push, and freeze the exact candidate.
2. Post one immutable PR comment whose first line is exactly:
   `/claude-independent-review <candidate-sha> <base-sha>`
   Put the compact handoff described above in the remainder of that same comment.
3. The workflow must verify the live PR head and preserved base against those exact SHAs before using the Claude credential. A stale or malformed request fails closed. The request actor must also have live repository admin/write permission.
4. Claude runs in a credential-protected review workspace: the trusted preserved base stays at the workspace root, neither checkout persists its GitHub token and the action uses its token-free credential-helper path for the already-verified writer, the candidate is isolated as untrusted review material, and candidate-owned commands/config are never executed in the credentialed checker job. Claude performs read-only adversarial inspection and returns validated structured `ACCEPT` or `REVISE` output; when a material concern needs dynamic execution beyond retained author/CI evidence, it returns `REVISE` with the exact discriminating proof required. The official v1 action is pinned to the full commit covered by its credential-boundary proof; deliberately re-verify that boundary before updating the pin. A separate non-Claude step publishes the complete verdict receipt to the PR.
5. The publisher locally validates the complete structured-output contract, including every required field, value type, enum and additional-property restriction. Malformed output or `ACCEPT` with blocking findings is invalid; unknown severity values (including `critical`) cannot bypass the gate. It re-fetches head/base immediately before publishing and again afterward before green completion; a change during publication replaces the provisional receipt with a stale result. Only a green independent-review workflow with `ACCEPT` for the unchanged exact candidate satisfies the required reviewer gate. `REVISE`, execution failure, invalid/missing output, or identity mismatch does not.
6. After an objective repair, freeze the replacement candidate and post a new request. Preserve the old request and verdict as historical evidence; never edit them into acceptance.

Routine maker/checker handoffs through this route require no owner relay. Owner input remains necessary only for genuine product, source-policy, permission, legal, billing, or other owner-reserved decisions. If the workflow or Claude access is unavailable, follow the usage-limit behavior below rather than substituting a reviewer.

Only the separate receipt jobs have `pull-requests: write` for PR comments. They have no checkout or Claude credential. The credentialed checker remains read-only; a completed Claude session without a successfully published receipt and green workflow does not satisfy the gate.

### Withheld report handling

The checker classifies its fresh local result before export without logging its
content. A match against the checker's known credentials or credential-shaped
material rejects the report. Only fixed failure categories may be logged or
published. This is an additional rejection check, not a complete secret scanner
or a replacement for GitHub's native job-output filter. A clear local check does
not establish that a later native-filter rejection was a false positive.

The original complete action output must still cross the native filter and pass
the publisher's strict schema and live-identity checks. Never reconstruct a
withheld report from fragments, encode it, recover it through an artifact, redact
findings into acceptance, or move publication into the credentialed checker. An
unavailable report remains an unsatisfied review gate. The fixed failure category
and runner warning identify the next discriminating investigation; they do not
authorize repeated unchanged review attempts.

The BZE-321 public control run
[38399923259](https://github.com/Bet-Zero/scoutzero/actions/runs/38399923259)
passed JSON, header names, variable names, identity claims and public file paths
through native job outputs while suppressing a deliberately masked synthetic
marker. This rules out a general JSON/terminology transport failure. It does not
identify the match in either previously withheld Claude report, whose contents
were not recovered. The pinned action's OAuth/provided-GitHub-token path does not
use its federation-token refresh or app-token exchange, so the late-federation-mask
hypothesis in upstream issue 1883 is not established for ScoutZero.

A second discriminating
[control run 38402107657](https://github.com/Bet-Zero/scoutzero/actions/runs/38402107657)
reproduced native withholding with deliberately invalid JWT-shaped and
GitHub-token-shaped fixtures that were never registered as credentials. Ordinary
controls still passed, and the masked negative control was still suppressed.
The reviewer must describe such fixtures by public file and line rather than
copying their bytes. This preserves full findings and native filtering; it does
not establish which string matched in the historical reports. The additive check
rejects token-shaped report content explicitly rather than silently losing the
complete verdict at the later boundary.

## Usage-limit behavior

Reviewer unavailability or rate limits do not authorize self-acceptance, weaker evidence standards, repeated relaunch loops, billing changes, provider/account switching, or rebuilding a frozen candidate. Preserve the exact checkpoint and continue only authorized author-side work that does not depend on the unfinished review. Resume the focused review when access returns.

## Historical application

The September BZE-309 June 5 holder correction illustrated a focused
semantic/adversarial delta review: judge the proposed closures and accounting,
inspect targeted evidence, and challenge continuity assumptions without
repeating the full v12/v13 author reconstruction absent a concrete concern.
That example is not a pending assignment. Read
[BZE-309](https://linear.app/bzero/issue/BZE-309) for current evidence obligations
and [BZE-243](https://linear.app/bzero/issue/BZE-243) for the current product
completion position and next authorized outcome.
