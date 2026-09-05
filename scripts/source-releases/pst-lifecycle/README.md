# Offline PST lifecycle tooling

See [the operational runbook](../../../docs/operations/PST_LIFECYCLE_CANDIDATES.md)
for exact build/verify commands, schema and artifact meanings, private recovery,
source limitations, determinism and testing.

`cli.ts` accepts `build` or `verify` with the pinned release, verified evidence
directory, exact archive and original comparison artifact. Build writes only a
new directory under ignored `tmp/`. Verify regenerates the expected artifacts
and rejects any missing/extra file, symlink or byte difference.

The modules separate observation (`observe.ts`), scoped source expressions
(`terms.ts`), cross-page assertions (`reconstruct.ts`), related branch assets
(`branch-links.ts`), 278-ID accounting (`account.ts`), measured uncaptured
references and dated predecessor correspondence (`reference-gaps.ts` and
`dependency-links.ts`), and deterministic private artifacts (`candidate.ts`).
No module imports a Firestore writer or product runtime path.
