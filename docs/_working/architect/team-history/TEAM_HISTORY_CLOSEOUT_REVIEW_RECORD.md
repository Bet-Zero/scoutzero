# Team History Closeout Review Record

## Metadata

- Feature: Team History
- Framing: Whole-feature closeout review
- Date: 2026-04-04
- Repo / branch reviewed: `Bet-Zero/scoutzero` / `main`
- Review basis: Direct live-code verification of the current repository state, plus focused live test execution against the current repo. Prior working docs were not used as authority.

## Executive Verdict

**Verdict: RISK**

Team History now reads as one owned feature instead of six disconnected seams. Source selection is centralized, world-event loading and normalization feed one row model, base-mode fallback is explicitly labeled as derived, the detail modal respects row truth kind, and DEV fixtures fail closed from actual marker state. This is not PASS because two live-code facts still matter at closeout: world-event compatibility is still an all-or-nothing fallback rather than a mixed-feed merge, and one focused Team History UI integration test is currently red in the repo because its expected summary string no longer matches the live normalized output.

## Whole-Feature Team History System Map

- Primary owner: `TeamHistoryTab` is the real feature owner. `GMDashboard` passes `teamCapSheet`, `worldId`, and Team History DEV-tool callbacks into `HistorySection`, and `HistorySection` is only a thin handoff into `TeamHistoryTab`.
- Source-selection hierarchy: `resolveTeamHistoryTimeline(...)` makes one explicit top-level choice in this order: `dev-fixtures` -> `world-events` -> `local-timeline` -> `synthesized`.
- World path: `WorldEventsTimeline(...)` calls `useWorldTeamEvents(...)`; `fetchWorldTeamEvents(...)` tries the canonical `teamCodes` / `occurredAt` contract first, falls back to legacy `teamsAffected` / `timestamp` only when canonical returns zero rows, then `normalizeWorldEventsForTeamHistory(...)` turns raw event payloads into Team History rows.
- Base/local path: outside world-event mode, explicit `historyTimeline[]` rows win. If they do not exist, `normalizeTimelineFromSections(...)` synthesizes rows from `waivedContracts[]`, `exceptionHistory[]`, and `pickLog[]`, sorts them newest-first, and tags them as derived-source output.
- Detail modal path: every rendered row click funnels through `buildSelectedHistoryEntry(...)`, which assigns `timelineSourceKey` and `truthKind`; `HistoryDetailModal(...)` then renders normalized display fields, identity fields, cap-alignment checks, and raw-payload inspection based on that same selected-row contract.
- DEV fixture path: `useArchitectActions(...)` owns inject / clear callbacks, `devTeamHistoryFixtures.ts` mutates only in-memory team state, and `TeamHistoryTab` independently detects fixture markers in team data so fixture mode stays authoritative until those markers are actually cleared.

## Cross-Surface / Cross-Flow Integration Analysis

Ownership is coherent across the feature. The dashboard shell does not fork Team History logic. `GMDashboard` wires the section, `HistorySection` passes through, and `TeamHistoryTab` owns source resolution, row rendering, row selection, fixture signaling, and modal mounting. That is a real feature owner, not a stitched collection of local decisions.

Truth posture is also clear across modes. World rows are treated as authoritative only when the tab is world-backed and no fixture override is active. Explicit local rows are clearly presented as local timeline entries. Section-derived rows are explicitly labeled as convenience fallback and carry derived-source metadata instead of pretending to be world events. Fixture rows are called out as synthetic and non-authoritative in both the timeline shell and the detail modal.

Drill-down is downstream of the same owned truth model. World rows, local rows, synthesized rows, and fixture rows all enter the modal through `buildSelectedHistoryEntry(...)`. `HistoryDetailModal(...)` then uses `truthKind` to explain what the user is looking at and keeps normalized Team History display fields separate from raw-payload inspection. The modal does not silently backfill normalized IDs, totals, teams, or players from raw payload when those normalized fields are absent.

As a system, this behaves like one integrated feature. The world loader, the normalizer, the base fallback synthesizer, the detail modal, and the DEV fixture override all converge on one Team History row model and one selection model. The feature-level truth model is visible in the UI rather than being hidden in implementation detail.

## Remaining Hidden Ownership / Staging / Drift Risks

- Mixed-shape world histories are still a bounded risk. `fetchWorldTeamEvents(...)` returns canonical rows immediately when the canonical contract produces any results, and only falls back to legacy compatibility when canonical returns zero rows. Pagination then stays on the winning contract. That is coherent, and it is explicitly guarded, but it means Team History is not a merge reader for worlds that contain some newer canonical rows and some older legacy-only rows.
- One focused Team History integration test is red in the current repo state. `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesTeamHistory.integration.test.tsx` still expects the older row text `Trade Executed vs BOS`, while the live normalizer now renders `Trade Executed: LAL ↔ BOS`. That reads as verification drift more than a clear runtime defect, but it still blocks a clean PASS because the feature’s supporting integration suite is not fully aligned with the live Team History contract.

## Whole-Feature Verdict

### Why this is not FAIL

The feature is not failing as a system. Source ownership is explicit, the major truth modes are distinguished cleanly, the detail modal is tied to the selected Team History row rather than a separate shadow contract, fixture injection / clear logic is symmetric across the live managed surfaces, and the focused Team History guardrails mostly pass under the current repo state.

### Why this is not PASS

This is not PASS for two grounded reasons. First, the world-event compatibility path still depends on a non-mixed-feed assumption: canonical and legacy history are treated as alternate contracts, not as one merged history stream. Second, the current repo still contains a red Team History UI integration test whose expected text no longer matches the live normalized row contract. That is enough remaining drift to keep the closeout at `RISK`.

## Exact File + Function Citations

- `src/features/architect/GMDashboard/GMDashboard.tsx:517-528` - `GMDashboard` mounts `HistorySection` and passes Team History DEV-tool props from `actions.teamHistoryDevTools`.
- `src/features/architect/GMDashboard/sections/HistorySection.tsx:24-38` - `HistorySection(...)` is a pure passthrough into `TeamHistoryTab`.
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:4490-4539` - `hasInjectedTeamHistoryFixtures`, `injectTeamHistoryDevFixtures(...)`, `clearTeamHistoryDevFixtures(...)`, and `teamHistoryDevTools` define the Team History DEV fixture control surface.
- `src/features/architect/history/TeamHistoryTab/types.ts:32-133` - `TeamHistoryDisplayEntry`, `TeamHistoryTimelineSourceKey`, `TeamHistorySelectedEntry`, `TeamHistoryCapSheetLike`, `TeamHistoryTabProps`, and `HistoryDetailModalProps` define the shared Team History row / selection contract.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx:110-135` - `buildSelectedHistoryEntry(...)` stamps every selected row with `timelineSourceKey` and `truthKind`.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx:436-565` - `normalizeTimelineFromSections(...)`, `sortTimelineNewestFirst(...)`, and `resolveTeamHistoryTimeline(...)` define the base/local source-selection and synthesized fallback contract.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx:568-706` - `WorldEventsTimeline(...)` owns world-event loading display, compatibility note rendering, and pagination button behavior.
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx:708-953` - `TeamHistoryTab(...)` owns the banner, fixture panel, active timeline rendering, section trackers, selected-entry state, and modal mount.
- `src/features/architect/history/hooks/useWorldTeamEvents.ts:76-95` - `AUTHORITATIVE_QUERY_CONTRACT`, `LEGACY_COMPAT_QUERY_CONTRACT`, and `INITIAL_QUERY_CONTRACT_CHAIN`.
- `src/features/architect/history/hooks/useWorldTeamEvents.ts:196-265` - `fetchWorldTeamEvents(...)` implements canonical-first retrieval, legacy fallback, and contract reuse inputs.
- `src/features/architect/history/hooks/useWorldTeamEvents.ts:267-413` - `useWorldTeamEvents(...)` owns hook state, contract reuse for pagination, and merged newest-first dedupe.
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
- `src/tests/architect/teamHistory.useWorldTeamEvents.guardrail.test.tsx:71-232` - verifies canonical / legacy contract reuse, overfetch pagination, dedupe, and newest-first merge behavior.
- `src/tests/architect/teamHistory.worldEventsQueryFallback.test.ts:68-181` - verifies canonical-first retrieval, legacy fallback only after canonical emptiness, preferred-contract reuse, and fail-closed canonical errors.
- `src/tests/architect/teamHistory.normalization.displayContract.guardrail.test.ts:22-286` - verifies explicit mutation-display ownership, summary rules, cap-delta interpretation, and fallback detail notes.
- `src/tests/architect/teamHistory.baseMode.fallbackContract.guardrail.test.tsx:34-354` - verifies base-mode fallback ordering, synthesized-row timestamp ordering, and derived-source metadata behavior.
- `src/tests/architect/teamHistory.detailView.integration.test.tsx:29-274` - verifies modal ownership, truth notes, identity handling, and separation between normalized fields and raw payload.
- `src/tests/architect/teamHistory.devFixtureSafety.guardrail.test.tsx:101-301` - verifies fixture symmetry, fail-closed marker ownership, and distinct truth signaling across fixture / local / world modes.
- `src/tests/architect/teamHistory.worldEvents.integration.test.tsx:29-216` - verifies world-row rendering, detail modal truth, compatibility note, empty state, and inline load-more error behavior.
- `src/tests/architect/teamHistory.worldBoundary.integration.test.tsx:62-141` - verifies world-context switching and fixture override precedence with a live world context.
- `src/tests/architect/teamHistory.eventWriteContract.guardrail.test.ts:4-55` - verifies the upstream world-event write payload Team History reads.
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesTeamHistory.integration.test.tsx:28-93` - currently fails under live repo state because its row-text expectation is older than the current normalized Team History output.

## Final Conclusion

As of 2026-04-04, Team History is a coherent, strongly owned feature with a clear truth model across world, local, synthesized, and DEV-fixture modes. It is close to whole-feature closeout quality, but the current repo does not support an unconditional PASS because world-event compatibility is still bounded by a non-merged contract assumption and one focused Team History integration test is presently red. The correct whole-feature read today is `RISK`, not `FAIL`, and not `PASS`.
