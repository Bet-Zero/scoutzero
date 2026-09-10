---
name: independent-review-boundary.md
description: Owner-set division of labor between ScoutZero author agents and independent reviewers.
---

# Independent Review Boundary

Owner decision: 2026-09-10.

This guide clarifies the ScoutZero maker/checker model. Independent review is required where the governing workflow requires it, but the reviewer is a checker, not a second author. This guidance narrows reviewer scope without weakening source qualification, Canon correctness, privacy, candidate freeze, owner gates, or required verdicts.

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

## Usage-limit behavior

Reviewer unavailability or rate limits do not authorize self-acceptance, weaker evidence standards, repeated relaunch loops, billing changes, provider/account switching, or rebuilding a frozen candidate. Preserve the exact checkpoint and continue only authorized author-side work that does not depend on the unfinished review. Resume the focused review when access returns.

## Current application

For BZE-309, the pending June 5 holder correction is a focused semantic/adversarial delta review. Claude should judge whether the proposed holder closures and resulting accounting are justified, inspect targeted underlying evidence, and challenge continuity assumptions. It should not repeat the full v12/v13 author reconstruction unless it finds a concrete reason that targeted review is insufficient.
