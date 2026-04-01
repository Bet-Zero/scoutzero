# ARCHITECT OFFSEASON ISSUE LOG

---

## STEP 1 — Offseason Action Ownership and Source of Truth

| Issue ID | Related Step(s) | Severity | Description | Status |
|----------|------------------|----------|-------------|--------|
| OS-1-1 | OS-1A, OS-1B | MEDIUM | Offseason has multiple distinct ownership and execution seams — world-backed advancement, draft-position persistence, and DEV/local preview — that all sit under one wrapper but do not read as one unified ownership model. The world-backed path is real and authoritative, but it is structurally co-located with a non-persisting preview path in a way that makes neither seam fully self-evident to a new contributor. | OPEN |
| OS-1-2 | OS-1C | MEDIUM | Wrapper-level post-success state updates in `OffseasonSection.tsx` (currentYear, worldSeason, offseasonRun, offseasonSummary) are not tightly anchored to authoritative execution truth. The actual world mutation is owned by `seasonManager.ts`, but the dashboard-visible aftermath is patched separately at the wrapper, creating a split that can drift if either side evolves without awareness of the other. | OPEN |
| OS-1-3 | OS-1D | LOW | Offseason ownership clarity currently depends on conventions holding — wrapper stays orchestration-first, modal stays action-surface-first, preview path stays fenced. These boundaries are understandable today but are not structurally enforced, leaving the ownership model vulnerable to gradual drift without clear detection points. | OPEN |
