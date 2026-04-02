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
| OS-4-1 | OS-4A, OS-4C | MEDIUM | The draft-positions seam has a mostly coherent ownership model, but the boundary between UI input, persisted state, and downstream consumption during season advance is not made explicit. It is not immediately clear which surface owns the persisted draft positions, which year of positions will actually be consumed during world-backed season advance, or whether the consumer reads directly from Firestore or from a prior wrapper-level staging point. A new contributor cannot confidently identify the canonical draft-positions truth without tracing execution. | OPEN |
| OS-4-2 | OS-4B | HIGH | The draft-positions editor reset and clear actions operate on local UI state without making it clear whether persisted draft positions are affected. A user who resets or clears the editor is likely to believe they have cleared the team's draft positions for the upcoming season, but the persisted record may be unchanged. This mismatch between visible editor state and underlying persisted state is a meaningful UX truth problem that can lead users to advance a season with unintended draft-position assignments. | OPEN |
| OS-4-3 | OS-4C, OS-4D | MEDIUM | The saved-year / used-year relationship for draft positions is not structurally protected. There is no enforced contract that guarantees the year recorded when draft positions are persisted matches the year that will be read during season advance. As the draft-positions seam evolves, contributors cannot rely on this alignment holding without structural guardrails — making the seam fragile to upstream year-state changes or incremental refactors that shift which year is authoritative at persistence time versus consumption time. | OPEN |
