# ARCHITECT OFFSEASON ISSUE LOG

---

## STEP 1 — Offseason Action Ownership and Source of Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| OS-1-1 | OS-1A, OS-1B | MEDIUM | Offseason has multiple distinct ownership and execution seams — world-backed advancement, draft-position persistence, and DEV/local preview — that all sit under one wrapper but do not read as one unified ownership model. The world-backed path is real and authoritative, but it is structurally co-located with a non-persisting preview path in a way that makes neither seam fully self-evident to a new contributor. | RESOLVED |
| OS-1-2 | OS-1C | MEDIUM | Wrapper-level post-success state updates in `OffseasonSection.tsx` (currentYear, worldSeason, offseasonRun, offseasonSummary) are not tightly anchored to authoritative execution truth. The actual world mutation is owned by `seasonManager.ts`, but the dashboard-visible aftermath is patched separately at the wrapper, creating a split that can drift if either side evolves without awareness of the other. | RESOLVED |
| OS-1-3 | OS-1D | LOW | Offseason ownership clarity currently depends on conventions holding — wrapper stays orchestration-first, modal stays action-surface-first, preview path stays fenced. These boundaries are understandable today but are not structurally enforced, leaving the ownership model vulnerable to gradual drift without clear detection points. | RESOLVED |

---

## STEP 2 — Season Advance Modal UI Truth and Wizard Wiring

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| OS-2-1 | OS-2A | MEDIUM | The Season Advance modal's wizard step flow is clean and explicit today, but its step-order, step-gating, and post-success transition logic still depend on several internal assumptions continuing to hold. The step contract is not structurally enforced, which means wizard-flow regressions can be introduced while the modal remains superficially functional. | RESOLVED |
| OS-2-2 | OS-2B, OS-2A | MEDIUM | Option-decision staging and validation truth are correctly scoped to local UI state, but that boundary is not structurally protected. The confirmation step depends on staged decisions accurately reflecting what the user intends to authorize — if local staging drifts or validation gating weakens, the confirmation surface can become misleading even if the underlying season-manager execution remains correct. | RESOLVED |
| OS-2-3 | OS-2C, OS-2D | HIGH | The normalized `worldAdvanceAftermath` payload is now the core bridge between the modal's dispatch and the wrapper's aftermath state. Because the wrapper consumes this contract directly without synthesizing its own fallback, any drift in what the modal normalizes — season/year truth, offseason summary truth, or payload shape — will propagate faithfully into wrapper-visible state. This seam, and the single authoritative dispatch path it wraps, needs explicit structural protection. | RESOLVED |

---

## STEP 3 — World Season Advancement Flow

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| OS-3-1 | OS-3A | HIGH | `seasonManager.ts` contains two distinct season-advance engines in the same module. The newer `advanceSeasonInWorld` / `processTeamSeasonTransitionWithOptions` path is the real authoritative Offseason executor, but the older `advanceSeason` / `processSeasonTransition` / `processTeamSeasonTransition` path still exists and still performs overlapping season-transition logic — including contract expirations, options, cap holds, draft-pick updates, and totals recompute. This creates structural ambiguity about which path is canonical, raises maintenance and regression drift risk, and makes the actual execution center harder to identify with confidence. | RESOLVED |
| OS-3-2 | OS-3B, OS-3C, OS-3D | MEDIUM | The world-backed season-advance path — from modal payload dispatch through `advanceSeasonInWorld`, world metadata anchoring, executor summary, normalized aftermath, committed persistence, wrapper aftermath application, and post-success reload reconciliation — now runs through an explicit committed-state contract and focused guardrails. Payload truth, season/year derivation, summary/result normalization, final persistence, and reload truth are all structurally protected at the live seam. | RESOLVED |

---

## STEP 4 — Draft Positions Input and Persistence Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| OS-4-1 | OS-4A | MEDIUM | The draft-positions seam has one UI owner (`DraftPositionsInput.tsx`), one persistence owner (`worldManager.ts`), and one real downstream consumer (`advanceSeasonInWorld`), but that ownership model is not surfaced explicitly enough to be durable. Contributors can still blur what is UI staging versus committed persistence truth. An additional gap: after a successful save, the component invents its own `updatedAtIso` and `method` metadata rather than round-tripping the committed value from storage, so the displayed last-saved state is partially UI-synthesized rather than reflecting the actual persisted record. | RESOLVED |
| OS-4-2 | OS-4B | HIGH | `DraftPositionsInput.tsx` exposes a **Reset to Template** action that only replaces the local textarea contents — it does not clear the persisted draft positions for the selected year. `worldManager.ts` already exposes `clearDraftPositions(...)` at the persistence layer, but the UI never calls it. A user can reasonably conclude they have reset their saved draft positions when they have only reset unsaved editor contents. Because draft positions are consumed by `advanceSeasonInWorld(...)` for real pick conveyance and swap resolution, this UX/truth gap can cause a season to advance with unintended pick assignments. | RESOLVED |
| OS-4-3 | OS-4C, OS-4D | MEDIUM | The year a user edits in `DraftPositionsInput.tsx` and the year consumed during season advancement are only indirectly connected. `OffseasonSection.tsx` passes `defaultDraftYear={worldDraftYear ?? viewingYear}` as the starting selection, but the component allows selecting among multiple future years. `advanceSeasonInWorld(...)` later derives `draftYear = fromYear` from world season truth, independent of which year the user last saved to. A user who saves positions for the wrong year will receive no warning, and the season will advance using whichever year world truth resolves to — not necessarily the one they edited. This year-truth seam and the broader correctness assumptions around it (single UI owner, single persistence owner, truthful reset/clear, save/load message accuracy) currently have no structural protection. | RESOLVED |

---

## STEP 5 — Offseason World-Mode vs DEV Preview / Local Behavior

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| OS-5-1 | OS-5A | MEDIUM | Offseason operates under two real execution models — world-backed league-wide advancement and DEV-only single-team preview — within a single feature wrapper. The boundary between these models is maintained by implied structural conventions (separate engines, separate surfaces, separate persistence assumptions, separate aftermath meanings) rather than explicit enforcement. Two execution models under one surface always carry drift risk, and the separation's durability depends on those conventions holding without structural backup. | OPEN |
| OS-5-2 | OS-5B | MEDIUM | Preview-mode completion emits a result payload (`previousCapSheet`, `updatedCapSheet`, `nextYear`, `summary`) that affects dashboard-visible state in a shape that structurally resembles the real world-backed aftermath path. Preview copy correctly labels the result as non-persisting, but the structural similarity between preview-visible state transitions and real committed aftermath remains a mild truth seam. Users and contributors can still misread preview state as authoritative, especially in year/season-change contexts where results feel meaningful. | OPEN |
| OS-5-3 | OS-5C, OS-5D | MEDIUM | The DEV/local preview gate (`import.meta.env.DEV` + localStorage flag + wrapper-level `showDevPreview`) is functional today but remains a soft convention-based boundary. No structural enforcement prevents gate widening or route blurring between preview and world paths. The core correctness assumptions of the world-vs-preview boundary — that routing stays clean, preview stays non-persisting, and language stays explicit — have no focused guardrail coverage beyond current code conventions, leaving the seam vulnerable to silent drift. | OPEN |
