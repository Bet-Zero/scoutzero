# MUTATION_PIPELINE_COMPUTE_RESULT_BRIDGE_PASS — EXECUTION RETURN PACKAGE

Executed: 2026-03-25

---

## 1. Summary

This pass completed fully. Runtime behavior remained unchanged. The authoritative `ComputeResultLike` / `LooseRecord` bridge in `src/features/architect/utils/mutationPipeline.ts` is materially reduced now:

- `ComputeResultLike` no longer aliases `ArchitectMutationResult`
- `persistWorldMutation()` no longer returns a loose record envelope
- `buildWorldMutationEventPayload()` now returns a concrete event contract
- the intentionally broad boundary is isolated to `metadata`

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/features/architect/utils/mutationPipeline.ts` | Replaced the permissive internal compute/persist/apply bridge with a concrete shared bridge result, a narrow persist outcome, a concrete world patch contract, and a concrete event envelope/history metadata contract. Rewired the targeted helpers to depend on the smallest consumed result slices. |
| `src/tests/architect/mutationPipeline.computeResultBridge.test.ts` | Added one focused node-oriented test file covering public/exported behavior for sign-free-agent apply writes, execute-trade player update/delete + entitlement persistence, and exported event payload construction with heterogeneous metadata. |

Unrelated pre-existing worktree changes in other Architect trade-machine files were not modified.

---

## 3. Deliberate Non-Changes

### `ArchitectMutationResult`
- Still present as the public compatibility umbrella.
- It is no longer the authoritative internal compute/persist/apply bridge.
- Removing or fully narrowing it later would require coordinated downstream consumer cleanup across existing callers.

### `MutationEventMetadataLike`
- Still uses an open `Record<string, unknown>` edge.
- That looseness is now isolated strictly to the metadata boundary.
- It remains load-bearing because current mutation families still attach heterogeneous metadata beyond the exact keys read at this bridge.
- Removing that openness later would require a shared cross-mutation metadata schema/union pass.

### `MutationEventMetadataLike['entitlementsTraded']`
- Still accepts both the live team-keyed transfer map and a legacy readonly string-array form.
- The map is the truthful live trade-compute shape.
- The readonly array form remains for exported event-builder compatibility with existing tests/callers.
- Removing the array form later would require normalizing those legacy event-builder inputs first.

### Non-bridge `LooseRecord` normalization helpers
- Left in place where they serve dynamic metadata/object-coercion boundaries outside the compute/persist/apply result seam.
- They are not the dominant blocker after this pass.
- Removing them would require a broader metadata hardening pass, not this bridge pass.

---

## 4. Validation Results

- `npm run typecheck` — PASSED
- `npm run test:node -- --reporter=dot src/tests/architect/mutationPipeline.computeResultBridge.test.ts` — PASSED
- `npm run build` — PASSED

Commands intentionally skipped:

- `npm run lint`
  - Not required by the prompt, and repo guidance notes many pre-existing lint issues.
- `npm run test:diff`
  - Superseded by the prompt’s exact required node test command.
- Full suite
  - Not permitted without explicit `RUN FULL SUITE`.

Non-blocking build warnings observed:

- Browserslist data is stale
- existing Vite warnings about `fs` browser externalization
- existing Vite warnings about mixed static/dynamic imports
- existing chunk-size warnings

---

## 5. Standing Failures (if any)

None.

---

## 6. Recommended Next Step

Move to a fresh progression-gate re-evaluation. The compute/persist mutation-result bridge is no longer the dominant remaining hardening blocker.
