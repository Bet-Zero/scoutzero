# D1 UX Truth Table

## Execution Path
- Runtime UI/emulator walkthrough was not executed in this run context.
- Blueprint fallback path applied: code-trace truth audit + manual QA checklist.

## Claim-to-Source Mapping

| UI Claim | Render Anchor | State Source Anchor | Condition Anchor | Truth Status |
|---|---|---|---|---|
| Firebase mode badge shows `EMULATOR MODE` vs `PROD MODE` truthfully. | `src/features/architect/GMDashboard/GMDashboard.jsx:L174-L177` | `src/features/architect/GMDashboard/GMDashboard.jsx:L101-L103` | `src/features/architect/GMDashboard/GMDashboard.jsx:L169-L173` | PASS |
| Emulator warning banner appears only on emulator connection errors. | `src/features/architect/GMDashboard/GMDashboard.jsx:L216-L224` | `src/features/architect/GMDashboard/GMDashboard.jsx:L101-L104` | `src/features/architect/GMDashboard/GMDashboard.jsx:L102-L104` | PASS |
| Offseason preview area is DEV/localStorage gated and explicitly non-persisting. | `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L176-L195` | `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L50-L55` | `src/features/architect/GMDashboard/sections/OffseasonSection.jsx:L178-L210` | PASS |
| Offseason completion copy must direct users to World Season Advance persistence path. | `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:L95-L101` | N/A (static text branch) | `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx:L95-L101` | FAIL (guardrail mismatch, `FIND-B5-001`) |
| World date control displays current as-of date and writes updates to world metadata. | `src/features/architect/GMDashboard/components/WorldTimeControls.jsx:L58-L93` | `src/features/architect/GMDashboard/GMDashboard.jsx:L89-L99` | `src/features/architect/GMDashboard/components/WorldTimeControls.jsx:L34-L50` | PASS |
| Team History scope banner matches base/world mode and event timeline source. | `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx:L224-L231` | `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx:L204-L216` | `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx:L273-L281` | PASS |
