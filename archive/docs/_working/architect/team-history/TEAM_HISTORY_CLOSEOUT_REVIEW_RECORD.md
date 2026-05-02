# Team History Closeout Review Record

## Metadata

- Feature: Team History
- Framing: Whole-feature closeout review
- Date: 2026-04-04
- Repo / branch reviewed: `Bet-Zero/scoutzero` / `main`
- Review basis: Direct live-code verification of the current repository state, plus focused live test execution against the current repo. Prior working docs were not used as authority.

## Executive Verdict

**Verdict: PASS**

Team History now reads as one owned feature instead of six disconnected seams, and the last closeout blockers are resolved in live code. Source selection is centralized, world-event loading now merges canonical and legacy-compatible rows into one paginated feed, normalization still owns the row contract, base-mode fallback remains explicitly labeled as derived, the detail modal respects row truth kind, DEV fixtures still fail closed from actual marker state, and the previously red focused Team History integration test is now aligned with the live normalized output.

## Whole-Feature Team History System Map

- Primary owner: `TeamHistoryTab` is the real feature owner. `GMDashboard` passes `teamCapSheet`, `worldId`, and Team History DEV-tool callbacks into `HistorySection`, and `HistorySection` is only a thin handoff into `TeamHistoryTab`.
- Source-selection hierarchy: `resolveTeamHistoryTimeline(...)` makes one explicit top-level choice in this order: `dev-fixtures` -> `world-events` -> `local-timeline` -> `synthesized`.
- World path: `WorldEventsTimeline(...)` calls `useWorldTeamEvents(...)`; `fetchWorldTeamEvents(...)` now buffers canonical `teamCodes` / `occurredAt` rows and legacy `teamsAffected` / `timestamp` rows together, materializes one newest-first merged page with per-contract cursor reuse, then `normalizeWorldEventsForTeamHistory(...)` turns raw event payloads into Team History rows.
- Base/local path: outside world-event mode, explicit `historyTimeline[]` rows win. If they do not exist, `normalizeTimelineFromSections(...)` synthesizes rows from `waivedContracts[]`, `exceptionHistory[]`, and `pickLog[]`, sorts them newest-first, and tags them as derived-source output.
- Detail modal path: every rendered row click funnels through `buildSelectedHistoryEntry(...)`, which assigns `timelineSourceKey` and `truthKind`; `HistoryDetailModal(...)` then renders normalized display fields, identity fields, cap-alignment checks, and raw-payload inspection based on that same selected-row contract.
- DEV fixture path: `useArchitectActions(...)` owns inject / clear callbacks, `devTeamHistoryFixtures.ts` mutates only in-memory team state, and `TeamHistoryTab` independently detects fixture markers in team data so fixture mode stays authoritative until those markers are actually cleared.

## Cross-Surface / Cross-Flow Integration Analysis

Ownership is coherent across the feature. The dashboard shell does not fork Team History logic. `GMDashboard` wires the section, `HistorySection` passes through, and `TeamHistoryTab` owns source resolution, row rendering, row selection, fixture signaling, and modal mounting. That is a real feature owner, not a stitched collection of local decisions.

Truth posture is also clear across modes. World rows are treated as authoritative only when the tab is world-backed and no fixture override is active. Explicit local rows are clearly presented as local timeline entries. Section-derived rows are explicitly labeled as convenience fallback and carry derived-source metadata instead of pretending to be world events. Fixture rows are called out as synthetic and non-authoritative in both the timeline shell and the detail modal.

Drill-down is downstream of the same owned truth model. World rows, local rows, synthesized rows, and fixture rows all enter the modal through `buildSelectedHistoryEntry(...)`. `HistoryDetailModal(...)` then uses `truthKind` to explain what the user is looking at and keeps normalized Team History display fields separate from raw-payload inspection. The modal does not silently backfill normalized IDs, totals, teams, or players from raw payload when those normalized fields are absent.

As a system, this behaves like one integrated feature. The world loader, the normalizer, the base fallback synthesizer, the detail modal, and the DEV fixture override all converge on one Team History row model and one selection model. The feature-level truth model is visible in the UI rather than being hidden in implementation detail.

## Remaining Hidden Ownership / Staging / Drift Risks

No grounded Team History closeout blockers remain after this follow-up. The validation run did surface pre-existing Vite build warnings about `Browserslist`, dynamic-import chunking, and an externalized `fs` import path, but those warnings are broader project/build concerns rather than Team History ownership, truth, or integration defects.

## Whole-Feature Verdict

### Why this is not FAIL

The feature is not failing as a system. Source ownership is explicit, the major truth modes are distinguished cleanly, the detail modal is tied to the selected Team History row rather than a separate shadow contract, fixture injection / clear logic is symmetric across the live managed surfaces, and the focused Team History guardrails mostly pass under the current repo state.

### Why this is PASS

The two grounded closeout blockers are gone. World-event retrieval is now a mixed-feed reader with bounded per-contract pagination state instead of an all-or-nothing fallback, so worlds that contain both canonical and legacy-only rows can render a fuller Team History feed. The previously red focused TM Cap integration test is now aligned with the live Team History summary contract, and the broader validation set passed.

## Exact File + Function Citations

- `src/features/architect/GMDashboard/GMDashboard.tsx:517-528` - `GMDashboard` mounts `HistorySection` and passes Team History DEV-tool props from `actions.teamHistoryDevTools`.
- `src/features/architect/GMDashboard/sections/HistorySection.tsx:24-38` - `HistorySection(...)` is a pure passthrough into `TeamHistoryTab`.
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:4490-4539` - `hasInjectedTeamHistoryFixtures`, `injectTeamHistoryDevFixtures(...)`, `clearTeamHistoryDevFixtures(...)`, and `teamHistoryDevTools` define the Team History DEV fixture control surface.
- `src/features/architect/history/TeamHistoryTab/types.ts:32-133` - `TeamHistoryDisplayEntry`, `TeamHistoryTimelineSourceKey`, `TeamHistorySelectedEntry`, `TeamHistoryCapSheetLike`, `TeamHistoryTabProps`, and `HistoryDetailModalProps` define the shared Team History row / selection contract.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx:110-135` - `buildSelectedHistoryEntry(...)` stamps every selected row with `timelineSourceKey` and `truthKind`.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx:436-565` - `normalizeTimelineFromSections(...)`, `sortTimelineNewestFirst(...)`, and `resolveTeamHistoryTimeline(...)` define the base/local source-selection and synthesized fallback contract.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx:568-706` - `WorldEventsTimeline(...)` owns world-event loading display, compatibility note rendering, and pagination button behavior.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx:708-953` - `TeamHistoryTab(...)` owns the banner, fixture panel, active timeline rendering, section trackers, selected-entry state, and modal mount.
- `src/features/architect/history/hooks/useWorldTeamEvents.ts:95-147` - `AUTHORITATIVE_QUERY_CONTRACT`, `LEGACY_COMPAT_QUERY_CONTRACT`, `INITIAL_QUERY_CONTRACT_CHAIN`, and `buildInitialPaginationState(...)` define the two-contract Team History retrieval surface.
- `src/features/architect/history/hooks/useWorldTeamEvents.ts:313-485` - `runQueryAttempt(...)`, `ensureBufferedRows(...)`, `materializeNextPage(...)`, and `fetchWorldTeamEvents(...)` implement mixed canonical + legacy retrieval, per-contract cursor reuse, newest-first merged paging, and fail-closed contract errors.
- `src/features/architect/history/hooks/useWorldTeamEvents.ts:487-586` - `useWorldTeamEvents(...)` owns hook state, merged-page accumulation, load-more state, and resolution updates.
- `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts:13-90` - `MUTATION_DISPLAY_CONFIG` is the explicit mutation-display ownership map.
- `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts:328-384` - `buildCapDeltaContext(...)` resolves active-team-first cap delta and cap-allocation detail lines.
- `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts:567-1004` - `toTeamHistoryEventDisplay(...)` is the normalization owner for category, type, summary, detail sections, identity fields, totals, and raw payload carry-through.
- `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts:1006-1027` - `normalizeWorldEventsForTeamHistory(...)` sorts normalized rows newest-first.
- `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx:110-142` - `buildCapAlignmentRows(...)` derives modal reconciliation rows from normalized before/after totals.
- `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx:144-200` - `resolveTruthContract(...)` defines modal truth notes for world, fixture, local, and synthesized rows.
- `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx:236-553` - `HistoryDetailModal(...)` renders normalized row fields, identity, cap alignment, totals, and raw payload as separate layers.
- `src/features/architect/history/devTeamHistoryFixtures.ts:242-301` - current-pick fixture backup / clear helpers keep fixture injection and clearing symmetric for `currentPicks`.
- `src/features/architect/history/devTeamHistoryFixtures.ts:303-372` - `injectTeamHistoryFixtures(...)`, `clearTeamHistoryFixtures(...)`, and `hasInjectedTeamHistoryFixtures(...)` define the non-authoritative DEV override contract.
- `src/features/architect/utils/mutationPipeline.ts:3602-3684` - `buildWorldMutationEventPayload(...)` writes the world-event payload fields Team History depends on (`eventId`, `mutationType`, `occurredAt`, `teamCodes`, `playerIds`, `beforeTotalsByTeam`, `afterTotalsByTeam`, `diffSummary`, `mutationMetadata`).

## Key Live Tests Used

- `src/tests/architect/teamHistory.sourceSelection.guardrail.test.tsx:38-264` - verifies source priority, fixture override authority, explicit local priority, and synthesized fallback activation.
- `src/tests/architect/teamHistory.useWorldTeamEvents.guardrail.test.tsx:71-311` - verifies mixed-feed paging, per-contract cursor reuse, dedupe, newest-first merge behavior, and legacy-only pagination reuse.
- `src/tests/architect/teamHistory.worldEventsQueryFallback.test.ts:68-245` - verifies mixed canonical + legacy query merging, legacy-only fallback, empty resolution, pagination-state reuse, and fail-closed canonical errors.
- `src/tests/architect/teamHistory.normalization.displayContract.guardrail.test.ts:22-286` - verifies explicit mutation-display ownership, summary rules, cap-delta interpretation, and fallback detail notes.
- `src/tests/architect/teamHistory.baseMode.fallbackContract.guardrail.test.tsx:34-354` - verifies base-mode fallback ordering, synthesized-row timestamp ordering, and derived-source metadata behavior.
- `src/tests/architect/teamHistory.detailView.integration.test.tsx:29-274` - verifies modal ownership, truth notes, identity handling, and separation between normalized fields and raw payload.
- `src/tests/architect/teamHistory.devFixtureSafety.guardrail.test.tsx:101-301` - verifies fixture symmetry, fail-closed marker ownership, and distinct truth signaling across fixture / local / world modes.
- `src/tests/architect/teamHistory.worldEvents.integration.test.tsx:29-252` - verifies world-row rendering, detail modal truth, legacy note, mixed-feed note, empty state, and inline load-more error behavior.
- `src/tests/architect/teamHistory.worldBoundary.integration.test.tsx:62-141` - verifies world-context switching and fixture override precedence with a live world context.
- `src/tests/architect/teamHistory.eventWriteContract.guardrail.test.ts:4-55` - verifies the upstream world-event write payload Team History reads.
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesTeamHistory.integration.test.tsx:28-109` - verifies the TM Cap trade-apply Team History row and detail modal against the current normalized summary contract.

## Final Conclusion

As of 2026-04-04, Team History is a coherent, strongly owned feature with a clear truth model across world, local, synthesized, and DEV-fixture modes, and the remaining closeout blockers are resolved in live code. The world-event reader now supports mixed canonical + legacy-compatible feeds without giving up pagination or dedupe coherence, the focused Team History integration suite is aligned with the live display contract, and the required validation passed. The correct whole-feature read today is `PASS`.
