# Cap sheet rules fixes and modal validation

## PLAN_INTENT

Correct Architect cap sheet indicators and EditContractModal validation to accurately reflect CBA rules profiles: show extension eligibility and Bird/QO states in the right places/years only, and enforce min/max/raise constraints for FA/resign flows using rules profile data.

## SCOPE

- In scope:
  - Fix cap sheet/full cap table rendering of extension eligibility badges so they only appear when eligible, not on every salary cell.
  - Place Bird rights indicators only in the Free Agent (FA) year cell (not the player column), aligned with rules profile data.
  - Update EditContractModal to surface Bird rights/exception info plus min/max values from rules profile, applying proper raise limits across all contract years.
  - Ensure useCapValidation (or related hooks) re-run with rules profile changes and enforce multi-year constraints.
  - Add/adjust targeted tests for cap sheet indicators and modal validation.
- Out of scope:
  - Designing/adding the final Bird rights logo asset (will use text/placeholder as needed).
  - Broader Architect feature work outside cap sheet indicators and contract modal rules enforcement.

## IMPLEMENTATION_SCOPE

Single-phase fix (no chunks): audit and correct cap sheet indicator logic, clean up Bird rights placement, and tighten modal validation to follow rules profile min/max and exception-based raises across years. Tests will cover these behaviors.

## CONTEXT SNAPSHOT

Important background for this plan:

- Systems involved: Architect cap sheet/full cap table UI, rules profile integration, EditContractModal validation, cap/exception logic.
- Key folders and files: `src/features/architect/CapSheetFull.jsx` (and related table cells/components), `src/shared/components/EditContractModal.jsx`, `src/features/architect/hooks/useCapValidation.js`, `src/features/architect/utils/playerRulesProfile/*`, `tests/architect/*`.
- Relevant docs: prior rules-profile plan (`plans/_archive/player-rules-architect/plan.md` and chunks), workspace rules in `docs/workspace-rules/`.
- Known constraints: Read-only Firestore; follow existing tailwind/alias patterns; temporary files must live in `plans/cap-sheet-rules-fix/temp/` if needed.
- **Questions asked and answered**:
  - Extension eligibility can be displayed but should appear once per player/year, not in every salary cell; existing color coding indicates actual extension years, not eligibility.
  - Bird rights should show in the full cap table only in the FA-year cell (no player-name column tags); final logo to come later.
  - EditContractModal should expose Bird rights, exceptions, min/max (rules profile) and enforce raises per CBA across all years.
- **Technical decisions made**:
  - Treat this as a single-phase plan without chunk files; updates tracked here.

## CHUNK_INDEX

- No chunks — plan is single-phase (not large).

## PROGRESS

**Status**: 🟢 Completed

**Progress**: ✅✅✅✅✅ 5/5 tasks completed

**Completed**:

- ✅ Plan created and scoped (setup).
- ✅ Audited cap sheet/full table and modal flows to pinpoint EXT/Bird placement issues and missing guardrails.
- ✅ Fixed cap sheet indicators (extension eligibility chip per player, Bird rights only in FA cells; removed per-salary EXT tags).
- ✅ Updated EditContractModal to surface Bird/exception ranges and enforce rules-profile min/max/raise constraints across years.
- ✅ Added/updated targeted tests for cap sheet indicators and modal validation; ran vitest suite for affected files.

**Next Steps**:

- [ ] Await user verification / additional UX feedback.

**Blockers**: None

**Last Updated**: 2025-12-10 07:39 EST

## PERMANENT_FILE_MAP

- Cap sheet UI: `src/features/architect/CapSheetFull.jsx` (and related subcomponents)
- Contract modal: `src/shared/components/EditContractModal.jsx`
- Validation/hooks: `src/features/architect/hooks/useCapValidation.js`
- Rules profile helpers: `src/features/architect/utils/playerRulesProfile/*`
- Tests: `tests/architect/*`

## REVISION_LOG

- 2025-12-10: Created plan, captured scope/next steps (cap-sheet-rules-fix).
- 2025-12-10: Applied cap sheet indicator fixes and modal guardrails; tests added and run.

## KNOWN_LIMITATIONS

- Bird rights logo asset deferred; will use text/placeholder until design is provided.
