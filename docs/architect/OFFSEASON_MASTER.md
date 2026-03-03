# Offseason — Master Doc

## v1 Shipping Surface

**Authoritative offseason advancement** is the world-wide `SeasonAdvanceModal` → `advanceSeasonInWorld()` path:

- Persists all 30 teams atomically via `writeBatch` to `architect_worlds/{worldId}/teams/{teamCode}`
- Emits `seasonAdvance` world event with full `CapAuditEventV1` payload
- Runs post-state cap legality validation before commit
- Processes option decisions, contract expirations, cap holds, exception lifecycle, hard cap clearing, dead money advancement, DARE entitlement resolution

**Single-team offseason preview** (`OffseasonTab` → `runOffseason()`) is **not part of v1 shipping surface**:

- DEV-gated behind `import.meta.env.DEV` + `localStorage['hz.dev.offseasonPreview'] === 'true'`
- Does not persist to Firestore
- Does not emit world events
- Labeled "Preview only — not saved" in UI

## Key Files

| File | Role |
|------|------|
| `src/features/architect/GMDashboard/sections/OffseasonSection.jsx` | Section wrapper with DEV gate |
| `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` | World-wide wizard (production path) |
| `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx` | Draft positions input (Phase 5) |
| `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx` | Single-team preview (DEV only) |
| `src/features/architect/utils/seasonManager.js` | `advanceSeasonInWorld()` — persistence |
| `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` | OSTE engine (shared computation) |
| `src/features/architect/utils/runOffseason.js` | Single-team runner (no persistence) |

## Review History

- **OFFSEASON_R1_LOCAL** (2026-03-03): Discovery review. 10 PASS / 2 FAIL. Found STOP CONDITION: single-team path claims success without persistence.
- **OFFSEASON_E1** (2026-03-03): DEV-gated single-team path, relabeled success language, added guardrail tests.
