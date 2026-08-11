# Governed Contract Baseline Lifecycle

**Scope:** the BZE-274 operational boundary for retained contract-source
releases and worlds pinned to them.

## Release retention

Trusted Functions package every retained contract-source JSON artifact and keep
an append-only descriptor registry keyed by exact release ID and version. The
last retained descriptor is the default only for new-world initialization.
Adding a later default does not replace or remove an earlier release.

Every exact lookup verifies the release ID, version, artifact digest, declared
release digest, and supersession chain. An unavailable, malformed, or
digest-mismatched release fails closed.

## World consistency

Fresh-world `currentSeason` and `baselineSeason` come from the governed Salary
Cap Year (`2026` maps to `2025-26`). `asOfDate` comes from the release effective
instant. A supplied season is accepted only when it matches the governed mapping
exactly; the runtime clock is never a source.

Branching resolves the parent world's exact retained release. Child metadata,
baseline shards, source pin, Salary Cap Year, effective date, evidence, state
digests, and release digest all come from that one release. A later default
cannot upgrade, rewrite, invalidate, or strand an older world.

## Partial-branch cleanup

A branch child starts archived and becomes usable only after every copy and
lineage write succeeds. If a later step fails, any purge result whose `ok` value
is not `true` is retained as cleanup-pending or cleanup-failed alongside the
original branch failure and exact child/parent identity.

Partial cleanup requires the caller to supply that exact parent identity. It
then atomically verifies the child is still archived, is an actual child of that
parent, has no descendants, and is not present in the parent's finalized
lineage before writing a trusted cleanup claim. While claimed, client metadata
and subcollection writes are blocked. A visible or lineage-attached world, a
non-child, and a mismatched or malformed relationship return a structured
refusal without changing either world. This transaction/claim boundary makes a
concurrent finalization choose one outcome: finalization wins and cleanup
refuses, or cleanup wins and client finalization is denied. A real partial child
remains hidden and unusable while
cleanup is pending; retry after successful deletion is idempotent.

This boundary changes no audit accounting and authorizes no option, extension,
ETO, renegotiation, or other later contract route.
