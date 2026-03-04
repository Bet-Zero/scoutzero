# Architect Smoke Master

**Last updated:** 2026-03-04  
**Status:** Active canonical smoke gate

---

## What this smoke gate is

`ARCHITECT_SMOKE_E1` is a deterministic, emulator-first render smoke gate for Architect WORLD MODE UI surfaces.

It verifies that the shipped UI can boot and render coherently across major tabs without crashing.

Covered surfaces:

1. GM Dashboard shell + target mode badge
2. Trade Machine
3. Cap Sheet
4. Free Agency
5. Team History timeline + detail modal wiring (DEV fixtures)
6. Offseason season-advance surface (DEV preview gate enabled for render smoke)

---

## What this smoke gate is not

- Not a re-audit
- Not Playwright / browser automation
- Not persistence mutation proof
- Not a replacement for rules integration or deterministic mutation integration suites

Mutation correctness, world writes, and security boundaries remain covered by existing integration/rules gates.

---

## Preconditions

- Firestore emulator is running and reachable at `127.0.0.1:8082`
- Architect dev flow remains emulator-locked in DEV

If emulator is not reachable, smoke gate fails closed with explicit guidance to start emulators.

---

## Canonical command

```bash
npm run smoke:architect
```

This command runs a fail-fast chain:

1. `npm run gates:architect`
2. `npm run test:smoke:architect`

---

## ARCHITECT_SMOKE_E2 (Polish/Stability Closure)

`ARCHITECT_SMOKE_E2` closes remaining smoke/rules stability gotchas without product behavior changes.

Guarantees added:

1. **Warning-clean smoke render path**
   - Removed function-component `defaultProps` usage in:
     - `DraftPositionsInput`
     - `OffseasonTab`
     - `SeasonAdvanceModal`
   - Smoke now runs without React warning:
     - `Support for defaultProps will be removed from function components`

2. **Deterministic guardrail against warning regressions**
   - Smoke suite now asserts that captured `console.warn`/`console.error` output does **not** include the defaultProps warning substring.
   - Guardrail lives in the Architect smoke test so regressions fail CI immediately.

3. **Rules warm-up retry resilience (still fail-closed)**
   - `npm run test:rules` runner now retries emulator reachability deterministically before test launch.
   - Policy: up to `10` attempts with fixed `400ms` delay between attempts.
   - If still unreachable, command exits non-zero with the same guidance to start emulator via `npm run emu`.
   - No prod fallback introduced.

---

## Optional manual spot-check (human sanity only)

1. Start emulators and app (`npm run emu`, `npm run dev`)
2. Create/select a world
3. Open tabs: Trade, Cap, Free Agency, Team History, Offseason
4. Confirm `EMULATOR MODE` badge is visible
5. Confirm Team History shows entries (fixtures or real world events)
