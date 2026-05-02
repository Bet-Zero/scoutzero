# TypeScript Hardening Completion Contract

> Current status: this document is the maintenance gate for future TypeScript regressions.
> TypeScript migration and hardening are complete in this repo.
> Do not reopen the TypeScript campaign unless one of these gates fails again.
> Current entry point: [docs/typescript/README.md](README.md)

This document is the non-negotiable completion contract for TypeScript migration and hardening work in ScoutZero.

It exists to prevent agents from declaring the TypeScript hardening mission complete just because a phase, slice, probe, or partial migration passed.

## Status Language Rules

Agents must use these exact meanings:

| Status phrase                              | Allowed meaning                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `STRUCTURAL MIGRATION COMPLETE`            | Runtime `src/` has no JS/JSX/CJS/MJS app files, but this says nothing about hardening.                                                       |
| `ROOT TYPECHECK PASSING`                   | `npm run typecheck` passes under the current root config only. If root `strict` is false, this is a compatibility pass, not hardening proof. |
| `STRICT PROBE PASSING`                     | A scoped strict config passes for its included files only. This is not repo-wide strict readiness.                                           |
| `PHASE COMPLETE`                           | The assigned narrow phase is complete. This must not be described as full TypeScript hardening complete.                                     |
| `TASK INCOMPLETE — HARDENING NOT FINISHED` | Required wording when any hard-stop completion gate below fails.                                                                             |
| `TYPESCRIPT HARDENING COMPLETE`            | Only allowed when every hard-stop completion gate below passes with evidence.                                                                |

Agents must not use vague substitutes such as `done`, `finished`, `complete`, `good`, `clean`, `hardened`, or `ship-ready` unless the statement identifies the exact scope.

Bad:

```md
TypeScript migration and hardening is done.
```

Good:

```md
Structural migration is complete for runtime src, root permissive typecheck passes, and the shared-boundaries strict probe passes. Full TypeScript hardening is still incomplete because root strict mode fails and test fixtures still contain unreviewed any/as any debt.
```

## Hard Stop Definition of Done

The TypeScript hardening mission is not complete unless every gate in this section passes.

If any gate fails, the agent must stop and state:

```md
TASK INCOMPLETE — HARDENING NOT FINISHED
```

The agent may still report useful phase progress, but it must not declare the mission complete.

## Gate 1 — Root Strict Mode

### Required state

`tsconfig.json` must enforce root strict mode:

```json
"strict": true
```

### Required validation

Run:

```bash
./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false
```

### Pass condition

- Command exits `0`.
- Output has zero TypeScript errors.

### Failure condition

Any of the following means the mission is incomplete:

- root `strict` is false
- root strict validation fails
- root strict validation is skipped
- root strict validation is replaced by scoped strict probes only

## Gate 2 — Runtime Type Escape Audit

### Required audit scope

Audit production/runtime source, excluding test folders:

```bash
rg -n "\bany\b|as any|as unknown as|Record<string, any>|@ts-ignore|@ts-expect-error" src -g '*.ts' -g '*.tsx' -g '*.d.ts' -g '!src/tests/**'
```

### Pass condition

Every remaining type escape must be either removed or listed in a tracked exception table with:

- file path
- line number
- exact marker
- reason it is necessary
- why it is safe
- owner/follow-up plan if temporary

### Failure condition

Any unlisted, unjustified, or bulk-count-only type escape means the mission is incomplete.

## Gate 3 — Declaration and Shim Honesty

### Required audit scope

Audit all declaration files:

```bash
rg -n "declare module|\bany\b|as any|Record<string, any}" src -g '*.d.ts'
```

### Pass condition

- No ambient module shim may export `any` for a real module.
- No declaration facade may hide weak typing in a sibling runtime implementation.
- Any remaining `.d.ts` file must be documented as a justified boundary declaration.

### Failure condition

Any ambient `any` shim, stale facade, or unexplained declaration file means the mission is incomplete.

## Gate 4 — Runtime Boundary Honesty

### Required boundary classes

The following data ingress/egress classes must be schema-validated or explicitly exception-listed:

- Firestore reads and writes
- localStorage/sessionStorage reads and writes
- JSON.parse boundaries
- route/search param boundaries
- scraper/staging data imported into runtime contracts
- Architect/base-data loaders
- player/team/world loader surfaces

### Required Architect review targets

At minimum, the agent must audit these families when claiming completion:

- `src/features/architect/utils/teamLoader*`
- `src/features/architect/utils/worldManager*`
- `src/features/architect/utils/firebaseTeamPlanHelpers*`
- `src/features/architect/utils/mutationPipeline*`
- `src/features/architect/GMDashboard/**`
- player detail/simple player data hooks
- Firestore helper modules under `src/firebase/**`

### Pass condition

Every boundary either:

1. validates untrusted data before returning typed objects, or
2. is listed in a tracked exception table with exact reason, risk, and follow-up.

### Failure condition

Any unreviewed `doc.data() as X`, unchecked JSON parse, unchecked storage parse, or unchecked route-param type assumption means the mission is incomplete.

## Gate 5 — Test and Mock Type Integrity

### Required audit scope

Audit both test roots:

```bash
rg -n "\bany\b|as any|as unknown as|Record<string, any>|@ts-ignore|@ts-expect-error" tests src/tests -g '*.ts' -g '*.tsx'
```

### Pass condition

Every remaining test-side type escape must be either:

- removed,
- converted to an honest fixture/helper type,
- or listed as an intentional negative/assertion boundary with justification.

Central mocks must not hide runtime contract truth behind broad bags.

### Failure condition

Any broad mock, fixture builder, integration harness, or persistence/contract test that relies on unreviewed `any`/`as any` means the mission is incomplete.

## Gate 6 — Remaining JS/CJS/MJS Classification

### Required audit scope

Audit all remaining JS-like files outside dependencies and generated output:

```bash
rg --files -g '*.js' -g '*.jsx' -g '*.cjs' -g '*.mjs' -g '!node_modules/**' -g '!dist/**' -g '!archive/**'
```

### Pass condition

Every remaining JS/CJS/MJS file must be classified as one of:

| Classification            | Meaning                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `INTENTIONAL CONFIG`      | Tooling config that should remain JS for compatibility.                  |
| `INTENTIONAL NODE SCRIPT` | Node script intentionally left JS with documented reason.                |
| `GENERATED/TEMP`          | Generated or temporary file that should not be committed long-term.      |
| `MIGRATE`                 | Real source/script file that must be migrated before mission completion. |
| `DELETE`                  | Stale file that must be removed before mission completion.               |

### Failure condition

Any unclassified JS-like file, especially timestamp/temp files, means the mission is incomplete.

## Gate 7 — Schema Escape Audit

### Required audit scope

Audit schema escape hatches:

```bash
rg -n "z\.any\(|z\.unknown\(|passthrough\(|catchall\(" src -g '*.ts' -g '*.tsx'
```

### Pass condition

Every schema escape hatch must be documented as one of:

- intentional external passthrough
- legacy compatibility field
- unknown-safe boundary requiring downstream narrowing
- temporary debt with follow-up

### Failure condition

Any unexplained schema escape hatch means the mission is incomplete.

## Gate 8 — Validation Evidence Package

Any claim of TypeScript hardening completion must include a repo-written return package under:

```text
return_packages/typescript/
```

The return package must include:

1. exact commands run
2. exact command outcomes
3. pass/fail gate table
4. remaining exception tables
5. files changed
6. proof that root strict mode is on and passing
7. proof that scoped strict probes pass, if still retained
8. proof that JS-like files were classified
9. proof that runtime/test type escapes were audited
10. explicit final verdict

## Required Gate Table Format

Every return package for TypeScript hardening must include this table:

| Gate                               | Status    | Evidence                               | If failed, why mission is incomplete |
| ---------------------------------- | --------- | -------------------------------------- | ------------------------------------ |
| Gate 1 — Root strict mode          | PASS/FAIL | command + output summary               | required if FAIL                     |
| Gate 2 — Runtime type escape audit | PASS/FAIL | count + exception table path           | required if FAIL                     |
| Gate 3 — Declaration/shim honesty  | PASS/FAIL | scan result + files reviewed           | required if FAIL                     |
| Gate 4 — Runtime boundary honesty  | PASS/FAIL | audited files + schema/exception proof | required if FAIL                     |
| Gate 5 — Test/mock type integrity  | PASS/FAIL | count + exception table path           | required if FAIL                     |
| Gate 6 — JS/CJS/MJS classification | PASS/FAIL | file inventory + classification table  | required if FAIL                     |
| Gate 7 — Schema escape audit       | PASS/FAIL | scan result + exception table path     | required if FAIL                     |
| Gate 8 — Evidence package          | PASS/FAIL | return package path                    | required if FAIL                     |

## Final Verdict Rules

The final verdict must be one of these exact values:

| Verdict                                       | When allowed                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `TYPESCRIPT HARDENING COMPLETE`               | All gates PASS.                                                                                         |
| `PHASE COMPLETE — HARDENING STILL INCOMPLETE` | Assigned phase is done, but at least one mission gate fails.                                            |
| `TASK INCOMPLETE — HARDENING NOT FINISHED`    | Assigned phase failed, validation failed, evidence is missing, or any required work remains incomplete. |

## Agent Refusal Rule

Agents must refuse to summarize the TypeScript hardening mission as complete when any hard-stop gate fails.

Required wording:

```md
I cannot call TypeScript hardening complete. The following hard-stop gates still fail: ...
```

## Current Known Non-Completion Signals

As of the latest documented status audit, the mission should be treated as incomplete if any of the following remain true:

- root `tsconfig.json` has `strict: false`
- forced root strict `tsc` fails
- runtime `src` still has unreviewed `any`/cast debt
- tests or mocks still have broad `any`/`as any` fixture debt
- Architect/base-data loaders still rely on cast-only boundary trust
- remaining JS/CJS/MJS files are not fully classified
- schema `z.any()`/escape hatches are not justified

These are not suggestions. They are hard-stop blockers to claiming full TypeScript hardening completion.
